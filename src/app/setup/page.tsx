"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { navigateTo } from "~/lib/utils";
import { useUserCountry } from "~/hooks/useUserCountry";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Link as LinkIcon,
  ArrowRight,
  City as Building2,
  Group as Users,
  StatUp as TrendingUp,
  CheckCircle,
  WarningCircle as AlertCircle,
  Crown,
  ArrowLeft,
  Search,
  MapPin,
  Star,
  SystemRestart,
} from "iconoir-react";
import { IntroDisclosure } from "~/components/ui/intro-disclosure";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { SearchField } from "~/components/ui/search-field";
import { Skeleton } from "~/components/ui/skeleton";
import { springSmooth, tweenExit } from "~/lib/design/motion";
import { IxStatsLogo } from "~/components/ui/ixstats-logo";
import { MyCountryLogo } from "~/components/mycountry/shared/primitives/mycountry-logo";
import { Card } from "~/components/ui/card";

type SetupStep = "welcome" | "link-existing" | "create-new" | "complete";

// oxlint-disable-next-line eslint/no-unused-vars
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
    short_description: "An economic simulation for worldbuilders",
    full_description:
      "IxStats simulates your country's economy, government, diplomacy and intelligence, with other players running the rest of the world.",
    media: {
      type: "image" as const,
      src: "/images/ixstats-overview.png",
      alt: "IxStats Platform Overview",
    },
  },
  {
    title: "Choose how to start",
    short_description: "Link a country or build a new one",
    full_description:
      "Link an existing country to your account, or create a new one in the MyCountry Builder.",
    media: {
      type: "image" as const,
      src: "/images/setup-options.png",
      alt: "Setup Options",
    },
  },
  {
    title: "IxTime",
    short_description: "The simulation clock runs at 2x speed",
    full_description:
      "Simulation time runs at 2x real time, so one in-game month passes every 15 real days. Plan budgets, projects and agreements with that pace in mind.",
    media: {
      type: "image" as const,
      src: "/images/ixtime-overview.png",
      alt: "IxTime Clock",
    },
  },
  {
    title: "IxnayID",
    short_description: "One sign-in for every IxWiki service",
    full_description:
      "IxnayID links your country across the wiki, the maps and IxStats. Check that your connections are verified in your account settings.",
    media: {
      type: "image" as const,
      src: "/images/ixnayid-connections.png",
      alt: "IxnayID Connection",
    },
  },
  {
    title: "The Vault and IxCredits",
    short_description: "The currency behind trading and the marketplace",
    full_description:
      "IxCredits pay for trading, card packs and marketplace purchases. You earn them daily through passive growth, a high stability index and successful trade treaties.",
    media: {
      type: "image" as const,
      src: "/images/vault-credits.png",
      alt: "IxCredits and Vault",
    },
  },
];

export default function SetupPage() {
  usePageTitle({ title: "Country setup" });

  const { user, isLoaded, userProfile, isLoading: profileLoading } = useUserCountry();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<SetupStep>("welcome");
  const [showIntro, setShowIntro] = useState(true);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [claimPending, setClaimPending] = useState(false);
  // oxlint-disable-next-line eslint/no-unused-vars
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TRPC Queries
  const { data: countries, isLoading: countriesLoading } = api.countries.getAll.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );

  // TRPC Mutations
  const claimCountryMutation = api.realms.claimCountry.useMutation();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const result = await claimCountryMutation.mutateAsync({ countryId: selectedCountryId });
      if (result.status === "pending") {
        setClaimPending(true);
        return;
      }
      await refetchProfile();
      setCurrentStep("complete");
    } catch (_error) {
      console.error("Failed to claim country:", _error);
      setError(_error instanceof Error ? _error.message : "Failed to claim country");
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
          <SystemRestart aria-hidden className="text-tint mx-auto mb-4 size-10 animate-spin" />
          <p className="text-body text-label-secondary">Loading setup...</p>
        </div>
      </div>
    );
  }

  const tierBadge = (tier: string) =>
    tier === "Advanced"
      ? "success"
      : tier === "Developed"
        ? "info"
        : tier === "Emerging"
          ? "warning"
          : "default";

  const errorNote = error && (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-destructive/10 rounded-row flex items-center gap-3 p-4"
    >
      <AlertCircle aria-hidden className="text-destructive size-5 shrink-0" />
      <p className="text-body text-destructive">{error}</p>
    </motion.div>
  );

  const stepTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: springSmooth },
    exit: { opacity: 0, x: -20, transition: tweenExit },
  };

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
            <div className="relative z-10 mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
              <AnimatePresence mode="wait">
                {/* Welcome Step */}
                {currentStep === "welcome" && (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0, transition: springSmooth }}
                    exit={{ opacity: 0, y: -20, transition: tweenExit }}
                    className="text-center"
                  >
                    <div className="mb-8">
                      <div className="mx-auto mb-6">
                        <IxStatsLogo size="xl" animated={true} />
                      </div>

                      <h1 className="text-large-title text-label mb-4">
                        Welcome to IxStats, {user?.firstName || "User"}
                      </h1>

                      <p className="text-body text-label-secondary mx-auto max-w-2xl">
                        Choose an option to get started.
                      </p>
                    </div>

                    {/* Primary Option - Create New Country */}
                    <div data-app="mycountry" className="mx-auto mb-6 max-w-3xl">
                      <Card
                        onClick={() => setCurrentStep("create-new")}
                        className="relative overflow-hidden p-6 text-left md:p-8"
                        interactive
                      >
                        <div className="mb-6 flex items-center gap-5">
                          <div className="bg-tint-fill rounded-card shrink-0 p-4">
                            <MyCountryLogo size="lg" variant="icon-only" animated={true} />
                          </div>
                          <div className="space-y-2">
                            <h2 className="text-title-1 text-label">Create a new country</h2>
                            <Badge variant="secondary">Recommended</Badge>
                          </div>
                        </div>

                        <p className="text-body text-label-secondary mb-6">
                          Start a new nation. You set its government, economy, demographics and
                          policies.
                        </p>

                        <div className="text-headline text-tint flex items-center gap-2">
                          <span>Open the MyCountry builder</span>
                          <ArrowRight aria-hidden className="size-5" />
                        </div>
                      </Card>
                    </div>

                    {/* Secondary Option - Link Existing Country */}
                    <div className="mx-auto max-w-3xl">
                      <Card className="p-6 text-left">
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue/10 rounded-row p-3">
                              <LinkIcon aria-hidden className="text-blue size-6" />
                            </div>
                            <h2 className="text-title-2 text-label">Link an existing country</h2>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentStep("link-existing")}
                          >
                            Use this option
                          </Button>
                        </div>

                        <p className="text-body text-label-secondary mb-4">
                          Connect your account to a country that already exists, for example to take
                          over an established nation.
                        </p>

                        <div role="note" className="bg-caution/10 rounded-row p-3">
                          <p className="text-headline text-label">
                            Only choose this if you were told to
                          </p>
                        </div>
                      </Card>
                    </div>
                  </motion.div>
                )}

                {/* Link Existing Country Step */}
                {currentStep === "link-existing" && (
                  <motion.div key="link-existing" {...stepTransition}>
                    <div className="mb-8">
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentStep("welcome")}
                        className="mb-6"
                      >
                        <ArrowLeft aria-hidden />
                        Back to options
                      </Button>

                      <h1 className="text-large-title text-label mb-2">Link an existing country</h1>

                      <p className="text-body text-label-secondary max-w-2xl">
                        Select the country to link to your account.
                      </p>
                    </div>

                    <Card className="p-6 md:p-8">
                      <div className="mb-6">
                        <h2 className="text-title-2 text-label mb-1 flex items-center gap-3">
                          <Search aria-hidden className="text-blue size-5" />
                          Search countries
                        </h2>
                      </div>

                      <div className="space-y-6">
                        <SearchField
                          size="lg"
                          aria-label="Search countries"
                          placeholder="Search by name, continent or region"
                          value={searchTerm}
                          onValueChange={setSearchTerm}
                        />

                        {countriesLoading ? (
                          <div className="space-y-2" aria-label="Loading countries...">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <Skeleton key={i} className="rounded-row h-16" />
                            ))}
                          </div>
                        ) : (
                          <FacetList className="max-h-96 overflow-y-auto">
                            <FacetListSection>
                              {filteredCountries.map((country) => (
                                <FacetRow
                                  key={country.id}
                                  onClick={() => setSelectedCountryId(country.id)}
                                  selected={selectedCountryId === country.id}
                                  leading={<MapPin aria-hidden className="text-blue size-5" />}
                                  title={country.name}
                                  subtitle={`${country.continent ?? ""}${country.region ? ` • ${country.region}` : ""}`}
                                  trailing={
                                    <Badge variant={tierBadge(country.economicTier)}>
                                      {country.economicTier}
                                    </Badge>
                                  }
                                  accessory={selectedCountryId === country.id ? "check" : "none"}
                                />
                              ))}
                            </FacetListSection>
                          </FacetList>
                        )}

                        {errorNote}

                        {claimPending && (
                          <div role="status" className="bg-surface-secondary rounded-row p-4">
                            <p className="text-headline text-label">Claim submitted</p>
                            <p className="text-body text-label-secondary mt-1">
                              A moderator will review it. Verify your wiki account under Settings,
                              IxnayID & Passport, Linked accounts to have claims for nations you
                              created approved instantly.
                            </p>
                          </div>
                        )}

                        {selectedCountryId && !claimPending && (
                          <div className="border-separator border-t pt-6">
                            <Button
                              onClick={handleLinkCountry}
                              disabled={isLinking}
                              aria-busy={isLinking}
                              className="w-full"
                              size="lg"
                            >
                              {isLinking ? (
                                <>
                                  <SystemRestart aria-hidden className="animate-spin" />
                                  Submitting claim...
                                </>
                              ) : (
                                <>
                                  <LinkIcon aria-hidden />
                                  Claim country
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                )}

                {/* Create New Country Step */}
                {currentStep === "create-new" && (
                  <motion.div key="create-new" data-app="mycountry" {...stepTransition}>
                    <div className="mb-8">
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentStep("welcome")}
                        className="mb-6"
                      >
                        <ArrowLeft aria-hidden />
                        Back to options
                      </Button>

                      <h1 className="text-large-title text-label">Create a new country</h1>
                    </div>

                    <Card className="space-y-6 p-6 md:p-8">
                      <div>
                        <h2 className="text-title-2 text-label mb-2 flex items-center gap-3">
                          <Building2 aria-hidden className="text-tint size-5" />
                          MyCountry® Builder
                        </h2>
                        <p className="text-body text-label-secondary">
                          The builder covers your government structure, economy, demographics,
                          policies and diplomatic relations. The economic engine models real-world
                          behavior with tier-based growth and time-synchronized calculations.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          {
                            icon: Building2,
                            color: "text-blue bg-blue/10",
                            title: "National identity",
                            body: "Set your country's name, flag, currency, language and national symbols.",
                          },
                          {
                            icon: Crown,
                            color: "text-purple bg-purple/10",
                            title: "MyGovernment",
                            body: "Set your political system, departments, budgets and policies.",
                          },
                          {
                            icon: TrendingUp,
                            color: "text-green bg-green/10",
                            title: "MyEconomy",
                            body: "Configure industry sectors, labor markets, income distribution and trade policy.",
                          },
                          {
                            icon: Users,
                            color: "text-orange bg-orange/10",
                            title: "Tax builder",
                            body: "Design a tax system with brackets, exemptions and deductions, connected to your economy.",
                          },
                        ].map(({ icon: Icon, color, title, body }) => (
                          <div
                            key={title}
                            className="bg-surface-secondary rounded-row p-5 text-center"
                          >
                            <div
                              className={`rounded-card mx-auto mb-4 flex size-14 items-center justify-center ${color}`}
                            >
                              <Icon aria-hidden className="size-7" />
                            </div>
                            <h3 className="text-title-3 text-label mb-2">{title}</h3>
                            <p className="text-callout text-label-secondary">{body}</p>
                          </div>
                        ))}
                      </div>

                      <div className="bg-surface-secondary rounded-row p-6">
                        <h3 className="text-title-3 text-label mb-4 flex items-center gap-3">
                          <Star aria-hidden className="text-tint size-5" />
                          What you get
                        </h3>
                        <ul className="text-body text-label-secondary space-y-3">
                          {[
                            [
                              "MyCountry: ",
                              "Run your country with briefings and policies, watch your economy and deal with other nations.",
                            ],
                            [
                              "MyCountry Builder: ",
                              "Customize your government, economy, demographics and tax system.",
                            ],
                            [
                              "MyCountry Defense: ",
                              "Set up to 8 military branches and manage units, assets, readiness and national security.",
                            ],
                            [
                              "Diplomacy: ",
                              "Open embassies, run cultural exchanges and negotiate treaties that improve trade and intelligence cooperation.",
                            ],
                            [
                              "Rankings: ",
                              "See how your nation ranks on economic, diplomatic and cultural measures, and earn achievements.",
                            ],
                            [
                              "ThinkPages: ",
                              "Post as government officials, citizens or media on the in-world social network. Work with other players in ThinkTanks and discuss IC or OOC topics.",
                            ],
                            [
                              "Wiki import: ",
                              "Import your country's data and lore from IIWiki or AltHistoryWiki as a starting point.",
                            ],
                            [
                              "Image repository: ",
                              "Search images from Wiki Commons, IxWiki and IIWiki.",
                            ],
                          ].map(([label, text]) => (
                            <li key={label} className="flex items-start gap-3">
                              <CheckCircle
                                aria-hidden
                                className="text-green mt-0.5 size-4 shrink-0"
                              />
                              <span>
                                <strong className="text-label font-semibold">{label}</strong> {text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {errorNote}

                      <Button
                        onClick={handleCreateCountry}
                        disabled={isCreating}
                        aria-busy={isCreating}
                        className="w-full"
                        size="lg"
                      >
                        {isCreating ? (
                          <>
                            <SystemRestart aria-hidden className="animate-spin" />
                            Starting the MyCountry Builder...
                          </>
                        ) : (
                          <>
                            <Plus aria-hidden />
                            Start the MyCountry builder
                          </>
                        )}
                      </Button>
                    </Card>
                  </motion.div>
                )}

                {/* Complete Step */}
                {currentStep === "complete" && (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1, transition: springSmooth }}
                    exit={{ opacity: 0, scale: 0.96, transition: tweenExit }}
                    className="text-center"
                  >
                    <div className="mb-10">
                      <div className="bg-green/10 mx-auto mb-8 flex size-32 items-center justify-center rounded-full">
                        <CheckCircle aria-hidden className="text-green size-16" />
                      </div>

                      <h1 className="text-display text-label mb-6">Setup complete</h1>

                      <p className="text-title-3 text-label-secondary mx-auto max-w-2xl">
                        Your country is set up and ready to manage.
                      </p>
                    </div>

                    <Button onClick={handleComplete} size="lg">
                      <ArrowRight aria-hidden />
                      Go to dashboard
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </SignedIn>

      <SignedOut>
        <div className="bg-grouped flex min-h-screen flex-col items-center justify-center px-4">
          <Card className="p-12 text-center">
            <IxStatsLogo size="lg" animated={true} className="mx-auto mb-6" />
            <h1 className="text-large-title text-label mb-2">Welcome to IxStats</h1>
            <p className="text-body text-label-secondary mb-8">Sign in to continue</p>
            <SignInButton mode="modal" />
          </Card>
        </div>
      </SignedOut>
    </>
  );
}
