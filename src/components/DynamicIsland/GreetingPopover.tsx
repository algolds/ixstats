import React, { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { SimpleFlag } from "../SimpleFlag";
import { HealthRing } from "../ui/health-ring";
import { createAbsoluteUrl } from "~/lib/url-utils";
import { getNationUrl } from "~/lib/slug-utils";
import {
  formatCompactNumber as _formatCompactNumber,
  formatCompactCurrency as _formatCompactCurrency,
} from "~/lib/format-utils";
import { useUser, SignOutButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { isStandaloneClient } from "~/lib/standalone-detection";
import { Crown, Globe, User, ChevronRight, LogOut } from "lucide-react";
import type { ViewMode } from "./types";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "~/components/ui/tooltip";
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "~/components/ui/icons";
import { PreText } from "~/components/ui/pretext";

function normalizeGrowth(value: number | null | undefined): number {
  if (!value || !isFinite(value)) return 0;
  let v = value;
  while (Math.abs(v) > 50) v /= 100;
  return Math.min(20, Math.max(-20, v));
}

const isStandalone = typeof window !== "undefined" && isStandaloneClient();

interface GreetingPopoverProps {
  greeting: string;
  onSwitchMode: (mode: ViewMode) => void;
}

export function GreetingPopover({ greeting, onSwitchMode }: GreetingPopoverProps) {
  const { user, isLoaded } = useUser();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [metricView, setMetricView] = useState({
    gdp: "perCapita" as "perCapita" | "total",
    population: "total" as "total" | "density",
    area: "km" as "km" | "mi",
  });

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId: userProfile?.countryId ?? "" },
    { enabled: !!userProfile?.countryId }
  );

  const setupStatus = (() => {
    if (!isLoaded || profileLoading) return "loading";
    if (!user) return "unauthenticated";
    if (!userProfile?.countryId) return "needs-setup";
    return "complete";
  })();

  // Compute composite vitality
  const vitalityScore = activityRingsData
    ? Math.round(
        ((activityRingsData.economicVitality || 0) +
          (activityRingsData.populationWellbeing || 0) +
          (activityRingsData.diplomaticStanding || 0) +
          (activityRingsData.governmentalEfficiency || 0)) /
          4
      )
    : null;

  const country = userProfile?.country;
  const stats = country
    ? {
        gdpPerCapita: country.currentGdpPerCapita ?? 0,
        population: country.currentPopulation ?? 0,
        currentTotalGdp: country.currentTotalGdp ?? 0,
        populationDensity: country.populationDensity ?? null,
        landArea: country.landArea ?? null,
        areaSqMi: country.areaSqMi ?? null,
        gdpGrowth: normalizeGrowth(country.realGDPGrowthRate || country.adjustedGdpGrowth),
        popGrowth: normalizeGrowth(country.populationGrowthRate),
      }
    : null;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger className="text-foreground/80 hover:bg-accent/10 hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors">
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="h-4 w-4 rounded-full object-cover ring-1 ring-white/20"
          />
        ) : (
          <User className="text-muted-foreground h-3 w-3" />
        )}
        <PreText className="hidden text-inherit sm:inline" whiteSpace="nowrap">
          {`${greeting}${user?.firstName ? `, ${user.firstName}` : ""}`}
        </PreText>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        className="bg-card/95 border-border z-[10002] mt-2 w-72 rounded-xl p-0 shadow-2xl backdrop-blur-xl"
        sideOffset={8}
      >
        {setupStatus === "complete" && userProfile?.country ? (
          <div>
            {/* ── Your Country ─────────────────────────────────── */}
            <div className="border-border/40 border-b px-4 py-3">
              <PreText
                className="text-muted-foreground/60 mb-2 text-[10px] font-semibold tracking-wider uppercase"
                whiteSpace="nowrap"
              >
                MyCountry
              </PreText>
              <div className="relative -mx-1 rounded-lg px-1 py-1.5">
                <button
                  onClick={() =>
                    userProfile.country &&
                    (window.location.href = createAbsoluteUrl(
                      getNationUrl(userProfile.country.name)
                    ))
                  }
                  className="hover:bg-accent/10 flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                    <SimpleFlag
                      countryName={userProfile.country.name}
                      className="h-full w-full object-cover"
                      showPlaceholder={true}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <PreText
                      className="text-foreground truncate text-sm font-semibold"
                      whiteSpace="nowrap"
                    >
                      {userProfile.country.name}
                    </PreText>
                  </div>
                  <ChevronRight className="text-muted-foreground/40 h-3.5 w-3.5 shrink-0" />
                </button>

                {/* Togglable Metric Cards */}
                {stats && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMetricView((v) => ({
                                ...v,
                                gdp: v.gdp === "perCapita" ? "total" : "perCapita",
                              }));
                            }}
                            className="rounded-lg bg-white/[0.04] p-1.5 text-center transition-all hover:bg-white/[0.07] active:scale-[0.98]"
                          >
                            <PreText
                              className="text-muted-foreground/60 text-[8px] font-medium tracking-wider uppercase"
                              whiteSpace="nowrap"
                            >
                              {metricView.gdp === "perCapita" ? "GDP/Cap" : "Total GDP"}
                            </PreText>
                            <div className="mt-0.5 flex flex-wrap items-center justify-center gap-0.5">
                              <PreText
                                className="text-foreground text-[10px] font-bold tracking-tight"
                                whiteSpace="nowrap"
                              >
                                {`$${
                                  metricView.gdp === "perCapita"
                                    ? Math.round(stats.gdpPerCapita).toLocaleString("en-US")
                                    : Math.round(stats.currentTotalGdp).toLocaleString("en-US")
                                }`}
                              </PreText>
                              {stats.gdpGrowth !== 0 && (
                                <span
                                  className={cn(
                                    "flex shrink-0 items-center gap-0.5 text-[8px] font-semibold",
                                    stats.gdpGrowth > 0 ? "text-emerald-500" : "text-red-500"
                                  )}
                                >
                                  {stats.gdpGrowth > 0 ? (
                                    <ArrowTrendingUpIcon size={8} />
                                  ) : (
                                    <ArrowTrendingDownIcon size={8} />
                                  )}
                                  <PreText className="text-inherit" whiteSpace="nowrap">
                                    {`${stats.gdpGrowth > 0 ? "+" : ""}${stats.gdpGrowth.toFixed(1)}%`}
                                  </PreText>
                                </span>
                              )}
                            </div>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMetricView((v) => ({
                                ...v,
                                population: v.population === "total" ? "density" : "total",
                              }));
                            }}
                            className="rounded-lg bg-white/[0.04] p-1.5 text-center transition-all hover:bg-white/[0.07] active:scale-[0.98]"
                          >
                            <PreText
                              className="text-muted-foreground/60 text-[8px] font-medium tracking-wider uppercase"
                              whiteSpace="nowrap"
                            >
                              {metricView.population === "total" ? "Population" : "Density"}
                            </PreText>
                            <div className="mt-0.5 flex flex-wrap items-center justify-center gap-0.5">
                              <PreText
                                className="text-foreground text-[10px] font-bold tracking-tight"
                                whiteSpace="nowrap"
                              >
                                {metricView.population === "total"
                                  ? Math.round(stats.population).toLocaleString("en-US")
                                  : stats.populationDensity
                                    ? `${Math.round(stats.populationDensity).toLocaleString()}/km²`
                                    : "N/A"}
                              </PreText>
                              {stats.popGrowth !== 0 && metricView.population === "total" && (
                                <PreText
                                  className={cn(
                                    "flex shrink-0 items-center gap-0.5 text-[8px] font-semibold",
                                    stats.popGrowth > 0 ? "text-emerald-500" : "text-red-500"
                                  )}
                                  whiteSpace="nowrap"
                                >
                                  {`${stats.popGrowth > 0 ? "+" : ""}${stats.popGrowth.toFixed(1)}%`}
                                </PreText>
                              )}
                            </div>
                          </button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="px-2 py-1 text-[10px]">
                        <PreText whiteSpace="nowrap">Click metrics to toggle views</PreText>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {/* National Vitality Rings — 2×2 grid */}
              {activityRingsData && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    {
                      value: activityRingsData.economicVitality || 0,
                      color: "#22c55e",
                      label: "Economy",
                      labelClass: "text-green-600 dark:text-green-400",
                    },
                    {
                      value: activityRingsData.populationWellbeing || 0,
                      color: "#3b82f6",
                      label: "Population",
                      labelClass: "text-blue-600 dark:text-blue-400",
                    },
                    {
                      value: activityRingsData.diplomaticStanding || 0,
                      color: "#a855f7",
                      label: "Diplomacy",
                      labelClass: "text-purple-600 dark:text-purple-400",
                    },
                    {
                      value: activityRingsData.governmentalEfficiency || 0,
                      color: "#f97316",
                      label: "Government",
                      labelClass: "text-orange-600 dark:text-orange-400",
                    },
                  ].map((ring) => (
                    <div key={ring.label} className="flex flex-col items-center gap-1">
                      <HealthRing
                        value={ring.value}
                        size={56}
                        color={ring.color}
                        label={ring.label}
                      />
                      <PreText
                        className={`text-[10px] font-medium ${ring.labelClass}`}
                        whiteSpace="nowrap"
                      >
                        {`${ring.label} ${ring.value}%`}
                      </PreText>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Quick Actions ────────────────────────────────── */}
            <div className="space-y-0.5 px-2 py-2">
              {!isStandalone && (
                <button
                  onClick={() => (window.location.href = createAbsoluteUrl("/mycountry"))}
                  className="text-foreground/70 hover:bg-accent/10 hover:text-foreground group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors"
                >
                  <Crown className="h-3.5 w-3.5 text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)] transition-all group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
                  <PreText className="flex-1 text-left text-inherit" whiteSpace="nowrap">
                    MyCountry
                  </PreText>
                  <ChevronRight className="text-muted-foreground/30 h-3 w-3" />
                </button>
              )}

              <button
                onClick={() =>
                  userProfile.country &&
                  (window.location.href = createAbsoluteUrl(getNationUrl(userProfile.country.name)))
                }
                className="text-foreground/70 hover:bg-accent/10 hover:text-foreground group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors"
              >
                <Globe className="h-3.5 w-3.5 text-purple-400 drop-shadow-[0_0_4px_rgba(168,85,247,0.5)] transition-all group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]" />
                <PreText className="flex-1 text-left text-inherit" whiteSpace="nowrap">
                  View Profile
                </PreText>
                <ChevronRight className="text-muted-foreground/30 h-3 w-3" />
              </button>
            </div>

            {/* ── Sign Out ────────────────────────────────────── */}
            <div className="border-border/40 border-t px-2 py-2">
              <SignOutButton>
                <button className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors">
                  <LogOut className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 group-hover:scale-110" />
                  <PreText className="text-inherit" whiteSpace="nowrap">
                    Sign Out
                  </PreText>
                </button>
              </SignOutButton>
            </div>
          </div>
        ) : (
          /* ── Unauthenticated / no country ────────────────── */
          <div className="py-6 text-center">
            <div className="bg-muted/30 rounded-xl p-6">
              <User className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
              <PreText className="text-muted-foreground mb-4 text-xs" whiteSpace="nowrap">
                {isStandalone ? "Sign in with IxnayID to edit maps" : "Sign in with IxnayID"}
              </PreText>
              <button
                onClick={() =>
                  (window.location.href =
                    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || createAbsoluteUrl("/sign-in"))
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-2 text-xs font-medium transition-colors"
              >
                <PreText className="text-inherit" whiteSpace="nowrap">
                  Sign In
                </PreText>
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
