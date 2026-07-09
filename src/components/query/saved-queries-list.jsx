import { Trash2, Edit, Search, Upload, Download, FileDown, X } from "lucide-react";
import { useRef, useState } from "react";
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

export function SavedQueriesList({
    savedQueries,
    onDelete,
    onLoad,
    onEdit,
    onImportFiles = () => {},
    onExportAll = () => {},
    onExportSelected = () => {},
    onExportQuery = () => {},
    isImporting = false,
    isExporting = false,
    compact = false
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const filteredQueries = savedQueries.filter(sq => {
        const term = searchQuery.toLowerCase();
        return (
            sq.name.toLowerCase().includes(term) ||
            (sq.description && sq.description.toLowerCase().includes(term))
        );
    });
    const availableIds = new Set(savedQueries.map((sq) => sq.id));
    const selectedQueryIds = [...selectedIds].filter((id) => availableIds.has(id));
    const selectedCount = selectedQueryIds.length;

    const toggleSelection = (id) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    const selectVisibleQueries = () => {
        setSelectedIds((current) => {
            const next = new Set(current);
            filteredQueries.forEach((sq) => next.add(sq.id));
            return next;
        });
    };

    const handleDroppedFiles = (event) => {
        event.preventDefault();
        setIsDragOver(false);
        const files = Array.from(event.dataTransfer.files || []);
        if (files.length > 0) {
            onImportFiles(files);
        }
    };

    return (
        <div
            className={`flex flex-col h-full ${compact ? "p-2" : "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"} ${isDragOver ? "bg-zinc-50 ring-2 ring-zinc-300" : ""}`}
            onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
            }}
            onDragLeave={(event) => {
                if (event.currentTarget === event.target) {
                    setIsDragOver(false);
                }
            }}
            onDrop={handleDroppedFiles}
        >
            <div className="flex flex-col gap-2 mb-2">
                {!compact && (
                    <h2 className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 p-2 rounded">
                        Saved Queries
                    </h2>
                )}
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        title="Import SQL files"
                        className="flex-1 h-8 rounded-md border-zinc-200 px-2 text-xs text-zinc-600"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        {isImporting ? "Importing" : "Import"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onExportAll()}
                        disabled={isExporting || savedQueries.length === 0}
                        title="Export saved queries"
                        className="flex-1 h-8 rounded-md border-zinc-200 px-2 text-xs text-zinc-600"
                    >
                        <Download className="w-3.5 h-3.5" />
                        {isExporting ? "Exporting" : "Export"}
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".sql,text/plain"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                            const files = Array.from(event.target.files || []);
                            if (files.length > 0) {
                                onImportFiles(files);
                            }
                            event.target.value = "";
                        }}
                    />
                </div>
                {selectedCount > 0 && (
                    <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                        <span className="min-w-0 flex-1 text-xs font-medium text-zinc-600">
                            {selectedCount} selected
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onExportSelected(selectedQueryIds)}
                            disabled={isExporting}
                            title="Export selected queries"
                            className="h-7 rounded-md border-zinc-200 px-2 text-xs"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export
                        </Button>
                        <button
                            type="button"
                            onClick={clearSelection}
                            title="Clear selection"
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search queries..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-zinc-400"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {filteredQueries.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic px-2 mt-2">
                        {searchQuery ? "No matches found" : "No saved queries"}
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {filteredQueries.length > 0 && selectedCount === 0 && (
                            <li className="px-2 pb-1">
                                <button
                                    type="button"
                                    onClick={selectVisibleQueries}
                                    className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
                                >
                                    Select visible
                                </button>
                            </li>
                        )}
                        {filteredQueries.map(sq => (
                            <li
                                key={sq.id}
                                className="group flex items-center justify-between rounded p-2 hover:bg-zinc-50 border border-transparent hover:border-zinc-100 cursor-pointer transition-colors"
                                onClick={() => onLoad(sq)}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(sq.id)}
                                    onChange={() => toggleSelection(sq.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Select query"
                                    className="mr-2 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                                />
                                <div className="overflow-hidden flex-1 mr-2">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-zinc-900 truncate" title={sq.name}>
                                            {sq.name}
                                        </p>
                                        {sq.databaseName && (
                                            <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200">
                                                {sq.databaseName}
                                            </span>
                                        )}
                                    </div>
                                    {sq.description && (
                                        <p className="text-xs text-zinc-500 truncate" title={sq.description}>
                                            {sq.description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onExportQuery(sq);
                                        }}
                                        className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded"
                                        title="Export this query"
                                        type="button"
                                    >
                                        <FileDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(sq);
                                        }}
                                        className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded"
                                        title="Edit"
                                        type="button"
                                    >
                                        <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <button
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                title="Delete"
                                                type="button"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
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
                                                    onClick={(e) => onDelete(sq.id, e)}
                                                    className="bg-red-600 hover:bg-red-700 text-white hover:text-white"
                                                >
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
