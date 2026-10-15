"use client";

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { MultiplePages, Search } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button, focusRing } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import { IconWell } from "./IconWell";
import { ownedCardToInstance } from "~/lib/cards/ownership-card";
import { cn } from "~/lib/utils/cn";
import { springGentle, tweenFast } from "~/lib/design/motion";
import type { CardInstance } from "~/types/cards-display";

const CardDetailsModal = dynamic(
  () => import("~/components/cards/display/CardDetailsModal").then((m) => m.CardDetailsModal),
  { ssr: false }
);

const SHOWCASE_SIZE = 4;
const MY_PACKS_HREF = "/vault/store?tab=store&view=my-packs";
// The pack tile is as big as the gallery's medium card (`w-48`, 269px tall) so the strip is even.
const TILE_BOX = "w-48 h-[269px] shrink-0";

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

/**
 * Makes a gallery tile keyboard-operable. `CardDisplay` opens on click only and its lore excerpt can
 * hold links, so the wrapper is a `div` with a button role, not a `<button>`. Clicks stay with the
 * tile (one handler owns opening); the wrapper adds only Enter and Space.
 */
function KeyboardTile({
  card,
  onOpen,
  children,
}: {
  card: CardInstance;
  onOpen: (card: CardInstance) => void;
  children: ReactNode;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onOpen(card);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View ${card.title}`}
      onKeyDown={onKeyDown}
      className={cn(focusRing, "rounded-card shrink-0 snap-start")}
    >
      {children}
    </div>
  );
}

/** Ends a short strip: a quiet tile, the size of a card, that points to where more cards come from. */
function MoreCardsTile() {
  return (
    <Link href="/vault/store" className={cn(focusRing, "rounded-row block snap-start", TILE_BOX)}>
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
          <span className="text-footnote text-label-secondary">
            Packs and listings in the Store
          </span>
        </span>
      </Card>
    </Link>
  );
}

function ShowcaseSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto">
      {Array.from({ length: SHOWCASE_SIZE }, (_, i) => (
        <Skeleton key={i} className={cn("rounded-card", TILE_BOX)} />
      ))}
    </div>
  );
}

/** Your best cards by market value, as the Cards gallery draws them, and while any wait, your unopened packs. */
export function VaultShowcase() {
  const reduceMotion = useReducedMotion();
  const [opened, setOpened] = useState<CardInstance | null>(null);
  const top = api.cards.getMyTopCards.useQuery({ limit: SHOWCASE_SIZE });
  const packs = api.cardPacks.getMyPacks.useQuery({ isOpened: false });

  const cards = useMemo(() => (top.data ?? []).map(ownedCardToInstance), [top.data]);
  const waiting = packs.data?.packs ?? [];
  const firstPack = waiting[0]?.pack;
  const hasCards = cards.length > 0;
  // Without cards, the packs decide what there is to show: wait for them, and never call the
  // collection empty when they could not be read.
  const unavailable = top.isError || (!hasCards && packs.isError);
  const loading = top.isLoading || (!hasCards && packs.isLoading);
  const empty = !hasCards && !firstPack;

  return (
    <Card content="collectible" padding="md" data-slot="vault-showcase" className="overflow-hidden">
      <TextureOverlay texture="paperGrain" />
      <div className="relative mb-3 flex items-center justify-between gap-3">
        <CardTitle icon={<MultiplePages />}>Showcase</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href="/vault/cards">All cards</Link>
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
            message="Open a pack or import a deck to start your collection."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/vault/store">Visit the Store</Link>
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
            {cards.map((card) => (
              <KeyboardTile key={card.ownershipId ?? card.id} card={card} onOpen={setOpened}>
                <CardDisplay
                  card={card}
                  size="medium"
                  enable3D={true}
                  performanceMode={false}
                  onClick={setOpened}
                />
              </KeyboardTile>
            ))}
            {firstPack && <PackTile count={waiting.length} pack={firstPack} />}
            {cards.length < SHOWCASE_SIZE && <MoreCardsTile />}
          </motion.div>
        )}
      </div>
      <CardDetailsModal card={opened} open={opened !== null} onClose={() => setOpened(null)} />
    </Card>
  );
}
