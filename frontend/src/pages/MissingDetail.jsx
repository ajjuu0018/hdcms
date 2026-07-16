import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Check, X } from "@phosphor-icons/react";

const APPROVAL_PERMS = {
  pending_user_head: ["user_head", "admin"],
  pending_cal_dept: ["cal_emp", "cal_head", "admin"],
  pending_cal_head: ["cal_head", "admin"],
};

export default function MissingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [m, setM] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api.get(`/missing-reports/${id}`).then(r => setM(r.data));
  useEffect(() => { load(); }, [id]);
  if (!m) return <PageHeader title="Loading…" />;

  const canAct = APPROVAL_PERMS[m.status]?.includes(user.role);
  const act = async (action) => {
    if (action === "reject" && !remarks.trim()) { toast.error("Remarks required for rejection"); return; }
    setBusy(true);
    try {
      await api.post(`/missing-reports/${m.id}/action`, { action, remarks });
      toast.success(action === "approve" ? "Approved" : "Rejected");
      setRemarks(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader
        title={m.report_no}
        subtitle={`Missing: ${m.gauge_ref} · ${m.gauge_name}`}
        breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Missing", href: "/missing" }, { label: m.report_no }]}
        actions={<StatusBadge status={m.status} />}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-card p-5">
            <h3 className="text-base font-bold mb-4">Report Details</h3>
            <dl className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[["Gauge", `${m.gauge_ref} · ${m.gauge_name}`], ["Reason", m.reason],
                ["Date Missing", formatDate(m.date_missing)], ["Department", m.department],
                ["Reported By", m.reported_by_name], ["Status", m.status],
                ["Remarks", m.remarks]].map(([k, v]) => (
                <div key={k}><dt className="h-label">{k}</dt><dd className="font-mono text-sm dark:text-gray-200">{v || "—"}</dd></div>
              ))}
            </dl>
          </div>
          <div className="h-card p-5">
            <h3 className="text-base font-bold mb-3">History</h3>
            <div className="space-y-2">
              {m.history.map((h, i) => (
                <div key={i} className="border-l-2 border-gray-300 pl-3 py-1 text-sm">
                  <div className="flex justify-between"><span className="font-bold capitalize">{h.action}</span><span className="text-xs font-mono text-gray-500">{formatDateTime(h.timestamp)}</span></div>
                  <div className="text-xs text-gray-600">{h.by_name} ({h.by_role})</div>
                  {h.remarks && <div className="italic text-gray-700">"{h.remarks}"</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div>
          {canAct ? (
            <div className="h-card p-5" data-testid="missing-approval-actions">
              <h3 className="text-base font-bold mb-2">Action</h3>
              <textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="h-input min-h-[80px] mb-3" placeholder="Remarks…" data-testid="missing-approval-remarks" />
              <div className="flex gap-2">
                <button onClick={() => act("approve")} disabled={busy} className="h-btn-primary flex-1 flex items-center justify-center gap-1.5" data-testid="missing-approve-btn"><Check size={14} weight="bold" /> Approve</button>
                <button onClick={() => act("reject")} disabled={busy} className="h-input w-auto flex-1 px-3 text-sm flex items-center justify-center gap-1.5 border-[#CC0000] text-[#CC0000]" data-testid="missing-reject-btn"><X size={14} weight="bold" /> Reject</button>
              </div>
            </div>
          ) : (
            <div className="h-card p-5 bg-gray-50">
              <span className="h-label">Status</span>
              <div className="text-base font-bold mt-1">{m.status}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
