"use client";

import { useState, useMemo } from "react";
import { Search, Users, Hash, Lock, Globe } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { cn } from "~/lib/utils";

const GROUP_CATEGORIES = [
  "All",
  "Worldbuilding",
  "Nation Sim",
  "Diplomacy",
  "Economics",
  "History & Lore",
  "Culture",
  "Geography",
  "Politics",
] as const;

type GroupView = "discover" | "joined" | "created";

interface MessagesGroupsPanelProps {
  onSelectGroup: (conversationId: string) => void;
}

export function MessagesGroupsPanel({ onSelectGroup }: MessagesGroupsPanelProps) {
  const { user } = useUser();
  const userId = user?.id ?? "";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<GroupView>("joined");
  const [activeCategory, setActiveCategory] = useState("All");

  // Fetch groups
  const { data: groupsData, isLoading } = api.thinkpages.getThinktanks.useQuery(
    { userId, type: activeView === "discover" ? "all" : activeView },
    { enabled: !!userId }
  );

  const groups = useMemo(() => {
    let items = (groupsData as any[]) ?? [];

    // Filter by category
    if (activeCategory !== "All") {
      items = items.filter((g: any) => g.category === activeCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (g: any) =>
          g.name?.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [groupsData, activeCategory, searchQuery]);

  // Join/leave mutations
  const joinMutation = api.thinkpages.joinThinktank.useMutation();
  const leaveMutation = api.thinkpages.leaveThinktank.useMutation();
  const utils = api.useUtils();

  const handleJoin = async (groupId: string) => {
    await joinMutation.mutateAsync({ groupId, userId });
    void utils.thinkpages.getThinktanks.invalidate();
  };

  const handleLeave = async (groupId: string) => {
    await leaveMutation.mutateAsync({ groupId, userId });
    void utils.thinkpages.getThinktanks.invalidate();
  };

  const handleOpenGroup = (group: any) => {
    // If the group has a linked conversationId, open it in the chat panel
    if (group.conversationId) {
      onSelectGroup(group.conversationId);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 space-y-3 border-b border-border/50 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">ThinkTank Groups</h2>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
          {(["joined", "discover", "created"] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-all",
                activeView === view
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {view}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Category pills */}
        <div className="hide-scrollbar flex gap-1 overflow-x-auto">
          {GROUP_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
                activeCategory === cat
                  ? "bg-indigo-500/15 text-indigo-500"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : groups.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              {activeView === "joined"
                ? "You haven't joined any groups yet"
                : activeView === "created"
                  ? "You haven't created any groups"
                  : "No groups found"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {activeView === "joined"
                ? "Browse and join groups to start discussions"
                : activeView === "discover"
                  ? "Try a different search or category"
                  : "Create a ThinkTank to start collaborating"}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {groups.map((group: any) => {
              const isMember = group.isMember ?? group.members?.some?.((m: any) => m.userId === userId && m.isActive);
              const TypeIcon = group.type === "private" ? Lock : group.type === "invite_only" ? Hash : Globe;

              return (
                <button
                  key={group.id}
                  onClick={() => handleOpenGroup(group)}
                  className="flex w-full items-start gap-3 rounded-lg border border-transparent p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={group.avatar ?? undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-600 text-xs font-semibold text-white">
                      <Users className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {group.name}
                      </span>
                      <TypeIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </div>
                    {group.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {group.description}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {group.memberCount ?? group._count?.members ?? 0} members
                      </Badge>
                      {group.category && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-indigo-500 border-indigo-500/30">
                          {group.category}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Join/Leave button */}
                  {activeView === "discover" && !isMember && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleJoin(group.id);
                      }}
                      disabled={joinMutation.isPending}
                    >
                      Join
                    </Button>
                  )}
                  {isMember && activeView !== "created" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-xs text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleLeave(group.id);
                      }}
                      disabled={leaveMutation.isPending}
                    >
                      Leave
                    </Button>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
