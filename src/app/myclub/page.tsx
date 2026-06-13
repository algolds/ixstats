"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { motion } from "motion/react";
import { withBasePath } from "~/lib/base-path";
import { Trophy, Users, ArrowRight } from "lucide-react";

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
      const emoji = SPORT_EMOJIS[team.league?.sportPreset ?? ""] ?? "\uD83C\uDFC6";
      const hasActiveSeason = !!team.activeSeason;

      return (
        <CarouselCard
          key={team.id}
          index={idx}
          card={{
            src: team.coverImage || team.logo || "https://ixwiki.com/sports-logo.png",
            title: team.name,
            category: team.league?.name ?? "Custom Team",
            description: (
              <div className="flex flex-wrap items-center gap-1.5 mt-1 select-none">
                <Badge
                  variant="outline"
                  className="border-white/10 bg-black/50 text-[10px] font-bold text-white px-2 py-0.5 rounded-md shadow-sm"
                >
                  Record: {(team as any).currentStandings ? (
                    `${(team as any).currentStandings.wins}-${(team as any).currentStandings.losses}${(team as any).currentStandings.draws > 0 ? `-${(team as any).currentStandings.draws}` : ""}`
                  ) : (
                    "0-0"
                  )}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-black/50 text-[10px] font-bold text-white px-2 py-0.5 rounded-md shadow-sm"
                >
                  {team.city || "Local"}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-black/50 text-[10px] font-bold text-white px-2 py-0.5 rounded-md shadow-sm"
                >
                  Cap: {((team as any).stadiumCapacity || 5000).toLocaleString()}
                </Badge>
              </div>
            ),
            footer: (
              <div className="flex items-center justify-between w-[calc(100%+4rem)] border-t border-white/10 pt-3 mt-auto bg-black/40 backdrop-blur-sm -mx-8 -mb-8 p-4 rounded-b-3xl select-none">
                <div className="text-left">
                  <span className="text-[10px] uppercase font-bold text-white/50 block tracking-wider leading-none mb-1">
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
                      className="border-amber-500/30 bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase py-0.5 px-2 rounded-md shadow-sm"
                    >
                      Rank: {((team as any).currentStandings.position)} ({((team as any).currentStandings.points)} pts)
                    </Badge>
                  )}
                  {!hasActiveSeason && (
                    <Badge
                      variant="outline"
                      className="border-neutral-500/30 bg-neutral-500/20 text-neutral-300 text-[9px] font-bold uppercase py-0.5 px-2 rounded-md shadow-sm"
                    >
                      Ready
                    </Badge>
                  )}
                  <div className="flex gap-1.5 ml-1">
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-cyan-400 backdrop-blur-md shadow-sm transition-all hover:scale-105"
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
                      className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white backdrop-blur-md shadow-sm transition-all hover:scale-105"
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
              <div className="space-y-4 p-6 text-left text-foreground">
                <div className="flex items-center gap-3">
                  {team.logo && (
                    <img src={team.logo} alt="" className="h-10 w-10 rounded-lg object-cover border" />
                  )}
                  <h4 className="text-xl font-bold">{team.name}</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Official hub for managing roster details, configuring pricing, scouting active
                  sponsorships, and playing fixtures.
                </p>
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted p-4">
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">CITY</p>
                    <p className="text-sm font-semibold">{team.city || "Local"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">ACTIVE SEASON</p>
                    <p className="text-sm font-semibold">
                      {hasActiveSeason ? `Season ${team.activeSeason!.seasonNumber}` : "Off-season"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">CHAMPIONSHIPS</p>
                    <p className="text-sm font-semibold">{(team as any).championships || 0}x</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">CURRENT RECORD</p>
                    <p className="text-sm font-semibold">
                      {(team as any).currentStandings ? (
                        `${(team as any).currentStandings.wins}-${(team as any).currentStandings.losses}${(team as any).currentStandings.draws > 0 ? `-${(team as any).currentStandings.draws}` : ""}`
                      ) : (
                        "N/A"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">STADIUM CAPACITY</p>
                    <p className="text-sm font-semibold">{(team as any).stadiumCapacity || 5000}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">TICKET PRICE</p>
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
          <h1 className="text-3xl font-bold">MyClub</h1>
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
