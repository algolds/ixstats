"use client";

import React, { useState } from "react";
import {
  Crown,
  Globe,
  User,
  NavArrowRight as ChevronRight,
  LogOut,
  Xmark as X,
  Shield,
  Map,
  ChatBubble as MessageSquare,
  Community as Handshake,
  OpenBook as BookOpen,
  ScaleFrameEnlarge as Scale,
  EditPencil as Edit3,
} from "iconoir-react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { GrowthArrow } from "~/components/ui/GrowthArrow";
import { createAbsoluteUrl, getNationUrl, cn } from "~/lib/utils";
import { useUser, SignOutButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { isStandaloneClient } from "~/lib/system/standalone-detection";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "~/components/ui/tooltip";
import { PreText } from "~/components/ui/pretext";
import { Button } from "~/components/ui/button";
import { motion } from "motion/react";
import type { ViewMode } from "~/components/halo/types";

function normalizeGrowth(value: number | null | undefined): number {
  if (!value || !isFinite(value)) return 0;
  let v = value;
  while (Math.abs(v) > 50) v /= 100;
  return Math.min(20, Math.max(-20, v));
}

const isStandalone = typeof window !== "undefined" && isStandaloneClient();

export interface MyCountryViewProps {
  onClose: () => void;
  onSwitchMode?: (mode: ViewMode) => void;
}

export function MyCountryView({ onClose }: MyCountryViewProps) {
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
    `flex w-full items-center justify-start gap-2.5 rounded-row border border-separator bg-fill-4 px-3.5 py-3 text-caption font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 hover:scale-[1.02] active:scale-[0.98] ${colors}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={() => (window.location.href = createAbsoluteUrl("/settings"))}
              className="group relative flex-shrink-0 rounded-full transition-transform hover:scale-105 active:scale-[0.98]"
              title="Account Settings"
            >
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt=""
                  className="ring-separator group-hover:ring-tint size-7 rounded-full object-cover ring-2 transition-[box-shadow]"
                />
              ) : (
                <div className="bg-fill-3 ring-separator group-hover:ring-tint flex size-7 items-center justify-center rounded-full ring-2 transition-[box-shadow]">
                  <User className="text-label-secondary size-3.5" aria-hidden="true" />
                </div>
              )}
            </button>
          )}
          <div>
            <PreText className="text-label text-caption font-semibold" whiteSpace="nowrap">
              {user?.firstName ? user.firstName : "My Account"}
            </PreText>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {country && (
            <>
              <button
                type="button"
                onClick={() => {
                  const slug = country.slug || country.name.replace(/\s+/g, "_");
                  window.location.href = createAbsoluteUrl(`/countries/${slug}`);
                }}
                className="text-label-secondary hover:text-label hover:bg-fill-4 border-separator bg-fill-4 hover:border-separator rounded-control text-caption inline-flex cursor-pointer items-center gap-1 border px-2 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
                title="Public Country Profile"
              >
                <User className="text-blue h-3 w-3" />
                <span>Profile</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = createAbsoluteUrl("/mycountry/editor");
                }}
                className="text-label-secondary hover:text-label hover:bg-fill-4 border-separator bg-fill-4 hover:border-separator rounded-control text-caption inline-flex cursor-pointer items-center gap-1 border px-2 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
                title="Open MyCountry Map Editor"
              >
                <Edit3 className="text-yellow h-3 w-3" />
                <span>Editor</span>
              </button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-label-secondary hover:text-label size-7 p-0"
            title="Close expanded view"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {setupStatus === "complete" && userProfile?.country ? (
        <div>
          {/* ── Your Country ─────────────────────────────────── */}
          <div className="border-separator border-b px-4 pb-3">
            <div className="mb-2 flex w-full items-center justify-between">
              <div className="text-label text-caption flex items-center gap-1.5 font-semibold">
                <Crown
                  className={cn(
                    "h-3.5 w-3.5",
                    userProfile.membershipTier === "mycountry_premium"
                      ? "text-yellow"
                      : "text-label-secondary"
                  )}
                />
                <span>MyCountry</span>
              </div>
              {/* Membership badge */}
              {userProfile.membershipTier === "mycountry_premium" ? (
                <span className="border-yellow/25 bg-yellow/10 text-caption text-yellow inline-flex items-center rounded-full border px-2 py-0.5">
                  Premium
                </span>
              ) : (
                <span className="text-label-secondary border-separator bg-fill-4 text-caption inline-flex items-center rounded-full border px-2 py-0.5">
                  Basic
                </span>
              )}
            </div>

            {/* Status / Duration Row */}
            <div className="mb-1 flex w-full items-center justify-between">
              {userProfile.membershipTier === "mycountry_premium" ? (
                <PreText className="text-caption text-yellow font-semibold" whiteSpace="nowrap">
                  Premium active • Member since{" "}
                  {new Date(userProfile.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </PreText>
              ) : (
                <PreText className="text-label-secondary text-caption" whiteSpace="nowrap">
                  Basic Membership
                </PreText>
              )}
            </div>

            {/* Roles / Ranks / Titles Row */}
            {(userProfile.role ||
              (userProfile.role?.level !== undefined && userProfile.role.level <= 20)) && (
              <div className="mt-1 mb-2 flex flex-wrap gap-1">
                {userProfile.role && (
                  <span className="rounded-control-sm border-indigo/25 bg-indigo/5 text-caption text-indigo inline-flex items-center gap-0.5 border px-1.5 py-0.5 font-semibold">
                    <Shield className="text-indigo h-2 w-2 shrink-0" />
                    {userProfile.role.displayName}
                  </span>
                )}
                {userProfile.role?.level !== undefined && userProfile.role.level <= 20 && (
                  <span className="rounded-control-sm border-yellow/25 bg-yellow/5 text-caption text-yellow inline-flex items-center gap-0.5 border px-1.5 py-0.5 font-semibold">
                    <Crown className="text-yellow h-2.5 w-2.5 shrink-0" />
                    Founding Member
                  </span>
                )}
              </div>
            )}
            <div className="rounded-control relative -mx-1 px-1 py-1.5">
              <button
                onClick={() =>
                  userProfile.country &&
                  (window.location.href = createAbsoluteUrl(getNationUrl(userProfile.country.name)))
                }
                className="hover:bg-fill-4 rounded-control flex w-full items-center gap-3 p-1 text-left transition-colors"
              >
                <div className="rounded-control flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
                  <UnifiedCountryFlag
                    showTooltip={false}
                    countryName={userProfile.country.name}
                    flagUrl={normalizeFlagUrl(userProfile.country.flag)}
                    className="h-full w-full object-cover"
                    showPlaceholder={true}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <PreText className="text-label text-headline truncate" whiteSpace="nowrap">
                    {userProfile.country.name}
                  </PreText>
                </div>
                <ChevronRight className="text-label-tertiary h-3.5 w-3.5 shrink-0" />
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
                          className="rounded-control bg-fill-4 hover:bg-fill-2 p-1.5 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                        >
                          <PreText
                            className="text-label-secondary text-eyebrow"
                            whiteSpace="nowrap"
                          >
                            {metricView.gdp === "perCapita" ? "GDP/Cap" : "Total GDP"}
                          </PreText>
                          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-0.5">
                            <PreText
                              className="text-label text-caption font-semibold"
                              whiteSpace="nowrap"
                            >
                              {`$${
                                metricView.gdp === "perCapita"
                                  ? Math.round(stats.gdpPerCapita).toLocaleString("en-US")
                                  : Math.round(stats.currentTotalGdp).toLocaleString("en-US")
                              }`}
                            </PreText>
                            <GrowthArrow
                              value={stats.gdpGrowth}
                              size={8}
                              className="text-footnote"
                            />
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
                          className="rounded-control bg-fill-4 hover:bg-fill-2 p-1.5 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                        >
                          <PreText
                            className="text-label-secondary text-eyebrow"
                            whiteSpace="nowrap"
                          >
                            {metricView.population === "total" ? "Population" : "Density"}
                          </PreText>
                          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-0.5">
                            <PreText
                              className="text-label text-caption font-semibold"
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
                                className="text-footnote"
                              />
                            )}
                          </div>
                        </button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-footnote px-2 py-1">
                      <PreText whiteSpace="nowrap">Click metrics to toggle views</PreText>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* ── Country Actions Grid ──────────────────────────── */}
          <div className="px-3 py-2">
            <p className="text-subhead text-label-secondary px-1 pb-2">Country Actions</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleNavigate("/mycountry/editor")}
                className={actionButtonClass(
                  "border-yellow/20 bg-yellow/5 text-yellow hover:bg-yellow/15"
                )}
              >
                <Edit3 className="h-4 w-4 shrink-0" />
                <span className="truncate">Country Editor</span>
              </button>

              <button
                onClick={() => handleNavigate("/mycountry/map-editor")}
                className={actionButtonClass("border-teal/20 bg-teal/5 text-teal hover:bg-teal/15")}
              >
                <Map className="h-4 w-4 shrink-0" />
                <span className="truncate">Map Editor</span>
              </button>

              <button
                onClick={() => handleNavigate("/mycountry/politics")}
                className={actionButtonClass(
                  "border-indigo/20 bg-indigo/5 text-indigo hover:bg-indigo/15"
                )}
              >
                <Scale className="h-4 w-4 shrink-0" />
                <span className="truncate">Politics</span>
              </button>

              <button
                onClick={() => handleNavigate("/messages")}
                className={actionButtonClass("border-blue/20 bg-blue/5 text-blue hover:bg-blue/15")}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate">Messages</span>
              </button>

              <button
                onClick={() => handleNavigate("/mycountry/diplomacy")}
                className={actionButtonClass("border-teal/20 bg-teal/5 text-teal hover:bg-teal/15")}
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
                  "border-wiki/30 bg-wiki/10 text-wiki hover:bg-wiki/20 hover:text-wiki-hover"
                )}
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="truncate">Wiki Page</span>
              </button>
            </div>
          </div>

          {/* ── Bottom Actions (Sign Out & View Profile) ────── */}
          <div className="border-separator flex items-center justify-between border-t px-3 py-2">
            <SignOutButton>
              <button className="text-label-secondary hover:bg-destructive/10 hover:text-destructive group rounded-control text-footnote flex items-center gap-2.5 px-3 py-2 transition-colors">
                <LogOut className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 group-hover:scale-110" />
                <PreText className="text-inherit" whiteSpace="nowrap">
                  Sign Out
                </PreText>
              </button>
            </SignOutButton>

            <button
              onClick={() =>
                userProfile?.country?.name && handleNavigate(getNationUrl(userProfile.country.name))
              }
              disabled={!userProfile?.country?.name}
              className="text-label-secondary hover:bg-fill-4 hover:text-label group rounded-control text-footnote flex items-center gap-2.5 px-3 py-2 transition-colors disabled:opacity-50"
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
          <div className="bg-fill-4 rounded-row p-6">
            <User className="text-label-secondary mx-auto mb-4 h-10 w-10" />
            <PreText className="text-label-secondary text-footnote mb-4" whiteSpace="nowrap">
              {isStandalone ? "Sign in with IxnayID to edit maps" : "Sign in with IxnayID"}
            </PreText>
            <button
              onClick={() =>
                (window.location.href =
                  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || createAbsoluteUrl("/sign-in"))
              }
              className="bg-tint text-on-tint hover:bg-tint/90 rounded-control-sm text-caption w-full px-4 py-2 transition-colors"
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

// Backwards compatibility alias
export const MyCountryDIView = MyCountryView;
