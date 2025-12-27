import { z } from "zod";
import { prisma } from "@/lib/db";

const datasetSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, or dashes"),
  name: z.string().trim().min(2, "Name is required"),
  defaultSheetName: z.string().trim().optional().nullable(),
  pkFields: z.array(z.string().trim().min(1)).default([]),
  mapping: z.record(z.string(), z.any()).default({}),
});

export async function GET() {
  const datasets = await prisma.dataset.findMany({
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ datasets });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = datasetSchema.parse(body);
    const dataset = await prisma.dataset.upsert({
      where: { slug: payload.slug },
      update: {
        name: payload.name,
        defaultSheetName: payload.defaultSheetName ?? null,
        pkFields: payload.pkFields,
        mapping: payload.mapping,
      },
      create: {
        slug: payload.slug,
        name: payload.name,
        defaultSheetName: payload.defaultSheetName ?? null,
        pkFields: payload.pkFields,
        mapping: payload.mapping,
      },
    });
    return Response.json({ dataset }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid dataset payload", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Failed to save dataset", error);
    return Response.json(
      { error: "Failed to save dataset" },
      { status: 500 }
    );
  }
}
