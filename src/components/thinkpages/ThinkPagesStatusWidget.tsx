"use client";

import { Settings, Hash, FileText, UserCircle } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";
import Link from "next/link";
import { ThinkPagesIcon } from "./ThinkPagesIcon";

interface ThinkPagesStatusWidgetProps {
  countryId?: string;
  isAuthenticated?: boolean;
  onOpenSettings?: () => void;
}

export function ThinkPagesStatusWidget({
  countryId,
  isAuthenticated,
  onOpenSettings,
}: ThinkPagesStatusWidgetProps) {
  const hasCountry = !!countryId && countryId.trim() !== "";

  const { data: accounts, isLoading: accountsLoading } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: countryId || "" },
    { enabled: hasCountry },
  );

  const { data: trending, isLoading: trendingLoading } = api.thinkpages.getTrendingTopics.useQuery(
    undefined,
    { enabled: !!isAuthenticated },
  );

  const isLoading = accountsLoading || trendingLoading;

  // Not signed in
  if (!isAuthenticated) {
    return (
      <div className="w-56 rounded-xl border border-white/10 bg-white/60 p-3.5 shadow-sm backdrop-blur-lg dark:bg-white/5">
        <div className="mb-3 flex items-center gap-2.5">
          <ThinkPagesIcon size={22} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground tracking-tight">ThinkPages</p>
            <p className="text-[10px] text-muted-foreground">The Global Forum</p>
          </div>
        </div>
        <p className="mb-2.5 text-center text-xs text-muted-foreground">
          Sign in to participate
        </p>
        <Link
          href={"/setup"}
          className="flex items-center justify-center rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
        >
          Sign In / Sign Up
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-56 space-y-3 rounded-xl border border-white/10 bg-white/60 p-3.5 shadow-sm backdrop-blur-lg dark:bg-white/5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  const accountCount = accounts?.length ?? 0;
  const trendingTopics = trending?.slice(0, 5) ?? [];

  return (
    <div className="w-56 space-y-3 rounded-xl border border-white/10 bg-white/60 p-3.5 shadow-sm backdrop-blur-lg dark:bg-white/5">
      {/* Branding */}
      <div className="flex items-center gap-2.5">
        <ThinkPagesIcon size={22} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground tracking-tight">ThinkPages</p>
          <p className="text-[10px] text-muted-foreground">The Global Forum</p>
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* Account Stats */}
      <div className="space-y-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <UserCircle className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
          <span className="text-xs text-muted-foreground">
            {accountCount} {accountCount === 1 ? "Account" : "Accounts"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
          <span className="text-xs text-muted-foreground">Platform v1.0</span>
        </div>
      </div>

      {/* Trending Topics */}
      {trendingTopics.length > 0 && (
        <>
          <div className="border-t border-border/40" />
          <div className="space-y-1.5">
            <p className="px-0.5 text-[10px] font-medium text-muted-foreground">Trending</p>
            <div className="flex flex-wrap gap-1">
              {trendingTopics.map((topic: any) => (
                <span
                  key={topic.topic || topic.name || topic}
                  className="inline-flex items-center gap-0.5 rounded-md bg-blue-500/8 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                >
                  <Hash className="h-2.5 w-2.5" />
                  {topic.topic || topic.name || String(topic)}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Settings */}
      {onOpenSettings && (
        <>
          <div className="border-t border-border/40" />
          <button
            onClick={onOpenSettings}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          >
            <Settings className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Settings</span>
          </button>
        </>
      )}
    </div>
  );
}
