"use client";

import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import {
  Plus,
  Trophy,
  Group as Users,
  Star,
  Search,
  ControlSlider as SlidersHorizontal,
  Calendar,
  Component as Layers,
  Link as Link2,
  Check,
  Activity,
  ArrowRight,
  Book,
} from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { LeagueCreator } from "~/components/sports/league/LeagueCreator";
import { LeagueCover } from "~/components/sports/LeagueCover";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";
import { getSportColors, type SportPresetKey } from "~/lib/sports/presets";
import { SPORT_LABELS, ARCHETYPE_LABELS } from "~/lib/sports/theming";

const MYLEAGUE_HELP_STEPS: HeroHelpStep[] = [
  {
    title: "Welcome to MyLeague",
    body: "MyLeague is the competition layer of IxStates. Run leagues, cups, circuits, and tournament brackets across 7 sports with deterministic simulation snapshots.",
  },
  {
    title: "Find a Competition",
    body: "Filter by sport, season status, or search. Click any league to open its unified operational hub: standings, schedule, live COMPETE, and historical almanac.",
  },
  {
    title: "Create a League",
    body: "Hit 'Create League' to configure teams, archetypes, and rules. The engine generates balanced rosters and schedules automatically.",
  },
  {
    title: "Manage a Club",
    body: "Open 'MyClub' to take the helm of a franchise: tune tactics, set lineups, upgrade stadiums, and negotiate sponsor contracts.",
  },
];

const STATUS_ACCENT_CLASSES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  in_progress: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  completed: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  archived: "bg-slate-500/10 text-slate-400 border-slate-500/20",
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

  const featuredSportColors = featuredLeague
    ? getSportColors(featuredLeague.sportPreset as SportPresetKey)
    : null;

  return (
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
      {/* Dynamic League Creator Dialog */}
      <LeagueCreator open={showCreator} onOpenChange={setShowCreator} />

      {/* ─── COMMAND STUDIO HEADER ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/60 p-6 shadow-xl backdrop-blur-xl md:p-8">
        {/* Glow backdrop */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-[120px]" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-xs font-black uppercase tracking-wider text-amber-400"
              >
                COMPETITION ENGINE
              </Badge>
              <HeroHelpModal
                title="MyLeague Guide"
                steps={MYLEAGUE_HELP_STEPS}
                accentClass="text-amber-400"
              />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              MyLeague <span className="text-muted-foreground font-light text-2xl">Studio</span>
            </h1>
            <p className="max-w-2xl text-xs text-muted-foreground leading-relaxed sm:text-sm">
              Operate sporting associations, schedule fixtures, and simulate matches with deterministic state machines and historical almanacs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(withBasePath("/myclub"))}
              data-cuelume-press="subtle"
              className="border-border/60 bg-card/80 text-foreground font-bold shadow-sm transition hover:bg-muted/40 active:scale-[0.98] cursor-pointer"
            >
              <Users className="mr-2 h-4 w-4 text-cyan-400" />
              MyClub Portfolio
            </Button>
            <Button
              onClick={() => setShowCreator(true)}
              data-cuelume-press="subtle"
              className="bg-primary text-primary-foreground font-bold shadow-md transition hover:bg-primary/90 active:scale-[0.98] cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create League
            </Button>
          </div>
        </div>
      </div>

      {/* ─── FEATURED ASSOCIATION HERO ─── */}
      {featuredLeague && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              Featured Competition
            </span>
          </div>

          <div
            className="group relative overflow-hidden rounded-3xl border border-border/40 bg-card/80 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 md:p-8"
            style={
              featuredSportColors
                ? {
                    boxShadow: `0 20px 40px -15px hsla(${featuredSportColors.accentColor}, 0.15)`,
                  }
                : undefined
            }
          >
            {/* Background Cover Overlay */}
            <div className="absolute inset-0 z-0">
              <LeagueCover
                sportPreset={featuredLeague.sportPreset}
                coverImage={featuredLeague.coverImage}
                seed={featuredLeague.id}
                alt=""
                className="h-full w-full object-cover opacity-20 blur-[1px] transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />
            </div>

            <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-amber-500/30 bg-amber-500/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-amber-400">
                    Spotlight
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-border bg-background/60 text-xs font-bold uppercase text-foreground"
                  >
                    {SPORT_LABELS[featuredLeague.sportPreset] || featuredLeague.sportPreset}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-bold uppercase",
                      STATUS_ACCENT_CLASSES[featuredLeague.status] ?? "text-muted-foreground"
                    )}
                  >
                    {featuredLeague.status}
                  </Badge>
                </div>

                <div>
                  <h2 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
                    {featuredLeague.name}
                  </h2>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed md:text-sm">
                    Premier {SPORT_LABELS[featuredLeague.sportPreset] || featuredLeague.sportPreset} competition. Run matches, inspect athlete rosters, track live scoreboards, and explore all-time champions.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 px-3.5 py-2 text-xs font-bold text-muted-foreground backdrop-blur-md">
                    <Users className="h-4 w-4 text-cyan-400" />
                    <span className="text-foreground">{featuredLeague.teamCount}</span> Franchises
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 px-3.5 py-2 text-xs font-bold text-muted-foreground backdrop-blur-md">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                    <span className="text-foreground">{featuredLeague.seasonCount}</span> Seasons
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 px-3.5 py-2 text-xs font-bold text-muted-foreground backdrop-blur-md">
                    <Layers className="h-4 w-4 text-indigo-400" />
                    <span className="text-foreground">
                      {ARCHETYPE_LABELS[featuredLeague.archetype] || featuredLeague.archetype}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto">
                <Button
                  onClick={() => router.push(withBasePath(`/myleague/${featuredLeague.id}`))}
                  data-cuelume-press="subtle"
                  className="group/btn flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-6 font-bold text-background shadow-lg transition hover:bg-foreground/90 active:scale-[0.98] cursor-pointer"
                >
                  <span>Enter Competition</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── SPORT FILTER CHIPS & SEARCH ─── */}
      <section className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-border/30 pb-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Sport Preset Filter Chips */}
          <div className="flex max-w-full flex-wrap gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedSport("all")}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all outline-none select-none active:scale-[0.98]",
                selectedSport === "all"
                  ? "border-foreground bg-foreground text-background shadow-md"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <span>All Sports</span>
            </button>
            {sportsList.map((sport) => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all outline-none select-none active:scale-[0.98]",
                  selectedSport === sport
                    ? "border-foreground bg-foreground text-background shadow-md"
                    : "border-border/60 bg-card/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <span>{SPORT_LABELS[sport] || sport}</span>
              </button>
            ))}
          </div>

          {/* Search and Status Dropdown */}
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search associations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 rounded-xl border-border/60 bg-card/40 ps-9 text-xs transition placeholder:text-muted-foreground/60 hover:bg-card/60 focus-visible:ring-1"
              />
            </div>

            <div className="relative">
              <SlidersHorizontal className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-10 cursor-pointer appearance-none rounded-xl border border-border/60 bg-card/40 py-0 ps-9 pe-8 text-xs font-bold text-foreground transition hover:bg-card/60 outline-none focus-visible:ring-1"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundPosition: `right 10px center`,
                  backgroundSize: `14px`,
                  backgroundRepeat: `no-repeat`,
                }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* ─── LEAGUE GRID CONTENT ─── */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card
                key={i}
                className="overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-1"
              >
                <CardHeader className="pb-3">
                  <Skeleton className="h-6 w-3/4 rounded-lg" />
                  <Skeleton className="mt-2 h-4 w-1/2 rounded-md" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-9 w-full rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredLeagues.length > 0 ? (
          <motion.div layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredLeagues.map((league) => {
                const sportColor =
                  getSportColors(league.sportPreset as SportPresetKey)?.accentColor || "#3b82f6";
                const isUserOwned = !league.isCanonical;

                return (
                  <motion.div
                    key={league.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      onClick={() => router.push(withBasePath(`/myleague/${league.id}`))}
                      className="group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-border/40 bg-card/60 shadow-md backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-xl active:scale-[0.98]"
                    >
                      {/* Image Banner */}
                      <div className="relative h-40 overflow-hidden bg-muted">
                        <LeagueCover
                          sportPreset={league.sportPreset}
                          coverImage={league.coverImage ?? league.logo}
                          seed={league.id}
                          alt={league.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

                        {/* Badges */}
                        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
                          <Badge className="rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-white backdrop-blur-md">
                            {SPORT_LABELS[league.sportPreset] || league.sportPreset}
                          </Badge>
                          <Badge
                            className={cn(
                              "rounded-lg border px-2.5 py-1 text-xs font-bold uppercase shadow-sm",
                              STATUS_ACCENT_CLASSES[league.status] ??
                                "border-border text-muted-foreground"
                            )}
                          >
                            {league.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Content Card Body */}
                      <div className="flex flex-1 flex-col justify-between p-5">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              {ARCHETYPE_LABELS[league.archetype] || league.archetype}
                            </span>
                            {isUserOwned && (
                              <Badge
                                variant="outline"
                                className="rounded border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0 text-xs font-bold text-cyan-400"
                              >
                                Custom
                              </Badge>
                            )}
                          </div>
                          <h3 className="line-clamp-1 text-lg font-black text-foreground transition-colors group-hover:text-primary">
                            {league.name}
                          </h3>

                          <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-bold uppercase">
                            <div className="flex flex-col justify-center rounded-xl border border-border/30 bg-muted/20 p-2.5">
                              <span className="text-xs text-muted-foreground font-medium">Franchises</span>
                              <span className="mt-0.5 text-sm font-black text-foreground">
                                {league.teamCount}
                              </span>
                            </div>
                            <div className="flex flex-col justify-center rounded-xl border border-border/30 bg-muted/20 p-2.5">
                              <span className="text-xs text-muted-foreground font-medium">Seasons</span>
                              <span className="mt-0.5 text-sm font-black text-foreground">
                                {league.seasonCount}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center gap-2">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(withBasePath(`/myleague/${league.id}`));
                            }}
                            className="h-10 flex-1 cursor-pointer rounded-xl border border-border/60 bg-card/80 text-xs font-bold text-foreground transition hover:bg-muted/40"
                            variant="outline"
                          >
                            Open Hub
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyInvite(league.id);
                            }}
                            title="Copy competition invite link"
                            className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border border-border/60 bg-card/80 p-0 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                            variant="outline"
                          >
                            {copiedId === league.id ? (
                              <Check className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="rounded-3xl border border-border/40 bg-card/40 p-12 text-center backdrop-blur-md">
            <Trophy className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-bold text-foreground">No Competitions Found</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Try adjusting your search query, selecting another sport chip, or launch a brand new competition.
            </p>
            <Button
              className="mt-6 font-bold cursor-pointer"
              onClick={() => setShowCreator(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create League
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
