"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AdminHeader } from "../_components/AdminHeader";
import { Trophy, FlaskConical, Database } from "lucide-react";
import SportsOversightPanel from "./SportsOversightPanel";
import SportsLabsPanel from "./SportsLabsPanel";
import SportsSeederPanel from "./SportsSeederPanel";

export default function MyLeagueAdminPanel() {
  return (
    <div className="space-y-6">
      {/* Central Admin Header */}
      <AdminHeader
        icon={Trophy}
        title="MyLeague settings & Labs"
        description="Comprehensive control center for canonical sports competitions. Configure presets, run sandboxed simulations, and seed simulation databases."
      />

      <Tabs defaultValue="oversight" className="w-full space-y-4">
        <TabsList className="bg-muted/20 border-border/50 grid w-full grid-cols-3 rounded-xl border p-1 md:w-[600px]">
          <TabsTrigger
            value="oversight"
            className="flex items-center gap-1.5 rounded-lg py-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white"
          >
            <Trophy className="h-4 w-4" />
            Oversight Dashboard
          </TabsTrigger>
          <TabsTrigger
            value="sandbox"
            className="flex items-center gap-1.5 rounded-lg py-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white"
          >
            <FlaskConical className="h-4 w-4" />
            Simulation Sandbox
          </TabsTrigger>
          <TabsTrigger
            value="seeder"
            className="flex items-center gap-1.5 rounded-lg py-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white"
          >
            <Database className="h-4 w-4" />
            Data Lab & Seeder
          </TabsTrigger>
        </TabsList>

        <TabsContent value="oversight" className="focus-visible:ring-0 focus-visible:outline-none">
          <SportsOversightPanel />
        </TabsContent>

        <TabsContent value="sandbox" className="focus-visible:ring-0 focus-visible:outline-none">
          <SportsLabsPanel />
        </TabsContent>

        <TabsContent value="seeder" className="focus-visible:ring-0 focus-visible:outline-none">
          <SportsSeederPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
