import { Database, Table, Search } from "lucide-react";
import { useState } from "react";

export function SchemaBrowser({
    dbList,
    tableList,
    selectedDb,
    setSelectedDb,
    onInsertTable
}) {
    const [searchQuery, setSearchQuery] = useState("");

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
        </div>
    );
}
