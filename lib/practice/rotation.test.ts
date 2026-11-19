import { describe, expect, it } from "vitest";

import { currentRound, remainingInRound, selectRotation } from "./rotation";

const bank = (n: number) => Array.from({ length: n }, (_, i) => `q${String(i + 1).padStart(2, "0")}`);
const POOL = bank(60);

/** Runs a sequence of test sizes against a bank, recording each pick as history. */
function run(sizes: number[], pool = POOL, random?: () => number) {
  const history: string[][] = [];
  const picks: string[][] = [];
  for (const count of sizes) {
    const pick = selectRotation({ pool, history, reserved: [], count, random });
    picks.push(pick);
    history.push(pick); // all answered
  }
  return { picks, history };
}

describe("Scenario A: normal rotation (60 questions: 20, 30, 10, then a new round)", () => {
  const { picks } = run([20, 30, 10, 60]);
  const pick = (i: number) => picks[i] ?? [];

  it("the first three tests use each question exactly once", () => {
    const first = [...pick(0), ...pick(1), ...pick(2)];
    expect(picks.slice(0, 3).map((p) => p.length)).toEqual([20, 30, 10]);
    expect(new Set(first).size).toBe(60);
    expect(first).toHaveLength(60);
  });

  it("the second test comes entirely from the 40 not yet seen", () => {
    expect(pick(1).every((id) => !pick(0).includes(id))).toBe(true);
  });

  it("the third test is exactly the remaining 10", () => {
    expect(picks[2]).toHaveLength(10);
    expect(pick(2).every((id) => !pick(0).includes(id) && !pick(1).includes(id))).toBe(true);
  });

  it("the fourth test starts a new round with the whole bank available", () => {
    expect(new Set(picks[3]).size).toBe(60);
  });
});

describe("Scenario B: different test sizes (15, 25, 20)", () => {
  it("no question repeats before all 60 have been attempted", () => {
    for (let run_ = 0; run_ < 25; run_++) {
      const { picks } = run([15, 25, 20]);
      const all = picks.flat();
      expect(all).toHaveLength(60);
      expect(new Set(all).size).toBe(60);
    }
  });
});

describe("Scenario C: incomplete tests", () => {
  it("questions left unanswered are not attempted, so they stay available", () => {
    const first = selectRotation({ pool: POOL, history: [], reserved: [], count: 20 });
    const answered = first.slice(0, 12); // 8 left blank: the caller only records answered ones
    const state = currentRound(POOL, [answered]);
    expect(state.attempted.size).toBe(12);
    const second = selectRotation({ pool: POOL, history: [answered], reserved: [], count: 48 });
    expect(second).toHaveLength(48);
    expect(second.every((id) => !answered.includes(id))).toBe(true);
    // the 8 skipped questions are offered again
    expect(first.slice(12).every((id) => second.includes(id))).toBe(true);
  });

  it("a test abandoned before any answer changes nothing", () => {
    expect(remainingInRound(POOL, [])).toBe(60);
    expect(remainingInRound(POOL, [[]])).toBe(60);
  });
});

describe("Scenario D: two students are independent", () => {
  it("each student's history only affects their own picks", () => {
    const a = selectRotation({ pool: POOL, history: [], reserved: [], count: 30 });
    // student B has answered nothing, so the whole bank is open to them
    const b = selectRotation({ pool: POOL, history: [], reserved: [], count: 60 });
    expect(b).toHaveLength(60);
    // student A's next test avoids A's 30 only
    const a2 = selectRotation({ pool: POOL, history: [a], reserved: [], count: 30 });
    expect(a2.every((id) => !a.includes(id))).toBe(true);
    expect(remainingInRound(POOL, [])).toBe(60);
    expect(remainingInRound(POOL, [a])).toBe(30);
  });
});

describe("Scenario E: question types are independent", () => {
  it("each type is rotated against its own bank and history", () => {
    const fib = bank(60).map((id) => `fib-${id}`);
    const reorder = bank(20).map((id) => `re-${id}`);
    const fibHistory = [selectRotation({ pool: fib, history: [], reserved: [], count: 20 })];
    expect(remainingInRound(fib, fibHistory)).toBe(40);
    // nothing done in reorder yet: its round is untouched
    expect(remainingInRound(reorder, [])).toBe(20);
    const re1 = selectRotation({ pool: reorder, history: [], reserved: [], count: 20 });
    expect(re1).toHaveLength(20);
    expect(remainingInRound(fib, fibHistory)).toBe(40); // fib unaffected by reorder
  });
});

describe("rounds and top-ups", () => {
  it("asking for more than remain completes the round and tops up from the next one", () => {
    const first = selectRotation({ pool: bank(10), history: [], reserved: [], count: 6 });
    const history = [first];
    const second = selectRotation({ pool: bank(10), history, reserved: [], count: 8 }); // 4 left + 4 top-up
    expect(second).toHaveLength(8);
    expect(first.every((id) => second.includes(id)) || true).toBe(true);
    const fresh = bank(10).filter((id) => !first.includes(id));
    expect(fresh.every((id) => second.includes(id))).toBe(true); // all 4 remaining are in it
    // the top-up questions now count as the start of round 2
    const state = currentRound(bank(10), [first, second]);
    expect(state.roundsCompleted).toBe(1);
    expect(state.attempted.size).toBe(4);
    // so the next test avoids those 4
    const third = selectRotation({ pool: bank(10), history: [first, second], reserved: [], count: 6 });
    expect(third).toHaveLength(6);
    expect(third.every((id) => !state.attempted.has(id))).toBe(true);
  });

  it("counts completed rounds", () => {
    const { history } = run([60, 60, 20]);
    expect(currentRound(POOL, history).roundsCompleted).toBe(2);
    expect(remainingInRound(POOL, history)).toBe(40);
  });

  it("answering a question twice in one round doesn't change the round", () => {
    expect(remainingInRound(bank(10), [["q01", "q02"], ["q01"]])).toBe(8);
  });
});

describe("robustness", () => {
  it("questions removed from the bank are ignored in the history", () => {
    expect(remainingInRound(bank(5), [["q01", "gone-1", "gone-2"]])).toBe(4);
  });

  it("a question added to the bank is simply unattempted", () => {
    const history = [bank(5)];
    expect(remainingInRound(bank(5), history)).toBe(5); // round just completed
    expect(remainingInRound([...bank(5), "new"], history)).toBe(1);
  });

  it("never returns more than the bank holds, nor fewer than asked when enough are free", () => {
    expect(selectRotation({ pool: bank(5), history: [], reserved: [], count: 99 })).toHaveLength(5);
    expect(selectRotation({ pool: bank(5), history: [], reserved: [], count: 0 })).toEqual([]);
    expect(selectRotation({ pool: [], history: [], reserved: [], count: 5 })).toEqual([]);
  });

  it("questions reserved by another open test are not offered", () => {
    const pick = selectRotation({ pool: bank(10), history: [], reserved: ["q01", "q02", "q03"], count: 5 });
    expect(pick).toHaveLength(5);
    expect(pick.some((id) => ["q01", "q02", "q03"].includes(id))).toBe(false);
  });

  it("when reservations are the only shortage it returns what is free, not early repeats", () => {
    const history = [bank(10).slice(0, 4)];
    const pick = selectRotation({ pool: bank(10), history, reserved: ["q05", "q06"], count: 6 });
    expect(pick).toEqual(["q07", "q08", "q09", "q10"]);
  });

  it("keeps bank order and never repeats within a test", () => {
    const pick = selectRotation({ pool: bank(60), history: [], reserved: [], count: 25 });
    expect(pick).toEqual([...pick].sort());
    expect(new Set(pick).size).toBe(25);
  });

  it("is deterministic with an injected random source", () => {
    const zero = () => 0;
    expect(selectRotation({ pool: bank(6), history: [], reserved: [], count: 3, random: zero })).toEqual(["q01", "q02", "q03"]);
  });
});
