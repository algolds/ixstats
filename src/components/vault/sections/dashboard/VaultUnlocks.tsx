"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { NavArrowRight, Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { focusRing, hitSlop } from "~/components/ui/button";
import { CardTitle } from "~/components/ui/card";
import { LensCard } from "~/components/ui/lens-card";
import { AchievementIcon } from "~/components/achievements/AchievementDecorations";
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

interface CategoryStanding {
  category: string;
  earned: number;
  total: number;
}

interface DragGesture {
  pointerId: number;
  x: number;
  left: number;
  moved: boolean;
  lastX: number;
  lastT: number;
  vx: number;
}

/** The slide a track shows: its scroll position in whole track widths (0 while it has no width). */
const slideAt = (el: HTMLElement) =>
  el.clientWidth ? Math.round(el.scrollLeft / el.clientWidth) : 0;

/** How far a drag or projected flick must go, in track widths, to turn the slide. */
const SWIPE_TURN = 1 / 6;
/** Movement under this many px is a click, not a drag. */
const DRAG_SLOP = 4;
/** Deceleration projection horizon in ms so brisk short flicks advance or retreat slides. */
const VELOCITY_PROJECTION_MS = 160;
/** Minimum frame delta in ms for velocity sampling (filters sub-frame bursts). */
const MIN_VELOCITY_SAMPLE_MS = 8;
/** Hold pause threshold in ms after which release velocity decays to zero. */
const MAX_PAUSE_BEFORE_RELEASE_MS = 80;
/** Upper bound on sampled velocity in px/ms. */
const MAX_VELOCITY_PX_PER_MS = 4;
/** Max category chips displayed in the bottom mastery strip before a "+N" overflow link. */
const MAX_CATEGORY_CHIPS = 4;

/** Where a projected displacement `projectedDx` px (negative leftward) from slide `from` lands. */
function swipeTarget(from: number, projectedDx: number, width: number, count: number): number {
  const step = Math.abs(projectedDx) > width * SWIPE_TURN ? -Math.sign(projectedDx) : 0;
  return Math.min(count - 1, Math.max(0, from + step));
}

function releaseCapture(el: HTMLDivElement, pointerId: number) {
  try {
    if (!el.hasPointerCapture || el.hasPointerCapture(pointerId)) {
      el.releasePointerCapture?.(pointerId);
    }
  } catch {
    // Synthetic test events may not register active pointer capture.
  }
}

/**Derive fallback category counts when only recent/next slides are populated (e.g. partial fixtures). */
function deriveFallbackCategories(
  recent: AchievementFace[],
  next: AchievementFace | null
): CategoryStanding[] {
  const map = new Map<string, CategoryStanding>();
  for (const item of recent) {
    const theme = getCategoryTheme(item.category);
    const existing = map.get(theme.name) ?? { category: theme.name, earned: 0, total: 0 };
    existing.earned += 1;
    map.set(theme.name, existing);
  }
  if (next) {
    const theme = getCategoryTheme(next.category);
    if (!map.has(theme.name)) {
      map.set(theme.name, { category: theme.name, earned: 0, total: 0 });
    }
  }
  return Array.from(map.values());
}

/** One milestone slide in its domain's semantic colour, linking directly to that achievement. */
function MilestoneSlide({
  achievement,
  earned,
  statusLabel,
  position,
  children,
}: {
  achievement: AchievementFace;
  earned: boolean;
  statusLabel: string;
  position: string;
  children: ReactNode;
}) {
  const theme = getCategoryTheme(achievement.category);
  const CategoryIcon = theme.icon;
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
        // A mouse drag turns the deck; it must not start the browser's own drag of the link.
        draggable={false}
        className={cn(
          focusRing,
          "hover:bg-fill-4 duration-fast block h-full w-full px-4 py-3.5 transition-colors"
        )}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span
              data-slot="milestone-category-chip"
              className={cn(
                "text-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium",
                theme.pedestal
              )}
            >
              <CategoryIcon aria-hidden className="size-3.5 shrink-0" />
              <span>{theme.name}</span>
            </span>
            <span className="text-caption text-label-secondary tabular-nums">{statusLabel}</span>
          </div>

          <div className="flex items-center gap-3.5">
            <div
              className={cn(
                "facet-recess rounded-row relative flex size-12 shrink-0 items-center justify-center overflow-hidden",
                earned ? theme.pedestal : "bg-fill-3 text-label-secondary"
              )}
            >
              {earned && epic && (
                <span aria-hidden className="facet-foil absolute inset-0 print:hidden" />
              )}
              <AchievementIcon icon={icon} isUnlocked={earned} className="relative size-6" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-headline text-label truncate">{achievement.title}</span>
              {children}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

/**
 * Apple Fitness-inspired Awards Deck + Category Mastery Strip on `/vault`:
 * - Lens glass card; "See all" ink follows the active slide's semantic domain colour (`--facet-accent`)
 * - 1:1 pointer-capture + momentum-projected flick carousel of newest earned & nearest upcoming medals
 * - Bottom category mastery strip organizing active domains by icon, semantic colour, and ratio
 */
export function VaultUnlocks() {
  const { data: summary } = api.achievements.getMySummary.useQuery();
  const { data: nearest } = api.achievements.getNextUnlock.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const titleId = useId();
  const drag = useRef<DragGesture | null>(null);
  const dragged = useRef(false);

  const recent = summary?.recent ?? [];
  const next = nearest && !recent.some((item) => item.key === nearest.key) ? nearest : null;
  const slides: AchievementFace[] = useMemo(
    () => (next ? [...recent, next] : recent),
    [recent, next]
  );
  const count = slides.length;

  const categoryItems = useMemo(() => {
    if (summary?.categories && summary.categories.length > 0) {
      return summary.categories;
    }
    return deriveFallbackCategories(recent, next);
  }, [summary?.categories, recent, next]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setActive(slideAt(el)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [count]);

  if (count === 0) return null;

  const clampedActive = Math.min(active, count - 1);
  const activeSlide = slides[clampedActive] ?? slides[0]!;
  const activeTheme = getCategoryTheme(activeSlide.category);
  const visibleCategories = categoryItems.slice(0, MAX_CATEGORY_CHIPS);
  const extraCategoryCount = Math.max(0, categoryItems.length - visibleCategories.length);

  const show = (index: number) => {
    const el = track.current;
    el?.scrollTo({ left: index * el.clientWidth });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const now = performance.now();
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic test events may not register active pointer capture.
    }
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      left: event.currentTarget.scrollLeft,
      moved: false,
      lastX: event.clientX,
      lastT: now,
      vx: 0,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || event.pointerId !== start.pointerId) return;
    const dx = event.clientX - start.x;
    if (!start.moved && Math.abs(dx) < DRAG_SLOP) return;
    if (!start.moved) {
      start.moved = true;
      event.currentTarget.style.scrollSnapType = "none";
      event.currentTarget.style.scrollBehavior = "auto";
    }
    const now = performance.now();
    const dt = now - start.lastT;
    if (dt >= MIN_VELOCITY_SAMPLE_MS) {
      const rawVx = (event.clientX - start.lastX) / dt;
      const clampedVx = Math.max(-MAX_VELOCITY_PX_PER_MS, Math.min(MAX_VELOCITY_PX_PER_MS, rawVx));
      start.vx = start.vx === 0 ? clampedVx : start.vx * 0.4 + clampedVx * 0.6;
      start.lastX = event.clientX;
      start.lastT = now;
    }
    event.currentTarget.scrollLeft = start.left - dx;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || event.pointerId !== start.pointerId) return;
    drag.current = null;
    const el = event.currentTarget;
    releaseCapture(el, event.pointerId);
    if (!start.moved) return;
    el.style.scrollSnapType = "";
    el.style.scrollBehavior = "";
    dragged.current = true;
    const width = el.clientWidth;
    const now = performance.now();
    const vx = now - start.lastT > MAX_PAUSE_BEFORE_RELEASE_MS ? 0 : start.vx;
    const dx = event.clientX - start.x;
    const projected = dx + vx * VELOCITY_PROJECTION_MS;
    show(swipeTarget(Math.round(start.left / width), projected, width, count));
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || event.pointerId !== start.pointerId) return;
    drag.current = null;
    const el = event.currentTarget;
    releaseCapture(el, event.pointerId);
    if (!start.moved) return;
    el.style.scrollSnapType = "";
    el.style.scrollBehavior = "";
    show(slideAt(el));
  };

  const hasStandingRatio =
    typeof summary?.unlocked === "number" &&
    typeof summary?.activeTotal === "number" &&
    summary.activeTotal > 0;

  return (
    <section
      aria-roledescription="carousel"
      aria-labelledby={titleId}
      data-slot="vault-unlocks"
      className="flex h-full flex-col"
    >
      <LensCard
        app="vault"
        content="collectible"
        style={facetAccentStyle(activeTheme.accent)}
        className="flex h-full flex-1 flex-col justify-between overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
          <CardTitle id={titleId} icon={<Trophy />}>
            Achievements
          </CardTitle>
          <span className="flex items-center gap-2">
            {hasStandingRatio && (
              <Badge variant="secondary" className="tabular-nums">
                {summary.unlocked}/{summary.activeTotal}
              </Badge>
            )}
            <Link
              href="/vault/achievements"
              className={cn(
                focusRing,
                hitSlop,
                "text-footnote text-facet-accent-ink rounded-control-sm duration-fast inline-flex items-center gap-0.5 font-medium transition-colors"
              )}
            >
              <span>See all</span>
              <NavArrowRight aria-hidden className="size-3.5" />
            </Link>
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div
            ref={track}
            data-slot="vault-unlocks-track"
            onScroll={(e) => setActive(slideAt(e.currentTarget))}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onClickCapture={(e) => {
              if (!dragged.current) return;
              dragged.current = false;
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain motion-safe:scroll-smooth [&::-webkit-scrollbar]:hidden"
          >
            {recent.map((item, index) => (
              <MilestoneSlide
                key={item.key}
                achievement={item}
                earned
                statusLabel={index === 0 ? "Newest" : "Earned"}
                position={`${index + 1} of ${count}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant={getRarityBadgeVariant(item.rarity)}>{item.rarity}</Badge>
                  {item.reward !== null && (
                    <span className="text-footnote text-label-secondary inline-flex items-center gap-1 tabular-nums">
                      +<Credits amount={item.reward} />
                    </span>
                  )}
                </span>
              </MilestoneSlide>
            ))}

            {next && (
              <MilestoneSlide
                achievement={next}
                earned={false}
                statusLabel="Next up"
                position={`${count} of ${count}`}
              >
                <span className="text-footnote text-label-secondary tabular-nums">
                  {next.current.toLocaleString()} of {next.target.toLocaleString()}
                </span>
                <span
                  role="progressbar"
                  aria-label={`${next.title} progress`}
                  aria-valuenow={next.current}
                  aria-valuemin={0}
                  aria-valuemax={next.target}
                  className="bg-fill-3 block h-1.5 w-full overflow-hidden rounded-full"
                >
                  <span
                    className={cn(
                      "duration-fast ease-out-facet block h-full rounded-full transition-[width] motion-reduce:transition-none",
                      getCategoryTheme(next.category).bar
                    )}
                    style={{
                      width: `${next.target > 0 ? Math.min(100, Math.round((next.current / next.target) * 100)) : 0}%`,
                    }}
                  />
                </span>
              </MilestoneSlide>
            )}
          </div>

          {count > 1 && (
            <div className="flex justify-center pb-1.5">
              {slides.map((slide, index) => {
                const dotTheme = getCategoryTheme(slide.category);
                return (
                  <button
                    key={slide.key}
                    type="button"
                    aria-label={`Show achievement ${index + 1} of ${count}`}
                    aria-current={index === clampedActive}
                    onClick={() => show(index)}
                    className={cn(focusRing, hitSlop, "relative cursor-pointer rounded-full p-1.5")}
                  >
                    <span
                      className={cn(
                        "duration-fast block h-1.5 rounded-full transition-[width,background-color]",
                        index === clampedActive ? cn("w-4", dotTheme.dot) : "bg-fill-2 w-1.5"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {visibleCategories.length > 0 && (
          <div
            data-slot="vault-unlocks-categories"
            className="border-separator flex flex-wrap items-center gap-1.5 border-t px-3.5 py-2.5"
          >
            {visibleCategories.map((cat) => {
              const catTheme = getCategoryTheme(cat.category);
              const CatIcon = catTheme.icon;
              const pct =
                cat.total > 0 ? Math.min(100, Math.round((cat.earned / cat.total) * 100)) : 0;

              return (
                <Link
                  key={cat.category}
                  href={`/vault/achievements?category=${encodeURIComponent(cat.category)}`}
                  className={cn(
                    focusRing,
                    hitSlop,
                    "rounded-control-sm text-caption duration-fast inline-flex items-center gap-1.5 px-2 py-1 font-medium transition-opacity hover:opacity-85",
                    cat.earned > 0 ? catTheme.pedestal : "bg-fill-3 text-label-secondary"
                  )}
                >
                  <CatIcon aria-hidden className="size-3.5 shrink-0" />
                  <span>{catTheme.name}</span>
                  <span className="tabular-nums opacity-80">
                    {cat.total > 0 ? `${cat.earned}/${cat.total}` : cat.earned}
                  </span>
                  {cat.total > 0 && (
                    <span
                      aria-hidden
                      className="bg-fill-2 hidden h-1 w-5 overflow-hidden rounded-full sm:inline-block"
                    >
                      <span
                        className={cn("block h-full rounded-full", catTheme.bar)}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  )}
                </Link>
              );
            })}

            {extraCategoryCount > 0 && (
              <Link
                href="/vault/achievements"
                className={cn(
                  focusRing,
                  hitSlop,
                  "bg-fill-3 text-label-secondary hover:text-label rounded-control-sm text-caption duration-fast inline-flex items-center px-2 py-1 tabular-nums transition-colors"
                )}
              >
                +{extraCategoryCount} more
              </Link>
            )}
          </div>
        )}
      </LensCard>
    </section>
  );
}
