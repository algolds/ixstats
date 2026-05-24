"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ClipboardList, AlertTriangle, MessageSquare, ChevronRight } from "lucide-react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/url-utils";
import { Skeleton } from "~/components/ui/skeleton";

type FolderKey = "inbox" | "personal" | "diplomatic" | "discussions" | "groups" | "system";

const FOLDER_LABELS: Record<FolderKey, { label: string; icon: typeof MessageSquare }> = {
  inbox: { label: "Inbox", icon: Mail },
  personal: { label: "Personal", icon: MessageSquare },
  diplomatic: { label: "Diplomatic", icon: MessageSquare },
  discussions: { label: "Discussions", icon: MessageSquare },
  groups: { label: "Groups", icon: MessageSquare },
  system: { label: "System", icon: MessageSquare },
};

function formatCompact(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

export function DashboardPlayerWidget() {
  const { user, isSignedIn } = useUser();

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );
  const countryId = userProfile?.countryId || "";
  const hasCountry = !!countryId;

  // ── Toggle state for stat cards ──
  const [gdpView, setGdpView] = useState<"perCapita" | "total" | "growth">("perCapita");
  const [popView, setPopView] = useState<"total" | "growth" | "density">("total");

  const cycleGdp = () => {
    const order: (typeof gdpView)[] = ["perCapita", "total", "growth"];
    setGdpView(order[(order.indexOf(gdpView) + 1) % order.length]);
  };
  const cyclePop = () => {
    const order: (typeof popView)[] = ["total", "growth", "density"];
    setPopView(order[(order.indexOf(popView) + 1) % order.length]);
  };

  const { data: dashboard } = api.mycountry.getCountryDashboard.useQuery(
    { countryId },
    { enabled: hasCountry }
  );
  const { data: folderCounts } = api.messages.getFolderCounts.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );
  const { data: activeCrises } = api.crisisEvents.getActive.useQuery(
    { limit: 5 },
    { enabled: hasCountry }
  );
  const { data: crisisStats } = api.crisisEvents.getStatistics.useQuery(
    { timeframe: "month" },
    { enabled: hasCountry }
  );
  const { data: pendingIssues } = api.nationalIssues.getPendingCount.useQuery(
    { countryId },
    { enabled: hasCountry }
  );

  if (!isSignedIn) return null;

  if (profileLoading) {
    return (
      <div className="border-border/50 bg-background/80 w-48 space-y-2.5 rounded-xl border p-3 shadow-sm backdrop-blur-lg">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
    );
  }

  const dash = (dashboard ?? {}) as any;
  const stats = {
    gdpPerCapita: dash.currentGdpPerCapita ?? 0,
    totalGdp: dash.currentTotalGdp ?? 0,
    population: dash.currentPopulation ?? 0,
    growth: dash.adjustedGdpGrowth ?? 0,
    popGrowth: dash.populationGrowthRate ?? 0,
    popDensity: dash.populationDensity ?? 0,
  };

  const gdpDisplayValue =
    gdpView === "perCapita"
      ? `$${formatCompact(stats.gdpPerCapita)}`
      : gdpView === "total"
        ? `$${formatCompact(stats.totalGdp)}`
        : `${(stats.growth * 100).toFixed(2)}%`;

  const gdpDisplayLabel =
    gdpView === "perCapita" ? "GDP/Cap" : gdpView === "total" ? "Total GDP" : "Growth";

  const popDisplayValue =
    popView === "total"
      ? formatCompact(stats.population)
      : popView === "growth"
        ? `${(stats.popGrowth * 100).toFixed(2)}%`
        : `${formatCompact(Math.round(stats.popDensity))}/mi²`;

  const popDisplayLabel =
    popView === "total" ? "Population" : popView === "growth" ? "Pop Growth" : "Density";

  const msgFolders = folderCounts as Record<FolderKey, number> | undefined;
  const hasMessages = msgFolders && Object.values(msgFolders).some((c) => c > 0);
  const activeCrisesList = activeCrises ?? [];
  const crisesCount = crisisStats?.activeEvents ?? 0;

  return (
    <div className="border-border/50 bg-background/80 w-48 space-y-2.5 rounded-xl border p-3 shadow-sm backdrop-blur-lg">
      {/* GDP/Pop Stat Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={cycleGdp}
            className="cursor-pointer rounded-lg bg-emerald-500/8 px-2 py-1.5 text-left transition-colors hover:bg-emerald-500/15 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
          >
            <p className="text-muted-foreground text-[8px] leading-tight">{gdpDisplayLabel}</p>
            <p className="text-[10px] leading-tight font-semibold text-emerald-600 dark:text-emerald-400">
              {gdpDisplayValue}
            </p>
          </button>
          <button
            onClick={cyclePop}
            className="cursor-pointer rounded-lg bg-blue-500/8 px-2 py-1.5 text-left transition-colors hover:bg-blue-500/15 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
          >
            <p className="text-muted-foreground text-[8px] leading-tight">{popDisplayLabel}</p>
            <p className="text-[10px] leading-tight font-semibold text-blue-600 dark:text-blue-400">
              {popDisplayValue}
            </p>
          </button>
        </div>
      )}

      <div className="border-border/40 border-t" />

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

      <div className="border-border/40 border-t" />

      {/* Pending Issues */}
      {pendingIssues && pendingIssues.total > 0 && (
        <Link href={"/mycountry/executive"} className="group flex items-center justify-between">
          <span className="text-foreground flex items-center gap-1.5 text-[10px] font-semibold">
            <ClipboardList className="h-3.5 w-3.5" />
            Issues
          </span>
          <span className="flex items-center gap-1.5">
            {pendingIssues.urgent > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
                {pendingIssues.urgent} urgent
              </span>
            )}
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[9px] font-semibold">
              {pendingIssues.total}
            </span>
          </span>
        </Link>
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
    </div>
  );
}
