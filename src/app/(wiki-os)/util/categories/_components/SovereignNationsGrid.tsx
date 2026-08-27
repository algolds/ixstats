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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {countries.map((country: any) => (
          <Link
            key={country.id}
            href={withBasePath(
              `/wiki/categories/${encodeURIComponent((country.name ?? "").replace(/ /g, "_"))}`
            )}
            className={cn(
              "group relative overflow-hidden flex items-center gap-3 p-3 rounded-xl",
              "border border-white/20 dark:border-white/10",
              "bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md",
              "shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.25)]",
              "hover:border-emerald-500/40 hover:bg-white/90 dark:hover:bg-zinc-900/90 hover:shadow-md",
              "transition-all duration-200 active:scale-[0.98]"
            )}
          >
            {country.flagUrl ? (
              <img
                src={country.flagUrl}
                alt=""
                className="h-7 w-11 object-cover rounded border border-border/60 shrink-0"
                loading="lazy"
              />
            ) : (
              <IconoirGlobe className="h-6 w-6 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground truncate group-hover:text-emerald-500 transition-colors">
                {country.name}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mt-0.5 tabular-nums truncate">
                {country.population ? <span>Pop {formatNumber(country.population, 1)}</span> : null}
                {country.population && country.gdp ? <span className="opacity-40">·</span> : null}
                {country.gdp ? <span>{formatCurrency(country.gdp)}</span> : null}
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
          </Link>
        ))}
      </div>

      {countries.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No nations matching &quot;{searchQuery}&quot;.
        </div>
      )}
    </div>
  );
}
