"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { useUser, SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { navigateTo } from "~/lib/url-utils";
import { useUserCountry } from "~/hooks/useUserCountry";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Plus,
  Link,
  ArrowRight,
  Building2,
  Users,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Crown,
  Shield,
  Brain,
  MessageSquare,
  BarChart3,
  Settings,
  BookOpen,
  Play,
  SkipForward,
  ArrowLeft,
  Sparkles,
  Target,
  Zap,
  Search,
  MapPin,
  Star,
} from "lucide-react";
import { IntroDisclosure } from "~/components/ui/intro-disclosure";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { IxStatsLogo } from "~/components/ui/ixstats-logo";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";

type SetupStep = "welcome" | "link-existing" | "create-new" | "complete";

interface CountryOption {
  id: string;
  name: string;
  continent?: string | null;
  region?: string | null;
  economicTier: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
}

// Intro-disclosure steps data with IxStats design language
const setupIntroSteps = [
  {
    title: "Welcome to IxStats",
    short_description: "Executive-grade economic simulation platform",
    full_description:
      "The world's most sophisticated economic simulation platform, featuring atomic government systems, real-time intelligence networks, and comprehensive diplomatic frameworks.",
    media: {
      type: "image" as const,
      src: "/images/ixstats-overview.png",
      alt: "IxStats Platform Overview",
    },
  },
  {
    title: "Choose Your Setup Path",
    short_description: "Select your nation management approach",
    full_description:
      "Choose your path to nation management. Link to an existing country or create a new one with our advanced MyCountry Builder.",
    media: {
      type: "image" as const,
      src: "/images/setup-options.png",
      alt: "Setup Options",
    },
  },
];

export default function SetupPage() {
  usePageTitle({ title: "Country Setup" });

  const { user, isLoaded, userProfile, isLoading: profileLoading } = useUserCountry();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<SetupStep>("welcome");
  const [showIntro, setShowIntro] = useState(true);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TRPC Queries
  const { data: countries, isLoading: countriesLoading } = api.countries.getAll.useQuery();

  // TRPC Mutations
  const linkCountryMutation = api.users.linkCountry.useMutation();
  const createCountryMutation = api.users.createCountry.useMutation();

  // Check if user has already completed setup
  useEffect(() => {
    if (isLoaded && user && userProfile) {
      if (userProfile.countryId) {
        // User already has a country linked, redirect to their country page
        // Find country by ID to get slug, then navigate
        const country = countries?.countries.find((c) => c.id === userProfile.countryId);
        if (country?.slug) {
          navigateTo(router, `/countries/${country.slug}`);
        }
      }
    }
  }, [isLoaded, user, userProfile, router]);

  // Refetch user profile after successful operations
  const { refetch: refetchProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
  });

  // Filter countries based on search term
  const filteredCountries =
    countries?.countries.filter(
      (country) =>
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
      setCurrentStep("complete");
    } catch (error) {
      console.error("Failed to link country:", error);
      setError(error instanceof Error ? error.message : "Failed to link country");
    } finally {
      setIsLinking(false);
    }
  };

  const handleCreateCountry = async () => {
    if (!user?.id) return;

    // Redirect to builder instead of immediately creating country
    navigateTo(router, "/builder");
  };

  const handleIntroComplete = () => {
    setShowIntro(false);
    setCurrentStep("welcome");
  };

  const handleIntroSkip = () => {
    setShowIntro(false);
    setCurrentStep("welcome");
  };

  const handleComplete = async () => {
    // Refetch profile one more time to ensure we have the latest data
    const updatedProfile = await refetchProfile();
    const countryId = updatedProfile.data?.countryId;

    if (countryId) {
      // Find country by ID to get slug, then navigate
      const country = countries?.countries.find((c) => c.id === countryId);
      if (country?.slug) {
        navigateTo(router, `/countries/${country.slug}`);
      }
    } else {
      navigateTo(router, "/dashboard");
    }
  };

  if (!isLoaded || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading setup...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        {/* Intro Disclosure Component */}
        <IntroDisclosure
          steps={setupIntroSteps}
          open={showIntro}
          setOpen={setShowIntro}
          featureId="setup-intro"
          onComplete={handleIntroComplete}
          onSkip={handleIntroSkip}
          showProgressBar={true}
        />

        {/* Main Setup Flow */}
        {!showIntro && (
          <div className="bg-background relative min-h-screen">
            {/* Standard IxStats Interactive Grid Background */}
            <InteractiveGridPattern
              width={40}
              height={40}
              squares={[50, 40]}
              className="fixed inset-0 z-0 opacity-30 dark:opacity-20"
              squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
            />

            <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <AnimatePresence mode="wait">
                {/* Welcome Step */}
                {currentStep === "welcome" && (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                      className="mb-12"
                    >
                      <div className="mx-auto mb-10">
                        <IxStatsLogo size="xl" animated={true} />
                      </div>

                      <h1 className="text-foreground mb-8 text-6xl font-bold">
                        Welcome to IxStats, {user?.firstName || "User"}!
                      </h1>

                      <p className="text-muted-foreground mx-auto max-w-4xl text-2xl leading-relaxed">
                        To get started, please choose an option below.
                      </p>
                    </motion.div>

                    {/* Primary Option - Create New Country */}
                    <div className="mx-auto mb-8 max-w-4xl">
                      <motion.button
                        onClick={() => setCurrentStep("create-new")}
                        className="glass-hierarchy-parent group hover:glass-hierarchy-interactive relative w-full overflow-hidden rounded-3xl border border-amber-200/30 p-12 text-left transition-all duration-500 dark:border-amber-800/30"
                        whileHover={{
                          y: -12,
                          scale: 1.02,
                          transition: { duration: 0.3, ease: "easeOut" },
                        }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        {/* Animated background gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/20 via-transparent to-yellow-50/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-amber-950/20 dark:via-transparent dark:to-yellow-950/20" />

                        {/* Animated border glow */}
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-amber-400/20 via-yellow-400/20 to-amber-400/20 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-100" />

                        {/* Floating particles effect */}
                        <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-amber-400/60 opacity-0 transition-opacity duration-300 group-hover:animate-pulse group-hover:opacity-100" />
                        <div className="absolute top-8 right-8 h-1 w-1 rounded-full bg-yellow-400/60 opacity-0 transition-opacity delay-100 duration-500 group-hover:animate-pulse group-hover:opacity-100" />
                        <div className="absolute top-12 right-12 h-1.5 w-1.5 rounded-full bg-amber-300/60 opacity-0 transition-opacity delay-200 duration-700 group-hover:animate-pulse group-hover:opacity-100" />

                        <div className="relative z-10">
                          <div className="mb-8 flex items-center">
                            <div className="glass-hierarchy-child mr-6 rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-100 to-yellow-100 p-4 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 dark:border-amber-700/50 dark:from-amber-900/50 dark:to-yellow-900/50">
                              <MyCountryLogo size="lg" variant="icon-only" animated={true} />
                            </div>
                            <div>
                              <h3 className="mb-2 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 bg-clip-text text-4xl font-bold text-transparent transition-all duration-300 group-hover:from-amber-500 group-hover:via-yellow-400 group-hover:to-amber-500">
                                Create New Country
                              </h3>
                              <div className="flex items-center">
                                <div className="rounded-full border border-amber-300/30 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 px-3 py-1 dark:border-amber-600/30">
                                  <p className="bg-gradient-to-r from-amber-700 to-yellow-600 bg-clip-text text-sm font-medium text-transparent dark:from-amber-300 dark:to-yellow-400">
                                    ✨ Recommended
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="text-muted-foreground group-hover:text-foreground/80 mb-8 text-xl leading-relaxed transition-colors duration-300">
                            Start fresh with a new nation. Create your country's government
                            structure, economy, demographics, and policies to your liking.
                          </p>

                          <div className="flex items-center text-xl text-amber-600 transition-all duration-300 group-hover:text-amber-500 dark:text-amber-400 dark:group-hover:text-amber-300">
                            <span className="bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text font-semibold text-transparent dark:from-amber-400 dark:to-yellow-400">
                              Get Started with MyCountry© Builder
                            </span>
                            <ArrowRight className="ml-3 h-8 w-8 transition-all duration-300 group-hover:translate-x-3 group-hover:scale-110" />
                          </div>
                        </div>
                      </motion.button>
                    </div>

                    {/* Secondary Option - Link Existing Country (Collapsed by default) */}
                    <div className="mx-auto max-w-4xl">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="glass-hierarchy-child border-border rounded-2xl border p-6"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="glass-hierarchy-child mr-4 rounded-xl p-3">
                              <Link className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h4 className="text-foreground text-xl font-bold">
                              Link Existing Country
                            </h4>
                          </div>
                          <button
                            onClick={() => setCurrentStep("link-existing")}
                            className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Use this option →
                          </button>
                        </div>

                        <p className="text-muted-foreground mb-4 text-sm">
                          Connect your account to an existing country in the system. Perfect if
                          you're taking over management of an established nation.
                        </p>

                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            ⚠️ Only choose this if told to do so
                          </p>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {/* Link Existing Country Step */}
                {currentStep === "link-existing" && (
                  <motion.div
                    key="link-existing"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="mb-10">
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentStep("welcome")}
                        className="glass-hierarchy-child mb-8 rounded-xl px-6 py-3"
                      >
                        <ArrowLeft className="mr-3 h-5 w-5" />
                        Back to options
                      </Button>

                      <h1 className="text-foreground mb-6 text-5xl font-bold">
                        Link to Existing Country
                      </h1>

                      <p className="text-muted-foreground max-w-3xl text-2xl">
                        Search and select an existing country to link to your account.
                      </p>
                    </div>

                    <div className="glass-hierarchy-parent border-border rounded-3xl border p-8">
                      <div className="mb-8">
                        <h2 className="text-foreground mb-4 flex items-center text-2xl font-bold">
                          <div className="glass-hierarchy-child mr-4 rounded-xl p-3">
                            <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          Search Countries
                        </h2>
                        <p className="text-muted-foreground text-lg">
                          Find your country by name, continent, or region
                        </p>
                      </div>

                      <div className="space-y-8">
                        <div className="relative">
                          <Search className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transform" />
                          <Input
                            type="text"
                            placeholder="Search by name, continent, or region..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="glass-hierarchy-child border-border rounded-2xl py-4 pl-12 text-lg"
                          />
                        </div>

                        {countriesLoading ? (
                          <div className="py-16 text-center">
                            <div className="border-primary mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-b-2"></div>
                            <p className="text-muted-foreground text-xl">Loading countries...</p>
                          </div>
                        ) : (
                          <div className="max-h-96 space-y-4 overflow-y-auto">
                            {filteredCountries.map((country, index) => (
                              <motion.button
                                key={country.id}
                                onClick={() => setSelectedCountryId(country.id)}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`glass-hierarchy-child w-full rounded-2xl p-6 text-left transition-all duration-500 ${
                                  selectedCountryId === country.id
                                    ? "glass-hierarchy-interactive border-primary scale-105 border-2"
                                    : "hover:glass-hierarchy-interactive border-border border hover:scale-102"
                                }`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <div className="glass-hierarchy-child flex h-12 w-12 items-center justify-center rounded-xl">
                                      <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                      <h3 className="text-foreground mb-2 text-xl font-bold">
                                        {country.name}
                                      </h3>
                                      <p className="text-muted-foreground">
                                        {country.continent}{" "}
                                        {country.region && `• ${country.region}`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span
                                      className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium ${
                                        country.economicTier === "Advanced"
                                          ? "border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                                          : country.economicTier === "Developed"
                                            ? "border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                            : country.economicTier === "Emerging"
                                              ? "border border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
                                              : "border border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-800 dark:bg-gray-900/20 dark:text-gray-300"
                                      }`}
                                    >
                                      {country.economicTier}
                                    </span>
                                  </div>
                                </div>
                              </motion.button>
                            ))}
                          </div>
                        )}

                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-hierarchy-child border-destructive rounded-2xl border p-6"
                          >
                            <div className="flex items-center">
                              <AlertCircle className="text-destructive mr-4 h-6 w-6" />
                              <p className="text-destructive text-lg">{error}</p>
                            </div>
                          </motion.div>
                        )}

                        {selectedCountryId && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border-border border-t pt-8"
                          >
                            <Button
                              onClick={handleLinkCountry}
                              disabled={isLinking}
                              className="glass-hierarchy-interactive w-full rounded-2xl py-6 text-lg font-semibold"
                              size="lg"
                            >
                              {isLinking ? (
                                <>
                                  <div className="mr-4 h-6 w-6 animate-spin rounded-full border-b-2 border-current"></div>
                                  Linking Country...
                                </>
                              ) : (
                                <>
                                  <Link className="mr-4 h-6 w-6" />
                                  Link Country
                                </>
                              )}
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Create New Country Step */}
                {currentStep === "create-new" && (
                  <motion.div
                    key="create-new"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="mb-10">
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentStep("welcome")}
                        className="glass-hierarchy-child mb-8 rounded-xl px-6 py-3"
                      >
                        <ArrowLeft className="mr-3 h-5 w-5" />
                        Back to options
                      </Button>

                      <h1 className="text-foreground mb-6 text-5xl font-bold">
                        Create New Country
                      </h1>
                    </div>

                    <div className="glass-hierarchy-parent border-border rounded-3xl border p-8">
                      <div className="mb-8">
                        <h2 className="text-foreground mb-4 flex items-center text-2xl font-bold">
                          <div className="glass-hierarchy-child mr-4 rounded-xl p-3">
                            <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          MyCountry® Builder
                        </h2>
                        <p className="text-muted-foreground text-lg">
                          Build your country exactly how you want. Our builder allows you to
                          customize everything from your government structure to your economy and
                          demographics to your policies and manage diplomatic relations. We use a
                          multi-layered Economic Engine that models real-world economic behavior
                          through advanced mathematical models, tier-based growth systems, and
                          time-synchronized calculations to ensure a dynamic and realistic world.
                        </p>
                      </div>

                      <div className="space-y-8">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="glass-hierarchy-child group hover:glass-hierarchy-interactive rounded-2xl p-6 text-center transition-all duration-500"
                          >
                            <div className="glass-hierarchy-child mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110">
                              <Building2 className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-foreground mb-3 text-xl font-bold">
                              National Identity
                            </h3>
                            <p className="text-muted-foreground">
                              Define your country's name and flag, and assign your country a
                              currency, language, and other essential symbols.
                            </p>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="glass-hierarchy-child group hover:glass-hierarchy-interactive rounded-2xl p-6 text-center transition-all duration-500"
                          >
                            <div className="glass-hierarchy-child mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110">
                              <Crown className="h-10 w-10 text-purple-600 dark:text-purple-400" />
                            </div>
                            <h3 className="text-foreground mb-3 text-xl font-bold">MyGovernment</h3>
                            <p className="text-muted-foreground">
                              Customize everything from your political system to your departments
                              and budgets to policies and more.
                            </p>
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="glass-hierarchy-child group hover:glass-hierarchy-interactive rounded-2xl p-6 text-center transition-all duration-500"
                          >
                            <div className="glass-hierarchy-child mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110">
                              <TrendingUp className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-foreground mb-3 text-xl font-bold">MyEconomy</h3>
                            <p className="text-muted-foreground">
                              Configure your industry sectors, labor markets, income distribution,
                              and trade policies to your liking.
                            </p>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="glass-hierarchy-child group hover:glass-hierarchy-interactive rounded-2xl p-6 text-center transition-all duration-500"
                          >
                            <div className="glass-hierarchy-child mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110">
                              <Users className="h-10 w-10 text-orange-600 dark:text-orange-400" />
                            </div>
                            <h3 className="text-foreground mb-3 text-xl font-bold">Tax Builder</h3>
                            <p className="text-muted-foreground">
                              Our intergrated tax builder allows you to design a comprehensive tax
                              system with brackets, exemptions, and deductions that is connected to
                              your economy.
                            </p>
                          </motion.div>
                        </div>

                        <div className="glass-hierarchy-child rounded-2xl p-8">
                          <div className="mb-6 flex items-center">
                            <div className="glass-hierarchy-child mr-4 rounded-xl p-3">
                              <Star className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <h3 className="text-foreground text-2xl font-bold">What You'll Get</h3>
                          </div>
                          <ul className="text-muted-foreground space-y-4">
                            <li className="flex items-center">
                              <div className="mr-4 h-2 w-4 rounded-full bg-emerald-600 dark:bg-emerald-400"></div>
                              <strong>MyCountry: </strong> Manage your country in real-time from
                              your Executive Command Center with briefings and policies, monitor
                              your economy and engage in diplomacy with other nations, and more.
                            </li>
                            <li className="flex items-center">
                              <div className="mr-4 h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400"></div>
                              <strong>MyCountry Builder: </strong> Use our builder to customize your
                              country exactly how you want. Customize everything from your
                              government structure to your economy and demographics to your tax
                              system and more.
                            </li>
                            <li className="flex items-center">
                              <div className="mr-4 h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400"></div>
                              <strong>MyCountry Defense: </strong> Establish up to 8 military
                              branches, organize units and assets, readiness levels, and manage
                              national security.
                            </li>
                            <li className="flex items-center">
                              <div className="mr-4 h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400"></div>
                              <strong>Diplomacy: </strong> Establish embassies, conduct cultural
                              exchanges, negotiate treaties, and build relationships that enhance
                              trade opportunities and intelligence cooperation
                            </li>
                            <li className="flex items-center">
                              <div className="mr-4 h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400"></div>
                              <strong>Compete Globally: </strong> Track your nation's ranking across
                              economic, diplomatic, and cultural metrics—unlock achievements and see
                              how you compare to other nations worldwide
                            </li>
                            <li className="flex items-center">
                              <div className="mr-4 h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400"></div>
                              <strong>ThinkPages: </strong> Use ThinkPages to engage as government
                              officials, citizens, or media on our in-world social platform.
                              Collaborate with other players through ThinkTanks and discuss IC or
                              OOC topics.
                            </li>
                            <li className="flex items-center">
                              <div className="mr-4 h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400"></div>
                              <strong>Wiki Integration: </strong> You can import your country's
                              data/lore from IIWiki or AltHistoryWiki if you want to use it as a
                              base for your country
                            </li>
                            <li className="flex items-center">
                              <div className="mr-4 h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400"></div>
                              <strong>Image Repository: </strong> Use our image repository to
                              natively search for images from Wiki Commons, Unsplash, and IIWiki.
                            </li>
                          </ul>
                        </div>

                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-hierarchy-child border-destructive rounded-2xl border p-6"
                          >
                            <div className="flex items-center">
                              <AlertCircle className="text-destructive mr-4 h-6 w-6" />
                              <p className="text-destructive text-lg">{error}</p>
                            </div>
                          </motion.div>
                        )}

                        <Button
                          onClick={handleCreateCountry}
                          disabled={isCreating}
                          className="glass-hierarchy-interactive w-full rounded-2xl py-6 text-lg font-semibold"
                          size="lg"
                        >
                          {isCreating ? (
                            <>
                              <div className="mr-4 h-6 w-6 animate-spin rounded-full border-b-2 border-current"></div>
                              Starting MyCountry Builder...
                            </>
                          ) : (
                            <>
                              <Plus className="mr-4 h-6 w-6" />
                              Start MyCountry Builder
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Complete Step */}
                {currentStep === "complete" && (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                  >
                    <div className="mb-12">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="glass-hierarchy-parent mx-auto mb-10 flex h-40 w-40 items-center justify-center rounded-full"
                      >
                        <CheckCircle className="h-20 w-20 text-emerald-600 dark:text-emerald-400" />
                      </motion.div>

                      <h1 className="text-foreground mb-8 text-6xl font-bold">Setup Complete!</h1>

                      <p className="text-muted-foreground mx-auto max-w-4xl text-2xl leading-relaxed">
                        Your country has been successfully set up. You're now ready to start
                        managing it and engage in the world of IxStats. Good luck!
                      </p>
                    </div>

                    <Button
                      onClick={handleComplete}
                      className="glass-hierarchy-interactive rounded-2xl px-12 py-6 text-xl font-semibold"
                      size="lg"
                    >
                      <ArrowRight className="mr-4 h-6 w-6" />
                      Go to Dashboard
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </SignedIn>

      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-parent rounded-2xl p-12 text-center"
          >
            <IxStatsLogo size="lg" animated={true} className="mx-auto mb-6" />
            <h1 className="mb-4 text-3xl font-bold text-white">Welcome to IxStats</h1>
            <p className="mb-8 text-white/80">Please sign in to continue</p>
            <SignInButton mode="modal" />
          </motion.div>
        </div>
      </SignedOut>
    </>
  );
}
