"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api-client";

const emptyFlexibleForm = {
  databaseName: "",
  tableName: "",
  sheetName: "",
};

export default function ImportPage() {
  const [summary, setSummary] = useState(null);
  const [errors, setErrors] = useState([]);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);

  // Flexible import state
  const [flexibleFormState, setFlexibleFormState] = useState(emptyFlexibleForm);
  const [dbList, setDbList] = useState([]);
  const [tableList, setTableList] = useState([]);

  // Load databases on mount
  useEffect(() => {
    fetchJson("/api/structure").then(data => {
      if (data.items) setDbList(data.items);
    }).catch(console.error);
  }, []);

  // Load tables when DB changes
  useEffect(() => {
    if (flexibleFormState.databaseName) {
      fetchJson(`/api/structure?database=${flexibleFormState.databaseName}`).then(data => {
        if (data.type === 'tables') setTableList(data.items);
      }).catch(console.error);
    } else {
      setTableList([]);
    }
  }, [flexibleFormState.databaseName]);


  const handleFlexibleChange = (event) => {
    const { name, value } = event.target;
    setFlexibleFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setStatus({ type: "error", message: "Please select a file to upload." });
      return;
    }
    setStatus({ type: "idle", message: "" });
    setSummary(null);
    setErrors([]);
    setLoading(true);

    try {
      const payload = new FormData();
      const url = "/api/import/flexible";

      if (flexibleFormState.databaseName) payload.append("databaseName", flexibleFormState.databaseName);
      payload.append("tableName", flexibleFormState.tableName);
      payload.append("sheetName", flexibleFormState.sheetName);
      payload.append("file", file);

      const data = await fetchJson(url, {
        method: "POST",
        body: payload,
      });

      setSummary(data.summary);
      setErrors(data.errors ?? []);
      setStatus({ type: "success", message: "Import completed." });
    } catch (error) {
      console.error("Failed to import file", error);
      setStatus({
        type: "error",
        message: error.message || "Failed to import file.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Import Runs
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Upload Excel files
          </h1>
          <p className="text-base text-zinc-600">
            Import Excel data directly into your database tables. First row must be headers.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">
              Flexible Import
            </h2>
            <p className="text-sm text-zinc-500">
              Import into any database table. Ensure Excel headers match table columns.
            </p>
          </div>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Database
              <select
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                name="databaseName"
                value={flexibleFormState.databaseName}
                onChange={handleFlexibleChange}
              >
                <option value="">-- Select Database --</option>
                {dbList.map(db => (
                  <option key={db} value={db}>{db}</option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">Select database to populate table list.</span>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Table Name
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                name="tableName"
                value={flexibleFormState.tableName}
                onChange={handleFlexibleChange}
                list="table-options"
                placeholder="public.my_table"
                required
              />
              <datalist id="table-options">
                {tableList.map(t => (
                  <option key={t.fullName} value={t.fullName} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Sheet name (optional)
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                name="sheetName"
                value={flexibleFormState.sheetName}
                onChange={handleFlexibleChange}
                placeholder="Sheet1"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Excel file
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                required
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                {loading ? "Importing..." : "Start import"}
              </button>
              {status.message && (
                <span
                  className={`text-sm ${status.type === "error"
                    ? "text-red-600"
                    : "text-emerald-600"
                    }`}
                >
                  {status.message}
                </span>
              )}
            </div>
          </form>
        </section>

        <section className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Import summary</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Total rows", value: summary?.totalRows ?? 0 },
              { label: "Parsed OK", value: summary?.okRows ?? 0 },
              { label: "Errors", value: summary?.errorRows ?? 0 },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm"
              >
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Row errors</h2>
            <span className="text-sm text-zinc-500">
              {errors.length} rows
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Errors</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((row) => (
                  <tr
                    key={`${row.rowNumber}`}
                    className="border-t border-zinc-100 text-zinc-700"
                  >
                    <td className="px-4 py-3 font-medium">{row.rowNumber}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                      {typeof row.error === 'string' ? row.error : JSON.stringify(row.errors || row.error)}
                    </td>
                  </tr>
                ))}
                {errors.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-sm text-zinc-500"
                      colSpan={2}
                    >
                      No errors reported yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
