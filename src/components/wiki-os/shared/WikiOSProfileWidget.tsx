"use client";
// Sidebar profile widget — pipes the signed-in user's linked wiki profile
// (username, join date, edits, rank, lorescore/lorewards) into the WikiOS rail.
// Renders as a glass card when expanded, and as an avatar + rank badge when the
// rail is collapsed. Nothing renders when signed out.

import { useState } from "react";
import Link from "next/link";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { Calendar, Page as FileText, Trophy, OpenBook as Scroll } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { getWikiProfilePath } from "~/lib/wiki-os/profile-url";
import { getInitials } from "~/components/wiki-os/margin/shared/MarginUserAvatar";

interface ProfileStat {
  key: string;
  Icon: typeof Calendar;
  iconClass: string;
  text: string;
}

function profileStats(
  profile: RouterOutputs["wikios"]["getAuthorProfile"] | undefined
): ProfileStat[] {
  const registration = profile?.registration ?? null;
  const editCount = profile?.editCount ?? null;
  const lorescore = profile?.loreScore ?? 0;
  const lorewards = profile?.totalWins ?? 0;
  return [
    registration && {
      key: "joined",
      Icon: Calendar,
      iconClass: "text-label-secondary",
      text: `Joined ${new Date(registration).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
    },
    editCount != null && {
      key: "edits",
      Icon: FileText,
      iconClass: "text-label-secondary",
      text: `${editCount.toLocaleString()} edits`,
    },
    lorescore > 0 && {
      key: "lorescore",
      Icon: Scroll,
      iconClass: "text-indigo",
      text: `${lorescore.toLocaleString()} Lorescore`,
    },
    lorewards > 0 && {
      key: "lorewards",
      Icon: Trophy,
      iconClass: "text-yellow",
      text: `${lorewards.toLocaleString()} Loreward${lorewards !== 1 ? "s" : ""} won`,
    },
  ].filter(Boolean) as ProfileStat[];
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

  const rank = authorProfile?.rank ?? null;

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

  const stats = profileStats(authorProfile);

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
        {stats.map(({ key, Icon, iconClass, text }) => (
          <div key={key} className="text-footnote text-label-secondary flex items-center gap-2">
            <Icon className={`${iconClass} h-3 w-3 shrink-0`} />
            <span className="truncate">{text}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}
