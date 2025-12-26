"use client";

import { useEffect, useMemo, useState } from "react";

const emptyForm = {
  relationshipId: "",
  limit: "200",
};

export default function ReportsPage() {
  const [relationships, setRelationships] = useState([]);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState(emptyForm);

  const relationshipOptions = useMemo(
    () =>
      relationships.map((relationship) => ({
        id: relationship.id,
        name: relationship.name,
      })),
    [relationships]
  );

  useEffect(() => {
    let isMounted = true;
    const loadRelationships = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/relationships");
        const data = await response.json();
        if (isMounted) {
          setRelationships(data.relationships ?? []);
        }
      } catch (error) {
        console.error("Failed to load relationships", error);
        if (isMounted) {
          setStatus({
            type: "error",
            message: "Failed to load relationships.",
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    loadRelationships();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });
    setLoading(true);
    setRows([]);

    try {
      const response = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: "missing_related",
          params: {
            relationshipId: Number(formState.relationshipId),
            limit: Number(formState.limit) || 200,
          },
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to run report.");
      }

      setRows(payload.rows ?? []);
      setStatus({
        type: "success",
        message: `Returned ${payload.summary?.count ?? 0} rows.`,
      });
    } catch (error) {
      console.error("Failed to run report", error);
      setStatus({
        type: "error",
        message: error.message || "Failed to run report.",
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
            Reports
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Missing related data report
          </h1>
          <p className="text-base text-zinc-600">
            Select a relationship and run an anti-join report against curated
            data.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Run report</h2>
            <p className="text-sm text-zinc-500">
              Reports are limited to a configurable number of rows.
            </p>
          </div>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Relationship
              <select
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                name="relationshipId"
                value={formState.relationshipId}
                onChange={handleChange}
                required
              >
                <option value="">Select relationship</option>
                {relationshipOptions.map((relationship) => (
                  <option key={relationship.id} value={relationship.id}>
                    {relationship.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Result limit
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                name="limit"
                value={formState.limit}
                onChange={handleChange}
                type="number"
                min="1"
                max="1000"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                {loading ? "Running..." : "Run report"}
              </button>
              {status.message && (
                <span
                  className={`text-sm ${
                    status.type === "error"
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
            <h2 className="text-lg font-semibold">Results</h2>
            <span className="text-sm text-zinc-500">{rows.length} rows</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Business key</th>
                  <th className="px-4 py-3">Normalized payload</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-zinc-100 text-zinc-700"
                  >
                    <td className="px-4 py-3 font-medium">
                      {row.businessKey}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                      {JSON.stringify(row.normalized)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-sm text-zinc-500"
                      colSpan={2}
                    >
                      No results yet. Run a report to see data here.
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
