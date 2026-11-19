import { describe, expect, it } from "vitest";

import { fetchPage } from "./fetchPage";

const ITEMS = Array.from({ length: 23 }, (_, i) => i + 1);

function fakes() {
  const offsets: number[] = [];
  return {
    offsets,
    count: async () => ITEMS.length,
    rows: async (offset: number) => {
      offsets.push(offset);
      return ITEMS.slice(offset, offset + 10);
    },
  };
}

describe("fetchPage", () => {
  it("runs the count and the page together and returns the page", async () => {
    const f = fakes();
    const result = await fetchPage(2, 10, f.count, f.rows);
    expect(result.total).toBe(23);
    expect(result.pagination).toEqual({ page: 2, totalPages: 3, offset: 10 });
    expect(result.rows).toEqual(ITEMS.slice(10, 20));
    expect(f.offsets).toEqual([10]); // one page query
  });

  it("starts both queries before either finishes", async () => {
    const started: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = fetchPage(
      1,
      10,
      async () => {
        started.push("count");
        await gate;
        return 5;
      },
      async () => {
        started.push("rows");
        await gate;
        return [1, 2, 3, 4, 5];
      },
    );
    await Promise.resolve();
    expect(started.sort()).toEqual(["count", "rows"]);
    release();
    await pending;
  });

  it("a page past the end is re-read as the last page", async () => {
    const f = fakes();
    const result = await fetchPage(9, 10, f.count, f.rows);
    expect(result.pagination.page).toBe(3);
    expect(result.rows).toEqual([21, 22, 23]);
    expect(f.offsets).toEqual([80, 20]);
  });

  it("no rows at all is one empty page", async () => {
    const result = await fetchPage(1, 10, async () => 0, async () => []);
    expect(result).toEqual({ total: 0, pagination: { page: 1, totalPages: 1, offset: 0 }, rows: [] });
  });

  it("a nonsense page number is page 1", async () => {
    const f = fakes();
    const result = await fetchPage(Number.NaN, 10, f.count, f.rows);
    expect(result.pagination.page).toBe(1);
    expect(f.offsets).toEqual([0]);
  });
});
