"use client";

import React, { useEffect, useMemo } from "react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { InteractiveGridPattern } from "~/components/ui/magicui/interactive-grid-pattern";
import { createUrl } from "~/lib/utils";
import {
  SplashHero,
  SplashLiveFeed,
  NationBuilderShowcase,
  SplashTwoWorlds,
  SplashIssuesTeaser,
  SplashFold,
  SplashFooter,
} from "./splash";

export function IxStatsSplashPage() {
  const { user } = useUser();
  const router = useRouter();

  const { data: countriesData } = api.countries.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const { data: globalStats } = api.countries.getGlobalStats.useQuery();

  const topCountries = useMemo(() => {
    if (!countriesData?.countries) return [];
    return [...countriesData.countries]
      .sort((a, b) => (b.currentTotalGdp || 0) - (a.currentTotalGdp || 0))
      .slice(0, 6);
  }, [countriesData]);

  useEffect(() => {
    if (user) {
      router.push(createUrl("/dashboard"));
    }
  }, [user, router]);

  if (user) {
    return (
      <div className="bg-background relative flex min-h-screen items-center justify-center">
        <InteractiveGridPattern
          width={40}
          height={40}
          squares={[50, 40]}
          className="fixed inset-0 z-0 opacity-30 dark:opacity-20"
          squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30"
        />
        <div className="relative z-10 text-center">
          <div className="border-muted border-t-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2" />
          <p className="text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  const topCountriesRecords = topCountries as unknown as Record<string, unknown>[];

  return (
    <div className="bg-background relative min-h-screen overflow-hidden">
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="fixed inset-0 z-0 opacity-30 dark:opacity-20"
        squaresClassName="fill-muted/25 stroke-border transition-colors duration-200 hover:[&:nth-child(4n+1)]:fill-amber-500/15 hover:[&:nth-child(4n+2)]:fill-amber-500/12 hover:[&:nth-child(4n+3)]:fill-amber-500/15 hover:[&:nth-child(4n+4)]:fill-amber-500/12 dark:fill-muted/20 dark:hover:[&:nth-child(4n+1)]:fill-amber-400/10 dark:hover:[&:nth-child(4n+2)]:fill-amber-400/10 dark:hover:[&:nth-child(4n+3)]:fill-amber-400/10 dark:hover:[&:nth-child(4n+4)]:fill-amber-400/10"
      />

      <div className="relative z-10 container mx-auto px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <SplashHero globalStats={globalStats} />
        <SplashLiveFeed />
        <NationBuilderShowcase />
        <SplashTwoWorlds topCountries={topCountriesRecords} />
        <SplashIssuesTeaser />
        <SplashFold />
        <SplashFooter />
      </div>
    </div>
  );
}
