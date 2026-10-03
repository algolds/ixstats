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
import { api, type RouterOutputs } from "~/trpc/react";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import * as IconoirIcons from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn, createUrl, formatCompactNumber, formatCompactCurrency } from "~/lib/utils";

const QUICK_ACTION =
  "text-body text-label bg-fill-4 hover:bg-fill-3 rounded-row focus-visible:outline-tint flex min-h-9 min-w-0 items-center gap-2 px-2 py-2 focus-visible:outline-2 focus-visible:outline-offset-2";
const QUICK_ACTION_ICON = "text-label-secondary size-4 shrink-0";
const QUICK_ACTION_DISABLED =
  "text-body text-label-tertiary bg-fill-4 rounded-row flex min-h-9 min-w-0 cursor-not-allowed items-center gap-2 px-2 py-2";

interface DashboardPlayerWidgetProps {
  heroCollapsed?: boolean;
  onHeroExpand?: () => void;
}

const COLLECTOR_KEYS = ["collect-lore-keeper", "collect-archaeologist", "collect-diplomat"];

interface QuickActionProps {
  /** Omit for the disabled variant (no country yet). */
  href?: string;
  icon: typeof Mail;
  label: string;
  title?: string;
  children?: React.ReactNode;
}

function QuickAction({ href, icon: Icon, label, title, children }: QuickActionProps) {
  if (!href) {
    return (
      <div aria-disabled className={QUICK_ACTION_DISABLED}>
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </div>
    );
  }
  return (
    <Link href={href} className={QUICK_ACTION} title={title}>
      <Icon aria-hidden className={QUICK_ACTION_ICON} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {children}
    </Link>
  );
}

function CollapsedStats({ stats }: { stats?: Record<string, number | undefined> }) {
  const rows = [
    [Users, "text-blue", "Pop", formatCompactNumber(stats?.currentPopulation ?? 0)],
    [DollarSign, "text-green", "GDP", formatCompactCurrency(stats?.currentTotalGdp ?? 0)],
    ...(stats?.landArea
      ? [[MapIcon, "text-yellow", "Area", `${Math.round(stats.landArea).toLocaleString()} km²`]]
      : []),
  ] as const;
  return (
    <dl className="space-y-1">
      {rows.map(([Icon, tone, label, value]) => (
        <div key={label} className="text-footnote flex items-center justify-between">
          <dt className="text-label-secondary flex items-center gap-2">
            <Icon aria-hidden className={cn(tone, "size-3.5")} /> {label}
          </dt>
          <dd className="text-label font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface PlayerIdentityProps {
  profile: RouterOutputs["users"]["getProfile"] | undefined;
  titles: RouterOutputs["achievements"]["getAllWithStatus"];
}

function PlayerIdentity({ profile, titles }: PlayerIdentityProps) {
  const { user } = useUser();
  const { avatarGlow, chatBadge } = useActiveCosmetics();
  const CrownIcon = (IconoirIcons as any)[chatBadge.icon] || IconoirIcons.Crown;
  const country = profile?.country;
  return (
    <div className="relative flex flex-col items-center justify-center px-3 pt-4 pb-2">
      <AvatarGlow
        avatarGlow={avatarGlow}
        roundedClass="rounded-full"
        className="bg-tint relative mb-2 h-9 w-9"
      >
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : country?.name ? (
            <UnifiedCountryFlag
              countryName={country.name}
              flagUrl={normalizeFlagUrl(country.flag)}
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
        href={createUrl(`/countries/${country?.slug ?? ""}`)}
        className="text-headline text-label focus-visible:outline-tint rounded-control-sm relative flex items-center justify-center gap-1 text-center underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span>{country?.name ?? "MyCountry"}</span>
        {chatBadge.enabled && (
          <CrownIcon aria-hidden className="size-3.5 shrink-0" style={{ color: chatBadge.color }} />
        )}
      </Link>

      {titles.length > 0 && (
        <div className="relative mt-2 flex flex-wrap justify-center gap-1 px-1">
          {titles.map((ach) => (
            <Badge key={ach.key} title={ach.description} variant="default" className="cursor-help">
              <span>{ach.iconUrl || "🏆"}</span>
              <span>{ach.title}</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function usePlayerWidgetData(heroCollapsed?: boolean) {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!userId }
  );
  const countryId = userProfile?.countryId || "";
  const hasCountry = !!countryId;
  const forCountry = { enabled: hasCountry };

  const { data: folderCounts } = api.messages.getFolderCounts.useQuery(
    { userId },
    { enabled: !!userId }
  );
  const { data: country } = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: hasCountry && !!heroCollapsed }
  );
  const { data: crisisStats } = api.crisisEvents.getStatistics.useQuery(
    { timeframe: "month" },
    forCountry
  );
  const { data: pendingIssues } = api.nationalIssues.getPendingCount.useQuery(
    { countryId },
    forCountry
  );
  const { data: meetings } = api.meetings.getMeetings.useQuery({ countryId }, forCountry);
  const { data: achievements } = api.achievements.getAllWithStatus.useQuery(
    { userId },
    { enabled: !!userId }
  );

  return {
    userProfile,
    profileLoading,
    hasCountry,
    stats: (country as any)?.newStats as Record<string, number | undefined> | undefined,
    unreadMessages: Object.values((folderCounts ?? {}) as Record<string, number>).reduce(
      (a, b) => a + b,
      0
    ),
    crisesCount: crisisStats?.activeEvents ?? 0,
    issueCount: pendingIssues?.total ?? 0,
    urgentCount: pendingIssues?.urgent ?? 0,
    pendingActions:
      meetings?.flatMap((m) => m.actionItems).filter((a) => a.status === "pending").length ?? 0,
    collectorTitles:
      achievements?.filter((a) => a.isUnlocked && COLLECTOR_KEYS.includes(a.key)) ?? [],
  };
}

export function DashboardPlayerWidget({ heroCollapsed, onHeroExpand }: DashboardPlayerWidgetProps) {
  const { isSignedIn } = useUser();
  const { neonFrame } = useActiveCosmetics();
  const {
    userProfile,
    profileLoading,
    hasCountry,
    stats,
    unreadMessages,
    crisesCount,
    issueCount,
    urgentCount,
    pendingActions,
    collectorTitles,
  } = usePlayerWidgetData(heroCollapsed);

  if (!isSignedIn) return null;

  if (profileLoading) {
    return (
      <Card className="w-48">
        <div className="flex min-h-[90px] flex-col items-center justify-center px-3 pt-3">
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
        <div className="space-y-2 p-3">
          {["w-24", "w-20", "w-28"].map((w) => (
            <Skeleton key={w} className={cn("rounded-control-sm h-4", w)} />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-48 overflow-hidden">
      <NeonFrameOverlay neonFrame={neonFrame} className="rounded-card" />
      <PlayerIdentity profile={userProfile} titles={collectorTitles} />
      <div className="relative space-y-2 p-3 pt-1">
        {/* Condensed hero stats, shown when the hero is collapsed */}
        {heroCollapsed && (
          <>
            <CollapsedStats stats={stats} />
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
          <QuickAction
            href="/messages"
            icon={Mail}
            label="Mail"
            title={unreadMessages > 0 ? `${unreadMessages} unread messages` : "No unread messages"}
          >
            {unreadMessages > 0 && (
              <Badge variant="secondary">
                {unreadMessages}
                <span className="sr-only"> unread</span>
              </Badge>
            )}
          </QuickAction>
          <QuickAction
            href={hasCountry ? createUrl("/mycountry/executive?focus=directives") : undefined}
            icon={ClipboardList}
            label="Directives"
            title={`${issueCount} pending directives (${urgentCount} urgent)`}
          >
            {(issueCount > 0 || urgentCount > 0) && (
              <Badge variant={urgentCount > 0 ? "destructive" : "warning"}>
                {urgentCount > 0 ? urgentCount : issueCount}
                <span className="sr-only">{urgentCount > 0 ? " urgent" : " pending"}</span>
              </Badge>
            )}
          </QuickAction>
          <QuickAction
            href={hasCountry ? createUrl("/mycountry/executive?focus=agenda") : undefined}
            icon={CalendarCheck}
            label="Agenda"
            title={
              pendingActions > 0
                ? `${pendingActions} pending agenda items`
                : "No pending agenda items"
            }
          >
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
          </QuickAction>
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
