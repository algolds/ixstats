"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "iconoir-react";
import { motion, useReducedMotion } from "motion/react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import type { DomainCategory } from "./constants";

interface DomainCategoriesGridProps {
  domains: DomainCategory[];
  searchQuery: string;
}

export function DomainCategoriesGrid({ domains, searchQuery }: DomainCategoriesGridProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
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
                  "group relative overflow-hidden flex flex-col justify-between p-4 sm:p-5 rounded-2xl min-h-[160px]",
                  "border border-white/20 dark:border-white/10",
                  "bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md",
                  "shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_4px_16px_rgba(0,0,0,0.3)]",
                  "hover:border-foreground/30 hover:bg-white/90 dark:hover:bg-zinc-900/90 hover:shadow-lg",
                  "transition-all duration-200 active:scale-[0.98]"
                )}
              >
                <TextureOverlay texture="halftone" opacity={0.03} />

                {/* Header with Icon + Arrow */}
                <div className="flex items-start justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/10 shrink-0"
                      style={{
                        backgroundColor: `${domain.color}15`,
                        color: domain.color,
                      }}
                    >
                      <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground group-hover:text-blue-500 transition-colors">
                        {domain.name}
                      </h2>
                      <div className="text-[10px] font-medium text-muted-foreground">
                        {domain.metric}
                      </div>
                    </div>
                  </div>

                  <div className="p-1.5 rounded-full bg-muted/60 text-muted-foreground group-hover:text-foreground group-hover:bg-blue-500/10 transition-colors">
                    <ArrowRight className="h-3.5 w-3.5 -rotate-45 group-hover:rotate-0 transition-transform duration-200" />
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed mt-3 line-clamp-2">
                  {domain.description}
                </p>

                {/* Footer Badge */}
                <div className="mt-4 flex items-center justify-between pt-2.5 border-t border-border/40 text-[11px] font-semibold text-blue-500">
                  <span>Open {domain.name} Portal</span>
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                    Category:{domain.name} →
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {domains.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No domain portals matching &quot;{searchQuery}&quot;.
        </div>
      )}
    </div>
  );
}
