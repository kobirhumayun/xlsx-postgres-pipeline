"use client";

import { useEffect, useMemo, useState } from "react";

const emptyForm = {
  slug: "",
  name: "",
  defaultSheetName: "",
  pkFields: "",
  mapping: "{\n  \"ColumnName\": \"field_name\"\n}",
};

import { fetchJson } from "@/lib/api-client";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState([]);
  const [formState, setFormState] = useState(emptyForm);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);

  const parsedPkFields = useMemo(() => {
    return formState.pkFields
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);
  }, [formState.pkFields]);

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });

    let mapping = {};
    try {
      mapping = formState.mapping ? JSON.parse(formState.mapping) : {};
    } catch (error) {
      setStatus({ type: "error", message: "Mapping must be valid JSON." });
      return;
    }

    setLoading(true);
    try {
      const data = await fetchJson("/api/datasets", {
        method: "POST",
        body: JSON.stringify({
          slug: formState.slug,
          name: formState.name,
          defaultSheetName: formState.defaultSheetName || null,
          pkFields: parsedPkFields,
          mapping,
        }),
      });

      setDatasets((prev) => {
        const next = prev.filter((item) => item.slug !== data.dataset.slug);
        return [data.dataset, ...next];
      });
      setFormState(emptyForm);
      setStatus({ type: "success", message: "Dataset saved." });
    } catch (error) {
      console.error("Failed to save dataset", error);
      setStatus({
        type: "error",
        message: error.message || "Failed to save dataset.",
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
            Dataset Registry
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Define datasets for Excel ingestion
          </h1>
          <p className="max-w-2xl text-base text-zinc-600">
            Save each Excel schema, its primary key fields, and column mapping.
            This configuration drives ingestion, parsing, and downstream reports.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Create or update a dataset</h2>
            <p className="text-sm text-zinc-500">
              Slug must be lowercase and unique. Mapping is stored as JSON.
            </p>
          </div>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Slug
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  name="slug"
                  value={formState.slug}
                  onChange={handleChange}
                  placeholder="orders-2024"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Display name
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  name="name"
                  value={formState.name}
                  onChange={handleChange}
                  placeholder="Orders 2024"
                  required
                />
              </label>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Default sheet name
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  name="defaultSheetName"
                  value={formState.defaultSheetName}
                  onChange={handleChange}
                  placeholder="Sheet1"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Primary key fields (comma-separated)
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  name="pkFields"
                  value={formState.pkFields}
                  onChange={handleChange}
                  placeholder="order_id, line_number"
                />
              </label>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Column mapping JSON
              <textarea
                className="min-h-[160px] rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
                name="mapping"
                value={formState.mapping}
                onChange={handleChange}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save dataset"}
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
            <h2 className="text-lg font-semibold">Existing datasets</h2>
            <span className="text-sm text-zinc-500">
              {datasets.length} saved
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {datasets.map((dataset) => (
              <article
                key={dataset.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{dataset.name}</h3>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {dataset.slug}
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-sm text-zinc-600">
                  <p>
                    <span className="font-medium text-zinc-800">
                      Default sheet:
                    </span>{" "}
                    {dataset.defaultSheetName || "Not set"}
                  </p>
                  <p>
                    <span className="font-medium text-zinc-800">
                      Primary keys:
                    </span>{" "}
                    {(dataset.pkFields ?? []).length
                      ? dataset.pkFields.join(", ")
                      : "Not set"}
                  </p>
                </div>
              </article>
            ))}
          </div>
          {!loading && datasets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              No datasets saved yet. Add the first one above.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
