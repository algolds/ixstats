"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Bell, ListTree, ScanEye, Send, SlidersHorizontal, FlaskConical } from "lucide-react";
import {
  EventsRegistryPanel,
  NotificationBrowser,
  NotificationComposer,
  AlertRulesPanel,
  TestSuitePanel,
} from "./_components";

export default function NotificationsAdminPage() {
  usePageTitle({ title: "Admin - Notifications" });
  const [activeTab, setActiveTab] = useState("events");

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Bell}
        title="Notifications & Alerts"
        description="Notification event hooks, logs, alert rules, and system tests"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 w-full justify-start">
          <TabsTrigger value="events">
            <ListTree className="mr-2 h-4 w-4" />
            Event Hooks
          </TabsTrigger>
          <TabsTrigger value="log">
            <ScanEye className="mr-2 h-4 w-4" />
            Notification Log
          </TabsTrigger>
          <TabsTrigger value="compose">
            <Send className="mr-2 h-4 w-4" />
            Create & Send
          </TabsTrigger>
          <TabsTrigger value="rules">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Alert Rules
          </TabsTrigger>
          <TabsTrigger value="tests">
            <FlaskConical className="mr-2 h-4 w-4" />
            Test Suite
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          {activeTab === "events" && <EventsRegistryPanel />}
        </TabsContent>

        <TabsContent value="log">
          {activeTab === "log" && <NotificationBrowser />}
        </TabsContent>

        <TabsContent value="compose">
          {activeTab === "compose" && <NotificationComposer />}
        </TabsContent>

        <TabsContent value="rules">
          {activeTab === "rules" && <AlertRulesPanel />}
        </TabsContent>

        <TabsContent value="tests">
          {activeTab === "tests" && <TestSuitePanel />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
