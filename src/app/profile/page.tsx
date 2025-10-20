"use client";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { useUser, SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import Link from "next/link";
import { User, ArrowLeft, Globe, AlertCircle, BarChart3, Shield, Key, Palette, Disc } from "lucide-react";

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
  QuickActionsSection
} from "./_components";

import { useProfileSettings, useSetupStatus } from "./_hooks";

export const dynamic = 'force-dynamic';

const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_')
);

function ProfileContent() {
  const { user, isLoaded, userProfile, isLoading: profileLoading } = useUserCountry();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [showPreferences, setShowPreferences] = useState(false);

  const profileSettings = useProfileSettings({
    userProfileCountryId: userProfile?.countryId ?? undefined,
    userId: user?.id
  });

  const setupStatus = useSetupStatus({
    isLoaded,
    profileLoading,
    user,
    userProfile
  });

  const { data: thinkpagesAccount, isLoading: thinkpagesAccountLoading, refetch: refetchThinkpagesAccount } = api.thinkpages.getThinkpagesAccountByUserId.useQuery(
    { clerkUserId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id }
  );

  const updateThinkpagesAccountMutation = api.thinkpages.updateAccount.useMutation();

  const hasDiscordAccount = user?.externalAccounts?.some(account => account.provider === 'discord');

  if (!isLoaded || profileLoading) {
    return <LoadingState variant="spinner" size="lg" message="Loading profile..." fullScreen />;
  }

  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <Link
                href={createUrl("/dashboard")}
                className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Profile Settings
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-300">
                Manage your account and country settings
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <AccountInformationCard
                  user={user as any}
                  setupStatus={setupStatus}
                  hasDiscordAccount={hasDiscordAccount || false}
                />

                {setupStatus === 'complete' && userProfile?.country && (
                  <CountryInformationCard
                    country={userProfile.country}
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
                    onToggleFlagUpload={() => profileSettings.setFlagUploadMode(!profileSettings.flagUploadMode)}
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

                {setupStatus === 'needs-setup' && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
                      <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                        Setup Required
                      </h2>
                    </div>
                    <p className="text-amber-700 dark:text-amber-300 mb-4">
                      You need to complete your account setup by linking to an existing country or creating a new one.
                    </p>
                    <Link
                      href={createUrl("/setup")}
                      className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white rounded-md font-medium"
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      Complete Setup
                    </Link>
                  </div>
                )}

                {showPreferences && (
                  <UserPreferencesCard
                    theme={theme}
                    onThemeChange={setTheme}
                  />
                )}

                {thinkpagesAccount && (
                  <ThinkPagesSettingsCard
                    thinkpagesAccount={thinkpagesAccount}
                    updateThinkpagesAccountMutation={updateThinkpagesAccountMutation}
                    onRefetch={refetchThinkpagesAccount}
                  />
                )}
              </div>

              <div className="space-y-6">
                <QuickActionsSection
                  setupStatus={setupStatus}
                  countryId={userProfile?.country?.id}
                />

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Account Settings
                  </h3>
                  <div className="space-y-3">
                    <button 
                      onClick={() => setShowPreferences(!showPreferences)}
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      Preferences
                    </button>
                    <button className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                      <Shield className="h-4 w-4 mr-2" />
                      Privacy & Security
                    </button>
                    <button className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                      <Key className="h-4 w-4 mr-2" />
                      Connected Accounts
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center mb-4">
                    <Disc className="h-5 w-5 text-[#5865F2] mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Discord Account
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p>Your account is managed through Discord authentication.</p>
                      {hasDiscordAccount && (
                        <p className="mt-2 text-green-600 dark:text-green-400">
                          ✓ Connected to Discord
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      <p>To manage your account settings, use the Discord account management portal.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-screen">
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center max-w-2xl mx-auto">
          <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Authentication Not Configured</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            User authentication is not set up for this application. Please contact an administrator 
            to configure authentication or browse the public dashboard.
          </p>
          <div className="flex gap-4 justify-center">
            <Link 
              href={createUrl("/dashboard")}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Dashboard
            </Link>
            <Link 
              href={createUrl("/countries")}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md font-medium"
            >
              <Globe className="h-4 w-4 mr-2" />
              Browse Countries
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ProfileContent />;
}
