import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/format";
import { Plus, DownloadSimple } from "@phosphor-icons/react";
import { API_BASE } from "@/lib/api";

export default function Requests() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useSearchParams();
  const mine = search.get("mine") === "true";

  const load = () => {
    setLoading(true);
    api.get("/requests", { params: mine ? { mine: true } : {} }).then(r => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [mine]);

  const canCreate = ["user_emp", "user_head", "admin"].includes(user.role);

  const exportXlsx = async () => {
    const token = localStorage.getItem("hdcms_token");
    const res = await fetch(`${API_BASE}/exports/requests.xlsx`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "requests.xlsx"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title={mine ? "My Requests" : "Gauge Requests"}
        subtitle={`${items.length} request(s)`}
        breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Requests" }]}
        actions={
          <>
            <button onClick={exportXlsx} className="h-input w-auto text-sm flex items-center gap-1.5" data-testid="export-requests-btn">
              <DownloadSimple size={14} /> Excel
            </button>
            {canCreate && (
              <Link to="/requests/new" className="h-btn-primary flex items-center gap-1.5" data-testid="new-request-btn">
                <Plus size={14} weight="bold" /> New Request
              </Link>
            )}
          </>
        }
      />

      <div className="h-card overflow-hidden" data-testid="requests-table">
        <div className="overflow-x-auto">
          <table className="h-table">
            <thead>
              <tr>
                <th>Request No</th><th>Gauge</th><th>Type</th><th>Department</th>
                <th>Quantity</th><th>Requested By</th><th>Status</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">No requests found</td></tr>}
              {items.map(r => (
                <tr key={r.id} data-testid={`request-row-${r.request_no}`}>
                  <td><Link to={`/requests/${r.id}`} className="text-[#CC0000] hover:underline font-bold" data-testid={`request-link-${r.request_no}`}>{r.request_no}</Link></td>
                  <td>{r.gauge_name}</td>
                  <td>{r.gauge_type}</td>
                  <td>{r.department}</td>
                  <td>{r.quantity}</td>
                  <td>{r.requested_by_name}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
