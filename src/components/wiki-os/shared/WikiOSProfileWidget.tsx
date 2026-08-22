// src/components/wiki-os/shared/WikiOSProfileWidget.tsx
// Sidebar profile widget — pipes the signed-in user's linked wiki profile
// (username, join date, edits, rank, lorescore/lorewards) into the WikiOS rail.
// Renders as a glass card when expanded, and as an avatar + rank badge when the
// rail is collapsed. Nothing renders when signed out.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { Calendar, FileText, Trophy, Scroll } from "lucide-react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { TextureOverlay } from "~/components/ui/texture-overlay";

function getInitials(name: string): string {
  const cleaned = name.trim().replace(/_/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function WikiOSProfileWidget({
  expanded,
  isLocalHoverExpanded = false,
}: {
  expanded: boolean;
  isLocalHoverExpanded?: boolean;
}) {
  const { user, isSignedIn } = useWikiAuth();
  const { themeColors } = useWikiContext();
  const [imgError, setImgError] = useState(false);
  const showExpanded = expanded || isLocalHoverExpanded;
  const hoverBorderColor = themeColors?.primary ?? "var(--wikios-accent)";

  // Resolve the signed-in user's consolidated profile in a single query
  const profileQuery = api.wikios.getAuthorProfile.useQuery(undefined, {
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
  });

  // Signed out → nothing.
  if (!isSignedIn) return null;

  const authorProfile = profileQuery.data;
  const displayName = authorProfile?.displayName ?? user?.username ?? "You";
  const initials = getInitials(displayName);
  const avatarUrl = !imgError ? user?.imageUrl : undefined;

  const lorescore = authorProfile?.loreScore ?? 0;
  const lorewards = authorProfile?.totalWins ?? 0;
  const rank = authorProfile?.rank ?? null;
  const registration = authorProfile?.registration ?? null;
  const editCount = authorProfile?.editCount ?? null;

  const renderAvatar = (withBadge: boolean) => (
    <div className="relative shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          onError={() => setImgError(true)}
          className="h-9 w-9 rounded-xl border border-[var(--wikios-border)] object-cover"
        />
      ) : (
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--wikios-border)] bg-white/5 text-xs font-bold text-[var(--wikios-text-muted)]">
          {initials}
        </div>
      )}
      {withBadge && rank != null && (
        <span
          className="absolute -right-1 -bottom-1 grid min-w-[14px] place-items-center rounded-full border border-[var(--wikios-border)] px-0.5 text-[8px] leading-[14px] font-bold text-white shadow-sm"
          style={{ backgroundColor: hoverBorderColor }}
        >
          #{rank}
        </span>
      )}
    </div>
  );

  const profileHref = withBasePath(`/wiki/user/${encodeURIComponent(displayName)}`);

  // ── Collapsed rail → avatar + rank badge only ──
  if (!expanded && !isLocalHoverExpanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={profileHref}
            className="hover:bg-foreground/5 flex items-center justify-center rounded-xl px-2.5 py-1 transition-all"
          >
            {renderAvatar(true)}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          {displayName}
          {rank != null ? ` · Rank #${rank}` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  // ── Hovered state in collapsed rail → single row horizontal pill ──
  if (isLocalHoverExpanded) {
    return (
      <Link
        href={profileHref}
        className="group relative z-50 flex w-max items-center rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] px-2.5 py-1 pr-4 shadow-lg backdrop-blur-md transition-all duration-300 ease-in-out outline-none"
      >
        {renderAvatar(true)}
        <span className="w-auto flex-1 overflow-hidden pl-3 text-left text-xs font-semibold whitespace-nowrap text-[var(--wikios-text-muted)] opacity-100 group-hover:text-[var(--wikios-text)]">
          {displayName}
        </span>
      </Link>
    );
  }

  // ── Expanded (Locked Sidebar) → glass profile card ──
  return (
    <Link
      href={profileHref}
      className="group bg-foreground/[0.03] hover:bg-foreground/[0.06] relative block w-full overflow-hidden rounded-xl border border-[var(--wikios-border)] p-2 transition-all hover:border-[var(--hover-border-color)]"
      style={
        {
          "--hover-border-color": hoverBorderColor,
        } as React.CSSProperties
      }
    >
      <TextureOverlay texture="chevron" opacity={0.06} className="rounded-xl" />
      <div className="relative z-10 flex items-center gap-2.5">
        {renderAvatar(true)}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--wikios-text)]">
            {displayName}
          </div>
          {rank != null && (
            <div className="text-[10px] font-semibold" style={{ color: hoverBorderColor }}>
              Rank #{rank}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-2 flex flex-col gap-1 border-t border-[var(--wikios-border)] pt-2">
        {registration && (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--wikios-text-muted)]">
            <Calendar className="h-3 w-3 shrink-0 text-[var(--wikios-text-muted)]" />
            <span className="truncate">
              Joined{" "}
              {new Date(registration).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        )}
        {editCount != null && (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--wikios-text-muted)]">
            <FileText className="h-3 w-3 shrink-0 text-[var(--wikios-text-dim)]" />
            <span className="truncate">{editCount.toLocaleString()} edits</span>
          </div>
        )}
        {lorescore > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--wikios-text-muted)]">
            <Scroll className="h-3 w-3 shrink-0 text-purple-500 dark:text-purple-400/90" />
            <span className="truncate">{lorescore.toLocaleString()} Lorescore</span>
          </div>
        )}
        {lorewards > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--wikios-text-muted)]">
            <Trophy className="h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400/90" />
            <span className="truncate">
              {lorewards.toLocaleString()} Loreward{lorewards !== 1 ? "s" : ""} won
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
