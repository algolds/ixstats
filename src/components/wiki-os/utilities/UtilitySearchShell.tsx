"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Search, Folder as FolderTree } from "iconoir-react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { Button } from "~/components/ui/button";

/** Full class strings per accent so Tailwind can see them. */
const ACCENTS = {
  green: {
    pill: "border-green/20 bg-green/10 text-green hover:bg-green/15",
    icon: "text-green",
    input: "focus:border-green focus:ring-green/20",
    button: "bg-green text-on-green hover:bg-green/90",
    spinner: "border-green",
  },
  yellow: {
    pill: "border-yellow/20 bg-yellow/10 text-yellow hover:bg-yellow/15",
    icon: "text-yellow",
    input: "focus:border-yellow focus:ring-yellow/20",
    button: "bg-yellow text-on-yellow hover:bg-yellow/90",
    spinner: "border-yellow",
  },
} as const;

type UtilityAccent = keyof typeof ACCENTS;

/** A text box plus the term it last submitted. */
export function useSearchTerm(initial: string) {
  const [input, setInput] = useState(initial);
  const [active, setActive] = useState(initial);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) setActive(input.trim());
  };
  return { input, setInput, active, submit };
}

export function DashedNotice({ children }: { children: ReactNode }) {
  return (
    <div className="border-separator bg-surface text-label-secondary rounded-card text-footnote border border-dashed p-12 text-center">
      {children}
    </div>
  );
}

interface UtilitySearchShellProps {
  accent: UtilityAccent;
  /** Last breadcrumb segment after "Special:Utilities". */
  crumb: string;
  title: ReactNode;
  description: ReactNode;
  /** Summary chip shown once a term is active. */
  badge?: {
    icon: ReactNode;
    primary: string;
    secondary: string;
    truncate?: boolean;
  } | null;
  search: ReturnType<typeof useSearchTerm>;
  placeholder: string;
  submitLabel: string;
  isLoading: boolean;
  error?: { message: string } | null;
  errorPrefix: string;
  children: ReactNode;
}

/** Masthead with a search form, load/error states, then the page-specific results. */
export function UtilitySearchShell({
  accent,
  crumb,
  title,
  description,
  badge,
  search,
  placeholder,
  submitLabel,
  isLoading,
  error,
  errorPrefix,
  children,
}: UtilitySearchShellProps) {
  const reduceMotion = useReducedMotion();
  const a = ACCENTS[accent];

  return (
    <WikiOSLayout hideTitleHeading>
      <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 select-none">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="bg-surface border-separator shadow-card text-label rounded-card relative overflow-hidden border p-6 sm:p-8"
        >
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <Link
                href={"/util"}
                className={`group text-caption inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] ${a.pill}`}
              >
                <FolderTree className="h-3.5 w-3.5" />
                <span>Special:Utilities</span>
                <span className="opacity-40">/</span>
                <span className="font-semibold">{crumb}</span>
              </Link>
            </div>

            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl space-y-1">
                <h1 className="text-label font-brand text-title-1 sm:text-large-title">{title}</h1>
                <p className="text-label-secondary text-body leading-relaxed">{description}</p>
              </div>

              {badge && (
                <div className="border-separator rounded-card bg-surface shadow-card flex shrink-0 items-center gap-2 border px-4 py-2">
                  {badge.icon}
                  <div className="text-left">
                    <div
                      className={`text-label text-caption font-semibold ${badge.truncate ? "max-w-[160px] truncate" : ""}`}
                    >
                      {badge.primary}
                    </div>
                    <div className="text-label-secondary text-footnote">{badge.secondary}</div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={search.submit} className="pt-2">
              <div className="relative flex items-center">
                <Search className="text-label-secondary pointer-events-none absolute left-4 h-4 w-4" />
                <input
                  type="text"
                  value={search.input}
                  onChange={(e) => search.setInput(e.target.value)}
                  placeholder={placeholder}
                  className={`border-separator placeholder:text-label-tertiary text-label rounded-card bg-surface text-body w-full border py-3 pr-24 pl-10 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none ${a.input}`}
                />
                <Button size="sm" type="submit" className={`absolute right-2 ${a.button}`}>
                  {submitLabel}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>

        {isLoading && (
          <div className="border-separator bg-surface rounded-card flex h-64 items-center justify-center border">
            <div
              className={`h-6 w-6 animate-spin rounded-full border-2 border-t-transparent ${a.spinner}`}
            />
          </div>
        )}

        {error && (
          <div className="rounded-card border-red/30 bg-red/10 text-footnote text-red border p-6">
            {errorPrefix}: {error.message}
          </div>
        )}

        {children}
      </div>
    </WikiOSLayout>
  );
}
