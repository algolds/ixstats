"use client";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Plus, Trophy, Users } from "lucide-react";
import { motion } from "motion/react";
import { LeagueCreator } from "~/components/myleague/LeagueCreator";
import { withBasePath } from "~/lib/base-path";

const SPORT_EMOJIS: Record<string, string> = {
  soccer: "\u26BD",
  football: "\uD83C\uDFC8",
  hockey: "\uD83C\uDFD2",
  basketball: "\uD83C\uDFC0",
  baseball: "\u26BE",
  f1: "\uD83C\uDFCE\uFE0F",
  boxing: "\uD83E\uDD4A",
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

export default function MyLeaguePage() {
  usePageTitle({ title: "MyLeague" });
  const router = useRouter();
  const [showCreator, setShowCreator] = useState(false);

  const { data: leagues, isLoading } = api.sports.getLeagues.useQuery({});
  const { data: canonicalLeagues } = api.sports.getLeagues.useQuery({ isCanonical: true });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="facet-surface rounded-xl border border-border/40 p-6 mb-8 flex items-center justify-between">
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

      {canonicalLeagues && canonicalLeagues.length > 0 && (
        <section className="mb-10">
          <h2 className="facet-hierarchy-parent rounded-lg p-3 mb-4 text-xl font-semibold">
            <Trophy className="mr-2 inline h-5 w-5" />
            Featured Leagues
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {canonicalLeagues.map((league) => (
              <LeagueCard key={league.id} league={league} router={router} />
            ))}
          </div>
        </section>
      )}

      <section>
          <h2 className="facet-hierarchy-parent rounded-lg p-3 mb-4 text-xl font-semibold">
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
        ) : leagues && leagues.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => (
              <LeagueCard key={league.id} league={league} router={router} />
            ))}
          </div>
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

function LeagueCard({
  league,
  router,
}: {
  league: {
    id: string;
    name: string;
    sportPreset: string;
    archetype: string;
    status: string;
    teamCount: number;
    seasonCount: number;
    isCanonical?: boolean;
  };
  router: ReturnType<typeof useRouter>;
}) {
  const emoji = SPORT_EMOJIS[league.sportPreset] ?? "\u26BD";
  const archetypeLabel = ARCHETYPE_LABELS[league.archetype] ?? league.archetype;
  const badgeVariant = STATUS_BADGE_VARIANT[league.status] ?? "outline";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card
        className="facet-hierarchy-interactive cursor-pointer"
        onClick={() => router.push(withBasePath(`/myleague/${league.id}`))}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{emoji}</span>
              <CardTitle className="text-lg">{league.name}</CardTitle>
            </div>
            {league.isCanonical && (
              <Badge variant="default">
                <Trophy className="mr-1 h-3 w-3" />
                Canonical
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={badgeVariant}>{league.status}</Badge>
            <Badge variant="secondary">{archetypeLabel}</Badge>
            <span className="text-muted-foreground">
              <Users className="mr-1 inline h-3.5 w-3.5" />
              {league.teamCount} teams
            </span>
            <span className="text-muted-foreground">
              {league.seasonCount} season{league.seasonCount !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
