import crypto from "crypto";

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

const toTrimmedString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

const normalizeKey = (value) => {
  const trimmed = toTrimmedString(value);
  return trimmed.length ? trimmed : null;
};

const excelDateToISO = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  const milliseconds = EXCEL_EPOCH + value * 24 * 60 * 60 * 1000;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

export const parseValue = (value, type) => {
  if (value === null || value === undefined || value === "") {
    return { parsedValue: null, error: null };
  }

  switch (type) {
    case "date": {
      if (value instanceof Date) {
        return { parsedValue: value.toISOString(), error: null };
      }
      const stringValue = toTrimmedString(value);
      const numeric = Number(stringValue);
      if (!Number.isNaN(numeric) && stringValue !== "") {
        const excelDate = excelDateToISO(numeric);
        if (excelDate) {
          return { parsedValue: excelDate, error: null };
        }
      }
      const parsedDate = new Date(stringValue);
      if (!Number.isNaN(parsedDate.getTime())) {
        return { parsedValue: parsedDate.toISOString(), error: null };
      }
      return { parsedValue: null, error: "Invalid date value" };
    }
    case "number": {
      if (typeof value === "number") {
        return { parsedValue: value, error: null };
      }
      const cleaned = toTrimmedString(value).replace(/[$,]/g, "");
      const parsed = Number(cleaned);
      if (Number.isNaN(parsed)) {
        return { parsedValue: null, error: "Invalid number value" };
      }
      return { parsedValue: parsed, error: null };
    }
    case "boolean": {
      if (typeof value === "boolean") {
        return { parsedValue: value, error: null };
      }
      const normalized = toTrimmedString(value).toLowerCase();
      if (["true", "yes", "1"].includes(normalized)) {
        return { parsedValue: true, error: null };
      }
      if (["false", "no", "0"].includes(normalized)) {
        return { parsedValue: false, error: null };
      }
      return { parsedValue: null, error: "Invalid boolean value" };
    }
    default: {
      const parsedValue = toTrimmedString(value);
      return { parsedValue: parsedValue.length ? parsedValue : null, error: null };
    }
  }
};

export const buildBusinessKey = (row, pkFields) => {
  const values = pkFields.map((field) => normalizeKey(row[field]));
  if (values.some((value) => value === null)) {
    return null;
  }
  return values.join("|");
};

export const hashRow = (row) => {
  const ordered = Object.keys(row)
    .sort()
    .reduce((acc, key) => {
      acc[key] = row[key];
      return acc;
    }, {});
  return crypto.createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
};

export const buildNormalizedRow = (rawRow, mapping) => {
  const normalized = {};
  const errors = {};

  Object.entries(mapping).forEach(([columnName, target]) => {
    const rawValue = rawRow[columnName];
    const targetField =
      typeof target === "string" ? target : target?.field ?? columnName;
    const targetType = typeof target === "string" ? "text" : target?.type ?? "text";
    const { parsedValue, error } = parseValue(rawValue, targetType);
    normalized[targetField] = parsedValue;
    if (error) {
      errors[targetField] = error;
    }
  });

  return { normalized, errors };
};
