"use client";

import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
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
import { Stat } from "~/components/ui/stat";
import { springSmooth } from "~/lib/design/motion";
import {
  Plus,
  Trophy,
  Group as Users,
  Star,
  ControlSlider as SlidersHorizontal,
  Calendar,
  Component as Layers,
  Link as Link2,
  Check,
  ArrowRight,
} from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { LeagueCreator } from "~/components/sports/league/LeagueCreator";
import { LeagueCover } from "~/components/sports/LeagueCover";
import { withBasePath } from "~/lib/base-path";
import { PageHeader } from "~/components/shell/PageHeader";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";
import { type SportPresetKey } from "~/lib/sports/presets";
import { SPORT_LABELS, ARCHETYPE_LABELS } from "~/lib/sports/theming";
import { Card } from "~/components/ui/card";

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

const STATUS_BADGE: Record<string, BadgeVariant> = {
  active: "success",
  in_progress: "success",
  paused: "warning",
  completed: "info",
  archived: "default",
};

export default function MyLeaguePage() {
  usePageTitle({ title: "MyLeague - Sports & Competitions" });
  const router = useRouter();
  const [showCreator, setShowCreator] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyInvite = (id: string) => {
    const url = window.location.origin + withBasePath(`/myleague/${id}`);
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    });
  };

  const { data: leagues, isLoading } = api.sports.getLeagues.useQuery({});
  const { data: featuredId } = api.sports.getFeaturedLeagueId.useQuery();

  // Primary featured league selection
  const featuredLeague = useMemo(() => {
    if (!leagues || leagues.length === 0) return null;
    return (
      (featuredId ? leagues.find((l) => l.id === featuredId) : undefined) ??
      leagues.find((l) => l.isCanonical) ??
      leagues[0] ??
      null
    );
  }, [leagues, featuredId]);

  // Filtered leagues for the grid
  const filteredLeagues = useMemo(() => {
    if (!leagues) return [];
    return leagues.filter((league) => {
      if (featuredLeague && league.id === featuredLeague.id) return false;

      const matchesSearch =
        league.name.toLowerCase().includes(search.toLowerCase()) ||
        (league.sportPreset && league.sportPreset.toLowerCase().includes(search.toLowerCase()));

      const matchesSport = selectedSport === "all" || league.sportPreset === selectedSport;
      const matchesStatus = selectedStatus === "all" || league.status === selectedStatus;

      return matchesSearch && matchesSport && matchesStatus;
    });
  }, [leagues, featuredLeague, search, selectedSport, selectedStatus]);

  const sportsList: SportPresetKey[] = useMemo(() => {
    const set = new Set<SportPresetKey>();
    leagues?.forEach((l) => {
      if (l.sportPreset) set.add(l.sportPreset as SportPresetKey);
    });
    return Array.from(set);
  }, [leagues]);

  return (
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
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
            <Button variant="secondary" size="sm" onClick={() => router.push("/myclub")}>
              <Users />
              MyClub
            </Button>
            <Button size="sm" onClick={() => setShowCreator(true)}>
              <Plus />
              Create league
            </Button>
          </>
        }
      />
      <LeagueCreator open={showCreator} onOpenChange={setShowCreator} />

      {/* FEATURED ASSOCIATION HERO */}
      {featuredLeague && (
        <section className="space-y-3" aria-labelledby="featured-competition">
          <h2
            id="featured-competition"
            className="text-subhead text-label-secondary flex items-center gap-2 px-1"
          >
            <Star className="text-yellow size-4" aria-hidden />
            Featured competition
          </h2>

          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <div className="bg-fill-3 relative h-48 shrink-0 overflow-hidden md:h-auto md:w-80">
                <LeagueCover
                  sportPreset={featuredLeague.sportPreset}
                  coverImage={featuredLeague.coverImage}
                  seed={featuredLeague.id}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex flex-1 flex-col justify-between gap-6 p-5 md:flex-row md:items-end md:p-6">
                <div className="max-w-2xl space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Spotlight</Badge>
                    <Badge variant="default">
                      {SPORT_LABELS[featuredLeague.sportPreset] || featuredLeague.sportPreset}
                    </Badge>
                    <Badge
                      variant={STATUS_BADGE[featuredLeague.status] ?? "default"}
                      className="capitalize"
                    >
                      {featuredLeague.status}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-title-1 text-label">{featuredLeague.name}</h3>
                    <p className="text-callout text-label-secondary mt-2">
                      The featured{" "}
                      {SPORT_LABELS[featuredLeague.sportPreset] || featuredLeague.sportPreset}{" "}
                      competition.
                    </p>
                  </div>

                  <div className="text-footnote text-label-secondary flex flex-wrap gap-x-5 gap-y-2">
                    <span className="flex items-center gap-2">
                      <Users className="size-4" aria-hidden />
                      <span className="text-label font-medium tabular-nums">
                        {featuredLeague.teamCount}
                      </span>{" "}
                      Franchises
                    </span>
                    <span className="flex items-center gap-2">
                      <Calendar className="size-4" aria-hidden />
                      <span className="text-label font-medium tabular-nums">
                        {featuredLeague.seasonCount}
                      </span>{" "}
                      Seasons
                    </span>
                    <span className="flex items-center gap-2">
                      <Layers className="size-4" aria-hidden />
                      <span className="text-label font-medium">
                        {ARCHETYPE_LABELS[featuredLeague.archetype] || featuredLeague.archetype}
                      </span>
                    </span>
                  </div>
                </div>

                <Button
                  size="lg"
                  variant="secondary"
                  className="group/btn w-full sm:w-auto"
                  onClick={() => router.push(`/myleague/${featuredLeague.id}`)}
                >
                  <span>Enter competition</span>
                  <ArrowRight className="transition-transform group-hover/btn:translate-x-0.5" />
                </Button>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* SPORT FILTER CHIPS & SEARCH */}
      <section className="space-y-6">
        <div className="border-separator flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Sport Preset Filter Chips */}
          <ToggleGroup
            type="single"
            disallowEmpty
            aria-label="Sport"
            value={selectedSport}
            onValueChange={(value) => setSelectedSport(value || "all")}
            className="max-w-full flex-wrap"
          >
            <ToggleGroupItem value="all">All sports</ToggleGroupItem>
            {sportsList.map((sport) => (
              <ToggleGroupItem key={sport} value={sport}>
                {SPORT_LABELS[sport] || sport}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {/* Search and Status Dropdown */}
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <SearchField
              placeholder="Search competitions"
              value={search}
              onValueChange={setSearch}
              aria-label="Search competitions"
              containerClassName="min-w-[220px] flex-1"
            />

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-44" aria-label="Status">
                <SlidersHorizontal className="text-label-secondary size-4" aria-hidden />
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

        {/* LEAGUE GRID CONTENT */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 w-full rounded-none" />
                <div className="space-y-3 p-5">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredLeagues.length > 0 ? (
          <motion.div layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredLeagues.map((league) => {
                const isUserOwned = !league.isCanonical;

                return (
                  <motion.div
                    key={league.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={springSmooth}
                  >
                    <Card
                      onClick={() => router.push(`/myleague/${league.id}`)}
                      aria-label={`Open ${league.name}`}
                      className="group flex h-full flex-col justify-between overflow-hidden"
                      interactive
                    >
                      {/* Image Banner */}
                      <div className="bg-fill-3 relative h-40 overflow-hidden">
                        <LeagueCover
                          sportPreset={league.sportPreset}
                          coverImage={league.coverImage ?? league.logo}
                          seed={league.id}
                          alt={league.name}
                          className="h-full w-full object-cover"
                        />

                        {/* Badges */}
                        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
                          <Badge variant="default" className="bg-surface text-label">
                            {SPORT_LABELS[league.sportPreset] || league.sportPreset}
                          </Badge>
                          <Badge
                            variant={STATUS_BADGE[league.status] ?? "default"}
                            className="bg-surface capitalize"
                          >
                            {league.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Content Card Body */}
                      <div className="flex flex-1 flex-col justify-between p-5">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-footnote text-label-secondary">
                              {ARCHETYPE_LABELS[league.archetype] || league.archetype}
                            </span>
                            {isUserOwned && <Badge variant="secondary">Custom</Badge>}
                          </div>
                          <h3 className="text-title-3 text-label group-hover:text-tint line-clamp-1 transition-colors">
                            {league.name}
                          </h3>

                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <div className="bg-surface-secondary rounded-row p-3">
                              <Stat size="sm" label="Franchises" value={league.teamCount} />
                            </div>
                            <div className="bg-surface-secondary rounded-row p-3">
                              <Stat size="sm" label="Seasons" value={league.seasonCount} />
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center gap-2">
                          <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/myleague/${league.id}`);
                            }}
                          >
                            Open hub
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyInvite(league.id);
                            }}
                            title="Copy competition invite link"
                            aria-label="Copy competition invite link"
                          >
                            {copiedId === league.id ? (
                              <Check className="text-success" />
                            ) : (
                              <Link2 />
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        ) : (
          <Card>
            <EmptyState
              icon={<Trophy />}
              title="No competitions found"
              message="No competition matches these filters. Change the search or sport, or create a league."
              action={
                <Button onClick={() => setShowCreator(true)}>
                  <Plus />
                  Create league
                </Button>
              }
            />
          </Card>
        )}
      </section>
    </div>
  );
}
