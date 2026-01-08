import { NextResponse } from "next/server";
import {
  callBackupService,
  listBackups,
  runBackupScript,
  shouldUseBackupService,
} from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (shouldUseBackupService()) {
      const payload = await callBackupService("/backup", { method: "GET" });
      return NextResponse.json(payload);
    }

    const { backupDir, backups } = await listBackups();
    return NextResponse.json({ backupDir, backups });
  } catch (error) {
    console.error("Failed to list backups:", error);
    return NextResponse.json(
      {
        error: "Failed to list backups.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    if (shouldUseBackupService()) {
      const payload = await callBackupService("/backup", { method: "POST" });
      return NextResponse.json(payload);
    }

    const result = await runBackupScript();
    const { backups } = await listBackups();
    return NextResponse.json({
      success: true,
      output: result.stdout,
      errorOutput: result.stderr,
      backups,
    });
  } catch (error) {
    console.error("Failed to run backup:", error);
    return NextResponse.json(
      {
        error: "Failed to run backup.",
        details: error.message,
        debug: error.stderr || error.stdout,
      },
      { status: 500 }
    );
  }
}
