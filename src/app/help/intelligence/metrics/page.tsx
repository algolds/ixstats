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
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Key Metrics & Indicators</h2>
            <p className="text-slate-700 dark:text-slate-300">Definitions and calculations used across the Intelligence suite.</p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">GDP</h3>
            <p className="text-slate-700 dark:text-slate-300">Total economic output. Formula: <span className="font-mono">Population × GDP per Capita</span>.</p>
          </section>
          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">GDP per Capita</h3>
            <p className="text-slate-700 dark:text-slate-300">Average economic output per person. Growth is capped by tier; diminishing returns apply above $60,000.</p>
          </section>
          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">GDP Growth</h3>
            <p className="text-slate-700 dark:text-slate-300">Year-over-year change in GDP. Formula: <span className="font-mono">((Current − Previous) / Previous) × 100</span>, bounded by tier caps.</p>
          </section>
          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Inflation (Model)</h3>
            <p className="text-slate-700 dark:text-slate-300">Derived from growth dynamics and stability targets; affects real GDP adjustments.</p>
          </section>
          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Unemployment (Model)</h3>
            <p className="text-slate-700 dark:text-slate-300">Estimated using labor force participation, job creation, and tier-specific structure.</p>
          </section>
          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Trade Balance</h3>
            <p className="text-slate-700 dark:text-slate-300">Exports − Imports, expressed as % of GDP. Positive balance supports GDP growth.</p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Composite Indices</h3>
            <ul className="space-y-1 text-slate-700 dark:text-slate-300">
              <li>• <strong>ERI</strong> (Resilience): Fiscal, monetary, structural, social cohesion.</li>
              <li>• <strong>PII</strong> (Productivity & Innovation): Labor productivity, capital, tech, entrepreneurship.</li>
              <li>• <strong>SEWI</strong> (Wellbeing): Living standards, healthcare, education, mobility.</li>
              <li>• <strong>ECTI</strong> (Complexity & Trade): Export diversity, value chains, finance, regulation.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Update Cadence</h3>
            <p className="text-slate-700 dark:text-slate-300">Metrics update on IxTime (2x). Historical tracking uses IxTime quarters/years.</p>
          </section>
        </div></div>
      </div>
    </div>
  );
}
