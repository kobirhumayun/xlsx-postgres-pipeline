"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api-client";
import { toast } from "sonner";
import { Sidebar } from "@/components/query/sidebar";
import { QueryEditor } from "@/components/query/query-editor";
import { ResultsDisplay } from "@/components/query/results-display";
import { SavedQueryImportDialog } from "@/components/query/saved-query-import-dialog";
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

const destructiveQueryPattern = /^\s*(?:DROP|ALTER|TRUNCATE|DELETE|UPDATE|INSERT|CREATE)\b/i;

export default function QueryPage() {
    const [query, setQuery] = useState("");
    const [databaseName, setDatabaseName] = useState("");
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingSchema, setIsExportingSchema] = useState(false);
    const [isExportingRepository, setIsExportingRepository] = useState(false);

    // Schema Browser State
    const [dbList, setDbList] = useState([]);
    const [tableList, setTableList] = useState([]);
    const [selectedDb, setSelectedDb] = useState("");

    // Saved Queries State
    const [savedQueries, setSavedQueries] = useState([]);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [editingQuery, setEditingQuery] = useState(null); // Track which query is being edited
    const [isSaving, setIsSaving] = useState(false);
    const [isImportingSavedQueries, setIsImportingSavedQueries] = useState(false);
    const [isExportingSavedQueries, setIsExportingSavedQueries] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [pendingImportFiles, setPendingImportFiles] = useState([]);
    const [savedQueryImportMode, setSavedQueryImportMode] = useState("upsert");
    const [savedQueryImportPreview, setSavedQueryImportPreview] = useState(null);
    const [savedQueryImportResult, setSavedQueryImportResult] = useState(null);
    const [isPreviewingSavedQueryImport, setIsPreviewingSavedQueryImport] = useState(false);

    // Overwrite Confirmation State
    const [isOverwriteDialogOpen, setIsOverwriteDialogOpen] = useState(false);
    const [pendingQuery, setPendingQuery] = useState(null);

    // Duplicate Query Alert State
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
    const [duplicateQueryName, setDuplicateQueryName] = useState("");
    const [isDestructiveQueryDialogOpen, setIsDestructiveQueryDialogOpen] = useState(false);

    // Sidebar State
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Query History State
    const [queryHistory, setQueryHistory] = useState([]);

    useEffect(() => {
        // Load initial data
        fetchJson("/api/structure").then(data => {
            if (data.items) setDbList(data.items);
        }).catch(console.error);

        loadSavedQueries();

        // Load history from localStorage
        try {
            const stored = localStorage.getItem("queryHistory");
            if (stored) {
                setQueryHistory(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to load history", e);
        }
    }, []);

    const addToHistory = (q, db) => {
        const newItem = {
            id: Date.now().toString(),
            query: q,
            databaseName: db,
            timestamp: Date.now()
        };

        setQueryHistory(prev => {
            // Keep last 50 items, remove duplicates if identical query runs again (move to top)
            const filtered = prev.filter(item => item.query.trim() !== q.trim());
            const updated = [newItem, ...filtered].slice(0, 50);
            try {
                localStorage.setItem("queryHistory", JSON.stringify(updated));
            } catch (e) {
                console.warn("Failed to save history to localStorage", e);
            }
            return updated;
        });
    };

    const loadHistoryItem = (item) => {
        // Similar to loading saved query, but simpler
        if (query.trim() && query.trim() !== item.query.trim()) {
            setPendingQuery(item);
            setIsOverwriteDialogOpen(true);
            return;
        }
        performLoad(item);
    };

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

    const executeQuery = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setError(null);

        addToHistory(query, databaseName);

        try {
            const data = await fetchJson("/api/query/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, databaseName: databaseName || undefined }),
            });
            setResults(data);
            if (data.message) {
                toast.success(data.message);
            }
        } catch (err) {
            console.error(err);
            setError(err.message || "Query failed");
            toast.error(err.message || "Query failed");
        } finally {
            setLoading(false);
        }
    };

    const handleRun = async (e) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        if (destructiveQueryPattern.test(query)) {
            setIsDestructiveQueryDialogOpen(true);
            return;
        }

        await executeQuery();
    };

    const handleExport = async () => {
        if (!query.trim()) return;
        setIsExporting(true);
        try {
            const toastId = toast.loading("Exporting query results...");
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
            toast.success("Export successful", { id: toastId });

        } catch (err) {
            console.error(err);
            const msg = err.message || "Export failed";
            setError(msg);
            toast.error(msg);
            toast.dismiss(); // dismiss loading toast if generic error caught without id
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
            setDuplicateQueryName(name);
            setIsDuplicateDialogOpen(true);
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
            toast.success(editingQuery ? "Query updated successfully" : "Query saved successfully");
        } catch (err) {
            console.error(err);
            const msg = err.message || "Failed to save query";
            setError(msg);
            toast.error(msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteQuery = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            await fetch("/api/saved-queries?id=" + id, { method: "DELETE" });
            loadSavedQueries();
            toast.success("Query deleted");
        } catch (err) {
            console.error(err);
            setError("Failed to delete query");
            toast.error("Failed to delete query");
        }
    };

    const handleExportSchema = async (options) => {
        if (!options.databaseName) {
            toast.error("Select a database before exporting schema");
            return;
        }

        setIsExportingSchema(true);
        const toastId = toast.loading("Exporting schema metadata...");

        try {
            const response = await fetch("/api/schema/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(options),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || "Failed to export schema");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filenameFromContentDisposition(
                response.headers.get("content-disposition")
            ) || "database-schema.zip";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("Schema exported", { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to export schema", { id: toastId });
        } finally {
            setIsExportingSchema(false);
        }
    };

    const handleExportRepository = async (options) => {
        if (!options.databaseName) {
            toast.error("Select a database before exporting a repository bundle");
            return;
        }

        setIsExportingRepository(true);
        const toastId = toast.loading("Building repository bundle...");

        try {
            const response = await fetch("/api/repository/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(options),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || "Failed to export repository bundle");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filenameFromContentDisposition(
                response.headers.get("content-disposition")
            ) || "query-context.zip";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("Repository bundle exported", { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to export repository bundle", { id: toastId });
        } finally {
            setIsExportingRepository(false);
        }
    };

    const handleExportSavedQueries = async (ids = null) => {
        const exportIds = Array.isArray(ids) && ids.length > 0
            ? ids
            : savedQueries.map((sq) => sq.id);

        if (exportIds.length === 0) {
            toast.info("No saved queries to export");
            return;
        }

        setIsExportingSavedQueries(true);
        const toastId = toast.loading("Exporting saved queries...");

        try {
            const response = await fetch("/api/saved-queries/files/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: exportIds }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || "Failed to export saved queries");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filenameFromContentDisposition(
                response.headers.get("content-disposition")
            ) || "saved-queries.zip";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("Saved queries exported", { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to export saved queries", { id: toastId });
        } finally {
            setIsExportingSavedQueries(false);
        }
    };

    const handleImportSavedQueries = async (files) => {
        if (files.length === 0) {
            toast.error("Select one or more files to import");
            return;
        }

        setPendingImportFiles(files);
        setSavedQueryImportMode("upsert");
        setSavedQueryImportPreview(null);
        setSavedQueryImportResult(null);
        setIsImportDialogOpen(true);
        await previewSavedQueryImport(files, "upsert");
    };

    const previewSavedQueryImport = async (files, mode) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("mode", mode);

        setIsPreviewingSavedQueryImport(true);

        try {
            const preview = await fetchJson("/api/saved-queries/files/preview", {
                method: "POST",
                body: formData,
            });
            setSavedQueryImportPreview(preview);
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to preview saved queries");
        } finally {
            setIsPreviewingSavedQueryImport(false);
        }
    };

    const handleImportModeChange = async (mode) => {
        setSavedQueryImportMode(mode);
        setSavedQueryImportPreview(null);
        setSavedQueryImportResult(null);
        await previewSavedQueryImport(pendingImportFiles, mode);
    };

    const handleConfirmSavedQueryImport = async () => {
        if (pendingImportFiles.length === 0) return;

        const formData = new FormData();
        pendingImportFiles.forEach((file) => formData.append("files", file));
        formData.append("mode", savedQueryImportMode);

        setIsImportingSavedQueries(true);
        const toastId = toast.loading("Importing saved queries...");

        try {
            const summary = await fetchJson("/api/saved-queries/files/import", {
                method: "POST",
                body: formData,
            });

            setSavedQueryImportResult(summary);
            loadSavedQueries();

            const message = [
                `${summary.created} created`,
                `${summary.updated} updated`,
                `${summary.skipped} skipped`,
            ].join(", ");

            if (summary.errors > 0) {
                toast.warning(`Import finished: ${message}`, { id: toastId });
            } else {
                toast.success(`Import finished: ${message}`, { id: toastId });
            }
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to import saved queries", { id: toastId });
        } finally {
            setIsImportingSavedQueries(false);
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
        if (sq.databaseName) {
            setDatabaseName(sq.databaseName);
            // Sync Sidebar selection if DB exists, otherwise keep current or show 'select'
            if (dbList.includes(sq.databaseName)) {
                setSelectedDb(sq.databaseName);
            }
        }
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
                onExportSchema={handleExportSchema}
                isExportingSchema={isExportingSchema}
                onExportRepository={handleExportRepository}
                isExportingRepository={isExportingRepository}
                // Saved Queries Props
                savedQueries={savedQueries}
                onDeleteQuery={handleDeleteQuery}
                onLoadQuery={loadQueryIntoEditor}
                onEditQuery={handleEditQuery}
                onImportSavedQueries={handleImportSavedQueries}
                onExportSavedQueries={handleExportSavedQueries}
                onExportSelectedSavedQueries={handleExportSavedQueries}
                onExportSingleSavedQuery={(sq) => handleExportSavedQueries([sq.id])}
                isImportingSavedQueries={isImportingSavedQueries}
                isExportingSavedQueries={isExportingSavedQueries}
                // History Props
                queryHistory={queryHistory}
                onLoadHistory={loadHistoryItem}
                // Sidebar Props
                collapsed={isSidebarCollapsed}
                setCollapsed={setIsSidebarCollapsed}
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
                            loading={loading}
                            error={error}
                            onRun={handleRun}
                            isExporting={isExporting}
                            onExport={handleExport}
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
                                loading={loading}
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

            <SavedQueryImportDialog
                open={isImportDialogOpen}
                onOpenChange={(open) => {
                    setIsImportDialogOpen(open);
                    if (!open) {
                        setPendingImportFiles([]);
                        setSavedQueryImportPreview(null);
                        setSavedQueryImportResult(null);
                    }
                }}
                files={pendingImportFiles}
                mode={savedQueryImportMode}
                onModeChange={handleImportModeChange}
                preview={savedQueryImportPreview}
                result={savedQueryImportResult}
                isPreviewing={isPreviewingSavedQueryImport}
                isImporting={isImportingSavedQueries}
                onConfirm={handleConfirmSavedQueryImport}
            />

            {/* Duplicate Name Alert */}
            <AlertDialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate Query Name</AlertDialogTitle>
                        <AlertDialogDescription>
                            A query with the name &quot;{duplicateQueryName}&quot; already exists. Please choose a different name.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setIsDuplicateDialogOpen(false)}>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isDestructiveQueryDialogOpen} onOpenChange={setIsDestructiveQueryDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Run write query?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This query can change database objects or data. Confirm that you want to run it against {databaseName || "the selected database"}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setIsDestructiveQueryDialogOpen(false);
                                executeQuery();
                            }}
                        >
                            Run Query
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function filenameFromContentDisposition(value) {
    if (!value) return null;

    const match = value.match(/filename="?([^";]+)"?/i);
    return match ? match[1] : null;
}
