import { Suspense } from "react";
import type { Metadata } from "next";
import { CardsHub } from "~/components/vault/cards/CardsHub";

export const metadata: Metadata = { title: "Mine · Cards - IxStates" };

export default function VaultCardsMinePage() {
  return (
    <Suspense fallback={null}>
      <CardsHub initialTab="mine" />
    </Suspense>
  );
}
