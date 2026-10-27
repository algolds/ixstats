"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Group } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { soundEffects } from "~/lib/sound/cuelume";
import { EmptyState } from "~/components/ui/empty-state";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/shell/PageHeader";

import { ThinktankLayout } from "./ThinktankLayout";
import { ThinktankDirectory } from "./ThinktankDirectory";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const { user } = useUser();
  const currentUserId = user?.id ?? "";

  // The group lives in the URL: /thinktanks/[groupId], or the older ?group= links.
  const selectedGroupId = propGroupId || searchParams.get("group") || null;
  const tabParam = searchParams.get("tab");
  const initialTab: ThinktankTab =
    tabParam === "roster" || tabParam === "docs" || tabParam === "chat" ? tabParam : "feed";

  const [activeTab, setActiveTab] = useState<ThinktankTab>(initialTab);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);

  // Mirror the tab into the URL without a page reload
  useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const next = new URLSearchParams(current);
    if (activeTab !== "feed") next.set("tab", activeTab);
    else next.delete("tab");

    if (next.toString() !== current.toString()) {
      const query = next.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query && `?${query}`}`);
    }
  }, [activeTab]);

  const { data: allGroupsData, isLoading: isLoadingGroups } = api.thinkpages.getThinktanks.useQuery(
    { type: "all" },
    { staleTime: 15000 }
  );

  const groups = useMemo(() => (allGroupsData as any[]) ?? [], [allGroupsData]);

  const {
    data: activeGroupData,
    isLoading: isLoadingActiveGroup,
    isError: activeGroupFailed,
    refetch: refetchActiveGroup,
  } = api.thinkpages.getThinktankById.useQuery(
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

  const openGroup = (id: string) => {
    soundEffects.press();
    setDirectoryOpen(false);
    router.push(`/thinktanks/${id}`);
  };

  const directory = (
    <ThinktankDirectory
      groups={groups}
      isLoading={isLoadingGroups}
      selectedGroupId={selectedGroupId}
      currentUserId={currentUserId}
      onSelectGroup={openGroup}
      onCreateGroup={() => setShowCreateModal(true)}
    />
  );

  return (
    <>
      {selectedGroupId ? (
        <ThinktankLayout
          directoryOpen={directoryOpen}
          onDirectoryOpenChange={setDirectoryOpen}
          directoryPanel={directory}
          workspacePanel={
            isLoadingActiveGroup ? (
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
                  onOpenDirectory={() => setDirectoryOpen(true)}
                  isJoining={membership.isJoining}
                  isLeaving={membership.isLeaving}
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
            ) : activeGroupFailed ? (
              <EmptyState
                className="h-full"
                icon={<Group />}
                title="Couldn't load this ThinkTank"
                message="Something went wrong while loading it. Try again in a moment."
                action={
                  <Button variant="secondary" onClick={() => void refetchActiveGroup()}>
                    Try again
                  </Button>
                }
              />
            ) : (
              <EmptyState
                className="h-full"
                icon={<Group />}
                title="Group not found"
                message="This group is not available. Pick another from the directory."
                action={
                  <Button variant="secondary" onClick={() => router.push("/thinktanks")}>
                    All ThinkTanks
                  </Button>
                }
              />
            )
          }
        />
      ) : (
        <div className="space-y-6">
          <PageHeader title="ThinkTanks" subtitle="Collaborative groups, chats and working notes" />
          <Card className="flex flex-col overflow-hidden">{directory}</Card>
        </div>
      )}

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
            void utils.thinkpages.getThinktanks.invalidate();
            router.push("/thinktanks");
          }}
        />
      )}

      {showCreateModal && (
        <ThinktankCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={openGroup}
        />
      )}
    </>
  );
}
