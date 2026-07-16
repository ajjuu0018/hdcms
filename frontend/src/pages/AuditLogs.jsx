import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { formatDateTime } from "@/lib/format";

export default function AuditLogs() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ q: "", action: "", entity_type: "" });
  useEffect(() => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    api.get("/audit-logs", { params: p }).then(r => setItems(r.data));
  }, [filters]);

  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Complete activity history" breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Audit" }]} />
      <div className="h-card p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input placeholder="Search user / action / remark" value={filters.q} onChange={e => setFilters({...filters, q: e.target.value})} className="h-input" data-testid="audit-q" />
        <select value={filters.action} onChange={e => setFilters({...filters, action: e.target.value})} className="h-input" data-testid="audit-action">
          <option value="">All Actions</option>
          {["create","update","delete","approve","reject","login","logout","lock","unlock","sent_to_calibration","returned_to_user","received"].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filters.entity_type} onChange={e => setFilters({...filters, entity_type: e.target.value})} className="h-input" data-testid="audit-entity">
          <option value="">All Entities</option>
          {["user","department","gauge","request","calibration_report","missing_report","auth","settings"].map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div className="h-card overflow-x-auto" data-testid="audit-table">
        <table className="h-table">
          <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Remarks</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No logs</td></tr>}
            {items.map(l => (
              <tr key={l.id}>
                <td>{formatDateTime(l.timestamp)}</td>
                <td>{l.user_name} <span className="text-gray-400">({l.employee_id})</span></td>
                <td>{l.role}</td>
                <td className="capitalize">{l.action}</td>
                <td>{l.entity_type}</td>
                <td className="text-xs text-gray-500">{l.entity_id?.slice(0, 8)}…</td>
                <td>{l.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
