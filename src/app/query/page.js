"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api-client";
import { SavedQueriesList } from "@/components/query/saved-queries-list";
import { QueryEditor } from "@/components/query/query-editor";

export default function QueryPage() {
    const [query, setQuery] = useState("");
    const [databaseName, setDatabaseName] = useState("");
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isExporting, setIsExporting] = useState(false);

    // Schema Browser State
    const [dbList, setDbList] = useState([]);
    const [tableList, setTableList] = useState([]);
    const [selectedDb, setSelectedDb] = useState("");

    // Saved Queries State
    const [savedQueries, setSavedQueries] = useState([]);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [editingQuery, setEditingQuery] = useState(null); // Track which query is being edited
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchJson("/api/structure").then(data => {
            if (data.items) setDbList(data.items);
        }).catch(console.error);

        loadSavedQueries();
    }, []);

    const loadSavedQueries = () => {
        fetchJson("/api/saved-queries").then(data => {
            if (Array.isArray(data)) setSavedQueries(data);
        }).catch(console.error);
    };

    useEffect(() => {
        if (selectedDb) {
            fetchJson(`/api/structure?database=${selectedDb}`).then(data => {
                if (data.type === 'tables') setTableList(data.items);
            }).catch(console.error);

            setDatabaseName(selectedDb);
        } else {
            setTableList([]);
        }
    }, [selectedDb]);

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

    // Open dialog for creating new query
    const handleOpenSaveDialog = () => {
        setEditingQuery(null);
        setIsSaveDialogOpen(true);
    };

    // Open dialog for editing existing query
    const handleEditQuery = (sq) => {
        setEditingQuery(sq);
        setIsSaveDialogOpen(true);
    };

    const handleSaveQuery = async ({ name, description, query, databaseName }) => {
        if (!name.trim()) return;

        // Duplicate Name Check
        const duplicate = savedQueries.find(sq =>
            sq.name.toLowerCase() === name.trim().toLowerCase() &&
            sq.id !== editingQuery?.id
        );

        if (duplicate) {
            alert(`A query with the name "${name}" already exists. Please choose a different name.`);
            return;
        }

        // Now we use the values passed from the Dialog, which are either:
        // 1. The edited values from the "Edit" mode
        // 2. The default values (current editor state) from the "Create" mode

        setIsSaving(true);
        try {
            const method = editingQuery ? "PUT" : "POST";
            const body = {
                id: editingQuery?.id,
                name,
                description,
                query: query,
                databaseName: databaseName
            };

            await fetchJson("/api/saved-queries", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            setIsSaveDialogOpen(false);
            setEditingQuery(null);
            loadSavedQueries();
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to save query");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteQuery = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            await fetch("/api/saved-queries?id=" + id, { method: "DELETE" });
            loadSavedQueries();
        } catch (err) {
            console.error(err);
            setError("Failed to delete query");
        }
    };

    const loadQueryIntoEditor = (sq) => {
        // Dirty State Check
        if (query.trim() && query.trim() !== sq.query.trim()) {
            if (!window.confirm("You have unsaved changes in the editor. Are you sure you want to load this query and overwrite your current work?")) {
                return;
            }
        }

        setQuery(sq.query);
        if (sq.databaseName) setDatabaseName(sq.databaseName);
    };

    const insertTableName = (fullName) => {
        setQuery(prev => prev + ` ${fullName} `);
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

                <div className="grid gap-6 lg:grid-cols-4">

                    {/* Sidebar: Schema Browser & Saved Queries */}
                    <aside className="lg:col-span-1 space-y-4 flex flex-col h-[calc(100vh-200px)] sticky top-6">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm flex-shrink-0">
                            <h2 className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 p-2 rounded mb-2">
                                Schema Browser
                            </h2>
                            <label className="block mb-2 text-sm font-medium">
                                Database
                                <select
                                    className="w-full mt-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                                    value={selectedDb}
                                    onChange={(e) => setSelectedDb(e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    {dbList.map(db => <option key={db} value={db}>{db}</option>)}
                                </select>
                            </label>

                            <div className="mt-4">
                                <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Tables</h3>
                                <ul className="space-y-1 max-h-[200px] overflow-y-auto">
                                    {tableList.map(t => (
                                        <li key={t.fullName}>
                                            <button
                                                onClick={() => insertTableName(t.fullName)}
                                                className="text-left w-full text-sm text-zinc-700 hover:bg-zinc-100 px-2 py-1 rounded truncate"
                                                title="Click to insert"
                                            >
                                                {t.name}
                                            </button>
                                        </li>
                                    ))}
                                    {selectedDb && tableList.length === 0 && (
                                        <li className="text-xs text-zinc-400 italic px-2">No tables found (public)</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* Saved Queries List */}
                        <div className="flex-1 min-h-0">
                            <SavedQueriesList
                                savedQueries={savedQueries}
                                onDelete={handleDeleteQuery}
                                onLoad={loadQueryIntoEditor}
                                onEdit={handleEditQuery}
                            />
                        </div>
                    </aside>

                    {/* Main: Query Editor */}
                    <QueryEditor
                        query={query}
                        setQuery={setQuery}
                        databaseName={databaseName}
                        setDatabaseName={setDatabaseName}
                        results={results}
                        loading={loading}
                        error={error}
                        isExporting={isExporting}
                        onRun={handleRun}
                        onExport={handleExport}
                        onOpenSaveDialog={handleOpenSaveDialog}
                        isSaveDialogOpen={isSaveDialogOpen}
                        setIsSaveDialogOpen={setIsSaveDialogOpen}
                        isSaving={isSaving}
                        editingQuery={editingQuery}
                        onSaveQuery={handleSaveQuery}
                    />
                </div>
            </main>
        </div>
    );
}
