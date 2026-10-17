import { Suspense } from "react";
import type { Metadata } from "next";
import { CardsHub } from "~/components/vault/cards/CardsHub";

export const metadata: Metadata = { title: "Sets · Cards - IxStates" };

export default function VaultCardsSetsPage() {
  return (
    <Suspense fallback={null}>
      <CardsHub initialTab="sets" />
    </Suspense>
  );
}
