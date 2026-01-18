import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function SaveQueryDialog({
    open,
    onOpenChange,
    onSave,
    isSaving,
    editingQuery = null,
    currentQuery = "",
    currentDatabase = ""
}) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [query, setQuery] = useState("");
    const [databaseName, setDatabaseName] = useState("");

    // Reset or populate form when dialog opens/closes or editingQuery changes
    useEffect(() => {
        if (open) {
            if (editingQuery) {
                setName(editingQuery.name);
                setDescription(editingQuery.description || "");
                setQuery(editingQuery.query || "");
                setDatabaseName(editingQuery.databaseName || "");
            } else {
                setName("");
                setDescription("");
                // For new queries, default to current editor state
                setQuery(currentQuery);
                setDatabaseName(currentDatabase);
            }
        }
    }, [open, editingQuery, currentQuery, currentDatabase]);

    const handleSubmit = () => {
        onSave({ name, description, query, databaseName });
    };

    const isEdit = !!editingQuery;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Saved Query" : "Save Query"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the details and content of your saved query."
                            : "Save this query for future use."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                            placeholder="My Query"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">
                            Description
                        </Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="col-span-3"
                            placeholder="Optional description"
                        />
                    </div>

                    {/* Query Content Editing */}
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="query" className="text-right pt-2">
                            Query
                        </Label>
                        <Textarea
                            id="query"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="col-span-3 font-mono text-xs h-32"
                            placeholder="SELECT * FROM ..."
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="database" className="text-right">
                            Database
                        </Label>
                        <Input
                            id="database"
                            value={databaseName}
                            onChange={(e) => setDatabaseName(e.target.value)}
                            className="col-span-3"
                            placeholder="default"
                        />
                    </div>

                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleSubmit} disabled={isSaving}>
                        {isSaving ? "Saving..." : (isEdit ? "Update" : "Save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
