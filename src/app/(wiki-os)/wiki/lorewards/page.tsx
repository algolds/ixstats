// src/app/(wiki-os)/wiki/lorewards/page.tsx
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
    <div className="bg-background text-muted-foreground flex h-screen items-center justify-center text-sm">
      Redirecting to Achievements hub...
    </div>
  );
}
