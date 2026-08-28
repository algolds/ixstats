"use client";
// src/app/admin/lorescanner/LoreScannerPanel.tsx
// Wiki Links LoreScanner Admin Panel

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Search } from "iconoir-react";
import { api } from "~/trpc/react";
import { BulkScannerSection } from "../wiki/components";

export function LoreScannerPanel() {
  usePageTitle({ title: "Admin - LoreScanner" });

  const { data: countriesData } = api.countries.getAll.useQuery(
    { limit: 500 },
    { refetchOnWindowFocus: false }
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Search}
        title="Wiki Links LoreScanner"
        description="Automatically scan wiki articles for nation entities and generate cross-linked lore intelligence."
      />

      <BulkScannerSection countriesData={countriesData} />
    </div>
  );
}

export default LoreScannerPanel;
