"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Ship, Globe, TrendingUp, Scale, ChevronRight, Info } from "lucide-react";

export default function TradePage() {
  useEffect(() => {
    document.title = "International Trade - Help Center";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/help" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Help Center
        </Link>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Ship className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">International Trade</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">Understanding imports, exports, and trade balance</p>
        </div>
        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Trade System Overview</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">IxStats simulates international trade relationships between nations. Your exports and imports directly impact GDP growth, currency strength, and economic development. Trade balance (exports minus imports) is a key economic indicator tracked on your dashboard.</p>
            </section>
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Trade Balance Formula</h2>
              <div className="font-mono text-sm bg-slate-900 text-blue-400 p-4 rounded-lg overflow-x-auto mb-4">Trade Balance = Total Exports - Total Imports</div>
              <p className="text-slate-700 dark:text-slate-300 text-sm">Expressed as percentage of GDP. Positive balance (surplus) adds to GDP growth. Negative balance (deficit) reduces growth but may indicate investment and development.</p>
            </section>
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Trade Partners</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">Establish trade relationships with other nations through diplomatic channels. Trade agreements can include:</p>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400">•</span><span><strong className="text-slate-900 dark:text-white">Free Trade Agreements:</strong> Reduced tariffs, increased trade volume</span></li>
                <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400">•</span><span><strong className="text-slate-900 dark:text-white">Preferential Trade:</strong> Favorable terms for specific goods or sectors</span></li>
                <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400">•</span><span><strong className="text-slate-900 dark:text-white">Trade Blocs:</strong> Regional economic integration with multiple partners</span></li>
              </ul>
            </section>
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Export Strategy</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">Higher-tier economies typically export more complex products (technology, services). Lower-tier economies export commodities and manufactured goods. Your economic tier determines export complexity and value-add.</p>
            </section>
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2>
              <div className="grid gap-3">
                <Link href="/help/diplomacy/embassies" className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all">
                  <span className="text-slate-900 dark:text-white font-medium">Embassy Network</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>
          </div>
        </div>
        <div className="mt-8 flex justify-between items-center">
          <Link href="/help/economy/modeling" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">← Previous: Economic Modeling</Link>
          <Link href="/help/government/traditional" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">Next: Government Systems →</Link>
        </div>
      </div>
    </div>
  );
}
