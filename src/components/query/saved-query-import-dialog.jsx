import {
    AlertTriangle,
    CheckCircle2,
    FilePlus2,
    RefreshCw,
    SkipForward,
    Trash2,
    XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const modeLabels = {
    upsert: "Update matches",
    create: "Create only",
    copy: "Import as copies",
    replace: "Replace all",
};

const actionStyles = {
    created: "bg-emerald-50 text-emerald-700 border-emerald-100",
    updated: "bg-blue-50 text-blue-700 border-blue-100",
    skipped: "bg-zinc-50 text-zinc-600 border-zinc-200",
    error: "bg-red-50 text-red-700 border-red-100",
};

export function SavedQueryImportDialog({
    open,
    onOpenChange,
    files = [],
    mode,
    onModeChange,
    preview,
    result,
    isPreviewing,
    isImporting,
    onConfirm,
}) {
    const operations = result?.imported || preview?.operations || [];
    const summary = result || preview;
    const hasErrors = (preview?.errors || 0) > 0;
    const writableCount = (preview?.created || 0) + (preview?.updated || 0);
    const canImport = !isPreviewing && !isImporting && preview && writableCount > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[760px]">
                <DialogHeader>
                    <DialogTitle>{result ? "Import Complete" : "Import Saved Queries"}</DialogTitle>
                    <DialogDescription>
                        {files.length} file{files.length === 1 ? "" : "s"} selected
                    </DialogDescription>
                </DialogHeader>

                {!result && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                            <div>
                                <p className="text-sm font-medium text-zinc-900">Conflict handling</p>
                                <p className="text-xs text-zinc-500">
                                    Choose how matching saved-query names should be handled.
                                </p>
                            </div>
                            <Select value={mode} onValueChange={onModeChange} disabled={isImporting}>
                                <SelectTrigger className="w-44 bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="upsert">Update matches</SelectItem>
                                    <SelectItem value="create">Create only</SelectItem>
                                    <SelectItem value="copy">Import as copies</SelectItem>
                                    <SelectItem value="replace">Replace all</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {mode === "replace" && (
                            <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <p>
                                    This will delete {preview?.replaceCount ?? 0} existing saved
                                    queries before importing the valid files.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <SummaryBand summary={summary} isPreviewing={isPreviewing} />

                <div className="max-h-[340px] overflow-y-auto rounded-md border border-zinc-200">
                    {isPreviewing ? (
                        <div className="flex items-center gap-2 p-4 text-sm text-zinc-500">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Previewing import
                        </div>
                    ) : operations.length === 0 ? (
                        <div className="p-4 text-sm text-zinc-500">No importable files found.</div>
                    ) : (
                        <ul className="divide-y divide-zinc-100">
                            {operations.map((operation, index) => (
                                <li key={`${operation.filename}-${index}`} className="p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-zinc-900">
                                                {operation.name || operation.filename}
                                            </p>
                                            <p className="truncate text-xs text-zinc-500">
                                                {operation.filename}
                                                {operation.originalName && (
                                                    <span> from {operation.originalName}</span>
                                                )}
                                            </p>
                                            {operation.error && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {operation.error}
                                                </p>
                                            )}
                                        </div>
                                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${actionStyles[operation.action] || actionStyles.skipped}`}>
                                            {operation.action}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <DialogFooter>
                    {result ? (
                        <Button onClick={() => onOpenChange(false)}>Done</Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
                                Cancel
                            </Button>
                            <Button
                                onClick={onConfirm}
                                disabled={!canImport || (hasErrors && mode === "replace")}
                                className={mode === "replace" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                            >
                                {isImporting ? "Importing..." : modeLabels[mode]}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SummaryBand({ summary, isPreviewing }) {
    if (isPreviewing || !summary) return null;

    const items = [
        { label: "create", value: summary.created || 0, icon: FilePlus2, className: "text-emerald-700" },
        { label: "update", value: summary.updated || 0, icon: CheckCircle2, className: "text-blue-700" },
        { label: "skip", value: summary.skipped || 0, icon: SkipForward, className: "text-zinc-600" },
        { label: "error", value: summary.errors || 0, icon: XCircle, className: "text-red-700" },
    ];

    if (summary.willReplaceExisting) {
        items.unshift({
            label: "delete",
            value: summary.replaceCount || 0,
            icon: Trash2,
            className: "text-red-700",
        });
    }

    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <div key={item.label} className="rounded-md border border-zinc-200 bg-white p-3">
                        <div className={`flex items-center gap-2 ${item.className}`}>
                            <Icon className="h-4 w-4" />
                            <span className="text-lg font-semibold leading-none">{item.value}</span>
                        </div>
                        <p className="mt-1 text-xs uppercase tracking-wide text-zinc-400">
                            {item.label}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}
