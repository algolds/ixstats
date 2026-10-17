"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { MultiplePages, Pin, Search } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button, focusRing } from "~/components/ui/button";
import { Card, CardDescription, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { CardFace } from "~/components/cards/face/CardFace";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import { useCardSheet } from "~/hooks/useCardSheet";
import { DISPLAY_SIZE } from "~/lib/cards/face/showcase-limits";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import { IconWell } from "./IconWell";
import { cn } from "~/lib/utils/cn";
import { springGentle, tweenFast } from "~/lib/design/motion";

const MY_PACKS_HREF = "/vault/store?view=my-packs";
// The pack and Explore tiles are the size of an M face (`w-48` at 5:7), so the strip is even.
const TILE_BOX = "aspect-[5/7] w-48 shrink-0";

interface WaitingPack {
  name: string;
  packType: string;
  guaranteedRarity: string | null;
  artwork: string | null;
}

function PackTile({ count, pack }: { count: number; pack: WaitingPack }) {
  return (
    <Link href={MY_PACKS_HREF} className={cn(focusRing, "rounded-row block snap-start", TILE_BOX)}>
      <Card
        interactive
        padding="sm"
        className="flex h-full flex-col items-center justify-center gap-3 text-center"
      >
        <div className="rounded-row relative aspect-[3/4.2] w-24 overflow-hidden">
          <PackHolographicCover
            packType={pack.packType}
            guaranteedRarity={pack.guaranteedRarity}
            packName={pack.name}
            packArtwork={pack.artwork ?? undefined}
            size="md"
            className="h-full w-full"
          />
        </div>
        <div className="flex max-w-full min-w-0 flex-col gap-0.5">
          <span className="text-callout">
            {count.toLocaleString()} {count === 1 ? "pack" : "packs"} waiting
          </span>
          <span className="text-footnote text-label-secondary truncate">{pack.name}</span>
        </div>
      </Card>
    </Link>
  );
}

/** Ends a short strip: a quiet tile, the size of a card, that points to where more cards come from. */
function MoreCardsTile() {
  return (
    <Link
      href={CARD_HUB_PATHS.explore}
      className={cn(focusRing, "rounded-row block snap-start", TILE_BOX)}
    >
      <Card
        interactive
        padding="sm"
        className="flex h-full flex-col items-center justify-center gap-2 text-center"
      >
        <TextureOverlay texture="grid" className="[--facet-texture-color:var(--tint)]" />
        <IconWell className="size-10 [&_svg]:size-5">
          <Search />
        </IconWell>
        <span className="relative flex flex-col gap-0.5">
          <span className="text-callout">Find more cards</span>
          <span className="text-footnote text-label-secondary">Every realm's cards in Explore</span>
        </span>
      </Card>
    </Link>
  );
}

function ShowcaseSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto">
      {Array.from({ length: DISPLAY_SIZE }, (_, i) => (
        <Skeleton key={i} className={cn("rounded-card", TILE_BOX)} />
      ))}
    </div>
  );
}

/**
 * The player's display: their pinned showcase, else their most valuable cards, as card faces that open the sheet,
 * and while any wait, their unopened packs.
 */
export function VaultShowcase() {
  const reduceMotion = useReducedMotion();
  const sheet = useCardSheet();
  const display = api.cards.getMyDisplay.useQuery();
  const packs = api.cardPacks.getMyPacks.useQuery({ isOpened: false });

  const faces = display.data?.faces ?? [];
  const pinned = display.data?.showcase ?? null;
  const waiting = packs.data?.packs ?? [];
  const firstPack = waiting[0]?.pack;
  const hasCards = faces.length > 0;
  // Without cards, the packs decide what there is to show: wait for them, and never call the
  // collection empty when they could not be read.
  const unavailable = display.isError || (!hasCards && packs.isError);
  const loading = display.isLoading || (!hasCards && packs.isLoading);
  const empty = !hasCards && !firstPack;

  return (
    <Card content="collectible" padding="md" data-slot="vault-showcase" className="overflow-hidden">
      <TextureOverlay texture="paperGrain" />
      <div className="relative mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle icon={<MultiplePages />}>Showcase</CardTitle>
          {hasCards && (
            <CardDescription className="text-footnote flex min-w-0 items-center gap-1">
              {pinned && (
                <>
                  <Pin aria-hidden className="size-3.5 shrink-0" />
                  <span className="sr-only">Pinned: </span>
                </>
              )}
              <span className="truncate">{pinned ? pinned.name : "Your most valuable cards"}</span>
            </CardDescription>
          )}
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={CARD_HUB_PATHS.mine}>All cards</Link>
        </Button>
      </div>
      <div className="relative">
        {unavailable ? (
          <p className="text-footnote text-label-secondary">Your showcase is unavailable</p>
        ) : loading ? (
          <ShowcaseSkeleton />
        ) : empty ? (
          <EmptyState
            compact
            title="No cards yet"
            message="Explore every realm's cards, or open a pack from the Store."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={CARD_HUB_PATHS.explore}>Explore cards</Link>
              </Button>
            }
          />
        ) : (
          <motion.div
            data-slot="showcase-strip"
            className="-m-1 flex snap-x snap-mandatory gap-3 overflow-x-auto p-1 sm:snap-none"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={reduceMotion ? tweenFast : springGentle}
          >
            {faces.map((face) => (
              <CardFace
                key={face.copy?.ownershipId ?? face.cardId}
                face={face}
                size="M"
                className="snap-start"
                onOpen={() => sheet.open(face.cardId)}
              />
            ))}
            {firstPack && <PackTile count={waiting.length} pack={firstPack} />}
            {faces.length < DISPLAY_SIZE && <MoreCardsTile />}
          </motion.div>
        )}
      </div>
    </Card>
  );
}
