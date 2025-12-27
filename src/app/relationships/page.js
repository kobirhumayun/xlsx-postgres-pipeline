"use client";

import { useEffect, useMemo, useState } from "react";

const emptyForm = {
  name: "",
  leftDatasetId: "",
  rightDatasetId: "",
  joinMapping: "{\n  \"left_field\": \"right_field\"\n}",
};

export default function RelationshipsPage() {
  const [datasets, setDatasets] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [formState, setFormState] = useState(emptyForm);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);

  const datasetOptions = useMemo(
    () => datasets.map((dataset) => ({ id: dataset.id, name: dataset.name })),
    [datasets]
  );

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [datasetsResponse, relationshipsResponse] = await Promise.all([
          fetch("/api/datasets"),
          fetch("/api/relationships"),
        ]);
        const datasetsPayload = await datasetsResponse.json();
        const relationshipsPayload = await relationshipsResponse.json();
        if (isMounted) {
          setDatasets(datasetsPayload.datasets ?? []);
          setRelationships(relationshipsPayload.relationships ?? []);
        }
      } catch (error) {
        console.error("Failed to load relationships data", error);
        if (isMounted) {
          setStatus({
            type: "error",
            message: "Failed to load datasets or relationships.",
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    loadData();
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

    let joinMapping = {};
    try {
      joinMapping = formState.joinMapping
        ? JSON.parse(formState.joinMapping)
        : {};
    } catch (error) {
      setStatus({ type: "error", message: "Join mapping must be valid JSON." });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          leftDatasetId: Number(formState.leftDatasetId),
          rightDatasetId: Number(formState.rightDatasetId),
          joinMapping,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json();
        throw new Error(errorPayload.error ?? "Failed to save relationship");
      }

      const data = await response.json();
      setRelationships((prev) => [data.relationship, ...prev]);
      setFormState(emptyForm);
      setStatus({ type: "success", message: "Relationship saved." });
    } catch (error) {
      console.error("Failed to save relationship", error);
      setStatus({
        type: "error",
        message: error.message || "Failed to save relationship.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Relationships
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Define dataset joins
          </h1>
          <p className="max-w-2xl text-base text-zinc-600">
            Configure how datasets relate to each other to power missing-related
            data reports and join checks.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Create a relationship</h2>
            <p className="text-sm text-zinc-500">
              Choose datasets and define how fields map between them.
            </p>
          </div>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Relationship name
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                name="name"
                value={formState.name}
                onChange={handleChange}
                placeholder="Orders → Customers"
                required
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Left dataset
                <select
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  name="leftDatasetId"
                  value={formState.leftDatasetId}
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
                Right dataset
                <select
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  name="rightDatasetId"
                  value={formState.rightDatasetId}
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
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Join mapping JSON
              <textarea
                className="min-h-[140px] rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
                name="joinMapping"
                value={formState.joinMapping}
                onChange={handleChange}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save relationship"}
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
            <h2 className="text-lg font-semibold">Saved relationships</h2>
            <span className="text-sm text-zinc-500">
              {relationships.length} saved
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {relationships.map((relationship) => (
              <article
                key={relationship.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">
                    {relationship.name}
                  </h3>
                </div>
                <div className="mt-3 space-y-2 text-sm text-zinc-600">
                  <p>
                    <span className="font-medium text-zinc-800">Left:</span>{" "}
                    {relationship.leftDataset?.name || "Unknown"}
                  </p>
                  <p>
                    <span className="font-medium text-zinc-800">Right:</span>{" "}
                    {relationship.rightDataset?.name || "Unknown"}
                  </p>
                </div>
              </article>
            ))}
          </div>
          {!loading && relationships.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              No relationships saved yet. Add the first one above.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
