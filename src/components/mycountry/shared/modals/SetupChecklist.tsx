"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Circle,
  Users,
  Crown,
  Vote,
  Shield,
  BookOpen,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/utils";
import { api } from "~/trpc/react";
import { PanelCard } from "~/components/mycountry/cards";
import { ACCENT_CLASSES, type MyCountryAccent } from "~/components/mycountry/shared/cards/accents";
import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";

interface SetupChecklistProps {
  countryId: string;
  onNavigate?: (section: MyCountrySection) => void;
}

interface ChecklistRow {
  key: string;
  accent: MyCountryAccent;
  icon: typeof Users;
  label: string;
  hint: string;
  cta: string;
  done: boolean;
  /** Step counts toward the "X of 4 complete" progress (the auto-completable ones). */
  auto: boolean;
  onAction?: () => void;
  href?: string;
}

/**
 * SetupChecklist — new-player onboarding layer for the MyCountry Overview.
 *
 * Shows a "Get started" card guiding fresh countries through their first
 * actions (embassy, policy, party, military) plus a link to the getting-started
 * guide. Completion state is computed from real tRPC data. Once all four
 * auto-completable steps are done the checklist hides itself (returns null), so
 * it only appears for new players.
 */
export function SetupChecklist({ countryId, onNavigate }: SetupChecklistProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Persisted "don't show again" — lets players dismiss the checklist before
  // finishing all four steps. Read after mount to avoid an SSR hydration mismatch.
  const dismissKey = `mc-setup-dismissed-${countryId}`;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);
  const dismiss = () => {
    localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  };

  const embassies = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { staleTime: 5 * 60_000 }
  );
  const policies = api.policies.getPolicies.useQuery({ countryId }, { staleTime: 5 * 60_000 });
  const parties = api.elections.getParties.useQuery({ countryId }, { staleTime: 5 * 60_000 });
  const branches = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { staleTime: 5 * 60_000 }
  );

  const hasEmbassy = (embassies.data?.length ?? 0) > 0;
  const hasPolicy = (policies.data?.length ?? 0) > 0;
  const hasParty = (parties.data?.length ?? 0) > 0;
  const hasBranch = (branches.data?.length ?? 0) > 0;

  const rows: ChecklistRow[] = [
    {
      key: "embassy",
      accent: "cyan",
      icon: Users,
      label: "Establish your first embassy",
      hint: "Open diplomatic relations with another nation.",
      cta: "Establish",
      done: hasEmbassy,
      auto: true,
      onAction: () => onNavigate?.("diplomacy"),
    },
    {
      key: "policy",
      accent: "amber",
      icon: Crown,
      label: "Enact your first policy",
      hint: "Set national direction from the executive desk.",
      cta: "Enact",
      done: hasPolicy,
      auto: true,
      onAction: () => onNavigate?.("executive"),
    },
    {
      key: "party",
      accent: "indigo",
      icon: Vote,
      label: "Found a political party",
      hint: "Build the political backbone of your government.",
      cta: "Found",
      done: hasParty,
      auto: true,
      onAction: () => onNavigate?.("politics"),
    },
    {
      key: "military",
      accent: "red",
      icon: Shield,
      label: "Develop national defense",
      hint: "Establish defense branches to secure your borders.",
      cta: "Develop",
      done: hasBranch,
      auto: true,
      onAction: () => onNavigate?.("defense"),
    },
    {
      key: "guide",
      accent: "emerald",
      icon: BookOpen,
      label: "Read the getting-started guide",
      hint: "Learn the essentials of running your first country.",
      cta: "Read guide",
      done: false,
      auto: false,
      href: createUrl("/help/getting-started/first-country"),
    },
  ];

  const autoRows = rows.filter((r) => r.auto);
  const completedAuto = autoRows.filter((r) => r.done).length;

  // Hide the checklist once all four are done, or once the player dismisses it.
  if (completedAuto >= autoRows.length || dismissed) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <PanelCard accent="amber" tinted texture="dots" className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex-1 text-left select-none focus:outline-none"
          >
            <h2 className="text-card-foreground text-base font-semibold tracking-tight">
              Get started
            </h2>
            <p className="text-muted-foreground text-xs">
              First steps to bring your nation to life.
            </p>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground bg-muted/60 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium">
              {completedAuto} of {autoRows.length} complete
            </span>
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md p-1 transition-colors focus:outline-none"
              aria-label={isCollapsed ? "Expand checklist" : "Collapse checklist"}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  !isCollapsed && "rotate-180"
                )}
              />
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md p-1 transition-colors focus:outline-none"
              aria-label="Dismiss checklist"
              title="Dismiss — don't show this again"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.ul
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 16 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-2 overflow-hidden"
            >
              {rows.map((row) => {
                const a = ACCENT_CLASSES[row.accent];
                const Icon = row.icon;
                return (
                  <li
                    key={row.key}
                    className={cn(
                      "border-border/60 bg-card/40 flex items-center gap-3 rounded-lg border p-3 transition-colors",
                      !row.done && "hover:bg-card/70"
                    )}
                  >
                    <span className="shrink-0">
                      {row.done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className={cn("h-5 w-5", a.text, "opacity-50")} />
                      )}
                    </span>

                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        a.text
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-card-foreground truncate text-sm font-medium",
                          row.done && "text-muted-foreground line-through"
                        )}
                      >
                        {row.label}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{row.hint}</p>
                    </div>

                    {row.done ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
                        Done
                      </span>
                    ) : row.href ? (
                      <Link
                        href={row.href}
                        className={cn(
                          "border-border/70 bg-card/60 hover:bg-muted shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                          a.text
                        )}
                      >
                        {row.cta}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={row.onAction}
                        className={cn(
                          "border-border/70 bg-card/60 hover:bg-muted shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                          a.text
                        )}
                      >
                        {row.cta}
                      </button>
                    )}
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </PanelCard>
    </motion.div>
  );
}
