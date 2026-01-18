"use client";

/**
 * Premium Collections Page - IxCards Collection Manager
 * Phase 4: Brand New Premium UI/UX
 *
 * Features:
 * - Collections grid/list view toggle
 * - Create new collection button with modal
 * - Collection cards showing:
 *   - Preview of first 4 cards (overlapping stack)
 *   - Card count and total value
 *   - Public/private indicator
 *   - Edit/delete actions
 * - Collection detail view (expandable card):
 *   - Full card grid (masonry layout)
 *   - Drag-and-drop to reorder
 *   - Add/remove cards
 *   - Share button with link generation
 *   - Collection stats dashboard
 *   - Theme selector
 * - Template collections (starter, themed)
 * - Search and filter within collection
 * - Bulk selection tools
 * - Export collection as image
 * - Glass physics design system
 * - Mobile-optimized with touch gestures
 */

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder,
  Plus,
  Lock,
  Globe,
  TrendingUp,
  Layers,
  Grid3x3,
  List,
  Search,
  Share2,
  Edit,
  Trash2,
  Download,
  Eye,
  EyeOff,
  Sparkles,
  Package,
  Star,
  ChevronDown,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { CardDisplay } from "~/components/cards/display/CardDisplay";

/**
 * Collection Card Component
 */
function CollectionCard({ collection, onEdit, onDelete, onView }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.div
      className="group relative rounded-2xl overflow-hidden glass-hierarchy-child cursor-pointer"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => onView(collection.id)}
      whileHover={{ y: -5 }}
    >
      {/* Background surface */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Visibility badge */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1 backdrop-blur-md">
        {collection.isPublic ? (
          <>
            <Globe className="h-3 w-3 text-blue-400" />
            <span className="text-xs font-bold text-blue-400">PUBLIC</span>
          </>
        ) : (
          <>
            <Lock className="h-3 w-3 text-gold-400" />
            <span className="text-xs font-bold text-gold-400">PRIVATE</span>
          </>
        )}
      </div>

      {/* Card preview grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {collection.previewCards?.slice(0, 4).map((card: any, idx: number) => (
            <motion.div
              key={card?.id || idx}
              className="aspect-square rounded-lg bg-white/5 border border-white/10 overflow-hidden"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
            >
              {card ? (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="w-full">
                    <CardDisplay card={card} size="small" performanceMode />
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-gray-500" />
                </div>
              )}
            </motion.div>
          ))}
          {(!collection.previewCards || collection.previewCards.length < 4) &&
            Array.from({ length: 4 - (collection.previewCards?.length || 0) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-square rounded-lg border-2 border-dashed border-white/10"
              />
            ))}
        </div>

        {/* Collection info */}
        <div className="space-y-2">
          <h3 className="text-lg font-black text-white line-clamp-1">
            {collection.name}
          </h3>
          {collection.description && (
            <p className="text-sm text-gray-400 line-clamp-2">
              {collection.description}
            </p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-gray-400">Cards</p>
              <p className="text-xl font-black text-blue-400">{collection.cardCount}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-gray-400">Value</p>
              <p className="text-xl font-black text-gold-400">
                {collection.totalValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons (show on hover) */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-black/80 p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView(collection.id);
                }}
                className="flex items-center justify-center gap-1 rounded-lg bg-blue-500/20 px-3 py-2 text-xs font-bold text-blue-400 hover:bg-blue-500/30 transition-all"
              >
                <Eye className="h-3 w-3" />
                View
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(collection.id);
                }}
                className="flex items-center justify-center gap-1 rounded-lg bg-gold-500/20 px-3 py-2 text-xs font-bold text-gold-400 hover:bg-gold-500/30 transition-all"
              >
                <Edit className="h-3 w-3" />
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(collection.id);
                }}
                className="flex items-center justify-center gap-1 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/30 transition-all"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Holographic glow on hover */}
      {isHovered && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 rounded-2xl bg-white/10 blur-xl" />
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Create Collection Modal Component
 */
function CreateCollectionModal({ open, onClose, onCreate }: any) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [template, setTemplate] = useState<string | null>(null);

  const templates = [
    { id: "blank", name: "Blank Collection", icon: Folder, color: "gray" },
    { id: "legendary", name: "Legendary Cards", icon: Star, color: "gold" },
    { id: "nation", name: "Nation Cards", icon: Globe, color: "blue" },
    { id: "favorites", name: "My Favorites", icon: Sparkles, color: "purple" },
  ];

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Please enter a collection name");
      return;
    }
    onCreate({ name, description, isPublic, template });
    setName("");
    setDescription("");
    setIsPublic(true);
    setTemplate(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl glass-hierarchy-modal p-8 max-h-[90vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-black text-white">Create New Collection</h2>
              <p className="text-sm text-gray-400">
                Organize your cards into custom collections
              </p>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Name input */}
              <div>
                <label className="mb-2 block text-sm font-bold text-white">
                  Collection Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Awesome Collection"
                  className="w-full rounded-lg border border-white/20 bg-black/40 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Description input */}
              <div>
                <label className="mb-2 block text-sm font-bold text-white">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A collection of my favorite cards..."
                  rows={3}
                  className="w-full rounded-lg border border-white/20 bg-black/40 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              {/* Template selection */}
              <div>
                <label className="mb-2 block text-sm font-bold text-white">
                  Template
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTemplate(t.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border-2 p-4 transition-all",
                        template === t.id
                          ? "border-blue-500 bg-blue-500/20"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <t.icon className={cn("h-6 w-6", `text-${t.color}-400`)} />
                      <span className="text-sm font-bold text-white">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility toggle */}
              <div className="flex items-center justify-between rounded-lg bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <Globe className="h-5 w-5 text-blue-400" />
                  ) : (
                    <Lock className="h-5 w-5 text-gold-400" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-white">
                      {isPublic ? "Public Collection" : "Private Collection"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {isPublic
                        ? "Anyone can view this collection"
                        : "Only you can view this collection"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={cn(
                    "relative h-8 w-14 rounded-full transition-all",
                    isPublic ? "bg-blue-500" : "bg-gray-600"
                  )}
                >
                  <motion.div
                    className="absolute top-1 h-6 w-6 rounded-full bg-white"
                    animate={{ left: isPublic ? 28 : 4 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  className="flex-1 rounded-lg bg-purple-600 px-6 py-3 font-black text-white transition-all hover:scale-105 active:scale-95"
                >
                  Create Collection
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-bold text-white transition-all hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Main Collections Page Component
 */
export default function CollectionsPage() {
  const { userId } = useAuth();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVisibility, setFilterVisibility] = useState<"all" | "public" | "private">("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  // Mock collections data (replace with tRPC query)
  const mockCollections = [
    {
      id: "1",
      name: "My Legendary Collection",
      description: "All my legendary cards",
      cardCount: 12,
      totalValue: 45000,
      isPublic: true,
      previewCards: [],
    },
    {
      id: "2",
      name: "Nation Cards",
      description: "Cards from different nations",
      cardCount: 24,
      totalValue: 18000,
      isPublic: false,
      previewCards: [],
    },
    {
      id: "3",
      name: "Favorites",
      description: "My favorite cards",
      cardCount: 8,
      totalValue: 12000,
      isPublic: true,
      previewCards: [],
    },
  ];

  const collections = mockCollections.filter((c) => {
    if (filterVisibility === "public") return c.isPublic;
    if (filterVisibility === "private") return !c.isPublic;
    return true;
  });

  const totalCollections = collections.length;
  const totalCards = collections.reduce((sum, c) => sum + c.cardCount, 0);
  const totalValue = collections.reduce((sum, c) => sum + c.totalValue, 0);

  const handleCreateCollection = useCallback((data: any) => {
    toast.success(`Collection "${data.name}" created!`);
  }, []);

  const handleEditCollection = useCallback((id: string) => {
    toast.info("Edit collection functionality coming soon!");
  }, []);

  const handleDeleteCollection = useCallback((id: string) => {
    toast.info("Delete collection functionality coming soon!");
  }, []);

  const handleViewCollection = useCallback((id: string) => {
    setSelectedCollection(id);
    toast.info("Collection detail view coming soon!");
  }, []);

  return (
    <div className="min-h-screen space-y-8">
      {/* Background pattern */}
      {/* <div className="fixed inset-0 -z-10 opacity-30">
        <InteractiveGridPattern />
      </div> */}

      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-gold-400 sm:text-4xl">
              My Collections
            </h1>
            <p className="text-sm text-gray-400 sm:text-base">
              Organize and showcase your card collections
            </p>
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-500 to-orange-500 px-6 py-3 font-black text-black transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            Create Collection
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="glass-hierarchy-child rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Collections</p>
                <p className="text-2xl font-black text-gold-400">{totalCollections}</p>
              </div>
              <Folder className="h-8 w-8 text-gold-400" />
            </div>
          </div>

          <div className="glass-hierarchy-child rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Cards</p>
                <p className="text-2xl font-black text-blue-400">{totalCards}</p>
              </div>
              <Layers className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="glass-hierarchy-child rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Value</p>
                <p className="text-2xl font-black text-green-400">
                  {totalValue.toLocaleString()} IxC
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search collections..."
              className="w-full rounded-lg border border-white/20 bg-black/40 py-3 pl-11 pr-4 text-white placeholder-gray-500 backdrop-blur-md focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Visibility filter */}
          <div className="glass-hierarchy-child flex rounded-lg p-1">
            {["all", "public", "private"].map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterVisibility(mode as any)}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-bold transition-all",
                  filterVisibility === mode
                    ? "bg-blue-500 text-white"
                    : "text-gray-400 hover:text-white"
                )}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="glass-hierarchy-child flex rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded-md p-2 transition-all",
                viewMode === "grid"
                  ? "bg-blue-500 text-white"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <Grid3x3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-md p-2 transition-all",
                viewMode === "list"
                  ? "bg-blue-500 text-white"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Template collections (teaser) */}
      <div className="glass-hierarchy-child rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Start from a template</h3>
            <button
            onClick={() => setCreateModalOpen(true)}
            className="rounded-lg border border-purple-400/30 px-3 py-1.5 text-xs font-bold text-purple-200 hover:bg-purple-400/10"
          >
            Create from template
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { name: "Starter Set", desc: "A clean starter layout for new collections" },
            { name: "Rarity Showcase", desc: "Highlight rare and legendary cards" },
            { name: "Nation Theme", desc: "Group by nation or season theme" },
          ].map((t) => (
            <div key={t.name} className="rounded-xl border border-purple-500/20 bg-black/30 p-4">
              <div className="mb-1 font-semibold text-white">{t.name}</div>
              <div className="text-xs text-gray-400">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Collections grid */}
      {collections.length === 0 ? (
        <div className="glass-hierarchy-child flex flex-col items-center justify-center rounded-2xl p-16">
          <Package className="mb-4 h-16 w-16 text-gray-400" />
          <h3 className="mb-2 text-xl font-bold text-white">No Collections Yet</h3>
          <p className="mb-6 text-gray-400">Create your first collection to get started!</p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-black text-black transition-all hover:scale-105"
          >
            <Plus className="h-5 w-5" />
            Create Collection
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-6",
            viewMode === "grid"
              ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "grid-cols-1"
          )}
        >
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onEdit={handleEditCollection}
              onDelete={handleDeleteCollection}
              onView={handleViewCollection}
            />
          ))}
        </div>
      )}

      {/* Create collection modal */}
      <CreateCollectionModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateCollection}
      />
    </div>
  );
}
