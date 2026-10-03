"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Group, Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { soundEffects } from "~/lib/sound/cuelume";
import { EmptyState } from "~/components/ui/empty-state";
import { Button } from "~/components/ui/button";

import { ThinktankLayout } from "./ThinktankLayout";
import { ThinktankDirectorySidebar } from "./ThinktankDirectorySidebar";
import { ThinktankHeader, type ThinktankTab } from "./ThinktankHeader";
import { ThinktankFeedTab } from "./ThinktankFeedTab";
import { ThinktankPapersTab } from "./ThinktankPapersTab";
import { ThinktankRosterTab } from "./ThinktankRosterTab";
import { ThinktankChatTab } from "./ThinktankChatTab";
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
  const tabParam = searchParams.get("tab");
  const initialTab: ThinktankTab =
    tabParam === "roster" || tabParam === "docs" || tabParam === "chat" ? tabParam : "feed";

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
    { type: "all" },
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
    } catch {
      // storage unavailable (private mode) — fall back to the default group
    }

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
      } catch {
        // storage unavailable (private mode) — preference is not persisted
      }
    }
  }, [selectedGroupId, currentUserId]);

  // Selected Group Details
  const { data: activeGroupData, isLoading: isLoadingActiveGroup } =
    api.thinkpages.getThinktankById.useQuery(
      { groupId: selectedGroupId! },
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
      notify.success("Joined group");
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
    joinMutation.mutate({ groupId: selectedGroupId });
  };

  const handleLeave = () => {
    if (!selectedGroupId || !currentUserId) return;
    if (confirm("Are you sure you want to leave this group?")) {
      soundEffects.press();
      leaveMutation.mutate({ groupId: selectedGroupId });
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
              <span className="border-tint size-5 animate-spin rounded-full border-2 border-t-transparent" />
              <p className="text-footnote text-label-secondary">Loading group...</p>
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
                    canReadFeed={Boolean(activeGroup.isMember) || activeGroup.type === "public"}
                    allowPersonaPosting={Boolean(activeGroup.settings?.allowPersonaPosting)}
                    canModerate={
                      activeGroup.userRole === "owner" || activeGroup.userRole === "admin"
                    }
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

                {activeTab === "docs" && (
                  <ThinktankPapersTab
                    groupId={activeGroup.id}
                    groupName={activeGroup.name}
                    isMember={Boolean(activeGroup.isMember)}
                  />
                )}

                {activeTab === "chat" && (
                  <ThinktankChatTab
                    conversationId={activeGroup.conversationId}
                    groupName={activeGroup.name}
                    currentUserId={currentUserId}
                  />
                )}
              </div>
            </div>
          ) : (
            /* Empty State */
            <EmptyState
              className="h-full"
              icon={<Group />}
              title="Select a group"
              message="Choose a group to see its feed, discussions and roster."
              action={
                <Button
                  onClick={() => {
                    soundEffects.press();
                    setShowCreateModal(true);
                  }}
                >
                  <Plus />
                  Create a group
                </Button>
              }
            />
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
          onCreated={(newId) => {
            setSelectedGroupId(newId);
          }}
        />
      )}
    </>
  );
}
