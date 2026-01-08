import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const backupFileRegex = /^backup_\d{8}_\d{6}\.sql\.gz$/;
const defaultBackupDirs = ["/backups", path.join(process.cwd(), "backups")];

function normalizeBackupDir() {
  const configured = process.env.BACKUP_DIR?.trim();
  if (configured) {
    return configured;
  }
  return defaultBackupDirs.find((candidate) => fs.existsSync(candidate)) ?? defaultBackupDirs[0];
}

export function getBackupDir() {
  return normalizeBackupDir();
}

export function isBackupFilename(filename) {
  return backupFileRegex.test(filename);
}

export function sanitizeBackupFilename(filename) {
  if (typeof filename !== "string") {
    return null;
  }
  if (filename !== path.basename(filename)) {
    return null;
  }
  if (!isBackupFilename(filename)) {
    return null;
  }
  return filename;
}

export async function listBackups() {
  const backupDir = getBackupDir();
  try {
    const entries = await fsp.readdir(backupDir, { withFileTypes: true });
    const backups = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && isBackupFilename(entry.name))
        .map(async (entry) => {
          const fullPath = path.join(backupDir, entry.name);
          const stats = await fsp.stat(fullPath);
          return {
            name: entry.name,
            size: stats.size,
            modifiedAt: stats.mtime.toISOString(),
          };
        })
    );

    backups.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return { backupDir, backups };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { backupDir, backups: [] };
    }
    throw error;
  }
}

export async function resolveBackupPath(filename) {
  const sanitized = sanitizeBackupFilename(filename);
  if (!sanitized) {
    return null;
  }
  const backupDir = getBackupDir();
  const fullPath = path.join(backupDir, sanitized);
  try {
    const stats = await fsp.stat(fullPath);
    if (!stats.isFile()) {
      return null;
    }
    return { backupDir, fullPath, filename: sanitized };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function shouldUseBackupService() {
  return Boolean(process.env.BACKUP_SERVICE_URL);
}

export async function callBackupService(pathname, options = {}) {
  const baseUrl = process.env.BACKUP_SERVICE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("BACKUP_SERVICE_URL is not configured.");
  }
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error || `Backup service error (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

function resolveScriptPath(envVar, defaultFilename) {
  const configured = process.env[envVar]?.trim();
  if (configured) {
    return configured;
  }
  const preferred = path.join("/usr/local/bin", defaultFilename);
  if (fs.existsSync(preferred)) {
    return preferred;
  }
  return path.join(process.cwd(), "backup", defaultFilename);
}

export async function runBackupScript() {
  const scriptPath = resolveScriptPath("BACKUP_SCRIPT_PATH", "backup.sh");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      "Backup script not found. Configure BACKUP_SCRIPT_PATH or install /usr/local/bin/backup.sh."
    );
  }
  const { stdout, stderr } = await execFileAsync(scriptPath, [], {
    timeout: 10 * 60 * 1000,
    maxBuffer: 1024 * 1024,
  });
  return { stdout, stderr };
}

export async function runRestoreScript(backupPath) {
  const scriptPath = resolveScriptPath("RESTORE_SCRIPT_PATH", "restore.sh");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      "Restore script not found. Configure RESTORE_SCRIPT_PATH or install /usr/local/bin/restore.sh."
    );
  }
  const { stdout, stderr } = await execFileAsync(scriptPath, [backupPath], {
    timeout: 10 * 60 * 1000,
    maxBuffer: 1024 * 1024,
  });
  return { stdout, stderr };
}
