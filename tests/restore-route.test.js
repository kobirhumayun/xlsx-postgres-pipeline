import { beforeEach, describe, expect, it, vi } from "vitest";

const backup = vi.hoisted(() => ({
  callBackupService: vi.fn(),
  resolveBackupPath: vi.fn(),
  runRestoreScript: vi.fn(),
  shouldUseBackupService: vi.fn(),
}));

vi.mock("@/lib/backup", () => backup);

import { POST } from "@/app/api/restore/route.js";

beforeEach(() => {
  Object.values(backup).forEach((mock) => mock.mockReset());
  backup.shouldUseBackupService.mockReturnValue(false);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function request(body) {
  return new Request("http://localhost/api/restore", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function result(response) {
  return { status: response.status, body: await response.json() };
}

describe("restore API safety contract", () => {
  it("rejects malformed JSON, missing filenames, and missing confirmations", async () => {
    expect((await result(await POST(request("{")))).status).toBe(400);
    expect((await result(await POST(request({ confirmationToken: "RESTORE" })))).body.error)
      .toBe("filename is required.");
    const missingToken = await result(await POST(request({
      filename: "backup_20260101_000000.sql.gz",
    })));
    expect(missingToken.status).toBe(400);
    expect(missingToken.body.warning).toContain("Confirmation token required");
  });

  it("does not reveal confirmation validity for a missing or invalid local file", async () => {
    backup.resolveBackupPath.mockResolvedValue(null);
    const response = await result(await POST(request({
      filename: "../backup_20260101_000000.sql.gz",
      confirmationToken: "RESTORE",
    })));
    expect(response.status).toBe(404);
    expect(backup.runRestoreScript).not.toHaveBeenCalled();
  });

  it("blocks a wrong confirmation before running restore", async () => {
    backup.resolveBackupPath.mockResolvedValue({
      filename: "backup_20260101_000000.sql.gz",
      fullPath: "/backups/backup_20260101_000000.sql.gz",
    });
    const response = await result(await POST(request({
      filename: "backup_20260101_000000.sql.gz",
      confirmationToken: "WRONG",
    })));
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid confirmation token.");
    expect(backup.runRestoreScript).not.toHaveBeenCalled();
  });

  it.each(["RESTORE", "backup_20260101_000000.sql.gz"])(
    "restores a local file with confirmation %s",
    async (confirmationToken) => {
      const fullPath = "/backups/backup_20260101_000000.sql.gz";
      backup.resolveBackupPath.mockResolvedValue({
        filename: "backup_20260101_000000.sql.gz",
        fullPath,
      });
      backup.runRestoreScript.mockResolvedValue({ stdout: "restored", stderr: "" });

      const response = await result(await POST(request({
        filename: "backup_20260101_000000.sql.gz",
        confirmationToken,
      })));
      expect(response).toMatchObject({ status: 200, body: { success: true, output: "restored" } });
      expect(backup.runRestoreScript).toHaveBeenCalledWith(fullPath);
    },
  );

  it("forwards a confirmed restore to the backup service", async () => {
    backup.shouldUseBackupService.mockReturnValue(true);
    backup.callBackupService.mockResolvedValue({ message: "queued", jobId: "job-1" });
    const response = await result(await POST(request({
      filename: "backup_20260101_000000.sql.gz",
      confirmationToken: "RESTORE",
    })));

    expect(response).toEqual({
      status: 200,
      body: { success: true, message: "queued", jobId: "job-1" },
    });
    expect(backup.resolveBackupPath).not.toHaveBeenCalled();
  });

  it("returns diagnostics when restore execution fails", async () => {
    backup.resolveBackupPath.mockResolvedValue({
      filename: "backup_20260101_000000.sql.gz",
      fullPath: "/backups/backup_20260101_000000.sql.gz",
    });
    const error = Object.assign(new Error("psql failed"), { stderr: "connection refused" });
    backup.runRestoreScript.mockRejectedValue(error);
    const response = await result(await POST(request({
      filename: "backup_20260101_000000.sql.gz",
      confirmationToken: "RESTORE",
    })));
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ details: "psql failed", debug: "connection refused" });
  });
});
