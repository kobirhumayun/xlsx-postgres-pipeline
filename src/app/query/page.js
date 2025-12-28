"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/api-client";

export default function QueryPage() {
    const [query, setQuery] = useState("");
    const [databaseName, setDatabaseName] = useState("");
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isExporting, setIsExporting] = useState(false);

    const handleRun = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        setResults(null);

        try {
            const data = await fetchJson("/api/query/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, databaseName: databaseName || undefined }),
            });
            setResults(data);
        } catch (err) {
            console.error(err);
            setError(err.message || "Query failed");
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        if (!query.trim()) return;
        setIsExporting(true);
        try {
            const response = await fetch("/api/query/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, databaseName: databaseName || undefined }),
            });

            if (!response.ok) {
                const json = await response.json();
                throw new Error(json.error || "Export failed");
            }

            // Handle file download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "query_results.xlsx";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (err) {
            console.error(err);
            setError(err.message || "Export failed");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-8">
                <header className="space-y-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Advanced Tools
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Custom Queries
                    </h1>
                    <p className="text-base text-zinc-600">
                        Execute raw SQL queries against your database and export results.
                    </p>
                </header>

                <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <div className="grid gap-4">
                        <label className="flex flex-col gap-2 text-sm font-medium">
                            Database Name (Unique to this session)
                            <input
                                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                value={databaseName}
                                onChange={(e) => setDatabaseName(e.target.value)}
                                placeholder="default"
                            />
                            <span className="text-xs text-zinc-500">Optional. Leave empty for default database.</span>
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-medium">
                            SQL Query
                            <textarea
                                className="h-40 rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="SELECT * FROM users LIMIT 10;"
                            />
                        </label>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleRun}
                                disabled={loading}
                                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                            >
                                {loading ? "Running..." : "Run Query"}
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={isExporting}
                                className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50"
                            >
                                {isExporting ? "Exporting..." : "Export to Excel"}
                            </button>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}
                    </div>
                </section>

                {results && (
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Results</h2>
                            <span className="text-sm text-zinc-500">{results.rowCount} rows</span>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
                            {results.rows.length > 0 ? (
                                <table className="min-w-full text-left text-sm">
                                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                                        <tr>
                                            {results.fields.map((field) => (
                                                <th key={field} className="px-4 py-3 whitespace-nowrap">{field}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {results.rows.map((row, i) => (
                                            <tr key={i} className="hover:bg-zinc-50">
                                                {results.fields.map((field) => (
                                                    <td key={field} className="px-4 py-3 whitespace-nowrap text-zinc-700">
                                                        {row[field] === null ? <span className="text-zinc-400">NULL</span> : String(row[field])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center text-zinc-500">
                                    No rows returned (Command: {results.command})
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
