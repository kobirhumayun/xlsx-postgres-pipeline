import { useState } from "react";
import { Database, Bookmark } from "lucide-react";
import { SchemaBrowser } from "./schema-browser";
import { SavedQueriesList } from "./saved-queries-list";

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
    onEditQuery
}) {
    const [activeTab, setActiveTab] = useState("schema");

    return (
        <aside className="w-80 border-r border-zinc-200 bg-white flex flex-col h-full shrink-0">
            <div className="flex border-b border-zinc-200">
                <button
                    onClick={() => setActiveTab("schema")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "schema"
                            ? "border-zinc-900 text-zinc-900"
                            : "border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50"
                        }`}
                >
                    <Database className="w-4 h-4" />
                    Schema
                </button>
                <button
                    onClick={() => setActiveTab("saved")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "saved"
                            ? "border-zinc-900 text-zinc-900"
                            : "border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50"
                        }`}
                >
                    <Bookmark className="w-4 h-4" />
                    Saved
                </button>
            </div>

            <div className="flex-1 min-h-0 relative">
                {activeTab === "schema" && (
                    <div className="absolute inset-0">
                        <SchemaBrowser
                            dbList={dbList}
                            tableList={tableList}
                            selectedDb={selectedDb}
                            setSelectedDb={setSelectedDb}
                            onInsertTable={onInsertTable}
                        />
                    </div>
                )}
                {activeTab === "saved" && (
                    <div className="absolute inset-0">
                        <SavedQueriesList
                            savedQueries={savedQueries}
                            onDelete={onDeleteQuery}
                            onLoad={onLoadQuery}
                            onEdit={onEditQuery}
                            compact={true}
                        />
                    </div>
                )}
            </div>
        </aside>
    );
}
