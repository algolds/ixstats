"use client";

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Search, Group, Compass, Xmark, Book } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";

interface MessagesGroupsListPanelProps {
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onOpenGroupsDirectory: () => void;
}

export function MessagesGroupsListPanel({
  selectedConversationId,
  onSelectConversation,
  onOpenGroupsDirectory,
}: MessagesGroupsListPanelProps) {
  const { user } = useUser();
  const userId = user?.id ?? "";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<"joined" | "created">("joined");

  // Fetch groups
  const { data: groupsData, isLoading } = api.thinkpages.getThinktanks.useQuery(
    { userId, type: activeView },
    { enabled: !!userId, staleTime: 15000 }
  );

  const filteredGroups = useMemo(() => {
    let items = (groupsData as any[]) ?? [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (g: any) =>
          g.name?.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.category?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [groupsData, searchQuery]);

  const handleOpenGroup = (group: any) => {
    soundEffects.press();
    onSelectConversation(group.conversationId || group.id);
  };

  return (
    <div className="flex h-full flex-col bg-transparent">
      {/* Header with Search and View Actions */}
      <div className="relative z-10 flex shrink-0 flex-col gap-2.5 border-b border-border/30 bg-muted/20 p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          {/* Animated View tabs */}
          <div className="relative flex gap-1 rounded-xl border border-border/40 bg-background/60 p-0.5 backdrop-blur-md">
            {(
              [
                { id: "joined", label: "My Groups" },
                { id: "created", label: "Managed" },
              ] as const
            ).map((view) => {
              const isActive = activeView === view.id;
              return (
                <button
                  key={view.id}
                  onClick={() => {
                    soundEffects.press();
                    setActiveView(view.id);
                  }}
                  className={cn(
                    "relative cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-tight transition-all select-none active:scale-[0.97]",
                    isActive ? "text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="groups-list-tab-pill"
                      className="absolute inset-0 rounded-lg border border-emerald-500/40 bg-emerald-600 shadow-xs dark:bg-emerald-500"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{view.label}</span>
                </button>
              );
            })}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="flex h-7.5 cursor-pointer items-center gap-1 rounded-xl border-border/40 bg-card/60 px-2.5 text-[11px] font-semibold text-emerald-600 transition-all hover:bg-accent hover:text-foreground active:scale-95 dark:text-emerald-400"
            onClick={() => {
              soundEffects.press();
              onOpenGroupsDirectory();
            }}
            title="Discover all ThinkTanks"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Discover</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search my ThinkTanks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8.5 rounded-xl border-input bg-background/70 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => {
                soundEffects.press();
                setSearchQuery("");
              }}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Xmark className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Group List */}
      <div className="scrollbar-none flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">
              {searchQuery.trim()
                ? "No matching groups"
                : activeView === "created"
                  ? "No managed ThinkTanks"
                  : "No ThinkTanks joined"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {searchQuery.trim()
                ? "Try a different keyword"
                : activeView === "created"
                  ? "Create a group in the directory to manage it"
                  : "Discover public ThinkTanks to start collaborating."}
            </p>
            {activeView === "joined" && !searchQuery.trim() && (
              <Button
                size="sm"
                className="mt-4 cursor-pointer rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.97] dark:bg-emerald-500 dark:hover:bg-emerald-600"
                onClick={() => {
                  soundEffects.press();
                  onOpenGroupsDirectory();
                }}
              >
                <Compass className="mr-1.5 h-3.5 w-3.5" />
                <span>Browse Directory</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filteredGroups.map((group) => {
              const isSelected = group.conversationId === selectedConversationId;
              const docsCount = group.docsCount ?? group._count?.collaborativeDocs ?? 0;

              return (
                <button
                  key={group.id}
                  onClick={() => handleOpenGroup(group)}
                  className={cn(
                    "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-2.5 text-left transition-all duration-150 select-none active:scale-[0.98]",
                    isSelected
                      ? "border-emerald-500/50 bg-emerald-500/15 shadow-xs dark:border-emerald-400/40"
                      : "border-border/20 bg-card/40 hover:border-border/40 hover:bg-accent/40"
                  )}
                >
                  <Avatar className="h-9.5 w-9.5 shrink-0 rounded-xl border border-border/30 shadow-xs">
                    <AvatarImage src={group.avatar ?? undefined} className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Group className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold tracking-tight text-foreground transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        {group.name}
                      </span>
                      {group.category && (
                        <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                          {group.category}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{group.memberCount ?? group._count?.members ?? 0} members</span>
                      {docsCount > 0 && (
                        <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <Book className="h-2.5 w-2.5" />
                          {docsCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
