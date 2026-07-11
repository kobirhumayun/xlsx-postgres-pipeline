import { Archive, Database, Table, Search, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SchemaBrowser({
    dbList,
    tableList,
    selectedDb,
    setSelectedDb,
    onInsertTable,
    onExportSchema = () => {},
    isExportingSchema = false,
    onExportRepository = () => {},
    isExportingRepository = false,
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [schemaFilter, setSchemaFilter] = useState("");
    const [includeRowCounts, setIncludeRowCounts] = useState(true);
    const [includeIndexes, setIncludeIndexes] = useState(true);
    const [includeConstraints, setIncludeConstraints] = useState(true);
    const [includeViews, setIncludeViews] = useState(false);
    const [includeUnassignedQueries, setIncludeUnassignedQueries] = useState(true);

    const filteredTables = tableList.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-zinc-100 space-y-3">
                <label className="block text-sm font-medium">
                    <span className="flex items-center gap-2 mb-2 text-zinc-600">
                        <Database className="w-4 h-4" />
                        Database
                    </span>
                    <select
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white focus:border-zinc-400 focus:ring-0 outline-none"
                        value={selectedDb}
                        onChange={(e) => setSelectedDb(e.target.value)}
                    >
                        <option value="">Select database...</option>
                        {dbList.map(db => <option key={db} value={db}>{db}</option>)}
                    </select>
                </label>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsExportDialogOpen(true)}
                    disabled={!selectedDb || isExportingSchema || isExportingRepository}
                    className="w-full rounded-md border-zinc-200 text-zinc-600"
                    title="Export schema metadata"
                >
                    <Download className="h-4 w-4" />
                    {isExportingSchema ? "Exporting" : "Export Schema"}
                </Button>

                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search tables..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-zinc-400"
                        disabled={!selectedDb}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                <h3 className="px-2 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Table className="w-3 h-3" />
                    Tables ({filteredTables.length})
                </h3>
                <ul className="space-y-0.5">
                    {filteredTables.map(t => (
                        <li key={t.fullName}>
                            <button
                                onClick={() => onInsertTable(t.fullName)}
                                className="text-left w-full text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 px-3 py-1.5 rounded-md truncate transition-colors"
                                title={`Insert: ${t.name}`}
                            >
                                {t.name}
                            </button>
                        </li>
                    ))}
                    {selectedDb && tableList.length > 0 && filteredTables.length === 0 && (
                        <li className="text-xs text-zinc-400 italic px-4 py-2">No matching tables found</li>
                    )}
                    {selectedDb && tableList.length === 0 && (
                        <li className="text-xs text-zinc-400 italic px-4 py-2">No tables found in public schema</li>
                    )}
                    {!selectedDb && (
                        <li className="text-xs text-zinc-400 italic px-4 py-2">Select a database to view tables</li>
                    )}
                </ul>
            </div>

            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Export Schema</DialogTitle>
                        <DialogDescription>
                            {selectedDb || "No database selected"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="schema-filter">Schemas</Label>
                            <Input
                                id="schema-filter"
                                value={schemaFilter}
                                onChange={(event) => setSchemaFilter(event.target.value)}
                                placeholder="e.g. public, reporting"
                            />
                            <p className="text-xs text-zinc-500">
                                Leave blank to include all non-system schemas.
                            </p>
                        </div>

                        <div className="grid gap-3 rounded-md border border-zinc-200 p-3">
                            <ToggleRow
                                label="Estimated row counts"
                                checked={includeRowCounts}
                                onCheckedChange={setIncludeRowCounts}
                            />
                            <ToggleRow
                                label="Indexes"
                                checked={includeIndexes}
                                onCheckedChange={setIncludeIndexes}
                            />
                            <ToggleRow
                                label="Constraints"
                                checked={includeConstraints}
                                onCheckedChange={setIncludeConstraints}
                            />
                            <ToggleRow
                                label="Views"
                                checked={includeViews}
                                onCheckedChange={setIncludeViews}
                            />
                            <ToggleRow
                                label="Unassigned saved queries"
                                checked={includeUnassignedQueries}
                                onCheckedChange={setIncludeUnassignedQueries}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsExportDialogOpen(false)}
                            disabled={isExportingSchema || isExportingRepository}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            onClick={async () => {
                                await onExportRepository({
                                    databaseName: selectedDb,
                                    schemas: schemaFilter
                                        .split(",")
                                        .map((schema) => schema.trim())
                                        .filter(Boolean),
                                    includeRowCounts,
                                    includeIndexes,
                                    includeConstraints,
                                    includeViews,
                                    includeUnassignedQueries,
                                });
                                setIsExportDialogOpen(false);
                            }}
                            disabled={!selectedDb || isExportingSchema || isExportingRepository}
                            title="Export schema, saved queries, and AI agent instructions"
                        >
                            <Archive className="h-4 w-4" />
                            {isExportingRepository ? "Bundling..." : "Repository Bundle"}
                        </Button>
                        <Button
                            onClick={async () => {
                                await onExportSchema({
                                    databaseName: selectedDb,
                                    schemas: schemaFilter
                                        .split(",")
                                        .map((schema) => schema.trim())
                                        .filter(Boolean),
                                    includeRowCounts,
                                    includeIndexes,
                                    includeConstraints,
                                    includeViews,
                                });
                                setIsExportDialogOpen(false);
                            }}
                            disabled={!selectedDb || isExportingSchema || isExportingRepository}
                        >
                            {isExportingSchema ? "Exporting..." : "Export"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ToggleRow({ label, checked, onCheckedChange }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <Label className="text-sm text-zinc-700">{label}</Label>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}
