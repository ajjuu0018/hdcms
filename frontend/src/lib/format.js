// Gauge color logic based on current month per Honda spec
// Jan-Jun: User Dept = Yellow, Calibration = Green
// Jul-Dec: User Dept = Green,  Calibration = Yellow

export function gaugeColorFor(holderType, month = null) {
  const m = month ?? (new Date().getMonth() + 1);
  const firstHalf = m >= 1 && m <= 6;
  if (holderType === "user") return firstHalf ? "#FBBF24" : "#10B981";
  return firstHalf ? "#10B981" : "#FBBF24";
}

export function gaugeColorName(holderType, month = null) {
  const m = month ?? (new Date().getMonth() + 1);
  const firstHalf = m >= 1 && m <= 6;
  if (holderType === "user") return firstHalf ? "Yellow" : "Green";
  return firstHalf ? "Green" : "Yellow";
}

export const ROLE_LABELS = {
  admin: "Administrator",
  user_emp: "Dept Employee",
  user_head: "Dept Head",
  cal_emp: "Calibration Employee",
  cal_head: "Calibration Head",
};

export const STATUS_LABELS = {
  pending_user_head: "Pending Dept Head",
  pending_cal_dept: "Pending Calibration",
  pending_cal_head: "Pending Final Approval",
  approved: "Approved",
  rejected: "Rejected",
  draft: "Draft",
  submitted: "Submitted",
  pending: "Pending",
  closed: "Closed",
};

export function statusBadgeColor(status) {
  if (["approved", "PASS", "OK"].includes(status))
    return { bg: "#D1FAE5", text: "#065F46", border: "#10B981" };
  if (["rejected", "FAIL", "NG"].includes(status))
    return { bg: "#FEE2E2", text: "#991B1B", border: "#CC0000" };
  if (status?.startsWith("pending"))
    return { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" };
  if (["closed", "Active", "draft"].includes(status))
    return { bg: "#DBEAFE", text: "#1E40AF", border: "#3B82F6" };
  if (status?.startsWith("Missing"))
    return { bg: "#FEE2E2", text: "#991B1B", border: "#CC0000" };
  return { bg: "#F3F4F6", text: "#374151", border: "#9CA3AF" };
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
