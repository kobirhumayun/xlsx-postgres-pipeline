import { Readable } from "stream";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

const normalizeCell = (val, sharedStrings) => {
  if (!val) return "";
  if (typeof val === "object") {
    if (val.text) return val.text;
    if (val.result) return val.result;

    if (val.sharedString !== undefined) {
      if (sharedStrings && sharedStrings[val.sharedString]) {
        return String(sharedStrings[val.sharedString]);
      }
    }

    return JSON.stringify(val);
  }
  return String(val);
};

const extractHeadersFromRow = (row, sharedStrings) => {
  const rawValues = Array.isArray(row.values) ? row.values : [];
  if (rawValues.length > 1) {
    return rawValues
      .slice(1)
      .map(value => normalizeCell(value, sharedStrings).trim())
      .filter(Boolean);
  }

  if (row.cellCount > 0) {
    const extracted = [];
    for (let i = 1; i <= row.cellCount; i += 1) {
      extracted.push(normalizeCell(row.getCell(i).value, sharedStrings).trim());
    }
    return extracted.filter(Boolean);
  }

  return [];
};

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const sheetName = formData.get("sheetName") || undefined;

  if (!file) {
    return Response.json({ error: "File is required." }, { status: 400 });
  }

  const nodeStream = Readable.fromWeb(file.stream());
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(nodeStream, {
    worksheets: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
  });

  let headers = [];
  let worksheetFound = false;

  for await (const worksheetReader of workbookReader) {
    if (sheetName && worksheetReader.name !== sheetName) {
      continue;
    }

    worksheetFound = true;

    for await (const row of worksheetReader) {
      if (row.number !== 1) continue;
      headers = extractHeadersFromRow(row, workbookReader.sharedStrings);
      break;
    }

    break;
  }

  if (!worksheetFound) {
    return Response.json({ error: "Worksheet not found." }, { status: 400 });
  }

  if (!headers.length) {
    return Response.json({ error: "Header row is empty or invalid." }, { status: 400 });
  }

  return Response.json({ headers });
}
