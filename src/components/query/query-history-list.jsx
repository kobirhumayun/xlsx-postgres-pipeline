import { History, Clock } from "lucide-react";

export function QueryHistoryList({
    history,
    onLoad
}) {
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-zinc-100 mb-2">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-3 h-3" />
                    Recent Queries
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2">
                {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-zinc-400 text-xs italic gap-2 text-center px-4">
                        <Clock className="w-8 h-8 opacity-20" />
                        <p>No query history yet. Run a query to see it here.</p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {history.map((item) => (
                            <li
                                key={item.id}
                                onClick={() => onLoad(item)}
                                className="group cursor-pointer rounded-lg border border-zinc-200 bg-white p-3 hover:border-zinc-300 hover:shadow-sm transition-all"
                            >
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                                        {item.databaseName && (
                                            <span className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-500 font-medium">
                                                {item.databaseName}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs font-mono text-zinc-700 line-clamp-3 leading-relaxed bg-zinc-50 p-2 rounded border border-zinc-100 group-hover:bg-white group-hover:border-zinc-200 transition-colors">
                                        {item.query}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
