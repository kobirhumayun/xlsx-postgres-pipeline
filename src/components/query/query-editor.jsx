import { Save, Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaveQueryDialog } from "./save-query-dialog";

export function QueryEditor({
    query,
    setQuery,
    databaseName,
    loading,
    error,
    onRun,
    isExporting,
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
        <div className="flex flex-col h-full gap-4">
            <div className="flex-1 relative min-h-0 border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white flex flex-col">
                <div className="absolute top-0 right-0 p-2 z-10 flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full bg-white/80 backdrop-blur border border-zinc-200 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 shadow-sm"
                        onClick={onOpenSaveDialog}
                        title="Save Query"
                    >
                        <Save className="w-4 h-4" />
                    </Button>
                </div>

                <textarea
                    className="flex-1 w-full h-full resize-none p-4 font-mono text-sm outline-none bg-white"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="-- Enter your SQL query here
SELECT * FROM users LIMIT 10;"
                    spellCheck={false}
                />

                <div className="border-t border-zinc-100 p-3 bg-zinc-50 flex items-center justify-between">
                    <div className="text-xs text-zinc-500 font-mono">
                        {databaseName ? `Connected to: ${databaseName}` : "No database selected"}
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={onExport}
                            disabled={isExporting || !query.trim()}
                            variant="outline"
                            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 border-zinc-200"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {isExporting ? "Exporting..." : "Export Excel"}
                        </Button>
                        <Button
                            onClick={onRun}
                            disabled={loading || !databaseName || !query.trim()}
                            className={`rounded-full px-6 py-2 text-sm font-semibold text-white transition-all ${loading
                                ? "bg-zinc-400 cursor-not-allowed"
                                : "bg-zinc-900 hover:bg-zinc-800 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                                }`}
                        >
                            <Play className="w-4 h-4 mr-2 fill-current" />
                            {loading ? "Running..." : "Run Query"}
                        </Button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100 flex-shrink-0 animate-in fade-in slide-in-from-top-2">
                    <span className="font-semibold block mb-1">Error Executing Query:</span>
                    {error}
                </div>
            )}

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
    );
}
