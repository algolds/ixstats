"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useCardSheet } from "~/hooks/useCardSheet";

const CardSheet = dynamic(() => import("./CardSheet").then((m) => m.CardSheet), { ssr: false });

function SheetFromAddress() {
  const { cardId, from, close } = useCardSheet();
  return cardId ? <CardSheet cardId={cardId} from={from} onClose={close} /> : null;
}

/** Opens the card sheet for `?card=` on this page. Mount it once per page that shows cards. */
export function CardSheetHost() {
  return (
    <Suspense fallback={null}>
      <SheetFromAddress />
    </Suspense>
  );
}
