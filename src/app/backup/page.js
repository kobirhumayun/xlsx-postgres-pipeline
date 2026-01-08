"use client";

import { useCallback, useMemo, useState, useEffect } from "react";

const statusTone = {
  idle: "text-zinc-500",
  loading: "text-zinc-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
  error: "text-red-600",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

const formatBytes = (bytes) => {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) {
    return null;
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let unitIndex = -1;
  let value = bytes;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const normalizeBackup = (backup) => {
  if (!backup) return null;
  const filename = backup.name || backup.filename || backup.id;
  if (!filename) return null;
  const modifiedAt = backup.modifiedAt || backup.timestamp || backup.createdAt;
  let label = filename;
  if (modifiedAt) {
    const parsed = new Date(modifiedAt);
    if (!Number.isNaN(parsed.valueOf())) {
      label = dateFormatter.format(parsed);
    }
  }
  const sizeLabel =
    typeof backup.size === "number" ? formatBytes(backup.size) : backup.size || null;
  return {
    id: filename,
    filename,
    label,
    sizeLabel,
    source: backup.source || "Backup storage",
  };
};

const buildBackupSummary = (backup) => {
  const parts = [backup.filename];
  if (backup.sizeLabel) {
    parts.push(backup.sizeLabel);
  }
  if (backup.source) {
    parts.push(backup.source);
  }
  return parts.join(" • ");
};

export default function BackupPage() {
  const [backups, setBackups] = useState([]);
  const [selectedBackupId, setSelectedBackupId] = useState("");
  const [backupDir, setBackupDir] = useState("");
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [progress, setProgress] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmationText, setConfirmationText] = useState("");

  const selectedBackup = useMemo(
    () => backups.find((backup) => backup.id === selectedBackupId),
    [backups, selectedBackupId]
  );
  const isConfirmationValid = useMemo(() => {
    if (!selectedBackupId) return false;
    const normalized = confirmationText.trim();
    return normalized === "RESTORE" || normalized === selectedBackupId;
  }, [confirmationText, selectedBackupId]);

  const applyBackups = useCallback((items) => {
    setBackups(items);
    setSelectedBackupId((prev) => {
      if (items.find((backup) => backup.id === prev)) {
        return prev;
      }
      return items[0]?.id ?? "";
    });
  }, []);

  const loadBackups = useCallback(async ({ announce = false } = {}) => {
    setIsLoading(true);
    if (announce) {
      setStatus({ type: "loading", message: "Refreshing backup list..." });
      setProgress("");
    }
    try {
      const response = await fetch("/api/backup", { method: "GET" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load backups.");
      }
      const backupsPayload = Array.isArray(payload?.backups) ? payload.backups : [];
      const normalized = backupsPayload
        .map((backup) => normalizeBackup(backup))
        .filter(Boolean);
      setBackupDir(payload?.backupDir || "");
      applyBackups(normalized);
      if (announce) {
        setStatus({
          type: "success",
          message: normalized.length ? "Backup list updated." : "No backups found yet.",
        });
      } else if (!normalized.length) {
        setStatus({ type: "idle", message: "No backups found yet." });
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.message || "Unable to load backups.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [applyBackups]);

  useEffect(() => {
    loadBackups({ announce: true });
  }, [loadBackups]);

  const handleRunBackup = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setStatus({ type: "loading", message: "Backup running..." });
    setProgress("Snapshotting data and uploading archive.");

    try {
      const response = await fetch("/api/backup", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || payload?.message || "Backup failed.");
      }
      const backupsPayload = Array.isArray(payload?.backups) ? payload.backups : [];
      const normalized = backupsPayload
        .map((backup) => normalizeBackup(backup))
        .filter(Boolean);
      if (normalized.length) {
        applyBackups(normalized);
      } else {
        await loadBackups();
      }
      setStatus({
        type: "success",
        message: payload?.message || "Backup completed successfully.",
      });
      setProgress("New backup available for restore.");
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.message || "Backup request failed. Try again.",
      });
      setProgress("");
    } finally {
      setIsRunning(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackupId || isRestoring) {
      setStatus({ type: "error", message: "Select a backup before restoring." });
      setProgress("");
      return;
    }

    if (!isConfirmationValid) {
      setStatus({
        type: "warning",
        message: "Enter the backup filename or type RESTORE to confirm.",
      });
      setProgress("");
      return;
    }

    setIsRestoring(true);
    setStatus({ type: "loading", message: "Restore in progress..." });
    setProgress("Validating archive and applying changes.");

    try {
      const filename = selectedBackup?.filename || selectedBackupId;
      const response = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          confirmationToken: confirmationText.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        setStatus({
          type: payload?.warning ? "warning" : "error",
          message: payload?.warning || payload?.message || payload?.error || "Restore failed.",
        });
        setProgress(payload?.details || "");
        return;
      }

      setStatus({
        type: "success",
        message: payload?.message || "Restore completed. Systems are back online.",
      });
      setProgress(
        payload?.details || `Restored from ${selectedBackup?.label ?? "selected backup"}.`
      );
    } catch (error) {
      setStatus({ type: "error", message: "Restore request failed. Try again." });
      setProgress("");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Data Protection
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Backup &amp; Restore</h1>
          <p className="text-base text-zinc-600">
            Trigger on-demand backups, review available restore points, and track operational status.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-semibold">Run Backup Now</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Capture the latest database state and store it securely.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleRunBackup}
                disabled={isRunning}
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRunning ? "Running backup..." : "Run Backup Now"}
              </button>
              {isRunning && (
                <span className="text-sm text-zinc-500">Estimated time: ~2 minutes</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Restore</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Select a backup to restore your environment.
                </p>
                {backupDir && (
                  <p className="mt-2 text-xs text-zinc-400">Backup directory: {backupDir}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleRestore}
                disabled={isRestoring || !isConfirmationValid}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRestoring ? "Restoring..." : "Restore Selected Backup"}
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <p className="font-semibold text-zinc-900">Confirmation required</p>
              <p className="mt-1 text-xs text-zinc-600">
                Type the backup filename or enter <span className="font-semibold">RESTORE</span> to
                enable the restore button.
              </p>
              <input
                type="text"
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                placeholder={
                  selectedBackupId ? `Type ${selectedBackupId} or RESTORE` : "Select a backup first"
                }
                className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>

            <div className="mt-5 grid gap-3">
              {isLoading && !backups.length && (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500">
                  Loading backups...
                </div>
              )}
              {!isLoading && !backups.length && (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500">
                  No backups available yet. Run a manual backup to get started.
                </div>
              )}
              {backups.map((backup) => (
                <label
                  key={backup.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${selectedBackupId === backup.id
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                >
                  <input
                    type="radio"
                    name="backup"
                    value={backup.id}
                    checked={selectedBackupId === backup.id}
                    onChange={() => {
                      setSelectedBackupId(backup.id);
                      setConfirmationText("");
                    }}
                    className="mt-1"
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-medium text-zinc-900">{backup.label}</span>
                    <span className="text-xs text-zinc-500">
                      {buildBackupSummary(backup)}
                    </span>
                  </div>
                  {selectedBackupId === backup.id && (
                    <span className="rounded-full bg-zinc-900 px-2 py-1 text-xs font-semibold text-white">
                      Selected
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Status Center
              </p>
              <p className="mt-2 text-base font-semibold text-zinc-900">
                {status.message || "No active backup tasks."}
              </p>
              {progress && <p className="mt-1 text-sm text-zinc-600">{progress}</p>}
            </div>
            <div className={`text-sm font-semibold ${statusTone[status.type]}`}>
              {status.type === "idle" ? "Idle" : status.type.toUpperCase()}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
