import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash } from "@phosphor-icons/react";

export default function DepartmentManagement() {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/departments").then(r => setItems(r.data));
  useEffect(() => {
    load();
    api.get("/users", { params: { role: "user_head" } }).then(r => setUsers(r.data));
  }, []);

  const onDelete = async (d) => {
    if (!window.confirm(`Delete ${d.name}?`)) return;
    try { await api.delete(`/departments/${d.id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <>
      <PageHeader title="Departments" subtitle={`${items.length} department(s)`} breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Departments" }]}
        actions={<button onClick={() => { setEditing(null); setShow(true); }} className="h-btn-primary flex items-center gap-1.5" data-testid="add-dept-btn">
          <Plus size={14} weight="bold" /> Add Department
        </button>} />
      <div className="h-card overflow-x-auto" data-testid="departments-table">
        <table className="h-table">
          <thead><tr><th>Name</th><th>Code</th><th>Head (Emp ID)</th><th>Description</th><th>Type</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map(d => (
              <tr key={d.id} data-testid={`dept-row-${d.code}`}>
                <td className="font-bold">{d.name}</td>
                <td>{d.code}</td>
                <td>{d.head_employee_id || "—"}</td>
                <td className="text-gray-600">{d.description || "—"}</td>
                <td>{d.is_calibration ? <span className="h-status-badge" style={{backgroundColor:"#FEF3C7", color:"#92400E", borderColor:"#F59E0B"}}>CALIBRATION</span> : "User"}</td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(d); setShow(true); }} className="p-1 hover:bg-gray-100" data-testid={`edit-dept-${d.code}`}><PencilSimple size={14} /></button>
                    {!d.is_calibration && <button onClick={() => onDelete(d)} className="p-1 hover:bg-red-50 text-[#CC0000]" data-testid={`delete-dept-${d.code}`}><Trash size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {show && <DeptModal editing={editing} onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </>
  );
}

function DeptModal({ editing, onClose, onSaved }) {
  const [form, setForm] = useState(editing ? {
    name: editing.name, code: editing.code, description: editing.description, head_employee_id: editing.head_employee_id || ""
  } : { name: "", code: "", description: "", head_employee_id: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) { await api.put(`/departments/${editing.id}`, form); toast.success("Updated"); }
      else { await api.post("/departments", form); toast.success("Created"); }
      onSaved();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white border w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-black mb-4">{editing ? "Edit Department" : "Create Department"}</h3>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="h-label block mb-1">Name</label><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-input" data-testid="dept-name" /></div>
          <div><label className="h-label block mb-1">Code</label><input value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="h-input uppercase font-mono" data-testid="dept-code" /></div>
          <div><label className="h-label block mb-1">Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="h-input min-h-[60px]" data-testid="dept-desc" /></div>
          <div><label className="h-label block mb-1">Head Employee ID</label><input value={form.head_employee_id} onChange={e => setForm({...form, head_employee_id: e.target.value})} className="h-input uppercase font-mono" data-testid="dept-head" /></div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-input w-auto px-4 text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="h-btn-primary" data-testid="dept-save-btn">{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
