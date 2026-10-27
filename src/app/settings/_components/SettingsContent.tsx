"use client";

import { Button } from "~/components/ui/button";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Globe, WarningCircle as AlertCircle, StatsReport as BarChart3 } from "iconoir-react";

import { usePageTitle } from "~/hooks/usePageTitle";
import { SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import { useUserCountry } from "~/hooks/useUserCountry";

import { SettingsSkeleton } from "./SettingsSkeleton";
import { DashboardColumn } from "~/components/dashboard/DashboardColumn";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";
import { SETTINGS_TAB_IDS, type SettingSectionId } from "../_lib/sections";

export { SettingsSkeleton };

// Skeleton placeholder for dynamically loaded settings panels
function PanelSkeleton() {
  return (
    <div className="space-y-6">
      <div className="border-separator bg-surface rounded-card h-20 animate-pulse border" />
      <div className="space-y-3">
        <div className="bg-muted/40 h-4 w-32 animate-pulse rounded-md" />
        <div className="border-separator bg-surface rounded-card h-48 animate-pulse border" />
      </div>
      <div className="space-y-3">
        <div className="bg-muted/40 h-4 w-40 animate-pulse rounded-md" />
        <div className="border-separator bg-surface rounded-card h-40 animate-pulse border" />
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
const AppearanceAccessibilityPanel = dynamic(
  () => import("./panels/AppearanceAccessibilityPanel").then((m) => m.AppearanceAccessibilityPanel),
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

const VALID_TABS = new Set<SettingSectionId>(SETTINGS_TAB_IDS);

export function SettingsContent() {
  usePageTitle({ title: "Settings" });

  // oxlint-disable-next-line eslint/no-unused-vars
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded, userProfile, country, isLoading: profileLoading } = useUserCountry();

  const tabParam = searchParams.get("tab") as SettingSectionId | null;
  const initialSection = tabParam && VALID_TABS.has(tabParam) ? tabParam : "account";

  const [activeSection, setActiveSection] = useState<SettingSectionId>(initialSection);

  // Sync state if URL query param changes
  useEffect(() => {
    if (tabParam && VALID_TABS.has(tabParam) && tabParam !== activeSection) {
      setActiveSection(tabParam);
    }
  }, [tabParam, activeSection]);

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
            Authentication is not configured
          </h1>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Sign-in is not set up for this deployment. Contact an administrator, or browse the
            public dashboard.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              View dashboard
            </Link>
            <Link
              href="/countries"
              className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Globe className="mr-2 h-4 w-4" />
              Browse countries
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
          {/* Phone title under the new navigation shell (nothing with the flag off). */}
          <ShellPageHeader title="Settings" className="relative" />

          <DashboardColumn>
            {/* Incomplete Setup Banner */}
            {setupStatus === "needs-setup" && (
              <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Country setup required
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Link your account to a country or create one to use every setting.
                    </p>
                  </div>
                  <Button asChild variant="default" size="sm">
                    <Link href="/setup">Complete setup</Link>
                  </Button>
                </div>
              </div>
            )}

            {/* The sidebar's Settings area list (and the More sheet) switch the tab. */}
            <main className="min-w-0">
              {activeSection === "account" && <AccountIdentityPanel user={user} />}

              {activeSection === "country" &&
                (country?.newStats || userProfile?.country ? (
                  <CountryNationPanel
                    country={country?.newStats ?? userProfile?.country}
                    membershipTier={userProfile?.membershipTier}
                    roleDisplayName={userProfile?.role?.displayName || userProfile?.role?.name}
                  />
                ) : (
                  <div className="border-separator bg-surface rounded-card border p-8 text-center">
                    <Globe className="text-muted-foreground/60 mx-auto mb-2 h-8 w-8" />
                    <h3 className="text-foreground text-sm font-bold">No country linked</h3>
                    <p className="text-muted-foreground mt-1 mb-4 text-xs">
                      Link or create a country to manage its settings.
                    </p>
                    <Button asChild variant="default" size="sm">
                      <Link href="/setup">Set up a country</Link>
                    </Button>
                  </div>
                ))}

              {activeSection === "appearance" && <AppearanceAccessibilityPanel />}

              {activeSection === "wikios" && <WikiOSOptionsPanel />}

              {activeSection === "notifications" && user?.id && (
                <NotificationSettingsPanel userId={user.id} />
              )}

              {activeSection === "social" && user?.id && <SocialPersonaPanel userId={user.id} />}

              {activeSection === "privacy" && <PrivacySecurityPanel />}

              {activeSection === "vault" && <VaultStatusPanel />}

              {activeSection === "cosmetics" && <CosmeticsUpgradesPanel />}

              {activeSection === "cards" && <NationStatesCardsPanel />}
            </main>
          </DashboardColumn>
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
