"use client";

import { useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/api-client";
import { Trash2, Save, Play, Download, Pencil } from "lucide-react";
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
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editQueryId, setEditQueryId] = useState(null);
    const [editQueryName, setEditQueryName] = useState("");
    const [editQueryDesc, setEditQueryDesc] = useState("");
    const [editQueryText, setEditQueryText] = useState("");
    const [editDatabaseName, setEditDatabaseName] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [savedQueriesLoading, setSavedQueriesLoading] = useState(false);
    const [savedQueriesError, setSavedQueriesError] = useState(null);
    const [savedQueriesNotice, setSavedQueriesNotice] = useState(null);
    const [savedQuerySearch, setSavedQuerySearch] = useState("");
    const [lastLoadedQuery, setLastLoadedQuery] = useState("");
    const [lastLoadedDatabaseName, setLastLoadedDatabaseName] = useState("");
    const [isConfirmLoadOpen, setIsConfirmLoadOpen] = useState(false);
    const [pendingLoadQuery, setPendingLoadQuery] = useState(null);
    const savedQueriesScrollRef = useRef(null);
    const refreshStateRef = useRef({ shouldRestoreScroll: false, focusId: null, scrollTop: 0 });
    const noticeTimeoutRef = useRef(null);
    const trimmedNewQueryName = newQueryName.trim();
    const trimmedQuery = query.trim();
    const isSaveNameMissing = !trimmedNewQueryName;
    const isSaveQueryMissing = !trimmedQuery;
    const isDuplicateQueryName = !!trimmedNewQueryName && savedQueries.some((sq) => {
        const existingName = sq.name ? sq.name.trim().toLowerCase() : "";
        return existingName && existingName === trimmedNewQueryName.toLowerCase();
    });
    const isSaveDisabled = isSaving || isSaveNameMissing || isSaveQueryMissing || isDuplicateQueryName;
    const trimmedSavedQuerySearch = savedQuerySearch.trim();
    const normalizedSavedQuerySearch = trimmedSavedQuerySearch.toLowerCase();
    const filteredSavedQueries = normalizedSavedQuerySearch
        ? savedQueries.filter((sq) => {
            const name = sq.name ? sq.name.toLowerCase() : "";
            const description = sq.description ? sq.description.toLowerCase() : "";
            return name.includes(normalizedSavedQuerySearch) || description.includes(normalizedSavedQuerySearch);
        })
        : savedQueries;
    const hasUnsavedChanges = query !== lastLoadedQuery || databaseName !== lastLoadedDatabaseName;

    const formatTimestamp = (value) => {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const absMs = Math.abs(diffMs);
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        const week = 7 * day;
        if (absMs < week) {
            const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
            if (absMs < hour) {
                const minutes = Math.round(diffMs / minute);
                return rtf.format(minutes, "minute");
            }
            if (absMs < day) {
                const hours = Math.round(diffMs / hour);
                return rtf.format(hours, "hour");
            }
            const days = Math.round(diffMs / day);
            return rtf.format(days, "day");
        }
        const options = { month: "short", day: "numeric" };
        if (date.getFullYear() !== now.getFullYear()) {
            options.year = "numeric";
        }
        return new Intl.DateTimeFormat("en", options).format(date);
    };

    const buildSavedQueryMeta = (sq) => {
        const parts = [];
        if (sq.databaseName) parts.push(sq.databaseName);
        const updatedLabel = formatTimestamp(sq.updatedAt);
        if (updatedLabel) parts.push(`Updated ${updatedLabel}`);
        return parts.join(" • ");
    };

    useEffect(() => {
        fetchJson("/api/structure").then(data => {
            if (data.items) setDbList(data.items);
        }).catch(console.error);

        loadSavedQueries();

        return () => {
            if (noticeTimeoutRef.current) {
                clearTimeout(noticeTimeoutRef.current);
            }
        };
    }, []);

    const loadSavedQueries = async ({ preserveScroll = false, focusId = null } = {}) => {
        if (preserveScroll && savedQueriesScrollRef.current) {
            refreshStateRef.current = {
                shouldRestoreScroll: true,
                focusId,
                scrollTop: savedQueriesScrollRef.current.scrollTop,
            };
        }
        setSavedQueriesLoading(true);
        setSavedQueriesError(null);
        try {
            const data = await fetchJson("/api/saved-queries");
            if (Array.isArray(data)) setSavedQueries(data);
        } catch (err) {
            console.error(err);
            setSavedQueriesError(err.message || "Failed to load saved queries");
        } finally {
            setSavedQueriesLoading(false);
        }
    };

    useEffect(() => {
        if (!refreshStateRef.current.shouldRestoreScroll || !savedQueriesScrollRef.current) return;
        const { scrollTop, focusId } = refreshStateRef.current;
        refreshStateRef.current = { shouldRestoreScroll: false, focusId: null, scrollTop: 0 };
        savedQueriesScrollRef.current.scrollTop = scrollTop;
        if (focusId) {
            const item = document.getElementById(`saved-query-${focusId}`);
            if (item) {
                item.scrollIntoView({ block: "nearest" });
            }
        }
    }, [savedQueries]);

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
        if (isSaveDisabled) return;
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
            setLastLoadedQuery(query);
            setLastLoadedDatabaseName(databaseName);
            loadSavedQueries();
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to save query");
        } finally {
            setIsSaving(false);
        }
    };

    const showSavedQueriesNotice = (message, type = "success") => {
        if (noticeTimeoutRef.current) {
            clearTimeout(noticeTimeoutRef.current);
        }
        setSavedQueriesNotice({ message, type });
        const timeoutMs = type === "success" ? 3000 : 6000;
        noticeTimeoutRef.current = setTimeout(() => {
            setSavedQueriesNotice(null);
        }, timeoutMs);
    };

    const handleDeleteQuery = async (id, e) => {
        if (e) e.stopPropagation(); // Stop propagation if event exists
        try {
            const response = await fetch("/api/saved-queries?id=" + id, { method: "DELETE" });
            if (!response.ok) {
                let message = "Failed to delete query";
                try {
                    const payload = await response.json();
                    message = payload?.error || message;
                } catch (parseError) {
                    console.error(parseError);
                }
                throw new Error(message);
            }
            loadSavedQueries({ preserveScroll: true });
            showSavedQueriesNotice("Saved query deleted.");
        } catch (err) {
            console.error(err);
            showSavedQueriesNotice(err.message || "Failed to delete query", "error");
        }
    };

    const openEditDialog = (sq, e) => {
        if (e) e.stopPropagation();
        setEditQueryId(sq.id);
        setEditQueryName(sq.name || "");
        setEditQueryDesc(sq.description || "");
        setEditQueryText(sq.query || "");
        setEditDatabaseName(sq.databaseName || "");
        setIsEditDialogOpen(true);
    };

    const handleEditDialogOpenChange = (open) => {
        setIsEditDialogOpen(open);
        if (!open) {
            setEditQueryId(null);
            setEditQueryName("");
            setEditQueryDesc("");
            setEditQueryText("");
            setEditDatabaseName("");
        }
    };

    const handleUpdateQuery = async () => {
        if (!editQueryId || !editQueryName.trim() || !editQueryText.trim()) return;
        setIsUpdating(true);
        try {
            await fetchJson("/api/saved-queries", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editQueryId,
                    name: editQueryName,
                    description: editQueryDesc,
                    query: editQueryText,
                    databaseName: editDatabaseName,
                }),
            });
            setIsEditDialogOpen(false);
            loadSavedQueries({ preserveScroll: true, focusId: editQueryId });
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to update query");
        } finally {
            setIsUpdating(false);
        }
    };

    const loadQueryIntoEditor = (sq) => {
        const nextQuery = sq.query || "";
        const nextDatabaseName = sq.databaseName || "";
        setQuery(nextQuery);
        setDatabaseName(nextDatabaseName);
        setLastLoadedQuery(nextQuery);
        setLastLoadedDatabaseName(nextDatabaseName);
    };

    const insertTableName = (fullName) => {
        setQuery(prev => prev + ` ${fullName} `);
    };

    const handleSelectSavedQuery = (sq) => {
        if (hasUnsavedChanges) {
            setPendingLoadQuery(sq);
            setIsConfirmLoadOpen(true);
            return;
        }
        loadQueryIntoEditor(sq);
    };

    const handleConfirmLoad = () => {
        if (pendingLoadQuery) {
            loadQueryIntoEditor(pendingLoadQuery);
        }
        setPendingLoadQuery(null);
        setIsConfirmLoadOpen(false);
    };

    const handleCancelLoad = () => {
        setPendingLoadQuery(null);
        setIsConfirmLoadOpen(false);
    };

    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const highlightMatch = (text, term) => {
        if (!term) return text;
        const safeTerm = escapeRegExp(term);
        const regex = new RegExp(`(${safeTerm})`, "ig");
        return text.split(regex).map((part, index) => {
            if (part.toLowerCase() === term.toLowerCase()) {
                return (
                    <span key={`${part}-${index}`} className="rounded bg-amber-100 px-0.5 text-amber-900">
                        {part}
                    </span>
                );
            }
            return <span key={`${part}-${index}`}>{part}</span>;
        });
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
                            <div className="mb-3">
                                <label className="sr-only" htmlFor="saved-query-search">Search saved queries</label>
                                <Input
                                    id="saved-query-search"
                                    value={savedQuerySearch}
                                    onChange={(e) => setSavedQuerySearch(e.target.value)}
                                    placeholder="Search saved queries"
                                    className="h-8 text-xs"
                                />
                            </div>
                            {savedQueriesError && (
                                <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-[11px] text-red-600">
                                    <span className="truncate">{savedQueriesError}</span>
                                    <button
                                        type="button"
                                        onClick={() => loadSavedQueries({ preserveScroll: true })}
                                        className="shrink-0 text-[11px] font-semibold text-red-600 hover:text-red-700"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                            {savedQueriesNotice && (
                                <div
                                    className={`mb-2 rounded-lg border px-2 py-1 text-[11px] ${savedQueriesNotice.type === "error"
                                        ? "border-red-100 bg-red-50 text-red-600"
                                        : "border-emerald-100 bg-emerald-50 text-emerald-700"
                                        }`}
                                    role="status"
                                    aria-live={savedQueriesNotice.type === "error" ? "assertive" : "polite"}
                                >
                                    {savedQueriesNotice.message}
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto max-h-[300px]" ref={savedQueriesScrollRef}>
                                {savedQueriesLoading ? (
                                    <div className="space-y-2 px-2 py-1">
                                        <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
                                        <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
                                        <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-100" />
                                    </div>
                                ) : savedQueries.length === 0 ? (
                                    <p className="text-xs text-zinc-400 italic px-2">No saved queries</p>
                                ) : filteredSavedQueries.length === 0 ? (
                                    <p className="text-xs text-zinc-400 italic px-2">No matches found.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {filteredSavedQueries.map((sq) => {
                                            const meta = buildSavedQueryMeta(sq);
                                            return (
                                                <li
                                                    key={sq.id}
                                                    id={`saved-query-${sq.id}`}
                                                    className="group flex items-start justify-between rounded border border-transparent p-2 hover:border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                                                    onClick={() => handleSelectSavedQuery(sq)}
                                                >
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-medium text-zinc-900 truncate" title={sq.name}>
                                                            {sq.name ? highlightMatch(sq.name, trimmedSavedQuerySearch) : null}
                                                        </p>
                                                        {sq.description && (
                                                            <p className="text-xs text-zinc-500 truncate" title={sq.description}>
                                                                {highlightMatch(sq.description, trimmedSavedQuerySearch)}
                                                            </p>
                                                        )}
                                                        {meta && (
                                                            <p className="text-[11px] text-zinc-400 truncate" title={meta}>
                                                                {meta}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={(e) => openEditDialog(sq, e)}
                                                            className="p-1 text-zinc-400 hover:text-zinc-700"
                                                            title="Edit"
                                                            aria-label={`Edit saved query ${sq.name || ""}`}
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <button
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="p-1 text-zinc-400 hover:text-red-600"
                                                                    title="Delete"
                                                                    aria-label={`Delete saved query ${sq.name || ""}`}
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
                                                    </div>
                                                </li>
                                            );
                                        })}
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
                                <div className="flex items-center justify-between gap-2">
                                    <span>SQL Query</span>
                                    {hasUnsavedChanges && (
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                            Unsaved changes
                                        </span>
                                    )}
                                </div>
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
                                                <div className="col-span-3 space-y-1">
                                                    <Input
                                                        id="name"
                                                        value={newQueryName}
                                                        onChange={(e) => setNewQueryName(e.target.value)}
                                                    />
                                                    {isSaveNameMissing && (
                                                        <p className="text-xs text-red-600">Name is required.</p>
                                                    )}
                                                    {isDuplicateQueryName && (
                                                        <p className="text-xs text-red-600">A saved query with this name already exists.</p>
                                                    )}
                                                </div>
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
                                            {isSaveQueryMissing && (
                                                <p className="text-xs text-red-600">Enter a SQL query before saving.</p>
                                            )}
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" onClick={handleSaveQuery} disabled={isSaveDisabled}>
                                                {isSaving ? "Saving..." : "Save changes"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
                                    <DialogContent className="sm:max-w-[540px]">
                                        <DialogHeader>
                                            <DialogTitle>Edit Saved Query</DialogTitle>
                                            <DialogDescription>
                                                Update the details of this saved query.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="edit-name" className="text-right">
                                                    Name
                                                </Label>
                                                <Input
                                                    id="edit-name"
                                                    value={editQueryName}
                                                    onChange={(e) => setEditQueryName(e.target.value)}
                                                    className="col-span-3"
                                                />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="edit-description" className="text-right">
                                                    Description
                                                </Label>
                                                <Input
                                                    id="edit-description"
                                                    value={editQueryDesc}
                                                    onChange={(e) => setEditQueryDesc(e.target.value)}
                                                    className="col-span-3"
                                                />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="edit-database" className="text-right">
                                                    Database
                                                </Label>
                                                <Input
                                                    id="edit-database"
                                                    value={editDatabaseName}
                                                    onChange={(e) => setEditDatabaseName(e.target.value)}
                                                    className="col-span-3"
                                                />
                                            </div>
                                            <div className="grid grid-cols-4 items-start gap-4">
                                                <Label htmlFor="edit-query" className="text-right pt-2">
                                                    Query
                                                </Label>
                                                <textarea
                                                    id="edit-query"
                                                    value={editQueryText}
                                                    onChange={(e) => setEditQueryText(e.target.value)}
                                                    className="col-span-3 min-h-[120px] rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter className="gap-2 sm:gap-0">
                                            <Button variant="outline" onClick={() => handleEditDialogOpenChange(false)}>
                                                Cancel
                                            </Button>
                                            <Button type="submit" onClick={handleUpdateQuery} disabled={isUpdating}>
                                                {isUpdating ? "Saving..." : "Save changes"}
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

                <AlertDialog
                    open={isConfirmLoadOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            handleCancelLoad();
                            return;
                        }
                        setIsConfirmLoadOpen(open);
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Load saved query?</AlertDialogTitle>
                            <AlertDialogDescription>
                                You have unsaved changes in the editor. Loading this saved query will overwrite your
                                current query and database selection.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={handleCancelLoad}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmLoad}>Load</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {results && (
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Results</h2>
                            <div className="flex gap-4 items-center">
                                {results.limitReached && (
                                    <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                        Preview Limited ({results.rowCount} rows)
                                    </span>
                                )}
                                <span className="text-sm text-zinc-500">{results.rowCount} rows</span>
                            </div>
                        </div>

                        {results.limitReached && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                <p>
                                    <strong>Display Limit Reached.</strong> The query returned more than {results.rowCount} rows.
                                    Only the first {results.rowCount} are shown here to ensure performance.
                                    Please use <strong>Export to Excel</strong> to download the full result set.
                                </p>
                            </div>
                        )}

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
                                    {results.message ? (
                                        <span className="font-medium text-green-600">{results.message}</span>
                                    ) : (
                                        <span>No rows returned (Command: {results.command})</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </main>
        </div >
    );
}
