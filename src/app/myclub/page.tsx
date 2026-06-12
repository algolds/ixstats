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
            src: "https://ixwiki.com/sports-logo.png",
            title: team.name,
            category: `${emoji} ${team.league?.name ?? "Custom Team"}`,
            content: (
              <div className="space-y-4 p-6 text-left text-foreground">
                <h4 className="text-xl font-bold">{team.name}</h4>
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
                    <p className="text-xs text-muted-foreground font-semibold">STADIUM CAPACITY</p>
                    <p className="text-sm font-semibold">{(team as any).stadiumCapacity || 5000}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">TICKET PRICE</p>
                    <p className="text-sm font-semibold">₷{(team as any).ticketPrice || 15}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">ACTIVE SEASON</p>
                    <p className="text-sm font-semibold">
                      {hasActiveSeason ? `Season ${team.activeSeason!.seasonNumber}` : "Off-season"}
                    </p>
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
