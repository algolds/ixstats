// src/app/leaderboards/page.tsx
// Redirects to the new consolidated Leaderboards tab under Achievements.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LeaderboardsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/achievements?tab=leaderboard");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-muted-foreground text-sm">
      Redirecting to unified Global Leaderboards...
    </div>
  );
}
