"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Group as Users, Globe } from "iconoir-react";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";
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
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "overflow-hidden rounded-xl shadow-xs")}
      trackPointerHover={false}
    >
      {/* Cutout tab header */}
      <div className="relative bg-blue-500/10 px-4 pt-3 pb-5">
        <div className="text-card-foreground flex items-center gap-2 text-xs font-semibold tracking-tight">
          <Users className="h-4 w-4 text-blue-400" />
          <span>Countries to Explore</span>
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={20} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={20} />
      </div>
      <CutoutCardContent className="space-y-3 px-4 pt-0 pb-4">
        <div className="space-y-1.5">
          {randomCountries.map((c) => {
            const isFollowed = followedIds.has(c.id);
            return (
              <div
                key={c.id}
                className="group/c border-border/30 bg-card/40 hover:border-border/60 hover:bg-card/70 relative flex items-center gap-2 overflow-hidden rounded-xl border p-2 transition-all duration-150"
              >
                {c.flagUrl && (
                  <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
                    <img
                      src={c.flagUrl}
                      alt=""
                      className="h-full w-full object-cover object-right transition-transform duration-300 group-hover/c:scale-105"
                    />
                    <div className="from-card via-card/80 absolute inset-0 bg-gradient-to-r to-transparent" />
                  </div>
                )}
                <div className="relative z-10 flex items-center gap-2">
                  <UnifiedCountryFlag
                    showTooltip={false}
                    countryName={c.name}
                    flagUrl={c.flagUrl}
                    size="sm"
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <Link
                      href={createUrl(`/countries/${c.slug}`)}
                      className="text-foreground truncate text-[11px] font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className="text-muted-foreground border-border/40 px-1 py-0 text-[8px] font-medium tracking-wide uppercase"
                      >
                        Tier {c.economicTier}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="relative z-10 ml-auto">
                  <Button
                    size="sm"
                    variant={isFollowed ? "secondary" : "outline"}
                    className="h-6 shrink-0 px-2 text-[9px] font-medium active:scale-95"
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
                </div>
              </div>
            );
          })}
        </div>
        <Link
          href={"/countries"}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/40 mt-2 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors active:scale-[0.98]"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>Explore all countries →</span>
        </Link>
      </CutoutCardContent>
    </CutoutCard>
  );
}
