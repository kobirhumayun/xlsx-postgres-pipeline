import { NextResponse } from "next/server";
import {
  callBackupService,
  resolveBackupPath,
  runRestoreScript,
  shouldUseBackupService,
} from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const filename = body?.filename;
  if (!filename) {
    return NextResponse.json(
      { error: "filename is required." },
      { status: 400 }
    );
  }

  try {
    if (shouldUseBackupService()) {
      const payload = await callBackupService("/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      return NextResponse.json(payload);
    }

    const resolved = await resolveBackupPath(filename);
    if (!resolved) {
      return NextResponse.json(
        { error: "Backup file not found or invalid." },
        { status: 404 }
      );
    }

    const result = await runRestoreScript(resolved.fullPath);
    return NextResponse.json({
      success: true,
      output: result.stdout,
      errorOutput: result.stderr,
    });
  } catch (error) {
    console.error("Failed to restore backup:", error);
    return NextResponse.json(
      { error: "Failed to restore backup." },
      { status: 500 }
    );
  }
}
