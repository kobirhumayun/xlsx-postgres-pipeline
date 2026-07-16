import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route.js";

describe("health API", () => {
  it("returns an OK status and valid timestamp", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});
