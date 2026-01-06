import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  buildServiceUrl,
  getBackupConfig,
  getLatestBackupFile,
  getServiceHeaders,
} from "@/lib/backup";

const execFileAsync = promisify(execFile);

async function fetchFromService(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error || payload?.message || "Backup service error";
    return Response.json({ error: message, details: payload }, { status: response.status });
  }

  return Response.json(payload);
}

export async function GET() {
  const config = getBackupConfig();

  if (config.serviceUrl) {
    const serviceUrl = buildServiceUrl(config.serviceUrl, config.serviceStatusPath);
    return fetchFromService(serviceUrl, {
      method: "GET",
      headers: getServiceHeaders(config.serviceToken),
      cache: "no-store",
    });
  }

  try {
    const latestBackup = await getLatestBackupFile(config.storagePath);

    return Response.json({
      status: "ok",
      lastBackupTime: latestBackup?.modifiedTime?.toISOString() ?? null,
      lastBackupFile: latestBackup?.name ?? null,
      lastBackupPath: latestBackup?.path ?? null,
      storagePath: config.storagePath,
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        error: "Unable to read backups directory",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  const config = getBackupConfig();

  if (config.serviceUrl) {
    const serviceUrl = buildServiceUrl(config.serviceUrl, config.serviceRunPath);
    return fetchFromService(serviceUrl, {
      method: "POST",
      headers: getServiceHeaders(config.serviceToken),
      body: JSON.stringify({ triggeredAt: new Date().toISOString() }),
    });
  }

  try {
    const { stdout, stderr } = await execFileAsync(config.backupScriptPath, [], {
      env: process.env,
    });

    return Response.json({
      status: "ok",
      message: "Backup triggered",
      output: stdout?.trim() || null,
      errorOutput: stderr?.trim() || null,
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        error: "Backup failed to run",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
