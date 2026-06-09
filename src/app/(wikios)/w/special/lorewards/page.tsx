// src/app/(wikios)/w/special/lorewards/page.tsx
// Reroutes to the new unified Achievements dashboard with the Wiki & Lorewards tab focused.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LorewardsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/achievements?tab=wiki-lore");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-muted-foreground text-sm">
      Redirecting to unified Achievements & Lorewards hub...
    </div>
  );
}
