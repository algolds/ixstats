"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Users,
  Hash,
  Lock,
  Globe,
  Loader2,
  Compass,
  Check,
  ArrowRight,
  ChevronLeft,
  HelpCircle,
  Plus,
} from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

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
  onBack?: () => void;
}

export function MessagesGroupsPanel({ onSelectGroup, onBack }: MessagesGroupsPanelProps) {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const notify = useNotify();
  const utils = api.useUtils();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<GroupView>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "discover" || tab === "created" || tab === "joined") {
        return tab;
      }
    }
    return "joined";
  });
  const [activeCategory, setActiveCategory] = useState("All");
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleViewChange = (view: GroupView) => {
    setActiveView(view);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", view);
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  };

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
        (g: any) => g.name?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [groupsData, activeCategory, searchQuery]);

  // Join/leave mutations
  const joinMutation = api.thinkpages.joinThinktank.useMutation({
    onSuccess: () => {
      notify.success("Joined group successfully!");
      void utils.thinkpages.getThinktanks.invalidate();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to join group");
    },
  });

  const leaveMutation = api.thinkpages.leaveThinktank.useMutation({
    onSuccess: () => {
      notify.success("Left group");
      void utils.thinkpages.getThinktanks.invalidate();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to leave group");
    },
  });

  const createGroupMutation = api.thinkpages.createThinktank.useMutation({
    onSuccess: (newGroup) => {
      notify.success("Group created successfully!");
      void utils.thinkpages.getThinktanks.invalidate();
      setShowCreateModal(false);
      if (newGroup?.conversationId) {
        onSelectGroup(newGroup.conversationId);
      }
    },
    onError: (err) => {
      notify.error(err.message || "Failed to create group");
    },
  });

  const handleJoin = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    joinMutation.mutate({ groupId, userId });
  };

  const handleLeave = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    leaveMutation.mutate({ groupId, userId });
  };

  const handleOpenGroup = (group: any) => {
    if (group.conversationId) {
      onSelectGroup(group.conversationId);
    } else {
      notify.error("This group doesn't have an active chat channel.");
    }
  };

  return (
    <div className="flex h-full flex-col bg-transparent">
      {/* Header and Controls */}
      <div className="border-border/40 shrink-0 space-y-4 border-b bg-blue-500/10 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="mr-1 -ml-2 h-8 w-8 shrink-0 rounded-lg text-slate-400 hover:text-white"
                title="Go Back"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Compass className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">ThinkTank Groups</h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white shadow-md shadow-indigo-950/20 transition-all hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Group</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsHelpOpen(true)}
              className="h-8 w-8 shrink-0 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
              title="ThinkTank Groups Help"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Action / View Toggles */}
        <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
          <div className="flex w-full gap-1 rounded-xl border border-white/5 bg-slate-950/40 p-1 backdrop-blur-md md:w-auto">
            {(
              [
                { id: "joined", label: "My Groups" },
                { id: "discover", label: "Discover" },
                { id: "created", label: "Managed" },
              ] as const
            ).map((view) => (
              <button
                key={view.id}
                onClick={() => {
                  handleViewChange(view.id);
                  setSearchQuery("");
                }}
                className={cn(
                  "flex-1 rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-all duration-200 select-none md:flex-none",
                  activeView === view.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/20"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {view.label}
              </button>
            ))}
          </div>

          <div className="relative w-full shrink-0 md:w-72">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>

        {/* Scrollable Categories Row */}
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {GROUP_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1 text-[10px] font-bold transition-all duration-200",
                activeCategory === cat
                  ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-300 shadow-sm"
                  : "border-transparent bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 scrollbar-none overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : groups.length === 0 ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 shadow-lg">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mb-1 font-semibold text-slate-200">
              {activeView === "joined"
                ? "You haven't joined any groups yet"
                : activeView === "created"
                  ? "You haven't created any groups"
                  : "No groups found"}
            </h3>
            <p className="mb-6 text-xs leading-relaxed text-slate-400">
              {activeView === "joined"
                ? "Discover and join group chats to start collaborating with other system owners and nations."
                : activeView === "discover"
                  ? "Try adjusting your search filters or browse other categories."
                  : "Create a new group in the ThinkPages control center to start collaborating."}
            </p>
            {activeView === "joined" && (
              <Button
                onClick={() => setActiveView("discover")}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-700"
              >
                Browse Directory
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {groups.map((group: any) => {
              const isMember =
                group.isMember ??
                group.members?.some?.((m: any) => m.userId === userId && m.isActive);
              const TypeIcon =
                group.type === "private" ? Lock : group.type === "invite_only" ? Hash : Globe;

              return (
                <div
                  key={group.id}
                  onClick={() => handleOpenGroup(group)}
                  className="group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-white/5 bg-white/5 p-5 text-left transition-all duration-300 hover:scale-[1.01] hover:border-white/10 hover:bg-white/10 hover:shadow-xl hover:shadow-black/20"
                >
                  <div>
                    {/* Top row */}
                    <div className="mb-3.5 flex items-start justify-between gap-3">
                      <Avatar className="h-11 w-11 shrink-0 rounded-xl border border-white/10 shadow-md">
                        <AvatarImage src={group.avatar ?? undefined} className="object-cover" />
                        <AvatarFallback className="rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-xs font-semibold text-white">
                          <Users className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex items-center gap-1.5">
                        <span title={group.type}>
                          <TypeIcon className="h-3.5 w-3.5 text-slate-500" />
                        </span>
                        {group.category && (
                          <span className="rounded-full border border-indigo-500/20 bg-indigo-500/20 px-2 py-0.5 text-[9px] font-bold whitespace-nowrap text-indigo-300">
                            {group.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div className="min-w-0">
                      <h4 className="truncate text-sm leading-tight font-bold text-slate-200 group-hover:text-white">
                        {group.name}
                      </h4>
                      {group.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed font-medium text-slate-400">
                          {group.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer Stats & Button */}
                  <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/5 pt-3.5">
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                      <Users className="h-3 w-3" />
                      {group.memberCount ?? group._count?.members ?? 0} Members
                    </span>

                    {/* Join/Leave/Open button */}
                    <div className="flex items-center gap-1.5">
                      {isMember ? (
                        <>
                          <button
                            onClick={(e) => handleLeave(e, group.id)}
                            disabled={leaveMutation.isPending}
                            className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[10px] font-semibold text-rose-400 transition-colors hover:bg-rose-500/20 hover:text-rose-300"
                          >
                            Leave
                          </button>
                          <span className="flex items-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-400">
                            Joined <Check className="h-3 w-3" />
                          </span>
                        </>
                      ) : (
                        <button
                          onClick={(e) => handleJoin(e, group.id)}
                          disabled={joinMutation.isPending}
                          className="flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-md shadow-indigo-950/20 transition-all hover:bg-indigo-700"
                        >
                          {joinMutation.isPending && (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          )}
                          Join Group
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Groups Help Modal */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="border-white/10 bg-slate-900 text-white backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-indigo-400" />
              About ThinkTank Groups
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Collaborative hubs for system owners and nations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs leading-relaxed text-slate-300">
            <div className="space-y-1">
              <h4 className="font-bold text-slate-200">🔍 Browse & Discover</h4>
              <p>
                Explore categories or use the search bar to find groups that match your interests.
                You can view all available groups on the **Discover** tab.
              </p>
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-200">💬 Real-time Group Chats</h4>
              <p>
                Clicking on a group you've joined opens its dedicated chat channel, allowing you to
                converse with other members in real-time.
              </p>
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-200">🔒 Group Types</h4>
              <p>
                Groups can be public (anyone can join), restricted (require approvals/invites), or
                private.
              </p>
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-200">✍️ Collaboration & Lore</h4>
              <p>
                ThinkTank groups act as collaborative foundations to draft world history, national
                policies, and shared wiki articles.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateGroup={(data) => {
          if (!userId) return;
          createGroupMutation.mutate({
            ...data,
            createdBy: userId,
          });
        }}
      />
    </div>
  );
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (data: {
    name: string;
    description?: string;
    type: "public" | "private" | "invite_only";
    category?: string;
    tags?: string[];
  }) => void;
}

function CreateGroupModal({ isOpen, onClose, onCreateGroup }: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"public" | "private" | "invite_only">("public");
  const [category, setCategory] = useState("Worldbuilding");
  const [tagsText, setTagsText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onCreateGroup({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      category,
      tags: tags.length > 0 ? tags : undefined,
    });

    // Reset
    setName("");
    setDescription("");
    setType("public");
    setCategory("Worldbuilding");
    setTagsText("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="z-[100050] max-h-[90vh] overflow-y-auto border-white/10 bg-slate-900 text-white backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-400" />
            <DialogTitle className="font-bold text-slate-100">Create New Group</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400">
            Start a collaborative discussion group for worldbuilding, economics, or lore.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400">Group Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Caphirian History Society"
              className="border-white/5 bg-slate-950/50 text-xs text-slate-200"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your group's focus..."
              className="animate-none resize-none border-white/5 bg-slate-950/50 text-xs text-slate-200"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400">Privacy Mode</label>
              <Select value={type} onValueChange={(val: any) => setType(val)}>
                <SelectTrigger className="border-white/5 bg-slate-950/50 text-xs text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100060] border-white/10 bg-slate-950 text-xs text-white">
                  <SelectItem value="public">Public (Anyone)</SelectItem>
                  <SelectItem value="private">Private (Invite only)</SelectItem>
                  <SelectItem value="invite_only">Restricted (Approval)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="border-white/5 bg-slate-950/50 text-xs text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100060] max-h-56 border-white/10 bg-slate-950 text-xs text-white">
                  {GROUP_CATEGORIES.filter((c) => c !== "All").map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400">Tags (comma-separated)</label>
            <Input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="e.g. history, roleplay, caphiria"
              className="border-white/5 bg-slate-950/50 text-xs text-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700"
            >
              Create Group
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
