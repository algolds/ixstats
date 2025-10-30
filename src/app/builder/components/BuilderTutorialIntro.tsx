"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Lightbulb,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { GlassCard, GlassCardContent, GlassCardHeader } from "./glass/GlassCard";
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
    bgColor: "bg-blue-500/10",
  },
  {
    icon: TrendingUp,
    title: "Real-Time Economic Engine",
    description: "Watch your economy evolve with live calculations",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: Users,
    title: "Advanced Demographics",
    description: "Design detailed population and social structures",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: Building,
    title: "Government Systems",
    description: "Craft fiscal policy and spending priorities",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: Flag,
    title: "National Identity",
    description: "Upload symbols and define your nation's character",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  {
    icon: Award,
    title: "Vitality Rings",
    description: "Monitor economic health with Apple-inspired indicators",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
  },
];

const whatYoullLearn = [
  "How to select the perfect foundation country for your vision",
  "Economic principles and how they interconnect in your nation",
  "Advanced customization techniques for demographics and fiscal policy",
  "How to interpret vitality rings and economic health indicators",
  "Best practices for creating sustainable and realistic economies",
  "Tips for using templates and importing existing data",
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
      setProgress(((currentStep - 1) / 3) * 100);
    }
  };

  return (
    <div className="bg-background relative min-h-screen overflow-hidden">
      {/* Interactive Grid Pattern Background */}
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="opacity-30 dark:opacity-20"
        squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="mx-auto w-full max-w-4xl"
        >
          <GlassCard depth="elevated" blur="medium" className="overflow-hidden">
            <GlassCardHeader className="text-center">
              <div className="mb-4 flex items-center justify-center">
                <motion.div
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                    scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                  }}
                  className="relative"
                >
                  <Globe className="h-12 w-12 text-blue-400" />
                  <Crown className="absolute -top-1 -right-1 h-4 w-4 text-amber-400" />
                </motion.div>
              </div>
              <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">
                Welcome to MyCountry Builder
              </h1>
              <p className="text-white/70">
                Master the art of nation building with our comprehensive tutorial
              </p>

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-sm text-white/60">
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
                    <div className="mb-8 text-center">
                      <h2 className="mb-3 text-2xl font-bold text-white">
                        The Ultimate Nation Building Platform
                      </h2>
                      <p className="mx-auto max-w-2xl text-white/70">
                        MyCountry Builder combines real-world economic data with sophisticated
                        modeling tools to create the most realistic nation-building experience ever
                        designed.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {features.map((feature, index) => (
                        <motion.div
                          key={feature.title}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className={`rounded-lg p-4 ${feature.bgColor} border border-white/10`}
                        >
                          <feature.icon className={`h-6 w-6 ${feature.color} mb-3`} />
                          <h3 className="mb-2 font-semibold text-white">{feature.title}</h3>
                          <p className="text-sm text-white/60">{feature.description}</p>
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
                    <div className="mb-8 text-center">
                      <Lightbulb className="mx-auto mb-4 h-12 w-12 text-amber-400" />
                      <h2 className="mb-3 text-2xl font-bold text-white">What You'll Learn</h2>
                      <p className="mx-auto max-w-2xl text-white/70">
                        This tutorial will guide you through every aspect of creating a
                        sophisticated economic simulation. By the end, you'll be a master nation
                        builder.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {whatYoullLearn.map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                        >
                          <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                          <span className="text-sm text-white/80">{item}</span>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-8 rounded-lg border border-blue-400/20 bg-blue-500/10 p-4">
                      <div className="mb-2 flex items-center gap-3">
                        <Target className="h-5 w-5 text-blue-400" />
                        <span className="font-semibold text-white">Tutorial Duration</span>
                      </div>
                      <p className="text-sm text-white/70">
                        The complete tutorial takes about 5-7 minutes and includes interactive
                        examples and hands-on practice. You can exit at any time and return later.
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
                    className="space-y-6 text-center"
                  >
                    <motion.div
                      animate={{
                        y: [0, -10, 0],
                        scale: [1, 1.05, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Sparkles className="mx-auto mb-6 h-16 w-16 text-purple-400" />
                    </motion.div>

                    <h2 className="mb-4 text-3xl font-bold text-white">
                      Ready to Build Your Nation?
                    </h2>
                    <p className="mx-auto max-w-xl text-lg text-white/70">
                      Let's begin your journey from economic foundations to a thriving virtual
                      nation. Your tutorial starts with selecting the perfect foundation country.
                    </p>

                    <div className="mt-8 rounded-lg border border-purple-400/30 bg-gradient-to-br from-purple-500/20 to-blue-600/20 p-6">
                      <h3 className="mb-3 font-semibold text-white">🎯 Your First Step</h3>
                      <p className="text-white/80">
                        You'll start by exploring our database of 180+ countries to find the perfect
                        economic foundation for your nation. Each country comes with real-world data
                        that you can customize to your vision.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="text-white/60 hover:bg-white/10 hover:text-white"
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
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  >
                    {currentStep === 2 ? (
                      <>
                        Start Tutorial
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      "Next"
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
