"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { PreText } from "~/components/ui/pretext";
import {
  Globe,
  Flag,
  Building2,
  TrendingUp,
  CheckCircle,
  Download,
  Check,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  Heart,
  Landmark,
  Crown,
  Coins,
  Eye,
  Users,
  Zap,
  Factory,
  Receipt,
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { BuilderSection } from "../lib/builder-theme";
import type { BuilderAlertResult } from "../lib/builder-alerts";
import { useBuilderContext } from "~/app/builder/components/enhanced/context/BuilderStateContext";
import { TAX_SYSTEM_TEMP_DISABLED } from "~/app/builder/constants";
import { scrollToField } from "../components/enhanced/tabs/utils/validation";

// Sub-navigation theme styles mapping
const SUBNAV_THEME_STYLES: Record<
  string,
  {
    active: string;
    inactive: string;
    iconActive: string;
    iconInactive: string;
  }
> = {
  identity: {
    active: "bg-teal-500/15 text-teal-400 font-bold",
    inactive: "text-foreground/50 hover:text-foreground/80 hover:bg-white/6",
    iconActive: "text-teal-400",
    iconInactive: "text-foreground/30",
  },
  government: {
    active: "bg-cyan-500/15 text-cyan-400 font-bold",
    inactive: "text-foreground/50 hover:text-foreground/80 hover:bg-white/6",
    iconActive: "text-cyan-400",
    iconInactive: "text-foreground/30",
  },
  economics: {
    active: "bg-emerald-500/15 text-emerald-400 font-bold",
    inactive: "text-foreground/50 hover:text-foreground/80 hover:bg-white/6",
    iconActive: "text-emerald-400",
    iconInactive: "text-foreground/30",
  },
  default: {
    active: "bg-amber-500/15 text-amber-400 font-bold",
    inactive: "text-foreground/50 hover:text-foreground/80 hover:bg-white/6",
    iconActive: "text-amber-400",
    iconInactive: "text-foreground/30",
  },
};

// Section icon map
const SECTION_ICONS: Record<BuilderSection, React.ComponentType<{ className?: string }>> = {
  foundation: Globe,
  identity: Flag,
  government: Building2,
  economics: TrendingUp,
  preview: CheckCircle,
  import: Download,
};

const SECTION_LABELS: Record<BuilderSection, string> = {
  foundation: "Foundation",
  identity: "Identity",
  government: "Government Builder",
  economics: "Economy Builder",
  preview: "Preview",
  import: "Import",
};

interface BuilderNotchBarProps {
  activeSection: BuilderSection;
  completedSteps: Set<BuilderSection>;
  accessibleSteps: Set<BuilderSection>;
  mode: "create" | "edit";
  onNavigate: (section: BuilderSection) => void;
  onBack: () => void;
  onContinue: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  /** Whether the notch is visible (can be hidden during transitions) */
  visible?: boolean;
  /** Unified alert results from useBuilderAlerts */
  alertResult?: BuilderAlertResult;
}

export function BuilderNotchBar({
  activeSection,
  completedSteps,
  accessibleSteps,
  mode,
  onNavigate,
  onBack,
  onContinue,
  onSubmit,
  isSubmitting,
  visible = true,
  alertResult,
}: BuilderNotchBarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);

  const state = useBuilderContext();

  const subTabs = useMemo(() => {
    if (activeSection === "identity") {
      const tabs = [];
      tabs.push({
        id: "archetype",
        label: "Archetype/Preset",
        icon: Globe,
        isActive: (st: any) =>
          (st.builderState.activeIdentitySubTab || "archetype") === "archetype",
        onClick: (st: any) =>
          st.setBuilderState((prev: any) => ({
            ...prev,
            activeIdentitySubTab: "archetype",
          })),
        isGreyed: true,
      });
      tabs.push(
        {
          id: "basic",
          label: "Basic Info",
          icon: Globe,
          isActive: (st: any) => st.builderState.activeIdentitySubTab === "basic",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({
              ...prev,
              activeIdentitySubTab: "basic",
            })),
        },
        {
          id: "culture",
          label: "Culture",
          icon: Heart,
          isActive: (st: any) => st.builderState.activeIdentitySubTab === "culture",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({
              ...prev,
              activeIdentitySubTab: "culture",
            })),
        },
        {
          id: "technical",
          label: "Technical",
          icon: Landmark,
          isActive: (st: any) => st.builderState.activeIdentitySubTab === "technical",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({
              ...prev,
              activeIdentitySubTab: "technical",
            })),
        }
      );
      return tabs;
    }
    if (activeSection === "government") {
      return [
        {
          id: "components",
          label: "Components",
          icon: Crown,
          isActive: (st: any) =>
            (st.builderState.activeGovernmentTab || "components") === "components",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({ ...prev, activeGovernmentTab: "components" })),
        },
        {
          id: "structure",
          label: "Departments",
          icon: Users,
          isActive: (st: any) => st.builderState.activeGovernmentTab === "structure",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({ ...prev, activeGovernmentTab: "structure" })),
        },
        {
          id: "spending",
          label: "Budget",
          icon: Coins,
          isActive: (st: any) => st.builderState.activeGovernmentTab === "spending",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({ ...prev, activeGovernmentTab: "spending" })),
        },
        {
          id: "preview",
          label: "Policies",
          icon: Eye,
          isActive: (st: any) => st.builderState.activeGovernmentTab === "preview",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({ ...prev, activeGovernmentTab: "preview" })),
        },
      ];
    }
    if (activeSection === "economics") {
      return [
        {
          id: "components",
          label: "Components",
          icon: Zap,
          isActive: (st: any) =>
            (st.builderState.activeEconomicsTab || "components") === "components",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({ ...prev, activeEconomicsTab: "components" })),
        },
        {
          id: "sectors",
          label: "Sectors",
          icon: Factory,
          isActive: (st: any) => st.builderState.activeEconomicsTab === "sectors",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({ ...prev, activeEconomicsTab: "sectors" })),
        },
        {
          id: "labor",
          label: "Labor Market",
          icon: Users,
          isActive: (st: any) => st.builderState.activeEconomicsTab === "labor",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({ ...prev, activeEconomicsTab: "labor" })),
        },
        {
          id: "demographics",
          label: "Demographics",
          icon: Globe,
          isActive: (st: any) => st.builderState.activeEconomicsTab === "demographics",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({ ...prev, activeEconomicsTab: "demographics" })),
        },
        {
          id: "tax",
          label: "Tax System",
          icon: Receipt,
          isActive: (st: any) => st.builderState.activeEconomicsTab === "tax",
          onClick: (st: any) =>
            st.setBuilderState((prev: any) => ({ ...prev, activeEconomicsTab: "tax" })),
          // When the global TAX_SYSTEM_TEMP_DISABLED flag is true, mark this subtab as disabled
          disabled: TAX_SYSTEM_TEMP_DISABLED,
        },
        // Per-economy preview/fiscal subtabs removed — moved to global Preview step
      ];
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, mode]);

  const steps = useMemo(() => {
    if (activeSection === "import") {
      return ["import", "identity", "government", "economics", "preview"] as BuilderSection[];
    }
    if (mode === "edit") {
      return ["identity", "government", "economics", "preview"] as BuilderSection[];
    }
    return ["foundation", "identity", "government", "economics", "preview"] as BuilderSection[];
  }, [activeSection, mode]);

  const isBackDisabled =
    mode === "edit" ? activeSection === "identity" : activeSection === "foundation";

  const isOnPreview = activeSection === "preview";
  const containerRef = useRef<HTMLDivElement>(null);
  const handleScrollRef = useRef<() => void>(() => {});
  const [isScrolled, setIsScrolled] = useState(false);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const threshold = 25;
    if (window.scrollY < threshold) {
      container.style.transform = "translateY(0px)";
      container.style.opacity = "1";
      container.style.visibility = "visible";
      setIsScrolled(false);
    } else {
      const height = container.offsetHeight || 60;
      container.style.transform = `translateY(${-height - 20}px)`;
      container.style.opacity = "0";
      container.style.visibility = "hidden";
      setIsScrolled(true);
    }
  };

  handleScrollRef.current = handleScroll;

  useEffect(() => {
    const onScroll = () => handleScrollRef.current();
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Sync scroll translation immediately after every render
  useEffect(() => {
    handleScrollRef.current();
  });

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="builder-notch"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.8 }}
            className="pointer-events-none sticky top-[68px] z-[900] w-full"
            style={{ paddingTop: "6px" }}
          >
            <div ref={containerRef} className="w-full transition-all duration-300 ease-in-out">
              {/* Notch bar */}
              <div
                className={cn(
                  "mx-auto max-w-[680px] px-2",
                  isScrolled ? "pointer-events-none" : "pointer-events-auto"
                )}
                style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.25))" }}
              >
                <div
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  className="relative flex flex-col gap-1.5 rounded-2xl border border-white/10 p-1.5 transition-all duration-300"
                  style={{
                    background: "var(--color-glass)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  }}
                >
                  <div className="flex w-full items-center gap-1 px-0.5">
                    {/* Back button */}
                    <button
                      onClick={onBack}
                      disabled={isBackDisabled}
                      className={cn(
                        "flex h-7 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[11px] font-semibold transition-all",
                        isBackDisabled
                          ? "text-muted-foreground/30 cursor-not-allowed opacity-40"
                          : "text-foreground/60 hover:text-foreground cursor-pointer hover:bg-white/10"
                      )}
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <PreText whiteSpace="nowrap">Back</PreText>
                    </button>

                    {/* Divider */}
                    <div className="h-4 w-px shrink-0 bg-white/10" />

                    {/* Section tabs — scrollable on mobile */}
                    <div
                      className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
                      style={{ scrollbarWidth: "none" }}
                    >
                      {steps.map((stepKey) => {
                        const isActive = stepKey === activeSection;
                        const isCompleted = completedSteps.has(stepKey);
                        const isAccessible = accessibleSteps.has(stepKey);
                        const Icon = SECTION_ICONS[stepKey];
                        const label = SECTION_LABELS[stepKey];
                        const isCollapsed =
                          activeSection === "import" &&
                          !isHovered &&
                          (stepKey === "identity" ||
                            stepKey === "government" ||
                            stepKey === "economics" ||
                            stepKey === "preview");

                        return (
                          <motion.div
                            key={stepKey}
                            initial={false}
                            animate={{
                              width: isCollapsed ? 0 : "auto",
                              opacity: isCollapsed ? 0 : 1,
                              marginRight: isCollapsed ? 0 : 4,
                            }}
                            transition={{ type: "spring", stiffness: 350, damping: 28 }}
                            className="flex min-w-0 shrink-0 overflow-hidden"
                            style={{ pointerEvents: isCollapsed ? "none" : "auto" }}
                          >
                            <button
                              disabled={!isAccessible}
                              onClick={() => isAccessible && onNavigate(stepKey)}
                              className={cn(
                                "relative flex min-w-0 shrink-0 items-center gap-1 rounded-xl px-1.5 py-1 text-[11px] font-semibold transition-all duration-200 sm:gap-1.5 sm:px-2.5",
                                stepKey === "foundation" && mode === "edit"
                                  ? isActive
                                    ? "text-foreground/40 bg-white/5"
                                    : "text-foreground/25 hover:text-foreground/50 cursor-pointer hover:bg-white/5"
                                  : isActive
                                    ? "bg-amber-500/15 text-amber-400"
                                    : isCompleted
                                      ? "cursor-pointer text-emerald-400/80 hover:bg-emerald-500/10 hover:text-emerald-300"
                                      : isAccessible
                                        ? "text-foreground/50 hover:text-foreground/80 cursor-pointer hover:bg-white/8"
                                        : "text-muted-foreground/25 cursor-not-allowed opacity-40"
                              )}
                            >
                              {/* Active indicator */}
                              {isActive && (stepKey !== "foundation" || mode !== "edit") && (
                                <motion.div
                                  layoutId="builder-notch-active"
                                  className="absolute inset-0 rounded-xl bg-amber-500/12"
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                              )}

                              <span className="relative flex min-w-0 items-center gap-1 sm:gap-1.5">
                                {isCompleted && !isActive ? (
                                  <span className="relative shrink-0">
                                    <Icon className="h-3 w-3 text-emerald-400/60" />
                                    <Check className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 p-[1px] text-white" />
                                  </span>
                                ) : (
                                  <Icon
                                    className={cn(
                                      "h-3 w-3 shrink-0",
                                      stepKey === "foundation" && mode === "edit"
                                        ? "text-foreground/20"
                                        : isActive
                                          ? "text-amber-400"
                                          : isAccessible
                                            ? "text-foreground/40"
                                            : "text-muted-foreground/25"
                                    )}
                                  />
                                )}
                                <PreText
                                  whiteSpace="nowrap"
                                  className={cn("hidden text-inherit sm:inline")}
                                >
                                  {label}
                                </PreText>
                              </span>
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Divider */}
                    <div className="h-4 w-px shrink-0 bg-white/10" />

                    {/* Alert Status Chip */}
                    {alertResult && alertResult.counts.total > 0 && (
                      <button
                        onClick={() => setAlertPanelOpen((v) => !v)}
                        className={cn(
                          "flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 text-[10px] font-bold transition-all",
                          alertResult.counts.error > 0
                            ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                            : alertResult.counts.warning > 0
                              ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                              : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                        )}
                      >
                        {alertResult.counts.error > 0 ? (
                          <AlertCircle className="h-2.5 w-2.5" />
                        ) : alertResult.counts.warning > 0 ? (
                          <AlertTriangle className="h-2.5 w-2.5" />
                        ) : (
                          <Info className="h-2.5 w-2.5" />
                        )}
                        <span>
                          {alertResult.counts.error > 0 && `${alertResult.counts.error}`}
                          {alertResult.counts.error > 0 && alertResult.counts.warning > 0 && "/"}
                          {alertResult.counts.warning > 0 && `${alertResult.counts.warning}`}
                          {alertResult.counts.error === 0 &&
                            alertResult.counts.warning === 0 &&
                            `${alertResult.counts.info}`}
                        </span>
                      </button>
                    )}
                    {alertResult && alertResult.counts.total === 0 && (
                      <div className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 text-[10px] font-bold text-emerald-400">
                        <CheckCircle className="h-2.5 w-2.5" />
                        <span>OK</span>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="h-4 w-px shrink-0 bg-white/10" />

                    {/* Continue / Submit */}
                    {isOnPreview && onSubmit ? (
                      <button
                        onClick={onSubmit}
                        disabled={isSubmitting}
                        className={cn(
                          "flex h-7 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold transition-all",
                          isSubmitting
                            ? "cursor-not-allowed bg-zinc-700/50 text-zinc-400"
                            : mode === "edit"
                              ? "cursor-pointer bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500"
                              : "cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500"
                        )}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <PreText whiteSpace="nowrap">
                              {mode === "edit" ? "Saving…" : "Creating…"}
                            </PreText>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 text-amber-200" />
                            <PreText whiteSpace="nowrap">
                              {mode === "edit" ? "Save" : "Create"}
                            </PreText>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={onContinue}
                        className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-3 text-[11px] font-bold text-zinc-950 transition-all hover:from-amber-400 hover:to-yellow-400"
                      >
                        <PreText whiteSpace="nowrap" className="text-zinc-950">
                          Continue
                        </PreText>
                        <ArrowRight className="h-3 w-3 text-zinc-950" />
                      </button>
                    )}
                  </div>

                  {/* Subnav row */}
                  <AnimatePresence initial={false}>
                    {subTabs.length > 0 && (
                      <motion.div
                        key="subnav-row"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 350, damping: 26 }}
                        className="w-full overflow-hidden border-t border-white/10 px-0.5 pt-1.5 pb-0.5"
                      >
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {subTabs.map((subTab) => {
                            const isActive = subTab.isActive(state);
                            const Icon = subTab.icon;
                            const activeStyle =
                              SUBNAV_THEME_STYLES[activeSection] || SUBNAV_THEME_STYLES.default;
                            const isDisabled = !!(subTab as any).disabled;
                            const isGreyed = !!(subTab as any).isGreyed;

                            return (
                              <button
                                key={subTab.id}
                                onClick={() => !isDisabled && subTab.onClick(state)}
                                disabled={isDisabled}
                                className={cn(
                                  "relative flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-semibold transition-all duration-200",
                                  isActive
                                    ? isGreyed
                                      ? "text-foreground/45 bg-white/5 font-bold"
                                      : activeStyle.active
                                    : isDisabled
                                      ? "text-muted-foreground/30 cursor-not-allowed opacity-50"
                                      : isGreyed
                                        ? "text-foreground/25 hover:text-foreground/50 hover:bg-white/5"
                                        : activeStyle.inactive
                                )}
                              >
                                {Icon && (
                                  <Icon
                                    className={cn(
                                      "h-3 w-3",
                                      isActive
                                        ? isGreyed
                                          ? "text-foreground/35"
                                          : activeStyle.iconActive
                                        : isDisabled
                                          ? "text-muted-foreground/25"
                                          : isGreyed
                                            ? "text-foreground/20"
                                            : activeStyle.iconInactive
                                    )}
                                  />
                                )}
                                <PreText whiteSpace="nowrap">{subTab.label}</PreText>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Alert Panel (expandable) */}
                  <AnimatePresence initial={false}>
                    {alertPanelOpen && alertResult && alertResult.counts.total > 0 && (
                      <motion.div
                        key="alert-panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 350, damping: 26 }}
                        className="w-full overflow-hidden border-t border-white/10 px-2 pt-2 pb-1"
                      >
                        <div
                          className="max-h-[200px] space-y-1.5 overflow-y-auto pr-1"
                          style={{ scrollbarWidth: "thin" }}
                        >
                          {/* Errors */}
                          {alertResult.alerts.filter((a) => a.severity === "error").length > 0 && (
                            <div className="space-y-0.5">
                              <div className="text-[8px] font-bold tracking-wider text-red-500/80 uppercase">
                                Errors
                              </div>
                              {alertResult.alerts
                                .filter((a) => a.severity === "error")
                                .map((alert, idx) => (
                                  <button
                                    key={`err-${idx}`}
                                    onClick={() => {
                                      if (alert.section !== activeSection) {
                                        onNavigate(alert.section);
                                      }
                                      if (alert.tab) {
                                        // Switch to the right sub-tab
                                        const tabKey =
                                          alert.section === "economics"
                                            ? "activeEconomicsTab"
                                            : alert.section === "government"
                                              ? "activeGovernmentTab"
                                              : null;
                                        if (tabKey) {
                                          state.setBuilderState((prev: any) => ({
                                            ...prev,
                                            [tabKey]: alert.tab,
                                          }));
                                        }
                                      }
                                      if (alert.field) {
                                        requestAnimationFrame(() => scrollToField(alert.field!));
                                      }
                                      setAlertPanelOpen(false);
                                    }}
                                    className="flex w-full items-start gap-1.5 rounded-lg px-2 py-1 text-left text-[10px] leading-tight text-red-400 transition-colors hover:bg-red-500/10"
                                  >
                                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                    <span className="flex-1">{alert.message}</span>
                                  </button>
                                ))}
                            </div>
                          )}
                          {/* Warnings */}
                          {alertResult.alerts.filter((a) => a.severity === "warning").length >
                            0 && (
                            <div className="space-y-0.5">
                              <div className="text-[8px] font-bold tracking-wider text-amber-500/80 uppercase">
                                Warnings
                              </div>
                              {alertResult.alerts
                                .filter((a) => a.severity === "warning")
                                .map((alert, idx) => (
                                  <button
                                    key={`warn-${idx}`}
                                    onClick={() => {
                                      if (alert.section !== activeSection) {
                                        onNavigate(alert.section);
                                      }
                                      if (alert.tab) {
                                        const tabKey =
                                          alert.section === "economics"
                                            ? "activeEconomicsTab"
                                            : alert.section === "government"
                                              ? "activeGovernmentTab"
                                              : null;
                                        if (tabKey) {
                                          state.setBuilderState((prev: any) => ({
                                            ...prev,
                                            [tabKey]: alert.tab,
                                          }));
                                        }
                                      }
                                      if (alert.field) {
                                        requestAnimationFrame(() => scrollToField(alert.field!));
                                      }
                                      setAlertPanelOpen(false);
                                    }}
                                    className="flex w-full items-start gap-1.5 rounded-lg px-2 py-1 text-left text-[10px] leading-tight text-amber-400 transition-colors hover:bg-amber-500/10"
                                  >
                                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                    <span className="flex-1">{alert.message}</span>
                                  </button>
                                ))}
                            </div>
                          )}
                          {/* Info */}
                          {alertResult.alerts.filter((a) => a.severity === "info").length > 0 && (
                            <div className="space-y-0.5">
                              <div className="text-[8px] font-bold tracking-wider text-blue-500/80 uppercase">
                                Info
                              </div>
                              {alertResult.alerts
                                .filter((a) => a.severity === "info")
                                .map((alert, idx) => (
                                  <button
                                    key={`info-${idx}`}
                                    onClick={() => {
                                      if (alert.section !== activeSection) {
                                        onNavigate(alert.section);
                                      }
                                      if (alert.field) {
                                        requestAnimationFrame(() => scrollToField(alert.field!));
                                      }
                                      setAlertPanelOpen(false);
                                    }}
                                    className="flex w-full items-start gap-1.5 rounded-lg px-2 py-1 text-left text-[10px] leading-tight text-blue-400 transition-colors hover:bg-blue-500/10"
                                  >
                                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                                    <span className="flex-1">{alert.message}</span>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flanking buttons when scrolled */}
      <AnimatePresence>
        {isScrolled && visible && (
          <>
            {/* Left Back button flanking the DI */}
            <motion.div
              key="flank-back"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ type: "spring", stiffness: 450, damping: 30 }}
              className="pointer-events-auto fixed top-[13px] right-[calc(50%+225px)] z-[10001] hidden sm:block"
            >
              <button
                onClick={onBack}
                disabled={isBackDisabled}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-semibold shadow-lg backdrop-blur-md transition-all select-none",
                  "hover:text-foreground text-foreground/80 bg-black/50 hover:scale-105 hover:bg-black/70 active:scale-95",
                  isBackDisabled &&
                    "text-muted-foreground/30 cursor-not-allowed opacity-30 hover:scale-100 active:scale-100"
                )}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            </motion.div>

            {/* Right Continue/Submit button flanking the DI */}
            <motion.div
              key="flank-continue"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ type: "spring", stiffness: 450, damping: 30 }}
              className="pointer-events-auto fixed top-[13px] left-[calc(50%+225px)] z-[10001] hidden sm:block"
            >
              {isOnPreview && onSubmit ? (
                <button
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold shadow-lg transition-all select-none hover:scale-105 active:scale-95",
                    isSubmitting
                      ? "cursor-not-allowed bg-zinc-700/50 text-zinc-400"
                      : mode === "edit"
                        ? "cursor-pointer bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500"
                        : "cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{mode === "edit" ? "Saving" : "Creating"}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                      <span>{mode === "edit" ? "Save" : "Create"}</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={onContinue}
                  className="flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-3.5 text-xs font-bold text-zinc-950 shadow-lg transition-all select-none hover:scale-105 hover:from-amber-400 hover:to-yellow-400 active:scale-95"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-950" />
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
