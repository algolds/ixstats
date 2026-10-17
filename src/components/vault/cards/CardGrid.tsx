"use client";

import type { ReactNode } from "react";
import { CardFace } from "~/components/cards/face/CardFace";
import type { CardFaceData } from "~/lib/cards/face/types";

interface CardGridProps {
  faces: readonly CardFaceData[];
  onOpen: (face: CardFaceData) => void;
  /** Select mode: the copies picked (ownership ids); faces then toggle instead of opening. */
  selected?: ReadonlySet<string> | null;
  label: string;
  /** A control under each face, such as a showcase owner's Remove. */
  action?: (face: CardFaceData) => ReactNode;
}

/** A still grid of size-S faces: three across on a phone, as many as fit from the small breakpoint up. */
export function CardGrid({ faces, onOpen, selected, label, action }: CardGridProps) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]"
    >
      {faces.map((face) => {
        const copyId = face.copy?.ownershipId;
        return (
          <li key={copyId ?? face.cardId} className="space-y-1">
            <CardFace
              face={face}
              size="S"
              className="w-full"
              onOpen={onOpen}
              selected={selected ? selected.has(copyId ?? "") : undefined}
            />
            {action?.(face)}
          </li>
        );
      })}
    </ul>
  );
}
