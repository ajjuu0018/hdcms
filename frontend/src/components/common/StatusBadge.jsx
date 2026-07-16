import React from "react";
import { statusBadgeColor, STATUS_LABELS } from "@/lib/format";

export default function StatusBadge({ status, label }) {
  const c = statusBadgeColor(status);
  const text = label || STATUS_LABELS[status] || status || "—";
  return (
    <span
      className="h-status-badge"
      data-testid={`status-badge-${status}`}
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      {text}
    </span>
  );
}
