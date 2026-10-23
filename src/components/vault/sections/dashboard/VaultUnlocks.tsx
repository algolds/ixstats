"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { CardTitle } from "~/components/ui/card";
import { focusRing } from "~/components/ui/button";
import { CutoutCard } from "~/components/ui/cutout-card";
import { Progress } from "~/components/ui/progress";
import {
  AchievementCardBackdrop,
  AchievementIcon,
} from "~/components/achievements/AchievementDecorations";
import {
  getAchievementIcon,
  getCategoryTheme,
  getRarityBadgeVariant,
} from "~/components/achievements/constants";
import { facetAccentStyle } from "~/lib/design/identity";
import { cn } from "~/lib/utils/cn";
import { Credits } from "./credits";

interface AchievementFace {
  key: string;
  title: string;
  rarity: string;
  category: string;
  iconUrl: string | null;
}

/** The slide a track shows: its scroll position in whole track widths (0 while it has no width). */
const slideAt = (el: HTMLElement) =>
  el.clientWidth ? Math.round(el.scrollLeft / el.clientWidth) : 0;

/** How far a mouse drag must go, in track widths, to turn the slide, as a finger swipe would. */
const SWIPE_TURN = 1 / 6;
/** Movement under this many px is a click, not a drag. */
const DRAG_SLOP = 4;

/** Where a drag of `dx` px (negative leftward) from slide `from` lands: the next or previous slide past the turn. */
function swipeTarget(from: number, dx: number, width: number, count: number): number {
  const step = Math.abs(dx) > width * SWIPE_TURN ? -Math.sign(dx) : 0;
  return Math.min(count - 1, Math.max(0, from + step));
}

/** One achievement on its art (aurora, and foil when an unlock is epic or better), linking to it. */
function UnlockSlide({
  achievement,
  unlocked,
  position,
  children,
}: {
  achievement: AchievementFace;
  unlocked: boolean;
  /** "N of M", the slide's place in the deck. */
  position: string;
  children: ReactNode;
}) {
  const theme = getCategoryTheme(achievement.category);
  const icon = getAchievementIcon(achievement.iconUrl, achievement.category);
  const epic = achievement.rarity === "Legendary" || achievement.rarity === "Epic";
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={position}
      className="h-full w-full shrink-0 snap-center"
    >
      <Link
        href={`/vault/achievements?a=${encodeURIComponent(achievement.key)}`}
        // A mouse drag turns the deck; it must not start the browser's own drag of the link
        draggable={false}
        className={cn(focusRing, "rounded-cutout block h-full w-full")}
      >
        <CutoutCard
          interactive
          style={facetAccentStyle(theme.accent)}
          // min-h-40: as tall as the Balance card, also where it is not beside it (a phone). pt-12 clears the deck's
          // header, pb-7 its dots.
          className="flex h-full min-h-40 items-center gap-3 px-4 pt-12 pb-7"
        >
          <AchievementCardBackdrop
            categoryTheme={theme}
            isUnlocked={unlocked}
            isLegendaryOrEpic={unlocked && epic}
          />
          <div
            className={cn(
              "rounded-row relative flex size-11 shrink-0 items-center justify-center",
              theme.pedestal
            )}
          >
            <AchievementIcon icon={icon} isUnlocked={unlocked} className="size-6.5" />
          </div>
          <div className="relative flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-headline text-label truncate">{achievement.title}</span>
            {children}
          </div>
        </CutoutCard>
      </Link>
    </div>
  );
}

/**
 * The player's achievements as a swipeable deck: the three newest unlocks, newest first, then the locked one
 * they are nearest to. Absent until there is either.
 */
export function VaultUnlocks() {
  const { data: summary } = api.achievements.getMySummary.useQuery();
  const { data: nearest } = api.achievements.getNextUnlock.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const titleId = useId();
  // A mouse press on the track: where it started, the scroll then, and whether it moved enough to be a drag
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  // Set when a drag ends, so the click the release fires does not open the slide
  const dragged = useRef(false);

  const recent = summary?.recent ?? [];
  // The next-up query is cached longer than the summary, so it can still name an achievement just earned.
  const next = nearest && !recent.some((unlock) => unlock.key === nearest.key) ? nearest : null;
  const count = recent.length + (next ? 1 : 0);

  // A resize moves every slide's offset, so the shown slide is measured again.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setActive(slideAt(el)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [count]);

  if (count === 0) return null;

  // The track's scroll-behavior makes this smooth, unless motion is reduced.
  const show = (index: number) => {
    const el = track.current;
    el?.scrollTo({ left: index * el.clientWidth });
  };

  // Touch scrolls the track natively; a mouse drags it the same way, its snapping paused while it follows the pointer.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (!start.moved && Math.abs(dx) < DRAG_SLOP) return;
    if (!start.moved) {
      start.moved = true;
      event.currentTarget.style.scrollSnapType = "none";
      event.currentTarget.style.scrollBehavior = "auto";
    }
    event.currentTarget.scrollLeft = start.left - dx;
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    drag.current = null;
    if (!start?.moved) return;
    const el = event.currentTarget;
    el.style.scrollSnapType = "";
    el.style.scrollBehavior = "";
    dragged.current = true;
    const width = el.clientWidth;
    show(swipeTarget(Math.round(start.left / width), event.clientX - start.x, width, count));
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-labelledby={titleId}
      data-slot="vault-unlocks"
      // The dots sit on the card's foot, not under it, so the card fills the Balance card's row
      className="relative flex h-full flex-col"
    >
      {/* One header over every slide, as the Balance card's; taps and drags pass through it to the slide */}
      <CardTitle
        id={titleId}
        icon={<Trophy />}
        className="text-label pointer-events-none absolute top-5 left-5 z-10"
      >
        Achievements
      </CardTitle>
      <div
        ref={track}
        data-slot="vault-unlocks-track"
        onScroll={(e) => setActive(slideAt(e.currentTarget))}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={(e) => {
          if (!dragged.current) return;
          dragged.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        className="flex flex-1 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain motion-safe:scroll-smooth [&::-webkit-scrollbar]:hidden"
      >
        {recent.map((unlock, index) => (
          <UnlockSlide
            key={unlock.key}
            achievement={unlock}
            unlocked
            position={`${index + 1} of ${count}`}
          >
            <span className="text-footnote text-label-secondary">
              {index === 0 ? "Newest" : "Earned"}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant={getRarityBadgeVariant(unlock.rarity)}>{unlock.rarity}</Badge>
              {unlock.reward !== null && (
                <span className="text-footnote text-label-secondary inline-flex items-center gap-1 tabular-nums">
                  +<Credits amount={unlock.reward} />
                </span>
              )}
            </span>
          </UnlockSlide>
        ))}
        {next && (
          <UnlockSlide achievement={next} unlocked={false} position={`${count} of ${count}`}>
            <span className="text-footnote text-label-secondary tabular-nums">
              Next up, {next.current.toLocaleString()} of {next.target.toLocaleString()}
            </span>
            <Progress
              value={next.current}
              max={next.target}
              aria-label={`${next.title} progress`}
              className="h-1.5"
            />
          </UnlockSlide>
        )}
      </div>
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Show achievement ${index + 1} of ${count}`}
              aria-current={index === active}
              onClick={() => show(index)}
              // The padding makes a 24px target around the 6px dot, inside the card's bottom padding.
              className={cn(focusRing, "rounded-full p-2.25")}
            >
              <span
                className={cn(
                  "block size-1.5 rounded-full transition-colors",
                  index === active ? "bg-tint" : "bg-fill-2"
                )}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
