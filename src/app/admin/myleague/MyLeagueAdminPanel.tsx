"use client";
// src/app/admin/myleague/MyLeagueAdminPanel.tsx
// Unified MyLeague Sports Management Admin Panel

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AdminHeader } from "../_components/AdminHeader";
import { Trophy, Flask as FlaskConical, Database } from "iconoir-react";
import SportsOversightPanel from "./SportsOversightPanel";
import SportsLabsPanel from "./SportsLabsPanel";
import SportsSeederPanel from "./SportsSeederPanel";

export default function MyLeagueAdminPanel() {
  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Trophy}
        title="MyLeague Sports & Simulation"
        description="Comprehensive control center for canonical sports competitions. Configure presets, run sandboxed simulations, and seed simulation databases."
      />

      <Tabs defaultValue="oversight" className="w-full space-y-6">
        <TabsList className="bg-card/40 border-border/40 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md md:w-auto">
          <TabsTrigger
            value="oversight"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Trophy className="h-4 w-4 text-emerald-400" />
            Oversight Dashboard
          </TabsTrigger>
          <TabsTrigger
            value="sandbox"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <FlaskConical className="h-4 w-4 text-amber-400" />
            Simulation Sandbox
          </TabsTrigger>
          <TabsTrigger
            value="seeder"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Database className="h-4 w-4 text-cyan-400" />
            Data Lab & Seeder
          </TabsTrigger>
        </TabsList>

        <TabsContent value="oversight" className="focus-visible:outline-none">
          <SportsOversightPanel />
        </TabsContent>

        <TabsContent value="sandbox" className="focus-visible:outline-none">
          <SportsLabsPanel />
        </TabsContent>

        <TabsContent value="seeder" className="focus-visible:outline-none">
          <SportsSeederPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
