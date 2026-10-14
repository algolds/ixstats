"use client";

import React, { useEffect } from "react";
import { CountryLeaderboards } from "~/components/achievements/tabs/CountryLeaderboards";
import { PageHeader } from "~/components/shell/PageHeader";

export default function LeaderboardsPage() {
  useEffect(() => {
    document.title = "Global leaderboards";
  }, []);

  return (
    <div className="container mx-auto space-y-6 px-4 py-4 sm:py-6 md:py-8">
      <PageHeader title="Global leaderboards" bleed />
      <CountryLeaderboards />
    </div>
  );
}
