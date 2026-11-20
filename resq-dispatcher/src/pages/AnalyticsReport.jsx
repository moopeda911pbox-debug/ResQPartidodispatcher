import React, { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import IncidentTypesChart from "../components/charts/IncidentTypesChart";
import ReportsOverviewChart from "../components/charts/ReportsOverviewChart";
import StatusPieChart from "../components/charts/StatusPieChart";
import ExportMenu from "../components/ExportMenu";
import DispatcherResponsePanel from "../components/analytics/DispatcherResponsePanel";
import { summarize, dailyTrend } from "../services/incidents";
import { useCallLogs } from "../lib/useCallLogs";
import { trackingColumnsPresent } from "../lib/responseMetrics";
import { exportAnalyticsToPDF, exportAnalyticsToExcel } from "../lib/exportReports";
import { incidentAccessors, describeFilters, filenameSuffix, trendForSelection } from "../lib/exportFilters";
import { formatPlace, incidentPlace } from "../lib/format";

const SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "response", label: "Dispatcher Response Times" },
];

const RANGES = [
  { key: 7, label: "7 days" },
  { key: 14, label: "14 days" },
  { key: 30, label: "30 days" },
];

// Reports per municipality = where the emergency happened (jurisdiction), case-insensitive.
function countByMunicipality(list) {
  const byMunicipality = {};
  for (const inc of list) {
    const m = incidentPlace(inc) || "Unspecified";
    byMunicipality[m] = (byMunicipality[m] ?? 0) + 1;
  }
  return Object.entries(byMunicipality)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export default function AnalyticsReport() {
  const { incidents, loading } = useOutletContext();
  const [range, setRange] = useState(14);
  const [section, setSection] = useState("overview");

  // Used by the Dispatcher Response Times tab for calls-per-dispatcher.
  const { callLogs } = useCallLogs();

  const { counts, incidentTypeData } = useMemo(() => summarize(incidents), [incidents]);
  const trend = useMemo(() => dailyTrend(incidents, range), [incidents, range]);

  const municipalityData = useMemo(() => countByMunicipality(incidents), [incidents]);

  if (loading) return <p className="empty-state">Loading live reports…</p>;

  const resolutionRate = counts.total ? Math.round((counts.resolved / counts.total) * 100) : 0;
  const rangeLabel = RANGES.find((r) => r.key === range)?.label;

  // Everything in the file (totals, incident types, municipalities, trend) is
  // recalculated from the reports that match the year / month / municipality
  // picked in the export dialog. With no filter it matches the screen.
  function buildExport(items, sel) {
    const summary = summarize(items);
    const t = trendForSelection(items, sel, () => dailyTrend(items, range));
    return {
      data: {
        counts: summary.counts,
        incidentTypeData: summary.incidentTypeData,
        trend: t.rows,
        municipalityData: countByMunicipality(items),
      },
      granularity: t.granularity,
      filterLabel: describeFilters(sel),
      name(ext) {
        const suffix = filenameSuffix(sel);
        const scope = suffix || `${range}d`;
        return `resqpartido-analytics-${scope}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      },
    };
  }

  function handleExportPdf(items, sel) {
    const b = buildExport(items, sel);
    exportAnalyticsToPDF(b.data, { rangeLabel, filterLabel: b.filterLabel, granularity: b.granularity, filename: b.name("pdf") });
  }

  function handleExportExcel(items, sel) {
    const b = buildExport(items, sel);
    exportAnalyticsToExcel(b.data, { filterLabel: b.filterLabel, granularity: b.granularity, filename: b.name("xlsx") });
  }

  const sectionTabs = (
    <div className="chip-row" style={{ marginBottom: 18 }}>
      {SECTIONS.map((s) => (
        <button key={s.key} className={`chip${section === s.key ? " active" : ""}`} onClick={() => setSection(s.key)}>
          {s.label}
        </button>
      ))}
    </div>
  );

  if (section === "response") {
    return (
      <>
        {sectionTabs}
        <DispatcherResponsePanel
          incidents={incidents}
          callLogs={callLogs}
          trackingReady={trackingColumnsPresent(incidents)}
        />
      </>
    );
  }

  return (
    <>
      {sectionTabs}
      <div className="panel">
        <div className="panel-header">
          <h2>Reports Over Time</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="chip-row">
              {RANGES.map((r) => (
                <button key={r.key} className={`chip${range === r.key ? " active" : ""}`} onClick={() => setRange(r.key)}>
                  {r.label}
                </button>
              ))}
            </div>
            <ExportMenu
              onExportPdf={handleExportPdf}
              onExportExcel={handleExportExcel}
              filter={{
                items: incidents,
                accessors: incidentAccessors,
                noun: "reports",
                hint: "Totals, incident types, municipalities and the trend are recalculated for what you pick.",
              }}
            />
          </div>
        </div>
        <ReportsOverviewChart data={trend} />
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-header">
            <h2>Incident Types</h2>
            <span className="sub">{counts.total} total reports</span>
          </div>
          <IncidentTypesChart data={incidentTypeData} />
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Status Breakdown</h2>
            <span className="sub">{resolutionRate}% responded overall</span>
          </div>
          <StatusPieChart counts={counts} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Reports by Municipality</h2>
          <span className="sub">Based on reporter's registered municipality</span>
        </div>
        <IncidentTypesChart data={municipalityData} />
      </div>
    </>
  );
}
