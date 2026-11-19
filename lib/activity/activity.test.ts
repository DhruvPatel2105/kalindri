import { describe, expect, it } from "vitest";

import {
  addDays,
  areaFromPath,
  creditSeconds,
  dayInZone,
  describeAreas,
  formatSpent,
  isDay,
  MAX_CREDIT_S,
  rollingTotals,
  summarizeActivity,
  type DayRow,
} from "./activity";

const at = (s: number) => new Date(Date.UTC(2026, 10, 19, 12, 0, 0) + s * 1000);

describe("creditSeconds", () => {
  it("credits the gap since the previous heartbeat", () => {
    expect(creditSeconds(at(0), at(30))).toBe(30);
    expect(creditSeconds(at(0), at(MAX_CREDIT_S))).toBe(MAX_CREDIT_S);
  });

  it("credits nothing for the first heartbeat", () => {
    expect(creditSeconds(null, at(0))).toBe(0);
  });

  it("credits nothing after a longer gap: the student was away or the tab was closed", () => {
    expect(creditSeconds(at(0), at(MAX_CREDIT_S + 1))).toBe(0);
    expect(creditSeconds(at(0), at(3600))).toBe(0);
  });

  it("credits nothing if the clock went backwards or the time is the same", () => {
    expect(creditSeconds(at(30), at(0))).toBe(0);
    expect(creditSeconds(at(30), at(30))).toBe(0);
    expect(creditSeconds(at(0), new Date(Number.NaN))).toBe(0);
  });

  it("two tabs sending heartbeats credit each minute once, not twice", () => {
    // tab A at 0,30,60,90 and tab B at 10,40,70,100: arrival order is what counts
    const arrivals = [0, 10, 30, 40, 60, 70, 90, 100];
    let previous: Date | null = null;
    let total = 0;
    for (const s of arrivals) {
      total += creditSeconds(previous, at(s));
      previous = at(s);
    }
    expect(total).toBe(100); // the wall-clock span, not 200
  });

  it("a refresh or page change mid-session keeps counting; a long pause doesn't", () => {
    const beats = [0, 30, 55, /* page reload */ 60, 90, /* walked away */ 500, 530];
    let previous: Date | null = null;
    let total = 0;
    for (const s of beats) {
      total += creditSeconds(previous, at(s));
      previous = at(s);
    }
    expect(total).toBe(90 + 30); // 0..90 continuous, 500..530 continuous, the gap between uncounted
  });

  it("spamming heartbeats cannot add more than the time that passed", () => {
    let previous: Date | null = null;
    let total = 0;
    for (let i = 0; i < 500; i++) {
      total += creditSeconds(previous, at(i * 0.1));
      previous = at(i * 0.1);
    }
    expect(total).toBeLessThanOrEqual(50);
  });
});

describe("areaFromPath", () => {
  const SET = "47277dad-0759-4d44-b6e5-cc1dc7ebcd48";
  const SESSION = "b660ceb7-1428-4990-a598-90b074795ee3";
  it("classifies pages by what the student is doing", () => {
    expect(areaFromPath(`/practice/FIB_RW/${SET}`)).toBe("test");
    expect(areaFromPath("/mock/reading/run")).toBe("test");
    expect(areaFromPath("/mock/reading")).toBe("test");
    expect(areaFromPath(`/practice/FIB_RW/${SET}/session/${SESSION}`)).toBe("test");
    expect(areaFromPath(`/practice/FIB_RW/learn/${SET}`)).toBe("practice");
    expect(areaFromPath("/practice/FIB_RW/learn/sets")).toBe("practice");
    expect(areaFromPath(`/practice/FIB_RW/${SET}/results/${SESSION}`)).toBe("review");
    expect(areaFromPath(`/practice/FIB_RW/${SET}/results/${SESSION}/review?q=2`)).toBe("review");
    expect(areaFromPath("/practice/history")).toBe("review");
    expect(areaFromPath("/practice/FIB_RW/progress")).toBe("review");
    expect(areaFromPath("/practice/FIB_RW/tests")).toBe("review");
  });

  it("everything else, including junk, is 'other'", () => {
    for (const p of ["/", "/practice/FIB_RW", "", "nonsense", "/admin/users", `/practice/FIB_RW/${SET}x`]) {
      expect(areaFromPath(p), p).toBe("other");
    }
  });
});

describe("days", () => {
  it("dayInZone uses the zone's calendar day, not UTC", () => {
    // 02:00 UTC on the 20th is still the evening of the 19th in Toronto
    expect(dayInZone(new Date("2026-11-20T02:00:00Z"), "America/Toronto")).toBe("2026-11-19");
    expect(dayInZone(new Date("2026-11-20T06:00:00Z"), "America/Toronto")).toBe("2026-11-20");
  });

  it("addDays handles month, year and leap boundaries", () => {
    expect(addDays("2026-11-19", -1)).toBe("2026-11-18");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("isDay accepts only real dates", () => {
    expect(isDay("2026-11-19")).toBe(true);
    for (const bad of ["2026-02-31", "2026-13-01", "19-11-2026", "", "2026-1-1", "nope"]) expect(isDay(bad)).toBe(false);
  });
});

describe("rollingTotals", () => {
  const rows = [
    { day: "2026-11-19", seconds: 100 }, // today
    { day: "2026-11-18", seconds: 200 }, // yesterday
    { day: "2026-11-13", seconds: 400 }, // 6 days ago: inside 7
    { day: "2026-11-12", seconds: 800 }, // 7 days ago: outside 7, inside 30
    { day: "2026-10-21", seconds: 1600 }, // 29 days ago: inside 30
    { day: "2026-10-20", seconds: 3200 }, // 30 days ago: outside
    { day: "2026-11-20", seconds: 6400 }, // future: ignored
  ];
  it("computes today, yesterday, last 7 and last 30 days (windows include today)", () => {
    expect(rollingTotals(rows, "2026-11-19")).toEqual({ today: 100, yesterday: 200, last7: 700, last30: 3100 });
  });

  it("is all zero with no data", () => {
    expect(rollingTotals([], "2026-11-19")).toEqual({ today: 0, yesterday: 0, last7: 0, last30: 0 });
  });
});

describe("summarizeActivity", () => {
  const rows: DayRow[] = [
    { day: "2026-11-19", seconds: 8100, byArea: { test: 3600, practice: 4500 } },
    { day: "2026-11-18", seconds: 6000, byArea: { test: 6000 } },
    { day: "2026-11-17", seconds: 2700, byArea: { practice: 2700 } },
    { day: "2026-11-16", seconds: 0, byArea: {} },
  ];
  it("totals, active days and the average over ACTIVE days only", () => {
    const s = summarizeActivity(rows);
    expect(s.totalSeconds).toBe(16800);
    expect(s.activeDays).toBe(3);
    expect(s.averageSecondsPerActiveDay).toBe(5600);
  });

  it("lists the busiest days, most time first", () => {
    expect(summarizeActivity(rows, 2).mostActive.map((r) => r.day)).toEqual(["2026-11-19", "2026-11-18"]);
  });

  it("splits time by area", () => {
    expect(summarizeActivity(rows).byArea).toEqual({ test: 9600, practice: 7200, review: 0, other: 0 });
  });

  it("handles no activity without dividing by zero", () => {
    expect(summarizeActivity([])).toMatchObject({ totalSeconds: 0, activeDays: 0, averageSecondsPerActiveDay: 0, mostActive: [] });
  });
});

describe("formatting", () => {
  it("formatSpent reads naturally", () => {
    expect(formatSpent(8100)).toBe("2 hours 15 minutes");
    expect(formatSpent(2700)).toBe("45 minutes");
    expect(formatSpent(3600)).toBe("1 hour");
    expect(formatSpent(60)).toBe("1 minute");
    expect(formatSpent(20)).toBe("Less than a minute");
    expect(formatSpent(0)).toBe("0 minutes");
    expect(formatSpent(-5)).toBe("0 minutes");
    expect(formatSpent(Number.NaN)).toBe("0 minutes");
  });

  it("describeAreas lists what a day included, biggest first", () => {
    expect(describeAreas({ test: 2400, practice: 4800 })).toBe("Practice 1 hour 20 minutes · Test 40 minutes");
    expect(describeAreas({})).toBe("");
  });
});
