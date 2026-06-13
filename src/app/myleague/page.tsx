"use client";
 
import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
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
  Flame,
  Calendar,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LeagueCreator } from "~/components/myleague/LeagueCreator";
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

const SPORT_EMOJIS: Record<string, string> = {
  soccer: "⚽",
  football: "🏈",
  hockey: "🏒",
  basketball: "🏀",
  baseball: "⚾",
  f1: "🏎️",
  boxing: "🥊",
};

const SPORT_FALLBACK_IMAGES: Record<string, string> = {
  soccer: "/api/mediawiki/commons/Special:Filepath/Stade_V%C3%A9lodrome_interior_2018.jpg",
  football: "/api/mediawiki/commons/Special:Filepath/Maracana_Stadium.jpg",
  hockey: "/api/mediawiki/commons/Special:Filepath/Bell_Centre_interior_view.jpg",
  basketball: "/api/mediawiki/commons/Special:Filepath/Madison_Square_Garden_interior.jpg",
  baseball: "/api/mediawiki/commons/Special:Filepath/Scotiabank_Saddledome.jpg",
  f1: "/api/mediawiki/commons/Special:Filepath/Monaco_Grand_Prix_stretching_past_the_harbour_in_Monte_Carlo%2C_Monaco.jpg",
  boxing: "/api/mediawiki/commons/Special:Filepath/2021_CISM_Military_World_Games_Boxing.jpg",
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

      const matchesSearch = league.name.toLowerCase().includes(search.toLowerCase()) || 
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
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Dynamic Stepper Creator */}
      <LeagueCreator open={showCreator} onOpenChange={setShowCreator} />

      {/* ─── HEADER ─── */}
      <div className="facet-surface border-border/40 mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border p-6 backdrop-blur-md">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">MyLeague</h1>
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
          <h2 className="text-xs font-black tracking-widest text-muted-foreground/60 uppercase mb-3 px-1 flex items-center gap-1.5">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Featured Association
          </h2>
          <FacetCard
            depth={3}
            className="relative overflow-hidden rounded-2xl border border-border/40 p-0 shadow-2xl group transition-all duration-300"
          >
            {/* Background Cover Image */}
            <div className="absolute inset-0 z-0">
              <img
                src={withBasePath(
                  (featuredLeague as any).coverImage ||
                  SPORT_FALLBACK_IMAGES[featuredLeague.sportPreset] ||
                  "/api/mediawiki/commons/Special:Filepath/Stade_V%C3%A9lodrome_interior_2018.jpg"
                )}
                alt=""
                className="h-full w-full object-cover opacity-25 blur-[1px] transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            </div>

            <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold px-2.5 py-0.5 text-[10px] tracking-wide uppercase">
                    Featured
                  </Badge>
                  <Badge variant="outline" className="border-border bg-background/50 text-muted-foreground text-[10px] uppercase font-bold">
                    {SPORT_LABELS[featuredLeague.sportPreset] || featuredLeague.sportPreset}
                  </Badge>
                </div>
                <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                  {featuredLeague.name}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                  Dive into our premier {SPORT_LABELS[featuredLeague.sportPreset]} system. Build custom franchises, trade players, draft rookies, and experience full simulation matchups.
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/20 border border-border/40 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                    <Users className="h-3.5 w-3.5 text-cyan-400" />
                    <span>{featuredLeague.teamCount} Franchises</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/20 border border-border/40 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                    <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{featuredLeague.seasonCount} Seasons</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/20 border border-border/40 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                    <Layers className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{ARCHETYPE_LABELS[featuredLeague.archetype] || featuredLeague.archetype}</span>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => router.push(withBasePath(`/myleague/${featuredLeague.id}`))}
                className="w-full md:w-auto bg-foreground text-background hover:bg-foreground/90 font-bold px-6 py-5 rounded-xl shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2 group/btn shrink-0"
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border/30 pb-4">
          {/* Sport preset tabs */}
          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setSelectedSport("all")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border select-none outline-none cursor-pointer",
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
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border select-none outline-none cursor-pointer",
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
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search leagues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9 border-border/60 bg-muted/20 hover:bg-muted/30 focus-visible:bg-background/80 focus-visible:ring-1 h-9 rounded-xl text-xs placeholder:text-muted-foreground/60 transition"
              />
            </div>
            
            <div className="relative">
              <SlidersHorizontal className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="ps-9 pe-8 py-0 border border-border/60 bg-muted/20 hover:bg-muted/30 rounded-xl text-xs h-9 font-semibold text-foreground focus-visible:ring-1 focus-visible:ring-ring outline-none cursor-pointer appearance-none transition-colors"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundPosition: `right 8px center`,
                  backgroundSize: `14px`,
                  backgroundRepeat: `no-repeat`
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
              <Card key={i} className="facet-hierarchy-child bg-muted/10 border-border/40 rounded-2xl p-1 overflow-hidden animate-pulse">
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
          <motion.div 
            layout
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence mode="popLayout">
              {filteredLeagues.map((league) => {
                const sportColor = getSportColors(league.sportPreset as SportPresetKey)?.primary || "#3b82f6";
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
                      className="group border border-border/40 overflow-hidden rounded-2xl flex flex-col justify-between h-full bg-card/60 backdrop-blur-md cursor-pointer"
                      style={{
                        borderColor: `${sportColor}15`
                      }}
                    >
                      {/* Image header */}
                      <div className="relative h-36 overflow-hidden bg-muted">
                        <img
                          src={withBasePath(
                            (league as any).coverImage ||
                            (league as any).logo ||
                            SPORT_FALLBACK_IMAGES[league.sportPreset] ||
                            "/api/mediawiki/commons/Special:Filepath/Stadion_Luzhniki_Moskva_July_2018.jpg"
                          )}
                          alt={league.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                        
                        {/* Top corner indicators */}
                        <div className="absolute top-3 inset-x-3 flex justify-between items-start">
                          <Badge className="bg-black/60 border border-white/10 text-white font-bold text-[9px] px-2 py-0.5 rounded backdrop-blur-md uppercase tracking-wider">
                            {SPORT_LABELS[league.sportPreset] || league.sportPreset}
                          </Badge>
                          <Badge className={cn("border font-bold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider shadow-sm", STATUS_ACCENT_CLASSES[league.status] ?? "border-border text-muted-foreground")}>
                            {league.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Content details */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider">
                              {ARCHETYPE_LABELS[league.archetype] || league.archetype}
                            </span>
                            {isUserOwned && (
                              <>
                                <span className="text-muted-foreground/30 text-[9px]">•</span>
                                <Badge variant="outline" className="text-[8px] font-semibold border-cyan-500/20 bg-cyan-500/5 text-cyan-400 px-1.5 py-0 rounded">
                                  Custom
                                </Badge>
                              </>
                            )}
                          </div>
                          <h4 className="text-lg font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1">
                            {league.name}
                          </h4>
                          <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                            <div className="bg-muted/30 border border-border/20 rounded-lg p-2 flex flex-col justify-center">
                              <span className="opacity-60 text-[8px]">Teams</span>
                              <span className="text-xs text-foreground mt-0.5">{league.teamCount}</span>
                            </div>
                            <div className="bg-muted/30 border border-border/20 rounded-lg p-2 flex flex-col justify-center">
                              <span className="opacity-60 text-[8px]">Seasons</span>
                              <span className="text-xs text-foreground mt-0.5">{league.seasonCount}</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => router.push(withBasePath(`/myleague/${league.id}`)) }
                          className="mt-4 w-full border border-border hover:bg-muted/40 text-foreground text-xs font-semibold rounded-xl h-9 transition-all cursor-pointer"
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
          <FacetCard depth={1} className="border-border/40 bg-card/60 backdrop-blur-md rounded-2xl">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Trophy className="text-muted-foreground/35 mb-4 h-14 w-14" />
              <h3 className="text-lg font-bold text-foreground">No leagues found</h3>
              <p className="text-muted-foreground max-w-sm mt-1 text-sm">
                Try adjusting your search query, selecting a different sport tab, or create a brand new league.
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
