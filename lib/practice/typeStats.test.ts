import { describe, expect, it } from "vitest";

import { summarizeTest } from "./testResults";
import {
  cappedDurationMs,
  computeAllStats,
  computeImprovement,
  computeTypeStats,
  MAX_SESSION_MS,
  type FinishedSession,
} from "./typeStats";

const MIN = 60_000;

/** A finished session; each question is worth 2 marks. c correct, p partial, i incorrect, u unanswered. */
function session(
  id: string,
  startMin: number,
  lengthMin: number,
  parts: { c?: number; p?: number; i?: number; u?: number },
  isRetry = false,
): FinishedSession {
  const q = (score: number | null, answered = true) => ({ answered, score, maxScore: 2 });
  const summary = summarizeTest([
    ...Array.from({ length: parts.c ?? 0 }, () => q(2)),
    ...Array.from({ length: parts.p ?? 0 }, () => q(1)),
    ...Array.from({ length: parts.i ?? 0 }, () => q(0)),
    ...Array.from({ length: parts.u ?? 0 }, () => q(null, false)),
  ]);
  const startedAt = new Date(2026, 0, 1, 0, startMin);
  return {
    sessionId: id,
    startedAt,
    completedAt: new Date(startedAt.getTime() + lengthMin * MIN),
    isRetry,
    summary,
  };
}

describe("cappedDurationMs", () => {
  const start = new Date(2026, 0, 1);
  it("is the time between start and submit", () => {
    expect(cappedDurationMs(start, new Date(start.getTime() + 12 * MIN))).toBe(12 * MIN);
  });

  it("caps a session that sat open for days", () => {
    expect(cappedDurationMs(start, new Date(start.getTime() + 3 * 24 * 60 * MIN))).toBe(MAX_SESSION_MS);
  });

  it("treats backwards or invalid times as zero", () => {
    expect(cappedDurationMs(start, new Date(start.getTime() - MIN))).toBe(0);
    expect(cappedDurationMs(start, new Date(Number.NaN))).toBe(0);
  });
});

describe("computeImprovement: latest vs previous full test", () => {
  it("needs two measurable full tests", () => {
    expect(computeImprovement([])).toBeNull();
    expect(computeImprovement([70])).toBeNull();
    expect(computeImprovement([70, null])).toBeNull();
  });

  it("is the latest accuracy minus the previous one, in points", () => {
    expect(computeImprovement([50, 40, 60, 75])).toEqual({ latestPercent: 75, previousPercent: 60, points: 15 });
  });

  it("can be a decline", () => {
    expect(computeImprovement([80, 60])?.points).toBe(-20);
  });

  it("skips tests that are still awaiting a mark", () => {
    expect(computeImprovement([50, 70, null])).toEqual({ latestPercent: 70, previousPercent: 50, points: 20 });
  });
});

describe("full and retry performance are kept apart", () => {
  // Full A: 10 questions, 6 correct. Full B: 20 questions, 18 correct. Retry: 4 questions, 3 correct.
  const sessions = [
    session("a", 0, 10, { c: 6, i: 3, u: 1 }),
    session("b", 60, 20, { c: 18, p: 1, i: 1 }),
    session("r", 120, 5, { c: 3, i: 1 }, true),
  ];
  const s = computeTypeStats(sessions);

  it("counts completed sessions of each kind", () => {
    expect([s.full.sessions, s.retry.sessions]).toEqual([2, 1]);
  });

  it("full accuracy is WEIGHTED: total correct over total questions, not the mean of 60% and 90%", () => {
    expect(s.full.accuracyPercent).toBe(80); // 24 of 30
    expect(s.full.accuracyPercent).not.toBe(75); // (60 + 90) / 2
  });

  it("retry accuracy is its own figure and never mixes into full", () => {
    expect(s.retry.accuracyPercent).toBe(75); // 3 of 4
    expect(s.full.questions.total).toBe(30);
    expect(s.retry.questions.total).toBe(4);
  });

  it("completion rate is attempted over total, separately from accuracy", () => {
    expect(s.full.completionPercent).toBe(97); // 29 of 30 attempted (one blank)
    expect(s.retry.completionPercent).toBe(100);
  });

  it("question counts add up", () => {
    const q = s.full.questions;
    expect(q.correct + q.partial + q.incorrect + q.unanswered).toBe(q.total);
    expect(q.attempted).toBe(q.total - q.unanswered);
  });

  it("marks percentage is weighted too", () => {
    expect(s.full.marks).toEqual({ score: 49, maxScore: 60 }); // 12+37 of 20+40
    expect(s.full.marksPercent).toBe(82);
  });

  it("practice time includes both kinds; questions practised are the attempted ones", () => {
    expect(s.practiceSeconds).toBe(35 * 60);
    expect(s.averageSessionSeconds).toBe(Math.round((35 * 60) / 3));
    expect(s.questionsPractised).toBe(29 + 4);
  });

  it("the trend and improvement use full tests only, by accuracy", () => {
    expect(s.trend.map((t) => [t.sessionId, t.percent])).toEqual([["a", 60], ["b", 90]]);
    expect(s.improvement).toEqual({ latestPercent: 90, previousPercent: 60, points: 30 });
  });

  it("doesn't depend on the order sessions are passed in", () => {
    expect(computeTypeStats([...sessions].reverse()).improvement).toEqual(s.improvement);
  });

  it("a test awaiting a mark is left out of accuracy rather than understating it", () => {
    const pending = session("p", 200, 5, { c: 1 });
    pending.summary = { ...pending.summary, unscored: 1, accuracyPercent: null };
    expect(computeTypeStats([...sessions, pending]).full.accuracyPercent).toBe(80);
  });
});

describe("empty and one-sided data are safe", () => {
  it("nothing finished: no NaN, null percentages, zero counts", () => {
    const s = computeTypeStats([]);
    expect(s.full).toMatchObject({ sessions: 0, accuracyPercent: null, completionPercent: null, marksPercent: null });
    expect(s.retry.accuracyPercent).toBeNull();
    expect(s).toMatchObject({ practiceSeconds: 0, averageSessionSeconds: null, questionsPractised: 0, improvement: null, trend: [] });
  });

  it("only retries finished: full figures stay empty, the retry and time still count", () => {
    const s = computeTypeStats([session("r", 0, 5, { c: 1 }, true)]);
    expect(s.full.sessions).toBe(0);
    expect(s.full.accuracyPercent).toBeNull();
    expect(s.retry.accuracyPercent).toBe(100);
    expect(s.practiceSeconds).toBe(300);
  });

  it("a session with no questions doesn't divide by zero", () => {
    const s = computeTypeStats([session("z", 0, 1, {})]);
    expect(s.full.accuracyPercent).toBeNull();
    expect(s.full.completionPercent).toBeNull();
  });
});

describe("computeAllStats: the main dashboard agrees with the type dashboards", () => {
  const a = { ...session("a", 0, 10, { c: 8, i: 2 }), type: "FIB_RW" as const };
  const b = { ...session("b", 30, 10, { c: 4, i: 6 }), type: "REORDER_PARAGRAPH" as const };
  const c = { ...session("c", 60, 5, { c: 2 }, true), type: "FIB_RW" as const };
  const d = { ...session("d", 90, 10, { c: 5, u: 5 }), type: "FIB_RW" as const };
  const { overall, byType } = computeAllStats([a, b, c, d]);

  it("splits by type", () => {
    expect([...byType.keys()].sort()).toEqual(["FIB_RW", "REORDER_PARAGRAPH"]);
    expect(byType.get("FIB_RW")?.full.sessions).toBe(2);
    expect(byType.get("FIB_RW")?.retry.sessions).toBe(1);
  });

  it("overall counts equal the sum over the types", () => {
    const sum = (pick: (s: ReturnType<typeof computeTypeStats>) => number) =>
      [...byType.values()].reduce((total, s) => total + pick(s), 0);
    expect(sum((s) => s.full.sessions)).toBe(overall.full.sessions);
    expect(sum((s) => s.retry.sessions)).toBe(overall.retry.sessions);
    expect(sum((s) => s.full.questions.correct)).toBe(overall.full.questions.correct);
    expect(sum((s) => s.full.questions.total)).toBe(overall.full.questions.total);
    expect(sum((s) => s.practiceSeconds)).toBe(overall.practiceSeconds);
    expect(sum((s) => s.questionsPractised)).toBe(overall.questionsPractised);
  });

  it("overall accuracy is weighted over all full tests, not an average of the type percentages", () => {
    // 8 + 4 + 5 = 17 correct of 30 questions = 57%; types are 65% (13/20) and 40% (4/10)
    expect(overall.full.accuracyPercent).toBe(57);
    expect(Math.round((65 + 40) / 2)).toBe(53);
  });

  it("retries stay out of the overall full-test figures", () => {
    expect(overall.full.questions.total).toBe(30);
    expect(overall.retry.questions.total).toBe(2);
  });
});
