"use client";
export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Bell}
        title="Notifications & Alerts"
        description="Notification event hooks, logs, alert rules, and system tests"
      />

      <Tabs defaultValue="events" className="w-full">
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
          <EventsRegistryPanel />
        </TabsContent>

        <TabsContent value="log">
          <NotificationBrowser />
        </TabsContent>

        <TabsContent value="compose">
          <NotificationComposer />
        </TabsContent>

        <TabsContent value="rules">
          <AlertRulesPanel />
        </TabsContent>

        <TabsContent value="tests">
          <TestSuitePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
