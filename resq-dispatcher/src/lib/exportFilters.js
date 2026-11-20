// Year / month / municipality filtering used by every Export menu
// (Manage Reports, Analytics & Report, Response Times, Call History).

import { MUNICIPALITIES } from "./adminAccounts";
import { formatPlace, sameText, incidentPlace, callPlace } from "./format";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const UNSPECIFIED = "Unspecified";
export const ALL = "all";
export const EMPTY_SELECTION = { year: ALL, month: ALL, municipality: ALL };

// Accessors for the two record shapes we export.
export const incidentAccessors = {
  getDate: (inc) => inc.created_at,
  getMunicipality: incidentPlace, // where the emergency happened
};
export const callAccessors = {
  getDate: (call) => call.started_at,
  getMunicipality: callPlace,
};

function parts(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() }; // local time, same as what the tables display
}

export function filterOptions(items, { getDate, getMunicipality }) {
  const years = new Set();
  const places = new Map(); // lower-case -> display
  let hasUnspecified = false;

  for (const it of items) {
    const p = parts(getDate(it));
    if (p) years.add(p.year);
    const m = formatPlace(getMunicipality(it));
    if (m) places.set(m.toLocaleLowerCase(), m);
    else hasUnspecified = true;
  }
  for (const m of MUNICIPALITIES) places.set(m.toLocaleLowerCase(), m);

  return {
    years: [...years].sort((a, b) => b - a),
    municipalities: [...places.values()].sort((a, b) => a.localeCompare(b)),
    hasUnspecified,
  };
}

export function applyExportFilters(items, sel, { getDate, getMunicipality }) {
  const year = sel.year === ALL ? null : Number(sel.year);
  const month = sel.month === ALL ? null : Number(sel.month);
  const place = sel.municipality;

  return items.filter((it) => {
    if (year != null || month != null) {
      const p = parts(getDate(it));
      if (!p) return false;
      if (year != null && p.year !== year) return false;
      if (month != null && p.month !== month) return false;
    }
    if (place !== ALL) {
      const m = formatPlace(getMunicipality(it));
      if (place === UNSPECIFIED ? m !== "" : !sameText(m, place)) return false;
    }
    return true;
  });
}

export function isFiltered(sel) {
  return sel.year !== ALL || sel.month !== ALL || sel.municipality !== ALL;
}

/** "2026 · March · Goa" — empty string when nothing is filtered. */
export function describeFilters(sel) {
  const out = [];
  if (sel.year !== ALL) out.push(String(sel.year));
  if (sel.month !== ALL) out.push(MONTHS[Number(sel.month)]);
  if (sel.municipality !== ALL) out.push(sel.municipality);
  return out.join(" · ");
}

/** "2026-03-goa" — for filenames; empty when nothing is filtered. */
export function filenameSuffix(sel) {
  const out = [];
  if (sel.year !== ALL) out.push(String(sel.year));
  if (sel.month !== ALL) out.push(String(Number(sel.month) + 1).padStart(2, "0"));
  if (sel.municipality !== ALL) out.push(sel.municipality.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  return out.join("-");
}

// ---------------------------------------------------------------
// Trend rows for the Analytics export, shaped like dailyTrend()'s output.
//   year + month  -> one row per day of that month
//   anything else with year/month/municipality picked -> one row per month
//   no filter     -> the on-screen trend (fallback())
// ---------------------------------------------------------------
function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyRow(label) {
  return { label, pending: 0, acknowledged: 0, resolved: 0, total: 0 };
}

export function trendForSelection(items, sel, fallback) {
  if (!isFiltered(sel)) return { rows: fallback(), granularity: "day" };

  if (sel.year !== ALL && sel.month !== ALL) {
    const y = Number(sel.year);
    const m = Number(sel.month);
    const days = new Date(y, m + 1, 0).getDate();
    const byKey = {};
    const rows = [];
    for (let d = 1; d <= days; d++) {
      const row = emptyRow(new Date(y, m, d).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
      byKey[localKey(new Date(y, m, d))] = row;
      rows.push(row);
    }
    for (const inc of items) {
      const row = byKey[localKey(new Date(inc.created_at))];
      if (!row) continue;
      row[inc.status] = (row[inc.status] ?? 0) + 1;
      row.total += 1;
    }
    return { rows, granularity: "day" };
  }

  // Monthly buckets from the first to the last month that has data.
  const stamps = items.map((i) => parts(i.created_at)).filter(Boolean);
  if (stamps.length === 0) return { rows: [], granularity: "month" };
  const idx = (p) => p.year * 12 + p.month;
  const lo = Math.min(...stamps.map(idx));
  const hi = Math.max(...stamps.map(idx));
  const rows = [];
  const byIdx = {};
  for (let i = lo; i <= hi; i++) {
    const row = emptyRow(new Date(Math.floor(i / 12), i % 12, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" }));
    byIdx[i] = row;
    rows.push(row);
  }
  for (const inc of items) {
    const p = parts(inc.created_at);
    const row = p && byIdx[idx(p)];
    if (!row) continue;
    row[inc.status] = (row[inc.status] ?? 0) + 1;
    row.total += 1;
  }
  return { rows, granularity: "month" };
}
