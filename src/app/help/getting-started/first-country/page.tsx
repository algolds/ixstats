"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Target, Map, TrendingUp, Users, Shield, ChevronRight, Info, Sparkles } from "lucide-react";

export default function FirstCountryPage() {
  useEffect(() => {
    document.title = "Creating Your First Country - Help Center";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/help"
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Help Center
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Creating Your First Country</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Step-by-step guide to building your nation from scratch
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Getting Started</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Creating your first country is an exciting journey! IxStats provides multiple pathways to build your nation, whether you want to import existing data from IxWiki or start completely fresh with our builder tools.
              </p>
            </section>

            <div className="bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-blue-900 dark:text-blue-300 font-semibold mb-1">Before You Begin</h3>
                  <p className="text-blue-800 dark:text-blue-100/80 text-sm">
                    Make sure you're signed in to IxStats. You'll need an account to save your country data and access all platform features.
                  </p>
                </div>
              </div>
            </div>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Two Paths to Country Creation</h2>

              <div className="space-y-4">
                <div className="p-5 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Map className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Import from IxWiki</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 mb-3">
                    If your nation already exists on IxWiki, you can import comprehensive data including demographics, government structure, economic indicators, and more.
                  </p>
                  <div className="text-sm text-slate-700 dark:text-slate-300">
                    <strong>Best for:</strong> Existing IxWiki nations wanting to enhance their presence with economic simulation
                  </div>
                </div>

                <div className="p-5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Build from Scratch</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 mb-3">
                    Start with a blank canvas and use our interactive Country Builder to define every aspect of your nation from economy to culture.
                  </p>
                  <div className="text-sm text-slate-700 dark:text-slate-300">
                    <strong>Best for:</strong> New nations or those wanting complete control over initial parameters
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Step-by-Step: Import Method</h2>
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">1</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Navigate to Builder/Import</strong>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                      Access the import tool from the main navigation or dashboard
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">2</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Enter Your IxWiki Page Name</strong>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                      Type the exact name of your IxWiki article (e.g., "Caphiria")
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">3</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Review Parsed Data</strong>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                      The system will extract data from your infobox. Review for accuracy and completeness
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">4</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Supplement Missing Information</strong>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                      Fill in any economic data, tier assignments, or details not available on IxWiki
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">5</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Save and Launch</strong>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                      Confirm your data and create your IxStats country profile
                    </p>
                  </div>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Step-by-Step: Builder Method</h2>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <Map className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Basic Information</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Name, capital, population, land area, flag, coat of arms. These fundamentals define your nation's identity.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Economic Profile</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Set your GDP, economic tier (1-5), currency, major industries, and trade partners. These drive your economic simulations.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Demographics & Society</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Define languages, ethnic composition, religion, literacy rate, and social indicators.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <Shield className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Government & Defense</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Choose government type (traditional or atomic system), establish leadership, and set defense parameters.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Essential Initial Decisions</h2>
              <ul className="space-y-3 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Economic Tier:</strong> Choose realistically based on your nation's development level. This significantly impacts growth rates and available features.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Government System:</strong> Traditional structures are simpler; atomic components offer advanced customization but require more setup.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Starting GDP:</strong> Should align with your chosen economic tier. The system provides tier-appropriate ranges.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">IxWiki Integration:</strong> Link your IxStats profile to your IxWiki page for synchronized information display.</span>
                </li>
              </ul>
            </section>

            <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-lg p-4">
              <h3 className="text-amber-900 dark:text-amber-300 font-semibold mb-2">Pro Tip</h3>
              <p className="text-amber-800 dark:text-amber-100/80 text-sm">
                You don't need to complete everything at once! Save your progress and return later to refine details. Focus on core economic data first—you can always expand demographics, culture, and government structure as you grow.
              </p>
            </div>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">After Creation</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Once your country is created, you'll be directed to your MyCountry dashboard—your executive command center. From here you can:
              </p>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>View real-time economic intelligence and projections</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Access the editor to refine your country profile</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Manage defense forces and political stability</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Engage with the diplomatic network</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Explore economic modeling and scenario planning</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2>
              <div className="grid gap-3">
                <Link
                  href="/help/getting-started/navigation"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Navigating the Platform</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/help/economy/tiers"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Understanding Economic Tiers</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/help/government/traditional"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Government Systems Overview</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>

          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/help/getting-started/ixtime"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Previous: Understanding IxTime
          </Link>
          <Link
            href="/help/getting-started/navigation"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Next: Navigating the Platform →
          </Link>
        </div>
      </div>
    </div>
  );
}
