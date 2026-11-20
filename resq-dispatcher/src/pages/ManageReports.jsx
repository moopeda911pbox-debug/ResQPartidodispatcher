import React, { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import StatCard from "../components/StatCard";
import IncidentDetailModal from "../components/IncidentDetailModal";
import ExportMenu from "../components/ExportMenu";
import MediaViewerModal, { orderMedia } from "../components/MediaViewerModal";
import Pagination, { usePagination } from "../components/Pagination";
import { FileClock, ShieldCheck, CheckCircle2, Play } from "lucide-react";
import { STATUS, updateIncidentStatus } from "../services/incidents";
import { exportIncidentsToPDF, exportIncidentsToExcel } from "../lib/exportReports";
import { incidentAccessors, describeFilters, filenameSuffix } from "../lib/exportFilters";
import { fullName, formatPlace } from "../lib/format";
import { visitingFrom } from "../lib/jurisdiction";

const TABS = [
  { key: "all", label: "All Reports" },
  { key: "pending", label: "Pending" },
  { key: "acknowledged", label: "Verified" },
  { key: "resolved", label: "Responded" },
];

const MAX_THUMBS = 3;

// Clickable photo / video thumbnails — each opens the media viewer modal.
function MediaCell({ incident, onOpen }) {
  const items = orderMedia(incident);
  if (items.length === 0) return <span style={{ color: "var(--muted)", fontSize: 11.5 }}>—</span>;
  const extra = items.length - MAX_THUMBS;
  return (
    <div className="media-mini-row">
      {items.slice(0, MAX_THUMBS).map((m, i) => (
        <button
          key={m.id}
          type="button"
          className="media-mini"
          onClick={() => onOpen(incident, i)}
          title={m.file_type === "video" ? "Play video" : "View photo"}
          aria-label={m.file_type === "video" ? "Play video" : "View photo"}
        >
          {m.file_type === "video" ? (
            <span className="play-badge"><Play size={14} /></span>
          ) : (
            <img src={m.file_url} alt="" loading="lazy" />
          )}
        </button>
      ))}
      {extra > 0 && (
        <button type="button" className="media-more" onClick={() => onOpen(incident, MAX_THUMBS)} title="View all attachments">
          +{extra}
        </button>
      )}
    </div>
  );
}

export default function ManageReports() {
  const { incidents, loading, refresh } = useOutletContext();
  const [tab, setTab] = useState("all");
  const [acting, setActing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [mediaView, setMediaView] = useState(null); // { incident, index }

  const counts = useMemo(
    () => ({
      pending: incidents.filter((i) => i.status === "pending").length,
      acknowledged: incidents.filter((i) => i.status === "acknowledged").length,
      resolved: incidents.filter((i) => i.status === "resolved").length,
    }),
    [incidents]
  );

  const filtered = useMemo(
    () =>
      incidents
        .filter((i) => tab === "all" || i.status === tab)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [incidents, tab]
  );

  const pager = usePagination(filtered, { resetKey: tab });

  async function act(id, status) {
    setActing(id);
    try {
      await updateIncidentStatus(id, status);
      await refresh();
    } finally {
      setActing(null);
    }
  }

  const currentTabLabel = TABS.find((t) => t.key === tab)?.label || "All Reports";

  function exportMeta(items, sel) {
    const filterText = describeFilters(sel);
    const suffix = filenameSuffix(sel);
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      subtitle: `${currentTabLabel}${filterText ? ` · ${filterText}` : ""} · Generated ${new Date().toLocaleString()} · ${items.length} reports`,
      base: `resqpartido-reports-${tab}${suffix ? `-${suffix}` : ""}-${stamp}`,
    };
  }

  function handleExportPdf(items, sel) {
    const { subtitle, base } = exportMeta(items, sel);
    exportIncidentsToPDF(items, { title: "ResQPartido — Incident Reports", subtitle, filename: `${base}.pdf` });
  }

  function handleExportExcel(items, sel) {
    const { base } = exportMeta(items, sel);
    exportIncidentsToExcel(items, { sheetName: currentTabLabel, filename: `${base}.xlsx` });
  }

  if (loading) return <p className="empty-state">Loading live reports…</p>;

  return (
    <>
      <div className="stat-grid">
        <StatCard icon={FileClock} label="Pending" value={counts.pending} tone="gold" />
        <StatCard icon={ShieldCheck} label="Verified" value={counts.acknowledged} tone="info" />
        <StatCard icon={CheckCircle2} label="Responded" value={counts.resolved} tone="success" />
      </div>

      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div className="chip-row">
            {TABS.map((t) => (
              <button key={t.key} className={`chip${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <ExportMenu
            onExportPdf={handleExportPdf}
            onExportExcel={handleExportExcel}
            filter={{
              items: filtered,
              accessors: incidentAccessors,
              noun: "reports",
              hint: `Applied to the "${currentTabLabel}" list.`,
            }}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">No reports in this category yet.</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Reported by</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Photos &amp; Videos</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.slice.map((inc) => (
                    <tr key={inc.id}>
                      <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{inc.incident_type}</td>
                      <td style={{ maxWidth: 320 }}>{inc.description}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {fullName(inc.profiles, "—")}
                        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                          {visitingFrom(inc) ? `visiting from ${formatPlace(visitingFrom(inc))}` : formatPlace(inc.profiles?.municipality)}
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(inc.created_at).toLocaleString()}</td>
                      <td>
                        <span className={`status-pill ${STATUS[inc.status].className}`}>{STATUS[inc.status].label}</span>
                      </td>
                      <td>
                        <MediaCell incident={inc} onOpen={(incident, index) => setMediaView({ incident, index })} />
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn-mini" onClick={() => setViewing(inc)} style={{ marginRight: 6 }}>
                          View
                        </button>
                        {inc.status === "pending" && (
                          <button className="btn-mini primary" disabled={acting === inc.id} onClick={() => act(inc.id, "acknowledged")}>
                            Verify
                          </button>
                        )}
                        {inc.status !== "resolved" && (
                          <button className="btn-mini success" disabled={acting === inc.id} onClick={() => act(inc.id, "resolved")}>
                            Mark Responded
                          </button>
                        )}
                        {inc.status === "resolved" && <span style={{ color: "var(--muted)", fontSize: 11.5 }}>Closed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pager={pager} noun="reports" />
          </>
        )}
      </div>

      <IncidentDetailModal incident={viewing} onClose={() => setViewing(null)} />

      {mediaView && (
        <MediaViewerModal
          items={orderMedia(mediaView.incident)}
          startIndex={mediaView.index}
          title={mediaView.incident.incident_type}
          onClose={() => setMediaView(null)}
        />
      )}
    </>
  );
}
