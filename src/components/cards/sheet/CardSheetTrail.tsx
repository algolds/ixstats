"use client";

import { CopyTrail } from "~/components/cards/face/CopyTrail";
import type { TrailEvent } from "~/lib/cards/face/trail";
import { Fold } from "./Fold";

/** Every move of the picked copy, folded under Your copies; its back has room for the latest three. */
export function CardSheetTrail({ trail }: { trail: TrailEvent[] }) {
  if (trail.length === 0) return null;
  return (
    <Fold id="sheet-trail" title="Trail">
      <div className="text-footnote text-label">
        <CopyTrail trail={trail} />
      </div>
    </Fold>
  );
}
