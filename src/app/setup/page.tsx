"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { 
  Globe, 
  Plus, 
  Link, 
  ArrowRight, 
  Building2, 
  Users, 
  TrendingUp,
  CheckCircle,
  AlertCircle
} from "lucide-react";

type SetupStep = 'welcome' | 'link-existing' | 'create-new' | 'complete';

interface CountryOption {
  id: string;
  name: string;
  continent?: string | null;
  region?: string | null;
  economicTier: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
}

export default function SetupPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome');
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TRPC Queries
  const { data: countries, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // TRPC Mutations
  const linkCountryMutation = api.users.linkCountry.useMutation();
  const createCountryMutation = api.users.createCountry.useMutation();

  // Check if user has already completed setup
  useEffect(() => {
    if (isLoaded && user && userProfile) {
      if (userProfile.countryId) {
        // User already has a country linked, redirect to their country page
        router.push(`/countries/${userProfile.countryId}`);
      }
    }
  }, [isLoaded, user, userProfile, router]);

  // Refetch user profile after successful operations
  const { refetch: refetchProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // Filter countries based on search term
  const filteredCountries = countries?.countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.continent?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.region?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleLinkCountry = async () => {
    if (!selectedCountryId || !user?.id) return;
    
    setIsLinking(true);
    setError(null);
    try {
      await linkCountryMutation.mutateAsync({
        userId: user.id,
        countryId: selectedCountryId,
      });
      
      // Refetch profile to get updated data
      await refetchProfile();
      setCurrentStep('complete');
    } catch (error) {
      console.error('Failed to link country:', error);
      setError(error instanceof Error ? error.message : 'Failed to link country');
    } finally {
      setIsLinking(false);
    }
  };

  const handleCreateCountry = async () => {
    if (!user?.id) return;
    
    // Redirect to builder instead of immediately creating country
    router.push('/builder');
  };

  const handleComplete = async () => {
    // Refetch profile one more time to ensure we have the latest data
    const updatedProfile = await refetchProfile();
    const countryId = updatedProfile.data?.countryId;
    
    if (countryId) {
      router.push(`/countries/${countryId}`);
    } else {
      router.push('/dashboard');
    }
  };

  if (!isLoaded || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading setup...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Welcome Step */}
            {currentStep === 'welcome' && (
              <div className="text-center">
                <div className="mb-8">
                  <div className="mx-auto h-24 w-24 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mb-6">
                    <Globe className="h-12 w-12 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    Welcome to IxStats, {user?.firstName || 'User'}!
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                    IxStats helps you track and manage economic data for your nation. 
                    Let's get you set up with your country profile.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  <button
                    onClick={() => setCurrentStep('link-existing')}
                    className="p-8 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                  >
                    <div className="flex items-center mb-4">
                      <Link className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mr-3" />
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Link Existing Country
                      </h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Connect your account to an existing country in the system. 
                      Perfect if you're taking over management of an established nation.
                    </p>
                    <div className="flex items-center text-indigo-600 dark:text-indigo-400">
                      <span className="text-sm font-medium">Choose this option</span>
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </div>
                  </button>

                  <button
                    onClick={() => setCurrentStep('create-new')}
                    className="p-8 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                  >
                    <div className="flex items-center mb-4">
                      <Plus className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mr-3" />
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Create New Country
                      </h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Start fresh with a new nation. You'll be guided through the 
                      process of setting up your country's economic profile.
                    </p>
                    <div className="flex items-center text-indigo-600 dark:text-indigo-400">
                      <span className="text-sm font-medium">Choose this option</span>
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Link Existing Country Step */}
            {currentStep === 'link-existing' && (
              <div>
                <div className="mb-8">
                  <button
                    onClick={() => setCurrentStep('welcome')}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 mb-4 flex items-center"
                  >
                    <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                    Back to options
                  </button>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    Link to Existing Country
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Search and select an existing country to link to your account.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="mb-6">
                    <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Search Countries
                    </label>
                    <input
                      id="search"
                      type="text"
                      placeholder="Search by name, continent, or region..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
                    />
                  </div>

                  {countriesLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                      <p className="text-gray-600 dark:text-gray-400">Loading countries...</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {filteredCountries.map((country) => (
                        <button
                          key={country.id}
                          onClick={() => setSelectedCountryId(country.id)}
                          className={`w-full p-4 border rounded-lg text-left transition-colors ${
                            selectedCountryId === country.id
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {country.name}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {country.continent} {country.region && `• ${country.region}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                country.economicTier === 'Advanced' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                country.economicTier === 'Developed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                country.economicTier === 'Emerging' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                              }`}>
                                {country.economicTier}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                        <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                      </div>
                    </div>
                  )}

                  {selectedCountryId && (
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={handleLinkCountry}
                        disabled={isLinking}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-md flex items-center justify-center"
                      >
                        {isLinking ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Linking...
                          </>
                        ) : (
                          <>
                            <Link className="h-4 w-4 mr-2" />
                            Link Country
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Create New Country Step */}
            {currentStep === 'create-new' && (
              <div>
                <div className="mb-8">
                  <button
                    onClick={() => setCurrentStep('welcome')}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 mb-4 flex items-center"
                  >
                    <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                    Back to options
                  </button>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    Create New Country
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Start fresh with a new nation. You'll be guided through setting up your country's economic profile.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="space-y-6">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          Country Builder
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Use our interactive country builder to create a realistic economic profile based on real-world data.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          Population & Demographics
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Set up your population, demographics, and regional distribution.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          Economic Foundation
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Configure GDP, growth rates, fiscal policies, and economic indicators.
                        </p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                        <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleCreateCountry}
                      disabled={isCreating}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-md flex items-center justify-center"
                    >
                      {isCreating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Start Country Builder
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Complete Step */}
            {currentStep === 'complete' && (
              <div className="text-center">
                <div className="mb-8">
                  <div className="mx-auto h-24 w-24 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    Setup Complete!
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                    Your country profile has been successfully set up. You're now ready to start managing your nation's economic data.
                  </p>
                </div>

                <button
                  onClick={handleComplete}
                  className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-medium py-3 px-6 rounded-md flex items-center mx-auto"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </button>
              </div>
            )}
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