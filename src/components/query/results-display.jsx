import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ResultsDisplay({ results, isExporting, onExport }) {
    if (!results) return null;

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold text-zinc-900">Results</h2>
                    <span className="text-sm text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                        {results.rowCount} rows
                    </span>
                    {results.limitReached && (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Preview Limited
                        </span>
                    )}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onExport}
                    disabled={isExporting}
                    className="h-8 gap-2 border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                >
                    <Download className="w-3.5 h-3.5" />
                    {isExporting ? "Exporting..." : "Export to Excel"}
                </Button>
            </div>

            {results.limitReached && (
                <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
                    <span className="font-bold">Display Limit Reached:</span>
                    <span>
                        Showing first {results.rowCount} rows. Use <strong>Export to Excel</strong> for full data.
                    </span>
                </div>
            )}

            <div className="flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
                {results.rows && results.rows.length > 0 ? (
                    <table className="min-w-full text-left text-sm relative">
                        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 sticky top-0 z-10 box-decoration-clone">
                            <tr>
                                {results.fields.map((field) => (
                                    <th key={field} className="px-4 py-3 whitespace-nowrap bg-zinc-50 border-b border-zinc-100 font-semibold h-[2rem]">{field}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {results.rows.map((row, i) => (
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
                )}
            </div>
        </div>
    );
}
