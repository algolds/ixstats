"use client";

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Group, Search, Plus, Globe, Lock, Sparks, Xmark } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";

interface ThinktankDirectorySidebarProps {
  groups: any[];
  isLoading: boolean;
  selectedGroupId: string | null;
  currentUserId?: string;
  onSelectGroup: (groupId: string) => void;
  onCreateGroup: () => void;
}

function formatRelativeTime(date?: string | Date | null): string {
  if (!date) return "";
  const now = Date.now();
  const diffMs = now - new Date(date).getTime();
  if (isNaN(diffMs) || diffMs < 0) return "";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1d";
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}

export function ThinktankDirectorySidebar({
  groups,
  isLoading,
  selectedGroupId,
  currentUserId = "",
  onSelectGroup,
  onCreateGroup,
}: ThinktankDirectorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"my" | "discover">("my");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Dynamic categories with live counts based on active tab
  const availableCategories = useMemo(() => {
    const counts: Record<string, number> = { All: 0 };
    for (const g of groups) {
      const isUserMember =
        Boolean(g.isMember) ||
        Boolean(g.isJoined) ||
        (Boolean(currentUserId) && g.createdBy === currentUserId) ||
        (Boolean(currentUserId) && g.members?.some((m: any) => m.userId === currentUserId));

      if (activeTab === "my" && !isUserMember) continue;
      if (activeTab === "discover" && isUserMember) continue;

      counts.All = (counts.All || 0) + 1;
      const cat = g.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    }

    const catList = Object.keys(counts).filter((cat) => cat === "All" || counts[cat] > 0);
    return catList.map((cat) => ({
      name: cat,
      count: counts[cat],
    }));
  }, [groups, activeTab, currentUserId]);

  // Filtering
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const isUserMember =
        Boolean(g.isMember) ||
        Boolean(g.isJoined) ||
        // oxlint-disable-next-line
        (Boolean(currentUserId) && g.createdBy === currentUserId) ||
        (Boolean(currentUserId) && g.members?.some((m: any) => m.userId === currentUserId));

      // 1. Tab filter
      if (activeTab === "my" && !isUserMember) return false;
      if (activeTab === "discover" && isUserMember) return false;

      // 2. Category filter
      if (selectedCategory !== "All") {
        const groupCat = g.category || "General";
        if (groupCat !== selectedCategory) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = g.name?.toLowerCase().includes(q);
        const matchesDesc = g.description?.toLowerCase().includes(q);
        const matchesCat = g.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }

      return true;
    });
  }, [groups, activeTab, selectedCategory, searchQuery]);

  return (
    <div className="flex h-full flex-col bg-transparent">
      {/* ── Top Header & Actions ── */}
      <div className="border-border/30 bg-muted/20 relative z-10 flex shrink-0 flex-col gap-2.5 border-b p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          {/* Animated Tab Pills */}
          <div className="border-border/40 bg-background/60 relative flex gap-1 rounded-xl border p-0.5 backdrop-blur-md">
            {(
              [
                { id: "my", label: "My Groups" },
                { id: "discover", label: "Discover" },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    soundEffects.press();
                    setActiveTab(tab.id);
                    setSelectedCategory("All");
                  }}
                  className={cn(
                    "relative cursor-pointer rounded-lg px-3 py-1 text-[11px] font-semibold tracking-tight transition-all select-none active:scale-[0.97]",
                    isActive ? "text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="thinktank-dir-tab-pill"
                      className="absolute inset-0 rounded-lg border border-emerald-500/40 bg-emerald-600 shadow-xs dark:bg-emerald-500"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <Button
            size="sm"
            onClick={() => {
              soundEffects.press();
              onCreateGroup();
            }}
            className="flex h-7.5 cursor-pointer items-center gap-1 rounded-xl bg-emerald-600 px-2.5 text-[11px] font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            <Plus className="h-3 w-3" /> New
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="text-muted-foreground/70 absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border/40 bg-background/50 placeholder:text-muted-foreground/60 h-8 rounded-xl pr-7 pl-8 text-xs focus-visible:ring-emerald-500/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5"
            >
              <Xmark className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Dynamic Category Capsules (Apple Design) */}
        {availableCategories.length > 1 && (
          <div className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 py-0.5">
            {availableCategories.map((cat) => {
              const isCatActive = selectedCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => {
                    soundEffects.press();
                    setSelectedCategory(cat.name);
                  }}
                  className={cn(
                    "group relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10.5px] font-medium tracking-tight transition-all select-none active:scale-[0.96]",
                    isCatActive
                      ? "font-semibold text-emerald-700 dark:text-emerald-300"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {isCatActive && (
                    <motion.div
                      layoutId="category-capsule-pill"
                      className="absolute inset-0 rounded-lg border border-emerald-500/30 bg-emerald-500/15 shadow-2xs dark:bg-emerald-500/20"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{cat.name}</span>
                  <span
                    className={cn(
                      "py-0.2 relative z-10 rounded-full px-1.5 text-[9px] font-bold tabular-nums transition-colors",
                      isCatActive
                        ? "bg-emerald-500/20 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-200"
                        : "bg-muted text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Group List ── */}
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-muted-foreground text-[11px] font-medium">Loading groups...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="bg-muted/50 text-muted-foreground mb-2 flex h-10 w-10 items-center justify-center rounded-2xl">
              <Group className="h-5 w-5" />
            </div>
            <p className="text-foreground text-xs font-semibold">No groups found</p>
            <p className="text-muted-foreground mt-1 text-[11px]">
              {searchQuery
                ? "Try adjusting your search or category filter."
                : activeTab === "my"
                  ? "You haven't joined any groups yet."
                  : "No groups available in this category."}
            </p>
            {activeTab === "my" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("discover")}
                className="border-border/50 mt-3 h-7.5 rounded-xl text-xs font-medium"
              >
                Discover Groups
              </Button>
            )}
          </div>
        ) : (
          filteredGroups.map((g) => {
            const isSelected = selectedGroupId === g.id;
            const allowPersona = Boolean(
              g.settings &&
              (typeof g.settings === "string"
                ? JSON.parse(g.settings).allowPersonaPosting
                : g.settings.allowPersonaPosting)
            );

            return (
              <button
                key={g.id}
                onClick={() => {
                  soundEffects.press();
                  onSelectGroup(g.id);
                }}
                className={cn(
                  "group relative flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-all duration-150 active:scale-[0.98]",
                  isSelected
                    ? "text-foreground border border-emerald-500/30 bg-emerald-500/15 shadow-xs dark:bg-emerald-500/20"
                    : "hover:bg-muted/40 text-foreground border border-transparent"
                )}
              >
                {/* Active Indicator Bar */}
                {isSelected && (
                  <div className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-emerald-500" />
                )}

                {/* Avatar with Activity Alert Beacon */}
                <div className="relative shrink-0">
                  <Avatar className="border-border/40 h-9 w-9 shrink-0 rounded-xl border shadow-xs">
                    {g.avatar ? <AvatarImage src={g.avatar} alt={g.name} /> : null}
                    <AvatarFallback className="rounded-xl bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {g.name?.slice(0, 2)?.toUpperCase() || "TT"}
                    </AvatarFallback>
                  </Avatar>
                  {g.hasRecentActivity && (
                    <span
                      title="Active discussions in last 48 hours"
                      className="ring-background absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 shadow-xs ring-2"
                    >
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    </span>
                  )}
                </div>

                {/* Content Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-foreground truncate text-xs font-bold">{g.name}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {g.hasRecentActivity && g.lastActivity && (
                        <span className="py-0.2 flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                          <Sparks className="h-2.5 w-2.5" />
                          {formatRelativeTime(g.lastActivity)}
                        </span>
                      )}
                      {g.type === "private" ? (
                        <span title="Private Group" className="inline-flex">
                          <Lock className="h-3 w-3 shrink-0 text-amber-500/80" />
                        </span>
                      ) : (
                        <span title="Public Group" className="inline-flex">
                          <Globe className="h-3 w-3 shrink-0 text-emerald-500/80" />
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[11px] leading-snug">
                    {g.description || "No description provided."}
                  </p>

                  <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-foreground/80 font-medium">
                      {g.category || "General"}
                    </span>
                    <span>·</span>
                    <span>
                      {g.memberCount ?? 1} {g.memberCount === 1 ? "member" : "members"}
                    </span>
                    {allowPersona && (
                      <span className="ml-auto inline-flex items-center font-medium text-purple-600 dark:text-purple-400">
                        <Group className="mr-0.5 h-2.5 w-2.5" /> Personas
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
