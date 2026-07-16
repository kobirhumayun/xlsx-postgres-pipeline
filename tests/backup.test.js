import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callBackupService,
  getBackupDir,
  getBackupRuntimeMode,
  isBackupFilename,
  listBackups,
  resolveBackupPath,
  runBackupScript,
  runRestoreScript,
  sanitizeBackupFilename,
  shouldUseBackupService,
} from "@/lib/backup.js";

let tempDir;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "xpp-backup-test-"));
  process.env.BACKUP_DIR = tempDir;
  delete process.env.BACKUP_SERVICE_URL;
  delete process.env.BACKUP_SCRIPT_PATH;
  delete process.env.RESTORE_SCRIPT_PATH;
});

afterEach(async () => {
  vi.unstubAllGlobals();
  delete process.env.BACKUP_DIR;
  delete process.env.BACKUP_SERVICE_URL;
  delete process.env.BACKUP_SCRIPT_PATH;
  delete process.env.RESTORE_SCRIPT_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

describe("backup file safety", () => {
  it.each([
    ["backup_20260716_123456.sql.gz", true],
    ["backup_20260716_12345.sql.gz", false],
    ["../backup_20260716_123456.sql.gz", false],
    ["backup_20260716_123456.sql", false],
  ])("validates %s", (filename, expected) => {
    expect(isBackupFilename(filename)).toBe(expected);
  });

  it("rejects non-string and path-traversal filenames", () => {
    expect(sanitizeBackupFilename(null)).toBeNull();
    expect(sanitizeBackupFilename("../backup_20260716_123456.sql.gz")).toBeNull();
    expect(sanitizeBackupFilename("backup_20260716_123456.sql.gz"))
      .toBe("backup_20260716_123456.sql.gz");
  });

  it("uses the configured directory and lists valid files newest first", async () => {
    const older = path.join(tempDir, "backup_20260101_000000.sql.gz");
    const newer = path.join(tempDir, "backup_20260102_000000.sql.gz");
    await writeFile(older, "old");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await writeFile(newer, "new backup");
    await writeFile(path.join(tempDir, "notes.txt"), "ignore");
    await mkdir(path.join(tempDir, "backup_20260103_000000.sql.gz"));

    const result = await listBackups();
    expect(getBackupDir()).toBe(tempDir);
    expect(result.backups.map(({ name }) => name)).toEqual([
      "backup_20260102_000000.sql.gz",
      "backup_20260101_000000.sql.gz",
    ]);
    expect(result.backups[0].size).toBe(10);
  });

  it("resolves only an existing regular backup file", async () => {
    const filename = "backup_20260101_000000.sql.gz";
    await writeFile(path.join(tempDir, filename), "backup");

    await expect(resolveBackupPath(filename)).resolves.toMatchObject({ filename, backupDir: tempDir });
    await expect(resolveBackupPath("backup_20260102_000000.sql.gz")).resolves.toBeNull();
    await expect(resolveBackupPath("../backup_20260101_000000.sql.gz")).resolves.toBeNull();
  });

  it("treats a missing directory as an empty backup list", async () => {
    process.env.BACKUP_DIR = path.join(tempDir, "missing");
    await expect(listBackups()).resolves.toEqual({
      backupDir: process.env.BACKUP_DIR,
      backups: [],
    });
  });
});

describe("backup execution mode", () => {
  it("switches modes based on BACKUP_SERVICE_URL", () => {
    expect(shouldUseBackupService()).toBe(false);
    expect(getBackupRuntimeMode()).toBe("local-script");
    process.env.BACKUP_SERVICE_URL = "https://backup.example/";
    expect(shouldUseBackupService()).toBe(true);
    expect(getBackupRuntimeMode()).toBe("service");
  });

  it("calls the configured service without a duplicate slash", async () => {
    process.env.BACKUP_SERVICE_URL = "https://backup.example/";
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true}', {
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(callBackupService("/backup", { method: "POST" })).resolves.toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith("https://backup.example/backup", { method: "POST" });
  });

  it("surfaces service errors and missing configuration", async () => {
    await expect(callBackupService("/backup")).rejects.toThrow("not configured");
    process.env.BACKUP_SERVICE_URL = "https://backup.example";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"service down"}', {
      status: 503,
      headers: { "content-type": "application/json" },
    })));
    await expect(callBackupService("/backup")).rejects.toThrow("service down");
  });

  it("fails clearly when explicitly configured scripts do not exist", async () => {
    process.env.BACKUP_SCRIPT_PATH = path.join(tempDir, "missing-backup.sh");
    process.env.RESTORE_SCRIPT_PATH = path.join(tempDir, "missing-restore.sh");
    await expect(runBackupScript()).rejects.toThrow("Backup script not found");
    await expect(runRestoreScript("backup.sql.gz")).rejects.toThrow("Restore script not found");
  });
});
