"use client";

// Refactored from main CountryPage - handles tab navigation for country profile pages
import React from "react";
import { Button } from "~/components/ui/button";
import { Eye, Crown, BookOpen, Rss, Building } from "lucide-react";

type TabType = "overview" | "mycountry" | "lore" | "diplomatic" | "diplomacy";

interface CountryTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function CountryTabs({ activeTab, onTabChange }: CountryTabsProps) {
  return (
    <div className="glass-hierarchy-child rounded-lg p-1 flex gap-1 overflow-x-auto">
      <Button
        variant={activeTab === "overview" ? "default" : "ghost"}
        onClick={() => onTabChange("overview")}
        className="flex-1 min-w-[120px]"
      >
        <Eye className="h-4 w-4 mr-2" />
        Overview
      </Button>
      <Button
        variant={activeTab === "mycountry" ? "default" : "ghost"}
        onClick={() => onTabChange("mycountry")}
        className="flex-1 min-w-[120px]"
      >
        <Crown className="h-4 w-4 mr-2" />
        MyCountry
      </Button>
      <Button
        variant={activeTab === "lore" ? "default" : "ghost"}
        onClick={() => onTabChange("lore")}
        className="flex-1 min-w-[120px]"
      >
        <BookOpen className="h-4 w-4 mr-2" />
        Lore & History
      </Button>
      <Button
        variant={activeTab === "diplomatic" ? "default" : "ghost"}
        onClick={() => onTabChange("diplomatic")}
        className="flex-1 min-w-[120px]"
      >
        <Rss className="h-4 w-4 mr-2" />
        ThinkPages
      </Button>
      <Button
        variant={activeTab === "diplomacy" ? "default" : "ghost"}
        onClick={() => onTabChange("diplomacy")}
        className="flex-1 min-w-[120px]"
      >
        <Building className="h-4 w-4 mr-2" />
        Diplomacy
      </Button>
    </div>
  );
}
