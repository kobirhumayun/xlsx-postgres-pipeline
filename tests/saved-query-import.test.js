import { describe, expect, it } from "vitest";
import {
  expandSavedQueryImportFiles,
  normalizeImportMode,
  planSavedQueryImport,
  summarizeOperations,
} from "@/lib/saved-query-import.js";
import { toSavedQuerySqlFile } from "@/lib/saved-query-files.js";
import { createZip } from "@/lib/zip.js";

function sqlFile(name, databaseName = "reporting", filename = `${name}.sql`) {
  return {
    name: filename,
    text: async () => toSavedQuerySqlFile({
      name,
      databaseName,
      description: `${name} description`,
      query: "SELECT 1;",
    }),
  };
}

describe("saved query import planning", () => {
  it.each([
    ["upsert", "upsert"], ["create", "create"], ["copy", "copy"],
    ["replace", "replace"], ["unknown", "upsert"], [undefined, "upsert"],
  ])("normalizes import mode %s", (input, expected) => {
    expect(normalizeImportMode(input)).toBe(expected);
  });

  it("upserts using case-insensitive database and query identity", async () => {
    const plan = await planSavedQueryImport(
      [sqlFile("Daily Summary", " SALES "), sqlFile("New Query", "sales")],
      [{ id: "existing", name: "daily summary", databaseName: "sales" }],
    );

    expect(plan.summary).toEqual({ created: 1, updated: 1, skipped: 0, errors: 0 });
    expect(plan.operations[0]).toMatchObject({ action: "updated", existingId: "existing" });
    expect(plan.operations[1]).toMatchObject({ action: "created" });
  });

  it("create mode skips existing and duplicate input identities", async () => {
    const plan = await planSavedQueryImport(
      [sqlFile("Existing"), sqlFile("Fresh"), sqlFile("fresh", "REPORTING")],
      [{ id: "1", name: "existing", databaseName: "reporting" }],
      "create",
    );

    expect(plan.operations.map(({ action }) => action)).toEqual(["skipped", "created", "skipped"]);
    expect(plan.summary).toEqual({ created: 1, updated: 0, skipped: 2, errors: 0 });
  });

  it("copy mode assigns stable numeric suffixes without cross-database conflicts", async () => {
    const plan = await planSavedQueryImport(
      [sqlFile("Summary", "sales"), sqlFile("Summary", "sales"), sqlFile("Summary", "warehouse")],
      [
        { id: "1", name: "Summary", databaseName: "sales" },
        { id: "2", name: "Summary (2)", databaseName: "sales" },
      ],
      "copy",
    );

    expect(plan.operations.map(({ name }) => name)).toEqual([
      "Summary (3)", "Summary (4)", "Summary",
    ]);
  });

  it("replace mode limits deletion scope to valid imported databases", async () => {
    const plan = await planSavedQueryImport(
      [sqlFile("Replacement", " Sales "), sqlFile("Bad", "reporting", "bad.txt")],
      [
        { id: "1", name: "Old Sales", databaseName: "sales" },
        { id: "2", name: "Old Reporting", databaseName: "reporting" },
      ],
      "replace",
    );

    expect(plan.replaceDatabaseNames).toEqual(["Sales"]);
    expect(plan.replaceCount).toBe(1);
    expect(plan.summary.errors).toBe(1);
  });

  it("records file and parse errors without aborting the plan", async () => {
    const plan = await planSavedQueryImport([
      { name: "archive.zip", importError: "broken archive" },
      { name: "notes.txt", text: async () => "SELECT 1" },
      { name: "empty.sql", text: async () => "-- xpp:name: Empty\n-- xpp:version: 1" },
    ], []);

    expect(plan.summary.errors).toBe(3);
    expect(plan.operations.map(({ error }) => error)).toEqual([
      "broken archive",
      "Only .sql files can be imported.",
      "SQL query body is empty.",
    ]);
  });

  it("summarizes only known operation actions", () => {
    expect(summarizeOperations([
      { action: "created" }, { action: "updated" }, { action: "skipped" },
      { action: "error" }, { action: "ignored" },
    ])).toEqual({ created: 1, updated: 1, skipped: 1, errors: 1 });
  });
});

describe("saved query archive expansion", () => {
  it("keeps plain files and reads only queries/**/*.sql from ZIP files", async () => {
    const archive = createZip([
      { name: "queries/reporting/valid.sql", data: "SELECT 1;" },
      { name: "schema/tables/not-a-query.sql", data: "CREATE TABLE example();" },
      { name: "queries/README.md", data: "notes" },
    ]);
    const plain = sqlFile("Plain");
    const expanded = await expandSavedQueryImportFiles([
      plain,
      { name: "repository.ZIP", arrayBuffer: async () => archive },
    ]);

    expect(expanded[0]).toBe(plain);
    expect(expanded.map(({ name }) => name)).toEqual([
      "Plain.sql", "queries/reporting/valid.sql",
    ]);
    await expect(expanded[1].text()).resolves.toBe("SELECT 1;");
  });

  it.each([
    [createZip([{ name: "schema/example.sql", data: "SELECT 1" }]), "does not contain"],
    [new Uint8Array([1, 2, 3]), "invalid or unsupported"],
  ])("turns an unusable ZIP into an import error", async (archive, message) => {
    const [file] = await expandSavedQueryImportFiles([{
      name: "queries.zip",
      arrayBuffer: async () => archive,
    }]);
    expect(file.importError).toContain(message);
  });
});
