"use client";

import { CardFace } from "~/components/cards/face/CardFace";
import type { CardFaceData } from "~/lib/cards/face/types";

interface CardGridProps {
  faces: readonly CardFaceData[];
  onOpen: (face: CardFaceData) => void;
  /** Select mode: the copies picked (ownership ids); faces then toggle instead of opening. */
  selected?: ReadonlySet<string> | null;
  label: string;
}

/** A still grid of size-S faces: three across on a phone, as many as fit from the small breakpoint up. */
export function CardGrid({ faces, onOpen, selected, label }: CardGridProps) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]"
    >
      {faces.map((face) => {
        const copyId = face.copy?.ownershipId;
        return (
          <li key={copyId ?? face.cardId}>
            <CardFace
              face={face}
              size="S"
              className="w-full"
              onOpen={onOpen}
              selected={selected ? selected.has(copyId ?? "") : undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}
