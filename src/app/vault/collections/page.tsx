"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Folder,
  Plus,
  Lock,
  Globe,
  TrendingUp,
  Layers,
  Grid3x3,
} from "lucide-react";
import { useCollections } from "~/hooks/vault/useCollections";
import { cn } from "~/lib/utils";
import Link from "next/link";

export default function CollectionsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [newCollectionPublic, setNewCollectionPublic] = useState(true);
  const [filter, setFilter] = useState<"all" | "public" | "private">("all");

  const { collections, loading, createCollection } = useCollections();

  const handleCreateCollection = async () => {
    await createCollection({
      name: newCollectionName,
      description: newCollectionDescription,
      isPublic: newCollectionPublic,
    });
    setCreateModalOpen(false);
    setNewCollectionName("");
    setNewCollectionDescription("");
    setNewCollectionPublic(true);
  };

  const filteredCollections = collections.filter((collection) => {
    if (filter === "public") return collection.isPublic;
    if (filter === "private") return !collection.isPublic;
    return true;
  });

  // Collection analytics
  const totalCollections = collections.length;
  const totalUniqueCards = collections.reduce(
    (sum, col) => sum + col.cardCount,
    0
  );
  const mostValuableCollection = collections.reduce(
    (max, col) => (col.totalValue > max.totalValue ? col : max),
    collections[0]
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gold-400">Collections</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Organize and showcase your card collections
          </p>
        </div>
        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-gradient-to-r from-gold-500 to-orange-500 font-semibold text-black hover:scale-105 active:scale-95 touch-manipulation text-sm sm:text-base"
        >
          <Plus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          Create Collection
        </Button>
      </div>

      {/* Analytics summary */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 md:grid-cols-3">
        <Card className="glass-hierarchy-child">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Collections
            </CardTitle>
            <Folder className="h-4 w-4 text-gold-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gold-400">
              {totalCollections}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Unique Cards
            </CardTitle>
            <Layers className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {totalUniqueCards}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Most Valuable
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {mostValuableCollection?.totalValue.toLocaleString() ?? 0} IxC
            </div>
            <p className="text-xs text-muted-foreground">
              {mostValuableCollection?.name ?? "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList className="glass-hierarchy-child">
          <TabsTrigger value="all">All Collections</TabsTrigger>
          <TabsTrigger value="public">Public</TabsTrigger>
          <TabsTrigger value="private">Private</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {/* Collections grid */}
          {loading ? (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 md:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-56 sm:h-64" />
              ))}
            </div>
          ) : filteredCollections.length === 0 ? (
            <Card className="glass-hierarchy-child">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Folder className="mb-4 h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground" />
                <p className="text-sm sm:text-base text-muted-foreground text-center px-4">
                  No {filter !== "all" ? filter : ""} collections yet
                </p>
                <Button
                  onClick={() => setCreateModalOpen(true)}
                  className="mt-4 text-sm sm:text-base"
                >
                  Create Your First Collection
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 md:grid-cols-3">
              {filteredCollections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/vault/collections/${collection.slug}`}
                >
                  <Card className="glass-hierarchy-child group h-full cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-gold-500/20">
                    <CardHeader>
                      {/* Thumbnail preview (4 cards) */}
                      <div className="mb-4 grid grid-cols-2 gap-2">
                        {collection.thumbnailCards.slice(0, 4).map((cardId) => (
                          <div
                            key={cardId}
                            className="aspect-square rounded-lg bg-gradient-to-br from-gold-500/20 to-purple-500/20"
                          >
                            <div className="flex h-full items-center justify-center">
                              <Grid3x3 className="h-8 w-8 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                        {collection.thumbnailCards.length < 4 &&
                          Array.from({
                            length: 4 - collection.thumbnailCards.length,
                          }).map((_, i) => (
                            <div
                              key={`empty-${i}`}
                              className="aspect-square rounded-lg border-2 border-dashed border-white/10"
                            />
                          ))}
                      </div>

                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">
                          {collection.name}
                        </CardTitle>
                        {collection.isPublic ? (
                          <Globe className="h-4 w-4 text-blue-400" />
                        ) : (
                          <Lock className="h-4 w-4 text-gold-400" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                        {collection.description || "No description"}
                      </p>
                      <div className="space-y-2 rounded-lg bg-white/5 p-3">
                        <div className="flex justify-between text-sm">
                          <span>Cards:</span>
                          <span className="font-semibold">
                            {collection.cardCount}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Value:</span>
                          <span className="font-semibold text-green-400">
                            {collection.totalValue.toLocaleString()} IxC
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Visibility:</span>
                          <span
                            className={cn(
                              "font-semibold",
                              collection.isPublic
                                ? "text-blue-400"
                                : "text-gold-400"
                            )}
                          >
                            {collection.isPublic ? "Public" : "Private"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create collection modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="glass-hierarchy-modal">
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
            <DialogDescription>
              Organize your cards into a custom collection
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Collection Name</Label>
              <Input
                id="name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="My Awesome Collection"
                className="glass-hierarchy-child"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
                placeholder="A collection of my favorite cards"
                className="glass-hierarchy-child"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="public"
                checked={newCollectionPublic}
                onChange={(e) => setNewCollectionPublic(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="public" className="cursor-pointer">
                Make this collection public
              </Label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateCollection}
                disabled={!newCollectionName}
                className="flex-1 bg-gradient-to-r from-gold-500 to-orange-500 text-black"
              >
                Create Collection
              </Button>
              <Button
                onClick={() => setCreateModalOpen(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
