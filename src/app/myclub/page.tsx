"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { sportCoverUrl } from "~/lib/sports/league-covers";
import { Trophy, Group as Users, ArrowRight, Activity, Shield } from "iconoir-react";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";
import { SPORT_EMOJIS, SPORT_LABELS } from "~/lib/sports/theming";
import { getSportColors, type SportPresetKey } from "~/lib/sports/presets";

const MYCLUB_HELP_STEPS: HeroHelpStep[] = [
  {
    title: "Welcome to MyClub",
    body: "MyClub is your franchise headquarters. Inspect all the sports clubs you manage across different leagues, tune rosters, and oversee finances.",
  },
  {
    title: "Claim a Franchise",
    body: "Head over to MyLeague, open a competition, and claim an available team to add it to your managerial portfolio.",
  },
  {
    title: "Squad Tactics & Lineups",
    body: "Set starting lineups, choose tactical formations, and train athletes to boost their match ratings and physical conditioning.",
  },
  {
    title: "Matchday Economics",
    body: "Upgrade stadium capacity, set ticket prices to optimize attendance revenue, and activate commercial sponsors.",
  },
];

function ClubCardSkeleton() {
  return (
    <Card className="rounded-2xl border border-border/40 bg-card/40 p-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-9 w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}

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
      {/* ─── FRANCHISE SUITE HEADER ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/60 p-6 shadow-xl backdrop-blur-xl md:p-8">
        {/* Glow backdrop */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-500/10 blur-[120px]" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-cyan-500/30 bg-cyan-500/10 text-xs font-black uppercase tracking-wider text-cyan-400"
              >
                FRANCHISE MANAGEMENT
              </Badge>
              <HeroHelpModal
                title="MyClub Guide"
                steps={MYCLUB_HELP_STEPS}
                accentClass="text-cyan-400"
              />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              MyClub <span className="text-muted-foreground font-light text-2xl">Portfolio</span>
            </h1>
            <p className="max-w-2xl text-xs text-muted-foreground leading-relaxed sm:text-sm">
              Take the helm of your sports organizations: set matchday formations, manage athlete rosters, configure ticket prices, and negotiate sponsorships.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(withBasePath("/myleague"))}
              data-cuelume-press="subtle"
              className="border-border/60 bg-card/80 text-foreground font-bold shadow-sm transition hover:bg-muted/40 active:scale-[0.98] cursor-pointer"
            >
              <Trophy className="mr-2 h-4 w-4 text-amber-400" />
              Browse Competitions
            </Button>
          </div>
        </div>
      </div>

      {/* ─── FRANCHISE ROSTER / GRID ─── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <Shield className="h-4 w-4 text-cyan-400" />
            Your Managed Clubs ({clubs?.length ?? 0})
          </span>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ClubCardSkeleton key={i} />
            ))}
          </div>
        ) : !clubs || clubs.length === 0 ? (
          <div className="rounded-3xl border border-border/40 bg-card/40 p-16 text-center backdrop-blur-md">
            <Shield className="mx-auto mb-4 h-14 w-14 text-muted-foreground/30" />
            <h3 className="text-xl font-bold text-foreground">No Franchises Claimed Yet</h3>
            <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground leading-relaxed">
              Explore active competitions in MyLeague to claim an available team and begin your managerial journey.
            </p>
            <Button
              className="mt-6 font-bold cursor-pointer"
              onClick={() => router.push(withBasePath("/myleague"))}
            >
              Browse Leagues & Claim Club
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((team) => {
              const sportPreset = (team.league?.sportPreset ?? "soccer") as SportPresetKey;
              const sportColors = getSportColors(sportPreset);
              const hasActiveSeason = !!team.activeSeason;
              const standings = (team as unknown as { currentStandings?: TeamStandingsInfo })
                .currentStandings;
              const form = (team as unknown as { form?: string[] }).form ?? [];

              return (
                <div
                  key={team.id}
                  onClick={() => router.push(withBasePath(`/myclub/${team.id}`))}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border/40 bg-card/60 shadow-md backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-xl active:scale-[0.98] cursor-pointer"
                >
                  {/* Header Banner */}
                  <div
                    className="relative h-28 overflow-hidden p-4 flex items-end justify-between"
                    style={{
                      background: team.color
                        ? `linear-gradient(135deg, ${team.color}30 0%, hsla(${sportColors.accentColor}, 0.2) 100%)`
                        : undefined,
                    }}
                  >
                    <div className="absolute inset-0 bg-card/30 backdrop-blur-xs" />

                    <div className="relative z-10 flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-background/80 shadow-md">
                        {team.logo ? (
                          <img src={team.logo} alt={team.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xl">
                            {SPORT_EMOJIS[sportPreset] ?? "🏆"}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Badge className="border-border bg-black/60 text-xs font-bold uppercase text-white backdrop-blur-md">
                          {team.league?.name ?? "Independent"}
                        </Badge>
                        <h3 className="line-clamp-1 text-lg font-black text-foreground">
                          {team.name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold uppercase">
                      <div className="flex flex-col justify-center rounded-xl border border-border/30 bg-muted/20 p-2.5">
                        <span className="text-xs text-muted-foreground font-medium">Record</span>
                        <span className="mt-0.5 text-sm font-black text-foreground">
                          {standings
                            ? `${standings.wins ?? 0}-${standings.losses ?? 0}${
                                (standings.draws ?? 0) > 0 ? `-${standings.draws}` : ""
                              }`
                            : "0-0"}
                        </span>
                      </div>

                      <div className="flex flex-col justify-center rounded-xl border border-border/30 bg-muted/20 p-2.5">
                        <span className="text-xs text-muted-foreground font-medium">Stadium</span>
                        <span className="mt-0.5 text-sm font-black text-foreground">
                          {(team.stadiumCapacity ?? 5000).toLocaleString()} seats
                        </span>
                      </div>
                    </div>

                    {/* Recent Form Pills */}
                    {form.length > 0 && (
                      <div className="flex items-center justify-between border-t border-border/20 pt-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Recent Form
                        </span>
                        <div className="flex items-center gap-1.5">
                          {form.slice(0, 5).map((res, i) => (
                            <span
                              key={i}
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-md text-xs font-black text-white shadow-sm",
                                res === "W" && "bg-emerald-500",
                                res === "L" && "bg-rose-500",
                                res === "D" && "bg-amber-500"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(withBasePath(`/myclub/${team.id}?tab=roster`));
                        }}
                        className="h-10 flex-1 cursor-pointer rounded-xl border border-border/60 bg-card/80 text-xs font-bold text-foreground transition hover:bg-muted/40"
                        variant="outline"
                      >
                        <Users className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
                        Roster
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(withBasePath(`/myclub/${team.id}`));
                        }}
                        className="h-10 flex-1 cursor-pointer rounded-xl bg-foreground text-xs font-bold text-background transition hover:bg-foreground/90"
                      >
                        Manage Hub
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
