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
        <TabsList className="grid w-full grid-cols-3 md:w-[600px] bg-muted/20 border border-border/50 rounded-xl p-1">
          <TabsTrigger value="oversight" className="flex items-center gap-1.5 py-2 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
            <Trophy className="h-4 w-4" />
            Oversight Dashboard
          </TabsTrigger>
          <TabsTrigger value="sandbox" className="flex items-center gap-1.5 py-2 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
            <FlaskConical className="h-4 w-4" />
            Simulation Sandbox
          </TabsTrigger>
          <TabsTrigger value="seeder" className="flex items-center gap-1.5 py-2 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
            <Database className="h-4 w-4" />
            Data Lab & Seeder
          </TabsTrigger>
        </TabsList>

        <TabsContent value="oversight" className="focus-visible:outline-none focus-visible:ring-0">
          <SportsOversightPanel />
        </TabsContent>

        <TabsContent value="sandbox" className="focus-visible:outline-none focus-visible:ring-0">
          <SportsLabsPanel />
        </TabsContent>

        <TabsContent value="seeder" className="focus-visible:outline-none focus-visible:ring-0">
          <SportsSeederPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
