import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "@/lib/api-client.js";

afterEach(() => vi.unstubAllGlobals());

function response(body, init = {}) {
  return new Response(body, init);
}

describe("fetchJson", () => {
  it("adds JSON content type and returns a parsed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('{"ok":true}', {
      headers: { "content-type": "application/json; charset=utf-8" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("/api/test", { method: "POST", headers: { "x-id": "1" } }))
      .resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/test", expect.objectContaining({
      headers: { "Content-Type": "application/json", "x-id": "1" },
    }));
  });

  it("does not set a multipart boundary for FormData", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('{"ok":true}', {
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const body = new FormData();

    await fetchJson("/api/upload", { method: "POST", body });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("Content-Type");
  });

  it("returns null for an empty 204 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(null, { status: 204 })));
    await expect(fetchJson("/api/empty")).resolves.toBeNull();
  });

  it("rejects a successful non-JSON response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("ok", {
      headers: { "content-type": "text/plain" },
    })));
    await expect(fetchJson("/api/test")).rejects.toThrow("expected JSON");
  });

  it("preserves a JSON API error payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response('{"error":"No access","code":"DENIED"}', {
      status: 403,
      headers: { "content-type": "application/json" },
    })));

    await expect(fetchJson("/api/test")).rejects.toMatchObject({
      message: "No access",
      payload: { error: "No access", code: "DENIED" },
    });
  });

  it("uses status details for non-JSON failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("not found", {
      status: 404,
      statusText: "Not Found",
      headers: { "content-type": "text/html" },
    })));
    await expect(fetchJson("/missing")).rejects.toThrow("API Error: 404 Not Found");
  });
});
