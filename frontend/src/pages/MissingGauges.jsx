import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/format";

export default function MissingGauges() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/missing-reports").then(r => setItems(r.data)); }, []);
  return (
    <>
      <PageHeader title="Missing Gauge Reports" subtitle={`${items.length} report(s)`} breadcrumbs={[{ label: "HDCMS", href: "/" }, { label: "Missing" }]} />
      <div className="h-card overflow-x-auto" data-testid="missing-table">
        <table className="h-table">
          <thead><tr><th>Report</th><th>Gauge</th><th>Reason</th><th>Department</th><th>Reported By</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No missing reports</td></tr>}
            {items.map(m => (
              <tr key={m.id} data-testid={`missing-row-${m.report_no}`}>
                <td><Link to={`/missing/${m.id}`} className="text-[#CC0000] hover:underline font-bold">{m.report_no}</Link></td>
                <td>{m.gauge_ref} · {m.gauge_name}</td>
                <td>{m.reason}</td>
                <td>{m.department}</td>
                <td>{m.reported_by_name}</td>
                <td><StatusBadge status={m.status} /></td>
                <td>{formatDate(m.date_missing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
