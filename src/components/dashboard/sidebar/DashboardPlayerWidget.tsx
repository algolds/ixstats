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
import { Skeleton } from "~/components/ui/skeleton";
import { createUrl } from "~/lib/utils";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatCompactNumber, formatCompactCurrency } from "~/lib/utils";

const QUICK_ACTION =
  "text-body text-label bg-fill-4 hover:bg-fill-3 rounded-row focus-visible:outline-tint flex min-h-9 min-w-0 items-center gap-2 px-2 py-2 focus-visible:outline-2 focus-visible:outline-offset-2";
const QUICK_ACTION_ICON = "text-label-secondary size-4 shrink-0";
const QUICK_ACTION_DISABLED =
  "text-body text-label-tertiary bg-fill-4 rounded-row flex min-h-9 min-w-0 cursor-not-allowed items-center gap-2 px-2 py-2";

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
      <Card className="w-48">
        <div className="flex min-h-[90px] flex-col items-center justify-center px-3 pt-3">
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
        <div className="space-y-2 p-3">
          <Skeleton className="rounded-control-sm h-4 w-24" />
          <Skeleton className="rounded-control-sm h-4 w-20" />
          <Skeleton className="rounded-control-sm h-4 w-28" />
        </div>
      </Card>
    );
  }

  const msgFolders = folderCounts as Record<FolderKey, number> | undefined;
  const totalUnreadMessages = msgFolders ? Object.values(msgFolders).reduce((a, b) => a + b, 0) : 0;
  const crisesCount = crisisStats?.activeEvents ?? 0;

  const issueCount = pendingIssues?.total ?? 0;
  const urgentCount = pendingIssues?.urgent ?? 0;
  const pendingActions =
    meetings?.flatMap((m) => m.actionItems).filter((a) => a.status === "pending").length ?? 0;

  return (
    <Card className="w-48 overflow-hidden">
      <NeonFrameOverlay neonFrame={neonFrame} className="rounded-card" />
      <div className="relative flex flex-col items-center justify-center px-3 pt-4 pb-2">
        {/* Small Avatar/Flag with avatar glow */}
        <AvatarGlow
          avatarGlow={avatarGlow}
          roundedClass="rounded-full"
          className="bg-tint relative mb-2 h-9 w-9"
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

        <Link
          href={createUrl(`/countries/${userProfile?.country?.slug ?? ""}`)}
          className="text-headline text-label focus-visible:outline-tint rounded-control-sm relative flex items-center justify-center gap-1 text-center underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span>{userProfile?.country?.name ?? "MyCountry"}</span>
          {chatBadge.enabled && (
            <CrownIcon
              aria-hidden
              className="size-3.5 shrink-0"
              style={{ color: chatBadge.color }}
            />
          )}
        </Link>

        {/* Unlocked Collector Title Badges */}
        {unlockedCollectorAchievements.length > 0 && (
          <div className="relative mt-2 flex flex-wrap justify-center gap-1 px-1">
            {unlockedCollectorAchievements.map((ach) => (
              <Badge
                key={ach.key}
                title={ach.description}
                variant="default"
                className="cursor-help"
              >
                <span>{ach.iconUrl || "🏆"}</span>
                <span>{ach.title}</span>
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="relative space-y-2 p-3 pt-1">
        {/* Condensed hero stats, shown when the hero is collapsed */}
        {heroCollapsed && (
          <>
            <dl className="space-y-1">
              <div className="text-footnote flex items-center justify-between">
                <dt className="text-label-secondary flex items-center gap-2">
                  <Users aria-hidden className="text-blue size-3.5" /> Pop
                </dt>
                <dd className="text-label font-medium tabular-nums">
                  {formatCompactNumber((country as any)?.newStats?.currentPopulation ?? 0)}
                </dd>
              </div>
              <div className="text-footnote flex items-center justify-between">
                <dt className="text-label-secondary flex items-center gap-2">
                  <DollarSign aria-hidden className="text-green size-3.5" /> GDP
                </dt>
                <dd className="text-label font-medium tabular-nums">
                  {formatCompactCurrency((country as any)?.newStats?.currentTotalGdp ?? 0)}
                </dd>
              </div>
              {(country as any)?.newStats?.landArea && (
                <div className="text-footnote flex items-center justify-between">
                  <dt className="text-label-secondary flex items-center gap-2">
                    <MapIcon aria-hidden className="text-yellow size-3.5" /> Area
                  </dt>
                  <dd className="text-label font-medium tabular-nums">
                    {Math.round((country as any)?.newStats?.landArea).toLocaleString()} km²
                  </dd>
                </div>
              )}
            </dl>
            <Button variant="secondary" size="sm" onClick={onHeroExpand} className="w-full">
              <ChevronUp className="rotate-180" />
              Expand
            </Button>
            <div className="border-separator border-t" />
          </>
        )}

        {/* Quick actions: full-width rows, since three columns in the 12rem sidebar are narrower
            than the labels at the 12px minimum text size. */}
        <div className="grid grid-cols-1 gap-1">
          {/* Messages */}
          <Link
            href="/messages"
            className={QUICK_ACTION}
            title={
              totalUnreadMessages > 0
                ? `${totalUnreadMessages} unread messages`
                : "No unread messages"
            }
          >
            <Mail aria-hidden className={QUICK_ACTION_ICON} />
            <span className="min-w-0 flex-1 truncate">Mail</span>
            {totalUnreadMessages > 0 && (
              <Badge variant="secondary">
                {totalUnreadMessages}
                <span className="sr-only"> unread</span>
              </Badge>
            )}
          </Link>

          {/* Directives */}
          {hasCountry ? (
            <Link
              href={createUrl("/mycountry/executive?focus=directives")}
              className={QUICK_ACTION}
              title={`${issueCount} pending directives (${urgentCount} urgent)`}
            >
              <ClipboardList aria-hidden className={QUICK_ACTION_ICON} />
              <span className="min-w-0 flex-1 truncate">Directives</span>
              {(issueCount > 0 || urgentCount > 0) && (
                <Badge variant={urgentCount > 0 ? "destructive" : "warning"}>
                  {urgentCount > 0 ? urgentCount : issueCount}
                  <span className="sr-only">{urgentCount > 0 ? " urgent" : " pending"}</span>
                </Badge>
              )}
            </Link>
          ) : (
            <div aria-disabled className={cn(QUICK_ACTION_DISABLED)}>
              <ClipboardList aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 truncate">Directives</span>
            </div>
          )}

          {/* Agenda */}
          {hasCountry ? (
            <Link
              href={createUrl("/mycountry/executive?focus=agenda")}
              className={QUICK_ACTION}
              title={
                pendingActions > 0
                  ? `${pendingActions} pending agenda items`
                  : "No pending agenda items"
              }
            >
              <CalendarCheck aria-hidden className={QUICK_ACTION_ICON} />
              <span className="min-w-0 flex-1 truncate">Agenda</span>
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  pendingActions > 0 ? "bg-warning" : "bg-success"
                )}
              />
              <span className="sr-only">
                {pendingActions > 0 ? `${pendingActions} pending` : "All clear"}
              </span>
            </Link>
          ) : (
            <div aria-disabled className={cn(QUICK_ACTION_DISABLED)}>
              <CalendarCheck aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 truncate">Agenda</span>
            </div>
          )}
        </div>

        {/* Active Crises Warning Banner */}
        {crisesCount > 0 && (
          <Link
            href={createUrl("/mycountry/executive")}
            className="bg-destructive/15 text-destructive hover:bg-destructive/25 rounded-row text-caption focus-visible:outline-tint flex items-center justify-center gap-2 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            title={`View ${crisesCount} active crises`}
          >
            <AlertTriangle aria-hidden className="size-3.5" />
            <span>
              <span className="tabular-nums">{crisesCount}</span> crises active
            </span>
          </Link>
        )}
      </div>
    </Card>
  );
}
