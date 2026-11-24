import { describe, expect, it } from "vitest";

import { formatClock } from "./clock";

describe("formatClock", () => {
  it("shows minutes and seconds, adding hours past one hour", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(725)).toBe("12:05");
    expect(formatClock(3729)).toBe("1:02:09");
  });
  it("treats bad input as zero", () => {
    expect(formatClock(-4)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });
});
