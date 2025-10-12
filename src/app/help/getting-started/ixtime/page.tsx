"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Zap, Globe, ChevronRight, Info } from "lucide-react";



export default function IxTimePage() {
  useEffect(() => {
    document.title = "IxTime System - Help Center";
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
            <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Understanding IxTime</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            The custom time system that powers the IxStats simulation
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">What is IxTime?</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                IxTime is a custom time system that runs at <strong className="text-slate-900 dark:text-white">2x real-world speed</strong>. This means that for every 12 real-world hours, one full IxTime day passes. This accelerated timeline allows for more dynamic gameplay and faster progression while maintaining a consistent, immersive experience across the entire platform.
              </p>
            </section>

            <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-amber-900 dark:text-amber-300 font-semibold mb-1">Key Point</h3>
                  <p className="text-amber-800 dark:text-amber-100/80 text-sm">
                    All economic calculations, growth projections, and time-based events use IxTime, not real-world time. This creates a fair and synchronized experience for all users.
                  </p>
                </div>
              </div>
            </div>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Time Conversion</h2>
              <div className="grid gap-3">
                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600 dark:text-slate-400">Real World</span>
                    <span className="text-blue-600 dark:text-blue-400">→</span>
                    <span className="text-slate-600 dark:text-slate-400">IxTime</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">12 hours</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Real time</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">1 day</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">IxTime</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Additional conversions:</div>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                    <li>• <strong className="text-slate-900 dark:text-white">1 real hour</strong> = 2 IxTime hours</li>
                    <li>• <strong className="text-slate-900 dark:text-white">1 real day</strong> = 2 IxTime days</li>
                    <li>• <strong className="text-slate-900 dark:text-white">1 real week</strong> = 2 IxTime weeks</li>
                    <li>• <strong className="text-slate-900 dark:text-white">1 real month</strong> ≈ 2 IxTime months</li>
                    <li>• <strong className="text-slate-900 dark:text-white">1 real year</strong> = 2 IxTime years</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Why IxTime Matters</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="p-2 bg-blue-500/20 rounded-lg h-fit">
                    <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Accelerated Progression</h3>
                    <p className="text-slate-700 dark:text-slate-300">
                      Economic growth, government policies, and diplomatic missions progress at a faster pace, allowing you to see meaningful results without waiting months in real time.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="p-2 bg-emerald-500/20 rounded-lg h-fit">
                    <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Synchronized World</h3>
                    <p className="text-slate-700 dark:text-slate-300">
                      All users experience time at the same rate, ensuring fair competition and collaboration. Economic reports, elections, and events happen simultaneously for everyone.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg h-fit">
                    <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Realistic Timescales</h3>
                    <p className="text-slate-700 dark:text-slate-300">
                      Even at 2x speed, IxTime maintains realistic proportions. A decade of economic development still takes 5 real years, creating meaningful long-term strategy.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">How It Works in Practice</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                IxTime is integrated throughout the platform:
              </p>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Economic Reports:</strong> Generated based on IxTime quarters and years</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Growth Calculations:</strong> GDP growth, population changes, and development indicators use IxTime</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Events & Missions:</strong> Diplomatic missions, research projects, and construction follow IxTime timelines</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Historical Data:</strong> All charts and historical tracking use IxTime for consistency</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Discord Integration</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                IxTime is synchronized with our Discord bot, which provides real-time IxTime updates and notifications. This ensures that whether you're on the web platform or Discord, you're always in sync with the IxStats world.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2>
              <div className="grid gap-3">
                <Link
                  href="/help/getting-started/first-country"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Creating Your First Country</span>
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
            href="/help/getting-started/welcome"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Previous: Welcome
          </Link>
          <Link
            href="/help/getting-started/first-country"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Next: Creating Your First Country →
          </Link>
        </div>
      </div>
    </div>
  );
}
