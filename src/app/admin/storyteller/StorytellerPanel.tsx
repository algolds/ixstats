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
import { Gamepad2, Wand2, Clock, Zap, History, FlaskConical } from "lucide-react";

type StorytellerTab = "wizard" | "timeline" | "interventions" | "sandbox" | "history";

const TABS: { id: StorytellerTab; label: string; icon: typeof Wand2 }[] = [
  { id: "wizard", label: "Event Wizard", icon: Wand2 },
  { id: "timeline", label: "World Timeline", icon: Clock },
  { id: "interventions", label: "Interventions", icon: Zap },
  { id: "sandbox", label: "Sandbox", icon: FlaskConical },
  { id: "history", label: "History", icon: History },
];

export default function StorytellerPage() {
  usePageTitle({ title: "Admin - Storyteller" });
  const [activeTab, setActiveTab] = useState<StorytellerTab>("wizard");

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Gamepad2}
        title="Storyteller™ Control Panel"
        description="World events, narrative tools, interventions, and simulation"
      />

      {/* Tab Navigation */}
      <div className="glass-surface border-border/40 flex gap-1.5 overflow-x-auto rounded-xl p-1.5 shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-card text-foreground border-border/30 border shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="glass-surface border-border/40 rounded-xl p-6 shadow-sm">
        {activeTab === "wizard" && <EventWizard />}
        {activeTab === "timeline" && <WorldTimeline />}
        {activeTab === "interventions" && <ActiveInterventions />}
        {activeTab === "sandbox" && <SandboxMode />}
        {activeTab === "history" && <StorytellerHistory />}
      </div>
    </div>
  );
}
