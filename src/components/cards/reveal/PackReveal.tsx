"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";
import { focusedElement, refocus } from "~/lib/utils/focus";
import { Button, focusRing } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { CardFace } from "~/components/cards/face/CardFace";
import { CardFaceDown } from "~/components/cards/face/CardFaceDown";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import { cardFaceLabel } from "~/lib/cards/face/accessible-name";
import { nextFaceDown, rarestFace, revealBeatMs } from "~/lib/cards/face/reveal";
import type { CardFaceData } from "~/lib/cards/face/types";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import { springGentle, tweenFast } from "~/lib/design/motion";
import { playRevealFeedback } from "./reveal-feedback";
import { RevealSummary } from "./RevealSummary";

/** Pixels a horizontal swipe must travel to turn the next card. */
const SWIPE_PX = 40;
/** The arrow keys that turn the next card; Up and Left stay free to scroll a stage that overflows. */
const TURN_KEYS: ReadonlySet<string> = new Set(["ArrowRight", "ArrowDown"]);

type Stage = "sealed" | "fan" | "summary";

/** Why the pack did not open: it is open already (its cards are in Mine), or the request failed. */
type OpenFailure = { kind: "opened" } | { kind: "failed"; message: string };

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
  /** Where focus goes on close once what opened the reveal has left the page (an opened pack's button). */
  returnFocus?: () => HTMLElement | null;
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
  returnFocus,
}: PackRevealProps) {
  const reduce = useFacetReducedMotion();
  const [stage, setStage] = useState<Stage>("sealed");
  const [faces, setFaces] = useState<CardFaceData[]>([]);
  const opener = usePackOpener(userPackId, (pulled) => {
    setFaces(pulled);
    setStage(pulled.length > 0 ? "fan" : "summary");
  });
  const turns = useCardTurns(faces, reduce);
  const onCloseAutoFocus = useReturnFocus(returnFocus);
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
        onCloseAutoFocus={onCloseAutoFocus}
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
              failure={opener.failure}
              onOpen={opener.openPack}
              onClose={onClose}
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
  const [failure, setFailure] = useState<OpenFailure | null>(null);
  const asked = useRef(false);
  const received = useRef(false);
  const utils = api.useUtils();
  const refresh = () => {
    void utils.cardPacks.getMyPacks.invalidate();
    void utils.cards.listMine.invalidate();
  };
  const mutation = api.cardPacks.openPack.useMutation({
    onSuccess: (data) => {
      received.current = true;
      onOpened(data.faces);
      refresh();
    },
    onError: (err) => {
      const opened = err.data?.code === "CONFLICT";
      // A second open of this pack after its cards arrived: they are minted, so the reveal stays.
      if (opened && received.current) return;
      asked.current = false;
      if (!opened) {
        setFailure({ kind: "failed", message: err.message });
        return;
      }
      // Open already: in another tab, or by a first try that failed after it committed and was retried.
      refresh();
      setFailure({ kind: "opened" });
    },
  });
  const openPack = () => {
    if (asked.current) return;
    asked.current = true;
    setFailure(null);
    mutation.mutate({ userPackId });
  };
  return { openPack, pending: mutation.isPending, failure };
}

/**
 * Radix gives focus on close to a trigger this dialog does not have. This gives it back to what opened the reveal, or
 * to `fallback` once that has left the page, unless something already holds it (the next pack's reveal).
 */
function useReturnFocus(fallback?: () => HTMLElement | null) {
  const [opener] = useState(() => (typeof document === "undefined" ? null : focusedElement()));
  return (event: Event) => {
    event.preventDefault();
    if (focusedElement()) return;
    refocus(opener?.isConnected ? opener : (fallback?.() ?? null));
  };
}

/**
 * The turns: one card at a time, each holding the stage for its rarity's beat before the next can turn. Every turn
 * is announced as a new line, so a second copy of the same card is read out again.
 */
function useCardTurns(faces: readonly CardFaceData[], reduce: boolean) {
  const [up, setUp] = useState<ReadonlySet<number>>(() => new Set());
  const [lastTurned, setLastTurned] = useState(-1);
  const [said, setSaid] = useState({ turns: 0, text: "" });
  const busyUntil = useRef(0);
  const revealed = faces.map((_, index) => up.has(index));
  const announce = (text: string) => setSaid((last) => ({ turns: last.turns + 1, text }));

  const turn = (index: number) => {
    const face = faces[index];
    if (!face || up.has(index) || Date.now() < busyUntil.current) return;
    busyUntil.current = Date.now() + revealBeatMs(face.rarity);
    setUp((current) => new Set(current).add(index));
    setLastTurned(index);
    announce(cardFaceLabel(face));
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
    announce(faces.length === 1 ? "The card is turned" : `All ${faces.length} cards turned`);
    if (rarest) playRevealFeedback(rarest.rarity, reduce);
  };
  const allUp = faces.length > 0 && up.size === faces.length;
  return { revealed, lastTurned, allUp, said, turn, turnNext, revealAll };
}

type CardTurns = ReturnType<typeof useCardTurns>;

function SealedPack({
  pack,
  pending,
  failure,
  onOpen,
  onClose,
}: {
  pack: RevealPack;
  pending: boolean;
  failure: OpenFailure | null;
  onOpen: () => void;
  onClose: () => void;
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
      {failure?.kind === "opened" ? (
        <>
          <p role="alert" className="text-callout text-center">
            This pack is already open. Its cards are in Mine.
          </p>
          <Button asChild>
            <Link href={CARD_HUB_PATHS.mine} onClick={onClose}>
              Go to Mine
            </Link>
          </Button>
        </>
      ) : (
        <>
          {failure?.kind === "failed" && (
            <p role="alert" className="text-callout text-destructive text-center">
              {failure.message}
            </p>
          )}
          <Button disabled={pending} onClick={onOpen}>
            Open pack
          </Button>
        </>
      )}
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
  const faceDown = useRef<(HTMLButtonElement | null)[]>([]);
  const proceed = useRef<HTMLButtonElement>(null);
  const next = nextFaceDown(turns.revealed, turns.lastTurned);
  // A turned card's button leaves the page, so after every turn focus moves on: to the next card still face down,
  // or to Continue once all are up.
  useEffect(() => {
    (next >= 0 ? faceDown.current[next] : proceed.current)?.focus();
  }, [turns.said.turns, next]);

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
                ref={(element) => {
                  faceDown.current[index] = element;
                }}
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
          <Button ref={proceed} onClick={onSummary}>
            Continue
          </Button>
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
        <span key={turns.said.turns}>{turns.said.text}</span>
      </p>
    </>
  );
}
