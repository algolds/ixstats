"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Navigation, Menu, Zap, Layout, Command, ChevronRight, Info, TrendingUp } from "lucide-react";

export default function NavigationPage() {
  useEffect(() => {
    document.title = "Platform Navigation - Help Center";
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
            <Navigation className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Platform Navigation</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Master the IxStats interface and navigation system
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Main Navigation Bar</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                The top navigation bar is your primary gateway to all major platform sections. It provides quick access to your dashboard, global features, and administrative tools based on your permissions.
              </p>
              <div className="mt-4 space-y-3">
                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-2">Dashboard</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Your personal overview with quick stats and recent activity
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-2">MyCountry</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Executive command center for managing your nation
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-2">Countries</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Explore all nations in the simulation, view profiles, and compare statistics
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-2">ThinkPages</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Social platform for content creation, collaboration, and community engagement
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Dynamic Island</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                The Dynamic Island is an innovative floating interface element that provides real-time information and contextual actions without leaving your current page.
              </p>
              <div className="bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg p-4">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-blue-900 dark:text-blue-300 font-semibold mb-1">Location</h3>
                    <p className="text-blue-800 dark:text-blue-100/80 text-sm">
                      The Dynamic Island appears in the top-right corner of the screen on desktop, showing live stats, notifications, and quick actions.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="flex gap-4">
                  <div className="p-2 bg-emerald-500/20 rounded-lg h-fit">
                    <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Compact View</h3>
                    <p className="text-slate-700 dark:text-slate-300">
                      By default, shows essential country stats (GDP, population, growth rate) at a glance
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg h-fit">
                    <Layout className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Expanded View</h3>
                    <p className="text-slate-700 dark:text-slate-300">
                      Click to expand for detailed intelligence, recent alerts, and quick action buttons
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Sidebar Navigation</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Context-sensitive sidebars appear within major sections (MyCountry, Countries, ThinkPages) to provide subsection navigation and relevant tools.
              </p>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">MyCountry Sidebar:</strong> Economy, Defense, Intelligence, Diplomacy, Editor</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Countries Sidebar:</strong> Browse, Search, Compare, Leaderboards</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">ThinkPages Sidebar:</strong> Feed, Create, ThinkTanks, ThinkShare</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Admin Sidebar:</strong> System management, ECI/SDI configuration (admin only)</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Quick action buttons provide shortcuts to frequently used features:
              </p>
              <div className="grid gap-3">
                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <Command className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Command Palette</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Press <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">Cmd/Ctrl + K</kbd> to open the command palette for keyboard navigation
                  </p>
                </div>
                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Quick Action Menu</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Floating button (bottom-right) for rapid access to defense, diplomacy, and emergency actions
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Glass Physics Design System</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                IxStats uses a sophisticated glass physics design system with depth hierarchy. Cards and panels use translucent backgrounds with blur effects to create visual depth. Interactive elements respond to hover and focus states with smooth animations.
              </p>
              <div className="mt-4 p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-slate-700 dark:text-slate-200 text-sm">
                  <strong>Design Tip:</strong> Darker glass backgrounds indicate deeper UI layers. Modal dialogs appear "above" panels, which appear "above" page backgrounds.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Mobile Navigation</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                On mobile devices, navigation adapts to a bottom tab bar and hamburger menu system:
              </p>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Bottom Tab Bar:</strong> Dashboard, MyCountry, Countries, ThinkPages, Profile</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Hamburger Menu:</strong> Additional sections and settings</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Swipe Gestures:</strong> Navigate between tabs with horizontal swipes</span>
                </li>
              </ul>
            </section>

            <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-lg p-4">
              <h3 className="text-amber-900 dark:text-amber-300 font-semibold mb-2">Navigation Tip</h3>
              <p className="text-amber-800 dark:text-amber-100/80 text-sm">
                Use breadcrumbs at the top of content areas to understand your location in the app hierarchy and quickly navigate back to parent sections.
              </p>
            </div>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2>
              <div className="grid gap-3">
                <Link
                  href="/help/intelligence/dashboard"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Executive Dashboard Guide</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/help/economy/calculations"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Economic Calculations</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>

          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/help/getting-started/first-country"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Previous: Creating Your First Country
          </Link>
          <Link
            href="/help/economy/calculations"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Next: Economic Calculations →
          </Link>
        </div>
      </div>
    </div>
  );
}
