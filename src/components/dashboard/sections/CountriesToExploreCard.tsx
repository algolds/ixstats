"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Group as Users, Globe } from "iconoir-react";
import { CutoutCard, CutoutCardHeader } from "~/components/ui/cutout-card";
import { Button } from "~/components/ui/button";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { DATA_FONT, isNumericText } from "~/lib/design/identity";
import { cn, createUrl } from "~/lib/utils";

export function CountriesToExploreCard({ currentUserCountryId }: { currentUserCountryId: string }) {
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    // oxlint-disable-next-line
    setSeed(Date.now());
  }, []);

  const { data: randomCountries } = api.countries.getRandomCountries.useQuery(
    { limit: 3 },
    { enabled: seed > 0, staleTime: 0 }
  );
  const followerCountryId = currentUserCountryId;
  const utils = api.useUtils();
  const notify = useNotify();

  const followMutation = api.activities.followCountry.useMutation({
    onSuccess: () => {
      notify.success("Followed country!");
      utils.countries.getRandomCountries.invalidate({ limit: 3 });
    },
    onError: (err) => {
      notify.error(err.message || "Failed to follow");
    },
  });

  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  if (!randomCountries || randomCountries.length === 0) return null;

  return (
    // v2 (c5c6b382): a CutoutCard with the blue cutout tab header and flag-backed rows.
    <CutoutCard variant="card" accent="blue" retint trackPointerHover={false}>
      <CutoutCardHeader icon={<Users />} as="h2">
        Countries to explore
      </CutoutCardHeader>
      <div className="space-y-2 px-4 pb-4">
        <ul className="space-y-1">
          {randomCountries.map((c) => {
            const isFollowed = followedIds.has(c.id);
            return (
              <li
                key={c.id}
                className="group/c bg-surface-secondary border-separator hover:bg-fill-3 focus-within:bg-fill-3 rounded-row duration-fast ease-out-facet relative isolate flex items-center gap-2 overflow-hidden border p-2 transition-colors"
              >
                {/* v2 flag backdrop on the row's trailing edge, behind an opaque scrim. */}
                {c.flagUrl && (
                  <span aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                    <img
                      src={c.flagUrl}
                      alt=""
                      loading="lazy"
                      className="ease-out-facet size-full object-cover object-right opacity-40 transition-[scale] duration-300 group-focus-within/c:scale-105 group-hover/c:scale-105 motion-reduce:transition-none motion-reduce:group-focus-within/c:scale-100 motion-reduce:group-hover/c:scale-100"
                    />
                    <span className="from-surface-secondary via-surface-secondary/85 absolute inset-0 bg-gradient-to-r to-transparent" />
                  </span>
                )}
                <UnifiedCountryFlag
                  showTooltip={false}
                  countryName={c.name}
                  flagUrl={c.flagUrl}
                  size="sm"
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={createUrl(`/countries/${c.slug}`)}
                    className="text-label text-headline focus-visible:outline-tint rounded-control-sm block truncate hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {c.name}
                  </Link>
                  <span className="text-label-secondary text-footnote">
                    Tier{" "}
                    <span className={cn(isNumericText(c.economicTier) && DATA_FONT)}>
                      {c.economicTier}
                    </span>
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={isFollowed ? "secondary" : "secondary"}
                  className="shrink-0"
                  disabled={!followerCountryId || followMutation.isPending}
                  onClick={() => {
                    if (isFollowed) return;
                    followMutation.mutate({
                      followerCountryId,
                      followedCountryId: c.id,
                    });
                    setFollowedIds((prev) => new Set(prev).add(c.id));
                  }}
                >
                  {isFollowed ? "Following" : "Follow"}
                </Button>
              </li>
            );
          })}
        </ul>
        <Link
          href={"/countries"}
          className="text-label-secondary hover:text-label hover:bg-fill-4 rounded-control text-footnote facet-press focus-visible:outline-tint flex items-center justify-center gap-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Globe aria-hidden className="size-3.5" />
          <span>Explore all countries</span>
        </Link>
      </div>
    </CutoutCard>
  );
}
