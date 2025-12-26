import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildMissingRelatedQuery } from "@/lib/reporting";

const reportSchema = z.object({
  reportType: z.enum(["missing_related"]),
  params: z.object({
    relationshipId: z.number().int().positive(),
    limit: z.number().int().positive().max(1000).optional(),
  }),
});

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

    return Response.json({
      reportType: payload.reportType,
      rows,
      summary: {
        count: rows.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid report payload", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Failed to run report", error);
    return Response.json({ error: "Failed to run report" }, { status: 500 });
  }
}
