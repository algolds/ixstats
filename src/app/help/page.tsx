import React from "react";
import Link from "next/link";
import { type Metadata } from "next";
import { Book, Archery as Target, Crown, Coins, Gamepad as Gamepad2 } from "iconoir-react";
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
            data-cuelume-press="tick"
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-xs transition-colors hover:border-border hover:bg-accent/30 active:scale-[0.99]"
          >
            <Target className="h-7 w-7 text-blue-500 transition-transform group-hover:scale-105" />
            <div>
              <div className="text-foreground text-sm font-semibold">New to IxStats?</div>
              <div className="text-muted-foreground text-xs">Start here</div>
            </div>
          </Link>

          <Link
            href="/help/getting-started/first-country"
            data-cuelume-press="tick"
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-xs transition-colors hover:border-border hover:bg-accent/30 active:scale-[0.99]"
          >
            <Crown className="h-7 w-7 text-amber-500 transition-transform group-hover:scale-105" />
            <div>
              <div className="text-foreground text-sm font-semibold">Build a Nation</div>
              <div className="text-muted-foreground text-xs">Your first country</div>
            </div>
          </Link>

          <Link
            href="/help/getting-started/gameplay-overview"
            data-cuelume-press="tick"
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-xs transition-colors hover:border-border hover:bg-accent/30 active:scale-[0.99]"
          >
            <Gamepad2 className="h-7 w-7 text-indigo-500 transition-transform group-hover:scale-105" />
            <div>
              <div className="text-foreground text-sm font-semibold">How It Works</div>
              <div className="text-muted-foreground text-xs">The big picture</div>
            </div>
          </Link>

          <Link
            href="/help/vault/overview"
            data-cuelume-press="tick"
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-xs transition-colors hover:border-border hover:bg-accent/30 active:scale-[0.99]"
          >
            <Coins className="h-7 w-7 text-emerald-500 transition-transform group-hover:scale-105" />
            <div>
              <div className="text-foreground text-sm font-semibold">Cards & Vault</div>
              <div className="text-muted-foreground text-xs">Collect & trade</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
