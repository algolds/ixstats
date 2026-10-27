"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Globe } from "iconoir-react";
import {
  CountryFocusCard,
  type CountryCardData,
} from "~/components/mycountry/dossier/CountryFocusCard";
import { ProgressiveBlur } from "~/components/ui/magicui/progressive-blur";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

export type RealmNation = CountryCardData & { claimed: boolean; mine: boolean };

const PAGE = 12;
const GRID = "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/** Escape, or a click outside every card, closes the expanded card. */
function useCollapseOnEscape(expanded: number | null, collapse: () => void) {
  useEffect(() => {
    if (expanded === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && collapse();
    const onClick = (e: MouseEvent) =>
      !(e.target as HTMLElement).closest(".country-focus-card") && collapse();
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [expanded, collapse]);
}

/** Shows PAGE more nations whenever the sentinel scrolls into view. */
function useLoadMore(total: number) {
  const [visible, setVisible] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  const more = () => setVisible((v) => Math.min(v + PAGE, total));
  useEffect(() => {
    const node = sentinel.current;
    if (!node || visible >= total) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setVisible((v) => Math.min(v + PAGE, total)),
      { rootMargin: "1000px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, total]);
  return { visible, more, sentinel };
}

function GridSkeleton() {
  return (
    <ProgressiveBlur>
      <div className={GRID}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="rounded-card flex h-60 flex-col justify-end p-5 md:h-96">
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    </ProgressiveBlur>
  );
}

function NoMatch({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <Card className="rounded-card mx-auto max-w-md p-12 text-center">
      <Globe aria-hidden="true" className="text-label-secondary mx-auto mb-4 h-12 w-12" />
      <h3 className="text-label text-title-2 mb-2">No nation matches</h3>
      <p className="text-label-secondary text-body mb-6">
        Change the search or clear the filters to see more nations.
      </p>
      <Button type="button" onClick={onClearFilters}>
        Clear filters
      </Button>
    </Card>
  );
}

/**
 * The realm's nations as flag cards (hover for figures, click to expand), PAGE at a time. `corner` is what a
 * card shows in its top corner (its claim state and action); null for none.
 */
export function NationsGrid({
  nations,
  isLoading,
  onCountryClick,
  onClearFilters,
  viewerCountryId,
  corner,
}: {
  nations: RealmNation[];
  isLoading: boolean;
  onCountryClick: (country: CountryCardData) => void;
  onClearFilters: () => void;
  viewerCountryId?: string;
  corner: (nation: RealmNation) => React.ReactNode;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const collapse = React.useCallback(() => setExpanded(null), []);
  useCollapseOnEscape(expanded, collapse);
  const { visible, more, sentinel } = useLoadMore(nations.length);

  if (isLoading) return <GridSkeleton />;
  if (nations.length === 0) return <NoMatch onClearFilters={onClearFilters} />;

  return (
    <div className="space-y-12">
      <div className={GRID}>
        {nations.slice(0, visible).map((nation, index) => (
          <motion.div
            key={nation.id}
            className={cn(
              "relative",
              hovered === index ? "z-20" : expanded === index ? "z-30" : "z-10"
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              delay: Math.min((index % PAGE) * 0.03, 0.3),
              ease: "easeOut",
            }}
          >
            <CountryFocusCard
              country={nation}
              index={index}
              isHovered={hovered === index}
              isExpanded={expanded === index}
              isOtherHovered={hovered !== null && hovered !== index}
              isOtherExpanded={expanded !== null && expanded !== index}
              onHoverToggle={setHovered}
              onExpandToggle={setExpanded}
              onCountryClick={() => onCountryClick(nation)}
              viewerCountryId={viewerCountryId}
              corner={corner(nation)}
            />
          </motion.div>
        ))}
      </div>

      {visible < nations.length ? (
        <div ref={sentinel} className="text-center">
          <Button type="button" size="lg" onClick={more}>
            Load more nations
          </Button>
        </div>
      ) : (
        <p className="text-label-secondary text-body text-center font-medium">
          All {nations.length} nations shown
        </p>
      )}
    </div>
  );
}
