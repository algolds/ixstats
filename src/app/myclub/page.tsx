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

function TeamCard({
  team,
  onNavigate,
}: {
  team: NonNullable<ReturnType<typeof api.sports.getMyClubs.useQuery>["data"]>[number];
  onNavigate: (id: string) => void;
}) {
  const emoji = SPORT_EMOJIS[team.league?.sportPreset ?? ""] ?? "\uD83C\uDFC6";
  const hasActiveSeason = !!team.activeSeason;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Card
        className="facet-hierarchy-interactive cursor-pointer"
        onClick={() => onNavigate(team.id)}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
                style={{ backgroundColor: `${team.color}20` }}
              >
                {emoji}
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-lg">{team.name}</CardTitle>
                <p className="text-muted-foreground truncate text-sm">{team.league?.name}</p>
              </div>
            </div>
            <Badge variant={hasActiveSeason ? "default" : "secondary"}>
              {hasActiveSeason ? `S${team.activeSeason!.seasonNumber}` : "Off-season"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {team.league?.sportPreset ?? "Team"}
              </span>
              {hasActiveSeason && (
                <span className="flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5" />
                  Active
                </span>
              )}
            </div>
            <ArrowRight className="text-muted-foreground h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function MyClubPage() {
  usePageTitle({ title: "MyClub" });
  const router = useRouter();

  const { data: clubs, isLoading } = api.sports.getMyClubs.useQuery();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="facet-surface rounded-xl border border-border/40 p-6 mb-8 flex items-center justify-between">
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
      ) : !clubs || clubs.length === 0 ? (
        <Card className="facet-hierarchy-parent">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Trophy className="text-muted-foreground mb-4 h-16 w-16" />
            <h3 className="text-xl font-semibold">You don&apos;t own any teams yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              Browse leagues and claim a team!
            </p>
            <Button
              className="mt-6"
              onClick={() => router.push(withBasePath("/myleague"))}
            >
              Browse Leagues
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <TeamCard
              key={club.id}
              team={club}
              onNavigate={(id) => router.push(withBasePath(`/myclub/${id}`))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
