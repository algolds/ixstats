import React from "react";
import Link from "next/link";
import { type Metadata } from "next";
import {
  Book,
  Target,
  Crown,
  Coins,
  Gamepad2,
} from "lucide-react";
import { HelpExplorer } from "./_components/HelpExplorer";

export const metadata: Metadata = {
  title: "Help Center - IxStats",
  description:
    "Everything you need to build a nation and bring it to life in a shared, living world.",
};

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-black/20">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-3 flex items-center gap-3">
            <Book className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Help Center</h1>
          </div>
          <p className="max-w-2xl text-slate-600 dark:text-slate-300">
            Everything you need to build a nation and bring it to life. New here? Start with{" "}
            <Link
              href="/help/getting-started/welcome"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Welcome to IxStats
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Interactive Explorer */}
        <HelpExplorer />

        {/* Quick Links Footer */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/help/getting-started/welcome"
            className="group flex items-center gap-3 rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-4 transition-all hover:border-blue-400/50"
          >
            <Target className="h-8 w-8 text-blue-600 transition-transform group-hover:scale-110 dark:text-blue-400" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">New to IxStats?</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">Start here</div>
            </div>
          </Link>

          <Link
            href="/help/getting-started/first-country"
            className="group flex items-center gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 p-4 transition-all hover:border-amber-400/50"
          >
            <Crown className="h-8 w-8 text-amber-600 transition-transform group-hover:scale-110 dark:text-amber-400" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Build a Nation</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">Your first country</div>
            </div>
          </Link>

          <Link
            href="/help/getting-started/gameplay-overview"
            className="group flex items-center gap-3 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-4 transition-all hover:border-purple-400/50"
          >
            <Gamepad2 className="h-8 w-8 text-purple-600 transition-transform group-hover:scale-110 dark:text-purple-400" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">How It Works</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">The big picture</div>
            </div>
          </Link>

          <Link
            href="/help/vault/overview"
            className="group flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-4 transition-all hover:border-emerald-400/50"
          >
            <Coins className="h-8 w-8 text-emerald-600 transition-transform group-hover:scale-110 dark:text-emerald-400" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Cards & Vault</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">Collect & trade</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
