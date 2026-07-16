import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Check, X, CaretRight } from "@phosphor-icons/react";

const APPROVAL_PERMS = {
  pending_user_head: ["user_head", "admin"],
  pending_cal_dept: ["cal_emp", "cal_head", "admin"],
  pending_cal_head: ["cal_head", "admin"],
};

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/requests/${id}`).then(res => setR(res.data)).finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  if (loading || !r) return <PageHeader title="Loading…" />;
  const canAct = APPROVAL_PERMS[r.status]?.includes(user.role);

  const act = async (action) => {
    if (action === "reject" && !remarks.trim()) {
      toast.error("Rejection requires remarks");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/requests/${r.id}/action`, { action, remarks });
      toast.success(action === "approve" ? "Approved" : "Rejected");
      setRemarks("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  const stages = [
    { key: "submitted", label: "Submitted" },
    { key: "pending_user_head", label: "Dept Head" },
    { key: "pending_cal_dept", label: "Calibration" },
    { key: "pending_cal_head", label: "Final Approval" },
    { key: "approved", label: "Approved" },
  ];

  const stageOrder = (s) => {
    if (s === "rejected") return -1;
    if (s === "pending_user_head") return 1;
    if (s === "pending_cal_dept") return 2;
    if (s === "pending_cal_head") return 3;
    if (s === "approved") return 4;
    return 0;
  };
  const currentStage = stageOrder(r.status);

  return (
    <>
      <PageHeader
        title={r.request_no}
        subtitle={`${r.gauge_name} · ${r.department} · by ${r.requested_by_name}`}
        breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Requests", href: "/requests" }, { label: r.request_no }]}
        actions={<StatusBadge status={r.status} />}
      />

      {/* Workflow timeline */}
      <div className="h-card p-5 mb-4" data-testid="workflow-timeline">
        <span className="h-label">Approval Workflow</span>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto">
          {stages.map((s, i) => {
            const active = i <= currentStage && r.status !== "rejected";
            const rejected = r.status === "rejected" && i === 0;
            return (
              <React.Fragment key={s.key}>
                <div className={`flex-shrink-0 min-w-[120px] border p-3 ${active ? "border-[#CC0000] bg-red-50" : rejected ? "border-[#CC0000] bg-red-50" : "border-gray-200"}`}>
                  <div className="h-label">{i === 0 ? "Start" : `Stage ${i}`}</div>
                  <div className="text-sm font-bold mt-1">{s.label}</div>
                </div>
                {i < stages.length - 1 && <CaretRight size={14} className="text-gray-400 flex-shrink-0" />}
              </React.Fragment>
            );
          })}
          {r.status === "rejected" && (
            <div className="ml-auto border border-[#CC0000] bg-red-50 p-3">
              <div className="h-label text-red-600">Final</div>
              <div className="text-sm font-bold text-red-600">REJECTED</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-card p-5">
            <h3 className="text-lg font-bold mb-4">Gauge Details</h3>
            <dl className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[["Name", r.gauge_name], ["Type", r.gauge_type], ["Manufacturer", r.manufacturer], ["Model", r.model],
                ["Range", r.range], ["Least Count", r.least_count], ["Department", r.department], ["Machine", r.machine],
                ["Location", r.location], ["Quantity", r.quantity], ["Purpose", r.purpose], ["Reason", r.reason]].map(([k, v]) => (
                <div key={k}>
                  <dt className="h-label">{k}</dt>
                  <dd className="font-mono text-sm dark:text-gray-200">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {r.linked_gauge_id && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="h-label">Linked Gauge</span>
                <div><Link to={`/gauges/${r.linked_gauge_id}`} className="text-[#CC0000] hover:underline font-semibold">View created gauge →</Link></div>
              </div>
            )}
          </div>

          <div className="h-card p-5">
            <h3 className="text-lg font-bold mb-4">Approval History</h3>
            <div className="space-y-3">
              {r.history.map((h, idx) => (
                <div key={idx} className="border-l-2 border-gray-300 pl-3 py-1 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-bold capitalize">{h.action}</div>
                    <div className="text-xs font-mono text-gray-500">{formatDateTime(h.timestamp)}</div>
                  </div>
                  <div className="text-xs text-gray-600">{h.by_name} ({h.by_role})</div>
                  {h.remarks && <div className="text-sm text-gray-700 mt-1 italic">"{h.remarks}"</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {canAct ? (
            <div className="h-card p-5" data-testid="approval-actions">
              <h3 className="text-lg font-bold mb-3">Action Required</h3>
              <p className="text-sm text-gray-500 mb-3">Approve or reject this request. Remarks required for rejection.</p>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Remarks…"
                className="h-input min-h-[80px] mb-3"
                data-testid="approval-remarks"
              />
              <div className="flex gap-2">
                <button onClick={() => act("approve")} disabled={busy} className="h-btn-primary flex-1 flex items-center justify-center gap-1.5" data-testid="approve-btn">
                  <Check size={14} weight="bold" /> Approve
                </button>
                <button onClick={() => act("reject")} disabled={busy} className="h-input w-auto flex-1 px-3 text-sm flex items-center justify-center gap-1.5 border-[#CC0000] text-[#CC0000]" data-testid="reject-btn">
                  <X size={14} weight="bold" /> Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="h-card p-5 bg-gray-50 dark:bg-gray-900">
              <span className="h-label">Status</span>
              <h3 className="text-base font-bold mt-1">Awaiting action by {APPROVAL_PERMS[r.status]?.join(" or ") || "system"}</h3>
              <p className="text-xs text-gray-500 mt-1">You do not have permission to act at this stage.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
