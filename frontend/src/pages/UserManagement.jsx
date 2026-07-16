import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { ROLE_LABELS } from "@/lib/format";
import { toast } from "sonner";
import { Plus, PencilSimple, LockKey, LockKeyOpen, Trash, Key } from "@phosphor-icons/react";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [filter, setFilter] = useState({ q: "", role: "", department: "" });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    const p = {}; Object.entries(filter).forEach(([k, v]) => { if (v) p[k] = v; });
    api.get("/users", { params: p }).then(r => setUsers(r.data));
  };
  useEffect(load, [filter]);

  useEffect(() => {
    api.get("/departments").then(r => setDepartments(r.data));
    api.get("/roles").then(r => setRoles(r.data));
  }, []);

  const onLock = async (u) => { await api.post(`/users/${u.id}/${u.locked ? "unlock" : "lock"}`); toast.success(u.locked ? "Unlocked" : "Locked"); load(); };
  const onDelete = async (u) => {
    if (!window.confirm(`Delete ${u.name}?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const onResetPw = async (u) => {
    const np = window.prompt("New password for " + u.name + ":");
    if (!np) return;
    await api.post(`/users/${u.id}/reset-password`, { new_password: np });
    toast.success("Password reset");
  };

  return (
    <>
      <PageHeader title="User Management" subtitle={`${users.length} user(s)`} breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Users" }]}
        actions={<button onClick={() => { setEditing(null); setShowModal(true); }} className="h-btn-primary flex items-center gap-1.5" data-testid="add-user-btn">
          <Plus size={14} weight="bold" /> Add User
        </button>} />

      <div className="h-card p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input placeholder="Search by Employee ID / Name" value={filter.q} onChange={e => setFilter({...filter, q: e.target.value})} className="h-input" data-testid="users-search" />
        <select value={filter.role} onChange={e => setFilter({...filter, role: e.target.value})} className="h-input" data-testid="users-role-filter">
          <option value="">All Roles</option>
          {roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <select value={filter.department} onChange={e => setFilter({...filter, department: e.target.value})} className="h-input" data-testid="users-dept-filter">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </div>

      <div className="h-card overflow-x-auto" data-testid="users-table">
        <table className="h-table">
          <thead><tr><th>Employee ID</th><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} data-testid={`user-row-${u.employee_id}`}>
                <td className="font-bold">{u.employee_id}</td>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role] || u.role}</td>
                <td>{u.department}</td>
                <td>{u.locked ? <StatusBadge status="rejected" label="LOCKED" /> : <StatusBadge status="approved" label="ACTIVE" />}</td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(u); setShowModal(true); }} className="p-1 hover:bg-gray-100" title="Edit" data-testid={`edit-${u.employee_id}`}><PencilSimple size={14} /></button>
                    <button onClick={() => onResetPw(u)} className="p-1 hover:bg-gray-100" title="Reset password" data-testid={`reset-pw-${u.employee_id}`}><Key size={14} /></button>
                    <button onClick={() => onLock(u)} className="p-1 hover:bg-gray-100" title={u.locked ? "Unlock" : "Lock"} data-testid={`lock-${u.employee_id}`}>{u.locked ? <LockKeyOpen size={14} /> : <LockKey size={14} />}</button>
                    <button onClick={() => onDelete(u)} className="p-1 hover:bg-red-50 text-[#CC0000]" title="Delete" data-testid={`delete-${u.employee_id}`}><Trash size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <UserModal editing={editing} departments={departments} roles={roles} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </>
  );
}

function UserModal({ editing, departments, roles, onClose, onSaved }) {
  const [form, setForm] = useState(editing ? {
    name: editing.name, email: editing.email, role: editing.role, department: editing.department
  } : { employee_id: "", name: "", email: "", role: "user_emp", department: departments[0]?.name || "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, form);
        toast.success("User updated");
      } else {
        await api.post("/users", form);
        toast.success("User created");
      }
      onSaved();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose} data-testid="user-modal">
      <div className="bg-white border border-gray-200 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-black tracking-tighter mb-4">{editing ? "Edit User" : "Create User"}</h3>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          {!editing && (
            <div className="col-span-2">
              <label className="h-label block mb-1">Employee ID</label>
              <input required value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})} className="h-input uppercase font-mono" data-testid="user-emp-id" />
            </div>
          )}
          <div className="col-span-2"><label className="h-label block mb-1">Name</label><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-input" data-testid="user-name" /></div>
          <div className="col-span-2"><label className="h-label block mb-1">Email</label><input type="email" value={form.email || ""} onChange={e => setForm({...form, email: e.target.value})} className="h-input" data-testid="user-email" /></div>
          <div><label className="h-label block mb-1">Role</label>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="h-input" data-testid="user-role">
              {roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div><label className="h-label block mb-1">Department</label>
            <select value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="h-input" data-testid="user-dept">
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          {!editing && (
            <div className="col-span-2"><label className="h-label block mb-1">Password</label>
              <input required type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="h-input" data-testid="user-password" />
            </div>
          )}
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-input w-auto px-4 text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="h-btn-primary" data-testid="user-save-btn">{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
