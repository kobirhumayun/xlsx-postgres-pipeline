import { prisma } from "@/lib/db";
import { parseSavedQuerySqlFile } from "@/lib/saved-query-files";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const IMPORT_MODES = new Set(["create", "upsert"]);

export async function POST(request) {
    try {
        const formData = await request.formData();
        const mode = IMPORT_MODES.has(formData.get("mode"))
            ? formData.get("mode")
            : "upsert";
        const files = formData
            .getAll("files")
            .filter((file) => file && typeof file.text === "function");

        if (files.length === 0) {
            return NextResponse.json(
                { error: "At least one .sql file is required" },
                { status: 400 }
            );
        }

        const existingQueries = await prisma.savedQuery.findMany();
        const existingByName = new Map(
            existingQueries.map((savedQuery) => [
                savedQuery.name.trim().toLowerCase(),
                savedQuery,
            ])
        );

        const summary = {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [],
            imported: [],
        };

        for (const file of files) {
            const filename = file.name || "query.sql";

            if (!filename.toLowerCase().endsWith(".sql")) {
                summary.skipped += 1;
                summary.errors.push({
                    filename,
                    error: "Only .sql files can be imported.",
                });
                continue;
            }

            try {
                const parsed = parseSavedQuerySqlFile(await file.text(), filename);
                const key = parsed.name.trim().toLowerCase();
                const existing = existingByName.get(key);

                if (existing && mode === "create") {
                    summary.skipped += 1;
                    summary.imported.push({
                        filename,
                        name: parsed.name,
                        action: "skipped",
                    });
                    continue;
                }

                if (existing) {
                    const updated = await prisma.savedQuery.update({
                        where: { id: existing.id },
                        data: parsed,
                    });

                    existingByName.set(key, updated);
                    summary.updated += 1;
                    summary.imported.push({
                        filename,
                        name: updated.name,
                        action: "updated",
                    });
                    continue;
                }

                const created = await prisma.savedQuery.create({
                    data: parsed,
                });

                existingByName.set(key, created);
                summary.created += 1;
                summary.imported.push({
                    filename,
                    name: created.name,
                    action: "created",
                });
            } catch (error) {
                summary.skipped += 1;
                summary.errors.push({
                    filename,
                    error: error.message || "Failed to import file.",
                });
            }
        }

        return NextResponse.json(summary);
    } catch (error) {
        console.error("Failed to import saved queries:", error);
        return NextResponse.json(
            { error: "Failed to import saved queries" },
            { status: 500 }
        );
    }
}
