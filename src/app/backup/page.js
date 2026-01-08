"use client";

import { useMemo, useState } from "react";

const initialBackups = [
  {
    id: "backup-2024-06-01",
    label: "June 1, 2024 • 02:15 UTC",
    size: "2.4 GB",
    source: "Nightly schedule",
  },
  {
    id: "backup-2024-05-28",
    label: "May 28, 2024 • 22:48 UTC",
    size: "2.3 GB",
    source: "Manual run",
  },
  {
    id: "backup-2024-05-20",
    label: "May 20, 2024 • 02:12 UTC",
    size: "2.2 GB",
    source: "Nightly schedule",
  },
];

const statusTone = {
  idle: "text-zinc-500",
  loading: "text-zinc-600",
  success: "text-emerald-600",
  error: "text-red-600",
};

export default function BackupPage() {
  const [backups, setBackups] = useState(initialBackups);
  const [selectedBackupId, setSelectedBackupId] = useState(initialBackups[0]?.id ?? "");
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [progress, setProgress] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const selectedBackup = useMemo(
    () => backups.find((backup) => backup.id === selectedBackupId),
    [backups, selectedBackupId]
  );

  const simulateDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleRunBackup = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setStatus({ type: "loading", message: "Backup running..." });
    setProgress("Snapshotting data and uploading archive.");

    await simulateDelay(1200);

    const timestamp = new Date();
    const label = `${timestamp.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    })} • ${timestamp.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    })}`;
    const newBackup = {
      id: `backup-${timestamp.getTime()}`,
      label,
      size: "2.5 GB",
      source: "Manual run",
    };

    setBackups((prev) => [newBackup, ...prev]);
    setSelectedBackupId(newBackup.id);
    setStatus({ type: "success", message: "Backup completed successfully." });
    setProgress("New backup available for restore.");
    setIsRunning(false);
  };

  const handleRestore = async () => {
    if (!selectedBackupId || isRestoring) {
      setStatus({ type: "error", message: "Select a backup before restoring." });
      setProgress("");
      return;
    }

    setIsRestoring(true);
    setStatus({ type: "loading", message: "Restore in progress..." });
    setProgress("Validating archive and applying changes.");

    await simulateDelay(1400);

    setStatus({ type: "success", message: "Restore completed. Systems are back online." });
    setProgress(`Restored from ${selectedBackup?.label ?? "selected backup"}.`);
    setIsRestoring(false);
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
              </div>
              <button
                type="button"
                onClick={handleRestore}
                disabled={isRestoring}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRestoring ? "Restoring..." : "Restore Selected Backup"}
              </button>
            </div>

            <div className="mt-5 grid gap-3">
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
                    onChange={() => setSelectedBackupId(backup.id)}
                    className="mt-1"
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-medium text-zinc-900">{backup.label}</span>
                    <span className="text-xs text-zinc-500">
                      {backup.size} • {backup.source}
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
