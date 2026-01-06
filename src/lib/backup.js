import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const SQL_BACKUP_EXTENSIONS = [".sql", ".sql.gz"];

export function getBackupConfig() {
  return {
    serviceUrl: process.env.BACKUP_SERVICE_URL || "",
    serviceStatusPath: process.env.BACKUP_SERVICE_STATUS_PATH || "/status",
    serviceRunPath: process.env.BACKUP_SERVICE_RUN_PATH || "/run",
    serviceRestorePath: process.env.BACKUP_SERVICE_RESTORE_PATH || "/restore",
    serviceToken: process.env.BACKUP_SERVICE_TOKEN || "",
    storagePath: process.env.BACKUP_STORAGE_PATH || "/backups",
    backupScriptPath: process.env.BACKUP_SCRIPT_PATH || "/usr/local/bin/backup.sh",
    restoreScriptPath:
      process.env.BACKUP_RESTORE_SCRIPT_PATH || "/usr/local/bin/restore.sh",
  };
}

export async function getLatestBackupFile(storagePath) {
  try {
    const entries = await readdir(storagePath, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile());

    const candidates = [];

    for (const file of files) {
      const fullPath = path.join(storagePath, file.name);
      const extension = SQL_BACKUP_EXTENSIONS.find((ext) => file.name.endsWith(ext));

      if (!extension) {
        continue;
      }

      const stats = await stat(fullPath);
      candidates.push({
        name: file.name,
        path: fullPath,
        modifiedTime: stats.mtime,
        modifiedTimeMs: stats.mtimeMs,
        size: stats.size,
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.modifiedTimeMs - a.modifiedTimeMs);
    return candidates[0];
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export function buildServiceUrl(baseUrl, endpointPath) {
  if (!baseUrl) {
    return "";
  }

  const normalizedBase = baseUrl.endsWith("/")
    ? baseUrl.slice(0, -1)
    : baseUrl;
  const normalizedPath = endpointPath.startsWith("/")
    ? endpointPath
    : `/${endpointPath}`;

  return `${normalizedBase}${normalizedPath}`;
}

export function getServiceHeaders(serviceToken) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (serviceToken) {
    headers.Authorization = `Bearer ${serviceToken}`;
  }

  return headers;
}
