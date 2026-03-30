// src/app/(wikios)/wiki-special/watchlist/page.tsx
// Redirect to new Lore Stashes page.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { withBasePath } from "~/lib/base-path";

export default function WatchlistRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(withBasePath("/wiki-special/stashes"));
  }, [router]);
  return null;
}
