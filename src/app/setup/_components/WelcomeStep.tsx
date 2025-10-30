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

        <h1 className="text-foreground mb-8 text-6xl font-bold">
          Welcome to IxStats, {userName || "User"}!
        </h1>

        <p className="text-muted-foreground mx-auto max-w-4xl text-2xl leading-relaxed">
          To get started, please choose an option below.
        </p>
      </motion.div>

      {/* Primary Option - Create New Country */}
      <div className="mx-auto mb-8 max-w-4xl">
        <motion.button
          onClick={onCreateNew}
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
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/20 via-transparent to-yellow-50/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-amber-950/20 dark:via-transparent dark:to-yellow-950/20" />

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
                      Recommended
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground group-hover:text-foreground/80 mb-8 text-xl leading-relaxed transition-colors duration-300">
              Start fresh with a new nation. Create your country's government structure, economy,
              demographics, and policies to your liking.
            </p>

            <div className="flex items-center text-xl text-amber-600 transition-all duration-300 group-hover:text-amber-500 dark:text-amber-400 dark:group-hover:text-amber-300">
              <span className="bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text font-semibold text-transparent dark:from-amber-400 dark:to-yellow-400">
                Get Started with MyCountry Builder
              </span>
              <ArrowRight className="ml-3 h-8 w-8 transition-all duration-300 group-hover:translate-x-3 group-hover:scale-110" />
            </div>
          </div>
        </motion.button>
      </div>

      {/* Secondary Option - Link Existing Country */}
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
              <h4 className="text-foreground text-xl font-bold">Link Existing Country</h4>
            </div>
            <button
              onClick={onLinkExisting}
              className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Use this option →
            </button>
          </div>

          <p className="text-muted-foreground mb-4 text-sm">
            Connect your account to an existing country in the system. Perfect if you're taking over
            management of an established nation.
          </p>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Only choose this if told to do so
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
