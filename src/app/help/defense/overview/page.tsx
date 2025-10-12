"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Users, Wrench, Target, TrendingUp, ChevronRight, AlertTriangle } from "lucide-react";



export default function DefenseOverviewPage() {
  useEffect(() => {
    document.title = "Defense Overview - Help Center";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/help"
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Help Center
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Defense System Overview</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Comprehensive military management and national security
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Introduction</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                The IxStats Defense System provides a comprehensive framework for managing your nation's military forces, security apparatus, and internal stability. From organizing military branches to tracking security threats and managing defense budgets, this system integrates seamlessly with your country's government and economic systems.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Core Components</h2>

              <div className="space-y-4">
                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-3">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Military Branches</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 mb-2">
                    Organize your armed forces into distinct branches (Army, Navy, Air Force, Marines, etc.). Each branch can be customized with:
                  </p>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 text-sm">
                    <li>• Personnel counts and active duty status</li>
                    <li>• Branch-specific budgets and funding</li>
                    <li>• Military units and force structure</li>
                    <li>• Equipment and assets</li>
                  </ul>
                </div>

                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-3">
                    <Wrench className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Units & Assets</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 mb-2">
                    Manage your military capabilities with detailed unit and asset tracking:
                  </p>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 text-sm">
                    <li>• <strong>Units:</strong> Infantry divisions, tank battalions, fighter squadrons, naval fleets</li>
                    <li>• <strong>Assets:</strong> Aircraft, ships, vehicles, weapon systems, installations</li>
                    <li>• <strong>Images:</strong> Automatic integration with Wikimedia Commons for realistic visuals</li>
                    <li>• <strong>Status:</strong> Active, reserve, maintenance, or decommissioned</li>
                  </ul>
                </div>

                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-3">
                    <Target className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Internal Stability</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 mb-2">
                    Monitor and manage your nation's internal security with sophisticated stability metrics:
                  </p>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 text-sm">
                    <li>• <strong>Crime Rates:</strong> Violent crime, property crime, organized crime tracking</li>
                    <li>• <strong>Social Unrest:</strong> Protest frequency, riot risk, civil disobedience levels</li>
                    <li>• <strong>Law Enforcement:</strong> Policing effectiveness and justice system efficiency</li>
                    <li>• <strong>Trust Metrics:</strong> Trust in government, police, and social cohesion</li>
                  </ul>
                </div>

                <div className="p-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <div className="flex gap-3 mb-3">
                    <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Defense Budget</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 mb-2">
                    Integrated budget management with automatic synchronization:
                  </p>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 text-sm">
                    <li>• <strong>Government Integration:</strong> Bidirectional sync with your government budget system</li>
                    <li>• <strong>GDP Tracking:</strong> Automatic calculation of defense spending as % of GDP</li>
                    <li>• <strong>Budget Breakdown:</strong> Personnel (40%), Operations (30%), Procurement (15%), R&D (10%), Construction (5%)</li>
                    <li>• <strong>Multi-Department:</strong> Supports Defense, Veterans Affairs, and Intelligence departments</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">How Stability Calculations Work</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                The stability system uses complex algorithms that factor in multiple aspects of your country:
              </p>

              <div className="bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg p-4 mb-4">
                <h3 className="text-slate-900 dark:text-white font-semibold mb-2">Key Factors:</h3>
                <ul className="space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                  <li>• <strong>Economic Health:</strong> GDP per capita, unemployment rate, income inequality</li>
                  <li>• <strong>Population Dynamics:</strong> Population density affects crime and social tension</li>
                  <li>• <strong>Political Climate:</strong> Government stability, public approval, political polarization</li>
                  <li>• <strong>Law & Order:</strong> Policing effectiveness, justice system efficiency</li>
                  <li>• <strong>Social Factors:</strong> Social cohesion, ethnic tensions, trust in institutions</li>
                </ul>
              </div>

              <p className="text-slate-700 dark:text-slate-300 text-sm">
                These factors combine to produce real-time stability scores, crime statistics, and social unrest predictions that help you understand your nation's internal security situation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Security Threats</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Track and manage security threats to your nation, from terrorism to cyber attacks. Each threat can be categorized by:
              </p>
              <ul className="space-y-1 text-slate-700 dark:text-slate-300 mt-2">
                <li>• <strong>Type:</strong> Terrorism, espionage, cyber warfare, insurgency, border incursions</li>
                <li>• <strong>Severity:</strong> Low, medium, high, critical threat levels</li>
                <li>• <strong>Status:</strong> Active, monitoring, resolved, escalating</li>
                <li>• <strong>Response:</strong> Assign resources and track mitigation efforts</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Integration with Other Systems</h2>
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-1">Government Builder</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Defense budgets automatically sync with your government's defense-related departments. Changes in either system update both seamlessly.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-1">Economic System</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Defense spending is calculated as a percentage of GDP, and economic indicators directly impact stability calculations.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-1">Intelligence Dashboard</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    Security metrics and stability data feed into your executive intelligence dashboard for comprehensive oversight.
                  </p>
                </div>
              </div>
            </section>

            <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-amber-900 dark:text-amber-300 font-semibold mb-1">Best Practices</h3>
                  <ul className="text-amber-800 dark:text-amber-100/80 text-sm space-y-1">
                    <li>• Maintain defense spending between 2-5% of GDP for stability</li>
                    <li>• Balance military branches based on your country's geography and threats</li>
                    <li>• Monitor stability metrics regularly to prevent social unrest</li>
                    <li>• Customize unit names and assets to reflect your nation's character</li>
                  </ul>
                </div>
              </div>
            </div>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Next Steps</h2>
              <div className="grid gap-3">
                <Link
                  href="/help/defense/units"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Military Units & Assets</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/help/defense/stability"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Political Stability Management</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/help/defense/customization"
                  className="group flex items-center justify-between p-4 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-all"
                >
                  <span className="text-slate-900 dark:text-white font-medium">Force Customization</span>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>

          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/help"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Back to Help Center
          </Link>
          <Link
            href="/help/defense/units"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Next: Military Units & Assets →
          </Link>
        </div>
      </div>
    </div>
  );
}
