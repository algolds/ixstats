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
import { Trophy, Group as Users, ArrowRight } from "iconoir-react";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";

const MYCLUB_HELP_STEPS: HeroHelpStep[] = [
  {
    title: "Welcome to MyClub",
    body: "MyClub is your team manager. Each card here is a franchise you own — click one to open its hub: roster, lineup, tactics, finances and season fixtures.",
  },
  {
    title: "Claim a team",
    body: "Don't own a team yet? Head to MyLeague, open a league, and claim an unclaimed club. Once claimed, it shows up here for you to manage.",
  },
  {
    title: "Build your squad",
    body: "Set your starting lineup and formation, choose a tactical intent, and train players to raise their ratings. Work the transfer market to buy and sell talent.",
  },
  {
    title: "Run the finances",
    body: "Collect matchday revenue, pick a sponsor, set ticket prices and upgrade your stadium. Watch your wage bill — player wages are deducted from the club budget each season.",
  },
];

const SPORT_EMOJIS: Record<string, string> = {
  soccer: "\u26BD",
  football: "\uD83C\uDFC8",
  hockey: "\uD83C\uDFD2",
  basketball: "\uD83C\uDFC0",
  baseball: "\u26BE",
  f1: "\uD83C\uDFCE\uFE0F",
  boxing: "\uD83E\uDD4A",
};

function ClubCardSkeleton() {
  return (
    <Card className="facet-hierarchy-child">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  );
}
import { Carousel, Card as CarouselCard } from "~/components/ui/apple-cards-carousel";

export default function MyClubPage() {
  usePageTitle({ title: "MyClub" });
  const router = useRouter();

  const { data: clubs, isLoading } = api.sports.getMyClubs.useQuery();

  const clubCards =
    clubs?.map((team, idx) => {
      // oxlint-disable-next-line eslint/no-unused-vars
      const emoji = SPORT_EMOJIS[team.league?.sportPreset ?? ""] ?? "\uD83C\uDFC6";
      const hasActiveSeason = !!team.activeSeason;

      return (
        <CarouselCard
          key={team.id}
          index={idx}
          card={{
            src: withBasePath(
              team.coverImage ||
                team.logo ||
                sportCoverUrl(team.league?.sportPreset, team.id) ||
                sportCoverUrl("soccer", team.id)!
            ),
            title: team.name,
            category: team.league?.name ?? "Custom Team",
            description: (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 select-none">
                <Badge
                  variant="outline"
                  className="rounded-md border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
                >
                  Record:{" "}
                  {(team as any).currentStandings
                    ? `${(team as any).currentStandings.wins}-${(team as any).currentStandings.losses}${(team as any).currentStandings.draws > 0 ? `-${(team as any).currentStandings.draws}` : ""}`
                    : "0-0"}
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-md border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
                >
                  {team.city || "Local"}
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-md border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
                >
                  Cap: {((team as any).stadiumCapacity || 5000).toLocaleString()}
                </Badge>
                {((team as any).form?.length ?? 0) > 0 && (
                  <div
                    className="flex items-center gap-1"
                    title="Last 5 results (most recent first)"
                  >
                    {((team as any).form as string[]).map((r, i) => (
                      <span
                        key={i}
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black text-white shadow-sm",
                          r === "W" && "bg-emerald-500/80",
                          r === "L" && "bg-rose-500/80",
                          r === "D" && "bg-neutral-500/80"
                        )}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ),
            footer: (
              <div className="-mx-8 mt-auto -mb-8 flex w-[calc(100%+4rem)] items-center justify-between rounded-b-3xl border-t border-white/10 bg-black/40 p-4 pt-3 backdrop-blur-sm select-none">
                <div className="text-left">
                  <span className="mb-1 block text-[10px] leading-none font-bold tracking-wider text-white/50 uppercase">
                    Current Season
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {hasActiveSeason ? `Season ${team.activeSeason!.seasonNumber}` : "Off-season"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveSeason && (team as any).currentStandings && (
                    <Badge
                      variant="outline"
                      className="rounded-md border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300 uppercase shadow-sm"
                    >
                      Rank: {(team as any).currentStandings.position} (
                      {(team as any).currentStandings.points} pts)
                    </Badge>
                  )}
                  {!hasActiveSeason && (
                    <Badge
                      variant="outline"
                      className="rounded-md border-neutral-500/30 bg-neutral-500/20 px-2 py-0.5 text-[9px] font-bold text-neutral-300 uppercase shadow-sm"
                    >
                      Ready
                    </Badge>
                  )}
                  <div className="ml-1 flex gap-1.5">
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full border border-white/10 bg-white/10 text-cyan-400 shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        document.body.style.overflow = "auto";
                        router.push(withBasePath(`/myclub/${team.id}?tab=roster`));
                      }}
                      title="Team Roster"
                    >
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full border border-white/10 bg-white/10 text-white shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        document.body.style.overflow = "auto";
                        router.push(withBasePath(`/myclub/${team.id}`));
                      }}
                      title="Team Dashboard"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ),
            logo: team.logo || undefined,
            content: (
              <div className="text-foreground space-y-4 p-6 text-left">
                <div className="flex items-center gap-3">
                  {team.logo && (
                    <img
                      src={team.logo}
                      alt=""
                      className="h-10 w-10 rounded-lg border object-cover"
                    />
                  )}
                  <h4 className="text-xl font-bold">{team.name}</h4>
                </div>
                <p className="text-muted-foreground text-sm">
                  Official hub for managing roster details, configuring pricing, scouting active
                  sponsorships, and playing matches.
                </p>
                <div className="bg-muted grid grid-cols-2 gap-4 rounded-xl p-4">
                  <div>
                    <p className="text-muted-foreground text-xs font-semibold">CITY</p>
                    <p className="text-sm font-semibold">{team.city || "Local"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-semibold">ACTIVE SEASON</p>
                    <p className="text-sm font-semibold">
                      {hasActiveSeason ? `Season ${team.activeSeason!.seasonNumber}` : "Off-season"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-semibold">CHAMPIONSHIPS</p>
                    <p className="text-sm font-semibold">{(team as any).championships || 0}x</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-semibold">CURRENT RECORD</p>
                    <p className="text-sm font-semibold">
                      {(team as any).currentStandings
                        ? `${(team as any).currentStandings.wins}-${(team as any).currentStandings.losses}${(team as any).currentStandings.draws > 0 ? `-${(team as any).currentStandings.draws}` : ""}`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-semibold">STADIUM CAPACITY</p>
                    <p className="text-sm font-semibold">{(team as any).stadiumCapacity || 5000}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-semibold">TICKET PRICE</p>
                    <p className="text-sm font-semibold">₷{(team as any).ticketPrice || 15}</p>
                  </div>
                </div>
                <Button
                  className="mt-6 w-full"
                  onClick={() => {
                    // close modal override
                    document.body.style.overflow = "auto";
                    router.push(withBasePath(`/myclub/${team.id}`));
                  }}
                >
                  Go to Team Dashboard
                </Button>
              </div>
            ),
          }}
        />
      );
    }) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="facet-surface border-border/40 mb-8 flex items-center justify-between rounded-xl border p-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">MyClub</h1>
            <HeroHelpModal
              title="MyClub guide"
              steps={MYCLUB_HELP_STEPS}
              accentClass="text-cyan-500"
            />
          </div>
          <p className="text-muted-foreground mt-1">Manage your sports teams and franchises</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push(withBasePath("/myleague"))}>
            <Trophy className="mr-2 h-4 w-4 text-amber-500" />
            MyLeague
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ClubCardSkeleton key={i} />
          ))}
        </div>
      ) : clubCards.length === 0 ? (
        <Card className="facet-hierarchy-parent">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Trophy className="text-muted-foreground mb-4 h-16 w-16" />
            <h3 className="text-xl font-semibold">You don&apos;t own any teams yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md">Browse leagues and claim a team!</p>
            <Button className="mt-6" onClick={() => router.push(withBasePath("/myleague"))}>
              Browse Leagues
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Carousel items={clubCards} />
      )}
    </div>
  );
}
