"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Globe, ChevronRight } from "lucide-react";
export default function DiplomacyPage() {
  useEffect(() => { document.title = "Diplomacy - Help Center"; }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/help" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-6 transition-colors"><ArrowLeft className="w-4 h-4" />Back to Help Center</Link>
        <div className="mb-8"><div className="flex items-center gap-3 mb-4"><Globe className="w-8 h-8 text-blue-600 dark:text-blue-400" /><h1 className="text-4xl font-bold text-slate-900 dark:text-white">Diplomatic Systems</h1></div></div>
        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none"><div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">
          <section><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">International Relations</h2><p className="text-slate-700 dark:text-slate-300">Build diplomatic relationships through embassy networks, conduct diplomatic missions, and engage in cultural exchange programs with other nations.</p></section>
          <section><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Diplomatic Features</h2><ul className="space-y-2 text-slate-700 dark:text-slate-300"><li>• Embassy network establishment and management</li><li>• Diplomatic missions and negotiations</li><li>• Cultural exchange programs</li><li>• Trade agreements and alliances</li></ul></section>
        </div></div>
      </div>
    </div>
  );
}
