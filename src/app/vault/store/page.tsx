"use client";

import { useSearchParams } from "next/navigation";
import { VaultMarketplaceSection } from "~/components/vault/sections/VaultMarketplaceSection";

export default function VaultStorePage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const view = searchParams.get("view");

  return <VaultMarketplaceSection initialTab={tab} initialView={view} />;
}
