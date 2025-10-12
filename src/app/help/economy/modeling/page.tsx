"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, LineChart, Target, TrendingUp, Layers, ChevronRight, Info, AlertTriangle } from "lucide-react";

export default function EconomicModelingPage() {
  useEffect(() => {
    document.title = "Economic Modeling - Help Center";
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
            <LineChart className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Economic Modeling & Projections</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Plan your nation's economic future with scenario modeling tools
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">What is Economic Modeling?</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Economic modeling allows you to simulate different policy scenarios, investment strategies, and development paths before implementing them. Test the impact of decisions on GDP growth, unemployment, trade balance, and social indicators without risking your actual economy.
              </p>
            </section>

            <div className="bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-blue-900 dark:text-blue-300 font-semibold mb-1">Access Requirements</h3>
                  <p className="text-blue-800 dark:text-blue-100/80 text-sm">
                    Economic modeling tools are available from your MyCountry dashboard under the Economy section. Navigate to Modeling & Projections tab.
                  </p>
                </div>
              </div>
            </div>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Key Modeling Features</h2>
              <div className="space-y-4">
                <div className="p-5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Target className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Scenario Planning</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200">
                    Create multiple economic scenarios with different policy mixes. Compare outcomes side-by-side to identify optimal strategies.
                  </p>
                </div>

                <div className="p-5 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Growth Projections</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200">
                    Model GDP growth trajectories over 5, 10, or 20 IxTime years. See how tier transitions and development milestones affect long-term outcomes.
                  </p>
                </div>

                <div className="p-5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Layers className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Policy Impact Analysis</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200">
                    Test individual policies (tax rates, spending programs, trade agreements) to understand their isolated and combined effects.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Creating a Model</h2>
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">1</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Set Baseline Parameters</strong>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                      Start with your current economic data (automatically loaded) or create a hypothetical baseline
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">2</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Choose Policy Variables</strong>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                      Select which policies or investments to modify (tax rates, infrastructure spending, trade openness)
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">3</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Set Projection Timeline</strong>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                      Define forecast horizon (5-20 IxTime years) and key milestone dates
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">4</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Run Simulation</strong>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                      Generate projections using tier-based growth models and policy multipliers
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">5</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Analyze Results</strong>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                      Review charts, indicators, and trade-offs. Save successful scenarios for implementation
                    </p>
                  </div>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Modeling Variables</h2>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Tax Policy:</strong> Income, corporate, VAT rates and their revenue/growth trade-offs</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Government Spending:</strong> Infrastructure, education, healthcare investment effects</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Trade Policy:</strong> Tariffs, trade agreements, export promotion impacts</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Monetary Policy:</strong> Interest rates, money supply, inflation targeting</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Development Strategy:</strong> Sector prioritization (agriculture, manufacturing, services)</span>
                </li>
              </ul>
            </section>

            <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-amber-900 dark:text-amber-300 font-semibold mb-1">Model Limitations</h3>
                  <p className="text-amber-800 dark:text-amber-100/80 text-sm">
                    Models assume stable conditions and rational responses. Real outcomes may vary due to unexpected events, external shocks, or player decisions. Use models as guides, not certainties.
                  </p>
                </div>
              </div>
            </div>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Best Practices</h2>
              <div className="grid gap-3">
                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-2">Start Conservative</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Use realistic assumptions based on your current tier. Overly optimistic projections lead to disappointment.
                  </p>
                </div>
                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-2">Compare Multiple Scenarios</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Create baseline, optimistic, and pessimistic cases. Real outcomes often fall between them.
                  </p>
                </div>
                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-2">Account for Time Lags</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Major policies (infrastructure, education) take 3-5 IxTime years to show full effects.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2>
              <div className="grid gap-3">
                <Link
                  href="/help/economy/trade"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">International Trade System</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/help/intelligence/forecasting"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Forecasting & Predictive Analytics</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>

          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/help/economy/calculations"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Previous: Economic Calculations
          </Link>
          <Link
            href="/help/economy/trade"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Next: International Trade →
          </Link>
        </div>
      </div>
    </div>
  );
}
