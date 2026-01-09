"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api-client";
import { Trash2, Save, Play, Download } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    const [newQueryName, setNewQueryName] = useState("");
    const [newQueryDesc, setNewQueryDesc] = useState("");
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

            // Auto-set the query database context if desired, or let user type it manually?
            // Simpler to set the field.
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

    const handleSaveQuery = async () => {
        if (!newQueryName.trim() || !query.trim()) return;
        setIsSaving(true);
        try {
            await fetchJson("/api/saved-queries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newQueryName,
                    description: newQueryDesc,
                    query: query,
                    databaseName: databaseName
                }),
            });
            setIsSaveDialogOpen(false);
            setNewQueryName("");
            setNewQueryDesc("");
            loadSavedQueries();
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to save query");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteQuery = async (id, e) => {
        if (e) e.stopPropagation(); // Stop propagation if event exists
        try {
            await fetch("/api/saved-queries?id=" + id, { method: "DELETE" });
            loadSavedQueries();
        } catch (err) {
            console.error(err);
            setError("Failed to delete query");
        }
    };

    const loadQueryIntoEditor = (sq) => {
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
                    <aside className="lg:col-span-1 space-y-4">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
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
                                <ul className="space-y-1 max-h-[300px] overflow-y-auto">
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
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm flex flex-col">
                            <h2 className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 p-2 rounded mb-2">
                                Saved Queries
                            </h2>
                            <div className="flex-1 overflow-y-auto max-h-[300px]">
                                {savedQueries.length === 0 ? (
                                    <p className="text-xs text-zinc-400 italic px-2">No saved queries</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {savedQueries.map(sq => (
                                            <li key={sq.id} className="group flex items-start justify-between rounded p-2 hover:bg-zinc-50 border border-transparent hover:border-zinc-100 cursor-pointer" onClick={() => loadQueryIntoEditor(sq)}>
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-medium text-zinc-900 truncate" title={sq.name}>{sq.name}</p>
                                                    {sq.description && <p className="text-xs text-zinc-500 truncate" title={sq.description}>{sq.description}</p>}
                                                </div>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <button
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-600 transition-opacity"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Saved Query?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to delete <strong>{sq.name}</strong>? This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={(e) => handleDeleteQuery(sq.id, e)}
                                                                className="bg-red-600 hover:bg-red-700 text-white hover:text-white"
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* Main: Query Editor */}
                    <section className="lg:col-span-3 grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                        <div className="grid gap-4">
                            <label className="flex flex-col gap-2 text-sm font-medium">
                                Target Database
                                <input
                                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    value={databaseName}
                                    onChange={(e) => setDatabaseName(e.target.value)}
                                    placeholder="default"
                                />
                                <span className="text-xs text-zinc-500">Auto-filled from browser, or type manually.</span>
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
                                <Button
                                    onClick={handleRun}
                                    disabled={loading}
                                    className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                                >
                                    <Play className="w-4 h-4 mr-2" />
                                    {loading ? "Running..." : "Run Query"}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleExport}
                                    disabled={isExporting}
                                    className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    {isExporting ? "Exporting..." : "Export to Excel"}
                                </Button>

                                <div className="flex-1" />

                                <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="rounded-full">
                                            <Save className="w-4 h-4 mr-2" />
                                            Save Query
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[425px]">
                                        <DialogHeader>
                                            <DialogTitle>Save Query</DialogTitle>
                                            <DialogDescription>
                                                Save this query for future use.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="name" className="text-right">
                                                    Name
                                                </Label>
                                                <Input
                                                    id="name"
                                                    value={newQueryName}
                                                    onChange={(e) => setNewQueryName(e.target.value)}
                                                    className="col-span-3"
                                                />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="description" className="text-right">
                                                    Description
                                                </Label>
                                                <Input
                                                    id="description"
                                                    value={newQueryDesc}
                                                    onChange={(e) => setNewQueryDesc(e.target.value)}
                                                    className="col-span-3"
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" onClick={handleSaveQuery} disabled={isSaving}>
                                                {isSaving ? "Saving..." : "Save changes"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            {error && (
                                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                                    {error}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

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
