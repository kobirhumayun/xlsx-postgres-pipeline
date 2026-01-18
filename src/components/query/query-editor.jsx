import { Save, Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaveQueryDialog } from "./save-query-dialog";

export function QueryEditor({
    query,
    setQuery,
    databaseName,
    setDatabaseName,
    results,
    loading,
    error,
    isExporting,
    onRun,
    onExport,
    onOpenSaveDialog,
    // Dialog Props
    isSaveDialogOpen,
    setIsSaveDialogOpen,
    isSaving,
    editingQuery,
    onSaveQuery
}) {
    return (
        <section className="lg:col-span-3 grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm h-fit">
            <div className="grid gap-4">
                <div className="flex justify-between items-center">
                    <label className="flex flex-col gap-2 text-sm font-medium flex-1 mr-4">
                        Target Database
                        <input
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            value={databaseName}
                            onChange={(e) => setDatabaseName(e.target.value)}
                            placeholder="default"
                        />
                    </label>
                </div>

                <label className="flex flex-col gap-2 text-sm font-medium">
                    SQL Query
                    <textarea
                        className="h-96 rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="SELECT * FROM users LIMIT 10;"
                    />
                </label>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={onRun}
                        disabled={loading}
                        className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                    >
                        <Play className="w-4 h-4 mr-2" />
                        {loading ? "Running..." : "Run Query"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onExport}
                        disabled={isExporting}
                        className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        {isExporting ? "Exporting..." : "Export to Excel"}
                    </Button>

                    <div className="flex-1" />

                    <Button variant="outline" className="rounded-full" onClick={onOpenSaveDialog}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Query
                    </Button>

                    <SaveQueryDialog
                        open={isSaveDialogOpen}
                        onOpenChange={setIsSaveDialogOpen}
                        onSave={onSaveQuery}
                        isSaving={isSaving}
                        editingQuery={editingQuery}
                        currentQuery={query}
                        currentDatabase={databaseName}
                    />
                </div>

                {error && (
                    <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                        {error}
                    </div>
                )}
            </div>

            {results && (
                <div className="space-y-4 pt-4 border-t border-zinc-100">
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
                </div>
            )}
        </section>
    );
}
