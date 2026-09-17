/**
 * Pure display formatting for account_flags rows — reason labels and a
 * reason-specific summary of `signal_data`. No DB access; the admin flags
 * page (app/admin/flags/page.tsx) calls these with data it already fetched.
 *
 * `signal_data`'s real shape, exactly as lib/auth/flagging.ts writes it
 * (verified there, not assumed):
 *
 *   { evidence: EvidenceEntry[] }
 *
 * where each EvidenceEntry, per reason, is:
 *   - frequent_session_takeover: { eventIds, thresholdCount, windowMs, detectedAt }
 *   - unusual_login_frequency:   { eventIds, thresholdCount, windowMs, detectedAt }
 *   - impossible_travel:         { eventIds, detectedAt }  — NOTE: no country
 *     fields. flagging.ts's geo_jump evidence only carries the triggering
 *     session_events row's id, not the countries themselves (those live on
 *     that row's geo_country/previous_geo columns). `formatSignalDataSummary`
 *     can't reach the DB itself (pure, no DB access), so the caller — today,
 *     app/admin/flags/page.tsx — fetches that session_events row separately
 *     (by the id from `getLatestEventId`) and passes its geo_country/
 *     previous_geo in via the `options.geoJump` parameter. Without it (or if
 *     the referenced event was deleted), this falls back to the honest
 *     "see the user's session_events" wording. flagging.ts's detection/
 *     evidence-writing logic itself is untouched by any of this.
 *
 * `upsertOpenFlag` APPENDS a new entry to `evidence` on every repeat
 * trigger while a flag stays 'open', so evidence can hold more than one
 * entry — the summary uses the most recent one and notes the total count.
 */

export const FLAG_REASON_LABELS: Record<string, string> = {
  frequent_session_takeover: "Frequent session takeover",
  impossible_travel: "Impossible travel",
  unusual_login_frequency: "Unusual login frequency",
};

/** Never throws on an unrecognized reason — falls back to the raw string. */
export function formatReasonLabel(reason: string): string {
  return FLAG_REASON_LABELS[reason] ?? reason;
}

interface EvidenceEntry {
  eventIds?: unknown;
  thresholdCount?: unknown;
  windowMs?: unknown;
  detectedAt?: unknown;
}

function parseEvidence(signalData: unknown): EvidenceEntry[] {
  if (
    signalData &&
    typeof signalData === "object" &&
    Array.isArray((signalData as Record<string, unknown>).evidence)
  ) {
    return (signalData as { evidence: EvidenceEntry[] }).evidence;
  }
  return [];
}

function eventCount(entry: EvidenceEntry): number {
  return Array.isArray(entry.eventIds) ? entry.eventIds.length : 0;
}

/**
 * The first event id in the most recent evidence entry, if any — the
 * session_events row a caller should fetch to enrich a summary (e.g. the
 * geo_jump row behind an 'impossible_travel' flag). Generic over all
 * reasons, but only 'impossible_travel' evidence's `eventIds` is ever a
 * single-element array in practice (flagging.ts logs exactly one geo_jump
 * event per trigger), which is what makes "the first id" meaningful here.
 */
export function getLatestEventId(signalData: unknown): string | null {
  const latest = parseEvidence(signalData).at(-1);
  if (!latest || !Array.isArray(latest.eventIds)) return null;
  const [first] = latest.eventIds as unknown[];
  return typeof first === "string" ? first : null;
}

function formatDuration(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  if (Number.isInteger(hours) && hours >= 1) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const minutes = ms / (60 * 1000);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/**
 * The referenced session_events row's actual country values for an
 * 'impossible_travel' flag — fetched by the caller (signal_data itself
 * only stores the event id, not the countries; see the module doc).
 */
export interface GeoJumpEnrichment {
  currentCountry: string | null;
  previousCountry: string | null;
}

export interface FormatSignalDataOptions {
  geoJump?: GeoJumpEnrichment | null;
}

type SummaryFormatter = (
  entry: EvidenceEntry,
  options: FormatSignalDataOptions,
) => string;

const formatTakeoverFrequency: SummaryFormatter = (entry) => {
  const count = eventCount(entry);
  const windowLabel =
    typeof entry.windowMs === "number"
      ? formatDuration(entry.windowMs)
      : "the detection window";
  return `${count} takeover${count === 1 ? "" : "s"} in the last ${windowLabel}.`;
};

const formatLoginFrequency: SummaryFormatter = (entry) => {
  const count = eventCount(entry);
  const windowLabel =
    typeof entry.windowMs === "number"
      ? formatDuration(entry.windowMs)
      : "the detection window";
  return `${count} login${count === 1 ? "" : "s"} in the last ${windowLabel}.`;
};

const formatImpossibleTravel: SummaryFormatter = (entry, options) => {
  const geoJump = options.geoJump;
  if (geoJump?.previousCountry && geoJump?.currentCountry) {
    return `Login from ${geoJump.previousCountry}, then ${geoJump.currentCountry} — too soon to be plausible travel.`;
  }

  const count = eventCount(entry);
  return (
    `${count} geo-jump event${count === 1 ? "" : "s"} detected — a login ` +
    `from a different country too soon after the last one to be plausible ` +
    `travel. See the user's session_events for the specific locations.`
  );
};

const SUMMARY_FORMATTERS: Record<string, SummaryFormatter> = {
  frequent_session_takeover: formatTakeoverFrequency,
  unusual_login_frequency: formatLoginFrequency,
  impossible_travel: formatImpossibleTravel,
};

export type SignalDataSummary =
  | { kind: "text"; text: string }
  | { kind: "json"; json: string };

function prettyPrintJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to display signal data.";
  }
}

/**
 * A reason-specific human summary of `signalData`. Falls back to a
 * pretty-printed JSON block — never throws — for an unrecognized reason, or
 * for a known reason whose `signalData` doesn't match the expected shape
 * (e.g. hand-edited data, or a future flagging.ts change this formatter
 * hasn't caught up with yet).
 *
 * `options.geoJump`, when supplied, enriches an 'impossible_travel'
 * summary with the actual country names (see `getLatestEventId` and the
 * module doc for how a caller fetches that data).
 */
export function formatSignalDataSummary(
  reason: string,
  signalData: unknown,
  options: FormatSignalDataOptions = {},
): SignalDataSummary {
  const formatter = SUMMARY_FORMATTERS[reason];
  const evidence = formatter ? parseEvidence(signalData) : [];
  const latest = evidence.at(-1);

  if (!formatter || !latest) {
    return { kind: "json", json: prettyPrintJson(signalData) };
  }

  const detail = formatter(latest, options);
  const occurrenceNote =
    evidence.length > 1 ? ` (${evidence.length} occurrences recorded)` : "";

  return { kind: "text", text: detail + occurrenceNote };
}
