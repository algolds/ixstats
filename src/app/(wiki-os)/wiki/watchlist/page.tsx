// src/app/(wiki-os)/wiki/watchlist/page.tsx
// Instant redirect to unified Lore Stashes hub.

import { redirect } from "next/navigation";
import { withBasePath } from "~/lib/base-path";

export default function WatchlistRedirect() {
  redirect(withBasePath("/stashes"));
}
