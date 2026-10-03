"use client";

import React, { useState, useMemo } from "react";
import { Group, Plus, Globe, Lock, Sparks } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { timeAgo } from "~/lib/format/compact";

interface ThinktankDirectorySidebarProps {
  groups: any[];
  isLoading: boolean;
  selectedGroupId: string | null;
  currentUserId?: string;
  onSelectGroup: (groupId: string) => void;
  onCreateGroup: () => void;
}

const formatRelativeTime = (date?: string | Date | null) =>
  date ? timeAgo(date, { suffix: false }) : "";

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
    <div className="flex h-full flex-col">
      {/* ── Top Header & Actions ── */}
      <div className="border-separator relative flex shrink-0 flex-col gap-3 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <SegmentedControl
            size="sm"
            aria-label="Group list"
            value={activeTab}
            onValueChange={(value) => {
              soundEffects.press();
              setActiveTab(value);
              setSelectedCategory("All");
            }}
            options={[
              { value: "my", label: "My groups" },
              { value: "discover", label: "Discover" },
            ]}
          />

          <Button
            size="sm"
            onClick={() => {
              soundEffects.press();
              onCreateGroup();
            }}
          >
            <Plus aria-hidden="true" /> New
          </Button>
        </div>

        <SearchField
          size="sm"
          placeholder="Search groups..."
          aria-label="Search groups"
          value={searchQuery}
          onValueChange={setSearchQuery}
        />

        {/* Dynamic Category Capsules */}
        {availableCategories.length > 1 && (
          <ToggleGroup
            type="single"
            variant="pill"
            size="sm"
            aria-label="Filter by category"
            value={selectedCategory}
            onValueChange={(value) => {
              soundEffects.press();
              setSelectedCategory(value || "All");
            }}
            className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 py-0.5"
          >
            {availableCategories.map((cat) => (
              <ToggleGroupItem key={cat.name} value={cat.name} className="shrink-0 gap-1">
                <span>{cat.name}</span>
                <span className="bg-fill-3 rounded-full px-2 tabular-nums">{cat.count}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>

      {/* ── Group List ── */}
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <span className="border-tint size-5 animate-spin rounded-full border-2 border-t-transparent" />
            <p className="text-footnote text-label-secondary">Loading groups...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            compact
            className="py-16"
            icon={<Group />}
            title="No groups found"
            message={
              searchQuery
                ? "Try adjusting your search or category filter."
                : activeTab === "my"
                  ? "You haven't joined any groups yet."
                  : "No groups available in this category."
            }
            action={
              activeTab === "my" ? (
                <Button variant="outline" size="sm" onClick={() => setActiveTab("discover")}>
                  Discover groups
                </Button>
              ) : undefined
            }
          />
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
                  "group rounded-row text-label relative flex w-full items-start gap-3 p-2 text-left transition-colors duration-150",
                  isSelected ? "bg-tint-fill" : "hover:bg-fill-4"
                )}
              >
                {/* Active Indicator Bar */}
                {isSelected && (
                  <div className="bg-tint absolute top-2 bottom-2 left-0 w-1 rounded-r-full" />
                )}

                {/* Avatar with Activity Alert Beacon */}
                <div className="relative shrink-0">
                  <Avatar className="border-separator rounded-control size-9 shrink-0 border">
                    {g.avatar ? <AvatarImage src={g.avatar} alt={g.name} /> : null}
                    <AvatarFallback className="bg-tint-fill text-caption text-tint rounded-control">
                      {g.name?.slice(0, 2)?.toUpperCase() || "TT"}
                    </AvatarFallback>
                  </Avatar>
                  {g.hasRecentActivity && (
                    <span
                      title="Active discussions in last 48 hours"
                      className="ring-surface bg-tint absolute -top-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full ring-2"
                    >
                      <span className="bg-surface size-1.5 rounded-full" />
                    </span>
                  )}
                </div>

                {/* Content Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-headline text-label truncate">{g.name}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {g.hasRecentActivity && g.lastActivity && (
                        <Badge variant="secondary" className="px-2">
                          <Sparks aria-hidden="true" />
                          {formatRelativeTime(g.lastActivity)}
                        </Badge>
                      )}
                      {g.type === "private" ? (
                        <span title="Private group" className="inline-flex">
                          <Lock
                            className="text-label-secondary size-3.5 shrink-0"
                            aria-label="Private"
                          />
                        </span>
                      ) : (
                        <span title="Public group" className="inline-flex">
                          <Globe
                            className="text-label-secondary size-3.5 shrink-0"
                            aria-label="Public"
                          />
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-footnote text-label-secondary mt-0.5 line-clamp-1">
                    {g.description || "No description provided."}
                  </p>

                  <div className="text-footnote text-label-secondary mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-label font-medium">{g.category || "General"}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {g.memberCount ?? 1} {g.memberCount === 1 ? "member" : "members"}
                    </span>
                    {allowPersona && (
                      <span className="ml-auto inline-flex items-center gap-1 font-medium">
                        <Group className="size-3.5" aria-hidden="true" /> Personas
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
