import { getDbPool, prisma } from "@/lib/db";
import { collectDatabaseSchema } from "@/lib/schema-export";
import { repositoryBundleFiles } from "@/lib/repository-bundle";
import { createZipStream } from "@/lib/zip";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const repositoryExportSchema = z.object({
    databaseName: z.string().trim().min(1),
    schemas: z.array(z.string().trim().min(1)).optional(),
    includeRowCounts: z.boolean().optional(),
    includeIndexes: z.boolean().optional(),
    includeConstraints: z.boolean().optional(),
    includeViews: z.boolean().optional(),
    includeUnassignedQueries: z.boolean().optional(),
});

export async function POST(request) {
    let client;

    try {
        const body = await request.json().catch(() => ({}));
        const parsed = repositoryExportSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const options = parsed.data;
        const includeUnassignedQueries = options.includeUnassignedQueries !== false;
        const pool = getDbPool(options.databaseName);
        client = await pool.connect();

        const [schema, savedQueries] = await Promise.all([
            collectDatabaseSchema(client, options),
            prisma.savedQuery.findMany({
                where: includeUnassignedQueries
                    ? {
                        OR: [
                            { databaseName: options.databaseName },
                            { databaseName: null },
                            { databaseName: "" },
                        ],
                    }
                    : { databaseName: options.databaseName },
                orderBy: [{ name: "asc" }, { updatedAt: "desc" }],
            }),
        ]);
        const generatedAt = new Date();
        const { files } = repositoryBundleFiles(schema, savedQueries, generatedAt, {
            includeUnassignedQueries,
        });
        const zip = createZipStream(files);
        const filename = `${safeFilename(schema.database)}-query-context-${timestampForFilename(generatedAt)}.zip`;

        return new NextResponse(zip, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("Failed to export repository bundle:", error);
        return NextResponse.json(
            { error: "Failed to export repository bundle", details: error.message },
            { status: 500 }
        );
    } finally {
        if (client) client.release();
    }
}

function timestampForFilename(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        "-",
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join("");
}

function safeFilename(value) {
    return String(value || "database")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "database";
}
