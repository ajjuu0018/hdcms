import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Movement() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const load = () => api.get("/movement", { params: status ? { status } : {} }).then(r => setItems(r.data));
  useEffect(load, [status]);

  const receive = async (id) => {
    try { await api.post(`/movement/${id}/receive`); toast.success("Gauge received"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const canReceive = ["cal_emp", "cal_head", "admin"].includes(user.role);

  return (
    <>
      <PageHeader title="Gauge Movement Tracker" subtitle={`${items.length} movement entries`} breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Movement" }]} />
      <div className="h-card p-4 mb-4 flex items-center gap-2">
        <span className="h-label">Filter:</span>
        <select className="h-input w-auto" value={status} onChange={e => setStatus(e.target.value)} data-testid="movement-filter">
          <option value="">All</option>
          <option value="pending">Pending Receipt</option>
        </select>
      </div>
      <div className="h-card overflow-x-auto" data-testid="movement-table">
        <table className="h-table">
          <thead><tr><th>Date</th><th>Gauge</th><th>Action</th><th>From → To</th><th>By</th><th>Received</th><th>Remarks</th><th></th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">No movement</td></tr>}
            {items.map(m => (
              <tr key={m.id} data-testid={`movement-row-${m.id}`}>
                <td>{formatDateTime(m.date)}</td>
                <td><Link to={`/gauges/${m.gauge_id}`} className="text-[#CC0000] hover:underline font-bold">{m.gauge_ref}</Link></td>
                <td>{m.action.replace(/_/g, " ")}</td>
                <td>{m.from_dept} → {m.to_dept}</td>
                <td>{m.by_name}</td>
                <td>{m.received ? formatDateTime(m.received_date) : <StatusBadge status="pending_cal_dept" label="PENDING" />}</td>
                <td>{m.remarks || "—"}</td>
                <td>
                  {!m.received && canReceive && (
                    <button onClick={() => receive(m.id)} className="h-btn-primary text-xs" data-testid={`receive-btn-${m.id}`}>Receive</button>
                  )}
                  {!m.received && !canReceive && (
                    <Link to={`/gauges/${m.gauge_id}`} className="text-xs text-[#CC0000] hover:underline">Report Missing →</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
