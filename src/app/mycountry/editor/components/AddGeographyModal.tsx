"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Globe, Plus } from "lucide-react";

interface AddGeographyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "continent" | "region";
  onAdd: (name: string) => Promise<void>;
}

export function AddGeographyModal({ open, onOpenChange, type, onAdd }: AddGeographyModalProps) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onAdd(name.trim());
      setName("");
      onOpenChange(false);
    } catch (error) {
      console.error(`Failed to add ${type}:`, error);
      alert(`Failed to add ${type}. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Add New {type === "continent" ? "Continent" : "Region"}
          </DialogTitle>
          <DialogDescription>
            Add a new {type} that will be available for all countries on the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{type === "continent" ? "Continent" : "Region"} Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "continent" ? "e.g., Oceania" : "e.g., Southeast Asia"}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setName("");
              onOpenChange(false);
            }}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSaving}>
            <Plus className="mr-2 h-4 w-4" />
            {isSaving ? "Adding..." : `Add ${type === "continent" ? "Continent" : "Region"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
