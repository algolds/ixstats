"use client";

/**
 * AtomicWelcomeModal — First-visit welcome screen for Atomic Government Builder.
 * Adapted from MapWelcomeModal for consistent premium UX.
 */

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import {
  X,
  Blocks,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Layers,
  Zap,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Settings,
  LayoutGrid,
  Info,
  DollarSign,
  TrendingUp,
  Crown,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { ATOMIC_WELCOME_VERSION } from "~/lib/buildVersion";

const STORAGE_KEY = "atomic-builder-welcome-seen";

const TIPS = [
  {
    icon: Blocks,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    title: "Select Components",
    description:
      "Select up to 10 active blocks representing specific policies, ministries, or departments, and stack them together to define your state.",
  },
  {
    icon: Crown,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "5 Core Pillars",
    description:
      "For a balanced state structure, distribute selections across Executive, Legislative, Judicial, Administrative, and Specialized organs.",
  },
  {
    icon: Zap,
    color: "text-green-400",
    bg: "bg-green-500/10",
    title: "Discover Synergies",
    description:
      "Hover over green badges to find natural compatibilities. Aligning policies and structures boosts your overall effectiveness.",
  },
  {
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    title: "Resolve Conflicts",
    description:
      "Hover over red badges to check for conflicting administrative choices. If you hit a conflict, simply swap them out to find the right mix.",
  },
];

const METRICS_HELP = [
  {
    icon: DollarSign,
    color: "text-emerald-400",
    title: "Costs & Budget",
    description:
      "Each component has setup and maintenance costs. If your budget goes red, simply adjust your selections or modify tax rates later.",
  },
  {
    icon: TrendingUp,
    color: "text-cyan-400",
    title: "Effectiveness Score",
    description:
      "Indicates how successfully your policies will be executed. High synergy setups can push this score well beyond 100%.",
  },
  {
    icon: Settings,
    color: "text-amber-400",
    title: "Starting Templates",
    description:
      "Use the dropdown to load preset configurations like Technocracy or Meritocracy as a baseline, then customize them freely.",
  },
];

export function AtomicWelcomeModal({
  open,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [show, setShow] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open !== undefined) {
      setShow(open);
      if (open) {
        setActiveTab(0);
        setCurrentPage(0);
      }
    }
  }, [open]);

  useEffect(() => {
    if (open === undefined) {
      try {
        const seen = localStorage.getItem(STORAGE_KEY);
        if (!seen || seen !== ATOMIC_WELCOME_VERSION) {
          const timer = setTimeout(() => setShow(true), 800);
          return () => clearTimeout(timer);
        }
      } catch {
        // localStorage unavailable
      }
    }
    return;
  }, [open]);

  const handleClose = useCallback(() => {
    setShow(false);
    onOpenChange?.(false);
    try {
      localStorage.setItem(STORAGE_KEY, ATOMIC_WELCOME_VERSION);
    } catch {}
  }, [onOpenChange]);

  const totalPages = 2; // Tips page + Templates & Metrics page

  const TABS = ["Setup Guide", "Synergy Guide", "Metrics Guide", "Cost Mechanics", "FAQ & Help"];

  if (!mounted || !show) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop with premium deep blur rack focus */}
          <motion.div
            key="atomic-welcome-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100000] bg-zinc-950/40 backdrop-blur-[12px] dark:bg-black/60"
            onClick={handleClose}
          />

          {/* Modal Overlay */}
          <motion.div
            key="atomic-welcome-modal"
            initial={{ opacity: 0, scale: 0.94, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-1/2 left-1/2 z-[100001] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4 focus:outline-none"
          >
            <div className="border-border/50 from-background via-background to-muted/30 relative overflow-hidden rounded-2xl border bg-gradient-to-b shadow-2xl dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="text-muted-foreground/60 hover:bg-muted hover:text-foreground absolute top-3 right-3 z-10 cursor-pointer rounded-full p-1.5 transition-colors dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="relative px-6 pt-6 pb-2">
                <div className="pointer-events-none absolute -top-20 -left-20 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MyCountryLogo size="md" variant="icon-only" animated={true} />
                    <div>
                      <h2 className="text-foreground text-lg font-semibold">MyGovernment Guide</h2>
                      <p className="text-muted-foreground text-xs">
                        Build your administration structure using modular components
                      </p>
                    </div>
                  </div>
                  <span className="bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 font-mono text-[10px] dark:bg-white/5">
                    v{ATOMIC_WELCOME_VERSION}
                  </span>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="border-border/30 flex border-b bg-zinc-500/5 px-6 dark:border-white/5 dark:bg-black/15">
                {TABS.map((tab, i) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(i);
                      setCurrentPage(0);
                    }}
                    className={cn(
                      "relative cursor-pointer border-b-2 px-3 py-2.5 text-xs font-semibold transition-all",
                      activeTab === i
                        ? "border-purple-500 font-bold text-purple-600 dark:text-purple-400"
                        : "text-muted-foreground hover:text-foreground border-transparent"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Content pages */}
              <div className="flex max-h-[360px] min-h-[280px] scrollbar-thin scrollbar-thumb-zinc-800 flex-col justify-between overflow-y-auto px-6 py-4">
                <AnimatePresence mode="wait">
                  {activeTab === 0 && (
                    <div className="flex min-h-[260px] w-full flex-col justify-between">
                      {currentPage === 0 && (
                        <motion.div
                          key="tips"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.2 }}
                          className="grid grid-cols-2 gap-2.5"
                        >
                          {TIPS.map((tip) => {
                            const Icon = tip.icon;
                            return (
                              <div
                                key={tip.title}
                                className={`rounded-xl ${tip.bg} border-border/30 hover:border-border/60 border p-3 transition-colors dark:border-white/5 dark:hover:border-white/10`}
                              >
                                <div className="mb-1.5 flex items-center gap-2">
                                  <Icon className={`h-3.5 w-3.5 ${tip.color}`} />
                                  <span className="dark:text-foreground/90 text-xs font-semibold text-zinc-800">
                                    {tip.title}
                                  </span>
                                </div>
                                <p className="text-muted-foreground text-[10px] leading-relaxed">
                                  {tip.description}
                                </p>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}

                      {currentPage === 1 && (
                        <motion.div
                          key="metrics-and-templates"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-3"
                        >
                          <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Templates & Advanced Metrics
                          </h3>
                          <div className="space-y-2">
                            {METRICS_HELP.map((item) => {
                              const Icon = item.icon;
                              return (
                                <div
                                  key={item.title}
                                  className="bg-muted/30 border-border/10 flex items-start gap-3 rounded-lg border p-2.5 dark:bg-white/5"
                                >
                                  <div className="shrink-0 rounded-md bg-white/5 p-1">
                                    <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                                  </div>
                                  <div className="space-y-0.5">
                                    <h4 className="text-foreground/90 text-xs font-semibold">
                                      {item.title}
                                    </h4>
                                    <p className="text-muted-foreground text-[10px] leading-normal">
                                      {item.description}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="border-border/30 rounded-xl border bg-gradient-to-r from-purple-500/10 to-indigo-500/10 p-3 dark:border-white/5">
                            <div className="mb-1 flex items-center gap-2">
                              <Info className="h-3.5 w-3.5 text-purple-400" />
                              <span className="text-foreground/90 text-xs font-medium">
                                Honest Advice
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10px]">
                              Active red alerts block validation to prevent invalid setups. If you
                              hit a conflict, simply swap out the conflicting components or load a
                              template and customize.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {activeTab === 1 && (
                    <motion.div
                      key="synergy-sheet"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div>
                        <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold">
                          <Zap className="h-3.5 w-3.5 text-green-400" />
                          Popular Synergy Combos (Natural Compatibilities)
                        </h3>
                        <div className="space-y-2">
                          {[
                            {
                              title: "Meritocracy + Civil Service Reform",
                              effect: "+10% Effectiveness",
                              desc: "Builds a highly capable, standardized state civil service workforce.",
                            },
                            {
                              title: "Technocracy + Digital Infrastructure",
                              effect: "+15% Effectiveness",
                              desc: "Automates administration with high-speed digital state services.",
                            },
                            {
                              title: "Rule of Law + Independent Judiciary",
                              effect: "+15% Effectiveness",
                              desc: "Establishes a corruption-free, highly stable legal framework.",
                            },
                            {
                              title: "Unitary Government + Centralized Power",
                              effect: "+10% Effectiveness",
                              desc: "Enables rapid legislative passing and command authority.",
                            },
                            {
                              title: "State Capitalism + Technocratic Agencies",
                              effect: "+12% Effectiveness",
                              desc: "Enables expert-run state corporations to dominate national trade.",
                            },
                          ].map((combo, idx) => (
                            <div
                              key={idx}
                              className="bg-muted/30 border-border/10 flex items-start justify-between gap-3 rounded-lg border p-2.5 text-left dark:bg-white/5"
                            >
                              <div>
                                <h4 className="text-foreground text-xs font-bold">{combo.title}</h4>
                                <p className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
                                  {combo.desc}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="shrink-0 border-green-500/20 bg-green-500/10 font-mono text-[9px] font-semibold text-green-600 dark:text-green-400"
                              >
                                {combo.effect}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-border/20 border-t pt-2 dark:border-white/5">
                        <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                          Volatile Combos (High Risk)
                        </h3>
                        <div className="space-y-2">
                          {[
                            {
                              title: "Autocratic Process + Independent Judiciary",
                              effect: "-15% Penalty",
                              desc: "Playstyle: Enlightened Despotism. Decrees conflict with courts, but maintains high public trust and prevents total stability collapses.",
                            },
                            {
                              title: "Planned Economy + Free Market System",
                              effect: "-15% Penalty",
                              desc: "Playstyle: Dual-Track System. Incompatible philosophies conflict, but allows strong state infrastructure control alongside free trade.",
                            },
                            {
                              title: "Technocratic Process + Charismatic Legitimacy",
                              effect: "-15% Penalty",
                              desc: "Playstyle: Populist Technocracy. Logical reforms conflict with emotional leader appeal, but aids in pushing massive technology initiatives.",
                            },
                            {
                              title: "Federal System + Centralized Power Structure",
                              effect: "-15% Penalty",
                              desc: "Playstyle: Imperial Federation. Regional states conflict with federal override, but grants local tax structures alongside central martial mobilization.",
                            },
                            {
                              title: "Free Market System + Welfare State",
                              effect: "-15% Penalty",
                              desc: "Playstyle: Social Democracy. Broad welfare programs conflict with deregulation, but keeps economic growth high while buffering citizen security.",
                            },
                            {
                              title: "Surveillance System + Democratic Process",
                              effect: "-15% Penalty",
                              desc: "Playstyle: Cyber-Panopticon. Mass surveillance conflicts with democratic civil liberties, but minimizes crime while keeping public votes.",
                            },
                          ].map((combo, idx) => (
                            <div
                              key={idx}
                              className="flex items-start justify-between gap-3 rounded-lg border border-red-500/10 bg-red-500/5 p-2.5 text-left"
                            >
                              <div>
                                <h4 className="text-foreground text-xs font-bold">{combo.title}</h4>
                                <p className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
                                  {combo.desc}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="shrink-0 border-red-500/20 bg-red-500/15 font-mono text-[9px] font-semibold text-red-600 dark:text-red-400"
                              >
                                {combo.effect}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 2 && (
                    <motion.div
                      key="metrics-guide"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                        <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                        Understanding Builder Metrics
                      </h3>
                      <div className="space-y-2">
                        {[
                          {
                            title: "Interactive Metrics Cards",
                            desc: "Every metric card at the top is clickable! Click any card to launch its high-fidelity popover showing exact contributions, components, and math.",
                          },
                          {
                            title: "Capacity & Administrative Weight",
                            desc: "Active components are limited to 10 (15 in steps). Stacking too many high-complexity components drains capacity and balloons costs.",
                          },
                          {
                            title: "Base Effectiveness Score",
                            desc: "This is the mathematical average of all active components' base effectiveness values before synergies or conflicts are calculated.",
                          },
                          {
                            title: "Synergies (+10%) & Conflicts (-15%)",
                            desc: "Synergy combinations boost effectiveness beyond 100%. Incompatible choices subtract -15% and must be resolved before configurations can be validated.",
                          },
                          {
                            title: "Implementation vs Annual Maintenance",
                            desc: "Implementation is the one-time, upfront cost to enact a component. Maintenance is the recurring annual budget expense.",
                          },
                        ].map((m, idx) => (
                          <div
                            key={idx}
                            className="bg-muted/30 border-border/10 rounded-lg border p-2.5 text-left dark:bg-white/5"
                          >
                            <h4 className="text-foreground text-xs font-bold">{m.title}</h4>
                            <p className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
                              {m.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 3 && (
                    <motion.div
                      key="costs-guide"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                        Implementation vs Annual Maintenance
                      </h3>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-left">
                          <h4 className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                            <DollarSign className="h-3.5 w-3.5" />
                            Implementation (Upfront)
                          </h4>
                          <p className="mt-1 text-[10px] leading-relaxed text-zinc-800 dark:text-zinc-300">
                            <strong>How:</strong> A one-time upfront cost incurred instantly when a
                            policy or department is enabled.
                          </p>
                          <p className="mt-1 text-[10px] leading-relaxed text-zinc-800 dark:text-zinc-300">
                            <strong>Why:</strong> Covers immediate startup needs: legislative
                            drafting, physical facilities building, hiring processes, and initial
                            technology purchases.
                          </p>
                        </div>

                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-left">
                          <h4 className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Maintenance (Annual)
                          </h4>
                          <p className="mt-1 text-[10px] leading-relaxed text-zinc-800 dark:text-zinc-300">
                            <strong>How:</strong> A recurring operational cost deducted from your
                            national budget every year.
                          </p>
                          <p className="mt-1 text-[10px] leading-relaxed text-zinc-800 dark:text-zinc-300">
                            <strong>Why:</strong> Covers ongoing day-to-day operations: civil
                            service salaries, building upkeep, and consumable resources.
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted/30 border-border/10 rounded-xl border p-3 text-left dark:bg-white/5">
                        <h4 className="text-foreground text-xs font-bold">
                          Strategic Considerations
                        </h4>
                        <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
                          Heavy components (like Central Bureaucracy) might be cheap to establish
                          but drain your treasury over time. Balance upfront capital against annual
                          funding to avoid a deficit that causes stability issues.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 4 && (
                    <motion.div
                      key="faq"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3.5"
                    >
                      <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                        <Info className="h-3.5 w-3.5 text-purple-400" />
                        Frequently Asked Questions
                      </h3>
                      <div className="space-y-3">
                        {[
                          {
                            q: "Can I change my government structure later?",
                            a: "Yes, absolutely! There is zero penalty or lock-in. You can return to this builder screen at any point as your country develops to swap, add, or remove components.",
                          },
                          {
                            q: "What should I do if my budget turns red?",
                            a: "If maintenance costs exceed tax revenue, it means your current state apparatus is too expensive. You can either increase tax rates in the economy screen or remove costly departments.",
                          },
                          {
                            q: "How do I maximize my administration's effectiveness?",
                            a: "Align synergistic components (e.g., Meritocracy + Civil Service Reform) to receive a flat +10% to +15% effectiveness boost per combination. Be sure to swap out any conflicting policies that apply penalties.",
                          },
                        ].map((faq, idx) => (
                          <div key={idx} className="space-y-1 text-left">
                            <h4 className="text-foreground flex items-start gap-1.5 text-xs font-semibold">
                              <span className="font-bold text-purple-500">Q:</span>
                              {faq.q}
                            </h4>
                            <p className="text-muted-foreground pl-4 text-[10px] leading-relaxed">
                              {faq.a}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="border-border/30 flex items-center justify-between border-t px-6 py-4 dark:border-white/5">
                {activeTab === 0 ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          className={`h-1.5 cursor-pointer rounded-full transition-all ${
                            i === currentPage
                              ? "w-5 bg-purple-500"
                              : "bg-muted-foreground/20 hover:bg-muted-foreground/40 w-1.5"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      {currentPage > 0 && (
                        <button
                          onClick={() => setCurrentPage((p) => p - 1)}
                          className="dark:text-muted-foreground hover:bg-muted dark:hover:text-foreground flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:text-zinc-900 dark:hover:bg-white/5"
                        >
                          <ChevronLeft className="h-3 w-3" />
                          Back
                        </button>
                      )}
                      {currentPage < totalPages - 1 ? (
                        <button
                          onClick={() => setCurrentPage((p) => p + 1)}
                          className="flex cursor-pointer items-center gap-1 rounded-lg bg-purple-500/15 px-3 py-1.5 text-xs font-semibold text-purple-600 transition-colors hover:bg-purple-500/25 dark:text-purple-300"
                        >
                          Next
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <button
                          onClick={handleClose}
                          className="flex cursor-pointer items-center gap-1 rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 transition-colors hover:bg-purple-700"
                        >
                          Build MyGovernment
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div />
                    <button
                      onClick={handleClose}
                      className="flex cursor-pointer items-center gap-1 rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 transition-colors hover:bg-purple-700"
                    >
                      Close Help Guide
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
