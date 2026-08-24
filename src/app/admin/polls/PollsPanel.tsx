"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { AdminSidebarLayout } from "../_components/AdminSidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CheckSquare as Vote, PlusCircle, Settings } from "iconoir-react";
import { PollComposer } from "./_components/PollComposer";
import { PollManager } from "./_components/PollManager";
import { useState } from "react";

export function PollsPanel() {
  usePageTitle({ title: "Admin - Polls" });
  const [activeTab, setActiveTab] = useState("manager");

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Vote}
        title="Polls Management"
        description="Create and manage global or targeted polls, view results, and toggle active states."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card/40 border-border/40 mb-4 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md sm:w-auto">
          <TabsTrigger value="manager" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold active:scale-[0.98] transition-transform">
            <Settings className="h-3.5 w-3.5" />
            Manage Polls
          </TabsTrigger>
          <TabsTrigger value="composer" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold active:scale-[0.98] transition-transform">
            <PlusCircle className="h-3.5 w-3.5" />
            Create Poll
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manager" className="focus-visible:outline-none">
          {activeTab === "manager" && <PollManager onCreateNew={() => setActiveTab("composer")} />}
        </TabsContent>

        <TabsContent value="composer" className="focus-visible:outline-none">
          {activeTab === "composer" && <PollComposer onSuccess={() => setActiveTab("manager")} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PollsPanel;
