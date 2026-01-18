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

export function SaveQueryDialog({
    open,
    onOpenChange,
    onSave,
    isSaving,
    editingQuery = null
}) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    // Reset or populate form when dialog opens/closes or editingQuery changes
    useEffect(() => {
        if (open) {
            if (editingQuery) {
                setName(editingQuery.name);
                setDescription(editingQuery.description || "");
            } else {
                setName("");
                setDescription("");
            }
        }
    }, [open, editingQuery]);

    const handleSubmit = () => {
        onSave({ name, description });
    };

    const isEdit = !!editingQuery;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Saved Query" : "Save Query"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the details of your saved query."
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
