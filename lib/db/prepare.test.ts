import { describe, expect, it } from "vitest";

import { shouldPrepare } from "./prepare";

const SESSION = "postgresql://u:p@aws-0-us-west-2.pooler.supabase.com:5432/postgres";
const TRANSACTION = "postgresql://u:p@aws-0-us-west-2.pooler.supabase.com:6543/postgres";

describe("shouldPrepare", () => {
  it("auto: on for the session pooler and direct connections", () => {
    expect(shouldPrepare(SESSION, "auto")).toBe(true);
    expect(shouldPrepare("postgresql://u:p@db.example.supabase.co:5432/postgres", "auto")).toBe(true);
  });

  it("auto: OFF for the transaction pooler (6543), where prepared statements return wrong results", () => {
    expect(shouldPrepare(TRANSACTION, "auto")).toBe(false);
  });

  it("false always turns them off", () => {
    expect(shouldPrepare(SESSION, "false")).toBe(false);
    expect(shouldPrepare(TRANSACTION, "false")).toBe(false);
  });

  it("explicitly forcing them on for 6543 is refused rather than silently corrupting results", () => {
    expect(() => shouldPrepare(TRANSACTION, "true")).toThrow(/unsafe/);
    expect(shouldPrepare(SESSION, "true")).toBe(true);
  });
});
