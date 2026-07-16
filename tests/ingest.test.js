import { describe, expect, it } from "vitest";
import {
  buildBusinessKey,
  buildNormalizedRow,
  excelDateToISO,
  hashRow,
  parseValue,
  toTrimmedString,
} from "@/lib/ingest.js";

describe("ingest value normalization", () => {
  it.each([
    [null, ""], [undefined, ""], ["  value  ", "value"], [42, "42"],
  ])("trims scalar values", (input, expected) => {
    expect(toTrimmedString(input)).toBe(expected);
  });

  it("converts Excel serial dates and rejects non-numbers", () => {
    expect(excelDateToISO(25569)).toBe("1970-01-01T00:00:00.000Z");
    expect(excelDateToISO("25569")).toBeNull();
    expect(excelDateToISO(Number.NaN)).toBeNull();
  });

  it.each([
    [null, "text", null],
    ["  hello ", "text", "hello"],
    ["$1,234.50", "number", 1234.5],
    [42, "number", 42],
    [" yes ", "boolean", true],
    ["0", "boolean", false],
    [25569, "date", "1970-01-01T00:00:00.000Z"],
    [new Date("2026-01-01T00:00:00Z"), "date", "2026-01-01T00:00:00.000Z"],
  ])("parses %j as %s", (input, type, expected) => {
    expect(parseValue(input, type)).toEqual({ parsedValue: expected, error: null });
  });

  it.each([
    ["abc", "number", "Invalid number value"],
    ["perhaps", "boolean", "Invalid boolean value"],
    ["not-a-date", "date", "Invalid date value"],
  ])("reports invalid typed values", (input, type, error) => {
    expect(parseValue(input, type)).toEqual({ parsedValue: null, error });
  });

  it("builds a composite key only when every component is present", () => {
    expect(buildBusinessKey({ tenant: " acme ", id: 7 }, ["tenant", "id"]))
      .toBe("acme|7");
    expect(buildBusinessKey({ tenant: "", id: 7 }, ["tenant", "id"])).toBeNull();
  });

  it("hashes rows deterministically regardless of key insertion order", () => {
    expect(hashRow({ b: 2, a: 1 })).toBe(hashRow({ a: 1, b: 2 }));
    expect(hashRow({ a: 2 })).not.toBe(hashRow({ a: 1 }));
    expect(hashRow({ a: 1 })).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalizes mapped fields and collects errors by target field", () => {
    expect(buildNormalizedRow(
      { "Invoice Total": "$12.50", Active: "maybe", Note: " ok " },
      {
        "Invoice Total": { field: "total", type: "number" },
        Active: { field: "active", type: "boolean" },
        Note: "note",
      },
    )).toEqual({
      normalized: { total: 12.5, active: null, note: "ok" },
      errors: { active: "Invalid boolean value" },
    });
  });
});
