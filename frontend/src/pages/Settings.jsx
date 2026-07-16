import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { toast } from "sonner";

export default function Settings() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/settings").then(r => setS(r.data)); }, []);
  if (!s) return <PageHeader title="Loading…" />;

  const save = async () => {
    await api.put("/settings", s);
    toast.success("Settings updated");
  };

  return (
    <>
      <PageHeader title="System Settings" subtitle="Configure HDCMS behavior" breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Settings" }]} />
      <div className="h-card p-6 max-w-2xl space-y-5" data-testid="settings-form">
        <div>
          <label className="h-label block mb-1">Company Name</label>
          <input value={s.company_name || ""} onChange={e => setS({...s, company_name: e.target.value})} className="h-input" data-testid="settings-company" />
        </div>
        <div>
          <label className="h-label block mb-1">Calibration Validity (days)</label>
          <input type="number" value={s.calibration_validity_days || 365} onChange={e => setS({...s, calibration_validity_days: parseInt(e.target.value)})} className="h-input" data-testid="settings-validity" />
          <p className="text-xs text-gray-500 mt-1">Default next-due date offset for new calibrations.</p>
        </div>
        <div className="flex items-center justify-between border border-gray-200 p-3">
          <div>
            <div className="font-bold text-sm">Allow Gauge Deletion</div>
            <p className="text-xs text-gray-500">When enabled, Calibration Head can delete gauges.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={!!s.allow_gauge_delete} onChange={e => setS({...s, allow_gauge_delete: e.target.checked})} className="sr-only peer" data-testid="settings-allow-delete" />
            <div className="w-10 h-6 bg-gray-200 peer-checked:bg-[#CC0000] relative">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white transition-transform ${s.allow_gauge_delete ? "translate-x-4" : ""}`} />
            </div>
          </label>
        </div>
        <div className="flex items-center justify-between border border-gray-200 p-3">
          <div>
            <div className="font-bold text-sm">Notifications Enabled</div>
            <p className="text-xs text-gray-500">In-app notifications for users.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={!!s.notification_enabled} onChange={e => setS({...s, notification_enabled: e.target.checked})} className="sr-only peer" data-testid="settings-notif" />
            <div className="w-10 h-6 bg-gray-200 peer-checked:bg-[#CC0000] relative">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white transition-transform ${s.notification_enabled ? "translate-x-4" : ""}`} />
            </div>
          </label>
        </div>
        <div className="flex justify-end">
          <button onClick={save} className="h-btn-primary" data-testid="settings-save-btn">Save Settings</button>
        </div>
      </div>
    </>
  );
}
