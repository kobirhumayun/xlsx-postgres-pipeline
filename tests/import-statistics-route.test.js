import ExcelJS from "exceljs";
import { unzipSync, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), release: vi.fn(), connect: vi.fn(), refresh: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getDbPool: () => ({ connect: mocks.connect }) }));
vi.mock("@/lib/database-statistics", () => ({ refreshTableStatistics: mocks.refresh }));
import { POST } from "@/app/api/import/flexible/route.js";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
  mocks.query.mockImplementation(async (sql) => ({
    rows: sql.includes("information_schema.columns")
      ? [{ name: "value", data_type: "text", is_nullable: "YES", column_default: null }]
      : [],
  }));
  mocks.refresh.mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

async function request(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Data").addRows(rows);
  // Put workbook metadata before worksheets for the streaming reader.
  const entries = unzipSync(new Uint8Array(await workbook.xlsx.writeBuffer()));
  const ordered = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => {
    const priority = (name) => name === "xl/workbook.xml" ? 0 : name.startsWith("xl/worksheets/") ? 2 : 1;
    return priority(a) - priority(b);
  }));
  const form = new FormData();
  form.append("tableName", "public.import_target");
  form.append("file", new Blob([zipSync(ordered)]), "input.xlsx");
  return new Request("http://localhost/api/import/flexible", { method: "POST", body: form });
}

describe("import statistics lifecycle", () => {
  it("refreshes only after the imported rows have committed", async () => {
    mocks.refresh.mockImplementation(async (_client, schema, table) => {
      expect(mocks.query.mock.calls.at(-1)).toEqual(["COMMIT"]);
      expect([schema, table]).toEqual(["public", "import_target"]);
      return null;
    });
    const response = await POST(await request([["value"], ["one"], ["two"]]));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ summary: { okRows: 2 }, warnings: [] });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("returns success with a warning when maintenance fails after import", async () => {
    mocks.refresh.mockResolvedValue("Rows were imported, but statistics could not be refreshed.");
    const response = await POST(await request([["value"], ["one"]]));
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toMatchObject({ summary: { okRows: 1 }, warnings: [expect.stringContaining("Rows were imported")] });
    expect(mocks.query.mock.calls.some(([sql]) => sql === "ROLLBACK")).toBe(false);
  });

  it("does not analyze an empty import", async () => {
    const response = await POST(await request([["value"]]));
    expect(response.status).toBe(200);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("does not analyze when the import commit fails", async () => {
    const original = mocks.query.getMockImplementation();
    mocks.query.mockImplementation(async (sql, params) => {
      if (sql === "COMMIT") throw new Error("Commit failed");
      return original(sql, params);
    });
    const response = await POST(await request([["value"], ["one"]]));
    expect(response.status).toBe(500);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls.at(-1)).toEqual(["ROLLBACK"]);
  });
});
