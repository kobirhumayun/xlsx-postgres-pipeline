"use client";

import { useEffect, useMemo, useState } from "react";

const emptyForm = {
  datasetId: "",
  sheetName: "",
};

import { fetchJson } from "@/lib/api-client";

export default function ImportPage() {
  const [datasets, setDatasets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [errors, setErrors] = useState([]);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState(emptyForm);

  const datasetOptions = useMemo(
    () => datasets.map((dataset) => ({ id: dataset.id, name: dataset.name })),
    [datasets]
  );

  useEffect(() => {
    let isMounted = true;
    const loadDatasets = async () => {
      setLoading(true);
      try {
        const data = await fetchJson("/api/datasets");
        if (isMounted) {
          setDatasets(data.datasets ?? []);
        }
      } catch (error) {
        console.error("Failed to load datasets", error);
        if (isMounted) {
          setStatus({
            type: "error",
            message: "Failed to load datasets.",
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    loadDatasets();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
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
      payload.append("datasetId", formState.datasetId);
      payload.append("sheetName", formState.sheetName);
      payload.append("file", file);

      const data = await fetchJson("/api/import", {
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
            Parse Excel rows, capture errors, and write raw and curated records.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Run an import</h2>
            <p className="text-sm text-zinc-500">
              Select a dataset definition and choose the worksheet to ingest.
            </p>
          </div>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Dataset
              <select
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                name="datasetId"
                value={formState.datasetId}
                onChange={handleChange}
                required
              >
                <option value="">Select dataset</option>
                {datasetOptions.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Sheet name (optional)
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                name="sheetName"
                value={formState.sheetName}
                onChange={handleChange}
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
                      {JSON.stringify(row.errors)}
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
