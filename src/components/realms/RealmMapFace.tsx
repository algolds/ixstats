"use client";

import { useId } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { assetUrl } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import type { CardRealmBadge } from "~/lib/cards/face/types";
import { RealmCrest } from "~/components/cards/face/RealmCrest";
import { Skeleton } from "~/components/ui/skeleton";

type Face = NonNullable<RouterOutputs["realms"]["mapFace"]>;

/** The hatch is this many stripe pairs across the face. */
const HATCH_DIVISOR = 160;
/** An hour: a realm's political map changes only when nations are claimed or drawn. */
const FACE_STALE_MS = 3_600_000;

/** Hairline borders that stay one device pixel wide however far the face is scaled. */
const BORDER = { strokeWidth: 0.5, vectorEffect: "non-scaling-stroke" } as const;

function viewBoxWidth(viewBox: string): number {
  return Number(viewBox.split(/\s+/)[2]) || 1000;
}

/** The face as SVG: land and other realms flat, claimed nations in the tint, open nations hatched. */
function FaceSvg({ face, className }: { face: Face; className?: string }) {
  const patternId = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const size = viewBoxWidth(face.viewBox) / HATCH_DIVISOR;
  const flat = (status: "land" | "other", d: string) =>
    d ? (
      <path data-status={status} d={d} className="fill-fill-3 stroke-surface" {...BORDER} />
    ) : null;

  return (
    <svg
      viewBox={face.viewBox}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn("facet-well h-full w-full", className)}
    >
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
          width={size}
          height={size}
        >
          <rect width={size} height={size} className="fill-fill-3" />
          <rect width={size / 3} height={size} className="fill-tint" opacity={0.55} />
        </pattern>
      </defs>
      {flat("land", face.land)}
      {flat("other", face.other)}
      {face.open && (
        <path
          data-status="open"
          d={face.open}
          fill={`url(#${patternId})`}
          className="stroke-surface"
          {...BORDER}
        />
      )}
      {face.claimed && (
        <path
          data-status="claimed"
          d={face.claimed}
          className="fill-tint stroke-surface"
          {...BORDER}
        />
      )}
    </svg>
  );
}

/**
 * A realm's face: its banner when it has one, else its political map drawn from the atlas (claimed nations in the
 * tint, open ones hatched), else its crest on the tint. The map is only fetched when there is no banner.
 */
export function RealmMapFace({
  realm,
  bannerUrl,
  className,
}: {
  realm: CardRealmBadge;
  bannerUrl: string | null;
  className?: string;
}) {
  const { data: face, isLoading } = api.realms.mapFace.useQuery(
    { realmSlug: realm.slug },
    { enabled: !bannerUrl, staleTime: FACE_STALE_MS }
  );

  const banner = assetUrl(bannerUrl);
  if (banner) {
    // Realm images load without a referrer: community hosts behind hotlink protection answer 403 to ours.
    return (
      <img
        src={banner}
        referrerPolicy="no-referrer"
        alt=""
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  if (isLoading) return <Skeleton className={cn("h-full w-full rounded-none", className)} />;
  if (face) return <FaceSvg face={face} className={className} />;
  return (
    <div className={cn("bg-tint-fill grid h-full w-full place-items-center", className)}>
      <RealmCrest realm={realm} size="lg" />
    </div>
  );
}
