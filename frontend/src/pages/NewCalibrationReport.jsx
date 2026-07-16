import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash, FloppyDisk, PaperPlaneRight } from "@phosphor-icons/react";

const defaultRow = { standard: "", actual: "", error: "", tolerance: "", result: "OK" };

export default function NewCalibrationReport() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [gauges, setGauges] = useState([]);
  const today = new Date().toISOString().slice(0, 10);
  const oneYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    gauge_id: "", calibration_date: today, next_due_date: oneYear,
    standard_used: "", instrument_used: "", temperature: "23 ± 2 °C",
    humidity: "50 ± 10 %", operator: user.name, approved_by: "",
    overall_result: "PASS", remarks: "", certificate_url: "", status: "draft",
  });
  const [readings, setReadings] = useState([{ ...defaultRow }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/gauges").then(r => setGauges(r.data));
  }, []);

  const addRow = () => setReadings([...readings, { ...defaultRow }]);
  const removeRow = (i) => setReadings(readings.filter((_, idx) => idx !== i));
  const updateRow = (i, k, v) => {
    const next = [...readings];
    next[i] = { ...next[i], [k]: v };
    // Auto compute error if both standard and actual numeric
    if (k === "actual" || k === "standard") {
      const s = parseFloat(next[i].standard);
      const a = parseFloat(next[i].actual);
      if (!isNaN(s) && !isNaN(a)) next[i].error = (a - s).toFixed(4);
    }
    setReadings(next);
  };

  const submit = async (status) => {
    if (!form.gauge_id) { toast.error("Select a gauge"); return; }
    if (readings.length === 0) { toast.error("Add at least one reading"); return; }
    setBusy(true);
    try {
      const payload = { ...form, status, readings };
      const { data } = await api.post("/calibration-reports", payload);
      toast.success(status === "submitted" ? `Submitted ${data.report_no}` : `Saved as draft ${data.report_no}`);
      nav("/calibration");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader
        title="New Calibration Report"
        subtitle="Record calibration readings and submit for approval"
        breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Calibration", href: "/calibration" }, { label: "New" }]}
        actions={
          <>
            <button onClick={() => submit("draft")} disabled={busy} className="h-input w-auto text-sm flex items-center gap-1.5" data-testid="save-draft-btn">
              <FloppyDisk size={14} /> Save Draft
            </button>
            <button onClick={() => submit("submitted")} disabled={busy} className="h-btn-primary flex items-center gap-1.5" data-testid="submit-cal-btn">
              <PaperPlaneRight size={14} weight="bold" /> Submit for Approval
            </button>
          </>
        }
      />

      <div className="space-y-4">
        <Section title="Header">
          <Field label="Gauge" required>
            <select required value={form.gauge_id} onChange={e => setForm({...form, gauge_id: e.target.value})} className="h-input" data-testid="cal-gauge-select">
              <option value="">Select gauge…</option>
              {gauges.map(g => <option key={g.id} value={g.id}>{g.gauge_id} · {g.name} ({g.department})</option>)}
            </select>
          </Field>
          <Field label="Calibration Date" required>
            <input required type="date" value={form.calibration_date} onChange={e => setForm({...form, calibration_date: e.target.value})} className="h-input" data-testid="cal-date-input" />
          </Field>
          <Field label="Next Due Date" required>
            <input required type="date" value={form.next_due_date} onChange={e => setForm({...form, next_due_date: e.target.value})} className="h-input" data-testid="cal-due-input" />
          </Field>
          <Field label="Standard Used">
            <input value={form.standard_used} onChange={e => setForm({...form, standard_used: e.target.value})} className="h-input" placeholder="e.g. Gauge Block 25mm" data-testid="cal-standard-input" />
          </Field>
          <Field label="Instrument Used">
            <input value={form.instrument_used} onChange={e => setForm({...form, instrument_used: e.target.value})} className="h-input" data-testid="cal-instrument-input" />
          </Field>
          <Field label="Temperature">
            <input value={form.temperature} onChange={e => setForm({...form, temperature: e.target.value})} className="h-input" data-testid="cal-temperature-input" />
          </Field>
          <Field label="Humidity">
            <input value={form.humidity} onChange={e => setForm({...form, humidity: e.target.value})} className="h-input" data-testid="cal-humidity-input" />
          </Field>
          <Field label="Operator">
            <input value={form.operator} onChange={e => setForm({...form, operator: e.target.value})} className="h-input" data-testid="cal-operator-input" />
          </Field>
          <Field label="Approved By">
            <input value={form.approved_by} onChange={e => setForm({...form, approved_by: e.target.value})} className="h-input" placeholder="Cal Head name" data-testid="cal-approved-by-input" />
          </Field>
        </Section>

        <div className="h-card">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-base font-bold">Reading Table</h3>
            <button type="button" onClick={addRow} className="h-input w-auto text-sm flex items-center gap-1.5" data-testid="add-reading-btn">
              <Plus size={14} weight="bold" /> Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="h-table" data-testid="readings-table">
              <thead>
                <tr><th>#</th><th>Standard</th><th>Actual</th><th>Error</th><th>Tolerance</th><th>Result</th><th></th></tr>
              </thead>
              <tbody>
                {readings.map((r, i) => (
                  <tr key={i}>
                    <td className="text-gray-400">{i + 1}</td>
                    <td><input value={r.standard} onChange={e => updateRow(i, "standard", e.target.value)} className="h-input font-mono" data-testid={`reading-${i}-standard`} /></td>
                    <td><input value={r.actual} onChange={e => updateRow(i, "actual", e.target.value)} className="h-input font-mono" data-testid={`reading-${i}-actual`} /></td>
                    <td><input value={r.error} onChange={e => updateRow(i, "error", e.target.value)} className="h-input font-mono" data-testid={`reading-${i}-error`} /></td>
                    <td><input value={r.tolerance} onChange={e => updateRow(i, "tolerance", e.target.value)} className="h-input font-mono" data-testid={`reading-${i}-tolerance`} /></td>
                    <td>
                      <select value={r.result} onChange={e => updateRow(i, "result", e.target.value)} className="h-input" data-testid={`reading-${i}-result`}>
                        <option value="OK">OK</option>
                        <option value="NG">NG</option>
                      </select>
                    </td>
                    <td>
                      {readings.length > 1 && (
                        <button type="button" onClick={() => removeRow(i)} className="text-gray-400 hover:text-[#CC0000]" data-testid={`remove-reading-${i}`}>
                          <Trash size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Section title="Result">
          <Field label="Overall Result">
            <select value={form.overall_result} onChange={e => setForm({...form, overall_result: e.target.value})} className="h-input" data-testid="overall-result-select">
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
            </select>
          </Field>
          <Field label="Certificate URL">
            <input value={form.certificate_url} onChange={e => setForm({...form, certificate_url: e.target.value})} className="h-input" placeholder="Optional link to certificate" data-testid="cert-url-input" />
          </Field>
          <Field label="Remarks" full>
            <textarea value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} className="h-input min-h-[80px]" data-testid="cal-remarks-input" />
          </Field>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div className="h-card p-5">
      <h3 className="text-base font-bold mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}
function Field({ label, children, required, full }) {
  return (
    <div className={full ? "md:col-span-3" : ""}>
      <label className="h-label block mb-1.5">{label}{required && <span className="text-[#CC0000] ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}
