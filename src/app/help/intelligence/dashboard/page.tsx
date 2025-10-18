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
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Executive Command Center</h2>
            <p className="text-slate-700 dark:text-slate-300">Your country's single pane of glass for performance, risks, and opportunities. The dashboard updates on IxTime cadence and aggregates data from economy, diplomacy, defense, and social systems.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Sections</h2>
            <ul className="space-y-2 text-slate-700 dark:text-slate-300">
              <li>• <strong className="text-slate-900 dark:text-white">National Performance:</strong> GDP, GDP per capita, growth momentum, unemployment, inflation, trade balance.</li>
              <li>• <strong className="text-slate-900 dark:text-white">Intelligence Briefings:</strong> Actionable items grouped by Hot Issues, Opportunities, Risk Mitigation, Strategic Initiatives.</li>
              <li>• <strong className="text-slate-900 dark:text-white">Forward-Looking Intelligence:</strong> Forecasts (6m/1y/2y), milestones, and scenario comparisons.</li>
              <li>• <strong className="text-slate-900 dark:text-white">Alerts:</strong> Real-time threshold breaches with deduplication and priority levels.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Update Cadence (IxTime)</h2>
            <p className="text-slate-700 dark:text-slate-300">All calculations run in IxTime (2x real time). Quarterly and yearly aggregates are aligned to IxTime quarters/years. Forecasts respect tier caps and diminishing returns for GDP/capita above $60,000.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Data Sources</h2>
            <ul className="space-y-2 text-slate-700 dark:text-slate-300">
              <li>• tRPC endpoints (31 routers/304 endpoints) for live data</li>
              <li>• Economic engine with tier-based growth and historical tracking</li>
              <li>• Diplomatic systems (embassies, missions, cultural exchanges)</li>
              <li>• Defense stability and readiness metrics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Where to Access</h2>
            <p className="text-slate-700 dark:text-slate-300">Open <strong>MyCountry → Intelligence</strong>. Use the timeframe and scenario toggles to switch between baselines and projections.</p>
          </section>
        </div></div>
      </div>
    </div>
  );
}
