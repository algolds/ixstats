"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { CardFace } from "~/components/cards/face/CardFace";
import { RARITY_LABEL } from "~/lib/cards/face/labels";
import { rarestFace } from "~/lib/cards/face/reveal";
import type { CardFaceData } from "~/lib/cards/face/types";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";

interface RevealSummaryProps {
  faces: CardFaceData[];
  nextPack?: { id: string; name: string } | null;
  onOpenNext?: () => void;
  onOpenCard: (cardId: string) => void;
  onClose: () => void;
}

/** The end of a reveal: every card pulled, the best one named, and what to do next. */
export function RevealSummary({
  faces,
  nextPack,
  onOpenNext,
  onOpenCard,
  onClose,
}: RevealSummaryProps) {
  const best = rarestFace(faces);
  const heading = useRef<HTMLHeadingElement>(null);
  // The fan's controls leave the page with it, so focus starts on the result.
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <div className="flex flex-col items-center gap-6">
      <h3 ref={heading} tabIndex={-1} className="text-title-3 outline-none">
        {best ? `Best pull: ${RARITY_LABEL[best.rarity]}` : "This pack had no cards"}
      </h3>
      <ul aria-label="Cards pulled" className="flex flex-wrap justify-center gap-3">
        {faces.map((face) => (
          <li key={face.copy?.ownershipId ?? face.cardId}>
            <CardFace face={face} size="S" onOpen={() => onOpenCard(face.cardId)} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="secondary">
          <Link href={CARD_HUB_PATHS.mine} onClick={onClose}>
            Go to Mine
          </Link>
        </Button>
        {nextPack && onOpenNext && (
          <Button variant="secondary" onClick={onOpenNext}>
            Open the next pack
          </Button>
        )}
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
