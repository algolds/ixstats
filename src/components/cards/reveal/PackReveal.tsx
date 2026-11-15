"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import Link from "next/link";
import { animate, motion, useMotionValue } from "motion/react";
import { api } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { cn } from "~/lib/utils/cn";
import { focusedElement, refocus } from "~/lib/utils/focus";
import { Button, focusRing, hitSlop } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { CardFace } from "~/components/cards/face/CardFace";
import { CardFaceDown } from "~/components/cards/face/CardFaceDown";
import { CardFlip } from "~/components/cards/face/CardFlip";
import { CardTilt } from "~/components/cards/face/CardTilt";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import { cardFaceLabel } from "~/lib/cards/face/accessible-name";
import { nextFaceDown, rarestFace, revealBeatMs, revealShines } from "~/lib/cards/face/reveal";
import type { CardFaceData } from "~/lib/cards/face/types";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import { REDUCED_MOTION_FADE, springGentle, springMomentum, tweenFast } from "~/lib/design/motion";
import { playRevealFeedback } from "./reveal-feedback";
import { RevealSummary } from "./RevealSummary";

/** Horizontal drag slop before capturing the pointer away from a card tap. */
const DRAG_LOCK_PX = 6;
/** Edge resistance multiplier when dragging past the first or last card. */
const EDGE_RUBBER_BAND = 0.32;
/** Projection horizon (ms) combining displacement (`dx`) with release velocity (`vx`, px/ms). */
const VELOCITY_PROJECTION_MS = 160;
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
  const [{ stage, faces }, setReveal] = useState<{ stage: Stage; faces: CardFaceData[] }>({
    stage: "sealed",
    faces: [],
  });
  const opener = usePackOpener(userPackId, (pulled) => {
    setReveal({ faces: pulled, stage: pulled.length > 0 ? "fan" : "summary" });
  });
  const turns = useCardTurns(faces, reduce);
  const onCloseAutoFocus = useReturnFocus(returnFocus);
  const fanning = stage === "fan";

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!fanning || turns.allUp || !TURN_KEYS.has(event.key)) return;
    event.preventDefault();
    turns.turnNext();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={!fanning}
        data-content="reveal"
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-y-auto rounded-none border-0 p-6"
        onKeyDown={onKeyDown}
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
              onSummary={() => setReveal((current) => ({ ...current, stage: "summary" }))}
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
 * Opens the pack once, and tells the Store and every place its new copies show (Mine, the display, Explore). The latch
 * is synchronous because `isPending` only shows after a re-render, so a double tap in one frame would open twice.
 */
function usePackOpener(userPackId: string, onOpened: (faces: CardFaceData[]) => void) {
  const [failure, setFailure] = useState<OpenFailure | null>(null);
  const asked = useRef(false);
  const received = useRef(false);
  const utils = api.useUtils();
  const refreshCards = useCardsRefresh();
  const refresh = () => {
    void utils.cardPacks.getMyPacks.invalidate();
    refreshCards();
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
  const opener = useRef<HTMLElement | null | undefined>(undefined);
  if (opener.current === undefined) {
    opener.current = typeof document === "undefined" ? null : focusedElement();
  }
  return (event: Event) => {
    event.preventDefault();
    if (focusedElement()) return;
    refocus(opener.current?.isConnected ? opener.current : (fallback?.() ?? null));
  };
}

interface TurnState {
  up: ReadonlySet<number>;
  lastTurned: number;
  turns: number;
  text: string;
}

/**
 * The turns: one card at a time, each holding the stage for its rarity's beat before the next can turn. Every turn
 * is announced as a new line, so a second copy of the same card is read out again.
 */
function useCardTurns(faces: readonly CardFaceData[], reduce: boolean) {
  const [state, setState] = useState<TurnState>(() => ({
    up: new Set(),
    lastTurned: -1,
    turns: 0,
    text: "",
  }));
  const busyUntil = useRef(0);
  const revealed = faces.map((_, index) => state.up.has(index));

  const turn = (index: number) => {
    const face = faces[index];
    if (!face || state.up.has(index) || Date.now() < busyUntil.current) return;
    busyUntil.current = Date.now() + revealBeatMs(face.rarity);
    setState((current) => ({
      up: new Set(current.up).add(index),
      lastTurned: index,
      turns: current.turns + 1,
      text: cardFaceLabel(face),
    }));
    playRevealFeedback(face.rarity, reduce);
  };
  const turnNext = () => {
    const index = nextFaceDown(revealed, state.lastTurned);
    if (index >= 0) turn(index);
  };
  // One cue for the lot, at the strength of the rarest card still face down.
  const revealAll = () => {
    const rarest = rarestFace(faces.filter((_, index) => !state.up.has(index)));
    setState((current) => ({
      up: new Set(faces.keys()),
      lastTurned: faces.length - 1,
      turns: current.turns + 1,
      text: faces.length === 1 ? "The card is turned" : `All ${faces.length} cards turned`,
    }));
    if (rarest) playRevealFeedback(rarest.rarity, reduce);
  };
  const allUp = faces.length > 0 && state.up.size === faces.length;
  return {
    revealed,
    lastTurned: state.lastTurned,
    allUp,
    said: { turns: state.turns, text: state.text },
    turn,
    turnNext,
    revealAll,
  };
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
          interactive
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

interface DragGesture {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  captured: boolean;
}

function rubberBandedOffset(dx: number, index: number, total: number): number {
  const pastStart = index === 0 && dx > 0;
  const pastEnd = index >= total - 1 && dx < 0;
  return pastStart || pastEnd ? dx * EDGE_RUBBER_BAND : dx;
}

function projectedNextIndex(
  dx: number,
  vx: number,
  width: number,
  index: number,
  total: number
): number {
  const projected = dx + vx * VELOCITY_PROJECTION_MS;
  const threshold = Math.max(40, Math.min(80, width * 0.22));
  if (projected <= -threshold && index < total - 1) return index + 1;
  if (projected >= threshold && index > 0) return index - 1;
  return index;
}

/**
 * The cards face down in a desktop fan or a 1:1 mobile pager. Tapping an unrevealed card performs a continuous
 * two-sided 3D `CardFlip` (`springGentle`); cards open from the summary so stray taps during reveal stay safe.
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
  const [activeIndex, setActiveIndex] = useState(0);
  const dragX = useMotionValue(0);
  const dragRef = useRef<DragGesture | null>(null);
  const suppressClickUntil = useRef(0);
  const faceDown = useRef<(HTMLButtonElement | null)[]>([]);
  const proceed = useRef<HTMLButtonElement>(null);
  const next = nextFaceDown(turns.revealed, turns.lastTurned);

  useEffect(() => {
    (next >= 0 ? faceDown.current[next] : proceed.current)?.focus({ preventScroll: true });
  }, [turns.said.turns, next]);

  const settleDrag = (vx: number) => {
    void animate(
      dragX,
      0,
      reduce ? REDUCED_MOTION_FADE : { ...springMomentum, velocity: vx * 1000 }
    );
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      faces.length <= 1 ||
      !Number.isFinite(event.clientX) ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId ?? 0,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      captured: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = dragRef.current;
    const pointerId = event.pointerId ?? 0;
    if (!gesture || gesture.pointerId !== pointerId || !Number.isFinite(event.clientX)) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.captured) {
      if (Math.abs(dx) < DRAG_LOCK_PX) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null;
        return;
      }
      gesture.captured = true;
      event.currentTarget.setPointerCapture?.(pointerId);
    }
    const now = performance.now();
    const dt = now - gesture.lastTime;
    if (dt > 0) gesture.velocityX = (event.clientX - gesture.lastX) / dt;
    gesture.lastX = event.clientX;
    gesture.lastTime = now;
    if (!reduce) dragX.set(rubberBandedOffset(dx, activeIndex, faces.length));
  };

  const finishPointer = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const gesture = dragRef.current;
    const pointerId = event.pointerId ?? 0;
    if (!gesture || gesture.pointerId !== pointerId) return;
    dragRef.current = null;
    if (!gesture.captured) return;
    if (event.currentTarget.hasPointerCapture?.(pointerId)) {
      event.currentTarget.releasePointerCapture(pointerId);
    }
    suppressClickUntil.current = Date.now() + 80;
    if (!cancelled) {
      const dx = event.clientX - gesture.startX;
      const width = event.currentTarget.clientWidth || 240;
      const targetIndex = projectedNextIndex(
        dx,
        gesture.velocityX,
        width,
        activeIndex,
        faces.length
      );
      if (targetIndex !== activeIndex) setActiveIndex(targetIndex);
    }
    settleDrag(gesture.velocityX);
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (Date.now() < suppressClickUntil.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <>
      <div
        data-slot="reveal-pager"
        className="w-full touch-pan-y max-md:max-w-xs max-md:overflow-hidden md:max-w-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finishPointer(event, false)}
        onPointerCancel={(event) => finishPointer(event, true)}
        onClickCapture={onClickCapture}
      >
        <motion.div style={{ x: dragX }} className="md:transform-none!">
          <motion.ul
            aria-label="Cards in this pack"
            animate={{ x: `-${activeIndex * 100}%` }}
            transition={reduce ? REDUCED_MOTION_FADE : springMomentum}
            className="flex md:transform-none! md:flex-wrap md:justify-center md:gap-3"
          >
            {faces.map((face, index) => {
              const isRevealed = turns.revealed[index] === true;
              return (
                <motion.li
                  key={face.copy?.ownershipId ?? face.cardId}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? tweenFast : { ...springGentle, delay: index * 0.06 }}
                  className="max-md:flex max-md:w-full max-md:shrink-0 max-md:justify-center"
                >
                  <CardFlip
                    flipped={!isRevealed}
                    transition={springGentle}
                    front={
                      <CardTilt active={isRevealed && revealShines(face.rarity)}>
                        <CardFace face={face} size="M" />
                      </CardTilt>
                    }
                    back={
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
                    }
                  />
                </motion.li>
              );
            })}
          </motion.ul>
        </motion.div>
      </div>
      {faces.length > 1 && (
        <div className="flex items-center justify-center gap-2 md:hidden">
          {faces.map((face, index) => {
            const current = index === activeIndex;
            return (
              <button
                key={face.copy?.ownershipId ?? `${face.cardId}-${index}`}
                type="button"
                aria-label={`Show card ${index + 1} of ${faces.length}`}
                aria-current={current ? "step" : undefined}
                onClick={() => setActiveIndex(index)}
                className={cn("relative rounded-full p-1.5 transition-colors", hitSlop, focusRing)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block size-2 rounded-full transition-colors",
                    current ? "bg-tint" : "bg-fill-2"
                  )}
                />
              </button>
            );
          })}
          <span className="text-footnote text-label-secondary ml-1 tabular-nums">
            {activeIndex + 1} / {faces.length}
          </span>
        </div>
      )}
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
