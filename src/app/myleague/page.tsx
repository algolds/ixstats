"use client";

import { useState } from "react";
import Link from "next/link";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { SearchField } from "~/components/ui/search-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { EmptyState } from "~/components/ui/empty-state";
import { Card } from "~/components/ui/card";
import { Plus, Trophy, Shield } from "iconoir-react";
import { LeagueCreator } from "~/components/sports/league/LeagueCreator";
import {
  FeaturedLeagueCard,
  FeaturedLeagueCardSkeleton,
  LeagueEntityCard,
  LeagueEntityCardSkeleton,
  type LeagueSummary,
} from "~/components/sports/browse/LeagueEntityCard";
import { PageHeader } from "~/components/shell/PageHeader";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";
import { SPORT_LABELS } from "~/lib/sports/theming";

const MYLEAGUE_HELP_STEPS: HeroHelpStep[] = [
  {
    title: "Welcome to MyLeague",
    body: "MyLeague runs leagues, cups, circuits and tournament brackets across 7 sports. Matches are simulated from saved snapshots, so a replay gives the same result.",
  },
  {
    title: "Find a competition",
    body: "Filter by sport or season status, or search by name. Open a league to see its standings, schedule, live matches and past champions.",
  },
  {
    title: "Create a league",
    body: "Choose Create league to set teams, format and rules. Rosters and the schedule are generated for you.",
  },
  {
    title: "Manage a club",
    body: "Open MyClub to run a franchise: set tactics and lineups, upgrade the stadium and negotiate sponsors.",
  },
];

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

function matchesSearch(league: LeagueSummary, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return (
    league.name.toLowerCase().includes(query) || league.sportPreset.toLowerCase().includes(query)
  );
}

export default function MyLeaguePage() {
  usePageTitle({ title: "MyLeague - Sports & Competitions" });
  const [showCreator, setShowCreator] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const { data: leagues, isLoading } = api.sports.getLeagues.useQuery({});
  const { data: featuredId } = api.sports.getFeaturedLeagueId.useQuery();

  const all: LeagueSummary[] = leagues ?? [];
  const featured =
    (featuredId ? all.find((l) => l.id === featuredId) : undefined) ??
    all.find((l) => l.isCanonical) ??
    all[0];
  const sports = Array.from(new Set(all.map((l) => l.sportPreset).filter(Boolean)));
  const filtered = all.filter(
    (league) =>
      league.id !== featured?.id &&
      matchesSearch(league, search) &&
      (selectedSport === "all" || league.sportPreset === selectedSport) &&
      (selectedStatus === "all" || league.status === selectedStatus)
  );
  const isFiltering = search.trim() !== "" || selectedSport !== "all" || selectedStatus !== "all";

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <PageHeader
        title="MyLeague"
        bleed
        actions={
          <>
            <HeroHelpModal
              title="MyLeague guide"
              steps={MYLEAGUE_HELP_STEPS}
              accentClass="text-tint"
            />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/myclub">
                <Shield />
                MyClub
              </Link>
            </Button>
            <Button size="sm" onClick={() => setShowCreator(true)}>
              <Plus />
              Create league
            </Button>
          </>
        }
      />
      <LeagueCreator open={showCreator} onOpenChange={setShowCreator} />

      {(isLoading || featured) && (
        <section className="space-y-3" aria-labelledby="featured-competition">
          <h2 id="featured-competition" className="text-title-3 text-label">
            Featured
          </h2>
          {featured ? <FeaturedLeagueCard league={featured} /> : <FeaturedLeagueCardSkeleton />}
        </section>
      )}

      <section className="space-y-4" aria-labelledby="all-competitions">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 id="all-competitions" className="text-title-3 text-label">
            Competitions
          </h2>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SearchField
              placeholder="Search competitions"
              value={search}
              onValueChange={setSearch}
              aria-label="Search competitions"
              containerClassName="min-w-[220px] flex-1"
            />
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-40" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {sports.length > 1 && (
          <ToggleGroup
            type="single"
            disallowEmpty
            aria-label="Sport"
            value={selectedSport}
            onValueChange={(value) => setSelectedSport(value || "all")}
            className="max-w-full flex-wrap"
          >
            <ToggleGroupItem value="all">All sports</ToggleGroupItem>
            {sports.map((sport) => (
              <ToggleGroupItem key={sport} value={sport}>
                {SPORT_LABELS[sport] ?? sport}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {isLoading ? (
          <div className={GRID} aria-busy="true" aria-label="Loading competitions">
            {Array.from({ length: 6 }, (_, i) => (
              <LeagueEntityCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <ul className={GRID}>
            {filtered.map((league) => (
              <li key={league.id}>
                <LeagueEntityCard league={league} />
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            {isFiltering ? (
              <EmptyState
                icon={<Trophy />}
                title="No competitions match"
                message="Change the search, sport or status to see more."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setSelectedSport("all");
                      setSelectedStatus("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Trophy />}
                title={featured ? "No other competitions yet" : "No competitions yet"}
                message="Create a league to set its teams, format and rules."
              />
            )}
          </Card>
        )}
      </section>
    </div>
  );
}
