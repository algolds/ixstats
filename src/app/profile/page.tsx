"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { 
  User, 
  Crown, 
  Settings, 
  Globe, 
  AlertCircle, 
  CheckCircle,
  ArrowLeft,
  Edit3,
  Save,
  X,
  BarChart3,
  Building,
  Disc,
  Moon,
  Sun,
  Monitor,
  Shield,
  Key,
  Palette
} from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { CountryFlag } from "~/app/_components/CountryFlag";
import { useTheme } from "~/context/theme-context";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isEditingCountry, setIsEditingCountry] = useState(false);
  const [newCountryName, setNewCountryName] = useState("");
  const [showPreferences, setShowPreferences] = useState(false);

  // Get user profile
  const { data: userProfile, isLoading: profileLoading, refetch: refetchProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // Mutations
  const updateCountryNameMutation = api.countries.updateCountryName.useMutation();

  const handleUpdateCountryName = async () => {
    if (!userProfile?.countryId || !newCountryName.trim()) return;

    try {
      await updateCountryNameMutation.mutateAsync({
        countryId: userProfile.countryId,
        name: newCountryName.trim()
      });
      
      await refetchProfile();
      setIsEditingCountry(false);
      setNewCountryName("");
    } catch (error) {
      console.error('Failed to update country name:', error);
    }
  };

  const getSetupStatus = () => {
    if (!isLoaded || profileLoading) return 'loading';
    if (!user) return 'unauthenticated';
    if (!userProfile?.countryId) return 'needs-setup';
    return 'complete';
  };

  const setupStatus = getSetupStatus();

  // Check if user has Discord account
  const hasDiscordAccount = user?.externalAccounts?.some(account => account.provider === 'discord');

  if (!isLoaded || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <Link
                href="/dashboard"
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
              {/* User Information */}
              <div className="lg:col-span-2 space-y-6">
                {/* Account Information */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Account Information
                      </h2>
                    </div>
                    <UserButton 
                      appearance={{
                        elements: {
                          avatarBox: "h-8 w-8"
                        }
                      }}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Name
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {user?.firstName} {user?.lastName}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {user?.emailAddresses?.[0]?.emailAddress}
                      </p>
                    </div>

                    {/* Discord Integration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Discord Integration
                      </label>
                      <div className="flex items-center">
                        <Disc className="h-4 w-4 text-[#5865F2] mr-2" />
                        {hasDiscordAccount ? (
                          <div className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-green-700 dark:text-green-300">Connected to Discord</span>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <AlertCircle className="h-4 w-4 text-amber-500 mr-2" />
                            <span className="text-amber-700 dark:text-amber-300">Not connected to Discord</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Your account is managed through Discord authentication
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Account Status
                      </label>
                      <div className="flex items-center">
                        {setupStatus === 'complete' ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-green-700 dark:text-green-300">Setup Complete</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-amber-500 mr-2" />
                            <span className="text-amber-700 dark:text-amber-300">Setup Required</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Country Information */}
                {setupStatus === 'complete' && userProfile?.country && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Crown className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                          My Country
                        </h2>
                      </div>
                      <Link
                        href={`/countries/${userProfile.country.id}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium"
                      >
                        View Details →
                      </Link>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Country Name
                        </label>
                        {isEditingCountry ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newCountryName}
                              onChange={(e) => setNewCountryName(e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
                              placeholder={userProfile.country.name}
                            />
                            <button
                              onClick={handleUpdateCountryName}
                              disabled={updateCountryNameMutation.isPending}
                              className="px-3 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-md disabled:opacity-50"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setIsEditingCountry(false);
                                setNewCountryName("");
                              }}
                              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 text-white rounded-md"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CountryFlag 
                                countryName={userProfile.country.name} 
                                size="md" 
                                className="rounded shadow-sm"
                              />
                              <p className="text-gray-900 dark:text-white">
                                {userProfile.country.name}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setIsEditingCountry(true);
                                setNewCountryName(userProfile.country?.name ?? "");
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Economic Tier
                        </label>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          userProfile.country.economicTier === 'Advanced' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          userProfile.country.economicTier === 'Developed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          userProfile.country.economicTier === 'Emerging' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                          {userProfile.country.economicTier}
                        </span>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Population
                        </label>
                        <p className="text-gray-900 dark:text-white">
                          {userProfile.country.currentPopulation?.toLocaleString() || 'N/A'}
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          GDP per Capita
                        </label>
                        <p className="text-gray-900 dark:text-white">
                          ${userProfile.country.currentGdpPerCapita?.toLocaleString() || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Setup Required */}
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
                      href="/setup"
                      className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white rounded-md font-medium"
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      Complete Setup
                    </Link>
                  </div>
                )}

                {/* User Preferences */}
                {showPreferences && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center mb-4">
                      <Palette className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        User Preferences
                      </h2>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Theme
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          <button
                            onClick={() => setTheme('light')}
                            className={`flex items-center justify-center px-4 py-3 rounded-lg border transition-colors ${
                              theme === 'light'
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <Sun className="h-4 w-4 mr-2" />
                            Light
                          </button>
                          <button
                            onClick={() => setTheme('dark')}
                            className={`flex items-center justify-center px-4 py-3 rounded-lg border transition-colors ${
                              theme === 'dark'
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <Moon className="h-4 w-4 mr-2" />
                            Dark
                          </button>
                          <button
                            onClick={() => setTheme('system')}
                            className={`flex items-center justify-center px-4 py-3 rounded-lg border transition-colors ${
                              theme === 'system'
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <Monitor className="h-4 w-4 mr-2" />
                            System
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Choose your preferred theme. System will follow your operating system's theme setting.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Quick Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Quick Actions
                  </h3>
                  <div className="space-y-3">
                    <Link
                      href="/dashboard"
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Dashboard
                    </Link>
                    
                    {setupStatus === 'complete' && userProfile?.country && (
                      <Link
                        href={`/countries/${userProfile.country.id}`}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      >
                        <Crown className="h-4 w-4 mr-2" />
                        My Country
                      </Link>
                    )}
                    
                    <Link
                      href="/explore"
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      Explore Countries
                    </Link>
                    
                    <Link
                      href="/builder"
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <Building className="h-4 w-4 mr-2" />
                      Economy Builder
                    </Link>
                  </div>
                </div>

                {/* Account Settings */}
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

                {/* Discord Info */}
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