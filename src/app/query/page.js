"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api-client";
import { Sidebar } from "@/components/query/sidebar";
import { QueryEditor } from "@/components/query/query-editor";
import { ResultsDisplay } from "@/components/query/results-display";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

    // Overwrite Confirmation State
    const [isOverwriteDialogOpen, setIsOverwriteDialogOpen] = useState(false);
    const [pendingQuery, setPendingQuery] = useState(null);

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
            setPendingQuery(sq);
            setIsOverwriteDialogOpen(true);
            return;
        }
        performLoad(sq);
    };

    const performLoad = (sq) => {
        setQuery(sq.query);
        if (sq.databaseName) setDatabaseName(sq.databaseName);
        setPendingQuery(null);
        setIsOverwriteDialogOpen(false);
    };

    const handleConfirmLoad = () => {
        if (pendingQuery) {
            performLoad(pendingQuery);
        }
    };

    const insertTableName = (fullName) => {
        setQuery(prev => prev + ` ${fullName} `);
    };

    return (
        <div className="flex h-screen w-full bg-zinc-50 overflow-hidden text-zinc-900 font-sans">
            {/* Sidebar */}
            <Sidebar
                // Schema Browser Props
                dbList={dbList}
                tableList={tableList}
                selectedDb={selectedDb}
                setSelectedDb={setSelectedDb}
                onInsertTable={insertTableName}
                // Saved Queries Props
                savedQueries={savedQueries}
                onDeleteQuery={handleDeleteQuery}
                onLoadQuery={loadQueryIntoEditor}
                onEditQuery={handleEditQuery}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <header className="px-6 py-4 bg-white border-b border-zinc-200 flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                            Custom Queries
                        </h1>
                        <p className="text-sm text-zinc-500">
                            Execute raw SQL queries and export results
                        </p>
                    </div>
                </header>

                <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
                    {/* Top Pane: Query Editor */}
                    <div className="flex-1 min-h-[300px] flex flex-col">
                        <QueryEditor
                            query={query}
                            setQuery={setQuery}
                            databaseName={databaseName}
                            // Note: setDatabaseName is no longer exposed in Editor, it's driven by Sidebar selection mostly, 
                            // but we might want to keep it locally if we want manual override? 
                            // For now, based on plan, we removed the input.
                            loading={loading}
                            error={error}
                            onRun={handleRun}
                            onOpenSaveDialog={handleOpenSaveDialog}
                            isSaveDialogOpen={isSaveDialogOpen}
                            setIsSaveDialogOpen={setIsSaveDialogOpen}
                            isSaving={isSaving}
                            editingQuery={editingQuery}
                            onSaveQuery={handleSaveQuery}
                        />
                    </div>

                    {/* Bottom Pane: Results */}
                    {results && (
                        <div className="flex-1 min-h-[300px] border-t border-zinc-200 pt-6 flex flex-col min-w-0">
                            <ResultsDisplay
                                results={results}
                                isExporting={isExporting}
                                onExport={handleExport}
                            />
                        </div>
                    )}
                </div>
            </main>

            {/* Overwrite Confirmation Alert */}
            <AlertDialog open={isOverwriteDialogOpen} onOpenChange={setIsOverwriteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes in the editor. Are you sure you want to load this query and overwrite your current work?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPendingQuery(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmLoad}>Overwrite</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
