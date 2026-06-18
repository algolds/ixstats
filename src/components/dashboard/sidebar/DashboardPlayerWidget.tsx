"use client";

import Link from "next/link";
import {
  Mail,
  AlertTriangle,
  ChevronUp,
  ClipboardList,
  Layers,
  Users,
  DollarSign,
  Map as MapIcon,
} from "lucide-react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import * as LucideIcons from "lucide-react";
import { motion } from "motion/react";
import { Skeleton } from "~/components/ui/skeleton";
import { createUrl } from "~/lib/url-utils";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/unified-flag-service";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { formatCompactNumber, formatCompactCurrency } from "~/lib/format-utils";

type FolderKey = "inbox" | "personal" | "diplomatic" | "discussions" | "groups" | "system";

interface DashboardPlayerWidgetProps {
  heroCollapsed?: boolean;
  onHeroExpand?: () => void;
}

export function DashboardPlayerWidget({ heroCollapsed, onHeroExpand }: DashboardPlayerWidgetProps) {
  const { user, isSignedIn } = useUser();
  const { avatarGlow, chatBadge, neonFrame } = useActiveCosmetics();
  const CrownIcon = (LucideIcons as any)[chatBadge.icon] || LucideIcons.Crown;

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
        className={cn(cutoutCardSurfaceClassName, "w-48 overflow-hidden rounded-xl")}
        trackPointerHover={false}
      >
        <div className="relative flex min-h-[80px] flex-col items-center justify-center bg-indigo-500/10 px-3 pt-3 pb-6">
          <Skeleton className="h-4 w-24 rounded-sm" />
          <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
          <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
        </div>
        <CutoutCardContent className="space-y-2.5 p-3 pt-0">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </CutoutCardContent>
      </CutoutCard>
    );
  }

  const msgFolders = folderCounts as Record<FolderKey, number> | undefined;
  const totalUnreadMessages = msgFolders ? Object.values(msgFolders).reduce((a, b) => a + b, 0) : 0;
  const crisesCount = crisisStats?.activeEvents ?? 0;

  const issueCount = pendingIssues?.total ?? 0;
  const urgentCount = pendingIssues?.urgent ?? 0;
  // eslint-disable-next-line unused-imports/no-unused-vars
  const activePolicies = policies?.filter((p) => p.status === "active").length ?? 0;
  // eslint-disable-next-line unused-imports/no-unused-vars
  const totalPolicies = policies?.length ?? 0;
  const pendingActions =
    meetings?.flatMap((m) => m.actionItems).filter((a) => a.status === "pending").length ?? 0;

  return (
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "group relative w-48 overflow-hidden rounded-xl")}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.06}
    >
      {/* Neon Frame Overlay */}
      {neonFrame.enabled && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-30 rounded-xl"
          style={{
            border: `2px solid ${neonFrame.color}`,
            boxShadow: `0 0 12px ${neonFrame.color}, inset 0 0 8px ${neonFrame.color}`,
          }}
          animate={
            neonFrame.style === "pulse"
              ? {
                  opacity: [0.5, 1, 0.5],
                }
              : undefined
          }
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
      {/* Cutout tab header */}
      <div className="relative flex min-h-[90px] flex-col items-center justify-center overflow-hidden bg-indigo-500/10 px-3 pt-3 pb-6">
        {/* Background flag filling the top */}
        {userProfile?.country?.name && (
          <div className="absolute inset-0 z-0 h-full w-full overflow-hidden">
            <UnifiedCountryFlag
              countryName={userProfile.country.name}
              flagUrl={normalizeFlagUrl(userProfile.country.flag)}
              fitContainer={true}
              showTooltip={false}
              rounded={false}
              className="h-full w-full object-cover opacity-45 brightness-75 transition-all duration-300 group-hover:scale-105"
            />
            {/* Soft overlay gradient to ensure text readability */}
            <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/10 via-black/25 to-black/50" />
          </div>
        )}

        {/* Small Avatar/Flag with avatar glow */}
        <div
          className={cn(
            "relative z-20 mb-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-950/60 shadow-md backdrop-blur-sm",
            !avatarGlow.enabled && "border border-white/20"
          )}
          style={
            avatarGlow.enabled
              ? {
                  boxShadow: `0 0 ${avatarGlow.intensity} ${avatarGlow.color}`,
                  border: `1px solid ${avatarGlow.color}`,
                }
              : undefined
          }
        >
          <div className="overflow-hidden rounded-full h-full w-full flex items-center justify-center">
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
        </div>

        {/* Country Name Link */}
        <Link
          href={createUrl(`/countries/${userProfile?.country?.slug ?? ""}`)}
          className="relative z-20 flex items-center justify-center gap-1 text-center text-sm font-bold tracking-wide text-white drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.8)] hover:text-white/80 hover:underline"
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
                className="inline-flex cursor-help items-center gap-0.5 rounded-full border border-white/10 bg-white/10 px-1.5 py-0.5 text-[8px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] backdrop-blur-md transition-colors hover:bg-white/20"
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                  <Users className="h-3 w-3 text-blue-500 dark:text-blue-400" /> Pop
                </span>
                <span className="text-foreground text-[10px] font-semibold">
                  {formatCompactNumber((country as any)?.newStats?.currentPopulation ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                  <DollarSign className="h-3 w-3 text-emerald-500 dark:text-emerald-400" /> GDP
                </span>
                <span className="text-foreground text-[10px] font-semibold">
                  {formatCompactCurrency((country as any)?.newStats?.currentTotalGdp ?? 0)}
                </span>
              </div>
              {(country as any)?.newStats?.landArea && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                    <MapIcon className="h-3 w-3 text-amber-500 dark:text-amber-400" /> Area
                  </span>
                  <span className="text-foreground text-[10px] font-semibold">
                    {Math.round((country as any)?.newStats?.landArea).toLocaleString()} km²
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onHeroExpand}
              className="text-muted-foreground hover:text-foreground bg-muted/40 flex w-full cursor-pointer items-center justify-center gap-1 rounded-md px-2 py-1 text-[9px] transition-colors"
            >
              <ChevronUp className="h-3 w-3 rotate-180" />
              Expand
            </button>
            <div className="border-border/40 border-t" />
          </>
        )}

        {/* Compact horizontal row of quick-action icons */}
        <div className="grid grid-cols-3 gap-1.5 pt-2">
          {/* Messages */}
          <Link
            href="/messages"
            className="group/icon relative flex flex-col items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2 py-2.5 transition-all hover:scale-105 hover:bg-indigo-500/20"
            title={
              totalUnreadMessages > 0
                ? `${totalUnreadMessages} unread messages`
                : "No unread messages"
            }
          >
            <Mail className="h-4 w-4 text-indigo-600 transition-colors dark:text-indigo-400" />
            {totalUnreadMessages > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[8px] font-bold text-white shadow-sm">
                {totalUnreadMessages}
              </span>
            )}
            <span className="mt-1.5 text-[9px] font-semibold tracking-normal text-indigo-600 uppercase dark:text-indigo-400">
              Mail
            </span>
          </Link>

          {/* Issues */}
          {hasCountry ? (
            <Link
              href={createUrl("/mycountry/executive")}
              className="group/icon relative flex flex-col items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-2.5 transition-all hover:scale-105 hover:bg-amber-500/20"
              title={`${issueCount} pending issues (${urgentCount} urgent)`}
            >
              <ClipboardList className="h-4 w-4 text-amber-600 transition-colors dark:text-amber-500" />
              {(issueCount > 0 || urgentCount > 0) && (
                <span
                  className={cn(
                    "absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold text-white shadow-sm",
                    urgentCount > 0 ? "animate-pulse bg-red-500" : "bg-amber-500"
                  )}
                >
                  {urgentCount > 0 ? urgentCount : issueCount}
                </span>
              )}
              <span className="mt-1.5 text-[9px] font-semibold tracking-normal text-amber-600 uppercase dark:text-amber-500">
                Issues
              </span>
            </Link>
          ) : (
            <div className="flex cursor-not-allowed flex-col items-center justify-center rounded-lg border border-white/5 bg-white/5 px-2 py-2.5 opacity-35">
              <ClipboardList className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground mt-1.5 text-[9px] font-semibold tracking-normal uppercase">
                Issues
              </span>
            </div>
          )}

          {/* Actions */}
          {hasCountry ? (
            <Link
              href={createUrl("/mycountry/executive")}
              className={cn(
                "group/icon relative flex flex-col items-center justify-center rounded-lg px-2 py-2.5 transition-all hover:scale-105",
                pendingActions > 0
                  ? "border border-orange-500/20 bg-orange-500/10 hover:bg-orange-500/20"
                  : "border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20"
              )}
              title={pendingActions > 0 ? `${pendingActions} pending actions` : "All actions clear"}
            >
              <Layers
                className={cn(
                  "h-4 w-4 transition-colors",
                  pendingActions > 0 ? "text-orange-500" : "text-emerald-600 dark:text-emerald-400"
                )}
              />
              <span
                className={cn(
                  "absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full shadow-sm",
                  pendingActions > 0 ? "bg-orange-500" : "bg-emerald-500"
                )}
              />
              <span
                className={cn(
                  "mt-1.5 text-[9px] font-semibold tracking-normal uppercase",
                  pendingActions > 0 ? "text-orange-500" : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                Actions
              </span>
            </Link>
          ) : (
            <div className="flex cursor-not-allowed flex-col items-center justify-center rounded-lg border border-white/5 bg-white/5 px-2 py-2.5 opacity-35">
              <Layers className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground mt-1.5 text-[9px] font-semibold tracking-normal uppercase">
                Actions
              </span>
            </div>
          )}
        </div>

        {/* Active Crises Warning Banner */}
        {crisesCount > 0 && (
          <div className="mt-1 border-t border-red-500/15 pt-2">
            <Link
              href={createUrl("/mycountry/executive")}
              className="flex animate-pulse items-center justify-center gap-1.5 rounded border border-red-500/10 bg-red-500/5 py-1 text-red-500 transition-colors hover:bg-red-500/10"
              title={`${crisesCount} active crises! Click to view.`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-[9px] font-bold tracking-wider uppercase">
                {crisesCount} Crises Active
              </span>
            </Link>
          </div>
        )}
      </CutoutCardContent>
    </CutoutCard>
  );
}
