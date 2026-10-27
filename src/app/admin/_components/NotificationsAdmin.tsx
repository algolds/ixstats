"use client";
// src/app/admin/_components/NotificationsAdmin.tsx

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { NumberedListLeft as ListTree, ScanQrCode as ScanEye, Send } from "iconoir-react";
import {
  EventsRegistryPanel,
  NotificationBrowser,
  NotificationComposer,
  AlertRulesPanel,
  TestSuitePanel,
} from "../notifications/_components";

export function NotificationsAdmin() {
  usePageTitle({ title: "Admin - Notification Settings" });
  const [activeTab, setActiveTab] = useState("rules");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification settings"
        subtitle="Hooks, alert rules, message logs and test triggers."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-fill-3 rounded-row mb-4 flex w-full flex-wrap justify-start gap-1 p-1 sm:w-auto">
          <TabsTrigger
            value="rules"
            className="rounded-control text-caption flex items-center gap-2 px-3 py-2"
          >
            <ListTree className="h-3.5 w-3.5" />
            Rules & event hooks
          </TabsTrigger>
          <TabsTrigger
            value="log"
            className="rounded-control text-caption flex items-center gap-2 px-3 py-2"
          >
            <ScanEye className="h-3.5 w-3.5" />
            Logs & inbox
          </TabsTrigger>
          <TabsTrigger
            value="testing"
            className="rounded-control text-caption flex items-center gap-2 px-3 py-2"
          >
            <Send className="h-3.5 w-3.5" />
            Testing & composition
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6 outline-none">
          {activeTab === "rules" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-fast space-y-6">
              <AlertRulesPanel />
              <EventsRegistryPanel />
            </div>
          )}
        </TabsContent>

        <TabsContent value="log" className="outline-none">
          {activeTab === "log" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-fast">
              <NotificationBrowser />
            </div>
          )}
        </TabsContent>

        <TabsContent value="testing" className="outline-none">
          {activeTab === "testing" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-fast space-y-6">
              <NotificationComposer />
              <TestSuitePanel />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
