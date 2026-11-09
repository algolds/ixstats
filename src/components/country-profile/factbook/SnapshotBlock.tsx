"use client";

import { useState } from "react";
import Link from "next/link";
import { NavArrowRight, OpenBook } from "iconoir-react";
import type { ProfileSectionCover } from "~/app/countries/[slug]/_utils/profileLayer";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";

export interface Fact {
  label: string;
  /** Null drops the row; pass "–" to show an empty reading. */
  value: string | null;
}

/** A block's facts as plain rows; rows without a value are left out. */
export function FactList({ facts }: { facts: readonly Fact[] }) {
  const shown = facts.filter((f) => f.value);
  if (shown.length === 0) return null;
  return (
    <FacetList variant="plain">
      <FacetListSection>
        {shown.map((f) => (
          <FacetRow key={f.label} title={f.label} trailing={f.value} />
        ))}
      </FacetListSection>
    </FacetList>
  );
}

/**
 * SnapshotBlock — one subject of the Factbook on the Lens: an optional editorial cover photo
 * dynamically linked to its canonical Wiki page (or a canonical Wiki dossier well when unillustrated),
 * its recessed emblem and title, one headline figure with an optional status badge, inline interactive
 * wells, and a few facts, with More opening the subject's full detail in a sheet.
 */
export function SnapshotBlock({
  title,
  icon,
  cover,
  fallbackMedia,
  headline,
  onMore,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  cover?: ProfileSectionCover | null;
  /** Shown in the cover's place when there is no usable image (the block's still map crop). */
  fallbackMedia?: React.ReactNode;
  headline?: {
    value: string;
    label: string;
    badge?: { label: string; variant?: BadgeVariant } | null;
  } | null;
  onMore: () => void;
  children: React.ReactNode;
}) {
  const resolvedCover = cover?.url ? proxyCardArtwork(cover.url) : null;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showCover = Boolean(resolvedCover && failedUrl !== resolvedCover);
  const isVectorCover = Boolean(resolvedCover && /\.svg(?:$|\?)/i.test(resolvedCover));

  const coverInner = showCover && resolvedCover && (
    <>
      {/* oxlint-disable-next-line nextjs/no-img-element -- remote article/card media */}
      <img
        src={resolvedCover}
        alt={cover?.caption ?? `${title} illustration`}
        loading="lazy"
        onError={() => setFailedUrl(resolvedCover)}
        className={
          isVectorCover
            ? "duration-drift ease-out-facet size-full object-contain p-3 transition-transform motion-safe:group-hover/block:scale-[1.03]"
            : "duration-drift ease-out-facet size-full object-cover transition-transform motion-safe:group-hover/block:scale-[1.03]"
        }
      />
      {cover?.readingTime != null && cover.readingTime > 0 && (
        <span className="facet-well rounded-control-sm text-caption text-label-secondary pointer-events-none absolute top-2 right-2 px-1.5 py-0.5 tabular-nums">
          {`${cover.readingTime} min`}
        </span>
      )}
      {cover?.caption && (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center">
          <span className="facet-well rounded-control-sm text-caption text-label inline-flex max-w-full items-center gap-1.5 px-2 py-0.5 font-medium">
            <OpenBook aria-hidden className="text-tint size-3 shrink-0" />
            <span className="truncate">{cover.caption}</span>
            {cover.href && (
              <NavArrowRight aria-hidden className="text-label-secondary size-3 shrink-0" />
            )}
          </span>
        </div>
      )}
    </>
  );

  return (
    <Card padding="md" className="group/block flex min-w-0 flex-col gap-4">
      {showCover && resolvedCover ? (
        cover?.href ? (
          <Link
            href={cover.href}
            data-slot="block-cover"
            className="rounded-row border-separator bg-fill-4 focus-visible:outline-tint relative block h-32 overflow-hidden border focus-visible:outline-2"
          >
            {coverInner}
          </Link>
        ) : (
          <div
            data-slot="block-cover"
            className="rounded-row border-separator bg-fill-4 relative h-32 overflow-hidden border"
          >
            {coverInner}
          </div>
        )
      ) : (
        <>
          {fallbackMedia}
          {cover?.href && cover.caption && (
            <Link
              href={cover.href}
              data-slot="block-wiki-link"
              className="facet-well facet-press facet-press-subtle focus-visible:outline-tint rounded-row flex items-center justify-between gap-2.5 px-3 py-2 focus-visible:outline-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <OpenBook aria-hidden className="text-tint size-3.5 shrink-0" />
                <span className="text-footnote text-label truncate font-medium">
                  {cover.caption}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {cover.readingTime != null && cover.readingTime > 0 && (
                  <span className="text-caption text-label-secondary tabular-nums">
                    {`${cover.readingTime} min`}
                  </span>
                )}
                <NavArrowRight aria-hidden className="text-label-tertiary size-3.5 shrink-0" />
              </span>
            </Link>
          )}
        </>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon != null && (
            <span
              aria-hidden
              className="facet-recess text-tint rounded-control-sm grid size-8 shrink-0 place-items-center [:where(&)_svg]:size-4"
            >
              {icon}
            </span>
          )}
          <h2 className="text-title-3 text-label truncate">{title}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onMore} className="shrink-0">
          More
          <span className="sr-only"> about {title}</span>
          <NavArrowRight aria-hidden />
        </Button>
      </div>
      {headline && (
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-large-title text-label tabular-nums">{headline.value}</span>
            {headline.badge && (
              <Badge variant={headline.badge.variant ?? "secondary"}>{headline.badge.label}</Badge>
            )}
          </div>
          <span className="text-footnote text-label-secondary">{headline.label}</span>
        </div>
      )}
      {children}
    </Card>
  );
}
