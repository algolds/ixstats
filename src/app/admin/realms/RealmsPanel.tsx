"use client";
// src/app/admin/realms/RealmsPanel.tsx
// Realms Management Admin Panel

import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Globe, Group as Users, CheckCircle } from "iconoir-react";
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
      <PageHeader title="Realms" subtitle="Nation claims and player access." />

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="bg-fill-3 flex w-full max-w-lg justify-start gap-1 rounded-full p-1">
          <TabsTrigger
            value="realms"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Globe className="text-teal h-4 w-4" />
            Realms
          </TabsTrigger>
          <TabsTrigger
            value="claims"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <CheckCircle className="text-yellow h-4 w-4" />
            Claims
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Users className="text-purple h-4 w-4" />
            User access
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
