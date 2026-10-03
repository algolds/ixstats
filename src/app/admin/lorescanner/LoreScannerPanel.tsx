"use client";
// src/app/admin/lorescanner/LoreScannerPanel.tsx
// Wiki Links LoreScanner Admin Panel

import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";

import { api } from "~/trpc/react";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
import { BulkScannerSection } from "../wiki/components";

export function LoreScannerPanel() {
  usePageTitle({ title: "Admin - LoreScanner" });

  const { data: countriesData } = api.countries.getAll.useQuery(
    { limit: 500, realm: ALL_REALMS },
    { refetchOnWindowFocus: false }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="LoreScanner"
        subtitle="Scan wiki articles for nation entities and generate cross-links."
      />

      <BulkScannerSection countriesData={countriesData} />
    </div>
  );
}

export default LoreScannerPanel;
