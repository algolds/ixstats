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
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
      {/* Page header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">Browse Collections</h1>
        <p className="text-sm text-white/70 sm:text-base">
          Discover amazing card collections from the IxWiki community
        </p>
      </div>

      {/* Collection gallery */}
      <CollectionGallery showLeaderboard={true} defaultSort="newest" pageSize={24} />
    </div>
  );
}
