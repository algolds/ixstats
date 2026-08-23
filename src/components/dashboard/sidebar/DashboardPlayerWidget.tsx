"use client";

import Link from "next/link";
import {
  Mail,
  WarningTriangle as AlertTriangle,
  NavArrowUp as ChevronUp,
  TaskList as ClipboardList,
  CalendarCheck,
  Group as Users,
  Dollar as DollarSign,
  Map as MapIcon,
} from "iconoir-react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import * as IconoirIcons from "iconoir-react";
import { motion } from "motion/react";
import { Skeleton } from "~/components/ui/skeleton";
import { createUrl } from "~/lib/utils";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { formatCompactNumber, formatCompactCurrency } from "~/lib/utils";

type FolderKey = "inbox" | "personal" | "diplomatic" | "discussions" | "groups" | "system";

interface DashboardPlayerWidgetProps {
  heroCollapsed?: boolean;
  onHeroExpand?: () => void;
}

export function DashboardPlayerWidget({ heroCollapsed, onHeroExpand }: DashboardPlayerWidgetProps) {
  const { user, isSignedIn } = useUser();
  const { avatarGlow, chatBadge, neonFrame } = useActiveCosmetics();
  const CrownIcon = (IconoirIcons as any)[chatBadge.icon] || IconoirIcons.Crown;

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );
  const countryId = userProfile?.countryId || "";
  const hasCountry = !!countryId;

  const { data: folderCounts } = api.messages.getFolderCounts.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );
  const { data: _activeCrises } = api.crisisEvents.getActive.useQuery(
    { limit: 5 },
    { enabled: hasCountry }
  );
  const { data: country } = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: hasCountry && !!heroCollapsed }
  );
  const { data: crisisStats } = api.crisisEvents.getStatistics.useQuery(
    { timeframe: "month" },
    { enabled: hasCountry }
  );
  const { data: pendingIssues } = api.nationalIssues.getPendingCount.useQuery(
    { countryId },
    { enabled: hasCountry }
  );
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: hasCountry }
  );
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: hasCountry }
  );
  const { data: achievements } = api.achievements.getAllWithStatus.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );

  const unlockedCollectorAchievements =
    achievements?.filter(
      (a) =>
        a.isUnlocked &&
        ["collect-lore-keeper", "collect-archaeologist", "collect-diplomat"].includes(a.key)
    ) ?? [];

  if (!isSignedIn) return null;

  if (profileLoading) {
    return (
      <CutoutCard
        className={cn(
          cutoutCardSurfaceClassName,
          "w-48 overflow-hidden rounded-2xl border border-white/10 shadow-lg backdrop-blur-xl"
        )}
        trackPointerHover={false}
      >
        <div className="relative flex min-h-[90px] flex-col items-center justify-center bg-indigo-500/10 px-3 pt-3 pb-6 backdrop-blur-md">
          <Skeleton className="h-4 w-24 rounded-full" />
          <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
          <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
        </div>
        <CutoutCardContent className="space-y-2.5 p-3 pt-1">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-md" />
        </CutoutCardContent>
      </CutoutCard>
    );
  }

  const msgFolders = folderCounts as Record<FolderKey, number> | undefined;
  const totalUnreadMessages = msgFolders ? Object.values(msgFolders).reduce((a, b) => a + b, 0) : 0;
  const crisesCount = crisisStats?.activeEvents ?? 0;

  const issueCount = pendingIssues?.total ?? 0;
  const urgentCount = pendingIssues?.urgent ?? 0;
  const activePolicies = policies?.filter((p) => p.status === "active").length ?? 0;
  const totalPolicies = policies?.length ?? 0;
  const pendingActions =
    meetings?.flatMap((m) => m.actionItems).filter((a) => a.status === "pending").length ?? 0;

  return (
    <CutoutCard
      className={cn(
        cutoutCardSurfaceClassName,
        "group relative w-48 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition-all duration-200 dark:border-white/10 dark:bg-white/[0.02] dark:shadow-black/40"
      )}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.05}
    >
      {/* Neon Frame Overlay */}
      <NeonFrameOverlay neonFrame={neonFrame} className="rounded-2xl" />
      {/* Cutout tab header */}
      <div className="relative flex min-h-[96px] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-indigo-500/15 via-indigo-900/20 to-transparent px-3 pt-3.5 pb-6 backdrop-blur-md">
        {/* Background flag filling the top */}
        {userProfile?.country?.name && (
          <div className="absolute inset-0 z-0 h-full w-full overflow-hidden">
            <UnifiedCountryFlag
              countryName={userProfile.country.name}
              flagUrl={normalizeFlagUrl(userProfile.country.flag)}
              fitContainer={true}
              showTooltip={false}
              rounded={false}
              className="h-full w-full object-cover opacity-40 brightness-90 transition-transform duration-500 ease-out group-hover:scale-105"
            />
            {/* Soft overlay gradient to ensure text readability */}
            <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/20 via-black/40 to-black/75" />
          </div>
        )}

        {/* Small Avatar/Flag with avatar glow */}
        <AvatarGlow
          avatarGlow={avatarGlow}
          roundedClass="rounded-full"
          className="relative z-20 mb-1.5 h-9 w-9 bg-indigo-950/70 shadow-lg ring-1 ring-white/20 backdrop-blur-md transition-transform duration-200 group-hover:scale-105"
        >
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : userProfile?.country?.name ? (
              <UnifiedCountryFlag
                countryName={userProfile.country.name}
                flagUrl={normalizeFlagUrl(userProfile.country.flag)}
                size="sm"
                rounded={true}
                fitContainer={true}
                showTooltip={false}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
        </AvatarGlow>

        {/* Country Name Link */}
        <Link
          href={createUrl(`/countries/${userProfile?.country?.slug ?? ""}`)}
          className="relative z-20 flex items-center justify-center gap-1 text-center text-sm font-semibold tracking-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] transition-colors hover:text-indigo-200"
        >
          <span>{userProfile?.country?.name ?? "My Country"}</span>
          {chatBadge.enabled && (
            <CrownIcon className="h-3.5 w-3.5 shrink-0" style={{ color: chatBadge.color }} />
          )}
        </Link>

        {/* Unlocked Collector Title Badges */}
        {unlockedCollectorAchievements.length > 0 && (
          <div className="relative z-20 mt-1.5 flex flex-wrap justify-center gap-1 px-1">
            {unlockedCollectorAchievements.map((ach) => (
              <span
                key={ach.key}
                title={ach.description}
                className="inline-flex cursor-help items-center gap-0.5 rounded-full border border-white/15 bg-white/10 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-white shadow-sm backdrop-blur-md transition-colors hover:bg-white/25 active:scale-[0.96]"
              >
                <span>{ach.iconUrl || "🏆"}</span>
                <span>{ach.title}</span>
              </span>
            ))}
          </div>
        )}

        <CutoutCorner className="text-card absolute -bottom-px left-0 z-20" size={16} />
        <CutoutCorner
          className="text-card absolute right-0 -bottom-px z-20 -scale-x-100"
          size={16}
        />
      </div>
      <CutoutCardContent className="space-y-2.5 p-3 pt-1">
        {/* Condensed hero stats — visible when hero is collapsed */}
        {heroCollapsed && (
          <>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium tracking-normal">
                  <Users className="h-3 w-3 text-blue-600 dark:text-blue-400" /> Pop
                </span>
                <span className="text-foreground font-semibold tabular-nums">
                  {formatCompactNumber((country as any)?.newStats?.currentPopulation ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium tracking-normal">
                  <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> GDP
                </span>
                <span className="text-foreground font-semibold tabular-nums">
                  {formatCompactCurrency((country as any)?.newStats?.currentTotalGdp ?? 0)}
                </span>
              </div>
              {(country as any)?.newStats?.landArea && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-medium tracking-normal">
                    <MapIcon className="h-3 w-3 text-amber-600 dark:text-amber-400" /> Area
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {Math.round((country as any)?.newStats?.landArea).toLocaleString()} km²
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onHeroExpand}
              className="dark:text-muted-foreground flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 py-1 text-[9px] font-medium tracking-normal text-slate-700 backdrop-blur-md transition-all hover:bg-slate-200 active:scale-[0.97] dark:border-white/5 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            >
              <ChevronUp className="h-3 w-3 rotate-180" />
              Expand
            </button>
            <div className="border-border/40 border-t" />
          </>
        )}

        {/* Compact horizontal row of quick-action icons */}
        <div className="grid grid-cols-3 gap-1.5 pt-1.5">
          {/* Messages */}
          <Link
            href="/messages"
            className="group/icon relative flex flex-col items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-2.5 backdrop-blur-md transition-all duration-150 hover:scale-[1.03] hover:bg-indigo-500/25 active:scale-[0.94] dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20"
            title={
              totalUnreadMessages > 0
                ? `${totalUnreadMessages} unread messages`
                : "No unread messages"
            }
          >
            <Mail className="h-4 w-4 text-indigo-600 transition-transform duration-150 group-hover/icon:scale-110 dark:text-indigo-400" />
            {totalUnreadMessages > 0 && (
              <span className="animate-in fade-in zoom-in-75 absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[8px] font-semibold text-white tabular-nums shadow-md dark:bg-blue-500">
                {totalUnreadMessages}
              </span>
            )}
            <span className="mt-1.5 text-[9px] font-medium tracking-normal text-indigo-800 dark:text-indigo-300">
              Mail
            </span>
          </Link>

          {/* Directives */}
          {hasCountry ? (
            <Link
              href={createUrl("/mycountry/executive")}
              className="group/icon relative flex flex-col items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/15 px-1 py-2.5 backdrop-blur-md transition-all duration-150 hover:scale-[1.03] hover:bg-amber-500/25 active:scale-[0.94] dark:border-amber-500/25 dark:bg-amber-500/10 dark:hover:bg-amber-500/20"
              title={`${issueCount} pending directives (${urgentCount} urgent)`}
            >
              <ClipboardList className="h-4 w-4 text-amber-600 transition-transform duration-150 group-hover/icon:scale-110 dark:text-amber-400" />
              {(issueCount > 0 || urgentCount > 0) && (
                <span
                  className={cn(
                    "animate-in fade-in zoom-in-75 absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-semibold text-white tabular-nums shadow-md",
                    urgentCount > 0 ? "animate-pulse bg-red-600" : "bg-amber-600 dark:bg-amber-500"
                  )}
                >
                  {urgentCount > 0 ? urgentCount : issueCount}
                </span>
              )}
              <span className="mt-1.5 max-w-full truncate text-[9px] font-medium tracking-normal text-amber-800 dark:text-amber-300">
                Directives
              </span>
            </Link>
          ) : (
            <div className="flex cursor-not-allowed flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-100/60 px-1 py-2.5 opacity-40 dark:border-white/5 dark:bg-white/[0.03]">
              <ClipboardList className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground mt-1.5 max-w-full truncate text-[9px] font-medium tracking-normal">
                Directives
              </span>
            </div>
          )}

          {/* Agenda */}
          {hasCountry ? (
            <Link
              href={createUrl("/mycountry/executive")}
              className={cn(
                "group/icon relative flex flex-col items-center justify-center rounded-xl px-1 py-2.5 backdrop-blur-md transition-all duration-150 hover:scale-[1.03] active:scale-[0.94]",
                pendingActions > 0
                  ? "border border-orange-500/35 bg-orange-500/15 hover:bg-orange-500/25 dark:border-orange-500/25 dark:bg-orange-500/10 dark:hover:bg-orange-500/20"
                  : "border border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/25 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
              )}
              title={
                pendingActions > 0 ? `${pendingActions} pending agenda items` : "All agenda clear"
              }
            >
              <CalendarCheck
                className={cn(
                  "h-4 w-4 transition-transform duration-150 group-hover/icon:scale-110",
                  pendingActions > 0
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-emerald-600 dark:text-emerald-400"
                )}
              />
              <span
                className={cn(
                  "ring-background absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full shadow-md ring-2",
                  pendingActions > 0
                    ? "bg-orange-600 dark:bg-orange-500"
                    : "bg-emerald-600 dark:bg-emerald-500"
                )}
              />
              <span
                className={cn(
                  "mt-1.5 max-w-full truncate text-[9px] font-medium tracking-normal",
                  pendingActions > 0
                    ? "text-orange-900 dark:text-orange-400"
                    : "text-emerald-900 dark:text-emerald-400"
                )}
              >
                Agenda
              </span>
            </Link>
          ) : (
            <div className="flex cursor-not-allowed flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-100/60 px-1 py-2.5 opacity-40 dark:border-white/5 dark:bg-white/[0.03]">
              <CalendarCheck className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground mt-1.5 max-w-full truncate text-[9px] font-medium tracking-normal">
                Agenda
              </span>
            </div>
          )}
        </div>

        {/* Active Crises Warning Banner */}
        {crisesCount > 0 && (
          <div className="mt-1 border-t border-red-500/20 pt-2">
            <Link
              href={createUrl("/mycountry/executive")}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 py-1.5 text-[9px] font-semibold tracking-wider text-red-700 uppercase shadow-sm shadow-red-500/10 backdrop-blur-md transition-all duration-150 hover:bg-red-500/25 active:scale-[0.96] dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
              title={`${crisesCount} active crises! Click to view.`}
            >
              <AlertTriangle className="h-3.5 w-3.5 animate-pulse text-red-600 dark:text-red-400" />
              <span>{crisesCount} Crises Active</span>
            </Link>
          </div>
        )}
      </CutoutCardContent>
    </CutoutCard>
  );
}
