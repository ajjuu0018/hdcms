import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Users, Buildings, Gauge, ClipboardText, Warning, CheckCircle, Clock, FileText, ArrowsLeftRight, ChartBar } from "@phosphor-icons/react";

const CardKPI = ({ label, value, accent, icon: Icon, testid }) => (
  <div className="h-card p-5 relative" data-testid={testid}>
    <div className="flex items-start justify-between">
      <div>
        <div className="h-label">{label}</div>
        <div className="text-3xl font-black tracking-tighter mt-1 dark:text-white">{value ?? "—"}</div>
      </div>
      <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: accent || "#0A0A0A" }}>
        {Icon && <Icon size={20} weight="bold" className="text-white" />}
      </div>
    </div>
    <div className="absolute bottom-0 left-0 h-[3px] w-12" style={{ backgroundColor: accent || "#CC0000" }} />
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const endpoint = {
      admin: "/dashboard/admin",
      user_emp: "/dashboard/user",
      user_head: "/dashboard/dept-head",
      cal_emp: "/dashboard/calibration",
      cal_head: "/dashboard/cal-head",
    }[user.role];
    api.get(endpoint).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [user.role]);

  if (loading) return <PageHeader title="Dashboard" subtitle="Loading…" />;

  return (
    <>
      <PageHeader
        title={`${user.name.split(" ")[0]}'s Workspace`}
        subtitle={`Role: ${user.role} · Department: ${user.department}`}
        breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Dashboard" }]}
      />
      {user.role === "admin" && <AdminView d={data} />}
      {user.role === "user_emp" && <UserView d={data} />}
      {user.role === "user_head" && <HeadView d={data} />}
      {user.role === "cal_emp" && <CalView d={data} />}
      {user.role === "cal_head" && <CalHeadView d={data} />}
    </>
  );
}

const CHART_COLORS = ["#CC0000", "#10B981", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899"];

function AdminView({ d }) {
  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardKPI testid="kpi-total-users" label="Total Users" value={d.total_users} icon={Users} accent="#0A0A0A" />
        <CardKPI testid="kpi-total-departments" label="Departments" value={d.total_departments} icon={Buildings} accent="#0A0A0A" />
        <CardKPI testid="kpi-total-gauges" label="Total Gauges" value={d.total_gauges} icon={Gauge} accent="#CC0000" />
        <CardKPI testid="kpi-total-requests" label="Total Requests" value={d.total_requests} icon={ClipboardText} accent="#3B82F6" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardKPI testid="kpi-pending" label="Pending Requests" value={d.pending_requests} icon={Clock} accent="#F59E0B" />
        <CardKPI testid="kpi-missing" label="Missing Gauges" value={d.missing_gauges} icon={Warning} accent="#CC0000" />
        <CardKPI testid="kpi-completed-cal" label="Completed Calibrations" value={d.completed_calibrations} icon={CheckCircle} accent="#10B981" />
        <CardKPI testid="kpi-active" label="Active System" value="ONLINE" icon={ChartBar} accent="#0A0A0A" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-card p-5 lg:col-span-2" data-testid="chart-monthly">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="h-label">Last 6 Months</span>
              <h3 className="text-lg font-bold mt-1">Requests vs Calibrations</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
              <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
              <Tooltip />
              <Bar dataKey="requests" fill="#CC0000" />
              <Bar dataKey="calibrations" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-card p-5" data-testid="chart-by-dept">
          <span className="h-label">Distribution</span>
          <h3 className="text-lg font-bold mt-1 mb-4">Gauges by Department</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={d.by_department} dataKey="count" nameKey="name" outerRadius={80} label={(e) => e.name}>
                {d.by_department.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <QuickLinks />
    </div>
  );
}

function UserView({ d }) {
  return (
    <div className="space-y-6" data-testid="user-dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardKPI testid="kpi-assigned-gauges" label="Dept Gauges" value={d.assigned_gauges} icon={Gauge} accent="#0A0A0A" />
        <CardKPI testid="kpi-due-cal" label="Due Calibration (30d)" value={d.due_calibration} icon={Clock} accent="#F59E0B" />
        <CardKPI testid="kpi-missing" label="Missing Gauges" value={d.missing_gauges} icon={Warning} accent="#CC0000" />
        <CardKPI testid="kpi-my-requests" label="My Requests" value={d.total_requests} icon={ClipboardText} accent="#3B82F6" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <CardKPI testid="kpi-pending" label="Pending Requests" value={d.pending_requests} icon={Clock} accent="#F59E0B" />
        <Link to="/requests/new" className="h-card p-5 h-card-hover flex items-center justify-between" data-testid="quick-new-request">
          <div>
            <span className="h-label">Quick Action</span>
            <div className="text-xl font-bold mt-1 dark:text-white">Submit a new gauge request</div>
            <div className="text-xs text-gray-500 mt-1">Initiates the 4-stage approval workflow</div>
          </div>
          <div className="w-12 h-12 bg-[#CC0000] flex items-center justify-center">
            <ClipboardText size={22} weight="bold" className="text-white" />
          </div>
        </Link>
      </div>
      <QuickLinks />
    </div>
  );
}

function HeadView({ d }) {
  return (
    <div className="space-y-6" data-testid="dept-head-dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardKPI testid="kpi-pending-approvals" label="Pending Approvals" value={d.pending_approvals} icon={Clock} accent="#F59E0B" />
        <CardKPI testid="kpi-pending-missing" label="Pending Missing" value={d.pending_missing} icon={Warning} accent="#CC0000" />
        <CardKPI testid="kpi-dept-gauges" label="Department Gauges" value={d.department_gauges} icon={Gauge} accent="#0A0A0A" />
        <CardKPI testid="kpi-dept-users" label="Department Users" value={d.department_users} icon={Users} accent="#0A0A0A" />
      </div>
      <Link to="/approvals" className="h-card p-6 h-card-hover block">
        <span className="h-label">Action Required</span>
        <h3 className="text-2xl font-black mt-1 dark:text-white">Review pending approvals →</h3>
        <p className="text-sm text-gray-500 mt-1">{d.pending_approvals + d.pending_missing} item(s) awaiting your decision</p>
      </Link>
    </div>
  );
}

function CalView({ d }) {
  return (
    <div className="space-y-6" data-testid="cal-dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardKPI testid="kpi-pending-cal" label="Pending Calibrations" value={d.pending_calibrations} icon={Clock} accent="#F59E0B" />
        <CardKPI testid="kpi-completed-cal" label="Completed" value={d.completed_calibrations} icon={CheckCircle} accent="#10B981" />
        <CardKPI testid="kpi-received-gauges" label="Received Gauges" value={d.received_gauges} icon={ArrowsLeftRight} accent="#0A0A0A" />
        <CardKPI testid="kpi-pending-receive" label="To Receive" value={d.pending_receive} icon={Warning} accent="#CC0000" />
      </div>
      <CardKPI testid="kpi-pending-req-cal" label="Pending Requests to Process" value={d.pending_requests} icon={ClipboardText} accent="#3B82F6" />
      <QuickLinks />
    </div>
  );
}

function CalHeadView({ d }) {
  return (
    <div className="space-y-6" data-testid="cal-head-dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <CardKPI testid="kpi-final-approvals" label="Pending Final Approvals" value={d.pending_final_approvals} icon={Clock} accent="#F59E0B" />
        <CardKPI testid="kpi-cal-reports-pending" label="Pending Cal Reports" value={d.pending_calibration_reports} icon={FileText} accent="#CC0000" />
        <Link to="/approvals" className="h-card p-5 h-card-hover flex items-center justify-between">
          <div>
            <span className="h-label">Action</span>
            <div className="text-lg font-bold mt-1 dark:text-white">Review queue →</div>
          </div>
          <ChartBar size={24} weight="bold" />
        </Link>
      </div>
      <div className="h-card p-5" data-testid="cal-head-chart">
        <span className="h-label">Last 6 Months</span>
        <h3 className="text-lg font-bold mt-1 mb-4">Approved Calibrations</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={d.monthly_approved}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
            <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
            <Tooltip />
            <Line type="monotone" dataKey="approved" stroke="#CC0000" strokeWidth={2} dot={{ r: 4, fill: "#CC0000" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function QuickLinks() {
  const links = [
    { to: "/gauges", label: "Master Gauge List", icon: Gauge },
    { to: "/requests", label: "Requests", icon: ClipboardText },
    { to: "/calibration", label: "Calibration Reports", icon: FileText },
    { to: "/movement", label: "Gauge Movement", icon: ArrowsLeftRight },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="quick-links">
      {links.map(l => (
        <Link key={l.to} to={l.to} className="h-card p-4 h-card-hover flex items-center gap-3">
          <l.icon size={20} weight="bold" className="text-[#CC0000]" />
          <span className="text-sm font-semibold">{l.label}</span>
        </Link>
      ))}
    </div>
  );
}
