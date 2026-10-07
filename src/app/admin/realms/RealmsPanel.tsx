"use client";
// src/app/admin/realms/RealmsPanel.tsx
// Realms Management Admin Panel

import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Book, Globe, Group as Users, CheckCircle, Refresh } from "iconoir-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { RealmsTab } from "./_components/RealmsTab";
import { RealmUsersTab } from "./_components/RealmUsersTab";
import { ClaimsTab } from "./_components/ClaimsTab";
import { SourceSyncTab } from "./_components/source-sync/SourceSyncTab";
import { WikiTab } from "./_components/wiki/WikiTab";

interface RealmsPanelProps {
  defaultTab?: "realms" | "claims" | "users" | "source-sync" | "wiki";
}

export function RealmsPanel({ defaultTab = "realms" }: RealmsPanelProps) {
  usePageTitle({ title: "Admin - Realms" });

  return (
    <div className="space-y-6">
      <PageHeader title="Realms" subtitle="Nation claims, player access, source sync and realm wikis." />

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="bg-fill-3 flex w-full max-w-2xl justify-start gap-1 rounded-full p-1">
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
          <TabsTrigger
            value="source-sync"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Refresh className="text-blue h-4 w-4" />
            Source sync
          </TabsTrigger>
          <TabsTrigger
            value="wiki"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Book className="text-green h-4 w-4" />
            Wiki
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

        <TabsContent value="source-sync" className="mt-6 focus-visible:outline-none">
          <SourceSyncTab />
        </TabsContent>

        <TabsContent value="wiki" className="mt-6 focus-visible:outline-none">
          <WikiTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
