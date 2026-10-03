"use client";
/**
 * CollectionGallery Component
 * Public collection browser with filtering, sorting, and leaderboards
 */

import { springSmooth } from "~/lib/design/motion";
import React, { useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  ViewGrid as Grid3x3,
  Trophy,
  Heart,
  Eye,
  Lock,
  Globe,
  Search,
  Filter,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SegmentedControl } from "~/components/ui/segmented-control";

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
    "mostValuable" | "mostCards"
  >("mostValuable");

  // Fetch public collections
  const {
    data: collectionsData,
    isLoading,
    // oxlint-disable-next-line eslint/no-unused-vars
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
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="w-full flex-1 sm:max-w-md">
            <div className="relative">
              <Search className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search collections or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-surface-secondary border-separator border pl-10"
              />
            </div>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="text-label-secondary h-4 w-4" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger aria-label="Sort collections">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="mostValuable">Most valuable</SelectItem>
                <SelectItem value="mostCards">Most cards</SelectItem>
                <SelectItem value="topRated">Top rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Leaderboard Section */}
      {showLeaderboard && leaderboardData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface border-separator shadow-card rounded-control border p-4 sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-title-2 text-label flex items-center gap-2">
              <Trophy className="text-yellow h-5 w-5" />
              Top collections
            </h2>
            <SegmentedControl
              size="sm"
              aria-label="Leaderboard ranking"
              value={leaderboardCategory}
              onValueChange={setLeaderboardCategory}
              options={[
                { value: "mostValuable", label: "Value" },
                { value: "mostCards", label: "Cards" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {leaderboardData.collections.slice(0, 5).map((collection) => (
              <Link
                key={collection.id}
                href={`/vault/collections/${collection.id}`}
                className="bg-surface-secondary border-separator rounded-control border p-3 transition-transform"
              >
                <div className="mb-2 flex items-start justify-between">
                  <span className="text-yellow text-footnote font-semibold">
                    #{collection.rank}
                  </span>
                  {collection.isPublic ? (
                    <Globe className="text-blue h-3 w-3" />
                  ) : (
                    <Lock className="text-yellow h-3 w-3" />
                  )}
                </div>
                <h3 className="text-headline text-label mb-1 truncate">{collection.name}</h3>
                {collection.description && (
                  <p className="text-footnote text-label-secondary truncate">
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
            <Grid3x3 className="text-label-tertiary mx-auto mb-3 h-12 w-12" />
            <p className="text-body text-label-secondary">Loading collections...</p>
          </div>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="bg-surface-secondary border-separator rounded-control border p-12 text-center">
          <Grid3x3 className="text-label-tertiary mx-auto mb-4 h-16 w-16" />
          <h3 className="text-title-3 text-label mb-2 font-semibold">No collections found</h3>
          <p className="text-body text-label-secondary">
            {searchQuery ? "Try adjusting your search query" : "No public collections yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCollections.map((collection, index) => (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springSmooth, delay: index * 0.05 }}
              >
                <Link href={`/vault/collections/${collection.id}`}>
                  <Card className="flex h-full cursor-pointer flex-col gap-6 py-6 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300">
                    <CardContent className="space-y-3 p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-headline text-label truncate">{collection.name}</h3>
                        </div>
                        {collection.isPublic ? (
                          <Globe className="text-blue ml-2 h-4 w-4 shrink-0" />
                        ) : (
                          <Lock className="text-yellow ml-2 h-4 w-4 shrink-0" />
                        )}
                      </div>

                      {/* Description */}
                      {collection.description && (
                        <p className="text-footnote text-label-secondary line-clamp-2">
                          {collection.description}
                        </p>
                      )}

                      {/* Stats */}
                      <div className="border-separator grid grid-cols-3 gap-2 border-t pt-2">
                        <div className="text-center">
                          <div className="text-footnote text-label-secondary">Cards</div>
                          <div className="text-headline text-label">{collection.cardCount}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-footnote text-label-secondary">Value</div>
                          <div className="text-headline text-yellow flex items-center justify-center gap-0.5">
                            <IxCreditsSymbol className="h-3.5 w-3.5 shrink-0" />
                            {collection.totalValue.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-footnote text-label-secondary">Likes</div>
                          <div className="text-headline text-red flex items-center justify-center gap-1">
                            <Heart className="h-3 w-3" />
                            {collection.likes}
                          </div>
                        </div>
                      </div>

                      {/* View link */}
                      <div className="text-footnote text-label-secondary hover:text-label flex items-center justify-center pt-2 transition-colors">
                        <Eye className="mr-1 h-3 w-3" />
                        View collection
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
                className="bg-surface-secondary border"
              >
                Previous
              </Button>
              <span className="text-body text-label-secondary">Page {currentPage + 1}</span>
              <Button
                onClick={handleNextPage}
                disabled={!hasMore}
                variant="outline"
                className="bg-surface-secondary border"
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
