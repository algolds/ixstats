"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Crown,
  Calendar,
  Globe,
  Eye,
  Shield,
  Landmark,
  Map,
  Search,
  X,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  Gavel,
} from "lucide-react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { getUpcomingEvents, formatRelativeIxDays } from "~/lib/statecraft-almanac";
import { useUser } from "~/context/auth-context";
import { withBasePath } from "~/lib/base-path";
import { createAbsoluteUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";
import { PreText } from "~/components/ui/pretext";
import { motion, AnimatePresence } from "motion/react";
import type { DIViewProps } from "./types";

interface CommandItem {
  id: string;
  category: "Upcoming" | "Navigation" | "Executive Actions" | "Issues & Recommendations";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  priority?: "low" | "medium" | "high" | "critical";
}

export function MyCountryCommandPalette({ onClose }: DIViewProps) {
  const router = useRouter();
  const { user } = useUser();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Auto-focus search input on mount
  useEffect(() => {
    const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Fetch user profile to get country ID
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
  });
  const countryId = userProfile?.countryId;

  // Fetch active issues
  const { data: issuesData, isLoading: issuesLoading } = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId ?? "", status: "active" },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  // Fetch policy recommendations
  const { data: recommendations, isLoading: recommendationsLoading } =
    api.quickActions.getPolicyRecommendations.useQuery(
      { countryId: countryId ?? "", limit: 5 },
      { enabled: !!countryId, staleTime: 30_000 }
    );

  const navigateToSection = useCallback(
    (section: string) => {
      onClose();
      const href = section === "overview" ? "/mycountry" : `/mycountry/${section}`;
      if (typeof window !== "undefined" && window.location.pathname.includes("/mycountry")) {
        window.history.pushState(null, "", withBasePath(href));
        window.dispatchEvent(new PopStateEvent("popstate"));
      } else {
        window.location.href = createAbsoluteUrl(href);
      }
    },
    [onClose]
  );

  // 1. Navigation items
  const navItems = useMemo<CommandItem[]>(
    () => [
      {
        id: "nav-overview",
        category: "Navigation",
        title: "Overview Dashboard",
        description: "Return to MyCountry central command panel",
        icon: Crown,
        action: () => navigateToSection("overview"),
      },
      {
        id: "nav-executive",
        category: "Navigation",
        title: "Executive Command",
        description: "Schedule cabinet meetings and draft policies",
        icon: Calendar,
        action: () => navigateToSection("executive"),
      },
      {
        id: "nav-diplomacy",
        category: "Navigation",
        title: "Diplomatic Operations",
        description: "Manage foreign relations and establish embassies",
        icon: Globe,
        action: () => navigateToSection("diplomacy"),
      },
      {
        id: "nav-intelligence",
        category: "Navigation",
        title: "Intelligence Dashboard",
        description: "Access national security and intelligence briefings",
        icon: Eye,
        action: () => navigateToSection("intelligence"),
      },
      {
        id: "nav-defense",
        category: "Navigation",
        title: "Defense & Security",
        description: "Command armed forces and monitor border threats",
        icon: Shield,
        action: () => navigateToSection("defense"),
      },
      {
        id: "nav-politics",
        category: "Navigation",
        title: "Political Landscape",
        description: "Review cabinet appointments and political parties",
        icon: Landmark,
        action: () => navigateToSection("politics"),
      },
      {
        id: "nav-map-editor",
        category: "Navigation",
        title: "Map Editor",
        description: "Shape territory borders and mark key cities",
        icon: Map,
        action: () => navigateToSection("map-editor"),
      },
    ],
    [navigateToSection]
  );

  // 2. Quick Action items
  const actionItems = useMemo<CommandItem[]>(
    () => [
      {
        id: "act-meeting",
        category: "Executive Actions",
        title: "Schedule Cabinet Meeting",
        description: "Bring officials together to discuss and make decisions",
        icon: Calendar,
        action: () => navigateToSection("executive"),
      },
      {
        id: "act-policy",
        category: "Executive Actions",
        title: "Draft New Policy",
        description: "Create economic, social, or governance rules",
        icon: Gavel,
        action: () => navigateToSection("executive"),
      },
      {
        id: "act-embassy",
        category: "Executive Actions",
        title: "Establish New Embassy",
        description: "Propose diplomatic missions with other nations",
        icon: Globe,
        action: () => navigateToSection("diplomacy"),
      },
      {
        id: "act-profile",
        category: "Executive Actions",
        title: "Edit Country Profile",
        description: "Change country description, motto, or alignment",
        icon: Crown,
        action: () => {
          onClose();
          if (typeof window !== "undefined" && window.location.pathname.includes("/mycountry")) {
            window.location.href = createAbsoluteUrl("/mycountry/editor");
          } else {
            router.push("/mycountry/editor");
          }
        },
      },
    ],
    [navigateToSection, onClose, router]
  );

  // Statecraft Almanac in the Halo: the upcoming dated events, same pure feed as the
  // MyCountry hero calendar. See plans/statecraft-stage1.md (S1.A.3).
  const { data: electionsData } = api.elections.getElections.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const almanacItems = useMemo<CommandItem[]>(() => {
    if (!countryId) return [];
    const now = IxTime.getCurrentIxTime();
    const events = getUpcomingEvents({
      nowIxTime: now,
      elections: (electionsData ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        scheduledIxTime: e.scheduledIxTime,
        status: e.status,
      })),
      issueDeadlines: (issuesData?.issues ?? []).map((i) => ({
        id: i.id,
        title: i.title,
        deadlineIxTime: (i as { deadlineIxTime?: number | null }).deadlineIxTime,
      })),
    });
    return events.slice(0, 5).map((ev) => ({
      id: `almanac-${ev.id}`,
      category: "Upcoming" as const,
      title: ev.label,
      description: formatRelativeIxDays(ev.ixTime, now),
      icon: Calendar,
      action: () => navigateToSection(ev.section),
    }));
  }, [countryId, electionsData, issuesData, navigateToSection]);

  // 3. Dynamic active issues
  const activeIssues = useMemo<CommandItem[]>(() => {
    return (issuesData?.issues || []).map((issue) => ({
      id: `issue-${issue.id}`,
      category: "Issues & Recommendations" as const,
      title: issue.title,
      description: `Urgent decision needed (Urgency: ${issue.urgency}/100)`,
      icon: ShieldAlert,
      priority: issue.urgency > 75 ? ("high" as const) : ("medium" as const),
      action: () => navigateToSection("executive"),
    }));
  }, [issuesData, navigateToSection]);

  // 4. Dynamic policy recommendations
  const policyRecs = useMemo<CommandItem[]>(() => {
    return (recommendations || []).map((rec) => ({
      id: `rec-${rec.id ?? rec.name}`,
      category: "Issues & Recommendations" as const,
      title: `Recommended: ${rec.name}`,
      description: rec.description || "Enact recommended policy for your economy",
      icon: Sparkles,
      action: () => navigateToSection("executive"),
    }));
  }, [recommendations, navigateToSection]);

  // Combined command list
  const allItems = useMemo<CommandItem[]>(() => {
    return [...almanacItems, ...activeIssues, ...policyRecs, ...navItems, ...actionItems];
  }, [almanacItems, activeIssues, policyRecs, navItems, actionItems]);

  // Filter commands by search text
  const filteredItems = useMemo<CommandItem[]>(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  // Keyboard navigation handlers
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Reset selection index when query/results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const selectedEl = listContainerRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const isLoading = issuesLoading || recommendationsLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex flex-col p-4 w-full text-left"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]">
          <Crown className="h-4 w-4 animate-pulse" />
          <PreText className="text-inherit" whiteSpace="nowrap">
            MyCountry® Quick Actions
          </PreText>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/15 flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
          aria-label="Close Quick Actions"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="text-muted-foreground/50 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Type a command, policy, or section..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-accent/10 text-foreground placeholder:text-muted-foreground/40 focus:bg-accent/15 w-full rounded-lg border border-transparent py-2.5 pr-4 pl-10 text-sm transition-all focus:border-amber-500/30 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
        />
      </div>

      {/* Commands / Navigation Options List */}
      <div
        ref={listContainerRef}
        className="min-h-[220px] max-h-[300px] overflow-y-auto space-y-1.5 scrollbar-thin pr-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {isLoading && filteredItems.length === 0 ? (
          /* Loading shimmers */
          <div className="space-y-2 py-4">
            <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
            <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
            <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
          </div>
        ) : filteredItems.length > 0 ? (
          (() => {
            let lastCat = "";
            return filteredItems.map((item, idx) => {
              const showCategoryHeader = item.category !== lastCat;
              lastCat = item.category;
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;

              return (
                <div key={item.id} className="space-y-1">
                  {showCategoryHeader && (
                    <div className="text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase pt-2 pb-1 pl-2">
                      <PreText whiteSpace="nowrap">{item.category}</PreText>
                    </div>
                  )}

                  <button
                    data-index={idx}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all duration-150 relative overflow-hidden group",
                      isSelected
                        ? "bg-amber-500/10 border-amber-500/25 shadow-[0_0_12px_rgba(245,158,11,0.08)]"
                        : "bg-transparent border-transparent hover:bg-white/[0.03]"
                    )}
                  >
                    {/* Glassy reflection card border */}
                    {isSelected && (
                      <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-lg" />
                    )}

                    {/* Icon container */}
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-white/[0.03] text-muted-foreground/75 group-hover:bg-white/[0.06]"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Meta info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <PreText
                          className={cn(
                            "text-sm font-semibold truncate",
                            isSelected ? "text-amber-400" : "text-foreground/90"
                          )}
                          whiteSpace="nowrap"
                        >
                          {item.title}
                        </PreText>

                        {/* Status Priority badge */}
                        {item.priority === "high" && (
                          <span className="shrink-0 rounded bg-red-500/15 border border-red-500/20 px-1 py-0.5 text-[8px] font-bold text-red-400 uppercase tracking-wider">
                            Urgent
                          </span>
                        )}
                      </div>
                      <PreText
                        className={cn(
                          "text-xs truncate block",
                          isSelected ? "text-amber-300/70" : "text-muted-foreground/80"
                        )}
                        whiteSpace="nowrap"
                      >
                        {item.description}
                      </PreText>
                    </div>

                    {/* Indicator Icon */}
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 transition-all",
                        isSelected
                          ? "text-amber-400 translate-x-0.5"
                          : "text-muted-foreground/30 group-hover:text-muted-foreground/60"
                      )}
                    />
                  </button>
                </div>
              );
            });
          })()
        ) : (
          /* Empty results */
          <div className="py-10 text-center">
            <Search className="text-muted-foreground/20 mx-auto mb-3 h-8 w-8" />
            <PreText className="text-muted-foreground text-sm font-medium" whiteSpace="nowrap">
              No matching commands or actions found
            </PreText>
            <PreText className="text-muted-foreground/60 mt-1 text-xs" whiteSpace="nowrap">
              Try searching for a different term
            </PreText>
          </div>
        )}
      </div>

      {/* Keyboard guide footer */}
      <div className="border-t border-white/5 mt-3 pt-2.5 flex items-center justify-between text-[10px] text-muted-foreground/60 pl-1">
        <div className="flex items-center gap-1.5">
          <kbd className="bg-white/5 rounded px-1.5 py-0.5 border border-white/5 font-mono">↑↓</kbd>
          <span>navigate</span>
          <span className="text-muted-foreground/30">·</span>
          <kbd className="bg-white/5 rounded px-1.5 py-0.5 border border-white/5 font-mono">↵</kbd>
          <span>select</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="bg-white/5 rounded px-1.5 py-0.5 border border-white/5 font-mono">Esc</kbd>
          <span>close</span>
        </div>
      </div>
    </motion.div>
  );
}
