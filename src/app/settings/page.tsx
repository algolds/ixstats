"use client";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import Link from "next/link";
import {
  User,
  Globe,
  AlertCircle,
  BarChart3,
  Shield,
  Coins,
  Palette,
  Settings,
  BookOpen,
  Link2,
} from "lucide-react";

import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { useTheme } from "~/context/theme-context";
import { LoadingState } from "~/components/shared";
import { Skeleton } from "~/components/ui/skeleton";

import {
  AccountInformationCard,
  CountryInformationCard,
  UserPreferencesCard,
  ThinkPagesSettingsCard,
  IxnayIDCard,
  VaultSettingsCard,
  PrivacySecurityCard,
} from "./_components";
import { WikiPreferencesCard } from "~/components/profile/WikiPreferencesCard";
import { DashboardSidebarLayout } from "~/components/dashboard/DashboardSidebarLayout";
import { cn } from "~/lib/utils";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

import { useProfileSettings, useSetupStatus } from "./_hooks";

export const dynamic = "force-dynamic";

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_"));

function ProfileContent() {
  const { user, isLoaded, userProfile, country, isLoading: profileLoading } = useUserCountry();
  const { theme, setTheme } = useTheme();
  const [showVault, setShowVault] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showLore, setShowLore] = useState(false);
  const [showThinkpages, setShowThinkpages] = useState(false);
  const [showIxnayID, setShowIxnayID] = useState(false);
  const [heroCollapsed, setHeroCollapsed] = useState(true);

  const profileSettings = useProfileSettings({
    userProfileCountryId: userProfile?.countryId ?? undefined,
    userId: user?.id,
  });

  const setupStatus = useSetupStatus({
    isLoaded,
    profileLoading,
    user,
    userProfile,
  });

  const {
    data: thinkpagesAccount,
    refetch: refetchThinkpagesAccount,
  } = api.thinkpages.getThinkpagesAccountByUserId.useQuery(
    { clerkUserId: user?.id || "placeholder-disabled" },
    { enabled: !!user?.id }
  );

  const updateThinkpagesAccountMutation = api.thinkpages.updateAccount.useMutation();

  const hasDiscordAccount = user?.externalAccounts?.some(
    (account) => account.provider === "discord"
  );

  if (!isLoaded || profileLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <>
      <SignedIn>
        <div className="relative bg-slate-50 dark:bg-slate-950">
          {/* Animated Background Elements */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-indigo-500/10 blur-[120px] dark:bg-indigo-500/20" />
            <div className="absolute top-[20%] -right-[5%] h-[30%] w-[30%] rounded-full bg-blue-500/10 blur-[100px] dark:bg-blue-500/15" />
            <div className="absolute -bottom-[10%] left-[20%] h-[40%] w-[40%] rounded-full bg-purple-500/10 blur-[120px] dark:bg-purple-500/20" />
          </div>

          <DashboardSidebarLayout
            heroCollapsed={heroCollapsed}
            onHeroExpand={() => setHeroCollapsed(false)}
          >
            <div className="mb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
                    Account <span className="text-indigo-600 dark:text-indigo-400">Settings</span>
                  </h1>
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
                {showPreferences && (
                  <div id="interface-section">
                    <UserPreferencesCard theme={theme} onThemeChange={setTheme} />
                  </div>
                )}

                {showLore && (
                  <div id="lore-section">
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
              </div>
              <div className="lg:sticky lg:top-6 h-fit lg:col-span-4">
                <CutoutCard
                  className={cn(cutoutCardSurfaceClassName, "w-full overflow-hidden rounded-xl")}
                  trackPointerHover={false}
                  texture="dots"
                  textureOpacity={0.06}
                >
                  {/* Cutout tab header */}
                  <div className="relative bg-indigo-500/10 px-4 pt-3.5 pb-5">
                    <div className="text-card-foreground flex items-center gap-2 text-sm font-bold">
                      <Settings className="h-4 w-4 text-indigo-500" />
                      Account Settings
                    </div>
                    <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
                    <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
                  </div>

                  <CutoutCardContent className="space-y-2 p-4 pt-2">
                    <button
                      onClick={() => {
                        const next = !showVault;
                        setShowVault(next);
                        if (next)
                          setTimeout(
                            () =>
                              document
                                .getElementById("vault-section")
                                ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            100
                          );
                      }}
                      className={cn(
                        "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
                        showVault ? "text-slate-900 dark:text-white bg-white/10 dark:bg-white/5 font-bold" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium"
                      )}
                    >
                      <div className="flex items-center">
                        <Coins className={cn("mr-3 h-4 w-4 shrink-0 transition-colors", showVault ? "text-amber-500" : "text-slate-400")} />
                        Vault Upgrades & Rewards
                      </div>
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-all",
                          showVault ? "animate-pulse bg-amber-500 scale-110" : "bg-slate-300 dark:bg-slate-700"
                        )}
                      />
                    </button>

                    <button
                      onClick={() => {
                        const next = !showPrivacy;
                        setShowPrivacy(next);
                        if (next)
                          setTimeout(
                            () =>
                              document
                                .getElementById("privacy-section")
                                ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            100
                          );
                      }}
                      className={cn(
                        "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
                        showPrivacy ? "text-slate-900 dark:text-white bg-white/10 dark:bg-white/5 font-bold" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium"
                      )}
                    >
                      <div className="flex items-center">
                        <Shield className={cn("mr-3 h-4 w-4 shrink-0 transition-colors", showPrivacy ? "text-purple-500" : "text-slate-400")} />
                        Privacy & Security
                      </div>
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-all",
                          showPrivacy ? "animate-pulse bg-purple-500 scale-110" : "bg-slate-300 dark:bg-slate-700"
                        )}
                      />
                    </button>

                    <button
                      onClick={() => {
                        const next = !showIxnayID;
                        setShowIxnayID(next);
                        if (next)
                          setTimeout(
                            () =>
                              document
                                .getElementById("ixnayid-section")
                                ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            100
                          );
                      }}
                      className={cn(
                        "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
                        showIxnayID ? "text-slate-900 dark:text-white bg-white/10 dark:bg-white/5 font-bold" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium"
                      )}
                    >
                      <div className="flex items-center">
                        <Link2 className={cn("mr-3 h-4 w-4 shrink-0 transition-colors", showIxnayID ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} />
                        IxnayID© Settings
                      </div>
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-all",
                          showIxnayID ? "animate-pulse bg-indigo-600 dark:bg-indigo-400 scale-110" : "bg-slate-300 dark:bg-slate-700"
                        )}
                      />
                    </button>

                    <button
                      onClick={() => {
                        const next = !showPreferences;
                        setShowPreferences(next);
                        if (next)
                          setTimeout(
                            () =>
                              document
                                .getElementById("interface-section")
                                ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            100
                          );
                      }}
                      className={cn(
                        "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
                        showPreferences ? "text-slate-900 dark:text-white bg-white/10 dark:bg-white/5 font-bold" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium"
                      )}
                    >
                      <div className="flex items-center">
                        <Palette className={cn("mr-3 h-4 w-4 shrink-0 transition-colors", showPreferences ? "text-indigo-500" : "text-slate-400")} />
                        Interface Preferences
                      </div>
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-all",
                          showPreferences ? "animate-pulse bg-indigo-500 scale-110" : "bg-slate-300 dark:bg-slate-700"
                        )}
                      />
                    </button>

                    <button
                      onClick={() => {
                        const next = !showLore;
                        setShowLore(next);
                        if (next)
                          setTimeout(
                            () =>
                              document
                                .getElementById("lore-section")
                                ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            100
                          );
                      }}
                      className={cn(
                        "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
                        showLore ? "text-slate-900 dark:text-white bg-white/10 dark:bg-white/5 font-bold" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium"
                      )}
                    >
                      <div className="flex items-center">
                        <BookOpen className={cn("mr-3 h-4 w-4 shrink-0 transition-colors", showLore ? "text-blue-500" : "text-slate-400")} />
                        LoreScanner Preferences
                      </div>
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-all",
                          showLore ? "animate-pulse bg-blue-500 scale-110" : "bg-slate-300 dark:bg-slate-700"
                        )}
                      />
                    </button>

                    <button
                      onClick={() => {
                        const next = !showThinkpages;
                        setShowThinkpages(next);
                        if (next)
                          setTimeout(
                            () =>
                              document
                                .getElementById("thinkpages-section")
                                ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            100
                          );
                      }}
                      className={cn(
                        "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
                        showThinkpages ? "text-slate-900 dark:text-white bg-white/10 dark:bg-white/5 font-bold" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium"
                      )}
                    >
                      <div className="flex items-center">
                        <User className={cn("mr-3 h-4 w-4 shrink-0 transition-colors", showThinkpages ? "text-purple-500" : "text-slate-400")} />
                        Thinkpages Preferences
                      </div>
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-all",
                          showThinkpages ? "animate-pulse bg-purple-500 scale-110" : "bg-slate-300 dark:bg-slate-700"
                        )}
                      />
                    </button>
                  </CutoutCardContent>
                </CutoutCard>
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

function SettingsSkeleton() {
  return (
    <div className="relative bg-slate-50 dark:bg-slate-950 min-h-screen">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-indigo-500/5 blur-[120px] dark:bg-indigo-500/10" />
        <div className="absolute top-[20%] -right-[5%] h-[30%] w-[30%] rounded-full bg-blue-500/5 blur-[100px] dark:bg-blue-500/10" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 relative z-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64 rounded-xl" />
            <Skeleton className="h-4 w-40 rounded-lg" />
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/50 bg-white/30 p-2 pr-6 backdrop-blur-md dark:border-slate-800/30 dark:bg-slate-900/30">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Main Content Area Skeletons */}
          <div className="space-y-8 lg:col-span-8">
            {/* Account Information Card Skeleton */}
            <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1">
              <div className="rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-6 w-48 rounded-lg" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30 space-y-2">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-5 w-32 rounded-lg" />
                  </div>
                  <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30 space-y-2">
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-5 w-40 rounded-lg" />
                  </div>
                  <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30 space-y-2">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-5 w-24 rounded-lg" />
                  </div>
                  <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30 space-y-2">
                    <Skeleton className="h-3 w-28 rounded" />
                    <Skeleton className="h-5 w-36 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>

            {/* Country Info Card Skeleton */}
            <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1">
              <div className="rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40 space-y-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="h-6 w-52 rounded-lg" />
                </div>
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                  <Skeleton className="h-32 w-48 rounded-2xl" />
                  <div className="flex-1 space-y-4">
                    <Skeleton className="h-6 w-3/4 rounded-lg" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-20 rounded" />
                        <Skeleton className="h-5 w-28 rounded-lg" />
                      </div>
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-20 rounded" />
                        <Skeleton className="h-5 w-28 rounded-lg" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links Sidebar Skeletons */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1">
              <div className="rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-36 rounded" />
                </div>
                
                {/* 6 Quick link buttons skeletonized */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50/50 p-3.5 dark:bg-slate-800/30">
                    <div className="flex items-center gap-3 w-full">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-3/4 rounded" />
                    </div>
                    <Skeleton className="h-2 w-2 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  usePageTitle({ title: "Settings" });

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

  return <ProfileContent />;
}
