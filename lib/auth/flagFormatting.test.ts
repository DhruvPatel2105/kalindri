import { describe, expect, it } from "vitest";

import {
  formatReasonLabel,
  formatSignalDataSummary,
  getLatestEventId,
} from "./flagFormatting";

describe("formatReasonLabel", () => {
  it("labels frequent_session_takeover", () => {
    expect(formatReasonLabel("frequent_session_takeover")).toBe(
      "Frequent session takeover",
    );
  });

  it("labels impossible_travel", () => {
    expect(formatReasonLabel("impossible_travel")).toBe("Impossible travel");
  });

  it("labels unusual_login_frequency", () => {
    expect(formatReasonLabel("unusual_login_frequency")).toBe(
      "Unusual login frequency",
    );
  });

  it("does not throw for an unknown reason, and falls back to the raw string", () => {
    expect(() => formatReasonLabel("some_future_reason")).not.toThrow();
    expect(formatReasonLabel("some_future_reason")).toBe("some_future_reason");
  });
});

describe("formatSignalDataSummary", () => {
  // Fixtures match exactly what lib/auth/flagging.ts's upsertOpenFlag()
  // writes: { evidence: [ { eventIds, thresholdCount?, windowMs?, detectedAt } ] }.

  it("summarizes a frequent_session_takeover flag", () => {
    const signalData = {
      evidence: [
        {
          eventIds: ["e1", "e2", "e3"],
          thresholdCount: 3,
          windowMs: 24 * 60 * 60 * 1000,
          detectedAt: "2026-01-01T12:00:00.000Z",
        },
      ],
    };
    const summary = formatSignalDataSummary(
      "frequent_session_takeover",
      signalData,
    );
    expect(summary).toEqual({
      kind: "text",
      text: "3 takeovers in the last 24 hours.",
    });
  });

  it("summarizes an unusual_login_frequency flag", () => {
    const signalData = {
      evidence: [
        {
          eventIds: ["e1", "e2", "e3", "e4", "e5"],
          thresholdCount: 5,
          windowMs: 60 * 60 * 1000,
          detectedAt: "2026-01-01T12:00:00.000Z",
        },
      ],
    };
    const summary = formatSignalDataSummary(
      "unusual_login_frequency",
      signalData,
    );
    expect(summary).toEqual({
      kind: "text",
      text: "5 logins in the last 1 hour.",
    });
  });

  it("summarizes an impossible_travel flag with no enrichment supplied (no country fields in real evidence)", () => {
    const signalData = {
      evidence: [
        {
          eventIds: ["e1"],
          detectedAt: "2026-01-01T12:00:00.000Z",
        },
      ],
    };
    const summary = formatSignalDataSummary("impossible_travel", signalData);
    expect(summary.kind).toBe("text");
    if (summary.kind === "text") {
      expect(summary.text).toContain("1 geo-jump event");
    }
  });

  it("summarizes an impossible_travel flag WITH enrichment — names the actual countries", () => {
    const signalData = {
      evidence: [{ eventIds: ["e1"], detectedAt: "2026-01-01T12:00:00.000Z" }],
    };
    const summary = formatSignalDataSummary("impossible_travel", signalData, {
      geoJump: { previousCountry: "Canada", currentCountry: "India" },
    });
    expect(summary).toEqual({
      kind: "text",
      text: "Login from Canada, then India — too soon to be plausible travel.",
    });
  });

  it("falls back to the generic wording when geoJump enrichment is explicitly null (e.g. the referenced event was deleted)", () => {
    const signalData = {
      evidence: [{ eventIds: ["e1"], detectedAt: "2026-01-01T12:00:00.000Z" }],
    };
    const summary = formatSignalDataSummary("impossible_travel", signalData, {
      geoJump: null,
    });
    expect(summary.kind).toBe("text");
    if (summary.kind === "text") {
      expect(summary.text).toContain("1 geo-jump event");
      expect(summary.text).not.toContain("Login from");
    }
  });

  it("falls back to the generic wording when geoJump enrichment has a null country", () => {
    const signalData = {
      evidence: [{ eventIds: ["e1"], detectedAt: "2026-01-01T12:00:00.000Z" }],
    };
    const summary = formatSignalDataSummary("impossible_travel", signalData, {
      geoJump: { previousCountry: null, currentCountry: "India" },
    });
    expect(summary.kind).toBe("text");
    if (summary.kind === "text") {
      expect(summary.text).not.toContain("Login from");
    }
  });

  it("appends the occurrence count to an enriched impossible_travel summary too", () => {
    const signalData = {
      evidence: [
        { eventIds: ["e1"], detectedAt: "2026-01-01T09:00:00.000Z" },
        { eventIds: ["e2"], detectedAt: "2026-01-01T12:00:00.000Z" },
      ],
    };
    const summary = formatSignalDataSummary("impossible_travel", signalData, {
      geoJump: { previousCountry: "Canada", currentCountry: "India" },
    });
    expect(summary).toEqual({
      kind: "text",
      text: "Login from Canada, then India — too soon to be plausible travel. (2 occurrences recorded)",
    });
  });

  it("notes the occurrence count when evidence has accumulated across repeat triggers", () => {
    const signalData = {
      evidence: [
        {
          eventIds: ["e1", "e2", "e3"],
          thresholdCount: 3,
          windowMs: 24 * 60 * 60 * 1000,
          detectedAt: "2026-01-01T09:00:00.000Z",
        },
        {
          eventIds: ["e1", "e2", "e3", "e4"],
          thresholdCount: 3,
          windowMs: 24 * 60 * 60 * 1000,
          detectedAt: "2026-01-01T12:00:00.000Z",
        },
      ],
    };
    const summary = formatSignalDataSummary(
      "frequent_session_takeover",
      signalData,
    );
    expect(summary).toEqual({
      kind: "text",
      text: "4 takeovers in the last 24 hours. (2 occurrences recorded)",
    });
  });

  it("falls back to pretty-printed JSON for an unrecognized reason, without throwing", () => {
    const signalData = { evidence: [{ eventIds: ["e1"], detectedAt: "x" }] };
    expect(() =>
      formatSignalDataSummary("some_future_reason", signalData),
    ).not.toThrow();
    const summary = formatSignalDataSummary("some_future_reason", signalData);
    expect(summary.kind).toBe("json");
    if (summary.kind === "json") {
      expect(summary.json).toContain("eventIds");
    }
  });

  it("falls back to JSON, without throwing, for a known reason with malformed signal_data", () => {
    expect(() =>
      formatSignalDataSummary("frequent_session_takeover", null),
    ).not.toThrow();
    expect(
      formatSignalDataSummary("frequent_session_takeover", null).kind,
    ).toBe("json");

    expect(() =>
      formatSignalDataSummary("frequent_session_takeover", "not an object"),
    ).not.toThrow();

    expect(() =>
      formatSignalDataSummary("frequent_session_takeover", {
        evidence: "not an array",
      }),
    ).not.toThrow();

    expect(() =>
      formatSignalDataSummary("frequent_session_takeover", { evidence: [] }),
    ).not.toThrow();
    expect(
      formatSignalDataSummary("frequent_session_takeover", { evidence: [] })
        .kind,
    ).toBe("json");
  });

  it("falls back to JSON, without throwing, for undefined signal_data", () => {
    expect(() =>
      formatSignalDataSummary("impossible_travel", undefined),
    ).not.toThrow();
  });
});

describe("getLatestEventId", () => {
  it("returns the single event id from an impossible_travel evidence entry", () => {
    const signalData = {
      evidence: [{ eventIds: ["evt-1"], detectedAt: "2026-01-01T12:00:00.000Z" }],
    };
    expect(getLatestEventId(signalData)).toBe("evt-1");
  });

  it("returns the id from the MOST RECENT evidence entry when several have accumulated", () => {
    const signalData = {
      evidence: [
        { eventIds: ["evt-1"], detectedAt: "2026-01-01T09:00:00.000Z" },
        { eventIds: ["evt-2"], detectedAt: "2026-01-01T12:00:00.000Z" },
      ],
    };
    expect(getLatestEventId(signalData)).toBe("evt-2");
  });

  it("returns the first id when an evidence entry's eventIds has more than one", () => {
    const signalData = {
      evidence: [{ eventIds: ["evt-1", "evt-2", "evt-3"], detectedAt: "x" }],
    };
    expect(getLatestEventId(signalData)).toBe("evt-1");
  });

  it("returns null for empty evidence", () => {
    expect(getLatestEventId({ evidence: [] })).toBeNull();
  });

  it("returns null when eventIds is missing or not an array", () => {
    expect(
      getLatestEventId({ evidence: [{ detectedAt: "x" }] }),
    ).toBeNull();
    expect(
      getLatestEventId({ evidence: [{ eventIds: "not-an-array" }] }),
    ).toBeNull();
  });

  it("returns null for malformed signal_data, without throwing", () => {
    expect(() => getLatestEventId(null)).not.toThrow();
    expect(getLatestEventId(null)).toBeNull();
    expect(getLatestEventId(undefined)).toBeNull();
    expect(getLatestEventId("not an object")).toBeNull();
  });
});
