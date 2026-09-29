"use client";
// src/app/admin/realms/RealmsPanel.tsx
// Realms Management Admin Panel

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Sparks, Globe, Group as Users, CheckCircle } from "iconoir-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { RealmsTab } from "./_components/RealmsTab";
import { RealmUsersTab } from "./_components/RealmUsersTab";
import { ClaimsTab } from "./_components/ClaimsTab";

interface RealmsPanelProps {
  defaultTab?: "realms" | "claims" | "users";
}

export function RealmsPanel({ defaultTab = "realms" }: RealmsPanelProps) {
  usePageTitle({ title: "Admin - Realms" });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Sparks}
        title="Realms"
        description="Realms, nation claims and player access."
      />

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="bg-card/40 border-border/40 flex w-full max-w-lg justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger
            value="realms"
            className="flex flex-1 items-center justify-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Globe className="h-4 w-4 text-cyan-400" />
            Realms
          </TabsTrigger>
          <TabsTrigger
            value="claims"
            className="flex flex-1 items-center justify-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <CheckCircle className="h-4 w-4 text-amber-400" />
            Claims
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="flex flex-1 items-center justify-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Users className="h-4 w-4 text-purple-400" />
            User Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="realms" className="mt-6 focus-visible:outline-none">
          <RealmsTab />
        </TabsContent>

        <TabsContent value="claims" className="mt-6 focus-visible:outline-none">
          <ClaimsTab />
        </TabsContent>

        <TabsContent value="users" className="mt-6 focus-visible:outline-none">
          <RealmUsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RealmsPanel;
