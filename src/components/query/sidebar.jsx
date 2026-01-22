import { useState } from "react";
import { Database, Bookmark, Clock } from "lucide-react";
import { SchemaBrowser } from "./schema-browser";
import { SavedQueriesList } from "./saved-queries-list";
import { QueryHistoryList } from "./query-history-list";

export function Sidebar({
    // Schema Browser Props
    dbList,
    tableList,
    selectedDb,
    setSelectedDb,
    onInsertTable,

    // Saved Queries Props
    savedQueries,
    onDeleteQuery,
    onLoadQuery,
    onEditQuery,

    // History Props
    queryHistory,
    onLoadHistory,

    // Sidebar Props
    collapsed,
    setCollapsed
}) {
    const [activeTab, setActiveTab] = useState("schema");

    return (
        <aside
            className={`flex flex-col h-full shrink-0 bg-white border-r border-zinc-200 transition-all duration-300 ease-in-out ${collapsed ? "w-12" : "w-80"
                }`}
        >
            <div className="flex border-b border-zinc-200 relative">
                {!collapsed && (
                    <>
                        <button
                            onClick={() => setActiveTab("schema")}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs uppercase font-semibold tracking-wide border-b-2 transition-colors ${activeTab === "schema"
                                ? "border-zinc-900 text-zinc-900"
                                : "border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                }`}
                            title="Schema Browser"
                        >
                            <Database className="w-4 h-4" />
                            <span className="hidden sm:inline">Schema</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("saved")}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs uppercase font-semibold tracking-wide border-b-2 transition-colors ${activeTab === "saved"
                                ? "border-zinc-900 text-zinc-900"
                                : "border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                }`}
                            title="Saved Queries"
                        >
                            <Bookmark className="w-4 h-4" />
                            <span className="hidden sm:inline">Saved</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("history")}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs uppercase font-semibold tracking-wide border-b-2 transition-colors ${activeTab === "history"
                                ? "border-zinc-900 text-zinc-900"
                                : "border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                }`}
                            title="Recent History"
                        >
                            <Clock className="w-4 h-4" />
                            <span className="hidden sm:inline">History</span>
                        </button>
                    </>
                )}
                {/* Toggle Button */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={`absolute right-0 top-0 bottom-0 flex items-center justify-center hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors ${collapsed ? "w-full relative" : "w-6 border-l border-zinc-100" // w-6 when expanded, w-full relative (which is w-12) when collapsed
                        }`}
                    title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {collapsed ? (
                        <Database className="w-5 h-5" /> // Show icon when collapsed
                    ) : (
                        <div className="w-1 h-8 rounded-full bg-zinc-200 group-hover:bg-zinc-300" /> // subtle handle
                    )}
                </button>
            </div>

            <div className={`flex-1 min-h-0 relative ${collapsed ? "hidden" : "block"}`}>
                <div className={`absolute inset-0 ${activeTab === "schema" ? "block" : "hidden"}`}>
                    <SchemaBrowser
                        dbList={dbList}
                        tableList={tableList}
                        selectedDb={selectedDb}
                        setSelectedDb={setSelectedDb}
                        onInsertTable={onInsertTable}
                    />
                </div>
                <div className={`absolute inset-0 ${activeTab === "saved" ? "block" : "hidden"}`}>
                    <SavedQueriesList
                        savedQueries={savedQueries}
                        onDelete={onDeleteQuery}
                        onLoad={onLoadQuery}
                        onEdit={onEditQuery}
                        compact={true}
                    />
                </div>
                <div className={`absolute inset-0 ${activeTab === "history" ? "block" : "hidden"}`}>
                    <QueryHistoryList
                        history={queryHistory}
                        onLoad={onLoadHistory}
                    />
                </div>
            </div>
        </aside>
    );
}
