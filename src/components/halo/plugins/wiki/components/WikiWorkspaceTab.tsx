// src/components/halo/plugins/wiki/components/WikiWorkspaceTab.tsx
// Quick actions, drafts manager, paused reading sessions, and recent changes feed for Halo Wiki mode.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileEdit,
  History,
  Link2,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { PreText } from "~/components/ui/pretext";
import { navigateWithBasePath } from "~/lib/base-path";
import { formatMWTimeAgo } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import { formatTimeAgo, type LocalDraft, type PausedSession } from "../types";

interface WikiWorkspaceTabProps {
  articleTitle?: string | null;
  isMainPage?: boolean;
  isSignedIn?: boolean;
  slug?: string | null;
  localDrafts: LocalDraft[];
  pausedSessions: PausedSession[];
  recentChanges?: Array<{
    title?: string | null;
    user?: string | null;
    timestamp?: string | null;
  }> | null;
  onClose: () => void;
  onNavigateToArticle: (title: string) => void;
}

export function WikiWorkspaceTab({
  articleTitle,
  isMainPage = false,
  isSignedIn = false,
  slug,
  localDrafts,
  pausedSessions,
  recentChanges,
  onClose,
  onNavigateToArticle,
}: WikiWorkspaceTabProps) {
  const router = useRouter();
  const [draftsOpen, setDraftsOpen] = useState(true);
  const [sessionsOpen, setSessionsOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(false);

  return (
    <>
      {/* Local Drafts Section */}
      {localDrafts.length > 0 && (
        <CollapsibleSection
          label="Local Drafts"
          icon={<FileEdit className="h-3 w-3 text-blue-400" />}
          count={localDrafts.length}
          open={draftsOpen}
          onToggle={() => setDraftsOpen(!draftsOpen)}
        >
          <div className="max-h-[160px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-0.5 overflow-y-auto">
            {localDrafts.map((draft, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onClose();
                  navigateWithBasePath(
                    `/wiki/${encodeURIComponent(draft.title.replace(/ /g, "_"))}/edit`,
                    router
                  );
                }}
                className="text-foreground/60 hover:bg-accent/10 hover:text-foreground/90 flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition-colors"
              >
                <div className="flex min-w-0 flex-1 flex-col pr-2">
                  <PreText
                    className="truncate text-[13px] font-medium text-inherit"
                    whiteSpace="nowrap"
                  >
                    {draft.title}
                  </PreText>
                  <PreText className="text-muted-foreground text-[9px]" whiteSpace="nowrap">
                    {draft.type === "visual"
                      ? "Visual Editor (Canvas) Draft"
                      : "Source Editor Draft"}
                  </PreText>
                </div>
                <span className="shrink-0 text-[10px] font-semibold text-blue-400">Resume ›</span>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Reading Progress / Paused Sessions Section */}
      {pausedSessions.length > 0 && (
        <CollapsibleSection
          label="Reading Progress"
          icon={<Clock className="h-3 w-3 text-emerald-400" />}
          count={pausedSessions.length}
          open={sessionsOpen}
          onToggle={() => setSessionsOpen(!sessionsOpen)}
        >
          <div className="max-h-[160px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-0.5 overflow-y-auto">
            {pausedSessions.map((session, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onNavigateToArticle(session.title)}
                className="text-foreground/60 hover:bg-accent/10 hover:text-foreground/90 flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition-colors"
              >
                <div className="flex min-w-0 flex-1 flex-col pr-2">
                  <PreText
                    className="truncate text-[13px] font-medium text-inherit"
                    whiteSpace="nowrap"
                  >
                    {session.title}
                  </PreText>
                  <PreText className="text-muted-foreground text-[9px]" whiteSpace="nowrap">
                    {`Last read ${formatTimeAgo(session.updatedAt)}`}
                  </PreText>
                </div>
                <span className="text-muted-foreground shrink-0 rounded border border-white/5 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                  {session.scrollPercent}%
                </span>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Recent Activity — collapsible feed (shown when on wiki index/search) */}
      {!articleTitle && (
        <CollapsibleSection
          label="Recent Activity"
          icon={<Clock className="h-3 w-3" />}
          open={recentOpen}
          onToggle={() => setRecentOpen(!recentOpen)}
        >
          {recentChanges && recentChanges.length > 0 ? (
            <div className="space-y-0.5">
              {recentChanges.map((rc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onNavigateToArticle(rc.title ?? "")}
                  className="text-foreground/60 hover:bg-accent/10 hover:text-foreground/90 flex w-full flex-col rounded-md px-2 py-1 text-left transition-colors"
                >
                  <PreText className="truncate text-[13px] text-inherit" whiteSpace="nowrap">
                    {rc.title}
                  </PreText>
                  <PreText className="text-muted-foreground text-[10px]" whiteSpace="nowrap">
                    {`${rc.user} · ${formatMWTimeAgo(rc.timestamp)}`}
                  </PreText>
                </button>
              ))}
            </div>
          ) : (
            <PreText className="text-muted-foreground px-2 text-xs" whiteSpace="nowrap">
              Loading...
            </PreText>
          )}
        </CollapsibleSection>
      )}

      {/* Page Actions — contextual to current article */}
      {articleTitle && !isMainPage && (
        <div className="border-border mb-3 border-b pb-3">
          <SectionHeader label="This Page" />
          <div className="space-y-0.5">
            {isSignedIn && (
              <QuickAction
                icon={<FileEdit />}
                label="Edit"
                shortcut="Tab Tab"
                onClick={() => {
                  onClose();
                  navigateWithBasePath(`/wiki/${slug}/edit`, router);
                }}
              />
            )}
            <QuickAction
              icon={<History />}
              label="History"
              onClick={() => {
                onClose();
                navigateWithBasePath(`/wiki/history/${slug}`, router);
              }}
            />
            <QuickAction
              icon={<Link2 />}
              label="What links here"
              onClick={() => {
                onClose();
                navigateWithBasePath(`/wiki/whatlinkshere/${slug}`, router);
              }}
            />
            <QuickAction
              icon={<ExternalLink />}
              label="View on Original Wiki"
              onClick={() => {
                onClose();
                if (articleTitle) {
                  const mwBaseUrl =
                    process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com/";
                  const targetUrl = `${mwBaseUrl.replace(/\/$/, "")}/wiki/${encodeURIComponent(articleTitle.replace(/ /g, "_"))}`;
                  window.open(targetUrl, "_blank", "noopener,noreferrer");
                }
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

export function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
      <PreText whiteSpace="nowrap">{label}</PreText>
    </div>
  );
}

export function CollapsibleSection({
  label,
  icon,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border mb-3 border-b pb-3">
      <button
        type="button"
        onClick={onToggle}
        className="text-muted-foreground hover:text-foreground mb-1 flex w-full cursor-pointer items-center justify-between text-[10px] font-semibold tracking-wider uppercase"
      >
        <span className="flex items-center gap-1">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {icon}
          <PreText className="inline-block text-inherit" whiteSpace="nowrap">
            {label}
          </PreText>
        </span>
        {count !== undefined && (
          <PreText className="text-muted-foreground/75 inline-block shrink-0" whiteSpace="nowrap">
            {String(count)}
          </PreText>
        )}
      </button>
      {open && children}
    </div>
  );
}

export function QuickAction({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactElement;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-foreground/60 hover:bg-accent/10 hover:text-foreground/90 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors"
    >
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        <PreText className="text-inherit" whiteSpace="nowrap">
          {label}
        </PreText>
      </span>
      {shortcut && (
        <PreText
          className="border-border bg-accent/10 text-muted-foreground shrink-0 rounded border px-1.5 py-0.5 text-[10px]"
          whiteSpace="nowrap"
        >
          {shortcut}
        </PreText>
      )}
    </button>
  );
}
