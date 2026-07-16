import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { gaugeColorFor, gaugeColorName, formatDate } from "@/lib/format";
import { Funnel, DownloadSimple, Plus, Printer } from "@phosphor-icons/react";
import { API_BASE } from "@/lib/api";

export default function GaugeList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gauges, setGauges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [types, setTypes] = useState([]);
  const [filters, setFilters] = useState({ q: "", department: "", gauge_type: "", status: "", due_in_days: "" });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    api.get("/departments").then(r => setDepartments(r.data));
    api.get("/gauges/types").then(r => setTypes(r.data));
  }, []);

  useEffect(() => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    setLoading(true);
    api.get("/gauges", { params }).then(r => setGauges(r.data)).finally(() => setLoading(false));
  }, [filters]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return gauges.slice(start, start + PAGE_SIZE);
  }, [gauges, page]);

  const totalPages = Math.max(1, Math.ceil(gauges.length / PAGE_SIZE));

  const canCreate = ["cal_emp", "cal_head", "admin"].includes(user?.role);

  const exportXlsx = async () => {
    const token = localStorage.getItem("hdcms_token");
    const res = await fetch(`${API_BASE}/exports/gauges.xlsx`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "master_gauge_list.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Master Gauge List"
        subtitle={`${gauges.length} gauges · visible to all departments`}
        breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Master Gauges" }]}
        actions={
          <>
            <button onClick={() => window.print()} className="h-input w-auto text-sm flex items-center gap-1.5" data-testid="print-btn">
              <Printer size={14} /> Print
            </button>
            <button onClick={exportXlsx} className="h-input w-auto text-sm flex items-center gap-1.5" data-testid="export-xlsx-btn">
              <DownloadSimple size={14} /> Excel
            </button>
            {canCreate && (
              <Link to="/gauges/new" data-testid="add-gauge-btn" className="h-btn-primary flex items-center gap-1.5">
                <Plus size={14} weight="bold" /> Add Gauge
              </Link>
            )}
          </>
        }
      />

      <div className="h-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Funnel size={14} /> <span className="h-label">Filters</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <input data-testid="filter-q" placeholder="Search Name / ID / Manufacturer" value={filters.q} onChange={e => setFilters({...filters, q: e.target.value})} className="h-input" />
          <select data-testid="filter-department" value={filters.department} onChange={e => setFilters({...filters, department: e.target.value})} className="h-input">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <select data-testid="filter-type" value={filters.gauge_type} onChange={e => setFilters({...filters, gauge_type: e.target.value})} className="h-input">
            <option value="">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select data-testid="filter-status" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="h-input">
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Missing">Missing</option>
            <option value="Missing-Confirmed">Missing-Confirmed</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select data-testid="filter-due" value={filters.due_in_days} onChange={e => setFilters({...filters, due_in_days: e.target.value})} className="h-input">
            <option value="">Any Due Date</option>
            <option value="0">Overdue</option>
            <option value="30">Due in 30 days</option>
            <option value="60">Due in 60 days</option>
            <option value="90">Due in 90 days</option>
          </select>
        </div>
      </div>

      <div className="h-card overflow-hidden" data-testid="gauges-table">
        <div className="overflow-x-auto">
          <table className="h-table">
            <thead>
              <tr>
                <th>Gauge ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Department</th>
                <th>Machine</th>
                <th>Location</th>
                <th>Status</th>
                <th>Holder</th>
                <th>Next Due</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-8 text-gray-400">Loading…</td></tr>}
              {!loading && paginated.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-gray-400">No gauges found</td></tr>}
              {paginated.map(g => (
                <tr key={g.id} data-testid={`gauge-row-${g.gauge_id}`} className="cursor-pointer" onClick={(e) => {
                  if (e.target.tagName === "A" || e.target.closest("a")) return;
                  navigate(`/gauges/${g.id}`);
                }}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2" style={{ backgroundColor: g.color_hex || gaugeColorFor(g.current_holder) }} title={g.color_name || gaugeColorName(g.current_holder)} />
                      <span className="font-bold">{g.gauge_id}</span>
                    </div>
                  </td>
                  <td>
                    <Link to={`/gauges/${g.id}`} className="text-[#CC0000] hover:underline font-semibold" data-testid={`gauge-link-${g.gauge_id}`}>
                      {g.name}
                    </Link>
                  </td>
                  <td>{g.type}</td>
                  <td>{g.department}</td>
                  <td>{g.machine || "—"}</td>
                  <td>{g.location || "—"}</td>
                  <td><StatusBadge status={g.status} /></td>
                  <td className="capitalize">{g.current_holder} · {g.current_holder_dept}</td>
                  <td className={g.calibration_overdue ? "text-red-600 font-bold" : ""}>{formatDate(g.next_calibration_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200" data-testid="pagination">
            <div className="text-xs font-mono text-gray-500">Page {page} of {totalPages} · {gauges.length} records</div>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-input w-auto px-3 text-sm" data-testid="prev-page">Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="h-input w-auto px-3 text-sm" data-testid="next-page">Next</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
