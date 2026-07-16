import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gaugeColorFor, gaugeColorName, formatDate, formatDateTime } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { Warning, ArrowsLeftRight, Lock, LockOpen, FileText } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function GaugeDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMissing, setShowMissing] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/gauges/${id}`).then(r => setD(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  if (loading || !d) return <PageHeader title="Loading…" />;
  const g = d.gauge;

  const sendToCal = async () => {
    await api.post("/movement", { gauge_id: g.id, action: "send_to_calibration", remarks: "Sent for calibration" });
    toast.success("Sent to Calibration Department");
    load();
  };
  const returnToUser = async () => {
    await api.post("/movement", { gauge_id: g.id, action: "return_to_user", remarks: "Returned to user dept" });
    toast.success("Returned to user");
    load();
  };
  const lock = async () => { await api.post(`/gauges/${g.id}/lock`); toast.success("Gauge locked"); load(); };
  const unlock = async () => { await api.post(`/gauges/${g.id}/unlock`); toast.success("Gauge unlocked"); load(); };

  const canMove = true; // any role can move/return for tracking
  const canLock = ["cal_emp", "cal_head", "admin"].includes(user.role);
  const canUnlock = ["cal_head", "admin"].includes(user.role);

  return (
    <>
      <PageHeader
        title={g.name}
        subtitle={
          <span className="flex items-center gap-2">
            <span className="font-mono">{g.gauge_id}</span> ·
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2" style={{ backgroundColor: gaugeColorFor(g.current_holder) }} />
              {gaugeColorName(g.current_holder)} · {g.current_holder_dept}
            </span>
          </span>
        }
        breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Master Gauges", href: "/gauges" }, { label: g.gauge_id }]}
        actions={
          <>
            {canMove && g.current_holder === "user" && (
              <button onClick={sendToCal} className="h-input w-auto text-sm flex items-center gap-1.5" data-testid="send-to-cal-btn">
                <ArrowsLeftRight size={14} /> Send to Calibration
              </button>
            )}
            {canMove && g.current_holder === "calibration" && (
              <button onClick={returnToUser} className="h-input w-auto text-sm flex items-center gap-1.5" data-testid="return-to-user-btn">
                <ArrowsLeftRight size={14} /> Return to User Dept
              </button>
            )}
            <button onClick={() => setShowMissing(true)} className="h-input w-auto text-sm flex items-center gap-1.5 border-[#CC0000] text-[#CC0000]" data-testid="report-missing-btn">
              <Warning size={14} weight="bold" /> Report Missing
            </button>
            {canLock && !g.locked && (
              <button onClick={lock} className="h-input w-auto text-sm flex items-center gap-1.5" data-testid="lock-gauge-btn">
                <Lock size={14} /> Lock
              </button>
            )}
            {canUnlock && g.locked && (
              <button onClick={unlock} className="h-input w-auto text-sm flex items-center gap-1.5" data-testid="unlock-gauge-btn">
                <LockOpen size={14} /> Unlock
              </button>
            )}
          </>
        }
      />

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="bg-transparent border-b border-gray-200 dark:border-gray-800 w-full justify-start rounded-none p-0 h-auto" data-testid="gauge-tabs">
          <TabsTrigger value="info" data-testid="tab-info" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#CC0000] data-[state=active]:bg-transparent data-[state=active]:text-[#CC0000] data-[state=active]:shadow-none px-4">Info</TabsTrigger>
          <TabsTrigger value="cal" data-testid="tab-calibration" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#CC0000] data-[state=active]:bg-transparent data-[state=active]:text-[#CC0000] data-[state=active]:shadow-none px-4">Calibration History ({d.calibration_reports.length})</TabsTrigger>
          <TabsTrigger value="movement" data-testid="tab-movement" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#CC0000] data-[state=active]:bg-transparent data-[state=active]:text-[#CC0000] data-[state=active]:shadow-none px-4">Movement ({d.movement_logs.length})</TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#CC0000] data-[state=active]:bg-transparent data-[state=active]:text-[#CC0000] data-[state=active]:shadow-none px-4">Requests ({d.requests.length})</TabsTrigger>
          <TabsTrigger value="missing" data-testid="tab-missing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#CC0000] data-[state=active]:bg-transparent data-[state=active]:text-[#CC0000] data-[state=active]:shadow-none px-4">Missing ({d.missing_reports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="h-card p-5 lg:col-span-2">
              <h3 className="text-lg font-bold mb-4">Basic Information</h3>
              <dl className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                {[
                  ["Gauge ID", g.gauge_id], ["Name", g.name],
                  ["Type", g.type], ["Department", g.department],
                  ["Machine", g.machine], ["Machine Number", g.machine_number],
                  ["Location", g.location], ["Manufacturer", g.manufacturer],
                  ["Model", g.model], ["Range", g.range],
                  ["Least Count", g.least_count], ["Status", <StatusBadge status={g.status} key="s" />],
                  ["Last Calibration", formatDate(g.last_calibration_date)], ["Next Due", formatDate(g.next_calibration_date)],
                  ["Current Holder", `${g.current_holder} · ${g.current_holder_dept}`], ["Locked", g.locked ? "Yes" : "No"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="h-label">{k}</dt>
                    <dd className="font-mono text-sm dark:text-gray-200">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="h-card p-5">
              <h3 className="text-lg font-bold mb-4">Current Status</h3>
              <div className="space-y-3">
                <div className="border border-gray-200 dark:border-gray-800 p-3">
                  <div className="h-label">Color Tag (Floor)</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6" style={{ backgroundColor: gaugeColorFor(g.current_holder) }} />
                    <span className="font-bold">{gaugeColorName(g.current_holder)}</span>
                    <span className="text-xs text-gray-500 font-mono">({new Date().toLocaleString("en-IN", { month: "long" })} convention)</span>
                  </div>
                </div>
                {g.calibration_overdue && (
                  <div className="border border-[#CC0000] bg-red-50 dark:bg-red-950/40 p-3">
                    <div className="h-label text-red-600">Alert</div>
                    <div className="text-sm font-bold text-red-700 dark:text-red-300 mt-1">Calibration overdue</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cal" className="mt-4">
          <div className="h-card overflow-x-auto">
            <table className="h-table">
              <thead>
                <tr><th>Report No</th><th>Calibration Date</th><th>Next Due</th><th>Result</th><th>Status</th><th>By</th></tr>
              </thead>
              <tbody>
                {d.calibration_reports.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No calibration reports yet</td></tr>}
                {d.calibration_reports.map(r => (
                  <tr key={r.id}>
                    <td><Link to={`/calibration/${r.id}`} className="text-[#CC0000] hover:underline">{r.report_no}</Link></td>
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
        </TabsContent>

        <TabsContent value="movement" className="mt-4">
          <div className="h-card overflow-x-auto">
            <table className="h-table">
              <thead><tr><th>Date</th><th>Action</th><th>From</th><th>To</th><th>Received</th><th>By</th><th>Remarks</th></tr></thead>
              <tbody>
                {d.movement_logs.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No movement logs</td></tr>}
                {d.movement_logs.map(m => (
                  <tr key={m.id}>
                    <td>{formatDateTime(m.date)}</td>
                    <td>{m.action.replace(/_/g, " ")}</td>
                    <td>{m.from_dept}</td>
                    <td>{m.to_dept}</td>
                    <td>{m.received ? formatDateTime(m.received_date) : <StatusBadge status="pending_cal_dept" label="PENDING" />}</td>
                    <td>{m.by_name}</td>
                    <td className="text-gray-500">{m.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <div className="h-card overflow-x-auto">
            <table className="h-table">
              <thead><tr><th>Request No</th><th>Type</th><th>By</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {d.requests.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No related requests</td></tr>}
                {d.requests.map(r => (
                  <tr key={r.id}>
                    <td><Link to={`/requests/${r.id}`} className="text-[#CC0000] hover:underline">{r.request_no}</Link></td>
                    <td>{r.type}</td>
                    <td>{r.requested_by_name}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="missing" className="mt-4">
          <div className="h-card overflow-x-auto">
            <table className="h-table">
              <thead><tr><th>Report</th><th>Reason</th><th>Date Missing</th><th>Status</th><th>Reported by</th></tr></thead>
              <tbody>
                {d.missing_reports.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No missing reports</td></tr>}
                {d.missing_reports.map(m => (
                  <tr key={m.id}>
                    <td>{m.report_no}</td>
                    <td>{m.reason}</td>
                    <td>{formatDate(m.date_missing)}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td>{m.reported_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {showMissing && <ReportMissingModal gauge={g} onClose={() => setShowMissing(false)} onDone={() => { setShowMissing(false); load(); }} />}
    </>
  );
}

function ReportMissingModal({ gauge, onClose, onDone }) {
  const [form, setForm] = useState({ reason: "", date_missing: new Date().toISOString().slice(0, 10), remarks: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/missing-reports", { gauge_id: gauge.id, ...form });
      toast.success("Missing gauge report submitted");
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose} data-testid="report-missing-modal">
      <div className="bg-white border border-gray-200 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-black tracking-tighter">Report Missing Gauge</h3>
        <p className="text-xs text-gray-500 font-mono mt-1">{gauge.gauge_id} · {gauge.name}</p>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="h-label block mb-1">Reason</label>
            <input required value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="h-input" data-testid="missing-reason-input" />
          </div>
          <div>
            <label className="h-label block mb-1">Date Missing</label>
            <input required type="date" value={form.date_missing} onChange={e => setForm({...form, date_missing: e.target.value})} className="h-input" data-testid="missing-date-input" />
          </div>
          <div>
            <label className="h-label block mb-1">Remarks</label>
            <textarea value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} className="h-input min-h-[80px]" data-testid="missing-remarks-input" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-input w-auto px-4 text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="h-btn-primary" data-testid="missing-submit-btn">{busy ? "Submitting…" : "Submit Report"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
