import { prisma } from "@/lib/db";
import { savedQueryFileName, toSavedQuerySqlFile } from "@/lib/saved-query-files";
import { createZip } from "@/lib/zip";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        const body = await request.json().catch(() => ({}));
        const ids = Array.isArray(body.ids)
            ? body.ids.filter((id) => typeof id === "string" && id.trim())
            : [];

        const savedQueries = await prisma.savedQuery.findMany({
            where: ids.length ? { id: { in: ids } } : undefined,
            orderBy: [{ name: "asc" }, { updatedAt: "desc" }],
        });

        if (savedQueries.length === 0) {
            return NextResponse.json(
                { error: "No saved queries found to export" },
                { status: 404 }
            );
        }

        const usedNames = new Set();
        const files = [
            {
                name: "queries/README.md",
                data: savedQueriesReadme(),
                date: new Date(),
            },
            ...savedQueries.map((savedQuery) => ({
                name: `queries/${savedQueryFileName(savedQuery, usedNames)}`,
                data: toSavedQuerySqlFile(savedQuery),
                date: savedQuery.updatedAt,
            })),
        ];

        const zip = createZip(files);
        const filename = `saved-queries-${timestampForFilename(new Date())}.zip`;

        return new NextResponse(zip, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": String(zip.length),
            },
        });
    } catch (error) {
        console.error("Failed to export saved queries:", error);
        return NextResponse.json(
            { error: "Failed to export saved queries" },
            { status: 500 }
        );
    }
}

function savedQueriesReadme() {
    return [
        "# Saved Queries",
        "",
        "Each `.sql` file contains optional `-- xpp:*` metadata comments followed by the SQL body.",
        "",
        "Supported metadata:",
        "",
        "- `-- xpp:name:`",
        "- `-- xpp:version:`",
        "- `-- xpp:databaseName:`",
        "- `-- xpp:description:`",
        "",
        "The import workflow stores the SQL as a saved query. It does not execute imported SQL.",
        "",
    ].join("\n");
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
