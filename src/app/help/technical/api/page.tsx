"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Code, ChevronRight } from "lucide-react";
export default function APIPage() {
  useEffect(() => { document.title = "tRPC API - Help Center"; }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/help" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-6 transition-colors"><ArrowLeft className="w-4 h-4" />Back to Help Center</Link>
        <div className="mb-8"><div className="flex items-center gap-3 mb-4"><Code className="w-8 h-8 text-emerald-600 dark:text-emerald-400" /><h1 className="text-4xl font-bold text-slate-900 dark:text-white">tRPC API Documentation</h1></div><p className="text-xl text-slate-600 dark:text-slate-300">Type-safe API layer with 22 routers</p></div>
        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none"><div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">
          <section><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">API Overview</h2><p className="text-slate-700 dark:text-slate-300 leading-relaxed">IxStats uses tRPC for end-to-end type-safe API communication. All 22 routers provide type-checked procedures for data fetching, mutations, and subscriptions.</p></section>
          <section><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Available Routers</h2><ul className="space-y-2 text-slate-700 dark:text-slate-300"><li>• <strong>countries:</strong> Country CRUD operations and queries</li><li>• <strong>economics:</strong> Economic calculations and projections</li><li>• <strong>government:</strong> Government system management</li><li>• <strong>atomicGovernment:</strong> Atomic component operations</li><li>• <strong>intelligence:</strong> Intelligence dashboard data</li><li>• <strong>diplomatic:</strong> Diplomatic relations and missions</li><li>• <strong>security:</strong> Defense and stability operations</li><li>• <strong>thinkpages:</strong> Social platform content</li><li>• <strong>users:</strong> User profile and preferences</li><li>• <strong>admin:</strong> Administrative operations</li><li>• <strong>eci:</strong> Economic Complexity Index</li><li>• <strong>sdi:</strong> Security Development Index</li><li>• And 10 more specialized routers</li></ul></section>
          <section><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Usage Example</h2><div className="font-mono text-sm bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto">{`const country = api.countries.getBySlug.useQuery({ slug: "your-country" });`}</div></section>
          <section><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2><div className="grid gap-3"><Link href="/help/technical/database" className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"><span className="text-slate-900 dark:text-white font-medium">Database Schema</span><ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" /></Link></div></section>
        </div></div>
        <div className="mt-8 flex justify-between items-center"><Link href="/help/technical/architecture" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">← Previous: Architecture</Link><Link href="/help/technical/database" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">Next: Database →</Link></div>
      </div>
    </div>
  );
}
