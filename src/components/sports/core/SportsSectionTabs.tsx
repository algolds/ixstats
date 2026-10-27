"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { SportsNavSection, SportsSectionTab } from "./sportsSections";

interface SportsSectionTabsProps {
  label: string;
  tabs: readonly SportsSectionTab[];
  active: SportsNavSection;
  onChange: (section: SportsNavSection) => void;
  children: React.ReactNode;
}

/** The views of one league or club; the active view's content renders under the tab list. */
export function SportsSectionTabs({
  label,
  tabs,
  active,
  onChange,
  children,
}: SportsSectionTabsProps) {
  return (
    <Tabs value={active} onValueChange={(value) => onChange(value as SportsNavSection)}>
      <TabsList aria-label={label} className="hide-scrollbar mb-4 gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={active}>{children}</TabsContent>
    </Tabs>
  );
}
