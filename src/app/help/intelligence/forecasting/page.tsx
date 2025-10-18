"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Brain, ChevronRight } from "lucide-react";
export default function IntelligencePage() {
  useEffect(() => { document.title = "Intelligence - Help Center"; }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/help" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-6 transition-colors"><ArrowLeft className="w-4 h-4" />Back to Help Center</Link>
        <div className="mb-8"><div className="flex items-center gap-3 mb-4"><Brain className="w-8 h-8 text-indigo-600 dark:text-indigo-400" /><h1 className="text-4xl font-bold text-slate-900 dark:text-white">Intelligence System</h1></div></div>
        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none"><div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Forecasting & Predictions</h2>
            <p className="text-slate-700 dark:text-slate-300">Forward-looking projections for GDP, GDP/capita, and key indicators over 6 months, 1 year, and 2 years (IxTime).</p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Methodology</h3>
            <p className="text-slate-700 dark:text-slate-300">Projections use compound growth with tier caps and diminishing returns above $60,000 GDP/capita.</p>
            <div className="font-mono text-sm bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto">Future Value = Present Value × (1 + growth_rate)^years</div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Horizon Options</h3>
            <ul className="space-y-1 text-slate-700 dark:text-slate-300">
              <li>• 6 months: near-term momentum and risk signals</li>
              <li>• 1 year: annual planning and budget guidance</li>
              <li>• 2 years: medium-term strategy and milestones</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Scenario Controls</h3>
            <p className="text-slate-700 dark:text-slate-300">Adjust policy levers (tax rates, infrastructure, trade openness) to compare optimistic, realistic, and pessimistic outcomes.</p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Limitations</h3>
            <p className="text-slate-700 dark:text-slate-300">Forecasts assume stable conditions; shocks and policy changes can alter trajectories. Use as planning inputs, not guarantees.</p>
          </section>
        </div></div>
      </div>
    </div>
  );
}
