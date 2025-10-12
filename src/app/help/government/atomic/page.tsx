"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Atom, Zap, Blocks, ChevronRight, Info } from "lucide-react";

export default function AtomicGovernmentPage() {
  useEffect(() => {
    document.title = "Atomic Government - Help Center";
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
            <Atom className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Atomic Government System</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">Revolutionary modular governance with 24 building blocks</p>
        </div>
        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">What is Atomic Government?</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">Atomic Government is IxStats' revolutionary system that breaks governance into 24 modular components. Instead of choosing a pre-defined government type, you assemble a custom structure from fundamental building blocks. This enables unprecedented government customization and experimentation.</p>
            </section>
            <div className="bg-purple-50 border border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-purple-900 dark:text-purple-300 font-semibold mb-1">Innovation Hub</h3>
                  <p className="text-purple-800 dark:text-purple-100/80 text-sm">The Atomic Government system is unique to IxStats and allows political configurations impossible in traditional systems.</p>
                </div>
              </div>
            </div>
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Core Principles</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg h-fit"><Blocks className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Modularity</h3>
                    <p className="text-slate-700 dark:text-slate-300">Each component is independent. Mix and match Executive, Legislative, Judicial, Economic, and Social components freely.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="p-2 bg-blue-500/20 rounded-lg h-fit"><Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Synergy Effects</h3>
                    <p className="text-slate-700 dark:text-slate-300">Components interact dynamically. Certain combinations unlock bonuses while others create tensions requiring management.</p>
                  </div>
                </div>
              </div>
            </section>
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Component Categories</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">The 24 atomic components are organized into five categories:</p>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2"><span className="text-purple-600 dark:text-purple-400">•</span><span><strong className="text-slate-900 dark:text-white">Executive Components (6):</strong> Leadership structures and authority models</span></li>
                <li className="flex gap-2"><span className="text-purple-600 dark:text-purple-400">•</span><span><strong className="text-slate-900 dark:text-white">Legislative Components (5):</strong> Law-making and deliberative systems</span></li>
                <li className="flex gap-2"><span className="text-purple-600 dark:text-purple-400">•</span><span><strong className="text-slate-900 dark:text-white">Judicial Components (4):</strong> Legal interpretation and justice systems</span></li>
                <li className="flex gap-2"><span className="text-purple-600 dark:text-purple-400">•</span><span><strong className="text-slate-900 dark:text-white">Economic Components (5):</strong> Economic governance and policy frameworks</span></li>
                <li className="flex gap-2"><span className="text-purple-600 dark:text-purple-400">•</span><span><strong className="text-slate-900 dark:text-white">Social Components (4):</strong> Cultural, religious, and social authority structures</span></li>
              </ul>
            </section>
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Building Your Government</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">Select 3-8 components to create a functional government. More components add complexity but unlock advanced features. The system validates compatibility and suggests synergies.</p>
            </section>
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2>
              <div className="grid gap-3">
                <Link href="/help/government/components" className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all">
                  <span className="text-slate-900 dark:text-white font-medium">24 Atomic Components Explained</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/help/government/synergy" className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all">
                  <span className="text-slate-900 dark:text-white font-medium">Component Synergies</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>
          </div>
        </div>
        <div className="mt-8 flex justify-between items-center">
          <Link href="/help/government/traditional" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">← Previous: Traditional Government</Link>
          <Link href="/help/government/components" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">Next: Atomic Components →</Link>
        </div>
      </div>
    </div>
  );
}
