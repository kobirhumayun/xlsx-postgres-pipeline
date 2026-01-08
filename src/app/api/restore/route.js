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

  const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
  if (!filename) {
    return NextResponse.json(
      { success: false, error: "filename is required.", message: "Provide a backup filename." },
      { status: 400 }
    );
  }

  const confirmationToken =
    typeof body?.confirmationToken === "string" ? body.confirmationToken.trim() : "";
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
    const useBackupService = shouldUseBackupService();
    let resolved = null;
    if (!useBackupService) {
      resolved = await resolveBackupPath(filename);
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
    }

    const resolvedFilename = resolved?.filename ?? filename;
    const isConfirmationValid =
      confirmationToken === "RESTORE" || confirmationToken === resolvedFilename;
    if (!isConfirmationValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid confirmation token.",
          message: "Enter the backup filename or type RESTORE to confirm.",
        },
        { status: 400 }
      );
    }

    if (useBackupService) {
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
        message: "Restore failed. check logs.",
        details: error.message,
        debug: error.stderr || error.stdout,
      },
      { status: 500 }
    );
  }
}
