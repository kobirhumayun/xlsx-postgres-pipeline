import { getDbPool } from "@/lib/db";
import { collectDatabaseSchema, schemaExportFiles } from "@/lib/schema-export";
import { createZip } from "@/lib/zip";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schemaExportSchema = z.object({
    databaseName: z.string().trim().optional(),
    schemas: z.array(z.string().trim().min(1)).optional(),
    includeRowCounts: z.boolean().optional(),
    includeIndexes: z.boolean().optional(),
    includeConstraints: z.boolean().optional(),
    includeViews: z.boolean().optional(),
});

export async function POST(request) {
    let client;

    try {
        const body = await request.json().catch(() => ({}));
        const parsed = schemaExportSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const options = parsed.data;
        const pool = getDbPool(options.databaseName);
        client = await pool.connect();

        const schema = await collectDatabaseSchema(client, options);
        const files = schemaExportFiles(schema).map((file) => ({
            ...file,
            date: new Date(schema.exportedAt),
        }));
        const zip = createZip(files);
        const filename = `${safeFilename(schema.database)}-schema-${timestampForFilename(new Date())}.zip`;

        return new NextResponse(zip, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": String(zip.length),
            },
        });
    } catch (error) {
        console.error("Failed to export schema:", error);
        return NextResponse.json(
            { error: "Failed to export schema", details: error.message },
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
