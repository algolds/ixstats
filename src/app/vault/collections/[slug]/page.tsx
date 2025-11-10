"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Share2,
  Lock,
  Globe,
  Plus,
  Filter,
  Grid3x3,
} from "lucide-react";
import { useCollections } from "~/hooks/vault/useCollections";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "~/lib/utils";

// TODO: This will use CardGrid from Agent 1
function CardGrid({ cards, filter }: { cards: any[]; filter: string }) {
  return (
    <Card className="glass-hierarchy-child">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Grid3x3 className="mb-4 h-16 w-16 text-muted-foreground" />
        <p className="mb-2 text-lg font-semibold">CardGrid Component</p>
        <p className="text-sm text-muted-foreground">
          This will be the card grid from Agent 1
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Filter: {filter || "none"}
        </p>
        <p className="text-xs text-muted-foreground">Cards: {cards.length}</p>
      </CardContent>
    </Card>
  );
}

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const [cardFilter, setCardFilter] = useState<string>("");

  const { collections, updateCollection, deleteCollection } = useCollections();

  // Find collection by slug
  const collection = collections.find((c) => c.slug === slug);

  // TODO: Replace with actual card data from API
  const cards: any[] = [];

  if (!collection) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="glass-hierarchy-child max-w-md">
          <CardContent className="p-8 text-center">
            <p className="mb-4 text-lg font-semibold">Collection not found</p>
            <Button onClick={() => router.push("/vault/collections")}>
              Back to Collections
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEdit = () => {
    setEditName(collection.name);
    setEditDescription(collection.description || "");
    setEditPublic(collection.isPublic);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    await updateCollection(collection.id, {
      name: editName,
      description: editDescription,
      isPublic: editPublic,
    });
    setEditModalOpen(false);
    toast.success("Collection updated successfully");
  };

  const handleDelete = async () => {
    await deleteCollection(collection.id);
    setDeleteModalOpen(false);
    router.push("/vault/collections");
    toast.success("Collection deleted successfully");
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Collection link copied to clipboard");
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/vault/collections">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Collections
        </Button>
      </Link>

      {/* Collection header */}
      <Card className="glass-hierarchy-parent">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <CardTitle className="text-3xl">{collection.name}</CardTitle>
                {collection.isPublic ? (
                  <Globe className="h-5 w-5 text-blue-400" />
                ) : (
                  <Lock className="h-5 w-5 text-gold-400" />
                )}
              </div>
              <p className="text-muted-foreground">
                {collection.description || "No description"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(true)}
                className="text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-white/5 p-4">
              <p className="mb-1 text-sm text-muted-foreground">Card Count</p>
              <p className="text-2xl font-bold">{collection.cardCount}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="mb-1 text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-green-400">
                {collection.totalValue.toLocaleString()} IxC
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="mb-1 text-sm text-muted-foreground">Visibility</p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  collection.isPublic ? "text-blue-400" : "text-gold-400"
                )}
              >
                {collection.isPublic ? "Public" : "Private"}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="mb-1 text-sm text-muted-foreground">Created</p>
              <p className="text-2xl font-bold">
                {new Date(collection.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collection management */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cards in Collection</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-gold-500 to-orange-500 text-black"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Cards
          </Button>
        </div>
      </div>

      {/* Card grid */}
      <CardGrid cards={cards} filter={cardFilter} />

      {/* Edit modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="glass-hierarchy-modal">
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
            <DialogDescription>
              Update your collection details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Collection Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="glass-hierarchy-child"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="glass-hierarchy-child"
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
              <Button
                onClick={handleSaveEdit}
                disabled={!editName}
                className="flex-1 bg-gradient-to-r from-gold-500 to-orange-500 text-black"
              >
                Save Changes
              </Button>
              <Button
                onClick={() => setEditModalOpen(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="glass-hierarchy-modal">
          <DialogHeader>
            <DialogTitle>Delete Collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this collection? This action cannot
              be undone. Cards in this collection will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              onClick={handleDelete}
              variant="destructive"
              className="flex-1"
            >
              Delete Collection
            </Button>
            <Button
              onClick={() => setDeleteModalOpen(false)}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
