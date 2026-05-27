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
import { Skeleton } from "~/components/ui/skeleton";
import { createUrl } from "~/lib/url-utils";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
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

  if (!isSignedIn) return null;

  if (profileLoading) {
    return (
      <CutoutCard
        className={cn(cutoutCardSurfaceClassName, "w-48 overflow-hidden rounded-xl")}
        trackPointerHover={false}
      >
        <div className="relative bg-indigo-500/10 px-3 pt-2.5 pb-4">
          <div className="text-card-foreground flex items-center gap-1.5 text-xs font-bold">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-3 w-20" />
          </div>
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
      className={cn(cutoutCardSurfaceClassName, "w-48 overflow-hidden rounded-xl")}
      trackPointerHover={false}
    >
      {/* Cutout tab header */}
      <div className="relative bg-indigo-500/10 px-3 pt-2.5 pb-5">
        <div className="flex items-center gap-1.5">
          <UnifiedCountryFlag
            countryName={userProfile?.country?.name ?? ""}
            size="xs"
            className="shrink-0"
          />
        </div>
        <PreText className="text-card-foreground/80 mt-1 text-center text-sm">
          {userProfile?.country?.name ?? "My Country"}
        </PreText>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
      </div>
      <CutoutCardContent className="space-y-2.5 p-3 pt-1">
        {/* Condensed hero stats — visible when hero is collapsed */}
        {heroCollapsed && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                  <Users className="h-3 w-3 text-blue-400" /> Pop
                </span>
                <span className="text-foreground text-[10px] font-semibold">
                  {formatCompactNumber((country as any)?.newStats?.currentPopulation ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                  <DollarSign className="h-3 w-3 text-emerald-400" /> GDP
                </span>
                <span className="text-foreground text-[10px] font-semibold">
                  {formatCompactCurrency((country as any)?.newStats?.currentTotalGdp ?? 0)}
                </span>
              </div>
              {(country as any)?.newStats?.landArea && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                    <MapIcon className="h-3 w-3 text-amber-400" /> Area
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
                      <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600 dark:text-blue-400">
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
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-500">
                  <ClipboardList className="h-3 w-3" />
                  Issues
                </span>
                <span className="flex items-center gap-1">
                  {urgentCount > 0 && (
                    <span className="rounded-full bg-red-500 px-1 py-0.5 text-[7px] font-bold text-white">
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
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-blue-500">
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
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-500">
                  <Layers className="h-3 w-3" />
                  Actions
                </span>
                <span
                  className={`text-[9px] font-medium ${pendingActions > 0 ? "text-orange-500" : "text-emerald-500"}`}
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
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                  Crises
                </span>
                <span className="text-[10px] font-semibold text-red-500">{crisesCount}</span>
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
