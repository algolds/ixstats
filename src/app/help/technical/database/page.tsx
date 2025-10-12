"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Database, ChevronRight } from "lucide-react";
export default function DatabasePage() {
  useEffect(() => { document.title = "Database Schema - Help Center"; }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/help" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-6 transition-colors"><ArrowLeft className="w-4 h-4" />Back to Help Center</Link>
        <div className="mb-8"><div className="flex items-center gap-3 mb-4"><Database className="w-8 h-8 text-blue-600 dark:text-blue-400" /><h1 className="text-4xl font-bold text-slate-900 dark:text-white">Database Schema</h1></div><p className="text-xl text-slate-600 dark:text-slate-300">Prisma ORM with 50+ models</p></div>
        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none"><div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">
          <section><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Schema Overview</h2><p className="text-slate-700 dark:text-slate-300 leading-relaxed">IxStats database uses Prisma ORM with comprehensive schema covering all platform features. Over 50 models handle countries, economics, government, intelligence, diplomacy, and social features.</p></section>
          <section><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Core Models</h2><ul className="space-y-2 text-slate-700 dark:text-slate-300"><li>• <strong>Country:</strong> Nation data with 100+ fields including economics, demographics, government</li><li>• <strong>User:</strong> User profiles, roles, preferences</li><li>• <strong>Government:</strong> Traditional and atomic government structures</li><li>• <strong>AtomicComponent:</strong> 24 modular government components</li><li>• <strong>EconomicData:</strong> Historical economic metrics and projections</li><li>• <strong>DiplomaticRelation:</strong> Bilateral relationships and treaties</li><li>• <strong>ThinkPage:</strong> Social platform content</li><li>• <strong>Intelligence:</strong> Real-time intelligence data</li></ul></section>
          <section><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Database Features</h2><ul className="space-y-2 text-slate-700 dark:text-slate-300"><li>• Comprehensive indexing for query performance</li><li>• Foreign key constraints for data integrity</li><li>• Migration system for schema evolution</li><li>• SQLite (dev) and PostgreSQL (prod) support</li></ul></section>
          <section><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2><div className="grid gap-3"><Link href="/help/technical/design-system" className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"><span className="text-slate-900 dark:text-white font-medium">Glass Physics Design System</span><ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" /></Link></div></section>
        </div></div>
        <div className="mt-8 flex justify-between items-center"><Link href="/help/technical/api" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">← Previous: API</Link><Link href="/help/technical/design-system" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">Next: Design System →</Link></div>
      </div>
    </div>
  );
}
