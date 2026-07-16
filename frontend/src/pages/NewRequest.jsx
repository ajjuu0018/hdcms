import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function NewRequest() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    gauge_name: "", gauge_number: "", gauge_type: "", manufacturer: "", model: "",
    range: "", least_count: "", department: user.department, machine: "", machine_number: "",
    location: "", purpose: "", quantity: 1, reason: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/departments").then(r => setDepartments(r.data.filter(d => !d.is_calibration)));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/requests", form);
      toast.success(`Request ${data.request_no} submitted`);
      nav("/requests");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader
        title="New Gauge Request"
        subtitle="Initiate the 4-stage approval workflow"
        breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Requests", href: "/requests" }, { label: "New" }]}
      />

      <form onSubmit={submit} className="space-y-6 max-w-4xl" data-testid="new-request-form">
        <Section title="Gauge Specifications">
          <Field label="Gauge Name" required>
            <input required value={form.gauge_name} onChange={e => setForm({...form, gauge_name: e.target.value})} className="h-input" data-testid="gauge-name-input" />
          </Field>
          <Field label="Gauge Number">
            <input value={form.gauge_number} onChange={e => setForm({...form, gauge_number: e.target.value})} className="h-input" data-testid="gauge-number-input" />
          </Field>
          <Field label="Type" required>
            <input required value={form.gauge_type} onChange={e => setForm({...form, gauge_type: e.target.value})} className="h-input" placeholder="e.g. Vernier Caliper" data-testid="gauge-type-input" />
          </Field>
          <Field label="Manufacturer">
            <input value={form.manufacturer} onChange={e => setForm({...form, manufacturer: e.target.value})} className="h-input" data-testid="manufacturer-input" />
          </Field>
          <Field label="Model">
            <input value={form.model} onChange={e => setForm({...form, model: e.target.value})} className="h-input" data-testid="model-input" />
          </Field>
          <Field label="Range">
            <input value={form.range} onChange={e => setForm({...form, range: e.target.value})} className="h-input" placeholder="e.g. 0-150mm" data-testid="range-input" />
          </Field>
          <Field label="Least Count">
            <input value={form.least_count} onChange={e => setForm({...form, least_count: e.target.value})} className="h-input" placeholder="e.g. 0.02mm" data-testid="least-count-input" />
          </Field>
          <Field label="Quantity">
            <input type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value || 1)})} className="h-input" data-testid="quantity-input" />
          </Field>
        </Section>

        <Section title="Usage Details">
          <Field label="Department" required>
            <select required value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="h-input" data-testid="department-select">
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Machine">
            <input value={form.machine} onChange={e => setForm({...form, machine: e.target.value})} className="h-input" data-testid="machine-input" />
          </Field>
          <Field label="Machine Number">
            <input value={form.machine_number} onChange={e => setForm({...form, machine_number: e.target.value})} className="h-input" data-testid="machine-number-input" />
          </Field>
          <Field label="Location">
            <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="h-input" data-testid="location-input" />
          </Field>
        </Section>

        <Section title="Justification">
          <Field label="Purpose" required full>
            <textarea required value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} className="h-input min-h-[80px]" data-testid="purpose-input" />
          </Field>
          <Field label="Reason / Justification" full>
            <textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="h-input min-h-[80px]" data-testid="reason-input" />
          </Field>
        </Section>

        <div className="flex justify-end gap-2">
          <Link to="/requests" className="h-input w-auto px-4 text-sm flex items-center">Cancel</Link>
          <button type="submit" disabled={busy} className="h-btn-primary" data-testid="submit-request-btn">
            {busy ? "Submitting…" : "Submit for Approval"}
          </button>
        </div>
      </form>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div className="h-card p-5">
      <h3 className="text-lg font-bold mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children, required, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="h-label block mb-1.5">{label}{required && <span className="text-[#CC0000] ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}
