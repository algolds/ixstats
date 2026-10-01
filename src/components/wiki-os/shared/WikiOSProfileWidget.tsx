"use client";
// src/components/wiki-os/shared/WikiOSProfileWidget.tsx
// Sidebar profile widget — pipes the signed-in user's linked wiki profile
// (username, join date, edits, rank, lorescore/lorewards) into the WikiOS rail.
// Renders as a glass card when expanded, and as an avatar + rank badge when the
// rail is collapsed. Nothing renders when signed out.

import { useState } from "react";
import Link from "next/link";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { Calendar, Page as FileText, Trophy, OpenBook as Scroll } from "iconoir-react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { getWikiProfilePath } from "~/lib/wiki-os/profile-url";
import { useWikiChromePrefs } from "~/components/wiki-os/shared/WikiChromePrefs";

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
  const { user, isSignedIn, isLoaded } = useWikiAuth();
  const { mayBeSignedIn } = useWikiChromePrefs();
  const { themeColors } = useWikiContext();
  const [imgError, setImgError] = useState(false);
  // oxlint-disable-next-line eslint/no-unused-vars
  const showExpanded = expanded || isLocalHoverExpanded;
  const hoverBorderColor = themeColors?.primary ?? "var(--wikios-accent)";

  // Resolve the signed-in user's consolidated profile in a single query
  const profileQuery = api.wikios.getAuthorProfile.useQuery(undefined, {
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
  });

  // Signed out → nothing. While the auth provider loads, a browser that carries a session holds the
  // widget's place (its collapsed height, a 36px avatar row), so the rail's menu does not drop by that
  // much when the profile arrives.
  if (!isSignedIn) {
    return !isLoaded && mayBeSignedIn ? (
      <div aria-hidden="true" className={expanded || isLocalHoverExpanded ? "h-24" : "h-11"} />
    ) : null;
  }

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
          className="rounded-row border-separator h-9 w-9 border object-cover"
        />
      ) : (
        <div className="rounded-row border-separator bg-fill-4 text-caption text-label-secondary grid h-9 w-9 place-items-center border font-semibold">
          {initials}
        </div>
      )}
      {withBadge && rank != null && (
        <span
          className="border-separator text-caption shadow-card absolute -right-1 -bottom-1 grid min-w-[14px] place-items-center rounded-full border px-0.5 leading-[14px] font-semibold text-white"
          style={{ backgroundColor: hoverBorderColor }}
        >
          #{rank}
        </span>
      )}
    </div>
  );

  const profileHref = withBasePath(getWikiProfilePath(displayName));

  // ── Collapsed rail → avatar + rank badge only ──
  if (!expanded && !isLocalHoverExpanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={profileHref}
            className="hover:bg-fill-4 rounded-row flex items-center justify-center px-3 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
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
        className="group rounded-row border-separator bg-surface shadow-floating relative z-50 flex w-max items-center border px-3 py-1 pr-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ease-in-out outline-none"
      >
        {renderAvatar(true)}
        <span className="text-caption text-label-secondary group-hover:text-label w-auto flex-1 overflow-hidden pl-3 text-left font-semibold whitespace-nowrap opacity-100">
          {displayName}
        </span>
      </Link>
    );
  }

  // ── Expanded (Locked Sidebar) → glass profile card ──
  return (
    <Link
      href={profileHref}
      className="group bg-fill-4 hover:bg-fill-3 rounded-row border-separator relative block w-full overflow-hidden border p-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:border-[var(--hover-border-color)]"
      style={
        {
          "--hover-border-color": hoverBorderColor,
        } as React.CSSProperties
      }
    >
      <TextureOverlay texture="chevron" opacity={0.05} className="rounded-row" />
      <div className="relative z-10 flex items-center gap-2">
        {renderAvatar(true)}
        <div className="min-w-0 flex-1">
          <div className="text-headline text-label truncate">{displayName}</div>
          {rank != null && (
            <div className="text-caption font-semibold" style={{ color: hoverBorderColor }}>
              Rank #{rank}
            </div>
          )}
        </div>
      </div>

      <div className="border-separator relative z-10 mt-2 flex flex-col gap-1 border-t pt-2">
        {registration && (
          <div className="text-footnote text-label-secondary flex items-center gap-2">
            <Calendar className="text-label-secondary h-3 w-3 shrink-0" />
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
          <div className="text-footnote text-label-secondary flex items-center gap-2">
            <FileText className="text-label-secondary h-3 w-3 shrink-0" />
            <span className="truncate">{editCount.toLocaleString()} edits</span>
          </div>
        )}
        {lorescore > 0 && (
          <div className="text-footnote text-label-secondary flex items-center gap-2">
            <Scroll className="text-indigo h-3 w-3 shrink-0" />
            <span className="truncate">{lorescore.toLocaleString()} Lorescore</span>
          </div>
        )}
        {lorewards > 0 && (
          <div className="text-footnote text-label-secondary flex items-center gap-2">
            <Trophy className="text-yellow h-3 w-3 shrink-0" />
            <span className="truncate">
              {lorewards.toLocaleString()} Loreward{lorewards !== 1 ? "s" : ""} won
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
