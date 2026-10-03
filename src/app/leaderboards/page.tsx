"use client";

import React, { useEffect } from "react";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { LeaderboardTab } from "~/components/achievements/tabs/LeaderboardTab";
import { PageHeader } from "~/components/shell/PageHeader";

export default function LeaderboardsPage() {
  useEffect(() => {
    document.title = "Global leaderboards";
  }, []);

  return (
    <VaultSidebarLayout>
      <div className="space-y-6">
        <PageHeader title="Global leaderboards" className="-mx-2" />
        <LeaderboardTab />
      </div>
    </VaultSidebarLayout>
  );
}
