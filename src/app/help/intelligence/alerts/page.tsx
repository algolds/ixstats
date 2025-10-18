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
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Alerts & Notifications</h2>
            <p className="text-slate-700 dark:text-slate-300">Real-time signals for thresholds, anomalies, and events across economy, diplomacy, defense, and social systems.</p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Priority Levels</h3>
            <ul className="space-y-1 text-slate-700 dark:text-slate-300">
              <li>• <strong>Critical</strong>: Immediate action recommended (e.g., crisis, severe instability).</li>
              <li>• <strong>High</strong>: Significant impact; schedule mitigation or policy response.</li>
              <li>• <strong>Medium</strong>: Monitor and plan; watch for trend confirmation.</li>
              <li>• <strong>Low</strong>: Informational; minor deviations or routine updates.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Deduplication & Rate Limiting</h3>
            <p className="text-slate-700 dark:text-slate-300">Alerts are deduped and rate-limited to avoid spam. Related events are clustered into a single briefing entry with context.</p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Common Triggers</h3>
            <ul className="space-y-1 text-slate-700 dark:text-slate-300">
              <li>• Economic: Growth below tier floor, inflation spike, trade deficit widening.</li>
              <li>• Diplomacy: Embassy downgrade, failed mission, treaty violation indicators.</li>
              <li>• Defense: Stability threshold breach, readiness drop, crisis flag.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Actions</h3>
            <p className="text-slate-700 dark:text-slate-300">From the alert, jump to the relevant module (economy policy, embassy management, defense settings) to respond. Acknowledge to silence duplicates during resolution.</p>
          </section>
        </div></div>
      </div>
    </div>
  );
}
