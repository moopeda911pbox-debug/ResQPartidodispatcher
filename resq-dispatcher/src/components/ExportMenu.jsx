import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, FileSpreadsheet, ChevronDown, X } from "lucide-react";
import {
  MONTHS,
  UNSPECIFIED,
  ALL,
  EMPTY_SELECTION,
  filterOptions,
  applyExportFilters,
} from "../lib/exportFilters";

// Dialog that lets the user narrow what gets exported (year / month / municipality)
// and shows how many records will be included before downloading.
function ExportFilterModal({ format, items, accessors, noun, hint, onCancel, onConfirm }) {
  const [sel, setSel] = useState(EMPTY_SELECTION);
  const options = useMemo(() => filterOptions(items, accessors), [items, accessors]);
  const matched = useMemo(() => applyExportFilters(items, sel, accessors), [items, sel, accessors]);
  const set = (key) => (e) => setSel((s) => ({ ...s, [key]: e.target.value }));
  const formatLabel = format === "pdf" ? "PDF" : "Spreadsheet";

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <div className="detail-overlay" onClick={onCancel}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="detail-header">
          <div>
            <h2>Export {formatLabel}</h2>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Choose what to include</span>
          </div>
          <button className="icon-btn" onClick={onCancel} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="two-col-fields">
          <div className="field">
            <label>Year</label>
            <select value={sel.year} onChange={set("year")}>
              <option value={ALL}>All years</option>
              {options.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Month</label>
            <select value={sel.month} onChange={set("month")}>
              <option value={ALL}>All months</option>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Municipality</label>
          <select value={sel.municipality} onChange={set("municipality")}>
            <option value={ALL}>All municipalities</option>
            {options.municipalities.map((m) => <option key={m} value={m}>{m}</option>)}
            {options.hasUnspecified && <option value={UNSPECIFIED}>{UNSPECIFIED}</option>}
          </select>
        </div>

        <p className="sub-note" style={{ margin: "0 0 14px" }}>
          <strong>{matched.length}</strong> of {items.length} {noun} will be exported.
          {hint ? ` ${hint}` : ""}
        </p>

        <button
          className="btn-primary"
          disabled={matched.length === 0}
          onClick={() => onConfirm(matched, sel)}
        >
          {matched.length === 0 ? `No ${noun} match these filters` : `Download ${formatLabel}`}
        </button>
      </div>
    </div>,
    document.body
  );
}

/**
 * Export dropdown (PDF / Spreadsheet).
 *
 * Plain usage:   <ExportMenu onExportPdf={() => ...} onExportExcel={() => ...} />
 * With filters:  <ExportMenu filter={{ items, accessors, noun }} onExportPdf={(items, sel) => ...} ... />
 *   -> picking a format opens the year / month / municipality dialog first, then calls the
 *      handler with the matching items and the selection that was chosen.
 */
export default function ExportMenu({ onExportPdf, onExportExcel, label = "Export", filter }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null); // "pdf" | "excel"
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function choose(format) {
    setOpen(false);
    if (filter) setPending(format);
    else (format === "pdf" ? onExportPdf : onExportExcel)();
  }

  return (
    <div className="export-menu" ref={ref}>
      <button type="button" className="btn-mini" onClick={() => setOpen((o) => !o)}>
        <Download size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
        {label}
        <ChevronDown size={12} style={{ verticalAlign: -2, marginLeft: 4 }} />
      </button>
      {open && (
        <div className="export-menu-dropdown">
          <button type="button" onClick={() => choose("pdf")}>
            <FileText size={13} /> Download PDF
          </button>
          <button type="button" onClick={() => choose("excel")}>
            <FileSpreadsheet size={13} /> Download Spreadsheet
          </button>
        </div>
      )}
      {pending && filter && (
        <ExportFilterModal
          format={pending}
          items={filter.items}
          accessors={filter.accessors}
          noun={filter.noun || "records"}
          hint={filter.hint}
          onCancel={() => setPending(null)}
          onConfirm={(items, sel) => {
            const handler = pending === "pdf" ? onExportPdf : onExportExcel;
            setPending(null);
            handler(items, sel);
          }}
        />
      )}
    </div>
  );
}
