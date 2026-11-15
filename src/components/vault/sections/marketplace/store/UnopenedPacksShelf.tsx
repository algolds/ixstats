"use client";

import { useId } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import type { PackItem } from "./PackHolographicCard";

export interface WaitingUserPack {
  id: string;
  pack: PackItem;
}

interface UnopenedPacksShelfProps {
  packs: readonly WaitingUserPack[];
  onOpenPack: (userPack: WaitingUserPack) => void;
}

/**
 * Compact shelf of unopened packs rendered at the top of the Store only when the player has packs waiting.
 */
export function UnopenedPacksShelf({ packs, onOpenPack }: UnopenedPacksShelfProps) {
  const headingId = useId();
  if (packs.length === 0) return null;

  return (
    <section aria-labelledby={headingId} data-slot="unopened-packs-shelf" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id={headingId} className="text-title-3 text-label">
            Unopened packs
          </h2>
          <Badge variant="secondary">{packs.length.toLocaleString()}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((userPack) => {
          const { pack } = userPack;
          return (
            <Card
              key={userPack.id}
              content="collectible"
              padding="sm"
              data-slot="unopened-pack-tile"
              className="flex items-center gap-3.5"
            >
              <div className="facet-recess rounded-row flex shrink-0 items-center justify-center p-1.5">
                <div className="rounded-control-sm relative aspect-[3/4.2] w-12 overflow-hidden">
                  <PackHolographicCover
                    packType={pack.packType}
                    guaranteedRarity={pack.guaranteedRarity}
                    packName={pack.name}
                    packArtwork={pack.artwork ?? undefined}
                    size="sm"
                    className="h-full w-full"
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-headline text-label truncate">{pack.name}</p>
                <p className="text-footnote text-label-secondary tabular-nums">
                  {pack.cardCount.toLocaleString()} cards
                </p>
              </div>

              <Button type="button" size="sm" onClick={() => onOpenPack(userPack)}>
                Rip open pack
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
