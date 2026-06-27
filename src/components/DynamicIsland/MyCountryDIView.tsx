"use client";

import React, { useState } from "react";
import { Crown, Globe, User, ChevronRight, LogOut, X, Shield, Building2, Map, MessageSquare, Handshake, BookOpen, Scale, Edit3 } from "lucide-react";
import { UnifiedCountryFlag } from "../UnifiedCountryFlag";

import { GrowthArrow } from "~/components/ui/GrowthArrow";
import { createAbsoluteUrl } from "~/lib/url-utils";
import { getNationUrl } from "~/lib/slug-utils";
import {
  // eslint-disable-next-line unused-imports/no-unused-imports
  formatCompactNumber as _formatCompactNumber,
  // eslint-disable-next-line unused-imports/no-unused-imports
  formatCompactCurrency as _formatCompactCurrency,
} from "~/lib/format-utils";
import { useUser, SignOutButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { isStandaloneClient } from "~/lib/standalone-detection";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "~/components/ui/tooltip";
import { PreText } from "~/components/ui/pretext";
import { Button } from "~/components/ui/button";
import { motion } from "motion/react";

function normalizeGrowth(value: number | null | undefined): number {
  if (!value || !isFinite(value)) return 0;
  let v = value;
  while (Math.abs(v) > 50) v /= 100;
  return Math.min(20, Math.max(-20, v));
}

const isStandalone = typeof window !== "undefined" && isStandaloneClient();

const getPremiumDaysRemaining = (createdAt: string | Date | undefined): number => {
  if (!createdAt) return 30;
  const createdDate = new Date(createdAt);
  const now = new Date();

  // Calculate next billing date: same day of next month
  let nextBillingDate = new Date(now.getFullYear(), now.getMonth(), createdDate.getDate());
  if (nextBillingDate <= now) {
    nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, createdDate.getDate());
  }

  const diffTime = nextBillingDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

interface MyCountryDIViewProps {
  onClose: () => void;
  onSwitchMode?: (mode: any) => void;
}

export function MyCountryDIView({ onClose }: MyCountryDIViewProps) {
  const { user, isLoaded } = useUser();
  const [metricView, setMetricView] = useState({
    gdp: "perCapita" as "perCapita" | "total",
    population: "total" as "total" | "density",
  });

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );



  const setupStatus = (() => {
    if (!isLoaded || profileLoading) return "loading";
    if (!user) return "unauthenticated";
    if (!userProfile?.countryId) return "needs-setup";
    return "complete";
  })();

  const country = userProfile?.country;
  const stats = country
    ? {
        gdpPerCapita: country.currentGdpPerCapita ?? 0,
        population: country.currentPopulation ?? 0,
        currentTotalGdp: country.currentTotalGdp ?? 0,
        populationDensity: country.populationDensity ?? null,
        gdpGrowth: normalizeGrowth(country.realGDPGrowthRate || country.adjustedGdpGrowth),
        popGrowth: normalizeGrowth(country.populationGrowthRate),
      }
    : null;

  const handleNavigate = (path: string) => {
    onClose();
    window.location.href = createAbsoluteUrl(path);
  };

  const actionButtonClass = (colors: string) =>
    `flex w-full items-center justify-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-3 text-xs font-semibold backdrop-blur-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${colors}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={() => (window.location.href = createAbsoluteUrl("/settings"))}
              className="group relative flex-shrink-0 rounded-full transition-transform hover:scale-105 active:scale-95"
              title="Account Settings"
            >
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover ring-2 ring-blue-400/30 transition-all group-hover:ring-blue-400/60"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 ring-2 ring-blue-400/30 transition-all group-hover:ring-blue-400/60">
                  <User className="h-3.5 w-3.5 text-blue-400" />
                </div>
              )}
            </button>
          )}
          <div>
            <PreText className="text-foreground text-xs font-semibold" whiteSpace="nowrap">
              {user?.firstName ? user.firstName : "My Account"}
            </PreText>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-full p-0"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {setupStatus === "complete" && userProfile?.country ? (
        <div>
          {/* ── Your Country ─────────────────────────────────── */}
          <div className="border-border/40 border-b px-4 pb-3">
            <div className="mb-2 flex w-full items-center justify-between">
              <div className="text-foreground/90 flex items-center gap-1.5 text-xs font-bold">
                <Crown
                  className={cn(
                    "h-3.5 w-3.5",
                    userProfile.membershipTier === "mycountry_premium"
                      ? "text-amber-500 drop-shadow-[0_0_4px_rgba(245,158,11,0.3)] dark:text-amber-400"
                      : "text-muted-foreground"
                  )}
                />
                <span>MyCountry</span>
              </div>
              {/* Membership badge */}
              {userProfile.membershipTier === "mycountry_premium" ? (
                <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-600 uppercase shadow-[0_0_8px_rgba(245,158,11,0.05)] dark:text-amber-400">
                  Premium
                </span>
              ) : (
                <span className="text-muted-foreground/80 border-border bg-muted/40 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                  Basic
                </span>
              )}
            </div>

            {/* Status / Duration Row */}
            <div className="mb-1 flex w-full items-center justify-between">
              {userProfile.membershipTier === "mycountry_premium" ? (
                <PreText
                  className="text-[10px] font-semibold text-amber-600 dark:text-amber-400"
                  whiteSpace="nowrap"
                >
                  Premium active • Member since{" "}
                  {new Date(userProfile.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </PreText>
              ) : (
                <PreText
                  className="text-muted-foreground/80 text-[10px] font-medium"
                  whiteSpace="nowrap"
                >
                  Basic Membership
                </PreText>
              )}
            </div>

            {/* Roles / Ranks / Titles Row */}
            {(userProfile.role ||
              (userProfile.role?.level !== undefined && userProfile.role.level <= 20)) && (
              <div className="mt-1 mb-2 flex flex-wrap gap-1">
                {userProfile.role && (
                  <span className="inline-flex items-center gap-0.5 rounded border border-purple-500/25 bg-purple-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-purple-600 dark:text-purple-400">
                    <Shield className="h-2 w-2 shrink-0 text-purple-600 dark:text-purple-400" />
                    {userProfile.role.displayName}
                  </span>
                )}
                {userProfile.role?.level !== undefined && userProfile.role.level <= 20 && (
                  <span className="inline-flex items-center gap-0.5 rounded border border-amber-500/25 bg-amber-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                    <Crown className="h-2.5 w-2.5 shrink-0 text-amber-500 dark:text-amber-400" />
                    Founding Member
                  </span>
                )}
              </div>
            )}
            <div className="relative -mx-1 rounded-lg px-1 py-1.5">
              <button
                onClick={() =>
                  userProfile.country &&
                  (window.location.href = createAbsoluteUrl(getNationUrl(userProfile.country.name)))
                }
                className="hover:bg-accent/10 flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <UnifiedCountryFlag
                    showTooltip={false}
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

              {/* Metric Cards */}
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
                            <GrowthArrow value={stats.gdpGrowth} size={8} className="text-[8px]" />
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
                            {metricView.population === "total" && (
                              <GrowthArrow
                                value={stats.popGrowth}
                                size={8}
                                className="text-[8px]"
                              />
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


          </div>

          {/* ── Country Actions Grid ──────────────────────────── */}
          <div className="px-3 py-2">
            <p className="px-1 pb-2 text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase">
              Country Actions
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleNavigate("/mycountry/editor")}
                className={actionButtonClass(
                  "border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5 text-amber-500/90 hover:from-amber-500/15 hover:to-orange-500/15"
                )}
              >
                <Edit3 className="h-4 w-4 shrink-0" />
                <span className="truncate">Country Editor</span>
              </button>

              <button
                onClick={() => handleNavigate("/mycountry/map-editor")}
                className={actionButtonClass(
                  "border-sky-500/20 bg-gradient-to-r from-sky-500/5 to-blue-500/5 text-sky-400 hover:from-sky-500/15 hover:to-blue-500/15"
                )}
              >
                <Map className="h-4 w-4 shrink-0" />
                <span className="truncate">Map Editor</span>
              </button>

              <button
                onClick={() => handleNavigate("/mycountry/politics")}
                className={actionButtonClass(
                  "border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-purple-500/5 text-violet-400 hover:from-violet-500/15 hover:to-purple-500/15"
                )}
              >
                <Scale className="h-4 w-4 shrink-0" />
                <span className="truncate">Politics</span>
              </button>

              <button
                onClick={() => handleNavigate("/messages")}
                className={actionButtonClass(
                  "border-pink-500/20 bg-gradient-to-r from-pink-500/5 to-rose-500/5 text-pink-400 hover:from-pink-500/15 hover:to-rose-500/15"
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate">Messages</span>
              </button>

              <button
                onClick={() => handleNavigate("/mycountry/diplomacy")}
                className={actionButtonClass(
                  "border-teal-500/20 bg-gradient-to-r from-teal-500/5 to-emerald-500/5 text-teal-400 hover:from-teal-500/15 hover:to-emerald-500/15"
                )}
              >
                <Handshake className="h-4 w-4 shrink-0" />
                <span className="truncate">Diplomacy</span>
              </button>

              <button
                onClick={() => {
                  const wikiPath = userProfile?.country?.name
                    ? `/wiki/${encodeURIComponent(userProfile.country.name.replace(/ /g, "_"))}`
                    : "/wiki";
                  handleNavigate(wikiPath);
                }}
                className={actionButtonClass(
                  "border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 to-blue-500/5 text-indigo-400 hover:from-indigo-500/15 hover:to-blue-500/15"
                )}
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="truncate">Wiki Page</span>
              </button>
            </div>
          </div>

          {/* ── Bottom Actions (Sign Out & View Profile) ────── */}
          <div className="border-border/40 border-t px-3 py-2 flex items-center justify-between">
            <SignOutButton>
              <button className="text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors">
                <LogOut className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 group-hover:scale-110" />
                <PreText className="text-inherit" whiteSpace="nowrap">
                  Sign Out
                </PreText>
              </button>
            </SignOutButton>

            <button
              onClick={() =>
                userProfile?.country?.name &&
                handleNavigate(getNationUrl(userProfile.country.name))
              }
              disabled={!userProfile?.country?.name}
              className="text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors disabled:opacity-50"
            >
              <Globe className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
              <PreText className="text-inherit" whiteSpace="nowrap">
                View Profile
              </PreText>
            </button>
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
    </motion.div>
  );
}
