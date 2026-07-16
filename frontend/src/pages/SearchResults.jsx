import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { formatDate } from "@/lib/format";

export default function SearchResults() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [data, setData] = useState(null);
  useEffect(() => {
    if (q) api.get("/search", { params: { q } }).then(r => setData(r.data));
  }, [q]);
  if (!data) return <PageHeader title={`Search: ${q}`} subtitle="Loading…" />;

  const sections = [
    { key: "gauges", label: "Gauges", items: data.gauges, render: g => ({ title: g.name, subtitle: g.gauge_id + " · " + g.department, link: `/gauges/${g.id}` }) },
    { key: "requests", label: "Requests", items: data.requests, render: r => ({ title: r.request_no, subtitle: r.gauge_name + " · " + r.status, link: `/requests/${r.id}` }) },
    { key: "calibration", label: "Calibration Reports", items: data.calibration, render: r => ({ title: r.report_no, subtitle: r.gauge_name, link: `/calibration/${r.id}` }) },
    { key: "missing", label: "Missing Reports", items: data.missing, render: r => ({ title: r.report_no, subtitle: r.gauge_name + " · " + r.status, link: `/missing/${r.id}` }) },
    { key: "users", label: "Users", items: data.users, render: u => ({ title: u.name, subtitle: u.employee_id + " · " + u.role, link: "/users" }) },
    { key: "departments", label: "Departments", items: data.departments, render: d => ({ title: d.name, subtitle: d.code, link: "/departments" }) },
  ];

  return (
    <>
      <PageHeader title={`Search results for "${q}"`} breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Search" }]} />
      <div className="space-y-4" data-testid="search-results">
        {sections.map(s => s.items.length > 0 && (
          <div key={s.key} className="h-card">
            <div className="px-5 py-3 border-b border-gray-200"><h3 className="text-base font-bold">{s.label} ({s.items.length})</h3></div>
            <ul>
              {s.items.map((it, i) => {
                const r = s.render(it);
                return (
                  <li key={i} className="px-5 py-3 border-b border-gray-100 hover:bg-gray-50">
                    <Link to={r.link} className="block">
                      <div className="font-bold text-sm text-[#CC0000]">{r.title}</div>
                      <div className="text-xs font-mono text-gray-500">{r.subtitle}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {sections.every(s => s.items.length === 0) && <div className="h-card p-8 text-center text-gray-400">No results found</div>}
      </div>
    </>
  );
}
