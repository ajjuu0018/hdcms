import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { formatDateTime } from "@/lib/format";
import { Check, Circle, CheckCircle } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/notifications").then(r => setItems(r.data));
  useEffect(load, []);

  const markRead = async (id) => { await api.post(`/notifications/${id}/read`); load(); };
  const markAll = async () => { await api.post("/notifications/read-all"); toast.success("All marked as read"); load(); };

  return (
    <>
      <PageHeader title="Notifications" subtitle={`${items.length} notification(s)`} breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Notifications" }]} actions={
        <button onClick={markAll} className="h-input w-auto text-sm" data-testid="mark-all-read-btn">Mark all as read</button>
      } />
      <div className="space-y-2" data-testid="notifications-list">
        {items.length === 0 && <div className="h-card p-8 text-center text-gray-400">No notifications</div>}
        {items.map(n => (
          <div key={n.id} className={`h-card p-4 flex items-start gap-3 ${!n.read ? "border-l-4 border-l-[#CC0000]" : ""}`} data-testid={`notif-${n.id}`}>
            <div className="mt-1">
              {n.read ? <CheckCircle size={16} className="text-gray-400" /> : <Circle size={16} weight="fill" className="text-[#CC0000]" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm">{n.title}</h4>
                <span className="text-xs font-mono text-gray-500">{formatDateTime(n.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{n.message}</p>
              <div className="flex gap-3 mt-2">
                {n.link && <Link to={n.link} className="text-xs text-[#CC0000] hover:underline">View →</Link>}
                {!n.read && <button onClick={() => markRead(n.id)} className="text-xs text-gray-500 hover:text-gray-900">Mark as read</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
