import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { savedQuery: db } }));

import { DELETE, GET, POST, PUT } from "@/app/api/saved-queries/route.js";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  Object.values(db).forEach((mock) => mock.mockReset());
});

async function payload(response) {
  return { status: response.status, body: await response.json() };
}

describe("saved queries API", () => {
  it("lists saved queries in update order", async () => {
    db.findMany.mockResolvedValue([{ id: "1", name: "Report" }]);
    await expect(payload(await GET())).resolves.toEqual({
      status: 200,
      body: [{ id: "1", name: "Report" }],
    });
    expect(db.findMany).toHaveBeenCalledWith({ orderBy: { updatedAt: "desc" } });
  });

  it("validates required create fields before accessing the database", async () => {
    const response = await POST(new Request("http://localhost/api/saved-queries", {
      method: "POST",
      body: JSON.stringify({ name: "", query: "" }),
    }));
    expect(await payload(response)).toEqual({
      status: 400,
      body: { error: "Name and query are required" },
    });
    expect(db.findFirst).not.toHaveBeenCalled();
  });

  it("normalizes a database name and creates a query", async () => {
    db.findFirst.mockResolvedValue(null);
    db.create.mockImplementation(async ({ data }) => ({ id: "1", ...data }));
    const response = await POST(new Request("http://localhost/api/saved-queries", {
      method: "POST",
      body: JSON.stringify({
        name: " Report ", description: "desc", query: "SELECT 1", databaseName: " reporting ",
      }),
    }));

    expect((await payload(response)).status).toBe(200);
    expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        name: { equals: "Report", mode: "insensitive" },
        OR: [{ databaseName: "reporting" }],
      }),
    }));
    expect(db.create).toHaveBeenCalledWith({
      data: { name: "Report", description: "desc", query: "SELECT 1", databaseName: "reporting" },
    });
  });

  it("rejects a duplicate within the same database", async () => {
    db.findFirst.mockResolvedValue({ id: "existing" });
    const response = await POST(new Request("http://localhost/api/saved-queries", {
      method: "POST",
      body: JSON.stringify({ name: "Report", query: "SELECT 1", databaseName: "reporting" }),
    }));
    expect((await payload(response)).status).toBe(409);
    expect(db.create).not.toHaveBeenCalled();
  });

  it("requires update identity and content", async () => {
    const missingId = await PUT(new Request("http://localhost/api/saved-queries", {
      method: "PUT", body: JSON.stringify({ name: "Report", query: "SELECT 1" }),
    }));
    expect((await payload(missingId)).status).toBe(400);

    const missingContent = await PUT(new Request("http://localhost/api/saved-queries", {
      method: "PUT", body: JSON.stringify({ id: "1", name: "Report" }),
    }));
    expect((await payload(missingContent)).status).toBe(400);
  });

  it("updates while excluding its own id from duplicate detection", async () => {
    db.findFirst.mockResolvedValue(null);
    db.update.mockResolvedValue({ id: "1", name: "Report" });
    const response = await PUT(new Request("http://localhost/api/saved-queries", {
      method: "PUT",
      body: JSON.stringify({ id: "1", name: "Report", query: "SELECT 1", databaseName: "" }),
    }));

    expect((await payload(response)).status).toBe(200);
    expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { not: "1" },
        OR: [{ databaseName: null }, { databaseName: "" }],
      }),
    }));
  });

  it("requires an id for deletion and deletes a provided id", async () => {
    const missing = await DELETE(new Request("http://localhost/api/saved-queries"));
    expect((await payload(missing)).status).toBe(400);

    db.delete.mockResolvedValue({ id: "1" });
    const response = await DELETE(new Request("http://localhost/api/saved-queries?id=1"));
    expect(await payload(response)).toEqual({ status: 200, body: { success: true } });
    expect(db.delete).toHaveBeenCalledWith({ where: { id: "1" } });
  });

  it("returns a stable error contract when persistence fails", async () => {
    db.findMany.mockRejectedValue(new Error("database unavailable"));
    expect(await payload(await GET())).toEqual({
      status: 500,
      body: { error: "Failed to fetch saved queries" },
    });
  });
});
