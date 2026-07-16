import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ cursorRows: [], cursorClosed: 0 }));
const db = vi.hoisted(() => ({
  applyQueryTimeout: vi.fn(),
  getDbPool: vi.fn(),
  getQueryPreviewLimit: vi.fn(),
  resetQueryTimeout: vi.fn(),
}));

vi.mock("@/lib/db", () => db);
vi.mock("pg-cursor", () => ({
  default: class Cursor {
    constructor(query) {
      this.query = query;
    }

    read(_count, callback) {
      callback(null, state.cursorRows);
    }

    close(callback) {
      state.cursorClosed += 1;
      callback();
    }
  },
}));

import { POST } from "@/app/api/query/run/route.js";

let client;

beforeEach(() => {
  Object.values(db).forEach((mock) => mock.mockReset());
  state.cursorRows = [];
  state.cursorClosed = 0;
  client = { query: vi.fn(), release: vi.fn() };
  db.getDbPool.mockReturnValue({ connect: vi.fn().mockResolvedValue(client) });
  db.getQueryPreviewLimit.mockReturnValue(2);
  db.applyQueryTimeout.mockResolvedValue(undefined);
  db.resetQueryTimeout.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function request(body) {
  return new Request("http://localhost/api/query/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function result(response) {
  return { status: response.status, body: await response.json() };
}

describe("query run API", () => {
  it("rejects an empty query without connecting", async () => {
    const response = await result(await POST(request({ query: "" })));
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid request");
    expect(db.getDbPool).not.toHaveBeenCalled();
  });

  it("returns a limited SELECT preview and closes resources", async () => {
    state.cursorRows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    client.query.mockImplementation((input) => input);

    const response = await result(await POST(request({
      query: "  SELECT id FROM example",
      databaseName: "reporting",
    })));

    expect(response).toEqual({
      status: 200,
      body: {
        rows: [{ id: 1 }, { id: 2 }],
        rowCount: 2,
        fields: ["id"],
        limitReached: true,
        command: "SELECT",
      },
    });
    expect(db.getDbPool).toHaveBeenCalledWith("reporting");
    expect(db.applyQueryTimeout).toHaveBeenCalledWith(client);
    expect(state.cursorClosed).toBe(1);
    expect(db.resetQueryTimeout).toHaveBeenCalledWith(client);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("fetches field metadata for an empty CTE result", async () => {
    client.query.mockImplementation((input) => {
      if (typeof input === "string") return Promise.resolve({ fields: [{ name: "total" }] });
      return input;
    });

    const response = await result(await POST(request({ query: "WITH data AS (SELECT 1) SELECT * FROM data WHERE false" })));
    expect(response.body).toMatchObject({ rows: [], fields: ["total"], limitReached: false });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("AS meta_fetch_wrapper LIMIT 0"));
  });

  it("executes DDL and DML directly and reports affected rows", async () => {
    client.query.mockResolvedValue({
      rows: [], rowCount: 3, fields: [], command: "UPDATE",
    });
    const response = await result(await POST(request({ query: "UPDATE example SET active = true" })));
    expect(response.body).toMatchObject({
      rowCount: 3,
      command: "UPDATE",
      message: "Success. 3 row(s) affected.",
      limitReached: false,
    });
  });

  it("returns a stable failure response and still resets the connection", async () => {
    client.query.mockRejectedValue(new Error("syntax error"));
    const response = await result(await POST(request({ query: "BROKEN SQL" })));
    expect(response).toEqual({
      status: 500,
      body: { error: "Query failed", details: "syntax error" },
    });
    expect(db.resetQueryTimeout).toHaveBeenCalledWith(client);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
