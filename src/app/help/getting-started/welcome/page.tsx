"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Globe, TrendingUp, Users, Clock, ChevronRight } from "lucide-react";



export default function WelcomePage() {
  useEffect(() => {
    document.title = "Welcome - Help Center";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href="/help"
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Help Center
        </Link>

        {/* Article Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Welcome to IxStats</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Your comprehensive nation simulation and worldbuilding platform
          </p>
        </div>

        {/* Main Content */}
        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">What is IxStats?</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                IxStats is a sophisticated nation simulation platform that allows you to create, manage, and grow your own country within a shared global community. Whether you're interested in economics, politics, military strategy, or social dynamics, IxStats provides the tools to bring your vision to life.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Key Features</h2>
              <div className="grid gap-4">
                <div className="flex gap-4 p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Economic Simulation</h3>
                    <p className="text-slate-700 dark:text-slate-300">
                      Build your economy with our tier-based growth system. Track GDP, manage trade, and project economic growth using real mathematical models.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <Globe className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Government Design</h3>
                    <p className="text-slate-700 dark:text-slate-300">
                      Create traditional government structures or experiment with our revolutionary Atomic Government System featuring 24 modular components.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Social Platform</h3>
                    <p className="text-slate-700 dark:text-slate-300">
                      Engage with the community through ThinkPages, collaborate on research in ThinkTanks, and share ideas via ThinkShare.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">IxTime System</h3>
                    <p className="text-slate-700 dark:text-slate-300">
                      Experience time at 2x real-world speed with our custom IxTime system, synchronized across the entire platform for immersive gameplay.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Getting Started</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Ready to begin your journey? Follow these steps:
              </p>
              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">1</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">Sign up or log in</strong> - Create your account to access all features
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">2</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">Create your country</strong> - Use the Country Builder to define your nation's characteristics
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">3</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">Explore your dashboard</strong> - Familiarize yourself with the MyCountry executive dashboard
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">4</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">Start developing</strong> - Begin managing your economy, building your government, and engaging with the community
                  </span>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Community & Support</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                IxStats is more than just a simulation—it's a vibrant community of worldbuilders, strategists, and creative thinkers. Join discussions, collaborate on projects, and learn from experienced players as you develop your nation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2>
              <div className="grid gap-3">
                <Link
                  href="/help/getting-started/ixtime"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Understanding IxTime</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/help/getting-started/first-country"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Creating Your First Country</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/help/getting-started/navigation"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Navigating the Platform</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>

          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/help"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Back to Help Center
          </Link>
          <Link
            href="/help/getting-started/ixtime"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Next: Understanding IxTime →
          </Link>
        </div>
      </div>
    </div>
  );
}
