"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface CollectionEditDeleteModalsProps {
  editModalOpen: boolean;
  setEditModalOpen: (open: boolean) => void;
  deleteModalOpen: boolean;
  setDeleteModalOpen: (open: boolean) => void;
  editName: string;
  setEditName: (name: string) => void;
  editDescription: string;
  setEditDescription: (description: string) => void;
  editPublic: boolean;
  setEditPublic: (isPublic: boolean) => void;
  onSaveEdit: () => void;
  onDelete: () => void;
}

export function CollectionEditDeleteModals({
  editModalOpen,
  setEditModalOpen,
  deleteModalOpen,
  setDeleteModalOpen,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editPublic,
  setEditPublic,
  onSaveEdit,
  onDelete,
}: CollectionEditDeleteModalsProps) {
  return (
    <>
      {/* Edit modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit collection</DialogTitle>
            <DialogDescription>Update your collection details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Collection name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-surface-secondary border-separator border"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-surface-secondary border-separator border"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-public"
                checked={editPublic}
                onChange={(e) => setEditPublic(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="edit-public" className="cursor-pointer">
                Public collection
              </Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={onSaveEdit} disabled={!editName} className="flex-1 text-black">
                Save changes
              </Button>
              <Button onClick={() => setEditModalOpen(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this collection? This action cannot be undone. Cards
              in this collection will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button onClick={onDelete} variant="destructive" className="flex-1">
              Delete collection
            </Button>
            <Button onClick={() => setDeleteModalOpen(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
