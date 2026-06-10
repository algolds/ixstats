"use client";

import React, { useState, useMemo } from "react";
import { Search, Users, Plus, Loader2, Compass } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { cn } from "~/lib/utils";

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
    { enabled: !!userId, staleTime: 30000 }
  );

  const filteredGroups = useMemo(() => {
    let items = (groupsData as any[]) ?? [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (g: any) => g.name?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [groupsData, searchQuery]);

  const handleOpenGroup = (group: any) => {
    if (group.conversationId) {
      onSelectConversation(group.conversationId);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header with Search and View Actions */}
      <div className="relative z-10 flex shrink-0 flex-col gap-2 border-b border-white/5 bg-blue-500/10 p-3">
        <div className="flex items-center justify-between gap-2">
          {/* View tabs */}
          <div className="flex gap-0.5 rounded-lg border border-white/5 bg-slate-950/40 p-0.5 backdrop-blur-md">
            <button
              onClick={() => setActiveView("joined")}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-[10px] font-bold transition-all duration-150 select-none",
                activeView === "joined"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              My Groups
            </button>
            <button
              onClick={() => setActiveView("created")}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-[10px] font-bold transition-all duration-150 select-none",
                activeView === "created"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              Managed
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="flex h-7 cursor-pointer items-center gap-1 rounded-lg border-white/10 bg-white/5 px-2 text-[10px] font-bold text-slate-300 hover:bg-white/10 hover:text-white"
            onClick={onOpenGroupsDirectory}
            title="Discover thinktanks and groups"
          >
            <Compass className="h-3 w-3" />
            <span>Discover</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search my groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Group List */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <p className="text-muted-foreground text-sm font-medium">
              {searchQuery.trim()
                ? "No matching groups"
                : activeView === "created"
                  ? "No created groups"
                  : "No groups joined"}
            </p>
            <p className="text-muted-foreground/70 mt-1 text-xs">
              {searchQuery.trim()
                ? "Try a different search term"
                : activeView === "created"
                  ? "Create a group in ThinkPages to manage it"
                  : "Click Discover to browse and join groups!"}
            </p>
            {activeView === "joined" && !searchQuery.trim() && (
              <Button
                size="sm"
                className="mt-4 cursor-pointer rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-semibold text-white hover:from-blue-700 hover:to-indigo-700"
                onClick={onOpenGroupsDirectory}
              >
                <Compass className="mr-1.5 h-3.5 w-3.5" />
                Browse Groups
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filteredGroups.map((group) => {
              const isSelected = group.conversationId === selectedConversationId;
              return (
                <button
                  key={group.id}
                  onClick={() => handleOpenGroup(group)}
                  disabled={!group.conversationId}
                  className={cn(
                    "relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-2 text-left transition-all duration-300 select-none",
                    isSelected
                      ? "border-indigo-500/40 bg-indigo-600/20 shadow-indigo-950/20"
                      : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.06]",
                    !group.conversationId && "cursor-not-allowed border-dashed opacity-55"
                  )}
                >
                  <Avatar className="h-9 w-9 shrink-0 rounded-lg border border-white/5 shadow-md">
                    <AvatarImage src={group.avatar ?? undefined} className="object-cover" />
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-xs font-semibold text-white">
                      <Users className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-slate-200">
                        {group.name}
                      </span>
                      {group.category && (
                        <span className="shrink-0 rounded border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 text-[8px] font-bold text-indigo-400">
                          {group.category}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">
                      {group.memberCount ?? group._count?.members ?? 0} members
                      {!group.conversationId && " • No chat channel"}
                    </p>
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
