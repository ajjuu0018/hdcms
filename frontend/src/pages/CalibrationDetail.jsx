import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, API_BASE } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Check, X, DownloadSimple, Printer } from "@phosphor-icons/react";

export default function CalibrationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [r, setR] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/calibration-reports/${id}`).then(res => setR(res.data));
  useEffect(() => { load(); }, [id]);

  if (!r) return <PageHeader title="Loading…" />;

  const canApprove = ["cal_head", "admin"].includes(user.role) && r.approval_status === "pending";

  const act = async (action) => {
    if (action === "reject" && !remarks.trim()) { toast.error("Remarks required for rejection"); return; }
    setBusy(true);
    try {
      await api.post(`/calibration-reports/${r.id}/action`, { action, remarks });
      toast.success(action === "approve" ? "Approved" : "Rejected");
      setRemarks(""); load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  const downloadPdf = async () => {
    const token = localStorage.getItem("hdcms_token");
    const res = await fetch(`${API_BASE}/exports/calibration-report/${r.id}.pdf`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${r.report_no}.pdf`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title={r.report_no}
        subtitle={`${r.gauge_ref} · ${r.gauge_name}`}
        breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Calibration", href: "/calibration" }, { label: r.report_no }]}
        actions={
          <>
            <StatusBadge status={r.approval_status} />
            <StatusBadge status={r.overall_result} />
            <button onClick={() => window.print()} className="h-input w-auto text-sm flex items-center gap-1.5" data-testid="print-cal-btn">
              <Printer size={14} /> Print
            </button>
            <button onClick={downloadPdf} className="h-input w-auto text-sm flex items-center gap-1.5" data-testid="download-pdf-btn">
              <DownloadSimple size={14} /> PDF
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-card p-5">
            <h3 className="text-base font-bold mb-4">Header Details</h3>
            <dl className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[["Calibration Date", formatDate(r.calibration_date)], ["Next Due Date", formatDate(r.next_due_date)],
                ["Standard Used", r.standard_used], ["Instrument Used", r.instrument_used],
                ["Temperature", r.temperature], ["Humidity", r.humidity],
                ["Operator", r.operator], ["Approved By", r.approved_by_name || r.approved_by]].map(([k, v]) => (
                <div key={k}>
                  <dt className="h-label">{k}</dt>
                  <dd className="font-mono text-sm dark:text-gray-200">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="h-card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-bold">Readings</h3>
              <span className="h-label">{r.readings.length} rows</span>
            </div>
            <table className="h-table">
              <thead><tr><th>#</th><th>Standard</th><th>Actual</th><th>Error</th><th>Tolerance</th><th>Result</th></tr></thead>
              <tbody>
                {r.readings.map((row, i) => (
                  <tr key={i}>
                    <td className="text-gray-400">{i + 1}</td>
                    <td>{row.standard}</td>
                    <td>{row.actual}</td>
                    <td>{row.error}</td>
                    <td>{row.tolerance}</td>
                    <td><StatusBadge status={row.result} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="h-card p-5">
            <h3 className="text-base font-bold mb-2">Remarks</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">{r.remarks || "—"}</p>
          </div>

          <div className="h-card p-5">
            <h3 className="text-base font-bold mb-3">History</h3>
            <div className="space-y-2">
              {r.history.map((h, i) => (
                <div key={i} className="border-l-2 border-gray-300 pl-3 py-1 text-sm">
                  <div className="flex justify-between"><span className="font-bold capitalize">{h.action}</span><span className="text-xs font-mono text-gray-500">{formatDateTime(h.timestamp)}</span></div>
                  <div className="text-xs text-gray-600">{h.by_name}</div>
                  {h.remarks && <div className="italic text-gray-700">"{h.remarks}"</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {canApprove ? (
            <div className="h-card p-5" data-testid="cal-approval-actions">
              <h3 className="text-base font-bold mb-2">Final Approval</h3>
              <textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="h-input min-h-[80px] mb-3" placeholder="Optional remarks…" data-testid="cal-approval-remarks" />
              <div className="flex gap-2">
                <button onClick={() => act("approve")} disabled={busy} className="h-btn-primary flex-1 flex items-center justify-center gap-1.5" data-testid="cal-approve-btn">
                  <Check size={14} weight="bold" /> Approve
                </button>
                <button onClick={() => act("reject")} disabled={busy} className="h-input w-auto flex-1 px-3 text-sm flex items-center justify-center gap-1.5 border-[#CC0000] text-[#CC0000]" data-testid="cal-reject-btn">
                  <X size={14} weight="bold" /> Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="h-card p-5 bg-gray-50">
              <span className="h-label">Status</span>
              <div className="text-base font-bold mt-1">{r.approval_status}</div>
              {r.approved_by_name && <p className="text-xs font-mono text-gray-500 mt-1">By {r.approved_by_name}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
