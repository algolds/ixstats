"use client";

/**
 * EconomicWelcomeModal — First-visit welcome screen for Atomic Economy Builder.
 * Styled in the exact premium glassmorphic onboarding format of the MyGovernment Components Builder.
 */

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import {
  X,
  Blocks,
  Factory,
  Zap,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Settings,
  LayoutGrid,
  Info,
  DollarSign,
  TrendingUp,
  Globe,
  Coins,
  Scale,
  Users,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { ATOMIC_ECONOMY_WELCOME_VERSION } from "~/lib/buildVersion";

const STORAGE_KEY = "atomic-economy-welcome-seen";

const TIPS = [
  {
    icon: Blocks,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "Select Components",
    description:
      "Select up to 12 active blocks representing specific economic systems, trade models, and labor structures.",
  },
  {
    icon: Factory,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Economic Structure",
    description:
      "Tune output shares for Agriculture, Manufacturing, and Services. Balanced allocation ensures resilient growth.",
  },
  {
    icon: Users,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    title: "Labor & Workforce",
    description:
      "Configure labor regulations, minimum wages, paid leave, and unions to balance business output and worker rights.",
  },
  {
    icon: Coins,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    title: "Fiscal & Taxes",
    description:
      "Design progressive income brackets, select corporate taxes, and configure exemptions to generate revenue.",
  },
];

const METRICS_HELP = [
  {
    icon: TrendingUp,
    color: "text-emerald-400",
    title: "GDP Growth & Health",
    description:
      "Indicates expansion speed. High growth builds wealth but must be balanced against stability and inflation risks.",
  },
  {
    icon: Scale,
    color: "text-cyan-400",
    title: "Gini Index & Equality",
    description:
      "Measures wealth distribution. Excessive inequality reduces national stability and dampens long-term demand.",
  },
  {
    icon: Settings,
    color: "text-amber-400",
    title: "Economic Archetypes",
    description:
      "Select a baseline preset like Capitalist, Socialist, or Mixed Economy, then customize sliders to fit your vision.",
  },
];

export function EconomicWelcomeModal({
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
        if (!seen || seen !== ATOMIC_ECONOMY_WELCOME_VERSION) {
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
      localStorage.setItem(STORAGE_KEY, ATOMIC_ECONOMY_WELCOME_VERSION);
    } catch {}
  }, [onOpenChange]);

  const totalPages = 2; // Tips page + Templates & Metrics page

  const TABS = ["Setup Guide", "Synergy Guide", "Metrics Guide", "Fiscal Mechanics", "FAQ & Help"];

  if (!mounted || !show) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop with premium deep blur rack focus */}
          <motion.div
            key="economic-welcome-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100000] bg-zinc-950/40 backdrop-blur-[12px] dark:bg-black/60"
            onClick={handleClose}
          />

          {/* Modal Overlay */}
          <motion.div
            key="economic-welcome-modal"
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
                <div className="pointer-events-none absolute -top-20 -left-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-teal-500/10 blur-3xl" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MyCountryLogo size="md" variant="icon-only" animated={true} />
                    <div>
                      <h2 className="text-foreground text-lg font-semibold">MyEconomy Guide</h2>
                      <p className="text-muted-foreground text-xs">
                        Configure your national economic architecture and fiscal parameters
                      </p>
                    </div>
                  </div>
                  <span className="bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 font-mono text-[10px] dark:bg-white/5">
                    v{ATOMIC_ECONOMY_WELCOME_VERSION}
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
                        ? "border-emerald-500 font-bold text-emerald-600 dark:text-emerald-400"
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
                            Templates & Core Metrics
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

                          <div className="border-border/30 rounded-xl border bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-3 dark:border-white/5">
                            <div className="mb-1 flex items-center gap-2">
                              <Info className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-foreground/90 text-xs font-medium">
                                Design Tips
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10px]">
                              Always keep an eye on validation issues before finalizing. Sector
                              percentages must sum to 100%, and excessive taxation can reduce GDP
                              growth potential.
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
                              title: "Free Market System + Deregulation",
                              effect: "+12% GDP Growth",
                              desc: "Accelerates business investments and simplifies market entries.",
                            },
                            {
                              title: "Planned Economy + Price Controls",
                              effect: "+15% Stability",
                              desc: "Ensures essential goods remain affordable, preventing market volatility.",
                            },
                            {
                              title: "Export-Oriented + Special Economic Zones",
                              effect: "+14% Trade Efficiency",
                              desc: "Boosts manufacturing exports through tax exemptions and trade corridors.",
                            },
                            {
                              title: "Welfare State + Progressive Income Tax",
                              effect: "+10% Wealth Equality",
                              desc: "Reduces income disparity (Gini Index) and increases aggregate demand.",
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
                              title: "Planned Economy + Free Market System",
                              effect: "-15% Penalty",
                              desc: "Conflicting market philosophies cause major administrative bottlenecks.",
                            },
                            {
                              title: "High Tax Rates + Business Deregulation",
                              effect: "-15% Penalty",
                              desc: "Tax friction contradicts deregulation efforts, lowering economic trust.",
                            },
                            {
                              title: "Protectionist Tariffs + Global Free Trade",
                              effect: "-15% Penalty",
                              desc: "Creating trade walls while pushing open trade generates market confusion.",
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
                        Economic Indicators
                      </h3>
                      <div className="space-y-2">
                        {[
                          {
                            title: "Sectors Balance",
                            desc: "Sectors (Agriculture, Industry, Services) must total exactly 100%. A highly service-oriented economy offers high-income potential but is vulnerable to global supply shocks.",
                          },
                          {
                            title: "Labor Force Participation",
                            desc: "Indicates what percentage of the active population is working or looking for work. Boosting paid vacation or safety indexes can improve overall satisfaction.",
                          },
                          {
                            title: "Average Annual Income",
                            desc: "Driven by GDP per capita and sector choices. Setting high minimum wages supports low-income earners but increases business operational overhead.",
                          },
                          {
                            title: "Demographic Ratios",
                            desc: "Youth and elderly dependency ratios show who is supported by the active workforce. Health expenditures improve life expectancy but place demands on national budgets.",
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
                        Fiscal System Mechanics
                      </h3>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-left">
                          <h4 className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                            <DollarSign className="h-3.5 w-3.5" />
                            Tax Blueprint Templates
                          </h4>
                          <p className="mt-1 text-[10px] leading-relaxed text-zinc-800 dark:text-zinc-300">
                            Preconfigured structures like Laissez-Faire, Social Democracy, or Flat
                            Tax can be applied instantly to form a base.
                          </p>
                        </div>

                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-left">
                          <h4 className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Revenue Calculation
                          </h4>
                          <p className="mt-1 text-[10px] leading-relaxed text-zinc-800 dark:text-zinc-300">
                            Revenue is derived from income, sales, corporate, and resource taxes.
                            Tax compliance and collection efficiency values dictate the actual
                            realized revenue.
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted/30 border-border/10 rounded-xl border p-3 text-left dark:bg-white/5">
                        <h4 className="text-foreground text-xs font-bold">
                          Exemptions & Deductions
                        </h4>
                        <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
                          Offering deductions for research, family sizes, or green investments
                          reduces tax burdens and increases specific sector efficiencies at the cost
                          of immediate fiscal revenue.
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
                        <Info className="h-3.5 w-3.5 text-emerald-400" />
                        Frequently Asked Questions
                      </h3>
                      <div className="space-y-3">
                        {[
                          {
                            q: "How do economic sectors affect gameplay?",
                            a: "Sectors define what your workforce produces. A high services sector is associated with advanced, high-tech nations, while primary sectors (agriculture, mining) secure resources but yield less revenue per capita.",
                          },
                          {
                            q: "What is the relationship between taxes and government budget?",
                            a: "Your government's total budget cannot exceed the country's nominal GDP. Realized tax revenue fuels the budget; if your budget goes into a deficit, you can increase tax rates or cut department spending.",
                          },
                          {
                            q: "Can I adjust economic parameters after launch?",
                            a: "Yes! Economic settings can be remodeled at any time. Return to the editor to tune tax rates, adjust sector shares, or toggle economic components as needed.",
                          },
                        ].map((faq, idx) => (
                          <div key={idx} className="space-y-1 text-left">
                            <h4 className="text-foreground flex items-start gap-1.5 text-xs font-semibold">
                              <span className="font-bold text-emerald-500">Q:</span>
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
                              ? "w-5 bg-emerald-500"
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
                          className="flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-300"
                        >
                          Next
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <button
                          onClick={handleClose}
                          className="flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-700"
                        >
                          Build MyEconomy
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div />
                    <button
                      onClick={handleClose}
                      className="flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-700"
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
