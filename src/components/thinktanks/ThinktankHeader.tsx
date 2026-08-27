"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Globe,
  Lock,
  ShareAndroid,
  Settings,
  ArrowLeft,
  Check,
  Plus,
  LogOut,
  // oxlint-disable-next-line eslint/no-unused-vars
  ChatBubble,
  RssFeed,
  Group,
  SidebarCollapse,
  SidebarExpand,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";

export type ThinktankTab = "feed" | "roster";

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
  ];

  return (
    <div className="border-border/30 bg-card/75 dark:bg-card/40 relative z-20 flex shrink-0 flex-col overflow-hidden border-b backdrop-blur-2xl dark:border-white/10">
      {/* ── Optional Group Banner Backdrop ── */}
      {group.settings?.bannerUrl && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-30 dark:opacity-25">
          <img
            src={group.settings.bannerUrl}
            alt=""
            className="h-full w-full object-cover blur-[2px] filter"
          />
          <div className="from-card/30 via-card/70 to-card absolute inset-0 bg-gradient-to-b" />
        </div>
      )}

      {/* ── Top Bar: Identity & Actions ── */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 md:px-5">
        {/* Left: Back / Sidebar toggle & Group Avatar + Title */}
        <div className="flex min-w-0 items-center gap-2.5">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                soundEffects.press();
                onBack();
              }}
              className="text-muted-foreground hover:text-foreground h-8 w-8 shrink-0 rounded-xl p-0 active:scale-90 md:hidden"
              title="Back to Directory"
            >
              <ArrowLeft className="h-4 w-4" />
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
              className="text-muted-foreground hover:text-foreground hidden h-8 w-8 shrink-0 rounded-xl p-0 active:scale-90 lg:flex"
              title={isSidebarCollapsed ? "Show Directory Sidebar" : "Collapse Sidebar for Focus"}
            >
              {isSidebarCollapsed ? (
                <SidebarExpand className="h-4 w-4" />
              ) : (
                <SidebarCollapse className="h-4 w-4" />
              )}
            </Button>
          )}

          <Avatar className="border-border/50 h-9 w-9 shrink-0 rounded-xl border bg-gradient-to-br from-emerald-500/20 to-teal-500/20 shadow-xs">
            <AvatarImage src={group.avatar || undefined} alt={group.name} />
            <AvatarFallback className="rounded-xl bg-transparent text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {group.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-foreground truncate text-sm font-bold tracking-tight md:text-base">
                {group.name}
              </h1>
              {group.type === "private" ? (
                <span title="Private Group" className="inline-flex">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500/80" />
                </span>
              ) : (
                <span title="Public Group" className="inline-flex">
                  <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-500/80" />
                </span>
              )}
            </div>

            <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <span className="text-foreground/80 font-medium">{group.category || "General"}</span>
              <span>·</span>
              <span>{group.memberCount ?? 1} members</span>
              {allowPersona && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 font-medium text-purple-600 dark:text-purple-400">
                    <Group className="h-3 w-3" /> Multi-Persona
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
            className="text-muted-foreground hover:text-foreground h-8 rounded-xl px-2.5 text-xs active:scale-95"
            title="Share group link"
          >
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <ShareAndroid className="mr-1.5 h-3.5 w-3.5" />
            )}
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
              className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-xl p-0 active:scale-95"
              title="Group Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}

          {/* Join / Leave Button */}
          {isMember ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={isLeaving}
              onClick={onLeave}
              className="h-8 rounded-xl px-2.5 text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 active:scale-95"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Leave
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={isJoining}
              onClick={onJoin}
              className="h-8 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Join Group
            </Button>
          )}
        </div>
      </div>

      {/* ── Bottom Bar: Fluid Segmented Tab Strip (Members Only) ── */}
      {isMember && (
        <div className="border-border/20 relative z-10 flex items-center gap-1 border-t px-4 py-1.5 md:px-5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundEffects.press();
                  onTabChange(tab.id);
                }}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold tracking-tight transition-all select-none active:scale-[0.97]",
                  isActive
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="thinktank-tab-pill"
                    className="absolute inset-0 rounded-lg border border-emerald-500/30 bg-emerald-500/15 shadow-2xs dark:bg-emerald-500/20"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                <Icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
