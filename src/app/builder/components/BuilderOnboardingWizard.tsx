"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Zap,
  Upload,
  Rocket
} from 'lucide-react';
import { Button } from '~/components/ui/button';
// IntroDisclosure now handled by main builder page
// Removed apple cards - using direct path selection instead
import { GlassCard, GlassCardContent, GlassCardHeader } from './glass/GlassCard';
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { BorderBeam } from "~/components/magicui/border-beam";
import { PathGlareCard } from "~/components/ui/path-glare-card";
import { MyCountryLogo } from '~/components/ui/mycountry-logo';
import { SectionHelpIcon } from '~/components/ui/help-icon';
// Tutorial data now imported by main builder page

type OnboardingFlow = 'welcome' | 'tutorial' | 'quick-start' | 'import-guide' | 'advanced';

interface BuilderOnboardingWizardProps {
  onStartBuilding: () => void;
  onSkipToImport?: () => void;
}

// Path options for the Choose Your Path section
const pathOptions = [
  {
    id: 'tutorial',
    title: 'Complete Tutorial',
    description: 'Full walkthrough of all features and capabilities',
    duration: '10 steps • 5-10 minutes',
    icon: BookOpen,
    color: 'blue',
    gradient: 'from-blue-500/20 to-purple-600/20 hover:from-blue-500/30 hover:to-purple-600/30',
    border: 'border-blue-400/30',
    iconColor: 'text-blue-400',
    recommended: true
  },
  {
    id: 'quick-start',
    title: 'Quick Start',
    description: 'Brief tutorial explaining how the builder works',
    duration: 'Interactive guide • Start at Core Identity',
    icon: Zap,
    color: 'emerald',
    gradient: 'from-emerald-500/20 to-teal-600/20 hover:from-emerald-500/30 hover:to-teal-600/30',
    border: 'border-emerald-400/30',
    iconColor: 'text-emerald-400'
  },
  {
    id: 'import',
    title: 'Import Country',
    description: 'Import existing country data from IIWiki',
    duration: '3 steps • 2-5 minutes',
    icon: Upload,
    color: 'amber',
    gradient: 'from-amber-500/20 to-orange-600/20 hover:from-amber-500/30 hover:to-orange-600/30',
    border: 'border-amber-400/30',
    iconColor: 'text-white-400'
  },
  {
    id: 'skip',
    title: 'Jump In',
    description: 'Start building from scratch without any tutorial',
    duration: 'Begin at Core Identity section',
    icon: Rocket,
    color: 'purple',
    gradient: 'from-purple-500/60 to-pink-600/60 hover:from-purple-600/70 hover:to-pink-700/70',
    border: 'border-purple-400/40',
    iconColor: 'text-white',
    primary: true
  }
];

export const BuilderOnboardingWizard = ({ onStartBuilding, onSkipToImport }: BuilderOnboardingWizardProps) => {
  const [currentFlow, setCurrentFlow] = useState<OnboardingFlow>('welcome');

  // Check if user has seen onboarding before
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('builder_onboarding_completed');
    if (hasSeenOnboarding) {
      // Skip to building for returning users, but still show welcome
      setCurrentFlow('welcome');
    }
  }, []);

  const handleStartTutorial = () => {
    // Set tutorial flag and navigate to builder
    localStorage.setItem('builder_tutorial_mode', 'full');
    localStorage.setItem('builder_onboarding_completed', 'true');
    onStartBuilding();
  };

  const handleStartQuickStart = () => {
    // Set quick start flag with core identity focus and navigate to builder
    localStorage.setItem('builder_tutorial_mode', 'quick');
    localStorage.setItem('builder_quick_start_section', 'core'); // Start at Core Identity
    localStorage.setItem('builder_onboarding_completed', 'true');
    onStartBuilding();
  };

  const handleStartImportGuide = () => {
    // Navigate to import page
    if (onSkipToImport) {
      onSkipToImport();
    }
  };

  const handleSkipOnboarding = () => {
    // Skip all tutorials and go straight to builder
    localStorage.setItem('builder_onboarding_completed', 'true');
    // Ensure we start at Core Identity when jumping in
    localStorage.setItem('builder_quick_start_section', 'core');
    localStorage.removeItem('builder_tutorial_mode');
    onStartBuilding();
  };

  // Tutorial steps will be handled by the main builder page

  // Handle path selection
  const handlePathSelect = (pathId: string) => {
    switch (pathId) {
      case 'tutorial':
        handleStartTutorial();
        break;
      case 'quick-start':
        handleStartQuickStart();
        break;
      case 'import':
        handleStartImportGuide();
        break;
      case 'skip':
        handleSkipOnboarding();
        break;
    }
  };

  return (
    <>
      <div className="relative min-h-screen bg-background">
        {/* Interactive Grid Pattern Background */}
        <InteractiveGridPattern
          width={40}
          height={40}
          squares={[50, 40]}
          className="opacity-30 dark:opacity-20"
          squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
        />

        <AnimatePresence mode="wait">
          {currentFlow === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className="relative z-10"
            >
              <div className="w-full min-h-screen flex flex-col items-center justify-center px-4 py-8">
                {/* Header Section */}
                <div className="flex items-center justify-center gap-4 mb-6">
                  <MyCountryLogo size="xxl" animated />
                
                    </div>

                {/* Choose Your Path Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: 'easeInOut', delay: 0.3 }}
                  className="w-full max-w-4xl mx-auto"
                >
                  <GlassCard depth="elevated" blur="medium" className="p-8 relative">
                    {/* Border Beam Effects */}
                    <BorderBeam
                      size={120}
                      duration={6}
                      delay={3}
                      colorFrom="#fbbf24"
                      colorTo="#f59e0b"
                      transition={{
                        type: "spring",
                        stiffness: 10,
                        damping: 40,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    <BorderBeam
                      size={80}
                      duration={6}
                      delay={8}
                      colorFrom="#f97316"
                      colorTo="#fbbf24"
                      reverse={true}
                      transition={{
                        type: "spring",
                        stiffness: 15,
                        damping: 50,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    <GlassCardHeader>
                      <div className="text-center">
                        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
                          Choose Your Path
                          <SectionHelpIcon
                            title="Builder Modes"
                            content="Select your preferred way to create your country. The Complete Tutorial provides step-by-step guidance, Quick Start gives you a brief overview, Import allows you to bring in existing data from IIWiki, and Jump In lets you build freely."
                          />
                        </h2>
                        <p className="text-muted-foreground">
                          How would you like to begin building your country?
                        </p>
                      </div>
                    </GlassCardHeader>
                    <GlassCardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        {pathOptions.map((option) => (
                          <motion.div
                            key={option.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="relative"
                          >
                            {option.recommended && (
                              <div className="absolute -top-2 -right-2 z-10">
                                <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-xs px-2 py-1 rounded-full font-medium shadow-lg border border-amber-300">
                                  Recommended
                                </span>
                              </div>
                            )}
                            <div onClick={() => handlePathSelect(option.id)}>
                              <PathGlareCard>
                                <Button
                                  variant="outline"
                                  size="lg"
                                  className={`w-full h-auto flex flex-col items-start p-6 bg-gradient-to-br ${option.gradient} ${option.border} text-white dark:text-white text-left relative overflow-hidden border-none pointer-events-none`}
                                >
                                  <div className="flex items-center gap-3 mb-3 w-full">
                                    <option.icon className={`h-6 w-6 ${option.iconColor}`} />
                                    <div className="flex-1">
                                      <span className="font-semibold block text-slate-900 dark:text-white">{option.title}</span>
                                      <span className="text-xs text-slate-800 dark:text-white block font-medium opacity-90">{option.duration}</span>
                                    </div>
                                  </div>
                                  <p className="text-sm text-slate-800 dark:text-white leading-relaxed font-medium opacity-95">
                                    {option.description}
                                  </p>
                                </Button>
                              </PathGlareCard>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Help Text */}
                      <div className="mt-6 text-center">
                        <p className="text-muted-foreground text-sm">
                          First time here? We recommend starting with the Complete Tutorial to learn all features.
                        </p>
                      </div>
                    </GlassCardContent>
                  </GlassCard>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tutorial modals removed - they now appear on the builder page */}
    </>
  );
};