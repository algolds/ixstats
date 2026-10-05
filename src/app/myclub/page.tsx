"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { EmptyState } from "~/components/ui/empty-state";
import { PageHeader } from "~/components/shell/PageHeader";
import { Stat } from "~/components/ui/stat";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { Trophy, Group as Users, ArrowRight, Shield } from "iconoir-react";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";
import { SPORT_EMOJIS, type SportPresetKey } from "~/lib/sports/presets";
import { Card } from "~/components/ui/card";

const MYCLUB_HELP_STEPS: HeroHelpStep[] = [
  {
    title: "Welcome to MyClub",
    body: "MyClub lists every club you manage across leagues, with their rosters and finances.",
  },
  {
    title: "Claim a club",
    body: "Open a competition in MyLeague and claim an available team to add it here.",
  },
  {
    title: "Squad and lineups",
    body: "Set starting lineups and formations, and train athletes to raise their match ratings and fitness.",
  },
  {
    title: "Matchday finances",
    body: "Expand the stadium, set ticket prices and sign commercial sponsors.",
  },
];

function ClubCardSkeleton() {
  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="rounded-row size-12" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="rounded-row h-16 w-full" />
      <Skeleton className="h-9 w-full" />
    </Card>
  );
}

const FORM_CLASS: Record<string, string> = {
  W: "bg-green text-on-green",
  L: "bg-red text-on-red",
  D: "bg-yellow text-on-yellow",
};

interface TeamStandingsInfo {
  position?: number | null;
  points?: number | null;
  wins?: number | null;
  losses?: number | null;
  draws?: number | null;
}

export default function MyClubPage() {
  usePageTitle({ title: "MyClub - Franchise & Squad Management" });
  const router = useRouter();

  const { data: clubs, isLoading } = api.sports.getMyClubs.useQuery();

  return (
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
      <PageHeader
        title="MyClub"
        bleed
        actions={
          <>
            <HeroHelpModal title="MyClub guide" steps={MYCLUB_HELP_STEPS} accentClass="text-tint" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(withBasePath("/myleague"))}
            >
              <Trophy />
              Browse competitions
            </Button>
          </>
        }
      />

      {/* CLUB GRID */}
      <section className="space-y-4" aria-labelledby="managed-clubs">
        <h2
          id="managed-clubs"
          className="text-subhead text-label-secondary flex items-center gap-2 px-1"
        >
          <Shield className="size-4" aria-hidden />
          Your managed clubs <span className="tabular-nums">({clubs?.length ?? 0})</span>
        </h2>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ClubCardSkeleton key={i} />
            ))}
          </div>
        ) : !clubs || clubs.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Shield />}
              title="No clubs claimed yet"
              message="Claim an available team in a MyLeague competition to manage it here."
              action={
                <Button onClick={() => router.push(withBasePath("/myleague"))}>
                  Browse leagues
                  <ArrowRight />
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((team) => {
              const sportPreset = (team.league?.sportPreset ?? "soccer") as SportPresetKey;
              const standings = (team as unknown as { currentStandings?: TeamStandingsInfo })
                .currentStandings;
              const form = (team as unknown as { form?: string[] }).form ?? [];

              return (
                <Card
                  key={team.id}
                  onClick={() => router.push(withBasePath(`/myclub/${team.id}`))}
                  aria-label={`Open ${team.name}`}
                  className="group flex flex-col justify-between overflow-hidden"
                  interactive
                >
                  {/* Club colour hairline (data colour) */}
                  {team.color && (
                    <div aria-hidden className="h-1" style={{ backgroundColor: team.color }} />
                  )}

                  <div className="flex items-center gap-3 p-5 pb-0">
                    <div className="border-separator bg-surface-secondary rounded-row flex size-12 shrink-0 items-center justify-center overflow-hidden border">
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-title-2">{SPORT_EMOJIS[sportPreset] ?? "🏆"}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-footnote text-label-secondary truncate">
                        {team.league?.name ?? "Independent"}
                      </p>
                      <h3 className="text-label group-hover:text-tint text-title-3 line-clamp-1 transition-colors">
                        {team.name}
                      </h3>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex flex-1 flex-col justify-between space-y-4 p-5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-surface-secondary rounded-row p-3">
                        <Stat
                          size="sm"
                          label="Record"
                          value={
                            standings
                              ? `${standings.wins ?? 0}-${standings.losses ?? 0}${
                                  (standings.draws ?? 0) > 0 ? `-${standings.draws}` : ""
                                }`
                              : "0-0"
                          }
                        />
                      </div>
                      <div className="bg-surface-secondary rounded-row p-3">
                        <Stat
                          size="sm"
                          label="Stadium"
                          value={`${(team.stadiumCapacity ?? 5000).toLocaleString()} seats`}
                        />
                      </div>
                    </div>

                    {/* Recent Form Pills */}
                    {form.length > 0 && (
                      <div className="border-separator flex items-center justify-between border-t pt-3">
                        <span className="text-label-secondary text-footnote">Recent form</span>
                        <div className="flex items-center gap-1">
                          {form.slice(0, 5).map((res, i) => (
                            <span
                              key={i}
                              className={cn(
                                "text-caption rounded-control-sm flex size-6 items-center justify-center",
                                FORM_CLASS[res] ?? "bg-fill-3 text-label-secondary"
                              )}
                            >
                              {res}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Triggers */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(withBasePath(`/myclub/${team.id}?tab=roster`));
                        }}
                      >
                        <Users />
                        Roster
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(withBasePath(`/myclub/${team.id}`));
                        }}
                      >
                        Manage club
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
