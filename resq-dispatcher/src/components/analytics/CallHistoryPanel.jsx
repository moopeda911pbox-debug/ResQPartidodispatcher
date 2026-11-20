import React, { useMemo, useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock } from "lucide-react";
import StatCard from "../StatCard";
import ExportMenu from "../ExportMenu";
import Pagination, { usePagination } from "../Pagination";
import {
  PERIODS,
  OUTCOME_META,
  cutoffFor,
  withinPeriod,
  effectiveOutcome,
  overallCalls,
  ringTime,
  formatDuration,
  formatClock,
  formatDateTime,
} from "../../lib/responseMetrics";
import { exportCallHistoryToPDF, exportCallHistoryToExcel } from "../../lib/exportReports";
import { callAccessors, describeFilters, filenameSuffix } from "../../lib/exportFilters";
import { titleCase } from "../../lib/format";

const VIEWS = [
  { key: "all", label: "All calls" },
  { key: "inbound", label: "Citizen emergency calls" },
  { key: "outbound", label: "Dispatcher calls to citizens" },
];

export default function CallHistoryPanel({ callLogs, error, loading }) {
  const [view, setView] = useState("all");
  const [period, setPeriod] = useState(30);
  const [dispatcherId, setDispatcherId] = useState("all");
  const [query, setQuery] = useState("");

  const cutoff = cutoffFor(period);
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";
  const viewLabel = VIEWS.find((v) => v.key === view)?.label ?? "";

  const inPeriod = useMemo(() => callLogs.filter((c) => withinPeriod(c.started_at, cutoff)), [callLogs, cutoff]);
  const stats = useMemo(() => overallCalls(inPeriod), [inPeriod]);

  const dispatcherOptions = useMemo(() => {
    const map = new Map();
    for (const c of callLogs) {
      if (c.dispatcher_id && !map.has(c.dispatcher_id)) map.set(c.dispatcher_id, titleCase(c.dispatcher_name) || "Unknown dispatcher");
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [callLogs]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inPeriod.filter((c) => {
      if (view !== "all" && c.direction !== view) return false;
      if (dispatcherId !== "all" && c.dispatcher_id !== dispatcherId) return false;
      if (q) {
        const haystack = `${c.citizen_name ?? ""} ${c.dispatcher_name ?? ""} ${c.incident_type ?? ""} ${c.municipality ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [inPeriod, view, dispatcherId, query]);

  const pager = usePagination(rows, { resetKey: `${view}|${period}|${dispatcherId}|${query}` });

  function exportName(sel, ext) {
    const suffix = filenameSuffix(sel);
    return `resqpartido-call-history${suffix ? `-${suffix}` : ""}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }
  function handleExportPdf(items, sel) {
    exportCallHistoryToPDF(items, { periodLabel, viewLabel, filterLabel: describeFilters(sel), filename: exportName(sel, "pdf") });
  }
  function handleExportExcel(items, sel) {
    exportCallHistoryToExcel(items, { sheetName: viewLabel, filename: exportName(sel, "xlsx") });
  }

  if (error) {
    return (
      <div className="notice error">
        <strong>Call history isn't available yet.</strong> Run <code>supabase/response_tracking_schema.sql</code> in the
        Supabase SQL editor to create the call log, then reload this page. ({error})
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2>Call History</h2>
            <span className="sub">Every in-app call — citizens calling for help and dispatchers calling citizens back</span>
          </div>
          <div className="filter-row">
            <div className="chip-row">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  className={`chip${period === p.key ? " active" : ""}`}
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <ExportMenu
              onExportPdf={handleExportPdf}
              onExportExcel={handleExportExcel}
              filter={{
                items: rows,
                accessors: callAccessors,
                noun: "calls",
                hint: `Applied to the "${viewLabel}" list currently shown.`,
              }}
            />
          </div>
        </div>

        <div className="stat-grid" style={{ marginBottom: 0 }}>
          <StatCard icon={Phone} label="Calls in period" value={stats.total} tone="navy" />
          <StatCard icon={PhoneIncoming} label="Citizen calls answered" value={`${stats.inboundAnswered} / ${stats.inbound}`} tone="success" />
          <StatCard icon={PhoneMissed} label="Citizen calls missed" value={stats.inboundMissed} tone="orange" />
          <StatCard icon={Clock} label="Avg. time to pick up" value={formatDuration(stats.avgPickup)} tone="info" />
        </div>
      </div>

      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div className="chip-row">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                className={`chip${view === v.key ? " active" : ""}`}
                onClick={() => setView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="filter-row">
            <select
              value={dispatcherId}
              onChange={(e) => setDispatcherId(e.target.value)}
              aria-label="Filter by dispatcher"
            >
              <option value="all">All dispatchers</option>
              {dispatcherOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <input
              type="search"
              placeholder="Search citizen or dispatcher…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="sub">{rows.length} calls</span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading call history…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            {callLogs.length === 0
              ? "No calls have been logged yet. Calls placed or answered from now on appear here."
              : "No calls match these filters."}
          </div>
        ) : (
          <>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Citizen</th>
                  <th>Dispatcher</th>
                  <th>Regarding</th>
                  <th className="num">Ring time</th>
                  <th className="num">Talk time</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((c) => {
                  const outcome = effectiveOutcome(c);
                  const meta = OUTCOME_META[outcome] ?? { label: outcome, tone: "pending" };
                  const inbound = c.direction === "inbound";
                  const ring = ringTime(c);
                  return (
                    <tr key={c.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: 11.5 }}>
                        {formatDateTime(c.started_at)}
                        {c.ended_at && (
                          <div style={{ fontSize: 10.5, color: "var(--muted)" }}>ended {formatDateTime(c.ended_at)}</div>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${c.direction}`}>
                          {inbound ? <PhoneIncoming size={11} /> : <PhoneOutgoing size={11} />}
                          {inbound ? "Citizen called" : "Dispatcher called"}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <strong>{titleCase(c.citizen_name) || "Unknown citizen"}</strong>
                        {c.municipality && <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{titleCase(c.municipality)}</div>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {c.dispatcher_name ? (
                          <strong>{titleCase(c.dispatcher_name)}</strong>
                        ) : (
                          <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Nobody picked up</span>
                        )}
                      </td>
                      <td style={{ maxWidth: 200 }}>{c.incident_type ? c.incident_type : <span style={{ color: "var(--muted)" }}>General call</span>}</td>
                      <td className="num">
                        {formatDuration(ring)}
                        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                          {inbound ? "citizen waited" : "dispatcher waited"}
                        </div>
                      </td>
                      <td className="num">{formatClock(c.duration_seconds)}</td>
                      <td>
                        <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination pager={pager} noun="calls" />
          </>
        )}
      </div>
    </>
  );
}
