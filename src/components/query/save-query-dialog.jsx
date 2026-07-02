import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
    const isEdit = !!editingQuery;
    const formKey = isEdit ? editingQuery.id : `new-${currentQuery}-${currentDatabase}`;
    const initialValues = {
        name: editingQuery?.name || "",
        description: editingQuery?.description || "",
        query: editingQuery?.query || currentQuery,
        databaseName: editingQuery?.databaseName || currentDatabase,
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <SaveQueryDialogContent
                key={formKey}
                isEdit={isEdit}
                isSaving={isSaving}
                initialValues={initialValues}
                onSave={onSave}
            />
        </Dialog>
    );
}

function SaveQueryDialogContent({ isEdit, isSaving, initialValues, onSave }) {
    const [name, setName] = useState(initialValues.name);
    const [description, setDescription] = useState(initialValues.description);
    const [query, setQuery] = useState(initialValues.query);
    const [databaseName, setDatabaseName] = useState(initialValues.databaseName);

    const handleSubmit = () => {
        onSave({ name, description, query, databaseName });
    };

    return (
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
    );
}
