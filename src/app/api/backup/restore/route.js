import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import {
  buildServiceUrl,
  getBackupConfig,
  getLatestBackupFile,
  getServiceHeaders,
} from "@/lib/backup";

const execFileAsync = promisify(execFile);

const restoreSchema = z.object({
  backupPath: z.string().min(1).optional(),
});

async function fetchFromService(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error || payload?.message || "Restore service error";
    return Response.json({ error: message, details: payload }, { status: response.status });
  }

  return Response.json(payload);
}

export async function POST(request) {
  const config = getBackupConfig();

  const body = await request.json().catch(() => ({}));
  const parsed = restoreSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (config.serviceUrl) {
    const serviceUrl = buildServiceUrl(config.serviceUrl, config.serviceRestorePath);
    return fetchFromService(serviceUrl, {
      method: "POST",
      headers: getServiceHeaders(config.serviceToken),
      body: JSON.stringify(parsed.data),
    });
  }

  let backupPath = parsed.data.backupPath;

  if (!backupPath) {
    const latestBackup = await getLatestBackupFile(config.storagePath);
    backupPath = latestBackup?.path;
  }

  if (!backupPath) {
    return Response.json(
      { error: "No backup file found to restore" },
      { status: 404 }
    );
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      config.restoreScriptPath,
      [backupPath],
      { env: process.env }
    );

    return Response.json({
      status: "ok",
      message: "Restore triggered",
      backupPath,
      output: stdout?.trim() || null,
      errorOutput: stderr?.trim() || null,
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        error: "Restore failed to run",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
