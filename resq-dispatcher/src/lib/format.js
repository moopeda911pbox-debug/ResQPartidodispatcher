// Display / input formatting helpers shared across the dispatcher app.

// Words that must stay fully upper-case even after title-casing.
const ACRONYMS = new Set(["PNP", "BFP", "MDRRMO", "MDRRMC", "MPS", "SOS", "II", "III", "IV"]);

/**
 * "goa jurisdiction" / "GOA JURISDICTION" / "  goa   jurisdiction " -> "Goa Jurisdiction"
 * Handles hyphens ("Mary-Ann"), periods ("Jr."), and apostrophe prefixes ("o'brien" -> "O'Brien"
 * but "don't" stays "Don't"). Returns non-strings unchanged and null/undefined as "".
 */
export function titleCase(value) {
  if (value == null) return "";
  if (typeof value !== "string") return value;

  const cleaned = value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  if (!cleaned) return "";

  return cleaned
    .replace(/(^|[\s\-./(])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase())
    .replace(/(^|[\s\-./(])(\p{L})['’](\p{L})/gu, (_, sep, a, b) => `${sep}${a}'${b.toLocaleUpperCase()}`)
    .replace(/\p{L}+/gu, (word) => (ACRONYMS.has(word.toUpperCase()) ? word.toUpperCase() : word));
}

/** Full display name from a profile-like object ({ first_name, last_name }). */
export function fullName(profile, fallback = "") {
  const joined = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  return titleCase(joined) || fallback;
}

/** Municipality / place label, e.g. "san jose" -> "San Jose". Empty -> fallback. */
export function formatPlace(value, fallback = "") {
  return titleCase(value) || fallback;
}

/** Case-insensitive, whitespace-tolerant equality for names/places. */
export function sameText(a, b) {
  return titleCase(a).toLocaleLowerCase() === titleCase(b).toLocaleLowerCase();
}

/**
 * Municipality a report belongs to = where the emergency happened (incidents.jurisdiction,
 * set by the database from GPS). Falls back to the reporter's home municipality only when the
 * jurisdiction column doesn't exist yet (migration not run). null jurisdiction = unplaced.
 */
export function incidentPlace(incident) {
  const where = incident?.jurisdiction !== undefined ? incident.jurisdiction : incident?.profiles?.municipality;
  return formatPlace(where);
}

/** Same rule for call_logs rows. */
export function callPlace(call) {
  const where = call?.jurisdiction !== undefined ? call.jurisdiction : call?.municipality;
  return formatPlace(where);
}
