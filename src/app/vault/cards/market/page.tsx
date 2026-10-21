import { Suspense } from "react";
import type { Metadata } from "next";
import { CardsHub } from "~/components/vault/cards/CardsHub";

export const metadata: Metadata = { title: "Market · Cards - IxStates" };

export default function VaultCardsMarketPage() {
  return (
    <Suspense fallback={null}>
      <CardsHub initialTab="market" />
    </Suspense>
  );
}
