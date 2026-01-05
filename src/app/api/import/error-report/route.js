import ExcelJS from "exceljs";
import { z } from "zod";

const payloadSchema = z.object({
  headers: z.array(z.string()).optional(),
  errors: z.array(
    z.object({
      rowNumber: z.number(),
      error: z.string().optional().nullable(),
      values: z.array(z.any()).optional(),
    })
  ),
  format: z.enum(["csv", "xlsx"]).optional(),
});

const sanitizeValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    if ("text" in value && value.text) return String(value.text);
    if ("result" in value && value.result) return String(value.result);
    return JSON.stringify(value);
  }
  return String(value);
};

const toCsvValue = (value) => {
  const text = sanitizeValue(value);
  if (text.includes(",") || text.includes("\n") || text.includes("\r") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export async function POST(request) {
  const payload = await request.json();
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { headers = [], errors, format = "xlsx" } = parsed.data;
  const reportHeaders = ["rowNumber", ...headers, "error"];

  if (format === "csv") {
    const lines = [];
    lines.push(reportHeaders.map(toCsvValue).join(","));
    for (const item of errors) {
      const values = item.values ?? [];
      const row = [item.rowNumber, ...values, item.error ?? ""];
      lines.push(row.map(toCsvValue).join(","));
    }

    return new Response(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=import-error-report.csv",
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Import Errors");
  worksheet.addRow(reportHeaders);

  for (const item of errors) {
    const values = item.values ?? [];
    worksheet.addRow([item.rowNumber, ...values, item.error ?? ""]);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=import-error-report.xlsx",
    },
  });
}
