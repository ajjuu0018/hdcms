import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/format";
import { Plus } from "@phosphor-icons/react";

export default function Calibration() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = {};
    if (status) params.status = status;
    api.get("/calibration-reports", { params }).then(r => setItems(r.data));
  }, [status]);

  const canCreate = ["cal_emp", "cal_head", "admin"].includes(user.role);

  return (
    <>
      <PageHeader
        title="Calibration Reports"
        subtitle={`${items.length} report(s)`}
        breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Calibration" }]}
        actions={canCreate && (
          <Link to="/calibration/new" className="h-btn-primary flex items-center gap-1.5" data-testid="new-cal-btn">
            <Plus size={14} weight="bold" /> New Report
          </Link>
        )}
      />

      <div className="h-card p-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="h-label">Filter:</span>
          <select className="h-input w-auto text-sm" value={status} onChange={e => setStatus(e.target.value)} data-testid="cal-status-filter">
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="h-card overflow-x-auto" data-testid="cal-reports-table">
        <table className="h-table">
          <thead><tr><th>Report</th><th>Gauge</th><th>Department</th><th>Cal Date</th><th>Due</th><th>Result</th><th>Status</th><th>By</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">No reports</td></tr>}
            {items.map(r => (
              <tr key={r.id} data-testid={`cal-row-${r.report_no}`}>
                <td><Link to={`/calibration/${r.id}`} className="text-[#CC0000] hover:underline font-bold">{r.report_no}</Link></td>
                <td>{r.gauge_ref} · {r.gauge_name}</td>
                <td>{r.department}</td>
                <td>{formatDate(r.calibration_date)}</td>
                <td>{formatDate(r.next_due_date)}</td>
                <td><StatusBadge status={r.overall_result} /></td>
                <td><StatusBadge status={r.approval_status} /></td>
                <td>{r.created_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
