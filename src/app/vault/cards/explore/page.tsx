import { Suspense } from "react";
import type { Metadata } from "next";
import { CardsHub } from "~/components/vault/cards/CardsHub";

export const metadata: Metadata = { title: "Explore · Cards - IxStates" };

export default function VaultCardsExplorePage() {
  return (
    <Suspense fallback={null}>
      <CardsHub initialTab="explore" />
    </Suspense>
  );
}
