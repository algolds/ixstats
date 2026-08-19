/**
 * Collection Detail Page - Enhanced
 * View collection with 3D carousel, social features, and interactive card display
 */

"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { ArrowLeft, Plus, Filter, Grid3x3, Sparkles, MessageCircle } from "lucide-react";
import { useCollections } from "~/hooks/vault/useCollections";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";
import type { CardInstance } from "~/types/cards-display";
import { CollectionHeaderStats } from "~/components/vault/collections/CollectionHeaderStats";
import { CollectionCarouselTab } from "~/components/vault/collections/CollectionCarouselTab";
import { CollectionCommentsTab } from "~/components/vault/collections/CollectionCommentsTab";
import { CollectionEditDeleteModals } from "~/components/vault/collections/CollectionEditDeleteModals";

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const [cardFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState("grid");
  const [commentText, setCommentText] = useState("");
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);

  const notify = useNotify();
  const { collections, updateCollection, deleteCollection } = useCollections();

  const collection = collections.find((c) => c.slug === slug);

  const { data: collectionDetails } = api.vault.getCollectionDetails.useQuery(
    { collectionId: collection?.id ?? "" },
    { enabled: !!collection?.id }
  );

  const { data: commentsData, refetch: refetchComments } = api.vault.getCollectionComments.useQuery(
    { collectionId: collection?.id ?? "" },
    { enabled: !!collection?.id }
  );

  const likeMutation = api.vault.likeCollection.useMutation({
    onSuccess: () => {
      notify.success("Collection liked!");
    },
  });

  const commentMutation = api.vault.addCollectionComment.useMutation({
    onSuccess: () => {
      setCommentText("");
      refetchComments();
      notify.success("Comment added!");
    },
  });

  const cards: CardInstance[] = [];

  if (!collection) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="glass-hierarchy-child max-w-md">
          <CardContent className="p-8 text-center">
            <p className="mb-4 text-lg font-semibold text-white">Collection not found</p>
            <Button onClick={() => router.push("/vault/collections")}>Back to Collections</Button>
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
    notify.success("Collection updated successfully");
  };

  const handleDelete = async () => {
    await deleteCollection(collection.id);
    setDeleteModalOpen(false);
    router.push("/vault/collections");
    notify.success("Collection deleted successfully");
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    notify.success("Collection link copied to clipboard");
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
      <Link href="/vault/collections">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Collections
        </Button>
      </Link>

      <CollectionHeaderStats
        name={collection.name}
        description={collection.description}
        isPublic={collection.isPublic}
        stats={stats}
        onLike={handleLike}
        onShare={handleShare}
        onEdit={handleEdit}
        onDelete={() => setDeleteModalOpen(true)}
      />

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
            <Grid3x3 className="mr-2 h-4 w-4" />
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
            <Sparkles className="mr-2 h-4 w-4" />
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
            <MessageCircle className="mr-2 h-4 w-4" />
            Comments ({stats.comments})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white sm:text-2xl">Cards in Collection</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="glass-hierarchy-child">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
                <Button
                  size="sm"
                  className="from-gold-500 bg-gradient-to-r to-orange-500 text-black"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Cards
                </Button>
              </div>
            </div>

            <Card className="glass-hierarchy-child">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Grid3x3 className="mb-4 h-16 w-16 text-white/20" />
                <p className="mb-2 text-lg font-semibold text-white">CardGrid Component</p>
                <p className="text-sm text-white/60">Card grid will display collection cards</p>
                <p className="mt-2 text-xs text-white/50">
                  Filter: {cardFilter || "none"} • Cards: {cards.length}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="carousel">
          <CollectionCarouselTab
            cards={cards}
            currentIndex={currentCarouselIndex}
            onNext={handleNextCard}
            onPrev={handlePrevCard}
          />
        </TabsContent>

        <TabsContent value="comments">
          <CollectionCommentsTab
            commentText={commentText}
            setCommentText={setCommentText}
            onAddComment={handleAddComment}
            isPending={commentMutation.isPending}
            comments={commentsData?.comments}
          />
        </TabsContent>
      </Tabs>

      <CollectionEditDeleteModals
        editModalOpen={editModalOpen}
        setEditModalOpen={setEditModalOpen}
        deleteModalOpen={deleteModalOpen}
        setDeleteModalOpen={setDeleteModalOpen}
        editName={editName}
        setEditName={setEditName}
        editDescription={editDescription}
        setEditDescription={setEditDescription}
        editPublic={editPublic}
        setEditPublic={setEditPublic}
        onSaveEdit={handleSaveEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
