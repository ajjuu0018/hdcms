import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/format";

export default function PendingApprovals() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [missing, setMissing] = useState([]);
  const [calReports, setCalReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/requests/pending").then(r => setRequests(r.data)).catch(() => setRequests([])),
      ["user_head", "cal_emp", "cal_head", "admin"].includes(user.role)
        ? api.get("/missing-reports").then(r => setMissing(r.data.filter(m => {
            if (user.role === "user_head") return m.status === "pending_user_head";
            if (user.role === "cal_emp") return m.status === "pending_cal_dept";
            if (user.role === "cal_head") return m.status === "pending_cal_head";
            return true;
          }))).catch(() => setMissing([]))
        : Promise.resolve(),
      ["cal_head", "admin"].includes(user.role)
        ? api.get("/calibration-reports/pending").then(r => setCalReports(r.data)).catch(() => setCalReports([]))
        : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [user.role]);

  return (
    <>
      <PageHeader
        title="Pending Approvals"
        subtitle={`Items awaiting your action`}
        breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Approvals" }]}
      />

      <Section title={`Gauge Requests (${requests.length})`} data-testid="section-requests">
        {requests.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="h-table">
              <thead><tr><th>Request</th><th>Gauge</th><th>Department</th><th>By</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td><Link to={`/requests/${r.id}`} className="text-[#CC0000] hover:underline font-bold" data-testid={`pending-req-${r.request_no}`}>{r.request_no}</Link></td>
                    <td>{r.gauge_name}</td>
                    <td>{r.department}</td>
                    <td>{r.requested_by_name}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {missing.length > 0 && (
        <Section title={`Missing Gauge Reports (${missing.length})`}>
          <div className="overflow-x-auto">
            <table className="h-table">
              <thead><tr><th>Report</th><th>Gauge</th><th>Reason</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {missing.map(m => (
                  <tr key={m.id}>
                    <td><Link to={`/missing/${m.id}`} className="text-[#CC0000] hover:underline font-bold" data-testid={`pending-missing-${m.report_no}`}>{m.report_no}</Link></td>
                    <td>{m.gauge_ref} · {m.gauge_name}</td>
                    <td>{m.reason}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td>{formatDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {calReports.length > 0 && (
        <Section title={`Calibration Reports Awaiting Approval (${calReports.length})`}>
          <div className="overflow-x-auto">
            <table className="h-table">
              <thead><tr><th>Report</th><th>Gauge</th><th>Cal Date</th><th>Result</th><th>By</th></tr></thead>
              <tbody>
                {calReports.map(c => (
                  <tr key={c.id}>
                    <td><Link to={`/calibration/${c.id}`} className="text-[#CC0000] hover:underline font-bold" data-testid={`pending-cal-${c.report_no}`}>{c.report_no}</Link></td>
                    <td>{c.gauge_ref} · {c.gauge_name}</td>
                    <td>{formatDate(c.calibration_date)}</td>
                    <td><StatusBadge status={c.overall_result} /></td>
                    <td>{c.created_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && requests.length === 0 && missing.length === 0 && calReports.length === 0 && (
        <Empty />
      )}
    </>
  );
}

function Section({ title, children }) {
  return (
    <div className="h-card mb-4">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-base font-bold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
function Empty() {
  return (
    <div className="text-center py-12 text-gray-400 px-5">
      <p className="text-sm font-mono uppercase tracking-widest">No pending items</p>
    </div>
  );
}
