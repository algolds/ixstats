"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Globe } from "iconoir-react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { createUrl } from "~/lib/utils";

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
      notify.success("Following country");
      utils.countries.getRandomCountries.invalidate({ limit: 3 });
    },
    onError: (err) => {
      notify.error(err.message || "Could not follow country");
    },
  });

  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  if (!randomCountries || randomCountries.length === 0) return null;

  return (
    <Card padding="md">
      <h2 className="text-headline text-label mb-3">Countries to explore</h2>
      <div className="space-y-2">
        <ul className="space-y-1">
          {randomCountries.map((c) => {
            const isFollowed = followedIds.has(c.id);
            return (
              <li
                key={c.id}
                className="bg-surface-secondary hover:bg-fill-3 focus-within:bg-fill-3 rounded-row duration-fast ease-out-facet flex items-center gap-2 p-2 transition-colors"
              >
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
                    Tier <span className="tabular-nums">{c.economicTier}</span>
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
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
          className="text-label-secondary hover:text-label hover:bg-fill-4 rounded-control text-footnote focus-visible:outline-tint flex items-center justify-center gap-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Globe aria-hidden className="size-3.5" />
          <span>Explore all countries</span>
        </Link>
      </div>
    </Card>
  );
}
