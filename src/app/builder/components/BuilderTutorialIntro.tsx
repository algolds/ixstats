"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown, 
  Globe, 
  Sparkles, 
  ArrowRight, 
  CheckCircle,
  TrendingUp,
  Users,
  Building,
  Flag,
  Award,
  Target,
  Lightbulb
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { GlassCard, GlassCardContent, GlassCardHeader } from './glass/GlassCard';
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";

interface BuilderTutorialIntroProps {
  onStartTutorial: () => void;
  onSkip: () => void;
}

const features = [
  {
    icon: Globe,
    title: "180+ Foundation Countries",
    description: "Start with real economic data from any nation",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10"
  },
  {
    icon: TrendingUp,
    title: "Real-Time Economic Engine",
    description: "Watch your economy evolve with live calculations",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10"
  },
  {
    icon: Users,
    title: "Advanced Demographics",
    description: "Design detailed population and social structures",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10"
  },
  {
    icon: Building,
    title: "Government Systems",
    description: "Craft fiscal policy and spending priorities",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10"
  },
  {
    icon: Flag,
    title: "National Identity",
    description: "Upload symbols and define your nation's character",
    color: "text-red-400",
    bgColor: "bg-red-500/10"
  },
  {
    icon: Award,
    title: "Vitality Rings",
    description: "Monitor economic health with Apple-inspired indicators",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10"
  }
];

const whatYoullLearn = [
  "How to select the perfect foundation country for your vision",
  "Economic principles and how they interconnect in your nation",
  "Advanced customization techniques for demographics and fiscal policy",
  "How to interpret vitality rings and economic health indicators",
  "Best practices for creating sustainable and realistic economies",
  "Tips for using templates and importing existing data"
];

export const BuilderTutorialIntro = ({ onStartTutorial, onSkip }: BuilderTutorialIntroProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
      setProgress(((currentStep + 1) / 3) * 100);
    } else {
      onStartTutorial();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setProgress((currentStep - 1) / 3 * 100);
    }
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Interactive Grid Pattern Background */}
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="opacity-30 dark:opacity-20"
        squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
      />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="w-full max-w-4xl mx-auto"
        >
          <GlassCard depth="elevated" blur="medium" className="overflow-hidden">
            <GlassCardHeader className="text-center">
              <div className="flex items-center justify-center mb-4">
                <motion.div
                  animate={{ 
                    rotate: [0, 360],
                    scale: [1, 1.05, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                    scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="relative"
                >
                  <Globe className="h-12 w-12 text-blue-400" />
                  <Crown className="h-4 w-4 text-amber-400 absolute -top-1 -right-1" />
                </motion.div>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Welcome to MyCountry Builder
              </h1>
              <p className="text-white/70">
                Master the art of nation building with our comprehensive tutorial
              </p>
              
              {/* Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-sm text-white/60 mb-2">
                  <span>Tutorial Introduction</span>
                  <span>{Math.round(progress)}% Complete</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </GlassCardHeader>

            <GlassCardContent>
              <AnimatePresence mode="wait">
                {/* Step 1: Overview */}
                {currentStep === 0 && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-white mb-3">
                        The Ultimate Nation Building Platform
                      </h2>
                      <p className="text-white/70 max-w-2xl mx-auto">
                        MyCountry Builder combines real-world economic data with sophisticated modeling tools to create the most realistic nation-building experience ever designed.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {features.map((feature, index) => (
                        <motion.div
                          key={feature.title}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className={`p-4 rounded-lg ${feature.bgColor} border border-white/10`}
                        >
                          <feature.icon className={`h-6 w-6 ${feature.color} mb-3`} />
                          <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                          <p className="text-white/60 text-sm">{feature.description}</p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: What You'll Learn */}
                {currentStep === 1 && (
                  <motion.div
                    key="learn"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="text-center mb-8">
                      <Lightbulb className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                      <h2 className="text-2xl font-bold text-white mb-3">
                        What You'll Learn
                      </h2>
                      <p className="text-white/70 max-w-2xl mx-auto">
                        This tutorial will guide you through every aspect of creating a sophisticated economic simulation. By the end, you'll be a master nation builder.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {whatYoullLearn.map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                        >
                          <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span className="text-white/80 text-sm">{item}</span>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-8 p-4 rounded-lg bg-blue-500/10 border border-blue-400/20">
                      <div className="flex items-center gap-3 mb-2">
                        <Target className="h-5 w-5 text-blue-400" />
                        <span className="font-semibold text-white">Tutorial Duration</span>
                      </div>
                      <p className="text-white/70 text-sm">
                        The complete tutorial takes about 5-7 minutes and includes interactive examples and hands-on practice. You can exit at any time and return later.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Ready to Start */}
                {currentStep === 2 && (
                  <motion.div
                    key="ready"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="text-center space-y-6"
                  >
                    <motion.div
                      animate={{ 
                        y: [0, -10, 0],
                        scale: [1, 1.05, 1]
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <Sparkles className="h-16 w-16 text-purple-400 mx-auto mb-6" />
                    </motion.div>

                    <h2 className="text-3xl font-bold text-white mb-4">
                      Ready to Build Your Nation?
                    </h2>
                    <p className="text-white/70 max-w-xl mx-auto text-lg">
                      Let's begin your journey from economic foundations to a thriving virtual nation. Your tutorial starts with selecting the perfect foundation country.
                    </p>

                    <div className="mt-8 p-6 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-600/20 border border-purple-400/30">
                      <h3 className="font-semibold text-white mb-3">🎯 Your First Step</h3>
                      <p className="text-white/80">
                        You'll start by exploring our database of 180+ countries to find the perfect economic foundation for your nation. Each country comes with real-world data that you can customize to your vision.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10">
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="text-white/60 hover:text-white hover:bg-white/10"
                >
                  Skip Tutorial
                </Button>

                <div className="flex gap-3">
                  {currentStep > 0 && (
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      Previous
                    </Button>
                  )}
                  <Button
                    onClick={handleNext}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    {currentStep === 2 ? (
                      <>
                        Start Tutorial
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      'Next'
                    )}
                  </Button>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};