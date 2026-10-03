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
import { Badge } from "~/components/ui/badge";
import { motion } from "motion/react";
import type { ViewMode } from "~/components/halo/types";
import { springSnappy } from "~/lib/design/motion";

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

  /** Country action tiles: neutral gray buttons; the icon carries each section's system colour. */
  const ACTION_BUTTON = "w-full justify-start";

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={springSnappy}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={() => (window.location.href = createAbsoluteUrl("/settings"))}
              className="group focus-visible:outline-tint relative flex-shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
              title="Account settings"
              aria-label="Account settings"
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
              {user?.firstName ? user.firstName : "My account"}
            </PreText>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {country && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const slug = country.slug || country.name.replace(/\s+/g, "_");
                  window.location.href = createAbsoluteUrl(`/countries/${slug}`);
                }}
                title="Public country profile"
              >
                <User aria-hidden className="text-blue size-3.5" />
                <span>Profile</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  window.location.href = createAbsoluteUrl("/mycountry/editor");
                }}
                title="Open MyCountry map editor"
              >
                <Edit3 aria-hidden className="text-yellow size-3.5" />
                <span>Editor</span>
              </Button>
            </>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
            className="text-label-secondary hover:text-label"
            title="Close expanded view"
            aria-label="Close expanded view"
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>

      {setupStatus === "complete" && userProfile?.country ? (
        <div>
          {/* ── Your Country ─────────────────────────────────── */}
          <div className="border-separator border-b px-4 pb-3">
            <div className="mb-2 flex w-full items-center justify-between">
              <div className="text-label text-caption flex items-center gap-2 font-semibold">
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
                <Badge variant="warning">Premium</Badge>
              ) : (
                <Badge variant="default">Basic</Badge>
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
                  Basic membership
                </PreText>
              )}
            </div>

            {/* Roles / Ranks / Titles Row */}
            {(userProfile.role ||
              (userProfile.role?.level !== undefined && userProfile.role.level <= 20)) && (
              <div className="mt-1 mb-2 flex flex-wrap gap-1">
                {userProfile.role && (
                  <Badge variant="secondary">
                    <Shield aria-hidden />
                    {userProfile.role.displayName}
                  </Badge>
                )}
                {userProfile.role?.level !== undefined && userProfile.role.level <= 20 && (
                  <Badge variant="warning">
                    <Crown aria-hidden />
                    Founding member
                  </Badge>
                )}
              </div>
            )}
            <div className="rounded-control relative -mx-1 px-1 py-2">
              <button
                type="button"
                onClick={() =>
                  userProfile.country &&
                  (window.location.href = createAbsoluteUrl(getNationUrl(userProfile.country.name)))
                }
                className="hover:bg-fill-4 rounded-control focus-visible:outline-tint flex w-full items-center gap-3 p-1 text-left transition-colors focus-visible:outline-2"
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
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMetricView((v) => ({
                              ...v,
                              gdp: v.gdp === "perCapita" ? "total" : "perCapita",
                            }));
                          }}
                          className="rounded-control bg-fill-4 hover:bg-fill-2 focus-visible:outline-tint duration-fast ease-out-facet p-2 text-center transition-[background-color,scale] focus-visible:outline-2 active:scale-[0.98]"
                        >
                          <PreText
                            className="text-label-secondary text-stat-label"
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
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMetricView((v) => ({
                              ...v,
                              population: v.population === "total" ? "density" : "total",
                            }));
                          }}
                          className="rounded-control bg-fill-4 hover:bg-fill-2 focus-visible:outline-tint duration-fast ease-out-facet p-2 text-center transition-[background-color,scale] focus-visible:outline-2 active:scale-[0.98]"
                        >
                          <PreText
                            className="text-label-secondary text-stat-label"
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

          {/* ── Country actions Grid ──────────────────────────── */}
          <div className="px-3 py-2">
            <p className="text-subhead text-label-secondary px-1 pb-2">Country actions</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleNavigate("/mycountry/editor")}
                className={ACTION_BUTTON}
              >
                <Edit3 aria-hidden className="text-yellow" />
                <span className="truncate">Country editor</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => handleNavigate("/mycountry/map-editor")}
                className={ACTION_BUTTON}
              >
                <Map aria-hidden className="text-teal" />
                <span className="truncate">Map editor</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => handleNavigate("/mycountry/politics")}
                className={ACTION_BUTTON}
              >
                <Scale aria-hidden className="text-indigo" />
                <span className="truncate">Politics</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => handleNavigate("/messages")}
                className={ACTION_BUTTON}
              >
                <MessageSquare aria-hidden className="text-blue" />
                <span className="truncate">Messages</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => handleNavigate("/mycountry/diplomacy")}
                className={ACTION_BUTTON}
              >
                <Handshake aria-hidden className="text-teal" />
                <span className="truncate">Diplomacy</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const wikiPath = userProfile?.country?.name
                    ? `/wiki/${encodeURIComponent(userProfile.country.name.replace(/ /g, "_"))}`
                    : "/wiki";
                  handleNavigate(wikiPath);
                }}
                className={ACTION_BUTTON}
              >
                <BookOpen aria-hidden className="text-indigo" />
                <span className="truncate">Wiki page</span>
              </Button>
            </div>
          </div>

          {/* ── Bottom Actions (Sign Out & View profile) ────── */}
          <div className="border-separator flex items-center justify-between border-t px-3 py-2">
            <SignOutButton>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-label-secondary hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut aria-hidden />
                <PreText className="text-inherit" whiteSpace="nowrap">
                  Sign out
                </PreText>
              </Button>
            </SignOutButton>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                userProfile?.country?.name && handleNavigate(getNationUrl(userProfile.country.name))
              }
              disabled={!userProfile?.country?.name}
              className="text-label-secondary hover:text-label"
            >
              <Globe aria-hidden />
              <PreText className="text-inherit" whiteSpace="nowrap">
                View profile
              </PreText>
            </Button>
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
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() =>
                (window.location.href =
                  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || createAbsoluteUrl("/sign-in"))
              }
              className="w-full"
            >
              <PreText className="text-inherit" whiteSpace="nowrap">
                Sign in
              </PreText>
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Backwards compatibility alias
export const MyCountryDIView = MyCountryView;
