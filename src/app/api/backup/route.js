import { NextResponse } from "next/server";
import {
  callBackupService,
  getBackupRuntimeMode,
  listBackups,
  runBackupScript,
  shouldUseBackupService,
} from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (shouldUseBackupService()) {
      const payload = await callBackupService("/backup", { method: "GET" });
      return NextResponse.json({ mode: getBackupRuntimeMode(), ...payload });
    }

    const { backupDir, backups } = await listBackups();
    return NextResponse.json({ mode: getBackupRuntimeMode(), backupDir, backups });
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
      return NextResponse.json({ mode: getBackupRuntimeMode(), ...payload });
    }

    const result = await runBackupScript();
    const { backups } = await listBackups();
    return NextResponse.json({
      success: true,
      mode: getBackupRuntimeMode(),
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
