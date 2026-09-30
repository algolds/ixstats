import React from "react";
import Link from "next/link";
import { type Metadata } from "next";
import { Book, Archery as Target, Crown, Coins, Globe } from "iconoir-react";
import { HelpExplorer } from "./_components/HelpExplorer";

export const metadata: Metadata = {
  title: "Help Center - IxStats",
  description:
    "Guides to every part of IxStats: building a nation, MyCountry, the Vault, maps, the wiki and the community.",
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
            Plain guides to every part of IxStats. Search below or pick a topic. New here? Start
            with{" "}
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
            className="group border-border/60 bg-card hover:border-border hover:bg-accent/30 flex items-center gap-3 rounded-xl border p-4 shadow-xs transition-colors active:scale-[0.99]"
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
            className="group border-border/60 bg-card hover:border-border hover:bg-accent/30 flex items-center gap-3 rounded-xl border p-4 shadow-xs transition-colors active:scale-[0.99]"
          >
            <Crown className="h-7 w-7 text-amber-500 transition-transform group-hover:scale-105" />
            <div>
              <div className="text-foreground text-sm font-semibold">Build a Nation</div>
              <div className="text-muted-foreground text-xs">Your first country</div>
            </div>
          </Link>

          <Link
            href="/help/mycountry/overview"
            data-cuelume-press="tick"
            className="group border-border/60 bg-card hover:border-border hover:bg-accent/30 flex items-center gap-3 rounded-xl border p-4 shadow-xs transition-colors active:scale-[0.99]"
          >
            <Globe className="h-7 w-7 text-indigo-500 transition-transform group-hover:scale-105" />
            <div>
              <div className="text-foreground text-sm font-semibold">Run Your Nation</div>
              <div className="text-muted-foreground text-xs">MyCountry overview</div>
            </div>
          </Link>

          <Link
            href="/help/vault/ixcredits"
            data-cuelume-press="tick"
            className="group border-border/60 bg-card hover:border-border hover:bg-accent/30 flex items-center gap-3 rounded-xl border p-4 shadow-xs transition-colors active:scale-[0.99]"
          >
            <Coins className="h-7 w-7 text-emerald-500 transition-transform group-hover:scale-105" />
            <div>
              <div className="text-foreground text-sm font-semibold">IxCredits</div>
              <div className="text-muted-foreground text-xs">Earning & the daily reward</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
