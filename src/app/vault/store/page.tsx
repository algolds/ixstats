"use client";

import { useSearchParams } from "next/navigation";
import { VaultMarketplaceSection } from "~/components/vault/sections/VaultMarketplaceSection";

export default function VaultStorePage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return <VaultMarketplaceSection initialTab={tab} />;
}
