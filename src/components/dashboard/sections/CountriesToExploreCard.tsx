"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Group as Users, Globe } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
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
    <FacetCard>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Users aria-hidden className="text-label-secondary size-4 shrink-0" />
        <h3 className="text-headline text-label">Countries to explore</h3>
      </div>
      <div className="space-y-2 px-4 pb-4">
        <ul className="space-y-1">
          {randomCountries.map((c) => {
            const isFollowed = followedIds.has(c.id);
            return (
              <li
                key={c.id}
                className="bg-surface-secondary rounded-row flex items-center gap-2 p-2"
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
                    className="text-label text-headline block truncate hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className="text-label-secondary text-footnote">Tier {c.economicTier}</span>
                </div>
                <Button
                  size="sm"
                  variant={isFollowed ? "gray" : "tinted"}
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
          className="text-tint hover:bg-fill-4 rounded-control text-footnote focus-visible:outline-tint flex items-center justify-center gap-1 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Globe aria-hidden className="size-3.5" />
          <span>Explore all countries</span>
        </Link>
      </div>
    </FacetCard>
  );
}
