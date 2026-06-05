"use client";

import Link from "next/link";
import {
  Mail,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  FileText,
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
import { PreText } from "~/components/ui/pretext";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { formatCompactNumber, formatCompactCurrency } from "~/lib/format-utils";

type FolderKey = "inbox" | "personal" | "diplomatic" | "discussions" | "groups" | "system";

const FOLDER_LABELS: Record<FolderKey, { label: string; icon: typeof MessageSquare }> = {
  inbox: { label: "Inbox", icon: Mail },
  personal: { label: "Personal", icon: MessageSquare },
  diplomatic: { label: "Diplomatic", icon: MessageSquare },
  discussions: { label: "Discussions", icon: MessageSquare },
  groups: { label: "Groups", icon: MessageSquare },
  system: { label: "System", icon: MessageSquare },
};

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
  const { data: activeCrises } = api.crisisEvents.getActive.useQuery(
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
  const hasMessages = msgFolders && Object.values(msgFolders).some((c) => c > 0);
  const activeCrisesList = activeCrises ?? [];
  const crisesCount = crisisStats?.activeEvents ?? 0;

  const issueCount = pendingIssues?.total ?? 0;
  const urgentCount = pendingIssues?.urgent ?? 0;
  const activePolicies = policies?.filter((p) => p.status === "active").length ?? 0;
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
          className="relative z-20 mb-1.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-indigo-950/60 shadow-md backdrop-blur-sm"
          style={
            avatarGlow.enabled
              ? {
                  boxShadow: `0 0 ${avatarGlow.intensity} ${avatarGlow.color}`,
                  border: `1px solid ${avatarGlow.color}`,
                }
              : undefined
          }
        >
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
                    {formatCompactNumber((country as any)?.newStats?.landArea)} km²
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
        {/* Messages */}
        <div className="space-y-1.5">
          <Link href={"/messages"} className="group flex items-center justify-between">
            <span className="text-foreground flex items-center gap-1.5 text-[10px] font-semibold">
              <Mail className="h-3.5 w-3.5" />
              Messages
            </span>
            {hasMessages && (
              <ChevronRight className="text-muted-foreground h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </Link>
          {hasMessages ? (
            <div className="space-y-1">
              {(Object.entries(FOLDER_LABELS) as [FolderKey, { label: string; icon: any }][]).map(
                ([key, config]) => {
                  const count = msgFolders![key] ?? 0;
                  if (count === 0) return null;
                  const Icon = config.icon;
                  return (
                    <div
                      key={key}
                      className="bg-muted/40 flex items-center justify-between rounded-md px-2 py-1"
                    >
                      <span className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </span>
                      <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600 dark:text-blue-400">
                        {count}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <p className="text-muted-foreground px-1 text-[9px]">No unread messages</p>
          )}
        </div>

        {/* Issues / Policies / Actions */}
        {hasCountry && (
          <>
            <div className="border-border/40 border-t" />
            <div className="space-y-1">
              {/* Issues */}
              <Link
                href={createUrl("/mycountry/executive")}
                className="group flex items-center justify-between rounded-md bg-amber-500/5 px-2 py-1.5 transition-colors hover:bg-amber-500/10"
              >
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-500">
                  <ClipboardList className="h-3 w-3" />
                  Issues
                </span>
                <span className="flex items-center gap-1">
                  {urgentCount > 0 && (
                    <span className="rounded-md bg-red-500 px-1 py-0.5 text-[7px] font-bold text-white">
                      {urgentCount}
                    </span>
                  )}
                  <span className="text-muted-foreground text-[9px] font-medium">{issueCount}</span>
                </span>
              </Link>

              {/* Policies */}
              <Link
                href={createUrl("/mycountry/executive")}
                className="group flex items-center justify-between rounded-md bg-blue-500/5 px-2 py-1.5 transition-colors hover:bg-blue-500/10"
              >
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-500">
                  <FileText className="h-3 w-3" />
                  Policies
                </span>
                <span className="text-muted-foreground text-[9px] font-medium">
                  {activePolicies}/{totalPolicies}
                </span>
              </Link>

              {/* Actions */}
              <Link
                href={createUrl("/mycountry/executive")}
                className="group flex items-center justify-between rounded-md bg-emerald-500/5 px-2 py-1.5 transition-colors hover:bg-emerald-500/10"
              >
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-500">
                  <Layers className="h-3 w-3" />
                  Actions
                </span>
                <span
                  className={`text-[9px] font-medium ${pendingActions > 0 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"}`}
                >
                  {pendingActions > 0 ? `${pendingActions} pending` : "All clear"}
                </span>
              </Link>
            </div>
          </>
        )}

        {/* Active Crises */}
        {crisesCount > 0 && (
          <>
            <div className="border-border/40 border-t" />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1 text-[9px] font-medium">
                  <AlertTriangle className="h-3 w-3 text-red-500 dark:text-red-400" />
                  Crises
                </span>
                <span className="text-[10px] font-semibold text-red-600 dark:text-red-500">
                  {crisesCount}
                </span>
              </div>
              {activeCrisesList.length > 0 && (
                <p className="text-muted-foreground truncate text-[10px]">
                  • {activeCrisesList[0]?.title ?? activeCrisesList[0]?.type ?? "Ongoing"}
                </p>
              )}
            </div>
          </>
        )}
      </CutoutCardContent>
    </CutoutCard>
  );
}
