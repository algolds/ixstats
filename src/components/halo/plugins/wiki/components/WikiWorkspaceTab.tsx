"use client";
// src/components/halo/plugins/wiki/components/WikiWorkspaceTab.tsx
// Quick actions, drafts manager, paused reading sessions, and recent changes feed for Halo Wiki mode.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageEdit as FileEdit,
  ClockRotateRight as History,
  Link as Link2,
  Clock,
  OpenNewWindow as ExternalLink,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { PreText } from "~/components/ui/pretext";
import { navigateWithBasePath } from "~/lib/base-path";
import { formatMWTimeAgo } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import { timeAgo } from "~/lib/format/compact";
import { getWikiBaseUrl, type WikiSource } from "~/lib/wiki-os/config";
import { type LocalDraft, type PausedSession } from "../types";

interface WikiWorkspaceTabProps {
  articleTitle?: string | null;
  /** The wiki the article lives on; another wiki's page is read-only in WikiOS (ruling E-l′). */
  wikiSource: WikiSource;
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
  /** Opens the page on its own wiki (IxWiki when none is given) */
  onNavigateToArticle: (title: string, source?: WikiSource) => void;
}

export function WikiWorkspaceTab({
  articleTitle,
  wikiSource,
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
          icon={<FileEdit className="text-blue h-3 w-3" />}
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
                className="text-label-secondary hover:bg-fill-4 hover:text-label rounded-control-sm flex w-full items-center justify-between px-2 py-1 text-left transition-colors"
              >
                <div className="flex min-w-0 flex-1 flex-col pr-2">
                  <PreText
                    className="text-callout truncate font-medium text-inherit"
                    whiteSpace="nowrap"
                  >
                    {draft.title}
                  </PreText>
                  <PreText className="text-label-secondary text-footnote" whiteSpace="nowrap">
                    {draft.type === "visual"
                      ? "Visual Editor (Canvas) Draft"
                      : "Source Editor Draft"}
                  </PreText>
                </div>
                <span className="text-caption text-blue shrink-0 font-semibold">Resume ›</span>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Reading Progress / Paused Sessions Section */}
      {pausedSessions.length > 0 && (
        <CollapsibleSection
          label="Reading Progress"
          icon={<Clock className="text-green h-3 w-3" />}
          count={pausedSessions.length}
          open={sessionsOpen}
          onToggle={() => setSessionsOpen(!sessionsOpen)}
        >
          <div className="max-h-[160px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-0.5 overflow-y-auto">
            {pausedSessions.map((session, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onNavigateToArticle(session.title, session.source)}
                className="text-label-secondary hover:bg-fill-4 hover:text-label rounded-control-sm flex w-full items-center justify-between px-2 py-1 text-left transition-colors"
              >
                <div className="flex min-w-0 flex-1 flex-col pr-2">
                  <PreText
                    className="text-callout truncate font-medium text-inherit"
                    whiteSpace="nowrap"
                  >
                    {session.title}
                  </PreText>
                  <PreText className="text-label-secondary text-footnote" whiteSpace="nowrap">
                    {`Last read ${timeAgo(session.updatedAt)}`}
                  </PreText>
                </div>
                <span className="text-label-secondary rounded-control-sm border-separator bg-fill-4 text-caption shrink-0 border px-1.5 py-0.5 font-semibold tabular-nums">
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
                  className="text-label-secondary hover:bg-fill-4 hover:text-label rounded-control-sm flex w-full flex-col px-2 py-1 text-left transition-colors"
                >
                  <PreText className="text-callout truncate text-inherit" whiteSpace="nowrap">
                    {rc.title}
                  </PreText>
                  <PreText className="text-label-secondary text-footnote" whiteSpace="nowrap">
                    {`${rc.user} · ${formatMWTimeAgo(rc.timestamp)}`}
                  </PreText>
                </button>
              ))}
            </div>
          ) : (
            <PreText className="text-label-secondary text-footnote px-2" whiteSpace="nowrap">
              Loading...
            </PreText>
          )}
        </CollapsibleSection>
      )}

      {/* Page Actions — contextual to current article */}
      {articleTitle && !isMainPage && (
        <div className="border-separator mb-3 border-b pb-3">
          <SectionHeader label="This Page" />
          <div className="space-y-0.5">
            {wikiSource === "ixwiki" && (
              <IxWikiPageActions isSignedIn={isSignedIn} slug={slug} onClose={onClose} />
            )}
            <QuickAction
              icon={<ExternalLink />}
              label="View on Original Wiki"
              onClick={() => {
                onClose();
                if (articleTitle) {
                  const mwBaseUrl = getWikiBaseUrl(wikiSource);
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

/** Edit, History and What links here act on the IxWiki page, so another wiki's page has none. */
function IxWikiPageActions({
  isSignedIn,
  slug,
  onClose,
}: Pick<WikiWorkspaceTabProps, "isSignedIn" | "slug" | "onClose">) {
  const router = useRouter();
  return (
    <>
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
    </>
  );
}

export function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-label-secondary text-subhead mb-1.5">
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
    <div className="border-separator mb-3 border-b pb-3">
      <button
        type="button"
        onClick={onToggle}
        className="text-label-secondary hover:text-label text-subhead mb-1 flex w-full cursor-pointer items-center justify-between"
      >
        <span className="flex items-center gap-1">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {icon}
          <PreText className="inline-block text-inherit" whiteSpace="nowrap">
            {label}
          </PreText>
        </span>
        {count !== undefined && (
          <PreText className="text-label-secondary inline-block shrink-0" whiteSpace="nowrap">
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
      className="text-label-secondary hover:bg-fill-4 hover:text-label rounded-control-sm text-body flex w-full items-center justify-between px-2 py-1.5 text-left transition-colors"
    >
      <span className="flex items-center gap-2">
        <span className="text-label-secondary [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        <PreText className="text-inherit" whiteSpace="nowrap">
          {label}
        </PreText>
      </span>
      {shortcut && (
        <PreText
          className="border-separator bg-fill-4 text-label-secondary rounded-control-sm text-footnote shrink-0 border px-1.5 py-0.5"
          whiteSpace="nowrap"
        >
          {shortcut}
        </PreText>
      )}
    </button>
  );
}
