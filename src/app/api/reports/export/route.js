import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildMissingRelatedQuery } from "@/lib/reporting";
import { PassThrough } from "stream";

const reportSchema = z.object({
  reportType: z.enum(["missing_related"]),
  params: z.object({
    relationshipId: z.number().int().positive(),
    limit: z.number().int().positive().max(5000).optional(),
  }),
});

const writeWorkbook = async (stream, rows) => {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream });
  const worksheet = workbook.addWorksheet("Missing Related");
  worksheet.columns = [
    { header: "Business Key", key: "businessKey", width: 30 },
    { header: "Normalized JSON", key: "normalized", width: 80 },
  ];

  rows.forEach((row) => {
    worksheet
      .addRow({
        businessKey: row.businessKey,
        normalized: JSON.stringify(row.normalized),
      })
      .commit();
  });

  worksheet.commit();
  await workbook.commit();
};

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = reportSchema.parse(body);
    const { relationshipId, limit } = payload.params;

    const relationship = await prisma.relationship.findUnique({
      where: { id: relationshipId },
    });

    if (!relationship) {
      return Response.json(
        { error: "Relationship not found." },
        { status: 404 }
      );
    }

    const { query, error } = buildMissingRelatedQuery(
      relationship,
      limit ?? 200
    );
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    const rows = await prisma.$queryRaw(query);
    const stream = new PassThrough();

    writeWorkbook(stream, rows).catch((err) => {
      console.error("Failed to write report export", err);
      stream.destroy(err);
    });

    return new Response(stream, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          "attachment; filename=missing-related-report.xlsx",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid report payload", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Failed to export report", error);
    return Response.json({ error: "Failed to export report" }, { status: 500 });
  }
}
