"use client";

import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import {
  Plus,
  Trophy,
  Users,
  Star,
  Search,
  SlidersHorizontal,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Flame,
  Calendar,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LeagueCreator } from "~/components/myleague/LeagueCreator";
import { LeagueCover } from "~/components/sports/LeagueCover";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { getSportColors, type SportPresetKey } from "~/lib/sports/presets";

const SPORT_LABELS: Record<string, string> = {
  soccer: "Soccer",
  football: "American Football",
  hockey: "Ice Hockey",
  basketball: "Basketball",
  baseball: "Baseball",
  f1: "Formula 1",
  boxing: "Boxing",
};

// eslint-disable-next-line unused-imports/no-unused-vars
const SPORT_EMOJIS: Record<string, string> = {
  soccer: "⚽",
  football: "🏈",
  hockey: "🏒",
  basketball: "🏀",
  baseball: "⚾",
  f1: "🏎️",
  boxing: "🥊",
};

const ARCHETYPE_LABELS: Record<string, string> = {
  league: "League",
  division_conference: "Division / Conference",
  bracket: "Bracket",
  circuit: "Circuit",
};

const STATUS_ACCENT_CLASSES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  completed: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  archived: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export default function MyLeaguePage() {
  usePageTitle({ title: "MyLeague" });
  const router = useRouter();
  const [showCreator, setShowCreator] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const { data: leagues, isLoading } = api.sports.getLeagues.useQuery({});
  const { data: canonicalLeagues } = api.sports.getLeagues.useQuery({ isCanonical: true });

  // 1. Identify primary featured league
  const featuredLeague = useMemo(() => {
    if (canonicalLeagues && canonicalLeagues.length > 0) {
      return canonicalLeagues[0];
    }
    if (leagues && leagues.length > 0) {
      return leagues[0];
    }
    return null;
  }, [canonicalLeagues, leagues]);

  // 2. Filter leagues for the grid (excluding the one in the hero)
  const filteredLeagues = useMemo(() => {
    if (!leagues) return [];
    return leagues.filter((league) => {
      // Exclude the hero league so we don't duplicate it
      if (featuredLeague && league.id === featuredLeague.id) return false;

      const matchesSearch =
        league.name.toLowerCase().includes(search.toLowerCase()) ||
        (league.sportPreset && league.sportPreset.toLowerCase().includes(search.toLowerCase()));

      const matchesSport = selectedSport === "all" || league.sportPreset === selectedSport;
      const matchesStatus = selectedStatus === "all" || league.status === selectedStatus;

      return matchesSearch && matchesSport && matchesStatus;
    });
  }, [leagues, featuredLeague, search, selectedSport, selectedStatus]);

  const sportsList = useMemo(() => {
    const list = new Set<string>();
    leagues?.forEach((l) => {
      if (l.sportPreset) list.add(l.sportPreset);
    });
    return Array.from(list);
  }, [leagues]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Dynamic Stepper Creator */}
      <LeagueCreator open={showCreator} onOpenChange={setShowCreator} />

      {/* ─── HEADER ─── */}
      <div className="facet-surface border-border/40 mb-8 flex flex-col gap-4 rounded-2xl border p-6 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-3xl font-black tracking-tight">
            MyLeague
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create, simulate, and manage sports leagues with full club operations.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(withBasePath("/myclub"))}
            className="border-border hover:bg-muted/40 font-semibold transition"
          >
            <Users className="mr-2 h-4 w-4 text-cyan-500" />
            MyClub
          </Button>
          <Button
            onClick={() => setShowCreator(true)}
            className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold shadow-md transition"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create League
          </Button>
        </div>
      </div>

      {/* ─── FEATURED HERO SECTION ─── */}
      {featuredLeague && (
        <section className="mb-10">
          <h2 className="text-muted-foreground/60 mb-3 flex items-center gap-1.5 px-1 text-xs font-black tracking-widest uppercase">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Featured Association
          </h2>
          <FacetCard
            depth={3}
            className="border-border/40 group relative overflow-hidden rounded-2xl border p-0 shadow-2xl transition-all duration-300"
          >
            {/* Background Cover Image */}
            <div className="absolute inset-0 z-0">
              <LeagueCover
                sportPreset={featuredLeague.sportPreset}
                coverImage={(featuredLeague as any).coverImage}
                alt=""
                className="h-full w-full object-cover opacity-25 blur-[1px] transition-transform duration-700 group-hover:scale-105"
              />
              <div className="from-background via-background/60 absolute inset-0 bg-gradient-to-t to-transparent" />
            </div>

            <div className="relative z-10 flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-end md:p-8">
              <div className="max-w-2xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-amber-500/30 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-400 uppercase">
                    Featured
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-border bg-background/50 text-muted-foreground text-[10px] font-bold uppercase"
                  >
                    {SPORT_LABELS[featuredLeague.sportPreset] || featuredLeague.sportPreset}
                  </Badge>
                </div>
                <h3 className="text-foreground text-3xl font-extrabold tracking-tight md:text-4xl">
                  {featuredLeague.name}
                </h3>
                <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
                  Dive into our premier {SPORT_LABELS[featuredLeague.sportPreset]} system. Build
                  custom franchises, trade players, draft rookies, and experience full simulation
                  matchups.
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="text-muted-foreground bg-muted/20 border-border/40 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                    <Users className="h-3.5 w-3.5 text-cyan-400" />
                    <span>{featuredLeague.teamCount} Franchises</span>
                  </div>
                  <div className="text-muted-foreground bg-muted/20 border-border/40 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                    <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{featuredLeague.seasonCount} Seasons</span>
                  </div>
                  <div className="text-muted-foreground bg-muted/20 border-border/40 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                    <Layers className="h-3.5 w-3.5 text-indigo-400" />
                    <span>
                      {ARCHETYPE_LABELS[featuredLeague.archetype] || featuredLeague.archetype}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => router.push(withBasePath(`/myleague/${featuredLeague.id}`))}
                className="bg-foreground text-background hover:bg-foreground/90 group/btn flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-5 font-bold shadow-lg transition hover:shadow-xl md:w-auto"
              >
                <span>Enter League</span>
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className="inline-block"
                >
                  →
                </motion.span>
              </Button>
            </div>
          </FacetCard>
        </section>
      )}

      {/* ─── FILTERS & GRID ─── */}
      <section className="space-y-6">
        <div className="border-border/30 flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Sport preset tabs */}
          <div className="flex max-w-full flex-wrap gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedSport("all")}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition outline-none select-none",
                selectedSport === "all"
                  ? "bg-foreground text-background border-foreground shadow"
                  : "bg-muted/10 border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              All Sports
            </button>
            {sportsList.map((sport) => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition outline-none select-none",
                  selectedSport === sport
                    ? "bg-foreground text-background border-foreground shadow"
                    : "bg-muted/10 border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <span>{SPORT_LABELS[sport] || sport}</span>
              </button>
            ))}
          </div>

          {/* Search and status drop down */}
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Search leagues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-border/60 bg-muted/20 hover:bg-muted/30 focus-visible:bg-background/80 placeholder:text-muted-foreground/60 h-9 rounded-xl ps-9 text-xs transition focus-visible:ring-1"
              />
            </div>

            <div className="relative">
              <SlidersHorizontal className="text-muted-foreground absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border-border/60 bg-muted/20 hover:bg-muted/30 text-foreground focus-visible:ring-ring h-9 cursor-pointer appearance-none rounded-xl border py-0 ps-9 pe-8 text-xs font-semibold transition-colors outline-none focus-visible:ring-1"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundPosition: `right 8px center`,
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

        {/* League Grid Content */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card
                key={i}
                className="facet-hierarchy-child bg-muted/10 border-border/40 animate-pulse overflow-hidden rounded-2xl p-1"
              >
                <CardHeader className="pb-3">
                  <Skeleton className="h-6 w-3/4 rounded-lg" />
                  <Skeleton className="mt-2 h-4 w-1/2 rounded-md" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-20 w-full rounded-xl" />
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
                  getSportColors(league.sportPreset as SportPresetKey).accentColor || "#3b82f6";
                const isUserOwned = !league.isCanonical; // True if created by user

                return (
                  <motion.div
                    key={league.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FacetCard
                      depth={1}
                      interactive="hover"
                      className="group border-border/40 bg-card/60 flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border backdrop-blur-md"
                      style={{
                        borderColor: `${sportColor}15`,
                      }}
                    >
                      {/* Image header */}
                      <div className="bg-muted relative h-36 overflow-hidden">
                        <LeagueCover
                          sportPreset={league.sportPreset}
                          coverImage={(league as any).coverImage || (league as any).logo}
                          alt={league.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="from-card via-card/40 absolute inset-0 bg-gradient-to-t to-transparent" />

                        {/* Top corner indicators */}
                        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
                          <Badge className="rounded border border-white/10 bg-black/60 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase backdrop-blur-md">
                            {SPORT_LABELS[league.sportPreset] || league.sportPreset}
                          </Badge>
                          <Badge
                            className={cn(
                              "rounded border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase shadow-sm",
                              STATUS_ACCENT_CLASSES[league.status] ??
                                "border-border text-muted-foreground"
                            )}
                          >
                            {league.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Content details */}
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <span className="text-muted-foreground/80 text-[10px] font-bold tracking-wider uppercase">
                              {ARCHETYPE_LABELS[league.archetype] || league.archetype}
                            </span>
                            {isUserOwned && (
                              <>
                                <span className="text-muted-foreground/30 text-[9px]">•</span>
                                <Badge
                                  variant="outline"
                                  className="rounded border-cyan-500/20 bg-cyan-500/5 px-1.5 py-0 text-[8px] font-semibold text-cyan-400"
                                >
                                  Custom
                                </Badge>
                              </>
                            )}
                          </div>
                          <h4 className="text-foreground group-hover:text-primary line-clamp-1 text-lg leading-snug font-bold transition-colors">
                            {league.name}
                          </h4>
                          <div className="text-muted-foreground mt-4 grid grid-cols-2 gap-2 text-[10px] font-bold tracking-wide uppercase">
                            <div className="bg-muted/30 border-border/20 flex flex-col justify-center rounded-lg border p-2">
                              <span className="text-[8px] opacity-60">Teams</span>
                              <span className="text-foreground mt-0.5 text-xs">
                                {league.teamCount}
                              </span>
                            </div>
                            <div className="bg-muted/30 border-border/20 flex flex-col justify-center rounded-lg border p-2">
                              <span className="text-[8px] opacity-60">Seasons</span>
                              <span className="text-foreground mt-0.5 text-xs">
                                {league.seasonCount}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => router.push(withBasePath(`/myleague/${league.id}`))}
                          className="border-border hover:bg-muted/40 text-foreground mt-4 h-9 w-full cursor-pointer rounded-xl border text-xs font-semibold transition-all"
                          variant="ghost"
                        >
                          Enter League
                        </Button>
                      </div>
                    </FacetCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        ) : (
          <FacetCard depth={1} className="border-border/40 bg-card/60 rounded-2xl backdrop-blur-md">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Trophy className="text-muted-foreground/35 mb-4 h-14 w-14" />
              <h3 className="text-foreground text-lg font-bold">No leagues found</h3>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                Try adjusting your search query, selecting a different sport tab, or create a brand
                new league.
              </p>
              <Button className="mt-5 font-semibold" onClick={() => setShowCreator(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create League
              </Button>
            </CardContent>
          </FacetCard>
        )}
      </section>
    </div>
  );
}
