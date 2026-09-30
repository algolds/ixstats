"use client";

import React, { useState } from "react";
import { FacetTabs } from "~/components/ui/facet";
import {
  Globe,
  Lock,
  ShareAndroid,
  Settings,
  ArrowLeft,
  Check,
  Plus,
  LogOut,
  ChatBubble,
  Book,
  RssFeed,
  Group,
  SidebarCollapse,
  SidebarExpand,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";

export type ThinktankTab = "feed" | "roster" | "docs" | "chat";

interface ThinktankHeaderProps {
  group: {
    id: string;
    name: string;
    description?: string | null;
    category?: string | null;
    type?: string | null;
    avatar?: string | null;
    settings?: {
      allowPersonaPosting?: boolean;
      rules?: string;
      bannerUrl?: string;
    } | null;
    memberCount?: number;
    docCount?: number;
    userRole?: string | null;
    isMember?: boolean;
  };
  activeTab: ThinktankTab;
  onTabChange: (tab: ThinktankTab) => void;
  onOpenSettings: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onBack?: () => void;
  isJoining?: boolean;
  isLeaving?: boolean;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function ThinktankHeader({
  group,
  activeTab,
  onTabChange,
  onOpenSettings,
  onJoin,
  onLeave,
  onBack,
  isJoining = false,
  isLeaving = false,
  isSidebarCollapsed = false,
  onToggleSidebar,
}: ThinktankHeaderProps) {
  const notify = useNotify();
  const [copied, setCopied] = useState(false);

  const isOwnerOrAdmin = group.userRole === "owner" || group.userRole === "admin";
  const allowPersona = Boolean(group.settings?.allowPersonaPosting);

  const handleCopyLink = () => {
    soundEffects.press();
    const url = `${window.location.origin}/thinktanks/${group.id}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    notify.success("Group link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const isMember = Boolean(group.isMember);

  const tabs: Array<{
    id: ThinktankTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "feed", label: "Feed", icon: RssFeed },
    { id: "roster", label: "Members", icon: Group },
    { id: "docs", label: "Docs", icon: Book },
    { id: "chat", label: "Chat", icon: ChatBubble },
  ];

  return (
    <div className="border-separator bg-surface relative flex shrink-0 flex-col overflow-hidden border-b">
      {/* ── Optional Group Banner Backdrop ── */}
      {group.settings?.bannerUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-30"
        >
          <img src={group.settings.bannerUrl} alt="" className="size-full object-cover" />
          <div className="bg-surface/70 absolute inset-0" />
        </div>
      )}

      {/* ── Top Bar: Identity & Actions ── */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 md:px-5">
        {/* Left: Back / Sidebar toggle & Group Avatar + Title */}
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                soundEffects.press();
                onBack();
              }}
              className="text-label-secondary hover:text-label size-8 shrink-0 p-0 md:hidden"
              title="Back to Directory"
              aria-label="Back to Directory"
            >
              <ArrowLeft />
            </Button>
          )}

          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                soundEffects.press();
                onToggleSidebar();
              }}
              className="text-label-secondary hover:text-label hidden size-8 shrink-0 p-0 lg:flex"
              title={isSidebarCollapsed ? "Show Directory Sidebar" : "Collapse Sidebar for Focus"}
              aria-label={
                isSidebarCollapsed ? "Show Directory Sidebar" : "Collapse Sidebar for Focus"
              }
            >
              {isSidebarCollapsed ? <SidebarExpand /> : <SidebarCollapse />}
            </Button>
          )}

          <Avatar className="border-separator bg-tint-fill rounded-control size-9 shrink-0 border">
            <AvatarImage src={group.avatar || undefined} alt={group.name} />
            <AvatarFallback className="rounded-control text-caption text-tint bg-transparent">
              {group.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-headline text-label truncate">{group.name}</h1>
              {group.type === "private" ? (
                <span title="Private Group" className="inline-flex">
                  <Lock className="text-label-secondary size-3.5 shrink-0" aria-label="Private" />
                </span>
              ) : (
                <span title="Public Group" className="inline-flex">
                  <Globe className="text-label-secondary size-3.5 shrink-0" aria-label="Public" />
                </span>
              )}
            </div>

            <div className="text-footnote text-label-secondary flex items-center gap-1">
              <span className="text-label font-medium">{group.category || "General"}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{group.memberCount ?? 1} members</span>
              {allowPersona && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 font-medium">
                    <Group className="size-3.5" aria-hidden="true" /> Multi-Persona
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Share button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            className="text-label-secondary hover:text-label"
            title="Share group link"
          >
            {copied ? <Check className="text-success" /> : <ShareAndroid />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </Button>

          {/* Group Settings Trigger */}
          {isOwnerOrAdmin && onOpenSettings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                soundEffects.press();
                onOpenSettings();
              }}
              className="text-label-secondary hover:text-label size-8 p-0"
              title="Group Settings"
              aria-label="Group Settings"
            >
              <Settings />
            </Button>
          )}

          {/* Join / Leave Button */}
          {isMember ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={isLeaving}
              onClick={onLeave}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut />
              Leave
            </Button>
          ) : (
            <Button size="sm" disabled={isJoining} onClick={onJoin}>
              <Plus />
              Join Group
            </Button>
          )}
        </div>
      </div>

      {/* ── Bottom Bar: section tabs (members only) ── */}
      {isMember && (
        <div className="border-separator relative z-10 border-t px-4 py-2 md:px-5">
          <FacetTabs
            size="sm"
            tone="accent"
            showTexture={false}
            aria-label="Group sections"
            activeTab={activeTab}
            onChange={(id) => {
              soundEffects.press();
              onTabChange(id as ThinktankTab);
            }}
            tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon }))}
          />
        </div>
      )}
    </div>
  );
}
