/**
 * Component Search
 *
 * Search input with real-time filtering, modeled after the foundation builder search bar
 * with glassmorphic hover/focus states, and supporting embedded TemplateSelector.
 * Optimized with React.memo for performance.
 *
 * @module ComponentSearch
 */

import React from "react";
import { Search, Xmark as X } from "iconoir-react";
import { TemplateSelector } from "./TemplateSelector";
import type { GovernmentTemplate } from "./TemplateSelector";
import { cn } from "~/lib/utils";

export interface ComponentSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  templates?: Record<string, GovernmentTemplate>;
  onTemplateSelect?: (templateId: string) => void;
  disabled?: boolean;
}

/**
 * Reusable premium Search Bar with optional embedded template selector
 */
export const ComponentSearch = React.memo<ComponentSearchProps>(
  ({
    value,
    onChange,
    placeholder = "Search components...",
    templates,
    onTemplateSelect,
    disabled = false,
  }) => {
    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <div
        className={cn(
          "flex h-12 w-full items-center gap-3 overflow-hidden rounded-xl border px-3 shadow-md backdrop-blur-md transition-all duration-300",
          isFocused
            ? "border-cyan-500/60 bg-white/85 shadow-[0_0_18px_rgba(6,182,212,0.12)] dark:border-cyan-400/50 dark:bg-zinc-950/60 dark:shadow-[0_0_22px_rgba(34,211,238,0.2)]"
            : "border-slate-200/80 bg-white/50 hover:border-slate-300 dark:border-white/10 dark:bg-zinc-900/30 dark:hover:border-cyan-500/20"
        )}
      >
        {templates && onTemplateSelect && (
          <>
            <div className="shrink-0 select-none">
              <TemplateSelector
                templates={templates}
                onSelect={onTemplateSelect}
                disabled={disabled}
              />
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700/50" />
          </>
        )}

        <Search
          className={cn(
            "h-4 w-4 shrink-0 transition-colors duration-200",
            isFocused ? "text-cyan-500 dark:text-cyan-400" : "text-slate-400 dark:text-zinc-500"
          )}
        />

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 border-0 bg-transparent text-sm text-slate-800 placeholder-slate-400 ring-0 outline-none focus:ring-0 focus:outline-none dark:text-slate-100 dark:placeholder-zinc-500"
        />

        {value && (
          <button
            onClick={() => onChange("")}
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5 text-slate-400 transition-colors hover:text-cyan-500 dark:text-zinc-500 dark:hover:text-cyan-400" />
          </button>
        )}
      </div>
    );
  }
);

ComponentSearch.displayName = "ComponentSearch";
