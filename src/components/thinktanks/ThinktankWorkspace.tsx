"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Group, Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { soundEffects } from "~/lib/sound/cuelume";
import { EmptyState } from "~/components/ui/empty-state";
import { Button } from "~/components/ui/button";

import { ThinktankLayout } from "./ThinktankLayout";
import { isGroupMember } from "./groupMembership";
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

const lastSelectedKey = (userId: string) => `ix_thinktanks_last_selected_${userId || "guest"}`;

/** The remembered group, else a group the user belongs to, else the first one. */
function pickDefaultGroup(groups: any[], currentUserId: string): string {
  try {
    const lastGroupId = localStorage.getItem(lastSelectedKey(currentUserId));
    if (lastGroupId && groups.some((g) => g.id === lastGroupId)) return lastGroupId;
  } catch {
    // storage unavailable (private mode): fall back to the default group
  }

  const mine = groups.find((g) => isGroupMember(g, currentUserId));
  return (mine ?? groups[0]).id;
}

function useThinktankMembership(groupId: string | null, currentUserId: string) {
  const notify = useNotify();
  const utils = api.useUtils();

  const refresh = () => {
    if (groupId) void utils.thinkpages.getThinktankById.invalidate({ groupId });
    void utils.thinkpages.getThinktanks.invalidate();
  };

  const joinMutation = api.thinkpages.joinThinktank.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Joined group");
      refresh();
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
      refresh();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to leave group");
    },
  });

  const join = () => {
    if (!groupId || !currentUserId) return;
    soundEffects.press();
    joinMutation.mutate({ groupId });
  };

  const leave = () => {
    if (!groupId || !currentUserId) return;
    if (confirm("Are you sure you want to leave this group?")) {
      soundEffects.press();
      leaveMutation.mutate({ groupId });
    }
  };

  return { join, leave, isJoining: joinMutation.isPending, isLeaving: leaveMutation.isPending };
}

interface GroupContentProps {
  group: any;
  activeTab: ThinktankTab;
  currentUserId: string;
  onJoin: () => void;
}

function GroupContent({ group, activeTab, currentUserId, onJoin }: GroupContentProps) {
  const isMember = Boolean(group.isMember);

  switch (activeTab) {
    case "feed":
      return (
        <ThinktankFeedTab
          groupId={group.id}
          groupName={group.name}
          isMember={isMember}
          canReadFeed={isMember || group.type === "public"}
          allowPersonaPosting={Boolean(group.settings?.allowPersonaPosting)}
          canModerate={group.userRole === "owner" || group.userRole === "admin"}
          currentUserId={currentUserId}
          onJoin={onJoin}
        />
      );
    case "roster":
      return <ThinktankRosterTab members={group.members || []} currentUserId={currentUserId} />;
    case "docs":
      return <ThinktankPapersTab groupId={group.id} isMember={isMember} />;
    case "chat":
      return (
        <ThinktankChatTab
          conversationId={group.conversationId}
          groupName={group.name}
          currentUserId={currentUserId}
        />
      );
  }
}

export function ThinktankWorkspace({ initialGroupId: propGroupId }: ThinktankWorkspaceProps = {}) {
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const { user } = useUser();
  const currentUserId = user?.id ?? "";

  const initialGroupId = propGroupId || searchParams.get("group") || null;
  const tabParam = searchParams.get("tab");
  const initialTab: ThinktankTab =
    tabParam === "roster" || tabParam === "docs" || tabParam === "chat" ? tabParam : "feed";

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [activeTab, setActiveTab] = useState<ThinktankTab>(initialTab);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Mirror the selected group and tab into the URL without a page reload
  useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const next = new URLSearchParams(current);
    if (selectedGroupId) next.set("group", selectedGroupId);
    else next.delete("group");
    if (activeTab !== "feed") next.set("tab", activeTab);
    else next.delete("tab");

    if (next.toString() !== current.toString()) {
      window.history.replaceState(null, "", `${window.location.pathname}?${next.toString()}`);
    }
  }, [selectedGroupId, activeTab]);

  const { data: allGroupsData, isLoading: isLoadingGroups } = api.thinkpages.getThinktanks.useQuery(
    { type: "all" },
    { staleTime: 15000 }
  );

  const groups = useMemo(() => (allGroupsData as any[]) ?? [], [allGroupsData]);

  useEffect(() => {
    if (selectedGroupId || groups.length === 0) return;
    // oxlint-disable-next-line
    setSelectedGroupId(initialGroupId ?? pickDefaultGroup(groups, currentUserId));
  }, [groups, selectedGroupId, initialGroupId, currentUserId]);

  useEffect(() => {
    if (!selectedGroupId) return;
    try {
      localStorage.setItem(lastSelectedKey(currentUserId), selectedGroupId);
    } catch {
      // storage unavailable (private mode): the preference is not persisted
    }
  }, [selectedGroupId, currentUserId]);

  const { data: activeGroupData, isLoading: isLoadingActiveGroup } =
    api.thinkpages.getThinktankById.useQuery(
      { groupId: selectedGroupId! },
      { enabled: !!selectedGroupId, staleTime: 10000 }
    );

  const activeGroup = activeGroupData ?? null;

  // Only members see the other tabs
  useEffect(() => {
    if (activeGroup && !activeGroup.isMember && activeTab !== "feed") {
      // oxlint-disable-next-line
      setActiveTab("feed");
    }
  }, [activeGroup, activeTab]);

  const membership = useThinktankMembership(selectedGroupId, currentUserId);

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
              <ThinktankHeader
                group={activeGroup}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onOpenSettings={() => setShowSettingsModal(true)}
                onJoin={membership.join}
                onLeave={membership.leave}
                onBack={() => setIsSidebarCollapsed(false)}
                isJoining={membership.isJoining}
                isLeaving={membership.isLeaving}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
              />

              <div className="min-h-0 flex-1 overflow-y-auto">
                <GroupContent
                  group={activeGroup}
                  activeTab={activeTab}
                  currentUserId={currentUserId}
                  onJoin={membership.join}
                />
              </div>
            </div>
          ) : (
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

      {showCreateModal && (
        <ThinktankCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={setSelectedGroupId}
        />
      )}
    </>
  );
}
