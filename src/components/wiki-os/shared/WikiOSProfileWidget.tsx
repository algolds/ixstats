// src/components/wiki-os/shared/WikiOSProfileWidget.tsx
// Sidebar profile widget — pipes the signed-in user's linked wiki profile
// (username, join date, edits, rank, lorescore/lorewards) into the WikiOS rail.
// Renders as a glass card when expanded, and as an avatar + rank badge when the
// rail is collapsed. Nothing renders when signed out.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { Calendar, FileText, Trophy, Sparkles, UserPlus } from "lucide-react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";

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
  const [imgError, setImgError] = useState(false);
  const showExpanded = expanded || isLocalHoverExpanded;

  // Resolve the signed-in user's linked wiki account.
  const status = api.ixnayid.getStatus.useQuery(undefined, {
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
  });
  const wikiUsername = status.data?.wiki.username ?? null;
  const linked = !!status.data?.wiki.linked && !!wikiUsername;

  const userInfo = api.wikios.getUserInfo.useQuery(
    { username: wikiUsername ?? "" },
    { enabled: linked, staleTime: 5 * 60 * 1000 }
  );
  const loreStats = api.lorewards.getUserStats.useQuery(
    { username: wikiUsername ?? "" },
    { enabled: linked, staleTime: 5 * 60 * 1000 }
  );

  // Signed out → nothing.
  if (!isSignedIn) return null;

  const displayName = wikiUsername ?? user?.username ?? "You";
  const initials = getInitials(displayName);
  const avatarUrl = !imgError ? user?.imageUrl : undefined;

  const stats = loreStats.data?.stats;
  const rank = loreStats.data?.rank ?? null;
  const lorescore = stats?.totalScore ?? 0;
  const lorewards = (stats?.dailyWins ?? 0) + (stats?.weeklyWins ?? 0) + (stats?.monthlyWins ?? 0);
  const info = userInfo.data;
  const registration = info && info.exists ? info.registration : null;
  const editCount = info && info.exists ? info.editCount : null;

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
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-blue-500/30 bg-blue-500/15 text-xs font-bold text-blue-300">
          {initials}
        </div>
      )}
      {withBadge && rank != null && (
        <span className="absolute -right-1 -bottom-1 grid min-w-[14px] place-items-center rounded-full border border-[var(--wikios-border)] bg-amber-500 px-0.5 text-[8px] leading-[14px] font-bold text-black shadow-sm">
          #{rank}
        </span>
      )}
    </div>
  );

  // ── Signed in but no wiki account linked ──
  if (!linked) {
    const settingsHref = withBasePath("/settings");
    if (!expanded && !isLocalHoverExpanded) {
      return (
        <Link
          href={settingsHref}
          title="Link your wiki account"
          className="flex items-center justify-center rounded-xl px-2.5 py-1 transition-all hover:bg-white/5"
        >
          {renderAvatar(false)}
        </Link>
      );
    }
    if (isLocalHoverExpanded) {
      return (
        <Link
          href={settingsHref}
          className="group relative z-50 flex w-[12rem] items-center rounded-xl border border-white/10 bg-neutral-950/90 px-2.5 py-1 shadow-lg backdrop-blur-md transition-all duration-300 ease-in-out outline-none"
        >
          {renderAvatar(false)}
          <span className="w-auto flex-1 overflow-hidden pl-3 text-left text-xs font-semibold whitespace-nowrap text-[var(--wikios-text-muted)] opacity-100 group-hover:text-[var(--wikios-text)]">
            Link wiki account
          </span>
        </Link>
      );
    }
    return (
      <Link
        href={settingsHref}
        className="group flex w-full items-center gap-2.5 rounded-xl border border-dashed border-[var(--wikios-border)] bg-white/[0.03] px-2.5 py-2 transition-all hover:bg-white/[0.07]"
      >
        {renderAvatar(false)}
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-xs font-semibold text-[var(--wikios-text)]">
            <UserPlus className="h-3 w-3 shrink-0" /> Link wiki account
          </div>
          <div className="truncate text-[10px] text-[var(--wikios-text-muted)]">
            Connect to see your profile
          </div>
        </div>
      </Link>
    );
  }

  const profileHref = withBasePath(`/wiki/user/${encodeURIComponent(wikiUsername!)}`);

  // ── Collapsed rail → avatar + rank badge only ──
  if (!expanded && !isLocalHoverExpanded) {
    return (
      <Link
        href={profileHref}
        title={`${displayName}${rank != null ? ` · Rank #${rank}` : ""}`}
        className="flex items-center justify-center rounded-xl px-2.5 py-1 transition-all hover:bg-white/5"
      >
        {renderAvatar(true)}
      </Link>
    );
  }

  // ── Hovered state in collapsed rail → single row horizontal pill ──
  if (isLocalHoverExpanded) {
    return (
      <Link
        href={profileHref}
        className="group relative z-50 flex w-[12rem] items-center rounded-xl border border-white/10 bg-neutral-950/90 px-2.5 py-1 shadow-lg backdrop-blur-md transition-all duration-300 ease-in-out outline-none"
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
      className="group block w-full rounded-xl border border-[var(--wikios-border)] bg-white/5 p-2 transition-all hover:border-blue-500/30 hover:bg-white/[0.08]"
    >
      <div className="flex items-center gap-2.5">
        {renderAvatar(true)}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--wikios-text)]">
            {displayName}
          </div>
          {rank != null && (
            <div className="text-[10px] font-medium text-amber-400">Rank #{rank}</div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1 border-t border-[var(--wikios-border)] pt-2">
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
            <FileText className="h-3 w-3 shrink-0 text-blue-400/80" />
            <span className="truncate">{editCount.toLocaleString()} edits</span>
          </div>
        )}
        {lorescore > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--wikios-text-muted)]">
            <Sparkles className="h-3 w-3 shrink-0 text-purple-400/90" />
            <span className="truncate">{lorescore.toLocaleString()} Lorescore</span>
          </div>
        )}
        {lorewards > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--wikios-text-muted)]">
            <Trophy className="h-3 w-3 shrink-0 text-amber-400/90" />
            <span className="truncate">
              {lorewards.toLocaleString()} Loreward{lorewards !== 1 ? "s" : ""} won
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
