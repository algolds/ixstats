import { BarChart3, Crown, Globe, Building } from "lucide-react";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";

interface QuickActionsSectionProps {
  setupStatus: "loading" | "unauthenticated" | "needs-setup" | "complete";
  countryId?: string;
  countrySlug?: string;
}

export function QuickActionsSection({
  setupStatus,
  countryId,
  countrySlug,
}: QuickActionsSectionProps) {
  return (
    <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
            <Globe className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Quick Access</h3>
        </div>
        
        <div className="space-y-2">
          <Link
            href={"/dashboard"}
            className="glass-interactive group flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            <BarChart3 className="mr-3 h-4 w-4 text-indigo-500 transition-transform group-hover:scale-110" />
            Global Dashboard
          </Link>

          {setupStatus === "complete" && countryId && (
            <Link
              href={createUrl(`/countries/${countrySlug || countryId}`)}
              className="glass-interactive group flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
            >
              <Crown className="mr-3 h-4 w-4 text-amber-500 transition-transform group-hover:scale-110" />
              Sovereign Domain
            </Link>
          )}

          <Link
            href={"/explore"}
            className="glass-interactive group flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            <Globe className="mr-3 h-4 w-4 text-emerald-500 transition-transform group-hover:scale-110" />
            Global Exploration
          </Link>

          <Link
            href={"/builder"}
            className="glass-interactive group flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            <Building className="mr-3 h-4 w-4 text-blue-500 transition-transform group-hover:scale-110" />
            Industrial Builder
          </Link>
        </div>
      </div>
    </div>
  );
}
