"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import {
  Globe,
  Sparkles,
  Crown,
  Zap,
  Loader2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { cn } from '~/lib/utils';
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";
import { CountrySelectorEnhanced } from './CountrySelectorEnhanced';
import { BuilderHub } from '../BuilderHub';
import { InteractivePreview } from './InteractivePreview';
import { GlassCard, GlassCardContent } from '../glass/GlassCard';
import type { RealCountryData, EconomicInputs } from '../../lib/economy-data-service';
import {
  parseEconomyData,
  createDefaultEconomicInputs,
  saveBaselineToStorage
} from '../../lib/economy-data-service';
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { IntroDisclosure } from '~/components/ui/intro-disclosure';
import { builderTutorialSteps, quickStartSteps } from '../../data/onboarding-tutorial';

type BuilderPhase = 'select' | 'customize' | 'preview';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Error Boundary Component
class BuilderErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Builder Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative min-h-screen bg-background flex items-center justify-center p-6">
          <InteractiveGridPattern
            width={40}
            height={40}
            squares={[50, 40]}
            className="opacity-30 dark:opacity-20"
            squaresClassName="fill-slate-200/20/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
          />
          <GlassCard depth="modal" blur="heavy" className="max-w-md mx-auto">
            <GlassCardContent>
              <div className="text-center space-y-4">
                <AlertTriangle className="h-12 w-12 text-red-400 mx-auto" />
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Something went wrong</h2>
                <p className="text-[var(--color-text-secondary)]">
                  The Country Builder encountered an unexpected error. Please try refreshing.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    this.setState({ hasError: false });
                    this.props.onReset();
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-400 to-blue-900 hover:from-blue-900 hover:to-blue-900 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </motion.button>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Component
function BuilderLoading() {
  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center">
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="opacity-30 dark:opacity-20"
        squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
      />
      <GlassCard depth="elevated" blur="medium" className="p-8">
        <GlassCardContent>
          <div className="text-center space-y-4">
            <div className="relative">
              <Globe className="h-12 w-12 text-blue-400 mx-auto animate-pulse" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
              >
                <Sparkles className="h-12 w-12 text-purple-400 mx-auto" />
              </motion.div>
            </div>
            <h2 className="text-xl font-semibold text-white">Initializing Country Builder</h2>
            <p className="text-white/60">Loading economic data and templates...</p>
            <div className="flex items-center justify-center space-x-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0.4, 1, 0.4]
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                  className="w-2 h-2 bg-blue-400 rounded-full"
                />
              ))}
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}

// Main Builder Component
function BuilderContent() {
  const { user } = useUser();
  const router = useRouter();
  const [currentPhase, setCurrentPhase] = useState<BuilderPhase>('select');
  const [allCountries, setAllCountries] = useState<RealCountryData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<RealCountryData | null>(null);
  const [economicInputs, setEconomicInputs] = useState<EconomicInputs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCountryId, setHoveredCountryId] = useState<string | null>(null);
  const [selectedArchetypes, setSelectedArchetypes] = useState<string[]>([]);
  
  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [tutorialMode, setTutorialMode] = useState<string | null>(null);

  // TRPC mutations
  const createCountryMutation = api.users.createCountry.useMutation();

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        const countries = await parseEconomyData();
        // Ensure all countries have required numeric fields with defaults
        const sanitizedCountries = countries.map(country => ({
          ...country,
          gdpPerCapita: country.gdpPerCapita || 0,
          unemploymentRate: country.unemploymentRate || 0,
          inflationRate: country.inflationRate || 2.0,
          growthRate: country.growthRate || 0,
          taxRevenuePercent: country.taxRevenuePercent || 0,
          governmentSpending: country.governmentSpending || 0
        }));
        setAllCountries(sanitizedCountries);

        // Check for imported data from wiki
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('import') === 'true') {
          const importedDataStr = localStorage.getItem('builder_imported_data');
          if (importedDataStr) {
            try {
              const importedData = JSON.parse(importedDataStr);

              // Create synthetic country from imported data
              const syntheticCountry: RealCountryData = {
                name: importedData.name,
                countryCode: 'IMPORT',
                population: importedData.population || 1000000,
                gdpPerCapita: importedData.gdpPerCapita || 25000,
                gdp: importedData.gdp || (importedData.population || 1000000) * (importedData.gdpPerCapita || 25000),
                unemploymentRate: 5.0,
                inflationRate: 2.0,
                growthRate: 2.5,
                taxRevenuePercent: 20.0,
                governmentSpending: 18.0,
                continent: 'Unknown',
                region: 'Unknown'
              };

              // Store additional data
              const additionalData = {
                flag: importedData.flag,
                coatOfArms: importedData.coatOfArms,
                flagUrl: importedData.flagUrl,
                coatOfArmsUrl: importedData.coatOfArmsUrl,
                government: importedData.government,
                currency: importedData.currency,
                languages: importedData.languages,
                capital: importedData.capital,
              };
              sessionStorage.setItem('imported_additional_data', JSON.stringify(additionalData));

              setSelectedCountry(syntheticCountry);
              setCurrentPhase('customize');

              // Cleanup
              localStorage.removeItem('builder_imported_data');
              window.history.replaceState({}, '', window.location.pathname);
            } catch (error) {
              console.error('Failed to parse imported data:', error);
              setError('Failed to load imported country data');
            }
          }
        }
      } catch (error) {
        console.error('Failed to load country data:', error);
        setError('Failed to load country database');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Check for tutorial mode on mount
  useEffect(() => {
    const tutorialMode = localStorage.getItem('builder_tutorial_mode');
    if (tutorialMode) {
      setTutorialMode(tutorialMode);
      // Show tutorial after a brief delay to ensure page is loaded
      setTimeout(() => {
        if (tutorialMode === 'full') {
          setShowTutorial(true);
        } else if (tutorialMode === 'quick') {
          setShowQuickStart(true);
        }
        // Clear the flag so it doesn't show again
        localStorage.removeItem('builder_tutorial_mode');
      }, 1000);
    }
  }, []);

  // Update economic inputs when country changes
  useEffect(() => {
    if (selectedCountry) {
      const defaultInputs = createDefaultEconomicInputs(selectedCountry);
      setEconomicInputs(defaultInputs);
    }
  }, [selectedCountry]);

  // Handler functions
  const handleCountrySelect = (country: RealCountryData) => {
    // Create a deep copy to prevent mutations to the original country data
    const immutableCountry: RealCountryData = {
      ...country,
      // Ensure the original foundation country name is preserved
      originalFoundationName: country.name
    } as RealCountryData & { originalFoundationName: string };
    
    setSelectedCountry(immutableCountry);
    setCurrentPhase('customize');
  };

  const handleInputsChange = (newInputs: EconomicInputs) => {
    setEconomicInputs(newInputs);
  };

  const handlePreview = () => {
    setCurrentPhase('preview');
  };

  const handleBack = () => {
    if (currentPhase === 'customize') setCurrentPhase('select');
    else if (currentPhase === 'preview') setCurrentPhase('customize');
  };

  const handleConfirmBaseline = async () => {
    if (!economicInputs || !user?.id) return;

    setIsCreating(true);
    try {
      // Get additional imported data if exists
      const additionalDataStr = sessionStorage.getItem('imported_additional_data');
      let additionalData = {};
      if (additionalDataStr) {
        try {
          additionalData = JSON.parse(additionalDataStr);
          sessionStorage.removeItem('imported_additional_data');
        } catch (e) {
          console.warn('Failed to parse additional imported data:', e);
        }
      }

      // Create country in database
      await createCountryMutation.mutateAsync({
        userId: user.id,
        countryName: economicInputs.countryName,
        initialData: {
          baselinePopulation: economicInputs.coreIndicators.totalPopulation,
          baselineGdpPerCapita: economicInputs.coreIndicators.gdpPerCapita,
          ...additionalData,
        }
      });

      // Save backup to localStorage
      saveBaselineToStorage(economicInputs);

      // Redirect to new country
      router.push(createUrl(`/mycountry`));
    } catch (error) {
      console.error('Failed to create country:', error);
      setError(`Failed to create ${economicInputs.countryName}. Please try again.`);
    } finally {
      setIsCreating(false);
    }
  };

  const resetBuilder = () => {
    setCurrentPhase('select');
    setSelectedCountry(null);
    setEconomicInputs(null);
    setError(null);
  };

  // Tutorial handlers
  const handleCompleteTutorial = () => {
    setShowTutorial(false);
    setTutorialMode(null);
  };

  const handleCompleteQuickStart = () => {
    setShowQuickStart(false);
    setTutorialMode(null);
  };

  // Enhanced tutorial steps with completion handlers
  const enhancedTutorialSteps = builderTutorialSteps.map((step, index) => ({
    ...step,
    action: step.action ? {
      ...step.action,
      onClick: index === builderTutorialSteps.length - 1 ? handleCompleteTutorial : step.action.onClick
    } : undefined
  }));

  const enhancedQuickStartSteps = quickStartSteps.map((step, index) => ({
    ...step,
    action: step.action ? {
      ...step.action,
      onClick: index === quickStartSteps.length - 1 ? handleCompleteQuickStart : step.action.onClick
    } : undefined
  }));

  // Loading state
  if (isLoading) {
    return <BuilderLoading />;
  }

  // Error state
  if (error) {
    return (
      <div className="relative min-h-screen bg-background flex items-center justify-center p-6">
        <GlassCard depth="modal" blur="heavy" className="max-w-md mx-auto">
          <GlassCardContent>
            <div className="text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">Error</h2>
              <p className="text-white/70">{error}</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.location.reload()}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </motion.button>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>
    );
  }

  return (
    <BuilderErrorBoundary onReset={resetBuilder}>
      <div className="relative min-h-screen bg-background">
        <InteractiveGridPattern
          width={40}
          height={40}
          squares={[50, 40]}
          className="opacity-30 dark:opacity-20"
          squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
        />
        <AnimatePresence mode="wait">
        {currentPhase === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <CountrySelectorEnhanced
              countries={allCountries}
              onCountrySelect={handleCountrySelect}
              onCardHoverChange={setHoveredCountryId}
            />
          </motion.div>
        )}

        {currentPhase === 'customize' && selectedCountry && economicInputs && (
          <motion.div
            key="customize"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <BuilderHub
              inputs={economicInputs}
              onInputsChange={handleInputsChange}
              onPreview={handlePreview}
              onBack={handleBack}
              selectedCountry={selectedCountry}
              countries={allCountries}
              selectedArchetypes={selectedArchetypes}
              onArchetypeSelect={setSelectedArchetypes}
            />
          </motion.div>
        )}

        {currentPhase === 'preview' && selectedCountry && economicInputs && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <InteractivePreview
              inputs={economicInputs}
              referenceCountry={selectedCountry}
              allCountries={allCountries}
              onBack={handleBack}
              onConfirm={handleConfirmBaseline}
              isCreating={isCreating}
              hoveredCountryId={hoveredCountryId}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Tutorial Modals - Now appear on builder page */}
      <IntroDisclosure
        steps={enhancedTutorialSteps}
        featureId="builder-tutorial"
        open={showTutorial}
        setOpen={setShowTutorial}
        onComplete={handleCompleteTutorial}
        onSkip={handleCompleteTutorial}
        showProgressBar={true}
      />

      <IntroDisclosure
        steps={enhancedQuickStartSteps}
        featureId="builder-quick-start"
        open={showQuickStart}
        setOpen={setShowQuickStart}
        onComplete={handleCompleteQuickStart}
        onSkip={handleCompleteQuickStart}
        showProgressBar={true}
      />
    </BuilderErrorBoundary>
  );
}

interface BuilderPageEnhancedProps {
  onBackToIntro?: () => void;
}

// Main Export Component
export default function BuilderPageEnhanced({ onBackToIntro }: BuilderPageEnhancedProps = {}) {
  useEffect(() => {
    // Set page title
    document.title = "Country Builder - IxStats";

    // Add dark mode support
    const html = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const storedTheme = localStorage.getItem('theme');

    if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, []);

  return (
    <>
      <SignedIn>
        <Suspense fallback={<BuilderLoading />}>
          <BuilderContent />
        </Suspense>
      </SignedIn>

      <SignedOut>
        <div className="relative min-h-screen bg-background flex items-center justify-center p-6">
          <InteractiveGridPattern
            width={40}
            height={40}
            squares={[50, 40]}
            className="opacity-30 dark:opacity-20"
            squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
          />
          <GlassCard depth="modal" blur="heavy" className="max-w-md mx-auto">
            <GlassCardContent>
              <div className="text-center space-y-6">
                <div className="relative">
                  <Globe className="h-16 w-16 text-blue-400 mx-auto" />
                  <Crown className="h-6 w-6 text-amber-400 absolute -top-1 -right-1" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Create Your Nation
                  </h2>
                  <p className="text-white/70">
                    Sign in to access the Country Builder and create your custom economic simulation
                  </p>
                </div>
                <div className="space-y-3">
                  <SignInButton mode="modal">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                    >
                      <Zap className="h-5 w-5" />
                      Get Started
                    </motion.button>
                  </SignInButton>
                  <p className="text-white/50 text-sm">
                    Free account • No membership required
                  </p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      </SignedOut>
    </>
  );
}
