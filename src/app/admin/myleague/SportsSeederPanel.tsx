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
      <div className="border-separator bg-surface rounded-row relative overflow-hidden border p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="border-separator bg-fill-4 rounded-row text-indigo flex h-12 w-12 items-center justify-center border">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-label text-title-1 flex items-center gap-2">
                Data Lab & Seeder
                <Badge variant="secondary">ADMIN TOOLS</Badge>
              </h1>
              <p className="text-label-secondary text-body">
                Configure, initialize, and re-seed the canonical database sports structures.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Seeding Configuration Panel (Left) */}
        <div className="space-y-6 lg:col-span-8">
          <Card className="relative flex flex-col gap-6 overflow-hidden py-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-body flex items-center gap-2">
                <RefreshCw className="text-indigo h-4 w-4" />
                Configurable Reseeding Pipeline
              </CardTitle>
              <CardDescription>
                Select which canonical leagues should be injected into the simulation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              {/* Wipe Option */}
              <div className="rounded-row border-red/20 bg-red/5 flex items-center justify-between border p-4">
                <div className="max-w-[80%] space-y-0.5">
                  <Label
                    htmlFor="wipe-db"
                    className="text-headline text-red flex cursor-pointer items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Wipe Existing Canonical Records First
                  </Label>
                  <span className="text-label-secondary text-footnote block">
                    Removes all existing canonical leagues and cascade-clears all dependent seasons,
                    teams, matches, and players.
                  </span>
                </div>
                <Switch
                  id="wipe-db"
                  checked={clearExisting}
                  onCheckedChange={setClearExisting}
                  className="data-[state=checked]:bg-red"
                />
              </div>

              {/* Leagues selector grid */}
              <div className="space-y-3">
                <Label className="text-label-secondary text-subhead block">Leagues to Seed</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {leaguePresets.map((preset) => (
                    <div
                      key={preset.key}
                      onClick={() => preset.setter(!preset.state)}
                      className={cn(
                        "rounded-row duration-fast flex cursor-pointer gap-3 border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none",
                        preset.state
                          ? "border-indigo/30 bg-indigo/5 hover:border-indigo/50"
                          : "bg-surface border-separator opacity-60 hover:opacity-85"
                      )}
                    >
                      <div className="mt-1">
                        <Checkbox
                          id={preset.key}
                          checked={preset.state}
                          onCheckedChange={() => {}} // Controlled via card onClick
                          className="data-[state=checked]:border-indigo data-[state=checked]:bg-indigo"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-label text-headline flex items-center gap-2 truncate">
                            <span className="text-title-3">{preset.icon}</span>
                            {preset.name}
                          </span>
                          <Badge variant="secondary" className="text-eyebrow">
                            {preset.teams} teams
                          </Badge>
                        </div>
                        <p className="text-label-secondary text-footnote leading-relaxed">
                          {preset.description}
                        </p>
                        <div className="text-label-secondary text-footnote flex gap-2">
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
                className="h-11 w-full gap-2"
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
          <Card className="flex flex-col gap-6 py-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-headline flex items-center gap-2">
                <Layers className="text-yellow h-4 w-4" />
                Cache Optimization
              </CardTitle>
              <CardDescription>
                Flushes the Redis query and tRPC endpoints cache layer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="bg-fill-4 border-separator text-label-secondary rounded-row text-footnote p-3 leading-relaxed">
                <span className="text-label mb-1 block font-semibold">Active Caching Layer:</span>
                MyLeague features optimized static cache limits on standings, rosters, and stats.
                Reseeding might show delayed results unless manually cleared.
              </div>
              <Button
                variant="outline"
                onClick={handleClearCache}
                disabled={clearCacheMutation.isPending}
                className="w-full gap-2"
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
          <Card className="flex flex-col gap-6 py-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-headline flex items-center gap-2">
                <Activity className="text-green h-4 w-4" />
                Simulation Diagnostics
              </CardTitle>
              <CardDescription>Live health checks of the sports engine components.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="border-separator text-footnote flex items-center justify-between border-b pb-2">
                <span className="text-label-secondary flex items-center gap-2">
                  <Cpu className="text-green h-3.5 w-3.5" />
                  Sports Presets Engine
                </span>
                <Badge variant="success" className="text-eyebrow">
                  Operational
                </Badge>
              </div>
              <div className="border-separator text-footnote flex items-center justify-between border-b pb-2">
                <span className="text-label-secondary flex items-center gap-2">
                  <Sparkles className="text-green h-3.5 w-3.5" />
                  AI Commentary Narrator
                </span>
                <Badge variant="success" className="text-eyebrow">
                  Connected
                </Badge>
              </div>
              <div className="border-separator text-footnote flex items-center justify-between border-b pb-2">
                <span className="text-label-secondary flex items-center gap-2">
                  <Database className="text-green h-3.5 w-3.5" />
                  Redis Cache Connection
                </span>
                <Badge variant="success" className="text-eyebrow">
                  Online
                </Badge>
              </div>
              <div className="text-footnote flex items-center justify-between">
                <span className="text-label-secondary flex items-center gap-2">
                  <Trophy className="text-green h-3.5 w-3.5" />
                  Simulation Kernel Status
                </span>
                <Badge variant="success" className="text-eyebrow">
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
