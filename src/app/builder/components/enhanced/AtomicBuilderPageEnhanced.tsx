"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Crown, Settings, Sparkles, ArrowRight, CheckCircle, Flag, BarChart3,
  Users, Coins, Building2, Heart, TrendingUp, ArrowLeft, Loader2,
  ChevronRight, Shield, Zap, Globe, Palette, Lock, Unlock, Info,
  HelpCircle, BookOpen, Calculator, Landmark, Scale, Briefcase,
  UserCheck, Home, GraduationCap
} from 'lucide-react';
import { MyCountryLogo } from '~/components/ui/mycountry-logo';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { CountrySelectorEnhanced } from './CountrySelectorEnhanced';
import { AtomicComponentSelector, ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import { GovernmentBuilder } from '~/components/government/GovernmentBuilder';
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";
import type { RealCountryData, EconomicInputs } from '../../lib/economy-data-service';
import { parseEconomyData, createDefaultEconomicInputs } from '../../lib/economy-data-service';
import { TaxBuilder, type TaxBuilderState } from '~/components/tax-system/TaxBuilder';
import type { GovernmentBuilderState } from '~/types/government';
import { cn } from '~/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';

// Import all section components
import {
  NationalIdentitySection,
  CoreIndicatorsSection,
  LaborEmploymentSection,
  FiscalSystemSection,
  DemographicsSection,
  GovernmentStructureSection,
  EconomySection
} from '../../sections';
import { GovernmentSpendingSectionEnhanced } from '../../sections/GovernmentSpendingSectionEnhanced';

interface AtomicBuilderPageEnhancedProps {
  onBackToIntro?: () => void;
}

type BuilderStep = 'foundation' | 'core' | 'government' | 'economics' | 'preview';

interface BuilderState {
  step: BuilderStep;
  selectedCountry: RealCountryData | null;
  economicInputs: EconomicInputs | null;
  governmentComponents: ComponentType[];
  taxSystemData: TaxBuilderState | null;
  governmentStructure: any;
  completedSteps: BuilderStep[];
  // Tab state for each step
  activeCoreTab: string;
  activeGovernmentTab: string;
  activeEconomicsTab: string;
  showAdvancedMode: boolean;
}

// Define the primary MyCountry gold theme
const BUILDER_GOLD = 'from-amber-500 to-yellow-600';
const BUILDER_GOLD_HOVER = 'hover:from-amber-600 hover:to-yellow-700';

const stepConfig = {
  foundation: {
    title: 'Foundation',
    description: 'Choose your starting nation',
    icon: Crown,
    color: BUILDER_GOLD,
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/20',
    hoverColor: 'hover:border-amber-500/40',
    tip: 'Select a real-world nation as your foundation to inherit its basic characteristics',
    help: 'Choose a country that will serve as the foundation for your new nation. You\'ll inherit its basic economic and demographic characteristics which you can then customize.'
  },
  core: {
    title: 'Core Identity',
    description: 'Define national character',
    icon: Flag,
    color: BUILDER_GOLD,
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/20',
    hoverColor: 'hover:border-amber-500/40',
    tip: 'Establish your nation\'s identity and core economic metrics',
    help: 'Set up your nation\'s fundamental identity including name, symbols, and core economic indicators that will drive all other calculations.'
  },
  government: {
    title: 'Government',
    description: 'Design your structure',
    icon: Building2,
    color: BUILDER_GOLD,
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/20',
    hoverColor: 'hover:border-amber-500/40',
    tip: 'Build your government using atomic components that create emergent behaviors',
    help: 'Design your government structure using atomic components. Each component adds unique characteristics and behaviors to your nation.'
  },
  economics: {
    title: 'Economics',
    description: 'Configure systems',
    icon: TrendingUp,
    color: BUILDER_GOLD,
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/20',
    hoverColor: 'hover:border-amber-500/40',
    tip: 'Fine-tune economic parameters, tax policies, and demographic settings',
    help: 'Configure detailed economic systems including sectors, labor markets, fiscal policy, tax structure, and demographics.'
  },
  preview: {
    title: 'Preview',
    description: 'Review & create',
    icon: CheckCircle,
    color: 'from-green-500 to-green-600',
    bgGradient: 'from-green-500/10 via-green-500/5 to-transparent',
    borderColor: 'border-green-500/20',
    hoverColor: 'hover:border-green-500/40',
    tip: 'Review all your configurations before creating your nation',
    help: 'Review all your selections and configurations. Make sure everything looks correct before finalizing your nation.'
  },
};

// Enhanced step indicator component with minimize/expand functionality
function StepIndicator({
  currentStep,
  completedSteps,
  onStepClick
}: {
  currentStep: BuilderStep;
  completedSteps: BuilderStep[];
  onStepClick: (step: BuilderStep) => void;
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const steps = Object.entries(stepConfig) as [BuilderStep, typeof stepConfig[BuilderStep]][];
  const currentIndex = steps.findIndex(([step]) => step === currentStep);

  // Auto-minimize after initial animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinimized(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <TooltipProvider>
      <motion.div
        className="relative w-full mx-auto mb-6"
        animate={{
          maxWidth: isMinimized ? '400px' : '1024px',
          marginBottom: isMinimized ? '1.5rem' : '3rem'
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        onMouseEnter={() => setIsMinimized(false)}
        onMouseLeave={() => setIsMinimized(true)}
      >
        {/* Progress Line */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              className="absolute top-8 left-0 right-0 h-0.5 bg-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-500 to-yellow-600"
                initial={{ width: '0%' }}
                animate={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Indicators */}
        <div className={cn(
          "relative flex",
          isMinimized ? "justify-center gap-2" : "justify-between"
        )}>
          {steps.map(([step, config], index) => {
            const isCompleted = completedSteps.includes(step);
            const isCurrent = currentStep === step;
            const isAccessible = index <= currentIndex || completedSteps.includes(step);
            const Icon = config.icon;

            return (
              <Tooltip key={step}>
                <TooltipTrigger asChild>
                  <motion.button
                    className={cn(
                      "relative flex flex-col items-center group",
                      isAccessible ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                    )}
                    onClick={() => isAccessible && onStepClick(step)}
                    whileHover={isAccessible ? { scale: 1.05 } : {}}
                    whileTap={isAccessible ? { scale: 0.95 } : {}}
                    animate={{
                      width: isMinimized ? '40px' : 'auto'
                    }}
                  >
                    {/* Step Circle */}
                    <motion.div
                      className={cn(
                        "relative z-10 flex items-center justify-center rounded-full border-2 transition-all duration-300",
                        isCurrent && `bg-gradient-to-br ${config.color} border-transparent text-white shadow-lg shadow-amber-500/25`,
                        isCompleted && !isCurrent && "bg-green-500/10 border-green-500 text-green-600",
                        !isCurrent && !isCompleted && "bg-background border-muted-foreground/30 text-muted-foreground"
                      )}
                      animate={{
                        width: isMinimized ? '40px' : '64px',
                        height: isMinimized ? '40px' : '64px',
                        ...(isCurrent && !isMinimized ? {
                          boxShadow: [
                            "0 0 0 0px rgba(251, 191, 36, 0.2)",
                            "0 0 0 10px rgba(251, 191, 36, 0)",
                          ]
                        } : {})
                      }}
                      transition={isCurrent && !isMinimized ? {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeOut"
                      } : { duration: 0.3 }}
                    >
                      {isCompleted && !isCurrent ? (
                        <CheckCircle className={cn(isMinimized ? "h-4 w-4" : "h-6 w-6")} />
                      ) : (
                        <Icon className={cn(isMinimized ? "h-4 w-4" : "h-6 w-6")} />
                      )}
                    </motion.div>

                    {/* Step Label */}
                    <AnimatePresence>
                      {!isMinimized && (
                        <motion.div
                          className="mt-3 text-center"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className={cn(
                            "text-sm font-semibold transition-colors whitespace-nowrap",
                            isCurrent && "text-amber-600",
                            isCompleted && !isCurrent && "text-green-600",
                            !isCurrent && !isCompleted && "text-muted-foreground"
                          )}>
                            {config.title}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                            {config.description}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Completion Badge */}
                    {isCompleted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 z-20"
                      >
                        <div className={cn(
                          "bg-green-500 rounded-full flex items-center justify-center",
                          isMinimized ? "w-3 h-3" : "w-5 h-5"
                        )}>
                          <CheckCircle className={cn(isMinimized ? "h-2 w-2" : "h-3 w-3", "text-white")} />
                        </div>
                      </motion.div>
                    )}
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">{config.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{config.tip}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

// Enhanced tab component for sections
function EnhancedTabsList({ children, className, ...props }: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        "grid w-full bg-muted/50 backdrop-blur-sm border border-border/50 p-1 rounded-xl",
        className
      )}
      {...props}
    >
      {children}
    </TabsList>
  );
}

function EnhancedTabsTrigger({
  children,
  icon: Icon,
  badge,
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger> & {
  icon?: React.ElementType;
  badge?: string | number;
}) {
  return (
    <TabsTrigger
      className={cn(
        "relative flex flex-col gap-1.5 p-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200",
        "hover:bg-background/50",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5">
        {Icon && React.createElement(Icon, { className: "h-4 w-4" })}
      </div>
      <span className="text-xs font-medium">{children}</span>
      {badge !== undefined && (
        <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 min-w-[20px] p-0 flex items-center justify-center text-[10px]">
          {badge}
        </Badge>
      )}
    </TabsTrigger>
  );
}

// Help tooltip component
function HelpTooltip({ text, className }: { text: string; className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className={cn("h-4 w-4 text-muted-foreground cursor-help", className)} />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AtomicBuilderPageEnhanced({ onBackToIntro }: AtomicBuilderPageEnhancedProps) {
  const { user } = useUser();
  const router = useRouter();

  const [builderState, setBuilderState] = useState<BuilderState>({
    step: 'foundation',
    selectedCountry: null,
    economicInputs: null,
    governmentComponents: [],
    taxSystemData: null,
    governmentStructure: null,
    completedSteps: [],
    activeCoreTab: 'identity',
    activeGovernmentTab: 'components',
    activeEconomicsTab: 'economy',
    showAdvancedMode: false,
  });

  const [countries, setCountries] = useState<RealCountryData[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [countryLoadError, setCountryLoadError] = useState<string | null>(null);

  // Load countries data on component mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        setIsLoadingCountries(true);
        setCountryLoadError(null);
        const countryData = await parseEconomyData();
        setCountries(countryData);
      } catch (error) {
        console.error('Failed to load countries:', error);
        setCountryLoadError(error instanceof Error ? error.message : 'Failed to load countries');
      } finally {
        setIsLoadingCountries(false);
      }
    };

    loadCountries();
  }, []);

  // Update economic inputs when government components change
  useEffect(() => {
    if (builderState.economicInputs && builderState.governmentComponents.length > 0) {
      // Adjust economic parameters based on government components
      const updatedInputs = { ...builderState.economicInputs };

      // Example: Adjust tax rates based on government type
      if (builderState.governmentComponents.includes('SOCIAL_DEMOCRACY' as ComponentType)) {
        updatedInputs.fiscalSystem.taxRevenueGDPPercent = Math.min(updatedInputs.fiscalSystem.taxRevenueGDPPercent * 1.2, 60);
        updatedInputs.governmentSpending.totalSpending = Math.max(updatedInputs.governmentSpending.totalSpending, 25);
      }

      if (builderState.governmentComponents.includes('FREE_MARKET' as ComponentType)) {
        updatedInputs.fiscalSystem.taxRevenueGDPPercent = Math.max(updatedInputs.fiscalSystem.taxRevenueGDPPercent * 0.8, 15);
        // Note: privateSectorShare would need to be added to the data model if needed
      }

      setBuilderState(prev => ({ ...prev, economicInputs: updatedInputs }));
    }
  }, [builderState.governmentComponents]);

  // Create country mutation - with optional chaining for safety during type generation
  const createCountryMutation = (api.countries as any).createCountry?.useMutation({
    onSuccess: (country: any) => {
      console.log('Country created successfully:', country);
      router.push(createUrl(`/mycountry`));
    },
    onError: (error: any) => {
      console.error('Failed to create country:', error);
      // TODO: Show error toast to user
    },
  }) || {
    mutateAsync: async () => {
      console.error('createCountry mutation not available');
      throw new Error('Country creation is not available');
    },
    isLoading: false,
  };

  // Handle tab navigation within steps
  const handleTabChange = useCallback((step: BuilderStep, tab: string) => {
    switch (step) {
      case 'core':
        setBuilderState(prev => ({ ...prev, activeCoreTab: tab }));
        break;
      case 'government':
        setBuilderState(prev => ({ ...prev, activeGovernmentTab: tab }));
        break;
      case 'economics':
        setBuilderState(prev => ({ ...prev, activeEconomicsTab: tab }));
        break;
    }
  }, []);

  // Handle continue button - moves to next tab or next step
  const handleContinue = useCallback(() => {
    const { step, activeCoreTab, activeGovernmentTab, activeEconomicsTab } = builderState;

    switch (step) {
      case 'foundation':
        if (builderState.selectedCountry) {
          setBuilderState(prev => ({
            ...prev,
            step: 'core',
            completedSteps: [...new Set([...prev.completedSteps, 'foundation' as BuilderStep])]
          }));
        }
        break;

      case 'core':
        if (activeCoreTab === 'identity') {
          handleTabChange('core', 'indicators');
        } else {
          setBuilderState(prev => ({
            ...prev,
            step: 'government',
            completedSteps: [...new Set([...prev.completedSteps, 'core' as BuilderStep])]
          }));
        }
        break;

      case 'government':
        const govTabs = ['components', 'structure', 'spending'];
        const currentGovIndex = govTabs.indexOf(activeGovernmentTab);
        if (currentGovIndex < govTabs.length - 1) {
          handleTabChange('government', govTabs[currentGovIndex + 1]);
        } else {
          setBuilderState(prev => ({
            ...prev,
            step: 'economics',
            completedSteps: [...new Set([...prev.completedSteps, 'government' as BuilderStep])]
          }));
        }
        break;

      case 'economics':
        const econTabs = ['economy', 'labor', 'demographics', 'taxes'];
        const currentEconIndex = econTabs.indexOf(activeEconomicsTab);
        if (currentEconIndex < econTabs.length - 1) {
          handleTabChange('economics', econTabs[currentEconIndex + 1]);
        } else {
          setBuilderState(prev => ({
            ...prev,
            step: 'preview',
            completedSteps: [...new Set([...prev.completedSteps, 'economics' as BuilderStep])]
          }));
        }
        break;
    }
  }, [builderState, handleTabChange]);

  const handleStepComplete = useCallback((step: BuilderStep, data?: any) => {
    setBuilderState(prev => {
      const newState = { ...prev };

      if (!prev.completedSteps.includes(step)) {
        newState.completedSteps = [...prev.completedSteps, step];
      }

      switch (step) {
        case 'foundation':
          newState.selectedCountry = data;
          newState.step = 'core';
          if (data) {
            newState.economicInputs = createDefaultEconomicInputs(data);
          }
          break;
        case 'core':
          newState.economicInputs = data;
          newState.step = 'government';
          break;
        case 'government':
          newState.governmentComponents = data;
          newState.step = 'economics';
          break;
        case 'economics':
          newState.economicInputs = data;
          newState.step = 'preview';
          break;
      }

      return newState;
    });
  }, []);

  const handlePreviousStep = useCallback(() => {
    const steps: BuilderStep[] = ['foundation', 'core', 'government', 'economics', 'preview'];
    const currentIndex = steps.indexOf(builderState.step);
    if (currentIndex > 0) {
      setBuilderState(prev => ({ ...prev, step: steps[currentIndex - 1]! }));
    }
  }, [builderState.step]);

  const handleStepClick = useCallback((step: BuilderStep) => {
    const steps: BuilderStep[] = ['foundation', 'core', 'government', 'economics', 'preview'];
    const currentIndex = steps.indexOf(builderState.step);
    const targetIndex = steps.indexOf(step);

    // Only allow navigation to previous steps or completed steps
    if (targetIndex <= currentIndex || builderState.completedSteps.includes(step)) {
      setBuilderState(prev => ({ ...prev, step }));
    }
  }, [builderState.step, builderState.completedSteps]);

  const handleCreateCountry = useCallback(async () => {
    if (!builderState.economicInputs || !user) {
      console.error('Missing required data for country creation');
      return;
    }

    try {
      const result = await createCountryMutation.mutateAsync({
        name: builderState.economicInputs.countryName || 'New Nation',
        foundationCountry: builderState.selectedCountry?.name || builderState.selectedCountry?.countryCode || null,
        economicInputs: builderState.economicInputs,
        governmentComponents: builderState.governmentComponents,
        taxSystemData: builderState.taxSystemData,
        governmentStructure: builderState.governmentStructure,
      });

      // Success handled by mutation's onSuccess callback
      console.log('Country creation initiated:', result);
    } catch (error) {
      console.error('Failed to create country:', error);
      // Error handled by mutation's onError callback
    }
  }, [builderState, user, createCountryMutation]);

  const currentStepConfig = stepConfig[builderState.step];

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    const steps = ['foundation', 'core', 'government', 'economics', 'preview'];
    const currentIndex = steps.indexOf(builderState.step);
    return ((currentIndex + 1) / steps.length) * 100;
  }, [builderState.step]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-amber-50/20 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-md mx-auto border-2 shadow-xl">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-amber-500/10 rounded-full flex items-center justify-center">
                <Lock className="h-10 w-10 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Authentication Required</h2>
                <p className="text-muted-foreground">
                  Sign in to access the Atomic Nation Builder and create your custom nation
                </p>
              </div>
              <Button
                onClick={() => router.push(createUrl('/sign-in'))}
                size="lg"
                className={cn("w-full bg-gradient-to-r", BUILDER_GOLD, BUILDER_GOLD_HOVER)}
              >
                <Unlock className="h-4 w-4 mr-2" />
                Sign In to Continue
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-amber-50/10">
      {/* Enhanced Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="flex items-center gap-3"
                whileHover={{ scale: 1.02 }}
              >
                <MyCountryLogo size="lg" animated />
                
              </motion.div>
              <Badge variant="outline" className="hidden md:flex items-center gap-1 border-amber-500/20">
                <Zap className="h-3 w-3 text-amber-500" />
                 v1.0.0 Preview
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBuilderState(prev => ({
                  ...prev,
                  showAdvancedMode: !prev.showAdvancedMode
                }))}
                className="hidden md:flex"
              >
                <Settings className="h-4 w-4 mr-2" />
                {builderState.showAdvancedMode ? 'Advanced' : 'Basic'} Mode
              </Button>
              <Button variant="outline" onClick={onBackToIntro} size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 py-8">
        {/* Enhanced Step Progress */}
        <StepIndicator
          currentStep={builderState.step}
          completedSteps={builderState.completedSteps}
          onStepClick={handleStepClick}
        />

        {/* Main Content Area with Animations */}
        <AnimatePresence mode="wait">
          {builderState.step === 'foundation' ? (
            <motion.div
              key="foundation"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {isLoadingCountries ? (
                <div className="flex items-center justify-center py-24">
                  <div className="text-center space-y-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-16 h-16 mx-auto"
                    >
                      <Globe className="h-16 w-16 text-amber-500" />
                    </motion.div>
                    <div className="space-y-2">
                      <p className="text-lg font-medium">Loading nations data...</p>
                      <p className="text-sm text-muted-foreground">Preparing your foundation options</p>
                    </div>
                  </div>
                </div>
              ) : countryLoadError ? (
                <Alert className="border-red-200 bg-red-50/50">
                  <AlertDescription>
                    <strong>Error loading countries:</strong> {countryLoadError}
                    <br />
                    Please refresh the page to try again.
                  </AlertDescription>
                </Alert>
              ) : (
                <CountrySelectorEnhanced
                  countries={countries}
                  onCountrySelect={(country) => {
                    handleStepComplete('foundation', country);
                  }}
                  onCardHoverChange={() => {}}
                  onBackToIntro={onBackToIntro}
                  onCreateFromScratch={() => {
                    // Start from scratch with no reference country
                    // Pass null to indicate we want a blank slate
                    setBuilderState(prev => ({
                      ...prev,
                      step: 'core',
                      selectedCountry: null, // No reference country
                      economicInputs: createDefaultEconomicInputs(), // Create with defaults, no reference
                      completedSteps: [...new Set([...prev.completedSteps, 'foundation' as BuilderStep])]
                    }));
                  }}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key={builderState.step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className={cn(
                "max-w-6xl mx-auto border-2 shadow-2xl overflow-hidden",
                currentStepConfig.borderColor,
                "bg-gradient-to-br",
                currentStepConfig.bgGradient
              )}>
                <CardContent className="p-8">
                  {builderState.step === 'core' && builderState.economicInputs && (
                    <div className="space-y-6">
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center space-y-4"
                      >
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg mb-4">
                          <Flag className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <h2 className="text-3xl font-bold">Core Foundation</h2>
                          <HelpTooltip text={stepConfig.core.help} />
                        </div>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                          Configure national identity and economic fundamentals{builderState.selectedCountry ? ` for ${builderState.selectedCountry.name}` : ' from scratch'}
                        </p>
                      </motion.div>

                      <Alert className="border-amber-200/50 bg-amber-50/30 backdrop-blur-sm">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Foundation Setup:</strong> Define your nation's identity and core economic indicators.
                          These values will automatically adjust other economic parameters throughout the builder.
                        </AlertDescription>
                      </Alert>

                      <Tabs value={builderState.activeCoreTab} onValueChange={(tab) => handleTabChange('core', tab)} className="space-y-6">
                        <EnhancedTabsList className="grid-cols-2">
                          <EnhancedTabsTrigger
                            value="identity"
                            icon={Flag}
                          >
                            National Identity
                          </EnhancedTabsTrigger>
                          <EnhancedTabsTrigger
                            value="indicators"
                            icon={BarChart3}
                          >
                            Core Indicators
                          </EnhancedTabsTrigger>
                        </EnhancedTabsList>

                        <TabsContent value="identity" className="mt-6">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                          >
                            <NationalIdentitySection
                              inputs={builderState.economicInputs}
                              onInputsChange={(economicInputs: EconomicInputs) => {
                                setBuilderState(prev => ({ ...prev, economicInputs }));
                              }}
                              referenceCountry={builderState.selectedCountry}
                            />
                          </motion.div>
                        </TabsContent>

                        <TabsContent value="indicators" className="mt-6">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                          >
                            <CoreIndicatorsSection
                              inputs={builderState.economicInputs}
                              onInputsChange={(economicInputs: EconomicInputs) => {
                                setBuilderState(prev => ({ ...prev, economicInputs }));
                              }}
                              showAdvanced={builderState.showAdvancedMode}
                              referenceCountry={builderState.selectedCountry}
                            />
                          </motion.div>
                        </TabsContent>
                      </Tabs>

                      <div className="flex justify-between items-center pt-6">
                        <Button
                          variant="outline"
                          onClick={handlePreviousStep}
                          className="min-w-[120px]"
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back
                        </Button>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Progress value={progressPercentage} className="w-24 h-2" />
                          <span>Step 2 of 5</span>
                        </div>
                        <Button
                          onClick={handleContinue}
                          className={cn("min-w-[120px] bg-gradient-to-r", BUILDER_GOLD, BUILDER_GOLD_HOVER)}
                        >
                          Continue
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {builderState.step === 'government' && builderState.economicInputs && (
                    <div className="space-y-6">
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center space-y-4"
                      >
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg mb-4">
                          <Building2 className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <h2 className="text-3xl font-bold">Design Government Structure</h2>
                          <HelpTooltip text={stepConfig.government.help} />
                        </div>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                          Build your government using atomic components and configure spending priorities
                        </p>
                      </motion.div>

                      <Alert className="border-amber-200/50 bg-amber-50/30 backdrop-blur-sm">
                        <Shield className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Government Configuration:</strong> Select atomic components that will influence your nation's behavior.
                          Each component affects economic parameters and creates unique emergent properties.
                        </AlertDescription>
                      </Alert>

                      <Tabs value={builderState.activeGovernmentTab} onValueChange={(tab) => handleTabChange('government', tab)} className="space-y-6">
                        <EnhancedTabsList className="grid-cols-3">
                          <EnhancedTabsTrigger
                            value="components"
                            icon={Settings}
                            badge={builderState.governmentComponents.length}
                          >
                            Atomic Components
                          </EnhancedTabsTrigger>
                          <EnhancedTabsTrigger
                            value="structure"
                            icon={Crown}
                          >
                            Structure Builder
                          </EnhancedTabsTrigger>
                          <EnhancedTabsTrigger
                            value="spending"
                            icon={Coins}
                          >
                            Spending
                          </EnhancedTabsTrigger>
                        </EnhancedTabsList>

                        <TabsContent value="components" className="mt-6">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                          >
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Info className="h-4 w-4" />
                                <span>Each component adds unique characteristics to your government and influences economic calculations</span>
                              </div>
                              <AtomicComponentSelector
                                selectedComponents={builderState.governmentComponents}
                                onComponentChange={(components) => {
                                  setBuilderState(prev => ({
                                    ...prev,
                                    governmentComponents: components
                                  }));
                                }}
                                maxComponents={8}
                                isReadOnly={false}
                              />
                            </div>
                          </motion.div>
                        </TabsContent>

                        <TabsContent value="structure" className="mt-6">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                          >
                            <GovernmentBuilder
                              onSave={async (structure: any) => {
                                setBuilderState(prev => ({
                                  ...prev,
                                  governmentStructure: structure
                                }));
                              }}
                            />
                          </motion.div>
                        </TabsContent>

                        <TabsContent value="spending" className="mt-6">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                          >
                            <GovernmentSpendingSectionEnhanced
                              inputs={builderState.economicInputs}
                              onInputsChange={(economicInputs: EconomicInputs) => {
                                setBuilderState(prev => ({ ...prev, economicInputs }));
                              }}
                            />
                          </motion.div>
                        </TabsContent>
                      </Tabs>

                      <div className="flex justify-between items-center pt-6">
                        <Button
                          variant="outline"
                          onClick={handlePreviousStep}
                          className="min-w-[120px]"
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back
                        </Button>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Progress value={progressPercentage} className="w-24 h-2" />
                          <span>Step 3 of 5</span>
                        </div>
                        <Button
                          onClick={handleContinue}
                          disabled={builderState.governmentComponents.length === 0 && builderState.activeGovernmentTab === 'components'}
                          className={cn("min-w-[120px] bg-gradient-to-r", BUILDER_GOLD, BUILDER_GOLD_HOVER)}
                        >
                          Continue
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {builderState.step === 'economics' && builderState.economicInputs && (
                    <div className="space-y-6">
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center space-y-4"
                      >
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg mb-4">
                          <TrendingUp className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <h2 className="text-3xl font-bold">Configure Economic System</h2>
                          <HelpTooltip text={stepConfig.economics.help} />
                        </div>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                          Fine-tune economic parameters, tax policies, and demographics{builderState.selectedCountry ? ` for ${builderState.selectedCountry.name}` : ''}
                        </p>
                      </motion.div>

                      <Alert className="border-amber-200/50 bg-amber-50/30 backdrop-blur-sm">
                        <Calculator className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Economic Configuration:</strong> All values are interconnected and will automatically adjust based on your selections.
                          Government components from the previous step influence these parameters.
                        </AlertDescription>
                      </Alert>

                      <Tabs
                        value={builderState.activeEconomicsTab}
                        onValueChange={(value) => handleTabChange('economics', value)}
                        className="space-y-6"
                      >
                        <EnhancedTabsList className="grid-cols-2 lg:grid-cols-4">
                          <EnhancedTabsTrigger
                            value="economy"
                            icon={TrendingUp}
                          >
                            Economic Sectors
                          </EnhancedTabsTrigger>
                          <EnhancedTabsTrigger
                            value="labor"
                            icon={Users}
                          >
                            Labor & Employment
                          </EnhancedTabsTrigger>
                          <EnhancedTabsTrigger
                            value="demographics"
                            icon={Heart}
                          >
                            Demographics
                          </EnhancedTabsTrigger>
                          <EnhancedTabsTrigger
                            value="taxes"
                            icon={Calculator}
                          >
                            Tax System
                          </EnhancedTabsTrigger>
                        </EnhancedTabsList>

                        <TabsContent value={builderState.activeEconomicsTab} className="mt-6">
                          <motion.div
                            key={builderState.activeEconomicsTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {(() => {
                              const baseProps = {
                                inputs: builderState.economicInputs!,
                                onInputsChange: (economicInputs: EconomicInputs) => {
                                  setBuilderState(prev => ({ ...prev, economicInputs }));
                                },
                                showAdvanced: builderState.showAdvancedMode,
                                referenceCountry: builderState.selectedCountry!,
                                isReadOnly: false,
                                showComparison: true,
                                governmentComponents: builderState.governmentComponents, // Pass government components
                              };

                              switch (builderState.activeEconomicsTab) {
                                case 'economy':
                                  return <EconomySection {...baseProps} />;
                                case 'labor':
                                  return <LaborEmploymentSection {...baseProps} />;
                                case 'demographics':
                                  return <DemographicsSection {...baseProps} />;
                                case 'taxes':
                                  return (
                                    <div className="space-y-4">
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                        <Info className="h-4 w-4" />
                                        <span>Tax policies directly affect government revenue and economic growth. Your tax structure will fund the government spending allocations set earlier.</span>
                                      </div>
                                      <TaxBuilder
                                        countryId=""
                                        onSave={async (taxSystem: TaxBuilderState) => {
                                          setBuilderState(prev => ({
                                            ...prev,
                                            taxSystemData: taxSystem
                                          }));
                                        }}
                                      />
                                    </div>
                                  );
                                default:
                                  return <EconomySection {...baseProps} />;
                              }
                            })()}
                          </motion.div>
                        </TabsContent>
                      </Tabs>

                      <div className="flex justify-between items-center pt-6">
                        <Button
                          variant="outline"
                          onClick={handlePreviousStep}
                          className="min-w-[120px]"
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back
                        </Button>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Progress value={progressPercentage} className="w-24 h-2" />
                          <span>Step 4 of 5</span>
                        </div>
                        <Button
                          onClick={handleContinue}
                          className={cn("min-w-[120px] bg-gradient-to-r", BUILDER_GOLD, BUILDER_GOLD_HOVER)}
                        >
                          {builderState.activeEconomicsTab === 'taxes' ? 'Review' : 'Continue'}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {builderState.step === 'preview' && (
                    <div className="space-y-6">
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center space-y-4"
                      >
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg mb-4">
                          <CheckCircle className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <h2 className="text-3xl font-bold">Review Your Nation</h2>
                          <HelpTooltip text={stepConfig.preview.help} />
                        </div>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                          Review your configuration and create your nation
                        </p>
                      </motion.div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Foundation Summary */}
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 }}
                        >
                          <Card className="h-full border-2 hover:shadow-lg transition-shadow">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Crown className="h-5 w-5 text-amber-500" />
                                Foundation
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {builderState.selectedCountry ? (
                                <>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Foundation:</span>
                                    <span className="font-medium">{builderState.selectedCountry.name}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Region:</span>
                                    <span className="font-medium">{builderState.selectedCountry.region}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Economic Tier:</span>
                                    <Badge variant="secondary" className="capitalize">
                                      {builderState.selectedCountry.economicTier}
                                    </Badge>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center justify-center py-4">
                                  <div className="text-center">
                                    <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-600">
                                      Created from Scratch
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mt-2">No reference country</p>
                                  </div>
                                </div>
                              )}
                              {builderState.economicInputs && (
                                <div className="flex justify-between items-center pt-2 border-t">
                                  <span className="text-sm text-muted-foreground">GDP:</span>
                                  <span className="font-medium">
                                    ${(builderState.economicInputs.coreIndicators.nominalGDP / 1e9).toFixed(1)}B
                                  </span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>

                        {/* Government Summary */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          <Card className="h-full border-2 hover:shadow-lg transition-shadow">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-amber-500" />
                                Government
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Components:</span>
                                <Badge variant="secondary">
                                  {builderState.governmentComponents.length} Selected
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                {builderState.governmentComponents.slice(0, 3).map((component) => (
                                  <div key={component} className="flex items-center gap-2">
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs">
                                      {component.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                    </span>
                                  </div>
                                ))}
                                {builderState.governmentComponents.length > 3 && (
                                  <div className="text-xs text-muted-foreground italic">
                                    ... and {builderState.governmentComponents.length - 3} more
                                  </div>
                                )}
                              </div>
                              {builderState.economicInputs && (
                                <div className="flex justify-between items-center pt-2 border-t">
                                  <span className="text-sm text-muted-foreground">Spending:</span>
                                  <span className="font-medium">
                                    {builderState.economicInputs.governmentSpending.totalSpending.toFixed(1)}% GDP
                                  </span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>

                        {/* Economic Summary */}
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          <Card className="h-full border-2 hover:shadow-lg transition-shadow">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-amber-500" />
                                Economics
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {builderState.economicInputs && (
                                <>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Growth Rate:</span>
                                    <Badge variant={builderState.economicInputs.coreIndicators.realGDPGrowthRate > 3 ? "default" : "secondary"}>
                                      {builderState.economicInputs.coreIndicators.realGDPGrowthRate.toFixed(1)}%
                                    </Badge>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Unemployment:</span>
                                    <span className="font-medium">
                                      {builderState.economicInputs.laborEmployment.unemploymentRate.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Tax Revenue:</span>
                                    <span className="font-medium">
                                      {builderState.economicInputs.fiscalSystem.taxRevenueGDPPercent.toFixed(1)}% GDP
                                    </span>
                                  </div>
                                  {builderState.taxSystemData && (
                                    <div className="flex justify-between items-center pt-2 border-t">
                                      <span className="text-sm text-muted-foreground">Tax System:</span>
                                      <Badge variant="outline">Configured</Badge>
                                    </div>
                                  )}
                                </>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="flex justify-center gap-4 pt-6"
                      >
                        <Button
                          variant="outline"
                          onClick={handlePreviousStep}
                          size="lg"
                          className="min-w-[140px]"
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back
                        </Button>
                        <Button
                          onClick={handleCreateCountry}
                          disabled={createCountryMutation?.isLoading}
                          size="lg"
                          className="min-w-[200px] bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg"
                        >
                          {createCountryMutation?.isLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating Nation...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Create My Nation
                              <Crown className="h-4 w-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </motion.div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}