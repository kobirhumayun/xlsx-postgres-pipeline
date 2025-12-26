import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

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

    const joinMapping = relationship.joinMapping ?? {};
    const joinEntries = Object.entries(joinMapping);
    if (joinEntries.length === 0) {
      return Response.json(
        { error: "Relationship join mapping is empty." },
        { status: 400 }
      );
    }

    const conditions = joinEntries.map(([leftField, rightField]) =>
      Prisma.sql`(l.normalized ->> ${leftField}) = (r.normalized ->> ${rightField})`
    );

    const query = Prisma.sql`
      SELECT
        l.id,
        l.business_key AS "businessKey",
        l.normalized AS "normalized"
      FROM curated_rows l
      WHERE l.dataset_id = ${relationship.leftDatasetId}
        AND NOT EXISTS (
          SELECT 1
          FROM curated_rows r
          WHERE r.dataset_id = ${relationship.rightDatasetId}
            AND ${Prisma.join(conditions, " AND ")}
        )
      LIMIT ${limit ?? 200};
    `;

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
