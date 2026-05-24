"use client";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import Link from "next/link";
import {
  User,
  ArrowLeft,
  Globe,
  AlertCircle,
  BarChart3,
  Shield,
  Key,
  Palette,
  Disc,
  Settings,
  UserCircle,
  BookOpen,
  Link2,
} from "lucide-react";

import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { useTheme } from "~/context/theme-context";
import { createUrl } from "~/lib/url-utils";
import { LoadingState } from "~/components/shared";

import {
  AccountInformationCard,
  CountryInformationCard,
  UserPreferencesCard,
  ThinkPagesSettingsCard,
  QuickActionsSection,
  IxnayIDCard,
} from "./_components";
import { WikiPreferencesCard } from "~/components/profile/WikiPreferencesCard";

import { useProfileSettings, useSetupStatus } from "./_hooks";

export const dynamic = "force-dynamic";

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_"));

function ProfileContent() {
  const { user, isLoaded, userProfile, country, isLoading: profileLoading } = useUserCountry();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [showPreferences, setShowPreferences] = useState(false);
  const [showLore, setShowLore] = useState(false);
  const [showThinkpages, setShowThinkpages] = useState(false);
  const [showIxnayID, setShowIxnayID] = useState(false);

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
    isLoading: thinkpagesAccountLoading,
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
    return <LoadingState variant="spinner" size="lg" message="Loading profile..." fullScreen />;
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

          <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
                    Profile <span className="text-indigo-600 dark:text-indigo-400">Settings</span>
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
              <div className="glass-surface glass-refraction h-fit overflow-hidden rounded-3xl p-1 lg:col-span-4">
                <div className="rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
                  <div className="mb-6 flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Account Settings
                    </h3>
                  </div>

                  <div className="space-y-2">
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
                      className="glass-interactive flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    >
                      <div className="flex items-center">
                        <Link2 className="mr-3 h-4 w-4 text-indigo-600" />
                        IxnayID Sync
                      </div>
                      <div
                        className={`h-2 w-2 rounded-full ${showIxnayID ? "animate-pulse bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"}`}
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
                      className="glass-interactive flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    >
                      <div className="flex items-center">
                        <Palette className="mr-3 h-4 w-4 text-indigo-500" />
                        Interface Preferences
                      </div>
                      <div
                        className={`h-2 w-2 rounded-full ${showPreferences ? "animate-pulse bg-indigo-500" : "bg-slate-300 dark:bg-slate-700"}`}
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
                      className="glass-interactive flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    >
                      <div className="flex items-center">
                        <BookOpen className="mr-3 h-4 w-4 text-blue-500" />
                        LoreScanner Preferences
                      </div>
                      <div
                        className={`h-2 w-2 rounded-full ${showLore ? "animate-pulse bg-blue-500" : "bg-slate-300 dark:bg-slate-700"}`}
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
                      className="glass-interactive flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    >
                      <div className="flex items-center">
                        <User className="mr-3 h-4 w-4 text-purple-500" />
                        Thinkpages Preferences
                      </div>
                      <div
                        className={`h-2 w-2 rounded-full ${showThinkpages ? "animate-pulse bg-purple-500" : "bg-slate-300 dark:bg-slate-700"}`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

export default function ProfilePage() {
  usePageTitle({ title: "Profile" });

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
