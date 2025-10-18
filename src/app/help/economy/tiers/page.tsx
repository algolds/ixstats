"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, BarChart3, Target, ChevronRight, Info } from "lucide-react";



export default function EconomicTiersPage() {
  useEffect(() => {
    document.title = "Economic Tiers - Help Center";
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
            <TrendingUp className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Economic Tier System</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Understanding tier-based growth modeling and economic development
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">What Are Economic Tiers?</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                IxStats uses a sophisticated 5-tier economic classification system that categorizes nations based on their economic development level. This system drives growth projections, economic calculations, and development trajectories, providing realistic simulation of economic progress.
              </p>
            </section>

            <div className="bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-blue-900 dark:text-blue-300 font-semibold mb-1">Why Tiers Matter</h3>
                  <p className="text-blue-800 dark:text-blue-100/80 text-sm">
                    Economic tiers determine your country's growth rate, development potential, and economic complexity. Moving up tiers represents real economic transformation, not just numerical increases.
                  </p>
                </div>
              </div>
            </div>

            <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">The Seven Economic Tiers</h2>

              <div className="space-y-4">
                <div className="p-5 bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="px-3 py-1 bg-red-500/30 rounded-full">
              <span className="text-red-200 font-bold">Impoverished</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Impoverished Economy</h3>
          </div>
          <div className="space-y-2 text-slate-700 dark:text-slate-200">
            <p><strong>GDP per Capita:</strong> $0 – $9,999</p>
            <p><strong>Max Growth Cap:</strong> 10% annually</p>
            <p><strong>Characteristics:</strong> Early-stage development, basic industrialization, high upside with volatility</p>
          </div>
                </div>

        <div className="p-5 bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="px-3 py-1 bg-orange-500/30 rounded-full">
              <span className="text-orange-200 font-bold">Developing</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Developing Economy</h3>
          </div>
          <div className="space-y-2 text-slate-700 dark:text-slate-200">
            <p><strong>GDP per Capita:</strong> $10,000 – $24,999</p>
            <p><strong>Max Growth Cap:</strong> 7.5% annually</p>
            <p><strong>Characteristics:</strong> Industrializing, infrastructure expansion, rising middle class</p>
          </div>
                </div>

        <div className="p-5 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="px-3 py-1 bg-amber-500/30 rounded-full">
              <span className="text-amber-200 font-bold">Developed</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Developed Economy</h3>
          </div>
          <div className="space-y-2 text-slate-700 dark:text-slate-200">
            <p><strong>GDP per Capita:</strong> $25,000 – $34,999</p>
            <p><strong>Max Growth Cap:</strong> 5% annually</p>
            <p><strong>Characteristics:</strong> Diversified economy, services strength, strong infrastructure</p>
          </div>
                </div>

        <div className="p-5 bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="px-3 py-1 bg-emerald-500/30 rounded-full">
              <span className="text-emerald-200 font-bold">Healthy</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Healthy High-Income Economy</h3>
          </div>
          <div className="space-y-2 text-slate-700 dark:text-slate-200">
            <p><strong>GDP per Capita:</strong> $35,000 – $44,999</p>
            <p><strong>Max Growth Cap:</strong> 3.5% annually</p>
            <p><strong>Characteristics:</strong> Advanced services, strong infrastructure, knowledge economy</p>
          </div>
                </div>

        <div className="p-5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="px-3 py-1 bg-blue-500/30 rounded-full">
              <span className="text-blue-200 font-bold">Strong</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Strong High-Income Economy</h3>
          </div>
          <div className="space-y-2 text-slate-700 dark:text-slate-200">
            <p><strong>GDP per Capita:</strong> $45,000 – $54,999</p>
            <p><strong>Max Growth Cap:</strong> 2.75% annually</p>
            <p><strong>Characteristics:</strong> Mature markets, innovation and finance hubs</p>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 border border-indigo-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="px-3 py-1 bg-indigo-500/30 rounded-full">
              <span className="text-indigo-200 font-bold">Very Strong</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Very Strong Economy</h3>
          </div>
          <div className="space-y-2 text-slate-700 dark:text-slate-200">
            <p><strong>GDP per Capita:</strong> $55,000 – $64,999</p>
            <p><strong>Max Growth Cap:</strong> 1.5% annually</p>
            <p><strong>Characteristics:</strong> Highly developed, cutting-edge technology and services</p>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="px-3 py-1 bg-purple-500/30 rounded-full">
              <span className="text-purple-200 font-bold">Extravagant</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Extravagant Economy</h3>
          </div>
          <div className="space-y-2 text-slate-700 dark:text-slate-200">
            <p><strong>GDP per Capita:</strong> $65,000+</p>
            <p><strong>Max Growth Cap:</strong> 0.5% annually</p>
            <p><strong>Characteristics:</strong> Innovation leaders with very high living standards; diminishing returns apply</p>
          </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">How Tiers Affect Your Economy</h2>

              <div className="grid gap-4">
                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Growth Projections</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Lower tiers have higher growth potential but more volatility. Higher tiers show steady but slower growth, reflecting real-world economic patterns.
                  </p>
                </div>

                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <Target className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Development Goals</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Moving between tiers requires sustained economic performance, infrastructure investment, and policy improvements—not just hitting a GDP number.
                  </p>
                </div>

                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    <h3 className="text-slate-900 dark:text-white font-semibold">Economic Complexity</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Higher tiers unlock access to more sophisticated economic models, advanced industries, and complex financial instruments.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Advancing Through Tiers</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Economic advancement happens through:
              </p>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Sustained GDP Growth:</strong> Maintaining growth over multiple IxTime years</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Infrastructure Development:</strong> Building transportation, education, healthcare systems</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Trade Expansion:</strong> Increasing export complexity and trade relationships</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Policy Reforms:</strong> Implementing effective governance and economic policies</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  <span><strong className="text-slate-900 dark:text-white">Human Capital:</strong> Investing in education, skills training, and innovation</span>
                </li>
              </ul>
            </section>

            <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-lg p-4">
              <h3 className="text-amber-900 dark:text-amber-300 font-semibold mb-2">Strategy Tip</h3>
              <p className="text-amber-800 dark:text-amber-100/80 text-sm">
                Don't rush to higher tiers. Each tier offers unique opportunities and challenges. Build a strong foundation at your current tier before advancing to ensure stable, sustainable growth.
              </p>
            </div>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2>
              <div className="grid gap-3">
                <Link
                  href="/help/economy/calculations"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Economic Calculations Explained</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/help/economy/modeling"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Economic Modeling & Projections</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>

          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/help"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Back to Help Center
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
