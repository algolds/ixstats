"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { CardFace } from "~/components/cards/face/CardFace";
import { CardTilt } from "~/components/cards/face/CardTilt";
import { RARITY_LABEL } from "~/lib/cards/face/labels";
import { rarestFace, revealShines } from "~/lib/cards/face/reveal";
import type { CardFaceData } from "~/lib/cards/face/types";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";

interface RevealSummaryProps {
  faces: CardFaceData[];
  nextPack?: { id: string; name: string } | null;
  onOpenNext?: () => void;
  onOpenCard: (cardId: string) => void;
  onClose: () => void;
}

/**
 * The end of a reveal: every card pulled, the best one named, and what to do next. Rare and better pulls lean toward
 * the pointer and catch the light, as on the card sheet; under Reduce Motion they stay still.
 */
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
        {best ? `Best pull: ${RARITY_LABEL[best.rarity]}` : "Your pack is open"}
      </h3>
      {best ? (
        <ul aria-label="Cards pulled" className="flex flex-wrap justify-center gap-3">
          {faces.map((face) => {
            const card = <CardFace face={face} size="S" onOpen={() => onOpenCard(face.cardId)} />;
            return (
              <li key={face.copy?.ownershipId ?? face.cardId}>
                {revealShines(face.rarity) ? <CardTilt>{card}</CardTilt> : card}
              </li>
            );
          })}
        </ul>
      ) : (
        // A pack always holds cards, so an open with none to show committed but could not read them back.
        <p className="text-callout text-center">Its cards are in Mine.</p>
      )}
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
