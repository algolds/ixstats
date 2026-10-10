"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Globe as IconoirGlobe } from "iconoir-react";
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
            href={`/util/categories/${encodeURIComponent((country.name ?? "").replace(/ /g, "_"))}`}
            className={cn(
              "group rounded-row relative flex items-center gap-3 overflow-hidden p-3",
              "border-separator border",
              "bg-surface",
              "",
              "hover:border-green/40 hover:bg-surface hover:shadow-card",
              "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 active:scale-[0.98]"
            )}
          >
            {country.flagUrl ? (
              <img
                src={country.flagUrl}
                alt=""
                className="border-separator rounded-control-sm h-7 w-11 shrink-0 border object-cover"
                loading="lazy"
              />
            ) : (
              <IconoirGlobe className="text-label-secondary h-6 w-6 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-label text-caption group-hover:text-green truncate font-semibold transition-colors">
                {country.name}
              </div>
              <div className="text-label-secondary text-footnote mt-0.5 flex items-center gap-2 truncate tabular-nums">
                {country.population ? <span>Pop {formatNumber(country.population, 1)}</span> : null}
                {country.population && country.gdp ? <span className="opacity-40">·</span> : null}
                {country.gdp ? <span>{formatCurrency(country.gdp)}</span> : null}
              </div>
            </div>
            <ArrowRight className="text-label-secondary group-hover:text-label h-3.5 w-3.5 shrink-0 transition-colors" />
          </Link>
        ))}
      </div>

      {countries.length === 0 && (
        <div className="text-label-secondary text-body py-12 text-center">
          No nations matching &quot;{searchQuery}&quot;.
        </div>
      )}
    </div>
  );
}
