import { prisma } from "@/lib/db";
import {
    planSavedQueryImport,
    SAVED_QUERY_IMPORT_MODES,
} from "@/lib/saved-query-import";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        const formData = await request.formData();
        const mode = formData.get("mode");
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
        const plan = await planSavedQueryImport(files, existingQueries, mode);

        if (
            plan.mode === SAVED_QUERY_IMPORT_MODES.replace &&
            plan.summary.errors > 0
        ) {
            return NextResponse.json(
                {
                    error: "Fix import errors before replacing saved queries.",
                    ...toResponseSummary(plan),
                },
                { status: 400 }
            );
        }

        if (plan.mode === SAVED_QUERY_IMPORT_MODES.replace) {
            await prisma.$transaction([
                prisma.savedQuery.deleteMany(),
                ...plan.operations
                    .filter((operation) => operation.action === "created")
                    .map((operation) => prisma.savedQuery.create({
                        data: operation.data,
                    })),
            ]);

            return NextResponse.json(toResponseSummary(plan));
        }

        for (const operation of plan.operations) {
            if (operation.action === "created") {
                await prisma.savedQuery.create({ data: operation.data });
            }

            if (operation.action === "updated") {
                await prisma.savedQuery.update({
                    where: { id: operation.existingId },
                    data: operation.data,
                });
            }
        }

        return NextResponse.json(toResponseSummary(plan));
    } catch (error) {
        console.error("Failed to import saved queries:", error);
        return NextResponse.json(
            { error: "Failed to import saved queries" },
            { status: 500 }
        );
    }
}

function toResponseSummary(plan) {
    return {
        mode: plan.mode,
        willReplaceExisting: plan.willReplaceExisting,
        replaceCount: plan.replaceCount,
        ...plan.summary,
        imported: plan.operations.map((operation) => ({
            filename: operation.filename,
            name: operation.name,
            originalName: operation.originalName,
            action: operation.action,
            error: operation.error,
        })),
    };
}
