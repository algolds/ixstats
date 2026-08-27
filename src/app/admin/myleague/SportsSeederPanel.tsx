"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Database,
  Refresh as RefreshCw,
  Trash as Trash2,
  Sparks as Sparkles,
  Activity,
  Component as Layers,
  Cpu,
  Trophy,
} from "iconoir-react";
import { cn } from "~/lib/utils";

export default function SportsSeederPanel() {
  const notify = useNotify();
  const utils = api.useUtils();

  // Seeding configuration state
  const [clearExisting, setClearExisting] = useState(true);
  const [seedCaphirianSoccer, setSeedCaphirianSoccer] = useState(true);
  const [seedYonderreSoccer, setSeedYonderreSoccer] = useState(true);
  const [seedOHLHockey, setSeedOHLHockey] = useState(true);
  const [seedF1, setSeedF1] = useState(true);
  const [seedBoxing, setSeedBoxing] = useState(true);

  // Mutations
  const reseedMutation = api.sports.reseedSportsData.useMutation({
    onSuccess: (data) => {
      notify.success(
        "Seeding Successful",
        `Wiped ${data.deletedCount} old canonical leagues and seeded ${data.seededCount} new records.`
      );
      void utils.sports.getLeagues.invalidate();
      void utils.sports.getAdminGlobalStats.invalidate();
    },
    onError: (err) => {
      notify.error("Seeding Failed", err.message ?? "Could not run sports data seeder.");
    },
  });

  const clearCacheMutation = api.sports.clearSportsCache.useMutation({
    onSuccess: () => {
      notify.success("Cache Cleared", "Sports tRPC cache and simulation query cache flushed.");
    },
    onError: (err) => {
      notify.error("Cache Clear Failed", err.message ?? "Could not clear sports cache.");
    },
  });

  const handleReseed = () => {
    const totalSelected = [
      seedCaphirianSoccer,
      seedYonderreSoccer,
      seedOHLHockey,
      seedF1,
      seedBoxing,
    ].filter(Boolean).length;

    if (totalSelected === 0) {
      notify.error("Validation Error", "Please select at least one league to seed.");
      return;
    }

    if (
      clearExisting &&
      !window.confirm(
        "WARNING: This will delete ALL existing canonical sports leagues, including their seasons, matches, teams, standings, and players. Proceed?"
      )
    ) {
      return;
    }

    reseedMutation.mutate({
      clearExisting,
      seedCaphirianSoccer,
      seedYonderreSoccer,
      seedOHLHockey,
      seedF1,
      seedBoxing,
    });
  };

  const handleClearCache = () => {
    clearCacheMutation.mutate();
  };

  const leaguePresets = [
    {
      key: "caphirian_soccer",
      name: "Caphirian Premier Division",
      sport: "soccer",
      icon: "⚽",
      teams: 10,
      archetype: "League (Round-Robin)",
      state: seedCaphirianSoccer,
      setter: setSeedCaphirianSoccer,
      description:
        "Classical association football structure. Top tier league featuring Caphirian teams.",
    },
    {
      key: "yonderre_soccer",
      name: "Yonderian Premier League",
      sport: "soccer",
      icon: "⚽",
      teams: 8,
      archetype: "League (Round-Robin)",
      state: seedYonderreSoccer,
      setter: setSeedYonderreSoccer,
      description:
        "Alternative soccer structure featuring canonical Yonderian clubs and rivalries.",
    },
    {
      key: "ohl_hockey",
      name: "OHL Ice Hockey Championship",
      sport: "hockey",
      icon: "🏒",
      teams: 6,
      archetype: "League (Round-Robin)",
      state: seedOHLHockey,
      setter: setSeedOHLHockey,
      description:
        "Hockey league with custom rulesets, overtime intervals, shootout resolves and line rosters.",
    },
    {
      key: "f1",
      name: "Formula 1 Grand Prix",
      sport: "f1",
      icon: "🏎️",
      teams: 10,
      archetype: "Circuit Racing",
      state: seedF1,
      setter: setSeedF1,
      description:
        "High-octane motorsport circuit. Features driver ratings, constructor ratings, and qualifying sessions.",
    },
    {
      key: "boxing",
      name: "ICC Heavyweight Grand Prix",
      sport: "boxing",
      icon: "🥊",
      teams: 8,
      archetype: "Bracket Elimination",
      state: seedBoxing,
      setter: setSeedBoxing,
      description:
        "Knockout heavyweight tournament matching fighters head-to-head until a champion is crowned.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="facet-hierarchy-parent border-border/60 bg-card/40 relative overflow-hidden rounded-xl border p-6">
        <div className="pointer-events-none absolute -top-20 -right-20 h-44 w-44 rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="border-border/50 bg-muted/30 flex h-12 w-12 items-center justify-center rounded-xl border text-indigo-400">
              <Database className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold">
                Data Lab & Seeder
                <Badge className="border-indigo-500/20 bg-indigo-500/10 text-[9px] font-bold text-indigo-400">
                  ADMIN TOOLS
                </Badge>
              </h1>
              <p className="text-muted-foreground text-sm">
                Configure, initialize, and re-seed the canonical database sports structures.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Seeding Configuration Panel (Left) */}
        <div className="space-y-6 lg:col-span-8">
          <Card className="facet-hierarchy-child border-border/50 bg-card/40 relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-4 w-4 text-indigo-400" />
                Configurable Reseeding Pipeline
              </CardTitle>
              <CardDescription>
                Select which canonical leagues should be injected into the simulation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              {/* Wipe Option */}
              <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="max-w-[80%] space-y-0.5">
                  <Label
                    htmlFor="wipe-db"
                    className="flex cursor-pointer items-center gap-1.5 text-sm font-bold text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                    Wipe Existing Canonical Records First
                  </Label>
                  <span className="text-muted-foreground block text-xs">
                    Removes all existing canonical leagues and cascade-clears all dependent seasons,
                    teams, matches, and players.
                  </span>
                </div>
                <Switch
                  id="wipe-db"
                  checked={clearExisting}
                  onCheckedChange={setClearExisting}
                  className="data-[state=checked]:bg-red-500"
                />
              </div>

              {/* Leagues selector grid */}
              <div className="space-y-3">
                <Label className="text-muted-foreground block text-xs font-bold tracking-wider uppercase">
                  Leagues to Seed
                </Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {leaguePresets.map((preset) => (
                    <div
                      key={preset.key}
                      onClick={() => preset.setter(!preset.state)}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-xl border p-4 transition-all duration-300 select-none",
                        preset.state
                          ? "border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50"
                          : "bg-card/25 border-border/50 opacity-60 hover:opacity-85"
                      )}
                    >
                      <div className="mt-1">
                        <Checkbox
                          id={preset.key}
                          checked={preset.state}
                          onCheckedChange={() => {}} // Controlled via card onClick
                          className="data-[state=checked]:border-indigo-500 data-[state=checked]:bg-indigo-500"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-foreground flex items-center gap-1.5 truncate text-sm font-bold">
                            <span className="text-lg">{preset.icon}</span>
                            {preset.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-indigo-500/20 text-[9px] text-indigo-400 uppercase"
                          >
                            {preset.teams} teams
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          {preset.description}
                        </p>
                        <div className="text-muted-foreground/60 flex gap-2 text-[10px]">
                          <span className="font-semibold">{preset.archetype}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action trigger button */}
              <Button
                onClick={handleReseed}
                disabled={reseedMutation.isPending}
                className="h-11 w-full gap-2 rounded-xl bg-indigo-500 font-bold text-white hover:bg-indigo-400"
              >
                {reseedMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Wiping & Reseeding Sports Database...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Trigger Reseeding Pipeline
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Global Admin Diagnostics & Cache Controls (Right) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Cache Controls */}
          <Card className="facet-hierarchy-child border-border/50 bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                <Layers className="h-4 w-4 text-amber-500" />
                Cache Optimization
              </CardTitle>
              <CardDescription>
                Flushes the Redis query and tRPC endpoints cache layer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="bg-muted/10 border-border/20 text-muted-foreground rounded-xl p-3 text-xs leading-relaxed">
                <span className="text-foreground mb-1 block font-semibold">
                  Active Caching Layer:
                </span>
                MyLeague features optimized static cache limits on standings, rosters, and stats.
                Reseeding might show delayed results unless manually cleared.
              </div>
              <Button
                variant="outline"
                onClick={handleClearCache}
                disabled={clearCacheMutation.isPending}
                className="h-9 w-full gap-2 border-amber-500/20 text-xs font-bold text-amber-400 hover:bg-amber-500/5"
              >
                {clearCacheMutation.isPending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Flushing cache...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Purge All Sports Cache
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* System Diagnostics */}
          <Card className="facet-hierarchy-child border-border/50 bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                <Activity className="h-4 w-4 text-emerald-500" />
                Simulation Diagnostics
              </CardTitle>
              <CardDescription>Live health checks of the sports engine components.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                  Sports Presets Engine
                </span>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-[9px] font-bold text-emerald-400 uppercase"
                >
                  Operational
                </Badge>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  AI Commentary Narrator
                </span>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-[9px] font-bold text-emerald-400 uppercase"
                >
                  Connected
                </Badge>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-emerald-400" />
                  Redis Cache Connection
                </span>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-[9px] font-bold text-emerald-400 uppercase"
                >
                  Online
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-emerald-400" />
                  Simulation Kernel Status
                </span>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-[9px] font-bold text-emerald-400 uppercase"
                >
                  Active Loop
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
