"use client";

import "~/styles/wiki-os.css";
import { useLoreCuration } from "~/hooks/lore/useLoreCuration";
import { groupLorePieces, type LoreListedPiece } from "~/lib/lore/lore-groups";
import { LorePiece } from "./LorePiece";

export interface LorePiecesProps {
  countryId: string;
  pieces: readonly LoreListedPiece[];
  /** Owner and co-authors: Edit on each piece. */
  canWrite: boolean;
  /** The owner: Pin or Unpin and Hide on each piece. */
  isOwner: boolean;
  /** Opens the tab's lore writer on a piece. */
  onEdit: (title: string) => void;
}

/**
 * LorePieces: the country's native lore on the Lore tab (docs/superpowers/specs/2026-10-24-native-lore-design.md,
 * "Lore tab"), after the wiki article. Pieces are chapters grouped People, Places, Events, Organisations, Other
 * (pinned first in each group), each read inline once it nears the viewport.
 */
export function LorePieces({ countryId, pieces, canWrite, isOwner, onEdit }: LorePiecesProps) {
  const curation = useLoreCuration(countryId);
  const groups = groupLorePieces(pieces);
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => (
        <section
          key={group.type}
          aria-labelledby={`lore-group-${group.type}`}
          className="border-separator flex flex-col gap-8 border-t pt-6"
        >
          <h2 id={`lore-group-${group.type}`} className="text-title-2 text-label">
            {group.label}
          </h2>
          {group.pieces.map((piece) => (
            <LorePiece
              key={piece.title}
              piece={piece}
              canWrite={canWrite}
              isOwner={isOwner}
              busy={curation.isBusy(piece.title)}
              refusal={curation.refusalFor(piece.title)}
              onEdit={onEdit}
              onSetPinned={(title, pinned) => void curation.setPinned(title, pinned)}
              onHide={(title) => void curation.hide(title)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
