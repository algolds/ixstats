"use client";

import React from "react";
import { Building, Crown, OpenBook as BookOpen, NavArrowRight as ChevronRight, Shield, Globe } from "iconoir-react";
import { cn } from "~/lib/utils";
import Link from "next/link";
import { createUrl } from "~/lib/utils";

interface StateStructureTreeProps {
  countryName: string;
  headOfState?: string;
  headOfGovernment?: string;
  legislatureName?: string;
  judiciaryName?: string;
  governmentType?: string;
  className?: string;
}

export function StateStructureTree({
  countryName,
  headOfState = "His Imperial Majesty",
  headOfGovernment = "Chancellor of the Imperium",
  legislatureName = "Imperial Assembly (Bicameral)",
  judiciaryName = "High Court of the Realm",
  governmentType = "Constitutional Imperial Monarchy",
  className,
}: StateStructureTreeProps) {
  const branches = [
    {
      title: "Executive Branch",
      subtitle: "Head of State & Government",
      lead: headOfState,
      deputy: headOfGovernment,
      icon: Crown,
      color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
      wikiQuery: `${countryName} Executive Government`,
    },
    {
      title: "Legislative Branch",
      subtitle: "Lawmaking & Budget Authority",
      lead: legislatureName,
      deputy: "Senate & House of Delegates",
      icon: Building,
      color: "text-sky-400 border-sky-500/30 bg-sky-500/10",
      wikiQuery: `${countryName} Parliament`,
    },
    {
      title: "Judicial Branch",
      subtitle: "Constitutional Guardianship",
      lead: judiciaryName,
      deputy: "Magistrates & Supreme Tribunal",
      icon: Shield,
      color: "text-purple-400 border-purple-500/30 bg-purple-500/10",
      wikiQuery: `${countryName} Judiciary`,
    },
  ];

  return (
    <div
      className={cn(
        "facet-surface facet-refraction space-y-4 rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Statecraft & Institutions
          </span>
          <h3 className="text-base font-bold tracking-tight text-foreground">
            Constitutional State Structure
          </h3>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-[var(--flag-primary)]">
          <span>{governmentType}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {branches.map((branch, i) => {
          const Icon = branch.icon;
          return (
            <div
              key={i}
              className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md transition-all duration-150 hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border",
                      branch.color
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{branch.title}</h4>
                    <p className="text-[10px] text-muted-foreground">{branch.subtitle}</p>
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border border-white/5 bg-black/20 p-2.5">
                  <p className="text-xs font-bold text-foreground truncate">{branch.lead}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{branch.deputy}</p>
                </div>
              </div>

              <Link
                href={createUrl(`/wiki/${encodeURIComponent(countryName)}`)}
                className="mt-3 flex items-center justify-between text-[11px] font-semibold text-[var(--flag-primary)] hover:underline"
              >
                <span>Read Charter on IxWiki</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
