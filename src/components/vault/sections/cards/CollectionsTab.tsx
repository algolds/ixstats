"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Folder, Plus, Trash as Trash2, NavArrowDown as ChevronDown } from "iconoir-react";
import { cn } from "~/lib/utils";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { api } from "~/trpc/react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import type { CardInstance } from "~/types/cards-display";

export function CollectionsTab({
  createOpen,
  onCreateOpenChange,
}: {
  createOpen: boolean;
  onCreateOpenChange: (v: boolean) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: collections, isLoading, refetch } = api.cards.getMyCollections.useQuery();
  const { data: collectionCards } = api.cards.getCollectionCards.useQuery(
    { collectionId: expandedId! },
    { enabled: !!expandedId }
  );

  const createCollection = api.cards.createCollection.useMutation({
    onSuccess: () => {
      vaultNotify.success("Collection created");
      onCreateOpenChange(false);
      setNewName("");
      setNewDescription("");
      setNewIsPublic(false);
      void refetch();
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  const deleteCollection = api.cards.deleteCollection.useMutation({
    onSuccess: () => {
      vaultNotify.success("Collection deleted");
      setExpandedId(null);
      void refetch();
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="text-tint h-3.5 w-3.5" />
          <span className="text-footnote font-semibold">My collections</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="rounded-control h-16" />
          ))}
        </div>
      ) : !collections || collections.length === 0 ? (
        <Card className="flex flex-col gap-6 py-6">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Folder className="text-label-tertiary mb-3 h-10 w-10" />
            <p className="text-label text-headline mb-1">No collections</p>
            <p className="text-label-secondary text-footnote max-w-md text-center">
              Create collections to organize cards by theme, rarity, or custom categories.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              size="sm"
              onClick={() => onCreateOpenChange(true)}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create collection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {collections.map((collection) => (
            <div key={collection.id}>
              {/* Disclosure and delete are sibling buttons (a button may not contain a button). */}
              <div
                className={cn(
                  "bg-surface-secondary rounded-control flex w-full items-center gap-2 border pr-3 transition-[border-color]",
                  expandedId === collection.id ? "border-yellow/30" : "border-separator"
                )}
              >
                <Button
                  variant="ghost"
                  aria-expanded={expandedId === collection.id}
                  onClick={() => setExpandedId(expandedId === collection.id ? null : collection.id)}
                  className="h-auto min-w-0 flex-1 justify-between p-3 text-left font-normal hover:bg-transparent"
                >
                  <span className="flex items-center gap-2">
                    <Folder className="text-tint h-4 w-4" />
                    <span>
                      <span className="text-footnote block font-semibold">{collection.name}</span>
                      <span className="text-label-secondary text-footnote block">
                        {collection._count?.items ?? 0} cards
                        {collection.isPublic && " • Public"}
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      expandedId === collection.id && "rotate-180"
                    )}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${collection.name}`}
                  className="text-red hover:bg-red/10 size-6"
                  onClick={() => deleteCollection.mutate({ collectionId: collection.id })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {/* Expanded cards */}
              <AnimatePresence>
                {expandedId === collection.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 pl-4">
                      {!collectionCards || collectionCards.length === 0 ? (
                        <p className="text-label-secondary text-footnote py-4 text-center">
                          No cards in this collection yet. Use Select Mode in Inventory to add
                          cards.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                          {collectionCards.map((item) => (
                            <CardDisplay
                              key={item.id}
                              card={(item.cardOwnership?.cards ?? item) as unknown as CardInstance}
                              size="small"
                              performanceMode
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Create Collection Dialog */}
      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-headline">Create collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-label-secondary text-footnote mb-1 block font-semibold">
                Name
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My rare cards"
                className="text-footnote h-8"
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-label-secondary text-footnote mb-1 block font-semibold">
                Description (optional)
              </label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="A collection of my rarest finds"
                className="text-footnote h-8"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={newIsPublic}
                onCheckedChange={(v) => setNewIsPublic(v as boolean)}
              />
              <span className="text-label-secondary text-footnote">
                Make this collection public
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCreateOpenChange(false)}
              className="text-footnote"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newName.trim() || createCollection.isPending}
              onClick={() =>
                createCollection.mutate({
                  name: newName.trim(),
                  description: newDescription.trim() || undefined,
                  isPublic: newIsPublic,
                })
              }
            >
              {createCollection.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
