"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { CardBack } from "~/components/cards/face/CardBack";
import { CardFlip } from "~/components/cards/face/CardFlip";
import { CardHolo, useCardTilt } from "~/components/cards/face/CardTilt";
import { RarityMark } from "~/components/cards/face/RarityMark";
import { playRevealFeedback } from "~/components/cards/reveal/reveal-feedback";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import { cardSheetHref } from "~/lib/cards/face/sheet-link";
import type { CardFaceData } from "~/lib/cards/face/types";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import { REDUCED_MOTION_FADE, springGentle } from "~/lib/design/motion";
import { soundCues } from "~/lib/sound/cuelume";
import { useUtcResetCountdown, type ClaimResult } from "./daily-reward-utils";

/**
 * Turns a newly minted card from its engraved back onto its live 3D-tilting front on the first
 * animation frame, and lets the player keep tilting or flipping it (`Space`, `F`, or tap) afterward.
 */
function CardPullReveal({
  face,
  countdown,
  onDone,
}: {
  face: CardFaceData;
  countdown: string;
  onDone: () => void;
}) {
  const reduce = useFacetReducedMotion();
  const [turnedUp, setTurnedUp] = useState(false);
  const [inspectingBack, setInspectingBack] = useState(false);

  useEffect(() => {
    playRevealFeedback(face.rarity, reduce);
    if (reduce) return;
    const frame = window.requestAnimationFrame(() => setTurnedUp(true));
    return () => window.cancelAnimationFrame(frame);
  }, [face.rarity, reduce]);

  const flipped = reduce ? inspectingBack : !turnedUp || inspectingBack;
  const copy = face.copy;
  const specialFinish = copy && copy.finish !== "STANDARD" ? FINISH_LABEL[copy.finish] : null;

  const back = (
    <CardBack
      card={{
        rarity: face.rarity,
        realm: face.realm,
        season: face.season,
        number: face.number,
        cardType: face.cardType,
        category: null,
      }}
      size="L"
      shine={!reduce && copy ? copy.finish : null}
    />
  );

  return (
    <div
      data-slot="daily-card-reveal"
      data-card-rarity={face.rarity}
      className="flex flex-col items-center gap-4 px-6 pt-8 pb-6 text-center"
    >
      <CardFlip
        face={face}
        turn={{
          back,
          flipped,
          onFlip: () => setInspectingBack((prev) => !prev),
        }}
      />

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <RarityMark rarity={face.rarity} />
          {specialFinish && <Badge variant="secondary">{specialFinish}</Badge>}
          {copy && (
            <span className="text-footnote text-label-secondary tabular-nums">
              #{copy.serialNumber}
            </span>
          )}
          <span className="text-footnote text-label-secondary">· {face.realm.name}</span>
        </div>
        <DialogTitle className="text-title-2 text-label">{face.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Added to your collection. Next daily reward opens in {countdown}.
        </DialogDescription>
      </div>

      <div className="flex w-full flex-col gap-2 pt-1 sm:flex-row-reverse">
        <Button className="sm:flex-1" onClick={onDone}>
          Collect
        </Button>
        <Button variant="outline" className="sm:flex-1" asChild>
          <Link href={cardSheetHref(CARD_HUB_PATHS.mine, face.cardId)} onClick={onDone}>
            Inspect card
          </Link>
        </Button>
      </div>

      <p className="text-caption text-label-secondary tabular-nums">Next reward in {countdown}</p>
    </div>
  );
}

/** Fallback when the card committed on the server but its full face record could not be read back. */
function CardFallbackReveal({
  card,
  countdown,
  onDone,
}: {
  card: { id: string; title: string };
  countdown: string;
  onDone: () => void;
}) {
  useEffect(() => {
    soundCues?.reveal?.();
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 px-6 pt-8 pb-6 text-center">
      <div className="space-y-1">
        <span className="text-footnote text-label-secondary">Added to your collection</span>
        <DialogTitle className="text-title-2 text-label">{card.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Added to your collection. Next daily reward opens in {countdown}.
        </DialogDescription>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
        <Button className="sm:flex-1" onClick={onDone}>
          Collect
        </Button>
        <Button variant="outline" className="sm:flex-1" asChild>
          <Link href={cardSheetHref(CARD_HUB_PATHS.mine, card.id)} onClick={onDone}>
            Inspect card
          </Link>
        </Button>
      </div>
      <p className="text-caption text-label-secondary tabular-nums">Next reward in {countdown}</p>
    </div>
  );
}

/**
 * Counts the IxCredits payout up from zero while simultaneously rolling the player's Vault balance
 * forward so the deposit is felt in place.
 */
function CreditsClaimReveal({
  amount,
  preClaimCredits,
  countdown,
  onDone,
}: {
  amount: number;
  preClaimCredits: number | null;
  countdown: string;
  onDone: () => void;
}) {
  const reduce = useFacetReducedMotion();
  const { tilt, onPointerMove, onPointerLeave } = useCardTilt();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    soundCues?.reveal?.();
    if (reduce) return;
    const frame = window.requestAnimationFrame(() => setSettled(true));
    return () => window.cancelAnimationFrame(frame);
  }, [reduce]);

  const showFinal = reduce || settled;
  const shownPayout = showFinal ? Math.round(amount) : 0;
  const shownBalance =
    preClaimCredits === null ? null : Math.round(preClaimCredits + (showFinal ? amount : 0));

  return (
    <div
      data-slot="daily-credits-reveal"
      onPointerMove={reduce ? undefined : onPointerMove}
      onPointerLeave={reduce ? undefined : onPointerLeave}
      className="flex flex-col items-center gap-5 px-6 pt-8 pb-6 text-center"
    >
      <div className="perspective-distant">
        <motion.div
          style={reduce ? undefined : tilt}
          initial={reduce ? { opacity: 0 } : { scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? REDUCED_MOTION_FADE : springGentle}
          className="bg-surface-elevated border-separator shadow-floating relative grid size-20 place-items-center overflow-hidden rounded-full border transform-3d"
        >
          <span aria-hidden className="facet-foil absolute inset-0" />
          {!reduce && <CardHolo />}
          <span className="facet-recess text-tint relative grid size-14 place-items-center rounded-full">
            <IxCreditsSymbol decorative className="size-8" />
          </span>
        </motion.div>
      </div>

      <div className="space-y-1">
        <DialogTitle className="sr-only">
          +{Math.round(amount).toLocaleString()} IxCredits claimed
        </DialogTitle>
        <DialogDescription className="sr-only">
          Added to your Vault. Next daily reward opens in {countdown}.
        </DialogDescription>
        <div
          role="status"
          aria-live="polite"
          className="text-display text-tint flex items-center justify-center gap-2 tabular-nums"
        >
          <span>+</span>
          <IxCreditsSymbol decorative className="size-9 shrink-0" />
          <NumberFlowDisplay value={shownPayout} duration={750} className="font-bold" />
        </div>
        <p className="text-subhead text-label-secondary">IxCredits added to your Vault</p>
      </div>

      {shownBalance !== null && (
        <div className="facet-well rounded-row flex w-full items-center justify-between gap-3 px-4 py-3">
          <span className="text-subhead text-label-secondary">Vault balance</span>
          <span className="text-headline text-label inline-flex items-center gap-1.5 tabular-nums">
            <IxCreditsSymbol decorative className="text-tint size-4 shrink-0" />
            <NumberFlowDisplay value={shownBalance} duration={750} className="font-semibold" />
          </span>
        </div>
      )}

      <Button className="w-full" onClick={onDone}>
        Collect
      </Button>

      <p className="text-caption text-label-secondary tabular-nums">Next reward in {countdown}</p>
    </div>
  );
}

export function DailyRevealStage({
  result,
  preClaimCredits,
  onDone,
}: {
  result: ClaimResult;
  preClaimCredits: number | null;
  onDone: () => void;
}) {
  const countdown = useUtcResetCountdown();

  if (result.cardFace) {
    return <CardPullReveal face={result.cardFace} countdown={countdown} onDone={onDone} />;
  }
  if (result.cardAwarded) {
    return <CardFallbackReveal card={result.cardAwarded} countdown={countdown} onDone={onDone} />;
  }
  return (
    <CreditsClaimReveal
      amount={result.creditsAwarded ?? 0}
      preClaimCredits={preClaimCredits}
      countdown={countdown}
      onDone={onDone}
    />
  );
}

/** Shown when the player reopens the dialog later on the same UTC day after claiming. */
export function DailyClaimedTodayStage({ onDone }: { onDone: () => void }) {
  const countdown = useUtcResetCountdown();

  return (
    <div
      data-slot="daily-already-claimed"
      className="flex flex-col items-center gap-5 px-6 pt-8 pb-6 text-center"
    >
      <span
        aria-hidden
        className="facet-recess text-tint grid size-12 place-items-center rounded-full"
      >
        <Check className="size-6" />
      </span>

      <div className="space-y-1">
        <DialogTitle className="text-title-2 text-label">Claimed for today</DialogTitle>
        <DialogDescription className="text-body text-label-secondary tabular-nums">
          Next reward opens in {countdown}.
        </DialogDescription>
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
        <Button className="sm:flex-1" onClick={onDone}>
          Done
        </Button>
        <Button variant="outline" className="sm:flex-1" asChild>
          <Link href="/vault" onClick={onDone}>
            Open IxVault
          </Link>
        </Button>
      </div>
    </div>
  );
}
