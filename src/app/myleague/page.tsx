"use client";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Plus, Trophy, Users, Star } from "lucide-react";
import { motion } from "motion/react";
import { LeagueCreator } from "~/components/myleague/LeagueCreator";
import { withBasePath } from "~/lib/base-path";

const SPORT_LABELS: Record<string, string> = {
  soccer: "Soccer",
  football: "American Football",
  hockey: "Ice Hockey",
  basketball: "Basketball",
  baseball: "Baseball",
  f1: "Formula 1",
  boxing: "Boxing",
};

const SPORT_FALLBACK_IMAGES: Record<string, string> = {
  soccer:
    "https://upload.wikimedia.org/wikipedia/commons/e/e6/Stade_V%C3%A9lodrome_interior_2018.jpg",
  football: "https://upload.wikimedia.org/wikipedia/commons/4/46/Maracana_Stadium.jpg",
  hockey: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Bell_Centre_interior_view.jpg",
  basketball:
    "https://upload.wikimedia.org/wikipedia/commons/e/ee/Madison_Square_Garden_interior.jpg",
  baseball: "https://upload.wikimedia.org/wikipedia/commons/9/92/Scotiabank_Saddledome.jpg",
  f1: "https://upload.wikimedia.org/wikipedia/commons/e/ee/Monaco_Grand_Prix_stretching_past_the_harbour_in_Monte_Carlo%2C_Monaco.jpg",
  boxing:
    "https://upload.wikimedia.org/wikipedia/commons/0/07/2021_CISM_Military_World_Games_Boxing.jpg",
};

const ARCHETYPE_LABELS: Record<string, string> = {
  league: "League",
  division_conference: "Division / Conference",
  bracket: "Bracket",
  circuit: "Circuit",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  completed: "secondary",
  archived: "outline",
};

import { Carousel, Card as CarouselCard } from "~/components/ui/apple-cards-carousel";

export default function MyLeaguePage() {
  usePageTitle({ title: "MyLeague" });
  const router = useRouter();
  const [showCreator, setShowCreator] = useState(false);

  const { data: leagues, isLoading } = api.sports.getLeagues.useQuery({});
  const { data: canonicalLeagues } = api.sports.getLeagues.useQuery({ isCanonical: true });

  const featuredCards =
    canonicalLeagues?.map((league, idx) => (
      <CarouselCard
        key={league.id}
        index={idx}
        card={{
          src:
            (league as any).coverImage ||
            SPORT_FALLBACK_IMAGES[league.sportPreset] ||
            "https://upload.wikimedia.org/wikipedia/commons/e/e6/Stade_V%C3%A9lodrome_interior_2018.jpg",
          title: league.name,
          category: (
            <div className="flex flex-col items-start gap-1.5">
              <Badge
                variant="outline"
                className="flex items-center gap-1 border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-400 uppercase shadow-[0_0_12px_rgba(245,158,11,0.15)]"
              >
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Featured League
              </Badge>
              <span className="opacity-80">
                {SPORT_LABELS[league.sportPreset] ?? league.sportPreset} ·{" "}
                {ARCHETYPE_LABELS[league.archetype] ?? league.archetype}
              </span>
            </div>
          ),
          content: (
            <div className="space-y-4 p-6 text-left dark:text-white">
              <h4 className="text-xl font-bold">{league.name}</h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                This is a canonical featured league. Compete here to earn system-wide ranking
                points, diplomatic standing boosts, and exclusive achievements.
              </p>
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800">
                <div>
                  <p className="text-xs text-neutral-400">STATUS</p>
                  <p className="text-sm font-semibold capitalize">{league.status}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">TEAM COUNT</p>
                  <p className="text-sm font-semibold">{league.teamCount} Teams</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">SEASONS</p>
                  <p className="text-sm font-semibold">{league.seasonCount} Simulated</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">TYPE</p>
                  <p className="text-sm font-semibold">{ARCHETYPE_LABELS[league.archetype]}</p>
                </div>
              </div>
              <Button
                className="mt-6 w-full"
                onClick={() => {
                  // close modal override
                  document.body.style.overflow = "auto";
                  router.push(withBasePath(`/myleague/${league.id}`));
                }}
              >
                Enter League Hub
              </Button>
            </div>
          ),
        }}
      />
    )) || [];

  const allCards =
    leagues?.map((league, idx) => (
      <CarouselCard
        key={league.id}
        index={idx}
        card={{
          src:
            (league as any).coverImage ||
            (league as any).logo ||
            SPORT_FALLBACK_IMAGES[league.sportPreset] ||
            "https://upload.wikimedia.org/wikipedia/commons/d/de/Stadion_Luzhniki_Moskva_July_2018.jpg",
          title: league.name,
          category: `${SPORT_LABELS[league.sportPreset] ?? league.sportPreset} · ${ARCHETYPE_LABELS[league.archetype] ?? league.archetype}`,
          content: (
            <div className="space-y-4 p-6 text-left dark:text-white">
              <h4 className="text-xl font-bold">{league.name}</h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                Manage custom club franchises, transfer players, and schedule fixtures in this
                simulated division.
              </p>
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800">
                <div>
                  <p className="text-xs text-neutral-400">STATUS</p>
                  <p className="text-sm font-semibold capitalize">{league.status}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">TEAM COUNT</p>
                  <p className="text-sm font-semibold">{league.teamCount} Teams</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">SEASONS</p>
                  <p className="text-sm font-semibold">{league.seasonCount} Simulated</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">TYPE</p>
                  <p className="text-sm font-semibold">{ARCHETYPE_LABELS[league.archetype]}</p>
                </div>
              </div>
              <Button
                className="mt-6 w-full"
                onClick={() => {
                  // close modal override
                  document.body.style.overflow = "auto";
                  router.push(withBasePath(`/myleague/${league.id}`));
                }}
              >
                Enter League Hub
              </Button>
            </div>
          ),
        }}
      />
    )) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="facet-surface border-border/40 mb-8 flex items-center justify-between rounded-xl border p-6">
        <div>
          <h1 className="text-3xl font-bold">MyLeague</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage sports leagues with full simulation
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push(withBasePath("/myclub"))}>
            <Users className="mr-2 h-4 w-4 text-cyan-500" />
            MyClub
          </Button>
          <Button onClick={() => setShowCreator(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create League
          </Button>
        </div>
      </div>

      <LeagueCreator open={showCreator} onOpenChange={setShowCreator} />

      {featuredCards.length > 0 && (
        <section className="mb-10">
          <h2 className="facet-hierarchy-parent mb-4 rounded-lg p-3 text-xl font-semibold">
            <Trophy className="mr-2 inline h-5 w-5" />
            Featured Leagues
          </h2>
          <Carousel items={featuredCards} />
        </section>
      )}

      <section>
        <h2 className="facet-hierarchy-parent mb-4 rounded-lg p-3 text-xl font-semibold">
          <Users className="mr-2 inline h-5 w-5" />
          All Leagues
        </h2>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="facet-hierarchy-child">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="mt-2 h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : allCards.length > 0 ? (
          <Carousel items={allCards} />
        ) : (
          <Card className="facet-hierarchy-child">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Trophy className="text-muted-foreground mb-4 h-12 w-12" />
              <p className="text-muted-foreground text-lg">
                No leagues yet. Create one to get started!
              </p>
              <Button className="mt-4" onClick={() => setShowCreator(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create League
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
