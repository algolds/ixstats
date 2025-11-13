/**
 * Public Collections Browse Page
 * Browse all public card collections with filtering and leaderboards
 */

import type { Metadata } from "next";
import { CollectionGallery } from "~/components/cards/collections/CollectionGallery";

export const metadata: Metadata = {
  title: "Browse Collections | IxStats",
  description: "Explore public card collections from the IxWiki community",
};

export default function CollectionsBrowsePage() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      {/* Page header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          Browse Collections
        </h1>
        <p className="text-sm sm:text-base text-white/70">
          Discover amazing card collections from the IxWiki community
        </p>
      </div>

      {/* Collection gallery */}
      <CollectionGallery
        showLeaderboard={true}
        defaultSort="newest"
        pageSize={24}
      />
    </div>
  );
}
