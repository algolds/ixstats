"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Users, Scale, Shield, ChevronRight } from "lucide-react";

export default function TraditionalGovernmentPage() {
  useEffect(() => {
    document.title = "Traditional Government - Help Center";
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
            <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Traditional Government System</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">Classic government structures and conventional political systems</p>
        </div>
        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">What is Traditional Government?</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">The traditional government builder allows you to create conventional political structures using established government types: democracy, monarchy, republic, theocracy, and more. This system is ideal for nations modeling real-world governance.</p>
            </section>
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Government Types</h2>
              <div className="space-y-3">
                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-2">Democracy</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">Representative government with elected officials, separation of powers, civil liberties</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-2">Republic</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">Constitutional governance with elected representatives, rule of law, limited government</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-2">Monarchy</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">Hereditary rule (constitutional or absolute), traditional authority structures</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-2">Federal System</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">Power divided between central and regional governments, autonomous provinces</p>
                </div>
              </div>
            </section>
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Key Components</h2>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2"><span className="text-blue-600 dark:text-blue-400">•</span><span><strong className="text-slate-900 dark:text-white">Executive Branch:</strong> President, Prime Minister, Monarch, Cabinet</span></li>
                <li className="flex gap-2"><span className="text-blue-600 dark:text-blue-400">•</span><span><strong className="text-slate-900 dark:text-white">Legislative Branch:</strong> Parliament, Congress, Senate, Assembly</span></li>
                <li className="flex gap-2"><span className="text-blue-600 dark:text-blue-400">•</span><span><strong className="text-slate-900 dark:text-white">Judicial Branch:</strong> Courts, Supreme Court, Legal System</span></li>
                <li className="flex gap-2"><span className="text-blue-600 dark:text-blue-400">•</span><span><strong className="text-slate-900 dark:text-white">Administrative Structure:</strong> Ministries, Departments, Agencies</span></li>
              </ul>
            </section>
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2>
              <div className="grid gap-3">
                <Link href="/help/government/atomic" className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all">
                  <span className="text-slate-900 dark:text-white font-medium">Atomic Government System</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>
          </div>
        </div>
        <div className="mt-8 flex justify-between items-center">
          <Link href="/help/economy/trade" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">← Previous: International Trade</Link>
          <Link href="/help/government/atomic" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">Next: Atomic Government →</Link>
        </div>
      </div>
    </div>
  );
}
