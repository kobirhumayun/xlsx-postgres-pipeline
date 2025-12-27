import { z } from "zod";
import { prisma } from "@/lib/db";

const relationshipSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  leftDatasetId: z.number().int().positive(),
  rightDatasetId: z.number().int().positive(),
  joinMapping: z.record(z.string(), z.string()).default({}),
});

export async function GET() {
  const relationships = await prisma.relationship.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      leftDataset: true,
      rightDataset: true,
    },
  });
  return Response.json({ relationships });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = relationshipSchema.parse(body);
    const relationship = await prisma.relationship.create({
      data: {
        name: payload.name,
        leftDatasetId: payload.leftDatasetId,
        rightDatasetId: payload.rightDatasetId,
        joinMapping: payload.joinMapping,
      },
      include: {
        leftDataset: true,
        rightDataset: true,
      },
    });
    return Response.json({ relationship }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid relationship payload", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Failed to save relationship", error);
    return Response.json(
      { error: "Failed to save relationship" },
      { status: 500 }
    );
  }
}
