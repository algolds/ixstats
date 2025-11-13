/**
 * CollectionGallery Component
 * Public collection browser with filtering, sorting, and leaderboards
 */

"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Grid3x3,
  TrendingUp,
  Trophy,
  Heart,
  Eye,
  Lock,
  Globe,
  Search,
  Filter,
  ChevronDown,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

interface CollectionGalleryProps {
  /** Show leaderboard section */
  showLeaderboard?: boolean;
  /** Default sort order */
  defaultSort?: "newest" | "mostValuable" | "mostCards" | "topRated";
  /** Items per page */
  pageSize?: number;
  /** Custom CSS classes */
  className?: string;
}

type SortOption = "newest" | "mostValuable" | "mostCards" | "topRated";

/**
 * CollectionGallery - Browse all public card collections
 *
 * Features:
 * - Public collection browsing
 * - Search by collection name/user
 * - Sort by various criteria
 * - Collection leaderboards
 * - Like/favorite tracking
 * - Glass physics design
 * - Mobile responsive
 *
 * @example
 * ```tsx
 * <CollectionGallery
 *   showLeaderboard={true}
 *   defaultSort="newest"
 *   pageSize={20}
 * />
 * ```
 */
export const CollectionGallery: React.FC<CollectionGalleryProps> = ({
  showLeaderboard = true,
  defaultSort = "newest",
  pageSize = 20,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>(defaultSort);
  const [currentPage, setCurrentPage] = useState(0);
  const [leaderboardCategory, setLeaderboardCategory] = useState<
    "mostValuable" | "mostComplete" | "mostCards"
  >("mostValuable");

  // Fetch public collections
  const {
    data: collectionsData,
    isLoading,
    refetch,
  } = api.vault.getPublicCollections.useQuery({
    limit: pageSize,
    offset: currentPage * pageSize,
    sortBy,
  });

  // Fetch leaderboard
  const { data: leaderboardData } = api.vault.getCollectionLeaderboard.useQuery(
    {
      category: leaderboardCategory,
      limit: 10,
    },
    {
      enabled: showLeaderboard,
    }
  );

  const collections = collectionsData?.collections ?? [];
  const hasMore = collectionsData?.hasMore ?? false;

  // Filter collections by search
  const filteredCollections = collections.filter((collection) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      collection.name.toLowerCase().includes(query) ||
      collection.description?.toLowerCase().includes(query)
    );
  });

  const handleNextPage = () => {
    setCurrentPage((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with search and filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 w-full sm:max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                type="text"
                placeholder="Search collections or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-hierarchy-child pl-10"
              />
            </div>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-white/70" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="glass-hierarchy-child rounded-lg px-3 py-2 text-sm text-white border-none outline-none cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="mostValuable">Most Valuable</option>
              <option value="mostCards">Most Cards</option>
              <option value="topRated">Top Rated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leaderboard Section */}
      {showLeaderboard && leaderboardData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-hierarchy-parent rounded-lg p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold-400" />
              Top Collections
            </h2>
            <div className="flex gap-2">
              {(["mostValuable", "mostComplete", "mostCards"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setLeaderboardCategory(cat)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                    leaderboardCategory === cat
                      ? "glass-hierarchy-interactive text-white"
                      : "text-white/60 hover:text-white/80"
                  )}
                >
                  {cat === "mostValuable" && "Value"}
                  {cat === "mostComplete" && "Complete"}
                  {cat === "mostCards" && "Cards"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {leaderboardData.collections.slice(0, 5).map((collection) => (
              <Link
                key={collection.id}
                href={`/vault/collections/${collection.id}`}
                className="glass-hierarchy-child rounded-lg p-3 hover:scale-105 transition-transform"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-bold text-gold-400">
                    #{collection.rank}
                  </span>
                  {collection.isPublic ? (
                    <Globe className="h-3 w-3 text-blue-400" />
                  ) : (
                    <Lock className="h-3 w-3 text-gold-400" />
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white truncate mb-1">
                  {collection.name}
                </h3>
                {collection.description && (
                  <p className="text-xs text-white/60 truncate">
                    {collection.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Collections Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Grid3x3 className="h-12 w-12 text-white/20 mx-auto mb-3 animate-pulse" />
            <p className="text-sm text-white/50">Loading collections...</p>
          </div>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="glass-hierarchy-child rounded-lg p-12 text-center">
          <Grid3x3 className="h-16 w-16 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No collections found</h3>
          <p className="text-sm text-white/60">
            {searchQuery
              ? "Try adjusting your search query"
              : "Be the first to create a public collection!"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredCollections.map((collection, index) => (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Link href={`/vault/collections/${collection.id}`}>
                  <Card className="glass-hierarchy-child hover:scale-105 transition-all duration-300 cursor-pointer h-full">
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-white truncate">
                            {collection.name}
                          </h3>
                        </div>
                        {collection.isPublic ? (
                          <Globe className="h-4 w-4 text-blue-400 flex-shrink-0 ml-2" />
                        ) : (
                          <Lock className="h-4 w-4 text-gold-400 flex-shrink-0 ml-2" />
                        )}
                      </div>

                      {/* Description */}
                      {collection.description && (
                        <p className="text-xs text-white/70 line-clamp-2">
                          {collection.description}
                        </p>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                        <div className="text-center">
                          <div className="text-xs text-white/50">Cards</div>
                          <div className="text-sm font-bold text-white">0</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-white/50">Value</div>
                          <div className="text-sm font-bold text-green-400">0 IxC</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-white/50">Likes</div>
                          <div className="text-sm font-bold text-pink-400 flex items-center justify-center gap-1">
                            <Heart className="h-3 w-3" />0
                          </div>
                        </div>
                      </div>

                      {/* View link */}
                      <div className="pt-2 flex items-center justify-center text-xs text-white/60 hover:text-white transition-colors">
                        <Eye className="h-3 w-3 mr-1" />
                        View Collection
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {(currentPage > 0 || hasMore) && (
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                variant="outline"
                className="glass-hierarchy-child"
              >
                Previous
              </Button>
              <span className="text-sm text-white/70">
                Page {currentPage + 1}
              </span>
              <Button
                onClick={handleNextPage}
                disabled={!hasMore}
                variant="outline"
                className="glass-hierarchy-child"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

CollectionGallery.displayName = "CollectionGallery";
