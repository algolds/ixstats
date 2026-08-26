// src/app/(wiki-os)/wiki/watchlist/page.tsx
// WikiOS Stash Watchlist Hub
"use client";

import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { WikiWatchlistFeed } from "~/components/wiki-os/watchlist/WikiWatchlistFeed";

export default function WatchlistPage() {
  return (
    <WikiOSLayout title="Watchlist">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <WikiWatchlistFeed />
      </div>
    </WikiOSLayout>
  );
}
