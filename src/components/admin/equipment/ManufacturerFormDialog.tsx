"use client";

// src/components/admin/equipment/ManufacturerFormDialog.tsx
// Add/edit dialog for defense manufacturers.

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { MultiSelect } from "~/components/ui/multi-select";
import { SPECIALTIES, type ManufacturerFormData } from "~/lib/manufacturer-utils";

interface ManufacturerFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingManufacturerId: string | null;
  manufacturerFormData: ManufacturerFormData;
  setManufacturerFormData: (data: ManufacturerFormData) => void;
  onCancel: () => void;
  onSave: () => void;
  isPending: boolean;
}

export function ManufacturerFormDialog({
  isOpen,
  onOpenChange,
  editingManufacturerId,
  manufacturerFormData,
  setManufacturerFormData,
  onCancel,
  onSave,
  isPending,
}: ManufacturerFormDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingManufacturerId ? "Edit" : "Add"} Manufacturer</DialogTitle>
          <DialogDescription>
            {editingManufacturerId
              ? "Update manufacturer information"
              : "Create a new defense manufacturer"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">Name *</label>
            <Input
              value={manufacturerFormData.name}
              onChange={(e) =>
                setManufacturerFormData({ ...manufacturerFormData, name: e.target.value })
              }
              placeholder="e.g., Lockheed Martin"
            />
          </div>

          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">Country *</label>
            <Input
              value={manufacturerFormData.country}
              onChange={(e) =>
                setManufacturerFormData({ ...manufacturerFormData, country: e.target.value })
              }
              placeholder="e.g., United States"
            />
          </div>

          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">Specialties</label>
            <MultiSelect
              options={SPECIALTIES}
              value={manufacturerFormData.specialty}
              onChange={(value) =>
                setManufacturerFormData({ ...manufacturerFormData, specialty: value })
              }
              placeholder="Select specialties..."
              className="w-full"
            />
          </div>

          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">Founded</label>
            <Input
              type="number"
              value={manufacturerFormData.founded || ""}
              onChange={(e) =>
                setManufacturerFormData({
                  ...manufacturerFormData,
                  founded: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="e.g., 1995"
              min="1800"
              max="2100"
            />
          </div>

          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">Description</label>
            <Input
              value={manufacturerFormData.description}
              onChange={(e) =>
                setManufacturerFormData({
                  ...manufacturerFormData,
                  description: e.target.value,
                })
              }
              placeholder="Optional description..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={manufacturerFormData.isActive}
              onChange={(e) =>
                setManufacturerFormData({ ...manufacturerFormData, isActive: e.target.checked })
              }
              className="border-border rounded"
            />
            <label
              htmlFor="isActive"
              className="text-foreground cursor-pointer text-sm font-medium"
            >
              Active
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={
              !manufacturerFormData.name || !manufacturerFormData.country || isPending
            }
          >
            {isPending ? "Saving..." : editingManufacturerId ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
