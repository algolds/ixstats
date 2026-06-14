"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
// eslint-disable-next-line unused-imports/no-unused-imports
import { AdminSidebarLayout } from "../_components/AdminSidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Vote, PlusCircle, Settings } from "lucide-react";
import { PollComposer } from "./_components/PollComposer";
import { PollManager } from "./_components/PollManager";
import { useState } from "react";

export default function PollsAdminPage() {
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
        <TabsList className="bg-card/40 border-border/40 mb-4 w-full justify-start rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger value="manager" className="gap-2 rounded-lg text-xs font-semibold">
            <Settings className="h-4 w-4" />
            Manage Polls
          </TabsTrigger>
          <TabsTrigger value="composer" className="gap-2 rounded-lg text-xs font-semibold">
            <PlusCircle className="h-4 w-4" />
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
