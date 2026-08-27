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
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
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
                  "group relative flex min-h-[160px] flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5",
                  "border border-white/20 dark:border-white/10",
                  "bg-white/60 backdrop-blur-md dark:bg-zinc-900/60",
                  "shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_4px_16px_rgba(0,0,0,0.3)]",
                  "hover:border-foreground/30 hover:bg-white/90 hover:shadow-lg dark:hover:bg-zinc-900/90",
                  "transition-all duration-200 active:scale-[0.98]"
                )}
              >
                <TextureOverlay texture="halftone" opacity={0.03} />

                {/* Header with Icon + Arrow */}
                <div className="flex w-full items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="border-foreground/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                      style={{
                        backgroundColor: `${domain.color}15`,
                        color: domain.color,
                      }}
                    >
                      <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                    </div>
                    <div>
                      <h2 className="text-foreground text-base font-bold transition-colors group-hover:text-blue-500">
                        {domain.name}
                      </h2>
                      <div className="text-muted-foreground text-[10px] font-medium">
                        {domain.metric}
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/60 text-muted-foreground group-hover:text-foreground rounded-full p-1.5 transition-colors group-hover:bg-blue-500/10">
                    <ArrowRight className="h-3.5 w-3.5 -rotate-45 transition-transform duration-200 group-hover:rotate-0" />
                  </div>
                </div>

                {/* Description */}
                <p className="text-muted-foreground mt-3 line-clamp-2 text-xs leading-relaxed">
                  {domain.description}
                </p>

                {/* Footer Badge */}
                <div className="border-border/40 mt-4 flex items-center justify-between border-t pt-2.5 text-[11px] font-semibold text-blue-500">
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
        <div className="text-muted-foreground py-12 text-center text-sm">
          No domain portals matching &quot;{searchQuery}&quot;.
        </div>
      )}
    </div>
  );
}
