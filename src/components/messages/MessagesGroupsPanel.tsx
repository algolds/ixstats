"use client";

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Search,
  Group,
  Hashtag,
  Lock,
  Globe,
  Compass,
  Check,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  Plus,
  Xmark,
  Book,
  Spark,
  Eye,
} from "iconoir-react";
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
import { soundEffects } from "~/lib/sound/cuelume";
import { Textarea } from "~/components/ui/textarea";
import { ThinktankDocsModal } from "./ThinktankDocsModal";

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

  // Docs modal state
  const [docsModalGroup, setDocsModalGroup] = useState<{
    id: string;
    name: string;
    isMember: boolean;
  } | null>(null);

  const handleViewChange = (view: GroupView) => {
    soundEffects.press();
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
    { enabled: !!userId, staleTime: 15000 }
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
          g.description?.toLowerCase().includes(q) ||
          g.category?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [groupsData, activeCategory, searchQuery]);

  // Join/leave mutations
  const joinMutation = api.thinkpages.joinThinktank.useMutation({
    onSuccess: (res: any) => {
      soundEffects.success();
      notify.success("Joined ThinkTank!");
      void utils.thinkpages.getThinktanks.invalidate();
      void utils.messages.getConversationsByFolder.invalidate();
      if (res?.conversationId) {
        onSelectGroup(res.conversationId);
      }
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to join ThinkTank");
    },
  });

  const leaveMutation = api.thinkpages.leaveThinktank.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Left ThinkTank");
      void utils.thinkpages.getThinktanks.invalidate();
      void utils.messages.getConversationsByFolder.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to leave ThinkTank");
    },
  });

  const createGroupMutation = api.thinkpages.createThinktank.useMutation({
    onSuccess: (newGroup) => {
      soundEffects.success();
      notify.success("ThinkTank created successfully!");
      void utils.thinkpages.getThinktanks.invalidate();
      void utils.messages.getConversationsByFolder.invalidate();
      setShowCreateModal(false);
      if (newGroup?.conversationId) {
        onSelectGroup(newGroup.conversationId);
      }
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to create ThinkTank");
    },
  });

  const handleJoin = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    soundEffects.press();
    joinMutation.mutate({ groupId, userId });
  };

  const handleLeave = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    soundEffects.press();
    leaveMutation.mutate({ groupId, userId });
  };

  const handleOpenGroup = (group: any) => {
    soundEffects.press();
    onSelectGroup(group.conversationId || group.id);
  };

  return (
    <div className="flex h-full flex-col bg-transparent">
      {/* Alpine Green Frosted Header */}
      <div className="shrink-0 space-y-4 border-b border-border/30 bg-muted/20 p-6 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  soundEffects.press();
                  onBack();
                }}
                className="mr-1 -ml-2 h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Go Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-inner">
              <Compass className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">ThinkTank Directory</h2>
              <p className="text-[11px] text-muted-foreground">
                Collaborative research, lore drafting, and group discussion.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                soundEffects.press();
                setShowCreateModal(true);
              }}
              className="flex h-8.5 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.97] dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create ThinkTank</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                soundEffects.press();
                setIsHelpOpen(true);
              }}
              className="h-8.5 w-8.5 shrink-0 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
              title="About ThinkTanks"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* View Switcher & Search Bar */}
        <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
          {/* Animated Tab Switcher */}
          <div className="relative flex w-full gap-1 rounded-2xl border border-border/40 bg-background/60 p-1 backdrop-blur-md md:w-auto">
            {(
              [
                { id: "joined", label: "My Groups" },
                { id: "discover", label: "Discover All" },
                { id: "created", label: "Managed by Me" },
              ] as const
            ).map((view) => {
              const isActive = activeView === view.id;
              return (
                <button
                  key={view.id}
                  onClick={() => {
                    handleViewChange(view.id);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "relative flex-1 rounded-xl px-4 py-1.5 text-xs font-semibold tracking-tight capitalize transition-all select-none active:scale-[0.97] md:flex-none",
                    isActive ? "text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="thinktank-view-pill"
                      className="absolute inset-0 rounded-xl border border-emerald-500/40 bg-emerald-600 shadow-xs dark:bg-emerald-500"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{view.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input with Clear Button */}
          <div className="relative w-full shrink-0 md:w-80">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search groups by name, tag, or focus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9.5 rounded-2xl border-input bg-background/70 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  soundEffects.press();
                  setSearchQuery("");
                }}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Xmark className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Category Filter Pills */}
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
          {GROUP_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  soundEffects.press();
                  setActiveCategory(cat);
                }}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1 text-[11px] font-semibold tracking-tight transition-all select-none active:scale-[0.96]",
                  isSelected
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "border-border/30 bg-card/40 text-muted-foreground hover:border-border/60 hover:bg-accent/40 hover:text-foreground"
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid Body */}
      <div className="scrollbar-none flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center py-20">
            <span className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-border/40 bg-muted/20 text-muted-foreground shadow-lg">
              <Group className="h-6 w-6 text-emerald-500" />
            </div>
            <h3 className="mb-1 font-bold text-foreground">
              {searchQuery.trim()
                ? "No matching ThinkTanks found"
                : activeView === "joined"
                  ? "You haven't joined any ThinkTanks yet"
                  : activeView === "created"
                    ? "You haven't created any ThinkTanks yet"
                    : "No ThinkTanks found"}
            </h3>
            <p className="mb-6 max-w-xs text-xs leading-relaxed text-muted-foreground">
              {searchQuery.trim()
                ? `No groups match "${searchQuery}". Try adjusting your query or category filter.`
                : activeView === "joined"
                  ? "Discover public groups to co-author history, diplomacy, and lore."
                  : activeView === "discover"
                    ? "Try browsing a different category or create a new group."
                    : "Start your own ThinkTank workspace to lead policy and worldbuilding."}
            </p>
            {activeView === "joined" && !searchQuery.trim() && (
              <Button
                onClick={() => handleViewChange("discover")}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.97] dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                <Compass className="mr-1.5 h-3.5 w-3.5" />
                <span>Browse Directory</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {groups.map((group: any) => {
              const isMember =
                group.isJoined ??
                group.members?.some?.((m: any) => m.userId === userId && m.isActive);
              const TypeIcon =
                group.type === "private" ? Lock : group.type === "invite_only" ? Hashtag : Globe;
              const typeLabel =
                group.type === "private"
                  ? "Private"
                  : group.type === "invite_only"
                    ? "Restricted"
                    : "Public";
              const docsCount = group.docsCount ?? group._count?.collaborativeDocs ?? 0;

              return (
                <div
                  key={group.id}
                  onClick={() => handleOpenGroup(group)}
                  className="group relative flex cursor-pointer flex-col justify-between rounded-3xl border border-border/30 bg-card/60 p-5 text-left shadow-sm backdrop-blur-xl transition-all duration-200 hover:border-emerald-500/40 hover:bg-card/90 hover:shadow-md active:scale-[0.99]"
                >
                  <div>
                    {/* Top row */}
                    <div className="mb-3.5 flex items-start justify-between gap-3">
                      <Avatar className="h-11 w-11 shrink-0 rounded-2xl border border-border/40 shadow-xs">
                        <AvatarImage src={group.avatar ?? undefined} className="object-cover" />
                        <AvatarFallback className="rounded-2xl bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <Group className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex items-center gap-1.5">
                        <span
                          className="flex items-center gap-1 rounded-full border border-border/30 bg-muted/40 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground"
                          title={typeLabel}
                        >
                          <TypeIcon className="h-3 w-3 text-muted-foreground" />
                          <span>{typeLabel}</span>
                        </span>

                        {group.category && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                            {group.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold tracking-tight text-foreground transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        {group.name}
                      </h4>
                      {group.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs font-normal leading-relaxed text-muted-foreground">
                          {group.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer Stats & Action Buttons */}
                  <div className="mt-5 flex items-center justify-between gap-4 border-t border-border/20 pt-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <Group className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {group.memberCount ?? group._count?.members ?? 0}
                      </span>

                      {docsCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            soundEffects.press();
                            setDocsModalGroup({
                              id: group.id,
                              name: group.name,
                              isMember,
                            });
                          }}
                          className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                          title="View Collaborative Papers"
                        >
                          <Book className="h-3 w-3" />
                          <span>{docsCount} Papers</span>
                        </button>
                      )}
                    </div>

                    {/* Join/Leave/Open button */}
                    <div className="flex items-center gap-1.5">
                      {isMember ? (
                        <>
                          <button
                            onClick={(e) => handleLeave(e, group.id)}
                            disabled={leaveMutation.isPending}
                            className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-[10px] font-semibold text-destructive transition-colors hover:bg-destructive/20 active:scale-95"
                          >
                            Leave
                          </button>
                          <span className="flex items-center gap-1 rounded-xl border border-success/30 bg-success/15 px-2.5 py-1.5 text-[10px] font-bold text-success shadow-xs">
                            Joined <Check className="h-3 w-3" />
                          </span>
                        </>
                      ) : (
                        <button
                          onClick={(e) => handleJoin(e, group.id)}
                          disabled={joinMutation.isPending}
                          className="flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-600 px-3.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                        >
                          Join ThinkTank
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

      {/* Collaborative Documents Modal */}
      {docsModalGroup && (
        <ThinktankDocsModal
          isOpen={!!docsModalGroup}
          onClose={() => setDocsModalGroup(null)}
          groupId={docsModalGroup.id}
          groupName={docsModalGroup.name}
          currentUserId={userId}
          isMember={docsModalGroup.isMember}
        />
      )}

      {/* About ThinkTanks Help Modal */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="z-[100060] rounded-3xl border-border/40 bg-card/95 text-foreground backdrop-blur-2xl sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <HelpCircle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-bold text-foreground">
                About ThinkTanks
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Collaborative institutions for worldbuilding, policy drafting, and nation statecraft.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3.5 text-xs leading-relaxed text-muted-foreground">
            <div className="rounded-2xl border border-border/30 bg-muted/20 p-3.5">
              <h4 className="flex items-center gap-1.5 font-bold text-foreground">
                <Compass className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                1. Browse & Discover
              </h4>
              <p className="mt-1 text-muted-foreground">
                Find working groups by category — from Economics and Diplomacy to History and Worldbuilding.
              </p>
            </div>
            <div className="rounded-2xl border border-border/30 bg-muted/20 p-3.5">
              <h4 className="flex items-center gap-1.5 font-bold text-foreground">
                <Group className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                2. Real-Time Group Chat
              </h4>
              <p className="mt-1 text-muted-foreground">
                Joined groups unlock a synchronized chat channel with other members and national leaders.
              </p>
            </div>
            <div className="rounded-2xl border border-border/30 bg-muted/20 p-3.5">
              <h4 className="flex items-center gap-1.5 font-bold text-foreground">
                <Book className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                3. Collaborative Papers & Treaties
              </h4>
              <p className="mt-1 text-muted-foreground">
                Draft treaties, publish lore papers, and record shared history with version-controlled Markdown documents.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interactive Create Group Studio Modal */}
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
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(["worldbuilding", "lore"]);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (val && !tags.includes(val) && tags.length < 5) {
        soundEffects.press();
        setTags([...tags, val]);
        setTagInput("");
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    soundEffects.release();
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

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
    setTags(["worldbuilding", "lore"]);
  };

  const privacyOptions = [
    {
      id: "public" as const,
      icon: Globe,
      title: "Public",
      description: "Open to all players. Anyone can join and read papers.",
    },
    {
      id: "invite_only" as const,
      icon: Hashtag,
      title: "Restricted",
      description: "Requires invite or host approval to participate.",
    },
    {
      id: "private" as const,
      icon: Lock,
      title: "Private",
      description: "Hidden ThinkTank. Strictly invite-only.",
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="z-[100060] max-h-[90vh] w-[95vw] max-w-4xl overflow-y-auto rounded-3xl border border-border/40 bg-card/95 p-0 text-foreground shadow-2xl backdrop-blur-2xl scrollbar-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Plus className="h-4.5 w-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Create ThinkTank
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Establish a collaborative group for shared lore, nation statecraft, or research.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Form on Left, Live Preview on Right */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
            {/* Left Form Controls */}
            <div className="space-y-4 md:col-span-7">
              {/* Group Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  ThinkTank Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Caphirian History Society"
                  className="h-10 rounded-xl border-input bg-background/80 text-sm font-semibold text-foreground"
                  maxLength={60}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Mission & Focus
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your group's research focus, historical epoch, or policy agenda..."
                  className="h-20 animate-none resize-none rounded-xl border-input bg-background/80 text-xs text-foreground leading-relaxed"
                  maxLength={300}
                />
              </div>

              {/* Privacy Mode Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Privacy Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {privacyOptions.map((opt) => {
                    const isSelected = type === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          setType(opt.id);
                        }}
                        className={cn(
                          "flex flex-col items-start rounded-2xl border p-2.5 text-left transition-all select-none active:scale-[0.97]",
                          isSelected
                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs"
                            : "border-border/30 bg-card/40 hover:border-border/60 hover:bg-accent/40"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn("h-3.5 w-3.5", isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                          <span className="text-xs font-bold text-foreground">{opt.title}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category Pills */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Primary Domain
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {GROUP_CATEGORIES.filter((c) => c !== "All").map((cat) => {
                    const isSelected = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          setCategory(cat);
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[10px] font-semibold transition-all select-none active:scale-[0.96]",
                          isSelected
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "border-border/30 bg-card/40 text-muted-foreground hover:border-border/60 hover:text-foreground"
                        )}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tags Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Tags (press Enter to add)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background/80 p-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 rounded-lg border border-border/30 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-foreground"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Xmark className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {tags.length < 5 && (
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder={tags.length === 0 ? "e.g. treaty, military" : "Add tag..."}
                      className="min-w-[80px] flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Live Directory Card Preview */}
            <div className="flex flex-col justify-center border-t border-border/30 pt-6 md:col-span-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Live Directory Preview</span>
              </div>

              {/* Mock Directory Card */}
              <div className="rounded-3xl border border-border/40 bg-card/90 p-5 shadow-lg backdrop-blur-xl">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs">
                    <Group className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 rounded-full border border-border/30 bg-muted/40 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                      {type === "private" ? (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      ) : type === "invite_only" ? (
                        <Hashtag className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Globe className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="capitalize">{type.replace("_", " ")}</span>
                    </span>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                      {category}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold tracking-tight text-foreground">
                    {name.trim() || "Untitled ThinkTank"}
                  </h4>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {description.trim() || "No description provided yet. Add your group's focus above."}
                  </p>
                </div>

                {/* Preview Tags */}
                {tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span key={t} className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border/20 pt-3">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                    <Group className="h-3 w-3" /> 1 Member
                  </span>
                  <span className="rounded-xl border border-emerald-500/40 bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white shadow-xs dark:bg-emerald-500">
                    Join ThinkTank
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-2.5 border-t border-border/30 bg-muted/20 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                soundEffects.press();
                onClose();
              }}
              className="h-8.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim()}
              className="flex h-8.5 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.97] dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              <Spark className="h-3.5 w-3.5" />
              <span>Create ThinkTank</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
