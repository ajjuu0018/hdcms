import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { toast } from "sonner";

export default function NewGauge() {
  const nav = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    gauge_id: "", name: "", type: "", department: "",
    machine: "", machine_number: "", location: "",
    manufacturer: "", model: "", range: "", least_count: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/departments").then(r => setDepartments(r.data.filter(d => !d.is_calibration))); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/gauges", form);
      toast.success("Gauge added to master list");
      nav("/gauges");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Add Gauge" subtitle="Directly add a gauge to master list (Calibration / Admin)" breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Master Gauges", href: "/gauges" }, { label: "New" }]} />
      <form onSubmit={submit} className="h-card p-6 max-w-3xl space-y-4" data-testid="new-gauge-form">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Gauge ID" required><input required value={form.gauge_id} onChange={e => setForm({...form, gauge_id: e.target.value})} className="h-input uppercase font-mono" placeholder="e.g. HG-2001" data-testid="gauge-id-input" /></Field>
          <Field label="Name" required><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-input" data-testid="gauge-name-input" /></Field>
          <Field label="Type" required><input required value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="h-input" data-testid="gauge-type-input" /></Field>
          <Field label="Department" required>
            <select required value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="h-input" data-testid="gauge-dept-input">
              <option value="">Select…</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Machine"><input value={form.machine} onChange={e => setForm({...form, machine: e.target.value})} className="h-input" data-testid="gauge-machine-input" /></Field>
          <Field label="Machine Number"><input value={form.machine_number} onChange={e => setForm({...form, machine_number: e.target.value})} className="h-input" /></Field>
          <Field label="Location"><input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="h-input" /></Field>
          <Field label="Manufacturer"><input value={form.manufacturer} onChange={e => setForm({...form, manufacturer: e.target.value})} className="h-input" /></Field>
          <Field label="Model"><input value={form.model} onChange={e => setForm({...form, model: e.target.value})} className="h-input" /></Field>
          <Field label="Range"><input value={form.range} onChange={e => setForm({...form, range: e.target.value})} className="h-input" /></Field>
          <Field label="Least Count"><input value={form.least_count} onChange={e => setForm({...form, least_count: e.target.value})} className="h-input" /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Link to="/gauges" className="h-input w-auto px-4 text-sm flex items-center">Cancel</Link>
          <button type="submit" disabled={busy} className="h-btn-primary" data-testid="gauge-save-btn">{busy ? "Saving…" : "Add Gauge"}</button>
        </div>
      </form>
    </>
  );
}

function Field({ label, children, required }) {
  return (
    <div>
      <label className="h-label block mb-1.5">{label}{required && <span className="text-[#CC0000] ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}
