import { describe, expect, it } from "vitest";
import {
  parseSavedQuerySqlFile,
  savedQueryFileName,
  toSavedQuerySqlFile,
} from "@/lib/saved-query-files.js";

describe("saved query SQL files", () => {
  it("round-trips versioned metadata and sanitizes single-line values", () => {
    const content = toSavedQuerySqlFile({
      name: " Customer\nSummary ",
      databaseName: " reporting ",
      description: "Customer   totals.\r\nDaily.",
      query: "SELECT 1;\n\n",
    });

    expect(content).toMatch(
      /^-- xpp:name: Customer Summary\n-- xpp:version: 1\n-- xpp:databaseName: reporting\n-- xpp:description: Customer totals\. Daily\./,
    );
    expect(parseSavedQuerySqlFile(content, "ignored.sql", { requireMetadata: true })).toEqual({
      name: "Customer Summary",
      databaseName: "reporting",
      description: "Customer totals. Daily.",
      query: "SELECT 1;",
    });
  });

  it.each([
    ["-- xpp:name: Example\nSELECT 1;", "Missing required metadata: version"],
    ["-- xpp:name: Example\n-- xpp:version: 2\nSELECT 1;", "Unsupported xpp file version: 2"],
    ["-- xpp:name: Example\n-- xpp:version: 1\n", "SQL query body is empty"],
  ])("rejects an invalid versioned file", (content, message) => {
    expect(() => parseSavedQuerySqlFile(content, "example.sql", { requireMetadata: true }))
      .toThrow(message);
  });

  it("normalizes line endings and derives a readable name for legacy files", () => {
    expect(parseSavedQuerySqlFile("\r\nSELECT *\rFROM example;\r", "daily_report.sql")).toEqual({
      name: "Daily Report",
      databaseName: null,
      description: null,
      query: "SELECT *\nFROM example;",
    });
  });

  it("rejects a nameless query when no usable filename exists", () => {
    expect(() => parseSavedQuerySqlFile("SELECT 1;", ".sql")).toThrow(
      "Query name is required",
    );
  });

  it("creates safe, case-insensitively unique filenames", () => {
    const used = new Set(["sales-summary.sql"]);
    expect(savedQueryFileName({ name: "Sales Summary" }, used)).toBe("sales-summary-2.sql");
    expect(savedQueryFileName({ name: "💾" }, used)).toBe("saved-query.sql");
    expect([...used]).toEqual(["sales-summary.sql", "sales-summary-2.sql", "saved-query.sql"]);
  });
});
