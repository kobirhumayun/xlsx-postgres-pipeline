"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const initialStatus = {
  status: "loading",
  lastBackupTime: null,
  lastBackupFile: null,
  lastBackupPath: null,
  storagePath: null,
  error: null,
};

export default function BackupPage() {
  const [status, setStatus] = useState(initialStatus);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [restorePath, setRestorePath] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const formattedTime = useMemo(() => {
    if (!status.lastBackupTime) {
      return "Not available";
    }

    return new Date(status.lastBackupTime).toLocaleString();
  }, [status.lastBackupTime]);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/backup/run", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load backup status");
      }

      setStatus({
        status: payload.status || "ok",
        lastBackupTime: payload.lastBackupTime || null,
        lastBackupFile: payload.lastBackupFile || null,
        lastBackupPath: payload.lastBackupPath || null,
        storagePath: payload.storagePath || null,
        error: null,
      });
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        status: "error",
        error: error.message,
      }));
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const triggerBackup = async () => {
    setIsBusy(true);
    setActionMessage("");
    setActionError("");

    try {
      const response = await fetch("/api/backup/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Backup failed");
      }

      setActionMessage(payload.message || "Backup triggered successfully.");
      await loadStatus();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  const triggerRestore = async () => {
    setIsBusy(true);
    setActionMessage("");
    setActionError("");

    const payloadBody = {
      backupPath: restorePath || status.lastBackupPath || undefined,
    };

    try {
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Restore failed");
      }

      setActionMessage(payload.message || "Restore started successfully.");
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Backup & Restore
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Manage database backups
          </h1>
          <p className="max-w-2xl text-base text-zinc-600">
            Trigger a backup or restore the most recent snapshot. Status
            information is pulled from the configured backup integration.
          </p>
        </header>

        <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-zinc-500">Status</span>
            <span className="text-lg font-semibold">
              {status.status === "loading" ? "Loading…" : status.status}
            </span>
            {status.error ? (
              <p className="text-sm text-red-600">{status.error}</p>
            ) : null}
          </div>
          <div className="grid gap-2 text-sm text-zinc-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-zinc-700">Last backup:</span>
              <span>{formattedTime}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-zinc-700">Latest file:</span>
              <span>{status.lastBackupFile || "Not available"}</span>
            </div>
            {status.storagePath ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-zinc-700">Storage path:</span>
                <span>{status.storagePath}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="grid gap-2">
            <h2 className="text-lg font-semibold">Trigger actions</h2>
            <p className="text-sm text-zinc-600">
              Use the buttons below to invoke the backup service or scripts.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              onClick={triggerBackup}
              disabled={isBusy}
            >
              Run backup
            </button>
            <button
              type="button"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400"
              onClick={triggerRestore}
              disabled={isBusy}
            >
              Restore latest
            </button>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-zinc-700" htmlFor="restorePath">
              Restore a specific backup file
            </label>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                id="restorePath"
                type="text"
                value={restorePath}
                onChange={(event) => setRestorePath(event.target.value)}
                placeholder="/backups/backup_2024-02-01.sql.gz"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400"
                onClick={triggerRestore}
                disabled={isBusy}
              >
                Restore file
              </button>
            </div>
          </div>

          {actionMessage ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {actionMessage}
            </p>
          ) : null}
          {actionError ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {actionError}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
