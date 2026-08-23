"use client";

import { useState, useEffect } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import Link from "next/link";
import { User, Globe, WarningCircle as AlertCircle, StatsReport as BarChart3 } from "iconoir-react";

import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { useTheme } from "~/context/theme-context";

import {
  AccountInformationCard,
  CountryInformationCard,
  UserPreferencesCard,
  ThinkPagesSettingsCard,
  IxnayIDCard,
  VaultSettingsCard,
  PrivacySecurityCard,
  GeographicReconciliationCard,
  NotificationSettingsCard,
  NSCardSettingsCard,
} from "./index";
import { SettingsQuickNav } from "./SettingsQuickNav";
import { SettingsSkeleton } from "./SettingsSkeleton";
import { WikiPreferencesCard } from "~/components/wiki-os/WikiPreferencesCard";
import { DashboardSidebarLayout } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { Backlight } from "~/components/ui/backlight";
import { PixelHeading } from "~/components/ui/pixel-heading-character";
import { useProfileSettings, useSetupStatus } from "../_hooks";

export { SettingsSkeleton };

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_"));

export function SettingsContent() {
  usePageTitle({ title: "Settings" });

  const { user, isLoaded, userProfile, country, isLoading: profileLoading } = useUserCountry();
  const { theme, setTheme } = useTheme();
  const [showVault, setShowVault] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLore, setShowLore] = useState(false);
  const [showThinkpages, setShowThinkpages] = useState(false);
  const [showIxnayID, setShowIxnayID] = useState(false);
  const [showGeoReconciliation, setShowGeoReconciliation] = useState(false);
  const [showNSCards, setShowNSCards] = useState(false);
  const [heroCollapsed, setHeroCollapsed] = useState(true);

  // Auto-expand section based on URL hash (e.g. #wiki-settings)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (
      hash === "#wiki-settings" ||
      hash === "#wiki-settings-section" ||
      hash === "#wiki-preferences" ||
      hash === "#wiki-preferences-section" ||
      hash === "#lore-section"
    ) {
      setShowLore(true);
      setTimeout(() => {
        const el =
          document.getElementById("wiki-settings-section") ||
          document.getElementById("wiki-preferences-section");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, []);

  const profileSettings = useProfileSettings({
    userProfileCountryId: userProfile?.countryId ?? undefined,
    userId: user?.id,
  });

  const setupStatus = useSetupStatus({
    isLoaded,
    profileLoading,
    user: user as any,
    userProfile,
  });

  const { data: thinkpagesAccount, refetch: refetchThinkpagesAccount } =
    api.thinkpages.getThinkpagesAccountByUserId.useQuery(
      { clerkUserId: user?.id || "placeholder-disabled" },
      { enabled: !!user?.id }
    );

  const updateThinkpagesAccountMutation = api.thinkpages.updateAccount.useMutation();

  const hasDiscordAccount = user?.externalAccounts?.some(
    (account) => account.provider === "discord"
  );

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
              href={"/dashboard"}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              View Dashboard
            </Link>
            <Link
              href={"/countries"}
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
          {/* Backlight background wrapper */}
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
            <div className="mb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <PixelHeading
                    as="h1"
                    prefix="Account"
                    prefixFont="none"
                    prefixClassName="text-slate-900 dark:text-white"
                    mode="wave"
                    autoPlay
                    className="text-4xl font-extrabold tracking-tight text-indigo-600 sm:text-5xl dark:text-indigo-400"
                  >
                    Settings
                  </PixelHeading>
                </div>

                {user && (
                  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white/50 p-2 pr-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                      <img
                        src={user.imageUrl}
                        alt={user.username || "User"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Authenticated as
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {user.username || user.firstName || "Diplomat"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="space-y-8 lg:col-span-8">
                <AccountInformationCard
                  user={user as any}
                  setupStatus={setupStatus}
                  hasDiscordAccount={hasDiscordAccount || false}
                />

                {setupStatus === "complete" && userProfile?.country && (
                  <CountryInformationCard
                    country={(country?.newStats ?? userProfile.country) as any}
                    uploadedFlagUrl={profileSettings.uploadedFlagUrl}
                    flagUploadMode={profileSettings.flagUploadMode}
                    isEditingCountry={profileSettings.isEditingCountry}
                    newCountryName={profileSettings.newCountryName}
                    updateCountryNameMutation={profileSettings.updateCountryNameMutation}
                    onEditCountry={() => {
                      profileSettings.setIsEditingCountry(true);
                      profileSettings.setNewCountryName(userProfile.country?.name ?? "");
                    }}
                    onUpdateCountryName={profileSettings.handleUpdateCountryName}
                    onCancelEdit={() => {
                      profileSettings.setIsEditingCountry(false);
                      profileSettings.setNewCountryName("");
                    }}
                    onSetNewCountryName={profileSettings.setNewCountryName}
                    onToggleFlagUpload={() =>
                      profileSettings.setFlagUploadMode(!profileSettings.flagUploadMode)
                    }
                    onFlagUpload={profileSettings.handleFlagUpload}
                    onFlagSave={profileSettings.handleFlagSave}
                    onCancelFlagUpload={() => {
                      profileSettings.setUploadedFlagUrl(null);
                      profileSettings.setFlagUploadMode(false);
                    }}
                    isUploadingFlag={profileSettings.isUploadingFlag}
                    updateCountryFlagMutation={profileSettings.updateCountryFlagMutation}
                    membershipTier={userProfile?.membershipTier}
                    role={userProfile?.role}
                  />
                )}

                {setupStatus === "needs-setup" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
                    <div className="mb-4 flex items-center">
                      <AlertCircle className="mr-2 h-5 w-5 text-amber-500" />
                      <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                        Setup Required
                      </h2>
                    </div>
                    <p className="mb-4 text-amber-700 dark:text-amber-300">
                      You need to complete your account setup by linking to an existing country or
                      creating a new one.
                    </p>
                    <Link
                      href={"/setup"}
                      className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
                    >
                      <Globe className="mr-2 h-4 w-4" />
                      Complete Setup
                    </Link>
                  </div>
                )}

                {showVault && (
                  <div id="vault-section">
                    <VaultSettingsCard />
                  </div>
                )}

                {showPrivacy && (
                  <div id="privacy-section">
                    <PrivacySecurityCard
                      countryId={userProfile?.countryId}
                      initialHideDiplomatic={country?.hideDiplomaticOps || false}
                      initialHideStratcomm={country?.hideStratcommIntel || false}
                    />
                  </div>
                )}

                {showGeoReconciliation && userProfile?.countryId && (
                  <div id="geo-reconciliation-section">
                    <GeographicReconciliationCard countryId={userProfile.countryId} />
                  </div>
                )}
                {showPreferences && (
                  <div id="interface-section">
                    <UserPreferencesCard theme={theme} onThemeChange={setTheme} />
                  </div>
                )}

                {showNotifications && user?.id && (
                  <div id="notifications-section">
                    <NotificationSettingsCard userId={user.id} />
                  </div>
                )}

                {showLore && (
                  <div id="wiki-settings-section">
                    <WikiPreferencesCard />
                  </div>
                )}

                {showThinkpages && thinkpagesAccount && (
                  <div id="thinkpages-section">
                    <ThinkPagesSettingsCard
                      thinkpagesAccount={thinkpagesAccount}
                      updateThinkpagesAccountMutation={updateThinkpagesAccountMutation}
                      onRefetch={refetchThinkpagesAccount}
                    />
                  </div>
                )}

                {showIxnayID && (
                  <div id="ixnayid-section">
                    <IxnayIDCard hasDiscordAccount={hasDiscordAccount} />
                  </div>
                )}

                {showNSCards && (
                  <div id="ns-cards-section">
                    <NSCardSettingsCard />
                  </div>
                )}
              </div>

              {/* Sidebar Settings Quick Navigation */}
              <SettingsQuickNav
                showVault={showVault}
                setShowVault={setShowVault}
                showPrivacy={showPrivacy}
                setShowPrivacy={setShowPrivacy}
                showPreferences={showPreferences}
                setShowPreferences={setShowPreferences}
                showNotifications={showNotifications}
                setShowNotifications={setShowNotifications}
                showLore={showLore}
                setShowLore={setShowLore}
                showThinkpages={showThinkpages}
                setShowThinkpages={setShowThinkpages}
                showIxnayID={showIxnayID}
                setShowIxnayID={setShowIxnayID}
                showGeoReconciliation={showGeoReconciliation}
                setShowGeoReconciliation={setShowGeoReconciliation}
                showNSCards={showNSCards}
                setShowNSCards={setShowNSCards}
                hasCountryId={Boolean(userProfile?.countryId)}
              />
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
