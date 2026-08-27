"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Group, Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { soundEffects } from "~/lib/sound/cuelume";
import { Button } from "~/components/ui/button";

import { ThinktankLayout } from "./ThinktankLayout";
import { ThinktankDirectorySidebar } from "./ThinktankDirectorySidebar";
import { ThinktankHeader, type ThinktankTab } from "./ThinktankHeader";
import { ThinktankFeedTab } from "./ThinktankFeedTab";
// oxlint-disable-next-line eslint/no-unused-vars
import { ThinktankPapersTab } from "./ThinktankPapersTab";
import { ThinktankRosterTab } from "./ThinktankRosterTab";
import { ThinktankSettingsModal } from "./ThinktankSettingsModal";
import { ThinktankCreateModal } from "./ThinktankCreateModal";

interface ThinktankWorkspaceProps {
  initialGroupId?: string;
}

export function ThinktankWorkspace({ initialGroupId: propGroupId }: ThinktankWorkspaceProps = {}) {
  // oxlint-disable-next-line eslint/no-unused-vars
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const utils = api.useUtils();
  const { user } = useUser();
  const currentUserId = user?.id ?? "";

  // ── Query State Sync ──
  const initialGroupId = propGroupId || searchParams.get("group") || null;
  const initialTab: ThinktankTab = searchParams.get("tab") === "roster" ? "roster" : "feed";

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [activeTab, setActiveTab] = useState<ThinktankTab>(initialTab);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Sync selected group and tab to URL without full page reload
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;

    if (selectedGroupId) {
      if (params.get("group") !== selectedGroupId) {
        params.set("group", selectedGroupId);
        changed = true;
      }
    } else {
      if (params.has("group")) {
        params.delete("group");
        changed = true;
      }
    }

    if (activeTab && activeTab !== "feed") {
      if (params.get("tab") !== activeTab) {
        params.set("tab", activeTab);
        changed = true;
      }
    } else {
      if (params.has("tab")) {
        params.delete("tab");
        changed = true;
      }
    }

    if (changed) {
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", newUrl);
    }
  }, [selectedGroupId, activeTab]);

  // ── Queries ──
  const { data: allGroupsData, isLoading: isLoadingGroups } = api.thinkpages.getThinktanks.useQuery(
    { userId: currentUserId, type: "all" },
    { staleTime: 15000 }
  );

  const groups = useMemo(() => (allGroupsData as any[]) ?? [], [allGroupsData]);

  // Auto-select most recent group user is in (or last viewed group from localStorage)
  useEffect(() => {
    if (selectedGroupId || groups.length === 0) return;

    if (initialGroupId) {
      // oxlint-disable-next-line
      setSelectedGroupId(initialGroupId);
      return;
    }

    // 1. Check localStorage for last viewed group
    try {
      const lastGroupId = localStorage.getItem(
        `ix_thinktanks_last_selected_${currentUserId || "guest"}`
      );
      if (lastGroupId && groups.some((g) => g.id === lastGroupId)) {
        setSelectedGroupId(lastGroupId);
        return;
      }
    } catch {}

    // 2. Prioritize most recent group user is a member of
    const myGroups = groups.filter(
      (g) =>
        Boolean(g.isMember) ||
        Boolean(g.isJoined) ||
        (Boolean(currentUserId) && g.createdBy === currentUserId) ||
        (Boolean(currentUserId) && g.members?.some((m: any) => m.userId === currentUserId))
    );

    if (myGroups.length > 0) {
      setSelectedGroupId(myGroups[0].id);
      return;
    }

    // 3. Fallback to first available group
    setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId, initialGroupId, currentUserId]);

  // Persist selected group in localStorage
  useEffect(() => {
    if (selectedGroupId) {
      try {
        localStorage.setItem(
          `ix_thinktanks_last_selected_${currentUserId || "guest"}`,
          selectedGroupId
        );
      } catch {}
    }
  }, [selectedGroupId, currentUserId]);

  // Selected Group Details
  const { data: activeGroupData, isLoading: isLoadingActiveGroup } =
    api.thinkpages.getThinktankById.useQuery(
      { groupId: selectedGroupId!, userId: currentUserId },
      { enabled: !!selectedGroupId, staleTime: 10000 }
    );

  const activeGroup = activeGroupData ?? null;

  // Auto-switch to feed if user is not a member of the selected group
  useEffect(() => {
    if (activeGroup && !activeGroup.isMember && activeTab !== "feed") {
      // oxlint-disable-next-line
      setActiveTab("feed");
    }
  }, [activeGroup, activeTab]);

  // ── Mutations ──
  const joinMutation = api.thinkpages.joinThinktank.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Joined group successfully!");
      if (selectedGroupId) {
        void utils.thinkpages.getThinktankById.invalidate({ groupId: selectedGroupId });
      }
      void utils.thinkpages.getThinktanks.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to join group");
    },
  });

  const leaveMutation = api.thinkpages.leaveThinktank.useMutation({
    onSuccess: () => {
      soundEffects.release();
      notify.success("Left group.");
      if (selectedGroupId) {
        void utils.thinkpages.getThinktankById.invalidate({ groupId: selectedGroupId });
      }
      void utils.thinkpages.getThinktanks.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to leave group");
    },
  });

  const handleJoin = () => {
    if (!selectedGroupId || !currentUserId) return;
    soundEffects.press();
    joinMutation.mutate({ groupId: selectedGroupId, userId: currentUserId });
  };

  const handleLeave = () => {
    if (!selectedGroupId || !currentUserId) return;
    if (confirm("Are you sure you want to leave this group?")) {
      soundEffects.press();
      leaveMutation.mutate({ groupId: selectedGroupId, userId: currentUserId });
    }
  };

  const handleTabChange = (tab: ThinktankTab) => {
    setActiveTab(tab);
  };

  return (
    <>
      <ThinktankLayout
        isSidebarCollapsed={isSidebarCollapsed}
        directoryPanel={
          <ThinktankDirectorySidebar
            groups={groups}
            isLoading={isLoadingGroups}
            selectedGroupId={selectedGroupId}
            currentUserId={currentUserId}
            onSelectGroup={(id) => {
              soundEffects.press();
              setSelectedGroupId(id);
              // Auto-collapse sidebar on selecting/entering a group
              setIsSidebarCollapsed(true);
            }}
            onCreateGroup={() => setShowCreateModal(true)}
          />
        }
        workspacePanel={
          isLoadingActiveGroup && selectedGroupId ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-xs">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
              <p className="text-muted-foreground text-xs font-semibold">Loading group...</p>
            </div>
          ) : activeGroup ? (
            <div className="flex h-full flex-col overflow-hidden">
              {/* Workspace Header with Group Identity & Actions */}
              <ThinktankHeader
                group={activeGroup}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onOpenSettings={() => setShowSettingsModal(true)}
                onJoin={handleJoin}
                onLeave={handleLeave}
                onBack={() => setIsSidebarCollapsed(false)}
                isJoining={joinMutation.isPending}
                isLeaving={leaveMutation.isPending}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
              />

              {/* Group Content Canvas */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {activeTab === "feed" && (
                  <ThinktankFeedTab
                    groupId={activeGroup.id}
                    groupName={activeGroup.name}
                    isMember={Boolean(activeGroup.isMember)}
                    allowPersonaPosting={Boolean(activeGroup.settings?.allowPersonaPosting)}
                    currentUserId={currentUserId}
                    onJoin={handleJoin}
                  />
                )}

                {activeTab === "roster" && (
                  <ThinktankRosterTab
                    groupId={activeGroup.id}
                    members={activeGroup.members || []}
                    currentUserId={currentUserId}
                    userRole={activeGroup.userRole}
                  />
                )}
              </div>
            </div>
          ) : (
            /* Apple-styled Empty State */
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-xs dark:text-emerald-400">
                <Group className="h-7 w-7" />
              </div>
              <h3 className="text-foreground mt-4 text-base font-bold">Select a Group</h3>
              <p className="text-muted-foreground mt-1.5 max-w-sm text-xs leading-relaxed">
                Choose a group from the sidebar to view the feed, open discussions, or check the
                roster.
              </p>
              <Button
                onClick={() => {
                  soundEffects.press();
                  setShowCreateModal(true);
                }}
                className="mt-4 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create a Group
              </Button>
            </div>
          )
        }
      />

      {/* ── Settings Modal ── */}
      {activeGroup && showSettingsModal && (
        <ThinktankSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          groupId={activeGroup.id}
          initialName={activeGroup.name}
          initialDescription={activeGroup.description}
          initialType={activeGroup.type}
          initialCategory={activeGroup.category}
          initialAvatar={activeGroup.avatar}
          initialSettings={activeGroup.settings as any}
          currentUserId={currentUserId}
          onDeleteSuccess={() => {
            setSelectedGroupId(null);
            void utils.thinkpages.getThinktanks.invalidate();
          }}
        />
      )}

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <ThinktankCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          currentUserId={currentUserId}
          onCreated={(newId) => {
            setSelectedGroupId(newId);
          }}
        />
      )}
    </>
  );
}
