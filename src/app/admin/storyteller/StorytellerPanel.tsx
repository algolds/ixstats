// src/app/admin/storyteller/page.tsx
// Storyteller hub - tabbed interface for world events, timeline, sandbox
"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { EventWizard } from "./_components/EventWizard";
import { WorldTimeline } from "./_components/WorldTimeline";
import { ActiveInterventions } from "./_components/ActiveInterventions";
import { StorytellerHistory } from "./_components/StorytellerHistory";
import { SandboxMode } from "./_components/SandboxMode";
import {
  Gamepad as Gamepad2,
  MagicWand as Wand2,
  Clock,
  Flash as Zap,
  ClockRotateRight as History,
  Flask as FlaskConical,
} from "iconoir-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

type StorytellerTab = "wizard" | "timeline" | "interventions" | "sandbox" | "history";

const TABS: { id: StorytellerTab; label: string; icon: typeof Wand2 }[] = [
  { id: "wizard", label: "Event Wizard", icon: Wand2 },
  { id: "timeline", label: "World Timeline", icon: Clock },
  { id: "interventions", label: "Interventions", icon: Zap },
  { id: "sandbox", label: "Sandbox", icon: FlaskConical },
  { id: "history", label: "History", icon: History },
];

export function StorytellerPanel() {
  usePageTitle({ title: "Admin - Storyteller" });
  const [activeTab, setActiveTab] = useState<StorytellerTab>("wizard");

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Gamepad2}
        title="Storyteller™ Control Panel"
        description="World events, narrative tools, interventions, and simulation"
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as StorytellerTab)}
        className="w-full"
      >
        <TabsList className="bg-card/40 border-border/40 mb-4 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.98]"
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="wizard" className="mt-4 focus-visible:outline-none">
          <EventWizard />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4 focus-visible:outline-none">
          <WorldTimeline />
        </TabsContent>
        <TabsContent value="interventions" className="mt-4 focus-visible:outline-none">
          <ActiveInterventions />
        </TabsContent>
        <TabsContent value="sandbox" className="mt-4 focus-visible:outline-none">
          <SandboxMode />
        </TabsContent>
        <TabsContent value="history" className="mt-4 focus-visible:outline-none">
          <StorytellerHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default StorytellerPanel;
