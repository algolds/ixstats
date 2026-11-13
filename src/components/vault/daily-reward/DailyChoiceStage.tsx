"use client";

import type { CardFinish, LoreCategory } from "@prisma/client";
import { motion } from "motion/react";
import { SystemRestart as Loader } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Skeleton } from "~/components/ui/skeleton";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { CardBack } from "~/components/cards/face/CardBack";
import { CardHolo, useCardTilt } from "~/components/cards/face/CardTilt";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import type { CardFaceData, CardRealmBadge } from "~/lib/cards/face/types";
import { cn } from "~/lib/utils";
import { formatBoost, useUtcResetCountdown, type ClaimChoice } from "./daily-reward-utils";

interface DailyChoiceStageProps {
  credits: number | undefined;
  totalBoost: number;
  claiming: ClaimChoice | null;
  onClaim: (choice: ClaimChoice) => void;
}

const CHOICE_SURFACE = cn(
  "group facet-lens facet-press facet-press-subtle rounded-card relative flex flex-col justify-between overflow-hidden p-4 text-left",
  "focus-visible:outline-tint cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2",
  "disabled:cursor-not-allowed"
);

const DEFAULT_REALM: CardRealmBadge = {
  id: "default",
  slug: "default",
  name: "IxWorld",
  crestUrl: null,
  isSystem: true,
};

type PreviewBackCard = Pick<CardFaceData, "rarity" | "realm" | "season" | "number" | "cardType"> & {
  category: LoreCategory | null;
};

/**
 * Three distinct card versions/types/rarities/finishes fanned in the Card pull tile:
 * - Left: Sapphire Rare · Nation (`NATION` banner lattice) · Foil sheen
 * - Right: Royal Violet Epic · Lore (`DIPLOMACY` laurel lattice) · Iridescent Holo sheen
 * - Center: Imperial Gold Legendary · Special (`SPECIAL` star-medal lattice) · Serialised gold sheen
 */
const PREVIEW_TRIO: readonly {
  key: string;
  card: PreviewBackCard;
  shine: CardFinish;
  widthClass: string;
  poseClass: string;
  hoverClass: string;
}[] = [
  {
    key: "nation-rare",
    card: {
      rarity: "RARE",
      cardType: "NATION",
      category: "NATION",
      realm: DEFAULT_REALM,
      season: 1,
      number: 12,
    },
    shine: "FOIL",
    widthClass: "w-20",
    poseClass: "-translate-x-6 translate-y-1.5 -rotate-8 opacity-90",
    hoverClass:
      "transition-[translate,rotate] duration-fast ease-out-facet group-hover:-translate-x-8 group-hover:-rotate-14 group-focus-visible:-translate-x-8 group-focus-visible:-rotate-14",
  },
  {
    key: "lore-epic",
    card: {
      rarity: "EPIC",
      cardType: "LORE",
      category: "DIPLOMACY",
      realm: DEFAULT_REALM,
      season: 2,
      number: 48,
    },
    shine: "HOLO",
    widthClass: "w-20",
    poseClass: "translate-x-6 translate-y-1.5 rotate-8 opacity-90",
    hoverClass:
      "transition-[translate,rotate] duration-fast ease-out-facet group-hover:translate-x-8 group-hover:rotate-14 group-focus-visible:translate-x-8 group-focus-visible:rotate-14",
  },
  {
    key: "special-legendary",
    card: {
      rarity: "LEGENDARY",
      cardType: "SPECIAL",
      category: "SPECIAL",
      realm: DEFAULT_REALM,
      season: 3,
      number: 1,
    },
    shine: "SERIALISED",
    widthClass: "w-22",
    poseClass: "shadow-floating rounded-card relative",
    hoverClass:
      "transition-[translate] duration-fast ease-out-facet group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5",
  },
];

/**
 * Physical IxCredits Vault medallion: tilts toward the pointer on `springSmooth` and sweeps foil + holo
 * specular light across the coin face via `--holo-x` / `--holo-y`.
 */
function CreditsChoiceTile({
  credits,
  totalBoost,
  loading,
  disabled,
  reduce,
  onSelect,
}: {
  credits: number | undefined;
  totalBoost: number;
  loading: boolean;
  disabled: boolean;
  reduce: boolean;
  onSelect: () => void;
}) {
  const { tilt, onPointerMove, onPointerLeave } = useCardTilt();
  const hasBoost = totalBoost > 1.005;

  return (
    <button
      type="button"
      data-slot="daily-choice-credits"
      onClick={onSelect}
      disabled={disabled}
      aria-busy={loading}
      onPointerMove={reduce ? undefined : onPointerMove}
      onPointerLeave={reduce ? undefined : onPointerLeave}
      className={cn(
        CHOICE_SURFACE,
        !disabled && "facet-lift",
        disabled && !loading && "opacity-50"
      )}
    >
      <TextureOverlay
        texture="chevron"
        opacity={0.025}
        className="[--facet-texture-color:var(--tint)]"
      />

      <div className="relative my-2 grid h-44 place-items-center perspective-distant">
        <motion.div
          style={reduce ? undefined : tilt}
          className="relative flex flex-col items-center gap-2.5 transform-3d"
        >
          <div className="bg-surface-elevated border-separator shadow-floating relative grid size-24 place-items-center overflow-hidden rounded-full border">
            <span aria-hidden className="facet-foil absolute inset-0" />
            {!reduce && <CardHolo />}
            <span className="facet-recess text-tint relative grid size-16 place-items-center rounded-full">
              {loading ? (
                <Loader aria-hidden className="size-7 animate-spin" />
              ) : (
                <IxCreditsSymbol decorative className="size-9" />
              )}
            </span>
          </div>

          <span className="facet-well border-separator text-caption text-label-secondary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 tabular-nums">
            {credits === undefined ? (
              <Skeleton as="span" className="h-3.5 w-16" />
            ) : (
              <>
                <IxCreditsSymbol decorative className="text-tint size-3 shrink-0" />
                <NumberFlowDisplay
                  value={Math.round(credits)}
                  className="text-label font-semibold"
                />
                <span>in Vault</span>
              </>
            )}
          </span>
        </motion.div>
      </div>

      <div className="relative space-y-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-title-3 text-label">IxCredits</span>
          {hasBoost && (
            <Badge variant="secondary" className="tabular-nums">
              {formatBoost(totalBoost)}
            </Badge>
          )}
        </span>
        <span className="text-footnote text-label-secondary block">Roll up to 10,000 IxC</span>
      </div>
    </button>
  );
}

/**
 * Fanned trio of distinct engraved `CardBack` editions (Nation Rare Foil, Special Legendary Serialised,
 * and Lore Epic Holo) that spread on hover/focus and lean toward the pointer.
 */
function CardPullChoiceTile({
  loading,
  disabled,
  reduce,
  onSelect,
}: {
  loading: boolean;
  disabled: boolean;
  reduce: boolean;
  onSelect: () => void;
}) {
  const { tilt, onPointerMove, onPointerLeave } = useCardTilt();

  return (
    <button
      type="button"
      data-slot="daily-choice-card"
      onClick={onSelect}
      disabled={disabled}
      aria-busy={loading}
      onPointerMove={reduce ? undefined : onPointerMove}
      onPointerLeave={reduce ? undefined : onPointerLeave}
      className={cn(
        CHOICE_SURFACE,
        !disabled && "facet-lift",
        disabled && !loading && "opacity-50"
      )}
    >
      <div className="relative my-2 grid h-44 place-items-center perspective-distant">
        <motion.div
          style={reduce ? undefined : tilt}
          className="relative grid place-items-center transform-3d"
        >
          {PREVIEW_TRIO.map((entry, idx) => {
            const isFront = idx === PREVIEW_TRIO.length - 1;
            return (
              <div
                key={entry.key}
                aria-hidden
                className={cn(
                  "col-start-1 row-start-1",
                  entry.poseClass,
                  !reduce && entry.hoverClass
                )}
              >
                <CardBack
                  card={entry.card}
                  size="S"
                  shine={reduce ? null : entry.shine}
                  className={cn(
                    "card-face-tint [--tint:var(--card-rarity-paint)]",
                    entry.widthClass
                  )}
                />
                {isFront && loading && (
                  <span className="bg-surface/80 rounded-card absolute inset-0 grid place-items-center">
                    <Loader className="text-tint size-6 animate-spin" />
                  </span>
                )}
              </div>
            );
          })}
        </motion.div>
      </div>

      <div className="relative space-y-0.5">
        <span className="text-title-3 text-label block">Card pull</span>
        <span className="text-footnote text-label-secondary block">
          Nation, Lore &amp; Special editions
        </span>
      </div>
    </button>
  );
}

export function DailyChoiceStage({
  credits,
  totalBoost,
  claiming,
  onClaim,
}: DailyChoiceStageProps) {
  const reduce = useFacetReducedMotion();
  const countdown = useUtcResetCountdown();

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-1 pr-8">
        <DialogTitle className="text-title-2 text-label">Daily reward</DialogTitle>
        <DialogDescription className="text-subhead text-label-secondary">
          Pick today&apos;s draw from the Vault.
        </DialogDescription>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CreditsChoiceTile
          credits={credits}
          totalBoost={totalBoost}
          loading={claiming === "CREDITS"}
          disabled={claiming !== null}
          reduce={reduce}
          onSelect={() => onClaim("CREDITS")}
        />
        <CardPullChoiceTile
          loading={claiming === "CARD"}
          disabled={claiming !== null}
          reduce={reduce}
          onSelect={() => onClaim("CARD")}
        />
      </div>

      <p className="text-caption text-label-secondary text-center tabular-nums">
        Resets at 00:00 UTC · Next window in {countdown}
      </p>
    </div>
  );
}
