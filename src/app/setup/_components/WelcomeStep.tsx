"use client";

import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Link } from "lucide-react";
import { Button } from "~/components/ui/button";
import { IxStatsLogo } from "~/components/ui/ixstats-logo";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";

interface WelcomeStepProps {
  userName?: string;
  onCreateNew: () => void;
  onLinkExisting: () => void;
}

export function WelcomeStep({ userName, onCreateNew, onLinkExisting }: WelcomeStepProps) {
  return (
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

        <h1 className="text-6xl font-bold text-foreground mb-8">
          Welcome to IxStats, {userName || 'User'}!
        </h1>

        <p className="text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
          To get started, please choose an option below.
        </p>
      </motion.div>

      {/* Primary Option - Create New Country */}
      <div className="max-w-4xl mx-auto mb-8">
        <motion.button
          onClick={onCreateNew}
          className="relative glass-hierarchy-parent p-12 rounded-3xl text-left group hover:glass-hierarchy-interactive transition-all duration-500 border border-amber-200/30 dark:border-amber-800/30 w-full overflow-hidden"
          whileHover={{
            y: -12,
            scale: 1.02,
            transition: { duration: 0.3, ease: "easeOut" }
          }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/20 via-transparent to-yellow-50/20 dark:from-amber-950/20 dark:via-transparent dark:to-yellow-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative z-10">
            <div className="flex items-center mb-8">
              <div className="glass-hierarchy-child p-4 rounded-2xl mr-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/50 dark:to-yellow-900/50 border border-amber-200/50 dark:border-amber-700/50">
                <MyCountryLogo size="lg" variant="icon-only" animated={true} />
              </div>
              <div>
                <h3 className="text-4xl font-bold bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 bg-clip-text text-transparent mb-2 group-hover:from-amber-500 group-hover:via-yellow-400 group-hover:to-amber-500 transition-all duration-300">
                  Create New Country
                </h3>
                <div className="flex items-center">
                  <div className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-400/20 to-yellow-400/20 border border-amber-300/30 dark:border-amber-600/30">
                    <p className="text-sm font-medium bg-gradient-to-r from-amber-700 to-yellow-600 dark:from-amber-300 dark:to-yellow-400 bg-clip-text text-transparent">
                      Recommended
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground mb-8 leading-relaxed text-xl group-hover:text-foreground/80 transition-colors duration-300">
              Start fresh with a new nation. Create your country's government structure, economy, demographics, and policies to your liking.
            </p>

            <div className="flex items-center text-amber-600 dark:text-amber-400 group-hover:text-amber-500 dark:group-hover:text-amber-300 transition-all duration-300 text-xl">
              <span className="font-semibold bg-gradient-to-r from-amber-600 to-yellow-600 dark:from-amber-400 dark:to-yellow-400 bg-clip-text text-transparent">
                Get Started with MyCountry Builder
              </span>
              <ArrowRight className="h-8 w-8 ml-3 group-hover:translate-x-3 group-hover:scale-110 transition-all duration-300" />
            </div>
          </div>
        </motion.button>
      </div>

      {/* Secondary Option - Link Existing Country */}
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-hierarchy-child p-6 rounded-2xl border border-border"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="glass-hierarchy-child p-3 rounded-xl mr-4">
                <Link className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="text-xl font-bold text-foreground">
                Link Existing Country
              </h4>
            </div>
            <button
              onClick={onLinkExisting}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm font-medium"
            >
              Use this option →
            </button>
          </div>

          <p className="text-muted-foreground mb-4 text-sm">
            Connect your account to an existing country in the system.
            Perfect if you're taking over management of an established nation.
          </p>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">
              Only choose this if told to do so
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
