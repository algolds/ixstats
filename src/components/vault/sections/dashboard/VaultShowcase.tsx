"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { MultiplePages } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button, focusRing } from "~/components/ui/button";
import { CutoutCard, CutoutCardContent, CutoutCardHeader } from "~/components/ui/cutout-card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import { proxyNSImage } from "~/lib/cards/ns-image-proxy";
import { ownedCardToInstance, type OwnedCard } from "~/lib/cards/ownership-card";
import { sentenceCase } from "~/lib/format/sentence-case";
import { cn } from "~/lib/utils/cn";
import { springGentle, tweenFast } from "~/lib/design/motion";
import type { CardInstance } from "~/types/cards-display";
import { Credits } from "./credits";

const CardDetailsModal = dynamic(
  () => import("~/components/cards/display/CardDetailsModal").then((m) => m.CardDetailsModal),
  { ssr: false }
);

const SHOWCASE_SIZE = 3;
const ART_FRAME = "rounded-row relative w-full overflow-hidden";
const CARD_ASPECT = "aspect-[5/7]";
const PACK_ASPECT = "aspect-[3/4.2]";
// Fixed collectible widths: a few tiles stay small instead of stretching across the page.
const TILE_GRID = "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,11rem))] gap-3";
const MY_PACKS_HREF = "/vault/store?tab=store&view=my-packs";

/** The card's own picture, else the procedural cover for its type and rarity. Never tinted. */
function CardArt({ card }: { card: OwnedCard["cards"] }) {
  const [failed, setFailed] = useState(false);
  const url = card.artworkUrl || card.artwork || card.wikiImageUrl;
  return (
    <div className={cn(ART_FRAME, CARD_ASPECT)}>
      {url && !failed ? (
        <Image
          src={proxyNSImage(url)}
          alt={card.title}
          fill
          sizes="176px"
          className="object-contain"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <CardHolographicCover
          category={card.category}
          cardType={card.cardType}
          rarity={card.rarity}
          wikiSource={card.wikiSource}
          title={card.title}
          className="h-full w-full"
        />
      )}
    </div>
  );
}

function CardTile({ row, onOpen }: { row: OwnedCard; onOpen: (row: OwnedCard) => void }) {
  const card = row.cards;
  return (
    <CutoutCard aria-label={`View ${card.title}`} onClick={() => onOpen(row)}>
      <CutoutCardHeader as="h3">{card.title}</CutoutCardHeader>
      <CutoutCardContent className="flex flex-col gap-2 p-3 pt-0">
        <CardArt card={card} />
        <div className="text-footnote text-label-secondary flex items-center gap-1 tabular-nums">
          <span>{sentenceCase(card.rarity)}</span>
          <span aria-hidden>·</span>
          <Credits amount={card.marketValue} />
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}

interface WaitingPack {
  name: string;
  packType: string;
  guaranteedRarity: string | null;
  artwork: string | null;
}

function PackTile({ count, pack }: { count: number; pack: WaitingPack }) {
  return (
    <Link href={MY_PACKS_HREF} className={cn(focusRing, "rounded-cutout block")}>
      <CutoutCard interactive>
        <CutoutCardHeader as="h3">
          {count.toLocaleString()} {count === 1 ? "pack" : "packs"} waiting
        </CutoutCardHeader>
        <CutoutCardContent className="flex flex-col gap-2 p-3 pt-0">
          <div className={cn(ART_FRAME, PACK_ASPECT)}>
            <PackHolographicCover
              packType={pack.packType}
              guaranteedRarity={pack.guaranteedRarity}
              packName={pack.name}
              packArtwork={pack.artwork ?? undefined}
              size="md"
              className="h-full w-full"
            />
          </div>
          <div className="text-footnote text-label-secondary truncate">{pack.name}</div>
        </CutoutCardContent>
      </CutoutCard>
    </Link>
  );
}

function ShowcaseSkeleton() {
  return (
    <div className={TILE_GRID}>
      {Array.from({ length: SHOWCASE_SIZE }, (_, i) => (
        <Skeleton key={i} className="rounded-cutout h-64" />
      ))}
    </div>
  );
}

/** Your best cards by market value and, while any wait, your unopened packs. */
export function VaultShowcase() {
  const reduceMotion = useReducedMotion();
  const [opened, setOpened] = useState<OwnedCard | null>(null);
  const top = api.cards.getMyTopCards.useQuery({ limit: SHOWCASE_SIZE });
  const packs = api.cardPacks.getMyPacks.useQuery({ isOpened: false });

  const rows = top.data ?? [];
  const waiting = packs.data?.packs ?? [];
  const firstPack = waiting[0]?.pack;
  const hasCards = rows.length > 0;
  // Without cards, the packs decide what there is to show: wait for them, and never call the
  // collection empty when they could not be read.
  const unavailable = top.isError || (!hasCards && packs.isError);
  const loading = top.isLoading || (!hasCards && packs.isLoading);
  const empty = !hasCards && !firstPack;
  const detail: CardInstance | null = opened ? ownedCardToInstance(opened) : null;

  return (
    <section data-slot="vault-showcase" data-content="collectible" aria-labelledby="showcase-title">
      <h2 id="showcase-title" className="text-headline mb-3 flex items-center gap-2 [&>svg]:size-4">
        <MultiplePages aria-hidden className="text-tint" />
        Showcase
      </h2>
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
          className={TILE_GRID}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={reduceMotion ? tweenFast : springGentle}
        >
          {rows.map((row) => (
            <CardTile key={row.id} row={row} onOpen={setOpened} />
          ))}
          {firstPack && <PackTile count={waiting.length} pack={firstPack} />}
        </motion.div>
      )}
      <CardDetailsModal card={detail} open={detail !== null} onClose={() => setOpened(null)} />
    </section>
  );
}
