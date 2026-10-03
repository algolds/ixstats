"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "iconoir-react";
import { motion, useReducedMotion } from "motion/react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import type { DomainCategory } from "./constants";

interface DomainCategoriesGridProps {
  domains: DomainCategory[];
  searchQuery: string;
}

export function DomainCategoriesGrid({ domains, searchQuery }: DomainCategoriesGridProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {domains.map((domain, index) => {
          const Icon = domain.icon;
          return (
            <motion.div
              key={domain.name}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.02 }}
            >
              <Link
                href={withBasePath(`/wiki/categories/${encodeURIComponent(domain.name)}`)}
                className={cn(
                  "group rounded-card relative flex min-h-[160px] flex-col justify-between overflow-hidden p-4 sm:p-5",
                  "border-separator bg-surface border",
                  "hover:border-separator hover:bg-surface hover:shadow-floating",
                  "facet-press focus-visible:outline-tint outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                )}
              >
                {/* Header with Icon + Arrow */}
                <div className="flex w-full items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="border-separator rounded-row flex h-10 w-10 shrink-0 items-center justify-center border"
                      style={{
                        backgroundColor: `${domain.color}15`,
                        color: domain.color,
                      }}
                    >
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-label text-title-3 group-hover:text-tint group-focus-visible:text-tint transition-colors">
                        {domain.name}
                      </h2>
                      <div className="text-label-secondary text-caption">{domain.metric}</div>
                    </div>
                  </div>

                  <div className="bg-fill-3 text-label-secondary group-hover:text-label group-hover:bg-tint/10 group-focus-visible:text-label group-focus-visible:bg-tint/10 rounded-full p-2 transition-colors">
                    <ArrowRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5 -rotate-45 transition-[rotate] duration-200 group-hover:rotate-0 group-focus-visible:rotate-0 motion-reduce:transition-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <p className="text-label-secondary text-footnote mt-3 line-clamp-2 leading-relaxed">
                  {domain.description}
                </p>

                {/* Footer Badge */}
                <div className="border-separator text-caption text-tint mt-4 flex items-center justify-between border-t pt-3 font-semibold">
                  <span>Open {domain.name} Portal</span>
                  <span className="text-label-secondary group-hover:text-label group-focus-visible:text-label transition-colors">
                    Category:{domain.name} →
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {domains.length === 0 && (
        <div className="text-label-secondary text-body py-12 text-center">
          No domain portals matching &quot;{searchQuery}&quot;.
        </div>
      )}
    </div>
  );
}
