import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const savedQueries = await prisma.savedQuery.findMany({
            orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
        });
        return NextResponse.json(savedQueries);
    } catch (error) {
        console.error("Failed to fetch saved queries:", error);
        return NextResponse.json(
            { error: "Failed to fetch saved queries" },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { name, description, query, databaseName, isPinned } = body;

        if (!name || !query) {
            return NextResponse.json(
                { error: "Name and query are required" },
                { status: 400 }
            );
        }

        const savedQuery = await prisma.savedQuery.create({
            data: {
                name,
                description,
                query,
                databaseName,
                isPinned: Boolean(isPinned),
            },
        });

        return NextResponse.json(savedQuery);
    } catch (error) {
        console.error("Failed to create saved query:", error);
        return NextResponse.json(
            { error: "Failed to create saved query" },
            { status: 500 }
        );
    }
}

export async function PUT(request) {
    try {
        const body = await request.json();
        const { id, name, description, query, databaseName, isPinned } = body;

        if (!id) {
            return NextResponse.json(
                { error: "ID is required" },
                { status: 400 }
            );
        }

        const data = {};
        if (name !== undefined) data.name = name;
        if (description !== undefined) data.description = description;
        if (query !== undefined) data.query = query;
        if (databaseName !== undefined) data.databaseName = databaseName;
        if (isPinned !== undefined) data.isPinned = Boolean(isPinned);

        if (Object.keys(data).length === 0) {
            return NextResponse.json(
                { error: "No fields provided to update" },
                { status: 400 }
            );
        }

        const updatedQuery = await prisma.savedQuery.update({
            where: { id },
            data,
        });

        return NextResponse.json(updatedQuery);
    } catch (error) {
        console.error("Failed to update saved query:", error);
        return NextResponse.json(
            { error: "Failed to update saved query" },
            { status: 500 }
        );
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: "ID is required" },
                { status: 400 }
            );
        }

        await prisma.savedQuery.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete saved query:", error);
        return NextResponse.json(
            { error: "Failed to delete saved query" },
            { status: 500 }
        );
    }
}
