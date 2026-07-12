import { prisma } from "@/lib/db";
import {
    expandSavedQueryImportFiles,
    planSavedQueryImport,
} from "@/lib/saved-query-import";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        const formData = await request.formData();
        const mode = formData.get("mode");
        const uploadedFiles = formData
            .getAll("files")
            .filter((file) => file && typeof file.text === "function");

        if (uploadedFiles.length === 0) {
            return NextResponse.json(
                { error: "At least one .sql or repository .zip file is required" },
                { status: 400 }
            );
        }

        const files = await expandSavedQueryImportFiles(uploadedFiles);
        const existingQueries = await prisma.savedQuery.findMany();
        const plan = await planSavedQueryImport(files, existingQueries, mode);

        return NextResponse.json({
            mode: plan.mode,
            willReplaceExisting: plan.willReplaceExisting,
            replaceCount: plan.replaceCount,
            ...plan.summary,
            operations: plan.operations.map((operation) => ({
                filename: operation.filename,
                name: operation.name,
                originalName: operation.originalName,
                action: operation.action,
                error: operation.error,
            })),
        });
    } catch (error) {
        console.error("Failed to preview saved query import:", error);
        return NextResponse.json(
            { error: "Failed to preview saved query import" },
            { status: 500 }
        );
    }
}
