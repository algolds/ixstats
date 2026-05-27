import React, { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { SimpleFlag } from "../SimpleFlag";
import { HealthRing } from "../ui/health-ring";
import { createAbsoluteUrl } from "~/lib/url-utils";
import { getNationUrl } from "~/lib/slug-utils";
import { formatCompactNumber, formatCompactCurrency } from "~/lib/format-utils";
import { useUser, SignOutButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { isStandaloneClient } from "~/lib/standalone-detection";
import {
  Crown,
  Globe,
  User,
  Users,
  DollarSign,
  TrendingUp,
  ChevronRight,
  Settings,
  LogOut,
} from "lucide-react";
import type { ViewMode } from "./types";

const isStandalone = typeof window !== "undefined" && isStandaloneClient();

interface GreetingPopoverProps {
  greeting: string;
  onSwitchMode: (mode: ViewMode) => void;
}

export function GreetingPopover({ greeting, onSwitchMode }: GreetingPopoverProps) {
  const { user, isLoaded } = useUser();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: userProfile, isLoading: profileLoading } =
    api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

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
  const vitalityScore =
    activityRingsData
      ? Math.round(
          (
            (activityRingsData.economicVitality || 0) +
            (activityRingsData.populationWellbeing || 0) +
            (activityRingsData.diplomaticStanding || 0) +
            (activityRingsData.governmentalEfficiency || 0)
          ) / 4
        )
      : null;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger>
        <span className="text-foreground/70 hover:text-foreground/90 cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10">
          {greeting}
          {user?.firstName ? `, ${user.firstName}` : ""}
        </span>
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
              <div className="text-muted-foreground/60 mb-2 text-[10px] font-semibold uppercase tracking-wider">
                MyCountry
              </div>
              <button
                onClick={() =>
                  userProfile.country &&
                  (window.location.href = createAbsoluteUrl(
                    getNationUrl(userProfile.country.name)
                  ))
                }
                className="hover:bg-accent/10 -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-3 rounded-lg px-1 py-1.5 transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <SimpleFlag
                    countryName={userProfile.country.name}
                    className="h-full w-full object-cover"
                    showPlaceholder={true}
                  />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-foreground truncate text-sm font-semibold">
                    {userProfile.country.name}
                  </div>
                  {/* Dashboard-style stat rows */}
                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                        <Users className="h-3 w-3 text-blue-400" /> Pop
                      </span>
                      <span className="text-foreground text-[10px] font-semibold">
                        {formatCompactNumber(userProfile.country.currentPopulation ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                        <DollarSign className="h-3 w-3 text-emerald-400" /> GDP
                      </span>
                      <span className="text-foreground text-[10px] font-semibold">
                        {formatCompactCurrency(userProfile.country.currentTotalGdp ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                        <TrendingUp className="h-3 w-3 text-amber-400" /> Per Cap
                      </span>
                      <span className="text-foreground text-[10px] font-semibold">
                        {formatCompactCurrency(userProfile.country.currentGdpPerCapita ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground/40 h-3.5 w-3.5 shrink-0" />
              </button>

              {/* National Vitality Rings — 2×2 grid */}
              {activityRingsData && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    { value: activityRingsData.economicVitality || 0, color: "#22c55e", label: "Economy", labelClass: "text-green-600 dark:text-green-400" },
                    { value: activityRingsData.populationWellbeing || 0, color: "#3b82f6", label: "Population", labelClass: "text-blue-600 dark:text-blue-400" },
                    { value: activityRingsData.diplomaticStanding || 0, color: "#a855f7", label: "Diplomacy", labelClass: "text-purple-600 dark:text-purple-400" },
                    { value: activityRingsData.governmentalEfficiency || 0, color: "#f97316", label: "Government", labelClass: "text-orange-600 dark:text-orange-400" },
                  ].map((ring) => (
                    <div key={ring.label} className="flex flex-col items-center gap-1">
                      <HealthRing
                        value={ring.value}
                        size={56}
                        color={ring.color}
                        label={ring.label}
                      />
                      <span className={`text-[10px] font-medium ${ring.labelClass}`}>
                        {ring.label} {ring.value}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Quick Actions ────────────────────────────────── */}
            <div className="space-y-0.5 px-2 py-2">
              <button
                onClick={() =>
                  userProfile.country &&
                  (window.location.href = createAbsoluteUrl(
                    getNationUrl(userProfile.country.name)
                  ))
                }
                className="text-foreground/70 hover:bg-accent/10 hover:text-foreground group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors"
              >
                <Globe className="h-3.5 w-3.5 text-purple-400 drop-shadow-[0_0_4px_rgba(168,85,247,0.5)] transition-all group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]" />
                <span className="flex-1 text-left">Country Profile</span>
                <ChevronRight className="text-muted-foreground/30 h-3 w-3" />
              </button>

              {!isStandalone && (
                <button
                  onClick={() =>
                    (window.location.href = createAbsoluteUrl("/mycountry"))
                  }
                  className="text-foreground/70 hover:bg-accent/10 hover:text-foreground group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors"
                >
                  <Crown className="h-3.5 w-3.5 text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)] transition-all group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
                  <span className="flex-1 text-left">MyCountry</span>
                  <ChevronRight className="text-muted-foreground/30 h-3 w-3" />
                </button>
              )}

              <button
                onClick={() => {
                  setPopoverOpen(false);
                  // Small delay so popover closes before DI panel opens
                  setTimeout(() => onSwitchMode("settings"), 150);
                }}
                className="text-foreground/70 hover:bg-accent/10 hover:text-foreground group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors"
              >
                <Settings className="h-3.5 w-3.5 text-blue-400 drop-shadow-[0_0_4px_rgba(59,130,246,0.5)] transition-all group-hover:rotate-45 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.7)]" />
                <span className="flex-1 text-left">Appearance & Preferences</span>
                <ChevronRight className="text-muted-foreground/30 h-3 w-3" />
              </button>
            </div>

            {/* ── Sign Out ────────────────────────────────────── */}
            <div className="border-border/40 border-t px-2 py-2">
              <SignOutButton>
                <button className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors">
                  <LogOut className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 group-hover:scale-110" />
                  <span>Sign Out</span>
                </button>
              </SignOutButton>
            </div>
          </div>
        ) : (
          /* ── Unauthenticated / no country ────────────────── */
          <div className="p-4 text-center">
            <User className="mx-auto mb-2 h-8 w-8 text-blue-400/60" />
            <div className="text-muted-foreground mb-1 text-sm">
              {isStandalone ? "Welcome to IxWorld!" : "Welcome to IxStats!"}
            </div>
            <div className="text-muted-foreground/70 mb-3 text-xs">
              {isStandalone
                ? "Sign in with IxnayID to edit maps"
                : "Sign in to access your dashboard"}
            </div>
            <button
              onClick={() =>
                (window.location.href =
                  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ||
                  createAbsoluteUrl("/sign-in"))
              }
              className="text-foreground border-border hover:bg-accent/10 rounded-lg border px-4 py-2 text-xs font-medium transition-colors"
            >
              Sign In
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
