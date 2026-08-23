// src/app/admin/wiki/WikiPanel.tsx
// Admin wiki management — links, lorewards, custom awards, system tuning.

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { OpenBook as BookOpen } from "iconoir-react";
import {
  WikiLinkStatusSection,
  ManualLinkEditorSection,
  BulkScannerSection,
  AwardsManagerSection,
  SystemTuningSection,
} from "./components";

// Re-export all subcomponents for backward-compatible consumption in AdminRouter
export * from "./components";

export default function AdminWikiPage() {
  usePageTitle({ title: "Admin - WikiOS Administration" });

  const [activeTab, setActiveTab] = useState<string>("links");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["links", "awards", "system"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const { data: countriesData, isLoading } = api.countries.getAll.useQuery(
    { limit: 500 },
    { refetchOnWindowFocus: false }
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={BookOpen}
        title="WikiOS Administration"
        description="Unified portal for managing links, custom article awards, and parser systems"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border-border/30 mb-4 flex h-fit w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="links"
            className="data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground hover:border-border/50 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-transparent"
          >
            Wiki Links
          </TabsTrigger>
          <TabsTrigger
            value="awards"
            className="data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground hover:border-border/50 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-transparent"
          >
            Awards Manager
          </TabsTrigger>
          <TabsTrigger
            value="system"
            className="data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground hover:border-border/50 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-transparent"
          >
            System & Tuning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="space-y-6 outline-none">
          <WikiLinkStatusSection countriesData={countriesData} isLoading={isLoading} />
          <ManualLinkEditorSection countriesData={countriesData} />
          <BulkScannerSection countriesData={countriesData} />
        </TabsContent>

        <TabsContent value="awards" className="outline-none">
          <AwardsManagerSection />
        </TabsContent>

        <TabsContent value="system" className="outline-none">
          <SystemTuningSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
