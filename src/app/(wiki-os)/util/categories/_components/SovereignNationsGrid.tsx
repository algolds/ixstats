"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Globe as IconoirGlobe } from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { formatNumber, formatCurrency } from "~/lib/utils/format-utils";

interface SovereignNationsGridProps {
  countries: any[];
  searchQuery: string;
}

export function SovereignNationsGrid({ countries, searchQuery }: SovereignNationsGridProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {countries.map((country: any) => (
          <Link
            key={country.id}
            href={withBasePath(
              `/wiki/categories/${encodeURIComponent((country.name ?? "").replace(/ /g, "_"))}`
            )}
            className={cn(
              "group relative flex items-center gap-3 overflow-hidden rounded-xl p-3",
              "border border-white/20 dark:border-white/10",
              "bg-white/60 backdrop-blur-md dark:bg-zinc-900/60",
              "shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.25)]",
              "hover:border-emerald-500/40 hover:bg-white/90 hover:shadow-md dark:hover:bg-zinc-900/90",
              "transition-all duration-200 active:scale-[0.98]"
            )}
          >
            {country.flagUrl ? (
              <img
                src={country.flagUrl}
                alt=""
                className="border-border/60 h-7 w-11 shrink-0 rounded border object-cover"
                loading="lazy"
              />
            ) : (
              <IconoirGlobe className="text-muted-foreground h-6 w-6 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-foreground truncate text-xs font-semibold transition-colors group-hover:text-emerald-500">
                {country.name}
              </div>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate font-mono text-[10px] tabular-nums">
                {country.population ? <span>Pop {formatNumber(country.population, 1)}</span> : null}
                {country.population && country.gdp ? <span className="opacity-40">·</span> : null}
                {country.gdp ? <span>{formatCurrency(country.gdp)}</span> : null}
              </div>
            </div>
            <ArrowRight className="text-muted-foreground/50 group-hover:text-foreground h-3.5 w-3.5 shrink-0 transition-colors" />
          </Link>
        ))}
      </div>

      {countries.length === 0 && (
        <div className="text-muted-foreground py-12 text-center text-sm">
          No nations matching &quot;{searchQuery}&quot;.
        </div>
      )}
    </div>
  );
}
