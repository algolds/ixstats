"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { PlusCircle, Settings } from "iconoir-react";
import { PollComposer } from "./_components/PollComposer";
import { PollManager } from "./_components/PollManager";
import { useState } from "react";

export function PollsPanel() {
  usePageTitle({ title: "Admin - Polls" });
  const [activeTab, setActiveTab] = useState("manager");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Polls"
        subtitle="Create global or targeted polls, view results and switch them on or off."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-fill-3 rounded-row mb-4 flex w-full flex-wrap justify-start gap-1 p-1 sm:w-auto">
          <TabsTrigger
            value="manager"
            className="rounded-control text-caption flex items-center gap-2 px-3 py-2"
          >
            <Settings className="h-3.5 w-3.5" />
            Manage polls
          </TabsTrigger>
          <TabsTrigger
            value="composer"
            className="rounded-control text-caption flex items-center gap-2 px-3 py-2"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Create poll
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
