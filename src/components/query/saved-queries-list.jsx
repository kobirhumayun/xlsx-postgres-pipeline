import { Trash2, Edit, Search } from "lucide-react";
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
import { useState } from "react";

export function SavedQueriesList({
    savedQueries,
    onDelete,
    onLoad,
    onEdit,
    compact = false
}) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredQueries = savedQueries.filter(sq => {
        const term = searchQuery.toLowerCase();
        return (
            sq.name.toLowerCase().includes(term) ||
            (sq.description && sq.description.toLowerCase().includes(term))
        );
    });

    return (
        <div className={`flex flex-col h-full ${compact ? "p-2" : "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"}`}>
            <div className="flex flex-col gap-2 mb-2">
                {!compact && (
                    <h2 className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 p-2 rounded">
                        Saved Queries
                    </h2>
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

            <div className="flex-1 overflow-y-auto max-h-[400px]">
                {filteredQueries.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic px-2 mt-2">
                        {searchQuery ? "No matches found" : "No saved queries"}
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {filteredQueries.map(sq => (
                            <li
                                key={sq.id}
                                className="group flex items-center justify-between rounded p-2 hover:bg-zinc-50 border border-transparent hover:border-zinc-100 cursor-pointer transition-colors"
                                onClick={() => onLoad(sq)}
                            >
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
