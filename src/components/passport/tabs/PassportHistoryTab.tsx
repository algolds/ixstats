"use client";

import React from "react";
import Link from "next/link";
import {
  Clock,
  OpenBook as BookOpen,
  ChatBubble as MessageSquare,
  Flash,
  Globe,
  Spark as Sparkles,
  Crown,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import type { HistoryItem } from "../types";

interface PassportHistoryTabProps {
  history: HistoryItem[];
  cleanUsername: string;
}

export const PassportHistoryTab = React.memo(function PassportHistoryTab({ history, cleanUsername }: PassportHistoryTabProps) {
  if (!history || history.length === 0) {
    return (
      <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-12 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-stone-500/10 text-stone-400 flex items-center justify-center">
          <Clock className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">No Activity Yet</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          @{cleanUsername} does not have any recorded activity yet.
        </p>
      </div>
    );
  }

  const getSystemBadge = (system: string) => {
    switch (system) {
      case "wikios":
        return {
          label: "WikiOS",
          icon: BookOpen,
          className: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
        };
      case "forum":
        return {
          label: "Forum",
          icon: MessageSquare,
          className: "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400",
        };
      case "mycountry":
        return {
          label: "MyCountry",
          icon: Flash,
          className: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
        };
      case "realm":
        return {
          label: "Realm",
          icon: Globe,
          className: "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
        };
      case "thinkpages":
        return {
          label: "ThinkPages",
          icon: Sparkles,
          className: "bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400",
        };
      case "vault":
        return {
          label: "Vault",
          icon: Crown,
          className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
        };
      default:
        return {
          label: "System",
          icon: Clock,
          className: "bg-stone-500/10 border-stone-500/20 text-stone-400",
        };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-stone-400 font-mono">
          Activity History ({history.length})
        </h2>
      </div>

      <div className="relative border-l border-black/8 dark:border-white/10 ml-4 space-y-6 pl-6">
        {history.map((event) => {
          const badge = getSystemBadge(event.system);
          const Icon = badge.icon;
          const formattedDate = new Date(event.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          return (
            <div key={event.id} className="relative group">
              {/* Dot on timeline */}
              <div className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-stone-400 group-hover:bg-blue-500 transition-colors" />

              <div className="rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-4 space-y-2 hover:border-black/15 dark:hover:border-white/20 transition-all">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
                        badge.className
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {badge.label}
                    </span>

                    <span className="font-mono text-xs text-muted-foreground">{formattedDate}</span>
                  </div>

                  {event.objectUrl && (
                    <Link
                      href={event.objectUrl}
                      data-cuelume-press="soft"
                      className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-blue-500 hover:text-blue-600 cursor-pointer"
                    >
                      <span>View</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>

                <h4 className="text-sm font-semibold text-foreground tracking-tight">
                  {event.title}
                </h4>

                {event.description && (
                  <p className="font-mono text-xs text-muted-foreground">{event.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

