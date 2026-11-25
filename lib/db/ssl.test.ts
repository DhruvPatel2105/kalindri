import { describe, expect, it } from "vitest";

import { sslFor } from "./ssl";

describe("sslFor", () => {
  it("encrypts every remote database, including the Supabase poolers", () => {
    expect(sslFor("postgresql://u:p@aws-0-us-west-2.pooler.supabase.com:5432/postgres")).toBe("require");
    expect(sslFor("postgresql://u:p@aws-0-us-west-2.pooler.supabase.com:6543/postgres")).toBe("require");
    expect(sslFor("postgresql://u:p@db.abcdefgh.supabase.co:5432/postgres")).toBe("require");
    expect(sslFor("postgresql://u:p@10.0.0.5:5432/postgres")).toBe("require");
  });

  it("leaves only a database on this same machine unencrypted", () => {
    expect(sslFor("postgresql://u:p@localhost:5432/postgres")).toBe(false);
    expect(sslFor("postgresql://u:p@127.0.0.1:54322/postgres")).toBe(false);
    expect(sslFor("postgresql://u:p@[::1]:5432/postgres")).toBe(false);
    expect(sslFor("postgresql://u:p@db.localhost:5432/postgres")).toBe(false);
  });

  it("does not treat a lookalike remote host as local", () => {
    expect(sslFor("postgresql://u:p@localhost.evil.com:5432/postgres")).toBe("require");
    expect(sslFor("postgresql://u:p@127.0.0.1.evil.com:5432/postgres")).toBe("require");
  });
});
