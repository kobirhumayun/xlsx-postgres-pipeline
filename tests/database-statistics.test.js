import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshTableStatistics } from "@/lib/database-statistics.js";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function clientWith(query = async () => ({ rows: [] })) {
  return Object.assign(new EventEmitter(), { query: vi.fn(query) });
}

describe("post-import statistics maintenance", () => {
  it("analyzes the quoted target with transaction-local limits and commits", async () => {
    const client = clientWith();
    expect(await refreshTableStatistics(client, 's"c', 't"b')).toBeNull();
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN", "SET LOCAL statement_timeout = '30s'", "SET LOCAL lock_timeout = '5s'",
      'ANALYZE "s""c"."t""b"', "COMMIT",
    ]);
    expect(client.listenerCount("notice")).toBe(0);
  });

  it.each(["57014", "55P03", "42501"])("rolls back maintenance and returns a warning for %s", async (code) => {
    const client = clientWith(async (sql) => {
      if (sql.startsWith("ANALYZE")) throw Object.assign(new Error("Maintenance failed"), { code });
      return { rows: [] };
    });
    expect(await refreshTableStatistics(client, "public", "orders")).toContain("Rows were imported");
    expect(client.query.mock.calls.at(-1)).toEqual(["ROLLBACK"]);
    expect(client.query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(false);
    expect(client.listenerCount("notice")).toBe(0);
  });

  it("surfaces PostgreSQL warnings when ANALYZE skips a table without throwing", async () => {
    const client = clientWith(async (sql) => {
      if (sql.startsWith("ANALYZE")) client.emit("notice", { severity: "WARNING", message: "skipping table: permission denied" });
      return { rows: [] };
    });
    expect(await refreshTableStatistics(client, "public", "orders")).toContain("could not be refreshed");
    expect(client.query.mock.calls.at(-1)).toEqual(["COMMIT"]);
    expect(client.listenerCount("notice")).toBe(0);
  });

  it("keeps an already committed import successful even when the connection is lost", async () => {
    const client = clientWith(async () => { throw new Error("Connection lost"); });
    expect(await refreshTableStatistics(client, "public", "orders")).toContain("Rows were imported");
    expect(client.listenerCount("notice")).toBe(0);
  });
});
