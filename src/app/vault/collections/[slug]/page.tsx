/**
 * Collection Detail Page - Enhanced
 * View collection with 3D carousel, social features, and interactive card display
 */

"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
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
  Heart,
  MessageCircle,
  TrendingUp,
  Users,
  Calendar,
  Send,
  Sparkles,
} from "lucide-react";
import { useCollections } from "~/hooks/vault/useCollections";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { Card3DViewer } from "~/components/cards/display/Card3DViewer";
import type { CardInstance } from "~/types/cards-display";

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
  const [activeTab, setActiveTab] = useState("grid");
  const [commentText, setCommentText] = useState("");
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);

  const { collections, updateCollection, deleteCollection } = useCollections();

  // Find collection by slug
  const collection = collections.find((c) => c.slug === slug);

  // Fetch collection details from API (with stats)
  const { data: collectionDetails } = api.vault.getCollectionDetails.useQuery(
    { collectionId: collection?.id ?? "" },
    { enabled: !!collection?.id }
  );

  // Fetch comments
  const { data: commentsData, refetch: refetchComments } = api.vault.getCollectionComments.useQuery(
    { collectionId: collection?.id ?? "" },
    { enabled: !!collection?.id }
  );

  // Like mutation
  const likeMutation = api.vault.likeCollection.useMutation({
    onSuccess: () => {
      toast.success("Collection liked!");
    },
  });

  // Comment mutation
  const commentMutation = api.vault.addCollectionComment.useMutation({
    onSuccess: () => {
      setCommentText("");
      refetchComments();
      toast.success("Comment added!");
    },
  });

  // TODO: Replace with actual card data from API
  const cards: CardInstance[] = [];

  if (!collection) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="glass-hierarchy-child max-w-md">
          <CardContent className="p-8 text-center">
            <p className="mb-4 text-lg font-semibold text-white">Collection not found</p>
            <Button onClick={() => router.push("/vault/collections")}>
              Back to Collections
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = collectionDetails?.stats ?? {
    cardCount: 0,
    totalValue: 0,
    likes: 0,
    comments: 0,
  };

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

  const handleLike = () => {
    if (collection?.id) {
      likeMutation.mutate({ collectionId: collection.id });
    }
  };

  const handleAddComment = () => {
    if (commentText.trim() && collection?.id) {
      commentMutation.mutate({
        collectionId: collection.id,
        content: commentText.trim(),
      });
    }
  };

  const handleNextCard = () => {
    if (cards.length > 0) {
      setCurrentCarouselIndex((prev) => (prev + 1) % cards.length);
    }
  };

  const handlePrevCard = () => {
    if (cards.length > 0) {
      setCurrentCarouselIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Back button */}
      <Link href="/vault/collections">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Collections
        </Button>
      </Link>

      {/* Collection header with stats */}
      <Card className="glass-hierarchy-parent">
        <CardHeader>
          <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3">
                <CardTitle className="text-2xl sm:text-3xl text-white">
                  {collection.name}
                </CardTitle>
                {collection.isPublic ? (
                  <Globe className="h-5 w-5 text-blue-400" />
                ) : (
                  <Lock className="h-5 w-5 text-gold-400" />
                )}
              </div>
              <p className="text-sm sm:text-base text-white/70">
                {collection.description || "No description"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLike}
                className="glass-hierarchy-child"
              >
                <Heart className="mr-2 h-4 w-4 text-pink-400" />
                Like
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="glass-hierarchy-child"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="glass-hierarchy-child"
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(true)}
                className="glass-hierarchy-child text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
              <p className="mb-1 text-xs text-white/60">Card Count</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{stats.cardCount}</p>
            </div>
            <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
              <p className="mb-1 text-xs text-white/60">Total Value</p>
              <p className="text-xl sm:text-2xl font-bold text-green-400">
                {stats.totalValue.toLocaleString()} IxC
              </p>
            </div>
            <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
              <p className="mb-1 text-xs text-white/60">Likes</p>
              <p className="text-xl sm:text-2xl font-bold text-pink-400">{stats.likes}</p>
            </div>
            <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
              <p className="mb-1 text-xs text-white/60">Comments</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-400">{stats.comments}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Grid View | 3D Carousel | Comments */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="glass-hierarchy-child gap-2">
          <TabsTrigger
            value="grid"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === "grid"
                ? "glass-hierarchy-interactive text-white"
                : "text-white/60 hover:text-white/80"
            )}
          >
            <Grid3x3 className="h-4 w-4 mr-2" />
            Grid View
          </TabsTrigger>
          <TabsTrigger
            value="carousel"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === "carousel"
                ? "glass-hierarchy-interactive text-white"
                : "text-white/60 hover:text-white/80"
            )}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            3D Carousel
          </TabsTrigger>
          <TabsTrigger
            value="comments"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === "comments"
                ? "glass-hierarchy-interactive text-white"
                : "text-white/60 hover:text-white/80"
            )}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Comments ({stats.comments})
          </TabsTrigger>
        </TabsList>

        {/* Grid View Tab */}
        <TabsContent value="grid">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Cards in Collection
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="glass-hierarchy-child">
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

            {/* Card grid placeholder */}
            <Card className="glass-hierarchy-child">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Grid3x3 className="mb-4 h-16 w-16 text-white/20" />
                <p className="mb-2 text-lg font-semibold text-white">CardGrid Component</p>
                <p className="text-sm text-white/60">
                  Card grid will display collection cards
                </p>
                <p className="mt-2 text-xs text-white/50">
                  Filter: {cardFilter || "none"} • Cards: {cards.length}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 3D Carousel Tab */}
        <TabsContent value="carousel">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-parent rounded-lg p-6 sm:p-8"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center">
              3D Card Showcase
            </h2>

            {cards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Sparkles className="h-16 w-16 text-white/20 mb-4" />
                <p className="text-white/70 mb-2">No cards in this collection yet</p>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-gold-500 to-orange-500 text-black mt-4"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Card
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                {/* 3D Card Viewer */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentCarouselIndex}
                    initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    exit={{ opacity: 0, scale: 0.8, rotateY: 90 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Card3DViewer
                      card={cards[currentCarouselIndex]!}
                      size="large"
                      enableFlip={true}
                      enableDragRotation={true}
                      enableMouseTracking={true}
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Carousel controls */}
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handlePrevCard}
                    variant="outline"
                    size="sm"
                    className="glass-hierarchy-child"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-white/70">
                    {currentCarouselIndex + 1} / {cards.length}
                  </span>
                  <Button
                    onClick={handleNextCard}
                    variant="outline"
                    size="sm"
                    className="glass-hierarchy-child"
                  >
                    Next
                  </Button>
                </div>

                {/* Card info */}
                <div className="glass-hierarchy-child rounded-lg p-4 max-w-md text-center">
                  <h3 className="text-lg font-bold text-white mb-2">
                    {cards[currentCarouselIndex]?.title}
                  </h3>
                  <p className="text-sm text-white/70">
                    {cards[currentCarouselIndex]?.description || "No description"}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments">
          <div className="space-y-4">
            {/* Add comment */}
            <Card className="glass-hierarchy-child">
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Add a Comment</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Share your thoughts..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="glass-hierarchy-child flex-1"
                    maxLength={500}
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || commentMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-purple-500"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-white/50 mt-2">
                  {commentText.length}/500 characters
                </p>
              </CardContent>
            </Card>

            {/* Comments list */}
            {commentsData?.comments && commentsData.comments.length > 0 ? (
              <div className="space-y-3">
                {commentsData.comments.map((comment: any) => (
                  <Card key={comment.id} className="glass-hierarchy-child">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-white">
                              {comment.userId}
                            </span>
                            <span className="text-xs text-white/50">
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-white/80">{comment.content}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="glass-hierarchy-child">
                <CardContent className="p-12 text-center">
                  <MessageCircle className="h-12 w-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/70">No comments yet</p>
                  <p className="text-sm text-white/50 mt-1">
                    Be the first to share your thoughts!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

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
