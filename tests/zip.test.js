import { describe, expect, it } from "vitest";
import { createZip, createZipStream, readZipTextFiles } from "@/lib/zip.js";

describe("ZIP utilities", () => {
  it("round-trips text and binary input while applying a predicate", () => {
    const archive = createZip([
      { name: "queries/one.sql", data: "SELECT 1;" },
      { name: "ignored.bin", data: new Uint8Array([65, 66]) },
    ]);

    expect(readZipTextFiles(archive, (name) => name.endsWith(".sql"))).toEqual([
      { name: "queries/one.sql", text: "SELECT 1;" },
    ]);
  });

  it("streams a compressed readable archive", async () => {
    const body = "SELECT 1;\n".repeat(200);
    const archive = new Uint8Array(await new Response(createZipStream([
      { name: "queries/example.sql", data: body },
    ])).arrayBuffer());

    expect(readZipTextFiles(archive)).toEqual([
      { name: "queries/example.sql", text: body },
    ]);
    expect(archive.byteLength).toBeLessThan(body.length);
  });

  it("rejects malformed and oversized compressed input", () => {
    expect(() => readZipTextFiles(new Uint8Array([1, 2, 3]))).toThrow("invalid or unsupported");
    expect(() => readZipTextFiles(new Uint8Array(25 * 1024 * 1024 + 1))).toThrow("25 MB");
  });
});
