"use client";
// src/app/admin/_components/NotificationsAdmin.tsx

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./AdminHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Bell, NumberedListLeft as ListTree, ScanQrCode as ScanEye, Send } from "iconoir-react";
import {
  EventsRegistryPanel,
  NotificationBrowser,
  NotificationComposer,
  AlertRulesPanel,
  TestSuitePanel,
} from "../notifications/_components";
import { NotificationTestCard } from "./platform/NotificationTestCard";

export function NotificationsAdmin() {
  usePageTitle({ title: "Admin - Notification Settings" });
  const [activeTab, setActiveTab] = useState("rules");

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Bell}
        title="Notification Settings"
        description="Notification hooks, alert rules, message logs, and test triggers."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card/40 border-border/40 mb-4 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md sm:w-auto">
          <TabsTrigger
            value="rules"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <ListTree className="h-3.5 w-3.5" />
            Rules & Event Hooks
          </TabsTrigger>
          <TabsTrigger
            value="log"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <ScanEye className="h-3.5 w-3.5" />
            Logs & Inbox
          </TabsTrigger>
          <TabsTrigger
            value="testing"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Send className="h-3.5 w-3.5" />
            Testing & Composition
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6 outline-none">
          {activeTab === "rules" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
              <AlertRulesPanel />
              <EventsRegistryPanel />
            </div>
          )}
        </TabsContent>

        <TabsContent value="log" className="outline-none">
          {activeTab === "log" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <NotificationBrowser />
            </div>
          )}
        </TabsContent>

        <TabsContent value="testing" className="outline-none">
          {activeTab === "testing" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <NotificationComposer />
                <NotificationTestCard />
              </div>
              <TestSuitePanel />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
