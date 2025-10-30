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
        variant={activeTab === "mycountry" ? "default" : "ghost"}
        onClick={() => onTabChange("mycountry")}
        className="min-w-[120px] flex-1"
      >
        <Crown className="mr-2 h-4 w-4" />
        MyCountry
      </Button>
      <Button
        variant={activeTab === "lore" ? "default" : "ghost"}
        onClick={() => onTabChange("lore")}
        className="min-w-[120px] flex-1"
      >
        <BookOpen className="mr-2 h-4 w-4" />
        Lore & History
      </Button>
      <Button
        variant={activeTab === "diplomatic" ? "default" : "ghost"}
        onClick={() => onTabChange("diplomatic")}
        className="min-w-[120px] flex-1"
      >
        <Rss className="mr-2 h-4 w-4" />
        ThinkPages
      </Button>
      <Button
        variant={activeTab === "diplomacy" ? "default" : "ghost"}
        onClick={() => onTabChange("diplomacy")}
        className="min-w-[120px] flex-1"
      >
        <Building className="mr-2 h-4 w-4" />
        Diplomacy
      </Button>
    </div>
  );
}
