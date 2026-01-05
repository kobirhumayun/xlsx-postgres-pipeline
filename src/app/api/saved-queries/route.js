
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const savedQueries = await prisma.savedQuery.findMany({
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json({ items: savedQueries });
    } catch (error) {
        console.error("Failed to fetch saved queries:", error);
        return NextResponse.json({ error: "Failed to fetch saved queries" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { name, description, query, database } = body;

        if (!name || !query) {
            return NextResponse.json({ error: "Name and Query are required" }, { status: 400 });
        }

        const savedQuery = await prisma.savedQuery.create({
            data: {
                name,
                description,
                query,
                database: database || "default",
            },
        });

        return NextResponse.json(savedQuery);
    } catch (error) {
        console.error("Failed to save query:", error);
        return NextResponse.json({ error: "Failed to save query" }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        await prisma.savedQuery.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete saved query:", error);
        return NextResponse.json({ error: "Failed to delete saved query" }, { status: 500 });
    }
}
