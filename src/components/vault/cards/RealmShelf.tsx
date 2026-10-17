"use client";

import { useId, useState } from "react";
import { NavArrowRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { CardFace } from "~/components/cards/face/CardFace";
import { RealmCrest } from "~/components/cards/face/RealmCrest";
import { cardCount } from "~/lib/cards/curation-limits";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { RealmShelf as Shelf, ShelfCard } from "~/lib/cards/hub/explore";

function Strip(props: {
  label: string;
  cards: readonly ShelfCard[];
  onOpen: (face: CardFaceData) => void;
  showWanted?: boolean;
}) {
  const id = useId();
  if (props.cards.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 id={id} className="text-subhead text-label-secondary">
        {props.label}
      </h4>
      <ul aria-labelledby={id} className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
        {props.cards.map(({ face, wanted }) => (
          <li key={face.cardId} className="shrink-0 snap-start space-y-1">
            <CardFace face={face} size="S" onOpen={props.onOpen} />
            {props.showWanted && (
              <p className="text-footnote text-label-secondary tabular-nums">
                Wanted by {wanted.toLocaleString()}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The realm's banner; one that fails to load leaves no gap. */
function Banner({ url }: { url: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || url === failed) return null;
  return (
    <img
      src={proxyCardArtwork(url)}
      alt=""
      loading="lazy"
      onError={() => setFailed(url)}
      className="h-20 w-full object-cover"
    />
  );
}

/** One realm's shelf: its banner and crest, card count, newest and most-wanted cards. */
export function RealmShelf({
  shelf,
  onOpen,
  onBrowse,
}: {
  shelf: Shelf;
  onOpen: (face: CardFaceData) => void;
  onBrowse: (realmId: string) => void;
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <Banner url={shelf.bannerUrl} />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <RealmCrest realm={shelf.realm} size="md" />
          <div className="min-w-0 flex-1">
            <h3 className="text-headline truncate">{shelf.realm.name}</h3>
            <p className="text-footnote text-label-secondary tabular-nums">
              {cardCount(shelf.cardCount)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Browse all ${shelf.realm.name} cards`}
            onClick={() => onBrowse(shelf.realm.id)}
          >
            Browse all
            <NavArrowRight />
          </Button>
        </div>
        <Strip label="Newest" cards={shelf.newest} onOpen={onOpen} />
        <Strip label="Most wanted" cards={shelf.mostWanted} onOpen={onOpen} showWanted />
      </div>
    </Card>
  );
}
