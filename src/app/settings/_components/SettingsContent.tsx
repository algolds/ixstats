"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Globe, WarningCircle as AlertCircle, StatsReport as BarChart3 } from "iconoir-react";

import { usePageTitle } from "~/hooks/usePageTitle";
import { SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import { useUserCountry } from "~/hooks/useUserCountry";

import { SettingsSidebarNav } from "./SettingsSidebarNav";
import { SettingsSkeleton } from "./SettingsSkeleton";
import { DashboardSidebarLayout } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { Backlight } from "~/components/ui/backlight";
import { type SettingSectionId } from "../_lib/sections";

export { SettingsSkeleton };

// Skeleton placeholder for dynamically loaded settings panels
function PanelSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-20 animate-pulse rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md" />
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded-md bg-muted/40" />
        <div className="h-48 animate-pulse rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded-md bg-muted/40" />
        <div className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md" />
      </div>
    </div>
  );
}

// Dynamically imported consolidated panels
const AccountIdentityPanel = dynamic(
  () => import("./panels/AccountIdentityPanel").then((m) => m.AccountIdentityPanel),
  { loading: PanelSkeleton }
);
const CountryNationPanel = dynamic(
  () => import("./panels/CountryNationPanel").then((m) => m.CountryNationPanel),
  { loading: PanelSkeleton }
);
const AppearanceThemePanel = dynamic(
  () => import("./panels/AppearanceThemePanel").then((m) => m.AppearanceThemePanel),
  { loading: PanelSkeleton }
);
const WikiOSOptionsPanel = dynamic(
  () => import("./panels/WikiOSOptionsPanel").then((m) => m.WikiOSOptionsPanel),
  { loading: PanelSkeleton }
);
const NotificationSettingsPanel = dynamic(
  () => import("./panels/NotificationSettingsPanel").then((m) => m.NotificationSettingsPanel),
  { loading: PanelSkeleton }
);
const VaultStatusPanel = dynamic(
  () => import("./panels/VaultStatusPanel").then((m) => m.VaultStatusPanel),
  { loading: PanelSkeleton }
);
const CosmeticsUpgradesPanel = dynamic(
  () => import("./panels/CosmeticsUpgradesPanel").then((m) => m.CosmeticsUpgradesPanel),
  { loading: PanelSkeleton }
);
const SocialPersonaPanel = dynamic(
  () => import("./panels/SocialPersonaPanel").then((m) => m.SocialPersonaPanel),
  { loading: PanelSkeleton }
);
const PrivacySecurityPanel = dynamic(
  () => import("./panels/PrivacySecurityPanel").then((m) => m.PrivacySecurityPanel),
  { loading: PanelSkeleton }
);
const NationStatesCardsPanel = dynamic(
  () => import("./panels/NationStatesCardsPanel").then((m) => m.NationStatesCardsPanel),
  { loading: PanelSkeleton }
);

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_"));

const VALID_TABS = new Set<SettingSectionId>([
  "account",
  "country",
  "appearance",
  "wikios",
  "notifications",
  "social",
  "privacy",
  "vault",
  "cosmetics",
  "cards",
]);

export function SettingsContent() {
  usePageTitle({ title: "Settings" });

  // oxlint-disable-next-line eslint/no-unused-vars
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded, userProfile, country, isLoading: profileLoading } = useUserCountry();

  const tabParam = searchParams.get("tab") as SettingSectionId | null;
  const initialSection = tabParam && VALID_TABS.has(tabParam) ? tabParam : "account";

  const [activeSection, setActiveSection] = useState<SettingSectionId>(initialSection);
  const [heroCollapsed, setHeroCollapsed] = useState(true);

  // Sync state if URL query param changes
  useEffect(() => {
    if (tabParam && VALID_TABS.has(tabParam) && tabParam !== activeSection) {
      setActiveSection(tabParam);
    }
  }, [tabParam, activeSection]);

  const handleSelectSection = useCallback(
    (id: SettingSectionId) => {
      setActiveSection(id);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState({}, "", url.toString());
    },
    []
  );

  const setupStatus: "loading" | "unauthenticated" | "needs-setup" | "complete" =
    !isLoaded || profileLoading
      ? "loading"
      : !user
        ? "unauthenticated"
        : !userProfile?.countryId
          ? "needs-setup"
          : "complete";

  if (!isClerkConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <User className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            Authentication Not Configured
          </h1>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            User authentication is not set up for this application. Please contact an administrator
            to configure authentication or browse the public dashboard.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              View Dashboard
            </Link>
            <Link
              href="/countries"
              className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Globe className="mr-2 h-4 w-4" />
              Browse Countries
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded || profileLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <>
      <SignedIn>
        <div className="relative flex min-h-full w-full flex-1 flex-col">
          {/* Subtle Backlight background wrapper */}
          <Backlight blur={60} className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="relative h-full w-full">
              <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-indigo-500/10 dark:bg-indigo-500/15" />
              <div className="absolute top-[20%] -right-[5%] h-[30%] w-[30%] rounded-full bg-blue-500/10 dark:bg-blue-500/10" />
              <div className="absolute -bottom-[10%] left-[20%] h-[40%] w-[40%] rounded-full bg-purple-500/10 dark:bg-purple-500/15" />
            </div>
          </Backlight>

          <DashboardSidebarLayout
            heroCollapsed={heroCollapsed}
            onHeroExpand={() => setHeroCollapsed(false)}
            disableCollapse={true}
          >
            {/* Incomplete Setup Banner */}
            {setupStatus === "needs-setup" && (
              <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 dark:text-amber-400" />
                  <div className="flex-1">
                    <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Country Setup Required
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Link your account to a country or create a new nation to unlock all features.
                    </p>
                  </div>
                  <Link
                    href="/setup"
                    className="facet-interactive rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 active:scale-[0.98]"
                  >
                    Complete Setup
                  </Link>
                </div>
              </div>
            )}

            {/* Two-Pane Layout: Left Main Viewport (8 cols), Right Navigation Rail (4 cols) */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              {/* Left Column: Active Settings Viewport */}
              <main className="min-w-0 lg:col-span-8">
                {activeSection === "account" && (
                  <AccountIdentityPanel user={user} />
                )}

                {activeSection === "country" && (
                  country?.newStats || userProfile?.country ? (
                    <CountryNationPanel
                      country={country?.newStats ?? userProfile?.country}
                      membershipTier={userProfile?.membershipTier}
                      roleDisplayName={userProfile?.role?.displayName || userProfile?.role?.name}
                    />
                  ) : (
                    <div className="rounded-2xl border border-border/40 bg-card/40 p-8 text-center backdrop-blur-md">
                      <Globe className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                      <h3 className="text-sm font-bold text-foreground">No Country Linked</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">
                        You need to link or create a country to manage nation settings.
                      </p>
                      <Link
                        href="/setup"
                        className="facet-interactive inline-flex items-center rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                      >
                        Launch Setup
                      </Link>
                    </div>
                  )
                )}

                {activeSection === "appearance" && (
                  <AppearanceThemePanel />
                )}

                {activeSection === "wikios" && (
                  <WikiOSOptionsPanel />
                )}

                {activeSection === "notifications" && user?.id && (
                  <NotificationSettingsPanel userId={user.id} />
                )}

                {activeSection === "social" && user?.id && (
                  <SocialPersonaPanel userId={user.id} />
                )}

                {activeSection === "privacy" && (
                  <PrivacySecurityPanel />
                )}

                {activeSection === "vault" && (
                  <VaultStatusPanel />
                )}

                {activeSection === "cosmetics" && (
                  <CosmeticsUpgradesPanel />
                )}

                {activeSection === "cards" && (
                  <NationStatesCardsPanel />
                )}
              </main>

              {/* Right Column: Sticky Navigation Rail */}
              <div className="lg:col-span-4">
                <SettingsSidebarNav
                  activeSection={activeSection}
                  onSelectSection={handleSelectSection}
                  hasCountryId={Boolean(userProfile?.countryId)}
                  user={user}
                  membershipTier={userProfile?.membershipTier}
                  roleDisplayName={userProfile?.role?.displayName || userProfile?.role?.name}
                />
              </div>
            </div>
          </DashboardSidebarLayout>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center">
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
    </>
  );
}
