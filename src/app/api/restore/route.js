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
      { success: false, error: "filename is required.", message: "Provide a backup filename." },
      { status: 400 }
    );
  }

  const confirmationToken = body?.confirmationToken;
  if (!confirmationToken) {
    return NextResponse.json(
      {
        success: false,
        warning: "Confirmation token required to restore backups.",
        message: "Restore blocked until confirmation is provided.",
      },
      { status: 400 }
    );
  }

  try {
    if (shouldUseBackupService()) {
      const payload = await callBackupService("/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, confirmationToken }),
      });
      return NextResponse.json({
        success: payload?.success ?? true,
        message: payload?.message ?? "Restore request accepted.",
        ...payload,
      });
    }

    const resolved = await resolveBackupPath(filename);
    if (!resolved) {
      return NextResponse.json(
        {
          success: false,
          error: "Backup file not found or invalid.",
          message: "Backup file not found or invalid.",
        },
        { status: 404 }
      );
    }

    const result = await runRestoreScript(resolved.fullPath);
    return NextResponse.json({
      success: true,
      message: "Restore completed successfully.",
      details: `Restored from ${filename}.`,
      output: result.stdout,
      errorOutput: result.stderr,
    });
  } catch (error) {
    console.error("Failed to restore backup:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to restore backup.",
        message: "Restore failed. Review server logs for details.",
      },
      { status: 500 }
    );
  }
}
