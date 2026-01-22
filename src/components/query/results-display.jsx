import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";

export function ResultsDisplay({ results, loading }) {
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Reset sorting when new results arrive (checking by command or rowCount usually implies new query)
    // However, simplest is to just let the user re-sort if they want, or use a useEffect to reset if results object reference changes
    useMemo(() => {
        // We can't easily hook into "results changed" here without effect, 
        // but typically sorting persists on same dataset. 
        // If results content changes completely, we might want to reset, but for now we'll keep it simple.
    }, [results]);

    const sortedRows = useMemo(() => {
        if (!results || !results.rows) return [];
        let sortableRows = [...results.rows];
        if (sortConfig.key !== null) {
            sortableRows.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableRows;
    }, [results, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    if (!results && !loading) return null;

    return (
        <div className="flex flex-col gap-4 h-full relative">
            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl border border-zinc-100">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-600">Running query...</span>
                    </div>
                </div>
            )}

            <div className={`flex flex-col gap-4 h-full transition-opacity duration-200 ${loading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold text-zinc-900">Results</h2>
                        {results && (
                            <span className="text-sm text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                                {results.rowCount} rows
                            </span>
                        )}
                        {results?.limitReached && (
                            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                Preview Limited
                            </span>
                        )}
                    </div>
                </div>

                {results?.limitReached && (
                    <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
                        <span className="font-bold">Display Limit Reached:</span>
                        <span>
                            Showing first {results.rowCount} rows. Use <strong>Export to Excel</strong> for full data.
                        </span>
                    </div>
                )}

                <div className="flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
                    {results && results.rows && results.rows.length > 0 ? (
                        <table className="min-w-full text-left text-sm relative border-collapse">
                            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 sticky top-0 z-10 box-decoration-clone">
                                <tr>
                                    {results.fields.map((field) => (
                                        <th
                                            key={field}
                                            className="px-4 py-3 whitespace-nowrap bg-zinc-50 border-b border-zinc-100 font-semibold h-[2rem] cursor-pointer hover:bg-zinc-100 transition-colors select-none group"
                                            onClick={() => requestSort(field)}
                                        >
                                            <div className="flex items-center gap-1">
                                                {field}
                                                <div className="w-4 h-4 text-zinc-400 flex items-center justify-center">
                                                    {sortConfig.key === field ? (
                                                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-zinc-900" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-900" />
                                                    ) : (
                                                        <ChevronUp className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                                                    )}
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {sortedRows.map((row, i) => (
                                    <tr key={i} className="hover:bg-zinc-50 transition-colors">
                                        {results.fields.map((field) => (
                                            <td key={field} className="px-4 py-2 whitespace-nowrap text-zinc-700">
                                                {row[field] === null ? (
                                                    <span className="text-zinc-300 font-mono text-xs">NULL</span>
                                                ) : (
                                                    String(row[field])
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        results ? (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2 p-8">
                                {results.message ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                                            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <span className="font-medium text-zinc-900">{results.message}</span>
                                    </div>
                                ) : (
                                    <span>No rows returned (Command: {results.command})</span>
                                )}
                            </div>
                        ) : (
                            // Empty state when no results yet (and not loading, handled by wrapper)
                            <div className="flex items-center justify-center h-full text-zinc-400 p-8">
                                Enter a query to see results
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
