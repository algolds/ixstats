// src/app/admin/realms/RealmsPanel.tsx
// Realms Management Admin Panel
"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Sparks, Globe, Group as Users, Settings } from "iconoir-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { RealmsTab } from "./_components/RealmsTab";
import { RealmUsersTab } from "./_components/RealmUsersTab";
import { WorldConfigsTab } from "./_components/WorldConfigsTab";

interface RealmsPanelProps {
  defaultTab?: "realms" | "worlds" | "users";
}

export function RealmsPanel({ defaultTab = "realms" }: RealmsPanelProps) {
  usePageTitle({ title: "Admin - Realms & World Config" });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Sparks}
        title="Realms & World Settings"
        description="Manage community regions, world instances, climate and wiki parameters, and player access."
      />

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="bg-card/40 border-border/40 flex w-full max-w-lg justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger
            value="realms"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <Globe className="h-4 w-4 text-cyan-400" />
            Realms
          </TabsTrigger>
          <TabsTrigger
            value="worlds"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <Settings className="h-4 w-4 text-amber-400" />
            World Configs
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <Users className="h-4 w-4 text-purple-400" />
            User Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="realms" className="mt-6 focus-visible:outline-none">
          <RealmsTab />
        </TabsContent>

        <TabsContent value="worlds" className="mt-6 focus-visible:outline-none">
          <WorldConfigsTab />
        </TabsContent>

        <TabsContent value="users" className="mt-6 focus-visible:outline-none">
          <RealmUsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RealmsPanel;

