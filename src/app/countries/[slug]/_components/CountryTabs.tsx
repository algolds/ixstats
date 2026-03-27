"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { Eye, Activity, BookOpen } from "lucide-react";

export type TabType = "overview" | "lore" | "activity";

interface CountryTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function CountryTabs({ activeTab, onTabChange }: CountryTabsProps) {
  return (
    <div className="glass-hierarchy-child flex gap-1 overflow-x-auto rounded-lg p-1">
      <Button
        variant={activeTab === "overview" ? "default" : "ghost"}
        onClick={() => onTabChange("overview")}
        className="min-w-[120px] flex-1"
      >
        <Eye className="mr-2 h-4 w-4" />
        Overview
      </Button>
      <Button
        variant={activeTab === "lore" ? "default" : "ghost"}
        onClick={() => onTabChange("lore")}
        className="min-w-[120px] flex-1"
      >
        <BookOpen className="mr-2 h-4 w-4" />
        Dossier
      </Button>
      <Button
        variant={activeTab === "activity" ? "default" : "ghost"}
        onClick={() => onTabChange("activity")}
        className="min-w-[120px] flex-1"
      >
        <Activity className="mr-2 h-4 w-4" />
        Activity
      </Button>
    </div>
  );
}
