// src/app/(wikios)/w/special/watchlist/page.tsx
// Redirect to new Lore Stashes page.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { withBasePath } from "~/lib/base-path";

export default function WatchlistRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(withBasePath("/stashes"));
  }, [router]);
  return null;
}
