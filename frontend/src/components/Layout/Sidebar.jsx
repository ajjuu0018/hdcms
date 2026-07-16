import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  House, Gauge, FileText, ClipboardText, Bell, Users,
  Buildings, ClockCounterClockwise, Warning, ArrowsLeftRight,
  ChartBar, GearSix, SignOut, ShieldCheck, Stack, ListChecks,
} from "@phosphor-icons/react";

const MENU = {
  admin: [
    { to: "/", label: "Dashboard", icon: House },
    { to: "/gauges", label: "Master Gauges", icon: Gauge },
    { to: "/requests", label: "All Requests", icon: ClipboardText },
    { to: "/calibration", label: "Calibration Reports", icon: FileText },
    { to: "/missing", label: "Missing Gauges", icon: Warning },
    { to: "/movement", label: "Gauge Movement", icon: ArrowsLeftRight },
    { to: "/users", label: "Users", icon: Users },
    { to: "/departments", label: "Departments", icon: Buildings },
    { to: "/audit", label: "Audit Logs", icon: ClockCounterClockwise },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/settings", label: "Settings", icon: GearSix },
  ],
  user_emp: [
    { to: "/", label: "Dashboard", icon: House },
    { to: "/gauges", label: "Master Gauges", icon: Gauge },
    { to: "/requests/new", label: "New Request", icon: ClipboardText },
    { to: "/requests?mine=true", label: "My Requests", icon: ListChecks },
    { to: "/missing", label: "Missing Gauges", icon: Warning },
    { to: "/movement", label: "Gauge Movement", icon: ArrowsLeftRight },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  user_head: [
    { to: "/", label: "Dashboard", icon: House },
    { to: "/gauges", label: "Master Gauges", icon: Gauge },
    { to: "/approvals", label: "Pending Approvals", icon: ShieldCheck },
    { to: "/requests", label: "Dept Requests", icon: ClipboardText },
    { to: "/missing", label: "Missing Reports", icon: Warning },
    { to: "/movement", label: "Gauge Movement", icon: ArrowsLeftRight },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  cal_emp: [
    { to: "/", label: "Dashboard", icon: House },
    { to: "/gauges", label: "Master Gauges", icon: Gauge },
    { to: "/approvals", label: "Pending Approvals", icon: ShieldCheck },
    { to: "/calibration", label: "Calibration Reports", icon: FileText },
    { to: "/calibration/new", label: "New Calibration", icon: Stack },
    { to: "/movement", label: "Gauge Movement", icon: ArrowsLeftRight },
    { to: "/missing", label: "Missing Reports", icon: Warning },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  cal_head: [
    { to: "/", label: "Dashboard", icon: House },
    { to: "/gauges", label: "Master Gauges", icon: Gauge },
    { to: "/approvals", label: "Pending Final Approvals", icon: ShieldCheck },
    { to: "/calibration", label: "Calibration Reports", icon: FileText },
    { to: "/missing", label: "Missing Reports", icon: Warning },
    { to: "/movement", label: "Gauge Movement", icon: ArrowsLeftRight },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/analytics", label: "Analytics", icon: ChartBar },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const items = MENU[user?.role] || [];

  return (
    <aside className="bg-[#0A0A0A] text-gray-300 w-64 min-h-screen flex flex-col border-r border-gray-900" data-testid="sidebar">
      <div className="px-5 py-5 border-b border-gray-900">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#CC0000] flex items-center justify-center" data-testid="brand-logo">
            <span className="font-black text-white text-base tracking-tighter">H</span>
          </div>
          <div>
            <div className="font-black text-white text-base leading-tight">HDCMS</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Honda · Calibration</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-5 mb-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Workspace</div>
        </div>
        {items.map((item) => {
          const Icon = item.icon;
          const path = item.to.split("?")[0];
          const active = location.pathname === path ||
                        (path !== "/" && location.pathname.startsWith(path));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm font-medium border-l-4 transition-colors ${
                  active || isActive
                    ? "bg-gray-900 text-white border-[#CC0000]"
                    : "border-transparent hover:bg-gray-900 hover:text-white text-gray-400"
                }`
              }
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-gray-900 p-4">
        <div className="mb-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Signed in as</div>
          <div className="text-sm font-semibold text-white truncate" data-testid="sidebar-user-name">{user?.name}</div>
          <div className="text-xs font-mono text-gray-500">{user?.employee_id} · {user?.role}</div>
        </div>
        <button
          onClick={logout}
          data-testid="logout-btn"
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:bg-gray-900 hover:text-white border border-gray-800 transition-colors"
        >
          <SignOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
