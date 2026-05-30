"use client";

/**
 * BuilderWelcomeModal — First-visit welcome screen for the MyCountry Nation Builder.
 * Styled in the exact premium glassmorphic onboarding format of the MyGovernment Components Builder.
 */

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import {
  X,
  Globe,
  Fingerprint,
  Shield,
  Coins,
  Sparkles,
  Info,
  Zap,
  BookOpen,
  Save,
  Smile,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { BUILDER_VERSION } from "~/lib/buildVersion";

const STORAGE_KEY = "mycountry-builder-welcome-seen";

const MAIN_STEPS = [
  {
    icon: Globe,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "1. Foundation",
    description:
      "Choose a real-world template as a baseline, start with a blank slate, or import an IIWiki country page.",
  },
  {
    icon: Fingerprint,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    title: "2. Identity",
    description:
      "Choose your nation's name, visual flag, national motto, state model, and write your historic description.",
  },
  {
    icon: Shield,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    title: "3. Government",
    description:
      "Select and stack up to 15 active component blocks representing ministries, legislatures, and courts. Discover powerful gameplay combos and synergies.",
  },
  {
    icon: Coins,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "4. Economics",
    description:
      "Tune fiscal parameters, set sector priorities (services/industry/tech), select tax rates, and allocate budget.",
  },
];

const ADVANCED_TIPS = [
  {
    icon: Save,
    color: "text-amber-400",
    title: "Autosave",
    description:
      "Your progress is automatically saved as you go. A green save indicator on the top right shows when changes are successfully backed up.",
  },
  {
    icon: Sparkles,
    color: "text-purple-400",
    title: "Live Preview Panel",
    description:
      "The panel on the left sidebar shows a live preview of your country, including its flag, name, and current stats. It updates instantly as you make changes.",
  },
  {
    icon: Info,
    color: "text-cyan-400",
    title: "Vitality Rings",
    description:
      "Watch the rings on the preview panel. They show your country's Economic Health, Market Activity, and Development Index, indicating how your policies are performing.",
  },
  {
    icon: Smile,
    color: "text-pink-400",
    title: "Experiment & Have Fun",
    description:
      "Feel free to try wild ideas! You can always change your symbols, government blocks, and policies in the editor later.",
  },
];

export function BuilderWelcomeModal({
  open,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [show, setShow] = useState(false);
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
      }
    }
  }, [open]);

  useEffect(() => {
    if (open === undefined) {
      try {
        const seen = localStorage.getItem(STORAGE_KEY);
        if (!seen || seen !== BUILDER_VERSION) {
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
      localStorage.setItem(STORAGE_KEY, BUILDER_VERSION);
    } catch {}
  }, [onOpenChange]);

  const TABS = ["Getting Started", "Build Process", "Tips", "FAQ Guide"];

  if (!mounted || !show) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop with premium blur */}
          <motion.div
            key="builder-welcome-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100000] bg-zinc-950/40 backdrop-blur-[12px] dark:bg-black/60"
            onClick={handleClose}
          />

          {/* Modal Overlay */}
          <motion.div
            key="builder-welcome-modal"
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
                <div className="pointer-events-none absolute -top-20 -left-20 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MyCountryLogo size="md" variant="icon-only" animated={true} />
                    <div>
                      <h2 className="text-foreground text-lg font-semibold">MyCountry Builder Guide</h2>
                      <p className="text-muted-foreground text-xs">
                        Create your custom nation exactly as you want it.
                      </p>
                    </div>
                  </div>
                  <span className="bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 font-mono text-[10px] dark:bg-white/5">
                    v{BUILDER_VERSION}
                  </span>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="border-border/30 flex border-b bg-zinc-500/5 px-6 dark:border-white/5 dark:bg-black/15">
                {TABS.map((tab, i) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(i)}
                    className={cn(
                      "relative cursor-pointer border-b-2 px-3 py-2.5 text-xs font-semibold transition-all",
                      activeTab === i
                        ? "border-amber-500 font-bold text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground hover:text-foreground border-transparent"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Content pages */}
              <div className="flex max-h-[380px] min-h-[300px] scrollbar-thin scrollbar-thumb-zinc-800 flex-col justify-between overflow-y-auto px-6 py-4">
                <AnimatePresence mode="wait">
                  {activeTab === 0 && (
                    <motion.div
                      key="welcome-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4 text-left"
                    >
                      <div className="space-y-2">
                        <h3 className="text-foreground text-sm font-semibold">
                          Welcome to the MyCountry Builder!
                        </h3>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Here, you will construct a sovereign state
                          from the ground up by choosing its unique identity and policies. You can customize
                          your country by selecting its government, economy, industries, culture, and more.
                        </p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Once finalized, your country joins the World with other players. You will be able to
                          draft laws, enage in diplomacy, trade or form treaties, and more. Your actions
                          will affect your country's development and its relations with other countries.
                        </p>
                      </div>

                      <div className="border-border/30 rounded-xl border bg-gradient-to-r from-amber-500/10 to-yellow-500/10 p-3 dark:border-white/5">
                        <div className="mb-1.5 flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-amber-400" />
                          <span className="text-foreground/90 text-xs font-medium">
                            How It Works
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          Every decision applies real-time modifiers to your GDP growth, stability index, and
                          currency value. All components and sliders can be customized and re-allocated at
                          any time without penalty once your nation is active.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 1 && (
                    <motion.div
                      key="steps-grid"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-2 gap-2.5 text-left"
                    >
                      {MAIN_STEPS.map((step) => {
                        const Icon = step.icon;
                        return (
                          <div
                            key={step.title}
                            className={`rounded-xl ${step.bg} border-border/30 hover:border-border/60 border p-3 transition-colors dark:border-white/5 dark:hover:border-white/10`}
                          >
                            <div className="mb-1.5 flex items-center gap-2">
                              <Icon className={`h-3.5 w-3.5 ${step.color}`} />
                              <span className="dark:text-foreground/90 text-xs font-semibold text-zinc-800">
                                {step.title}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10px] leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}

                  {activeTab === 2 && (
                    <motion.div
                      key="ui-tips"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3 text-left"
                    >
                      
                      <div className="space-y-2">
                        {ADVANCED_TIPS.map((item) => {
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
                    </motion.div>
                  )}

                  {activeTab === 3 && (
                    <motion.div
                      key="faq-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3.5 text-left"
                    >
                      <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                        <Info className="h-3.5 w-3.5 text-amber-400" />
                        Common Questions
                      </h3>
                      <div className="space-y-3">
                        {[
                          {
                            q: "How do baseline templates affect gameplay?",
                            a: "Selecting a real-world country template seeds your starting population size and GDP. If you prefer a completely blank slate, starting from scratch grants you a default population of 100,000 and $1 Billion GDP.",
                          },
                          {
                            q: "Can I exit and resume building later?",
                            a: "Yes, progress is continuously saved to your browser drafts. A green save indicator at the top right tracks status, letting you safely exit the builder and return to your nation-in-progress at any time.",
                          },
                          {
                            q: "Can I remodel my government after launch?",
                            a: "Absolutely. MyCountry has zero lock-in. Once active, you can return to the builder interface at any point to swap state organs, edit symbols, or adjust tax rates as your nation develops.",
                          },
                        ].map((faq, idx) => (
                          <div key={idx} className="space-y-1">
                            <h4 className="text-foreground flex items-start gap-1.5 text-xs font-bold">
                              <span className="font-black text-amber-500">Q:</span>
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
                <div />
                <button
                  onClick={handleClose}
                  className="flex cursor-pointer items-center gap-1 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-400"
                >
                  Start Building
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
