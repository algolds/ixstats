"use client";

import React, { useEffect } from "react";
import { CountryLeaderboards } from "~/components/achievements/tabs/CountryLeaderboards";
import { PortalTintSync } from "~/components/providers/PortalTintSync";
import { PageHeader } from "~/components/shell/PageHeader";

export default function LeaderboardsPage() {
  useEffect(() => {
    document.title = "Leaderboards - IxStates";
  }, []);

  return (
    <div data-app="vault" className="container mx-auto space-y-6 px-4 py-4 sm:py-6 md:py-8">
      <PortalTintSync />
      <PageHeader
        title="Leaderboards"
        subtitle="Ranked nation metrics and collector achievement standings."
        bleed
      />
      <CountryLeaderboards />
    </div>
  );
}
