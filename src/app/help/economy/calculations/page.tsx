"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, TrendingUp, DollarSign, BarChart3, ChevronRight, Info } from "lucide-react";

export default function EconomicCalculationsPage() {
  useEffect(() => {
    document.title = "Economic Calculations - Help Center";
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
            <Calculator className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Economic Calculations</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Understanding GDP, growth rates, and economic indicators
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Core Economic Formulas</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                IxStats uses real economic formulas to calculate GDP, growth projections, and development indicators. All calculations are based on your country's economic tier, baseline data, and policy decisions.
              </p>
            </section>

            <div className="bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-blue-900 dark:text-blue-300 font-semibold mb-1">Real Mathematics</h3>
                  <p className="text-blue-800 dark:text-blue-100/80 text-sm">
                    All economic projections use compound growth formulas, tier-based multipliers, and historical economic models—not random numbers.
                  </p>
                </div>
              </div>
            </div>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">GDP Calculations</h2>

              <div className="space-y-4">
                <div className="p-5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-lg">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Total GDP Formula</h3>
                  <div className="font-mono text-sm bg-slate-900 text-emerald-400 p-4 rounded-lg overflow-x-auto">
                    Total GDP = Population × GDP per Capita
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 mt-3 text-sm">
                    Your country's total economic output is the product of population size and per-capita productivity.
                  </p>
                </div>

                <div className="p-5 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 rounded-lg">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">GDP Growth Rate</h3>
                  <div className="font-mono text-sm bg-slate-900 text-blue-400 p-4 rounded-lg overflow-x-auto">
                    Growth Rate = ((Current GDP - Previous GDP) / Previous GDP) × 100
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 mt-3 text-sm">
                    Percentage change in GDP over an IxTime year, adjusted by economic tier and policy effectiveness.
                  </p>
                </div>

                <div className="p-5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">GDP per Capita Growth</h3>
                  <div className="font-mono text-sm bg-slate-900 text-purple-400 p-4 rounded-lg overflow-x-auto">
                    GDP/Capita Growth = (GDP Growth Rate - Population Growth Rate)
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 mt-3 text-sm">
                    True measure of living standard improvement—accounts for population changes.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Tier-Based Growth Modeling</h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              Each economic tier has a maximum annual growth cap. Projections are capped by tier and include diminishing returns once GDP per capita exceeds $60,000.
            </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="text-left p-3 text-slate-900 dark:text-white">Tier</th>
                    <th className="text-left p-3 text-slate-900 dark:text-white">Max Growth</th>
                      <th className="text-left p-3 text-slate-900 dark:text-white">Volatility</th>
                      <th className="text-left p-3 text-slate-900 dark:text-white">Potential</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <td className="p-3">Impoverished</td>
                    <td className="p-3">10%</td>
                    <td className="p-3">High</td>
                    <td className="p-3">Very High</td>
                  </tr>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <td className="p-3">Developing</td>
                    <td className="p-3">7.5%</td>
                    <td className="p-3">Moderate</td>
                    <td className="p-3">High</td>
                  </tr>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <td className="p-3">Developed</td>
                    <td className="p-3">5%</td>
                    <td className="p-3">Low</td>
                    <td className="p-3">Moderate</td>
                  </tr>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <td className="p-3">Healthy</td>
                    <td className="p-3">3.5%</td>
                    <td className="p-3">Very Low</td>
                    <td className="p-3">Steady</td>
                  </tr>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <td className="p-3">Strong</td>
                    <td className="p-3">2.75%</td>
                    <td className="p-3">Very Low</td>
                    <td className="p-3">Steady</td>
                  </tr>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <td className="p-3">Very Strong</td>
                    <td className="p-3">1.5%</td>
                    <td className="p-3">Minimal</td>
                    <td className="p-3">Stable</td>
                  </tr>
                  <tr>
                    <td className="p-3">Extravagant</td>
                    <td className="p-3">0.5%</td>
                    <td className="p-3">Minimal</td>
                    <td className="p-3">Stable</td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Economic Indicators</h2>
              <div className="grid gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Inflation Rate</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Calculated based on GDP growth, money supply changes, and tier-specific inflation targets. Affects real GDP adjustments.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Trade Balance</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Exports minus Imports as percentage of GDP. Positive balance contributes to GDP growth, negative balance reduces it.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">GDP Density</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Economic output per square kilometer. Calculated as Total GDP / Land Area. High density indicates urbanization and development.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <Calculator className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Unemployment Rate</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Based on labor force participation, job creation rate, and economic tier. Lower tiers typically have higher structural unemployment.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Projection Formulas</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Long-term projections use compound annual growth rate (CAGR) formulas:
              </p>
              <div className="font-mono text-sm bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
                Future Value = Present Value × (1 + growth_rate)^years
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-sm">
                Projections account for tier transitions, policy impacts, and diminishing returns at higher development levels.
              </p>
            </section>

            <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-lg p-4">
              <h3 className="text-amber-900 dark:text-amber-300 font-semibold mb-2">Understanding Projections</h3>
              <p className="text-amber-800 dark:text-amber-100/80 text-sm">
                All projections are estimates based on current trajectory. Policy changes, crises, and user decisions can significantly alter outcomes. Use projections as planning tools, not guarantees.
              </p>
            </div>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2>
              <div className="grid gap-3">
                <Link
                  href="/help/economy/modeling"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Economic Modeling & Projections</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/help/economy/trade"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">International Trade System</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>

          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/help/economy/tiers"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Previous: Economic Tiers
          </Link>
          <Link
            href="/help/economy/modeling"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Next: Economic Modeling →
          </Link>
        </div>
      </div>
    </div>
  );
}
