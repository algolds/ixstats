"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";
import { Button, focusRing } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { CardFace } from "~/components/cards/face/CardFace";
import { CardFaceDown } from "~/components/cards/face/CardFaceDown";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import { cardFaceLabel } from "~/lib/cards/face/accessible-name";
import { nextFaceDown, rarestFace, revealBeatMs } from "~/lib/cards/face/reveal";
import type { CardFaceData } from "~/lib/cards/face/types";
import { springGentle, tweenFast } from "~/lib/design/motion";
import { playRevealFeedback } from "./reveal-feedback";
import { RevealSummary } from "./RevealSummary";

/** Pixels a horizontal swipe must travel to turn the next card. */
const SWIPE_PX = 40;
/** The arrow keys that turn the next card; Up and Left stay free to scroll a stage that overflows. */
const TURN_KEYS: ReadonlySet<string> = new Set(["ArrowRight", "ArrowDown"]);

type Stage = "sealed" | "fan" | "summary";

interface RevealPack {
  name: string;
  packType: string;
  guaranteedRarity: string | null;
  artwork: string | null;
}

interface PackRevealProps {
  open: boolean;
  userPackId: string;
  pack: RevealPack;
  nextPack?: { id: string; name: string } | null;
  onOpenNext?: () => void;
  onOpenCard: (cardId: string) => void;
  onClose: () => void;
}

/**
 * One short pack reveal: tear it open, the cards fan out face down, a tap, a swipe or an arrow key turns them (rarer
 * cards hold longer), Skip, Reveal all (Esc), then a summary with real actions.
 */
export function PackReveal({
  open,
  userPackId,
  pack,
  nextPack,
  onOpenNext,
  onOpenCard,
  onClose,
}: PackRevealProps) {
  const reduce = useFacetReducedMotion();
  const [stage, setStage] = useState<Stage>("sealed");
  const [faces, setFaces] = useState<CardFaceData[]>([]);
  const opener = usePackOpener(userPackId, (pulled) => {
    setFaces(pulled);
    setStage(pulled.length > 0 ? "fan" : "summary");
  });
  const turns = useCardTurns(faces, reduce);
  const swipeStart = useRef<number | null>(null);
  const fanning = stage === "fan";

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!fanning || turns.allUp || !TURN_KEYS.has(event.key)) return;
    event.preventDefault();
    turns.turnNext();
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipeStart.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (fanning && start !== null && Math.abs(start - event.clientX) > SWIPE_PX) turns.turnNext();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={!fanning}
        data-content="reveal"
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-y-auto rounded-none border-0 p-6"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onEscapeKeyDown={(event) => {
          // Esc reveals every card still face down; it closes only once they are all up.
          if (!fanning || turns.allUp) return;
          event.preventDefault();
          turns.revealAll();
        }}
      >
        <DialogTitle className="text-title-2 text-center">{pack.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Turn the cards with a tap, a swipe or the arrow keys. Escape reveals them all.
        </DialogDescription>
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-6 py-6">
          {stage === "sealed" && (
            <SealedPack
              pack={pack}
              pending={opener.pending}
              error={opener.error}
              onOpen={opener.openPack}
            />
          )}
          {fanning && (
            <RevealFan
              faces={faces}
              turns={turns}
              reduce={reduce}
              onSummary={() => setStage("summary")}
            />
          )}
          {stage === "summary" && (
            <RevealSummary
              faces={faces}
              nextPack={nextPack}
              onOpenNext={onOpenNext}
              onOpenCard={onOpenCard}
              onClose={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Opens the pack once, and tells Mine and the Store. The latch is synchronous because `isPending` only shows after a
 * re-render, so a double tap in one frame would open twice.
 */
function usePackOpener(userPackId: string, onOpened: (faces: CardFaceData[]) => void) {
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(false);
  const received = useRef(false);
  const utils = api.useUtils();
  const mutation = api.cardPacks.openPack.useMutation({
    onSuccess: (data) => {
      received.current = true;
      onOpened(data.faces);
      void utils.cardPacks.getMyPacks.invalidate();
      void utils.cards.listMine.invalidate();
    },
    onError: (err) => {
      // A second open of this pack after its cards arrived: they are minted, so the reveal stays.
      if (received.current && err.data?.code === "CONFLICT") return;
      asked.current = false;
      setError(err.message);
    },
  });
  const openPack = () => {
    if (asked.current) return;
    asked.current = true;
    setError(null);
    mutation.mutate({ userPackId });
  };
  return { openPack, pending: mutation.isPending, error };
}

/** The turns: one card at a time, each holding the stage for its rarity's beat before the next can turn. */
function useCardTurns(faces: readonly CardFaceData[], reduce: boolean) {
  const [up, setUp] = useState<ReadonlySet<number>>(() => new Set());
  const [lastTurned, setLastTurned] = useState(-1);
  const busyUntil = useRef(0);
  const revealed = faces.map((_, index) => up.has(index));

  const turn = (index: number) => {
    const face = faces[index];
    if (!face || up.has(index) || Date.now() < busyUntil.current) return;
    busyUntil.current = Date.now() + revealBeatMs(face.rarity);
    setUp((current) => new Set(current).add(index));
    setLastTurned(index);
    playRevealFeedback(face.rarity, reduce);
  };
  const turnNext = () => {
    const index = nextFaceDown(revealed, lastTurned);
    if (index >= 0) turn(index);
  };
  // One cue for the lot, at the strength of the rarest card still face down.
  const revealAll = () => {
    const rarest = rarestFace(faces.filter((_, index) => !up.has(index)));
    setUp(new Set(faces.keys()));
    if (rarest) playRevealFeedback(rarest.rarity, reduce);
  };
  const allUp = faces.length > 0 && up.size === faces.length;
  return { revealed, lastTurned, allUp, turn, turnNext, revealAll };
}

type CardTurns = ReturnType<typeof useCardTurns>;

function SealedPack({
  pack,
  pending,
  error,
  onOpen,
}: {
  pack: RevealPack;
  pending: boolean;
  error: string | null;
  onOpen: () => void;
}) {
  return (
    <>
      <div className="aspect-[3/4.2] w-48">
        <PackHolographicCover
          packType={pack.packType}
          guaranteedRarity={pack.guaranteedRarity}
          packName={pack.name}
          packArtwork={pack.artwork ?? undefined}
          size="md"
          className="h-full w-full"
        />
      </div>
      {error && (
        <p role="alert" className="text-callout text-destructive text-center">
          {error}
        </p>
      )}
      <Button disabled={pending} onClick={onOpen}>
        Open pack
      </Button>
    </>
  );
}

/**
 * The cards face down in a row. A turned card is a picture: a stray tap or swipe across it must not leave the reveal,
 * so cards open from the summary.
 */
function RevealFan({
  faces,
  turns,
  reduce,
  onSummary,
}: {
  faces: CardFaceData[];
  turns: CardTurns;
  reduce: boolean;
  onSummary: () => void;
}) {
  const turned = faces[turns.lastTurned];
  return (
    <>
      <ul
        aria-label="Cards in this pack"
        className="flex touch-pan-y flex-wrap justify-center gap-3"
      >
        {faces.map((face, index) => (
          <motion.li
            key={face.copy?.ownershipId ?? face.cardId}
            className="perspective-distant"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? tweenFast : { ...springGentle, delay: index * 0.06 }}
          >
            {turns.revealed[index] ? (
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, rotateY: 90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                transition={reduce ? tweenFast : springGentle}
              >
                <CardFace face={face} size="M" />
              </motion.div>
            ) : (
              <button
                type="button"
                aria-label={`Card ${index + 1} of ${faces.length}, face down`}
                className={cn("rounded-card facet-press block cursor-pointer", focusRing)}
                onClick={() => turns.turn(index)}
              >
                <CardFaceDown size="M" />
              </button>
            )}
          </motion.li>
        ))}
      </ul>
      <div className="flex gap-2">
        {turns.allUp ? (
          <Button onClick={onSummary}>Continue</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={turns.revealAll}>
              Reveal all
            </Button>
            <Button variant="ghost" onClick={onSummary}>
              Skip
            </Button>
          </>
        )}
      </div>
      <p role="status" className="sr-only">
        {turned ? cardFaceLabel(turned) : ""}
      </p>
    </>
  );
}
