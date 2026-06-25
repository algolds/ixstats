"use client";

import React, { useState } from "react";
import {
  Crown,
  Landmark,
  Layers,
  Mail,
  Shield,
  Brain,
  Vote,
  Handshake,
  Check,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { MyCountrySection } from "./MyCountrySidebarNav";

export interface AgendaItem {
  id: string;
  label: string;
  text: string;
  section: MyCountrySection;
  borderClass: string;
  icon: React.ComponentType<{ className?: string }>;
  priority: number;
}

interface AgendaCounts {
  urgentIssueCount: number;
  issueCount: number;
  policiesTotal: number;
  activePolicies: number;
  pendingActions: number;
  messageUnreadCount: number;
  threats: number;
  securityScore: number;
  critAlerts: number;
  pendingElections: number;
  noEmbassies: boolean;
}

/**
 * Single source of truth for the MyCountry daily agenda. Used by both the
 * OverviewHero Smart Stack and the expanded Halo. Pure — pass in already
 * computed counts.
 */
export function buildAgendaItems(c: AgendaCounts): AgendaItem[] {
  const list: AgendaItem[] = [];

  // 1. Cabinet Issues (Urgent or Pending)
  if (c.urgentIssueCount > 0) {
    list.push({
      id: "exec-urgent",
      label: "Urgent Issues",
      text: `${c.urgentIssueCount} urgent issue${c.urgentIssueCount !== 1 ? "s" : ""} require response`,
      section: "executive",
      borderClass: "border-red-500/40 text-red-500 bg-red-500/5 dark:bg-red-500/10",
      icon: Crown,
      priority: 1,
    });
  } else if (c.issueCount > 0) {
    list.push({
      id: "exec-pending",
      label: "Cabinet Issues",
      text: `${c.issueCount} pending issue${c.issueCount !== 1 ? "s" : ""} in cabinet`,
      section: "executive",
      borderClass: "border-amber-500/40 text-amber-500 bg-amber-500/5 dark:bg-amber-500/10",
      icon: Crown,
      priority: 2,
    });
  }

  // 2. Active Policies Setup
  if (c.policiesTotal > 0 && c.activePolicies < c.policiesTotal) {
    const inactive = c.policiesTotal - c.activePolicies;
    list.push({
      id: "exec-policies",
      label: "Policy Setup",
      text: `${inactive} draft/inactive polic${inactive !== 1 ? "ies" : "y"} pending`,
      section: "executive",
      borderClass: "border-emerald-500/40 text-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10",
      icon: Landmark,
      priority: 3,
    });
  }

  // 3. Meeting Action Items
  if (c.pendingActions > 0) {
    list.push({
      id: "exec-actions",
      label: "Meeting Actions",
      text: `${c.pendingActions} action item${c.pendingActions !== 1 ? "s" : ""} pending`,
      section: "executive",
      borderClass: "border-orange-500/40 text-orange-500 bg-orange-500/5 dark:bg-orange-500/10",
      icon: Layers,
      priority: 2,
    });
  }

  // 4. Unread Messages
  if (c.messageUnreadCount > 0) {
    list.push({
      id: "diplo-unread-messages",
      label: "Unread Messages",
      text: `${c.messageUnreadCount} unread message${c.messageUnreadCount !== 1 ? "s" : ""} in inbox`,
      section: "diplomacy",
      borderClass: "border-blue-500/40 text-blue-500 bg-blue-500/5 dark:bg-blue-500/10",
      icon: Mail,
      priority: 2,
    });
  }

  // 5. Defense Threats / Assessment
  if (c.threats > 0) {
    list.push({
      id: "def-threats",
      label: "Security Threats",
      text: `${c.threats} active threat${c.threats !== 1 ? "s" : ""} detected`,
      section: "defense",
      borderClass: "border-red-500/40 text-red-500 bg-red-500/5 dark:bg-red-500/10",
      icon: Shield,
      priority: 1,
    });
  } else if (c.securityScore < 60) {
    list.push({
      id: "def-low-score",
      label: "Defense Readiness",
      text: `Defense Readiness Score is low: ${c.securityScore}/100`,
      section: "defense",
      borderClass: "border-amber-500/40 text-amber-500 bg-amber-500/5 dark:bg-amber-500/10",
      icon: Shield,
      priority: 2,
    });
  }

  // 6. Intelligence Security Alerts
  if (c.critAlerts > 0) {
    list.push({
      id: "intel-critical",
      label: "Intel Security",
      text: `${c.critAlerts} critical intelligence alert${c.critAlerts !== 1 ? "s" : ""}`,
      section: "intelligence",
      borderClass: "border-red-500/40 text-red-500 bg-red-500/5 dark:bg-red-500/10",
      icon: Brain,
      priority: 1,
    });
  }

  // 7. Elections
  if (c.pendingElections > 0) {
    list.push({
      id: "pol-elections",
      label: "Elections",
      text: `${c.pendingElections} active/scheduled election${c.pendingElections !== 1 ? "s" : ""}`,
      section: "politics",
      borderClass: "border-purple-500/40 text-purple-500 bg-purple-500/5 dark:bg-purple-500/10",
      icon: Vote,
      priority: 3,
    });
  }

  // 8. Embassies Setup
  if (c.noEmbassies) {
    list.push({
      id: "diplo-no-emb",
      label: "Diplomatic Embassies",
      text: "Establish your first embassy",
      section: "diplomacy",
      borderClass: "border-cyan-500/40 text-cyan-500 bg-cyan-500/5 dark:bg-cyan-500/10",
      icon: Handshake,
      priority: 3,
    });
  }

  return list;
}

interface SmartStackProps {
  items: AgendaItem[];
  onResolve: (section: MyCountrySection) => void;
  className?: string;
}

/** iOS Smart-Stack style paginated agenda card. */
export function SmartStack({ items, onResolve, className }: SmartStackProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const current = items[activeIndex] ?? items[0];

  return (
    <div
      className={cn(
        "relative flex h-[105px] w-full items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-2.5 backdrop-blur-md",
        className
      )}
    >
      {current ? (
        <div className="flex w-full items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
              current.borderClass
            )}
          >
            <current.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <span className="text-muted-foreground/60 text-[8px] font-bold tracking-wider uppercase">
              {current.label}
            </span>
            <p className="text-foreground mt-0.5 truncate text-[10px] leading-tight font-semibold">
              {current.text}
            </p>
            <button
              onClick={() => onResolve(current.section)}
              className="mt-1 flex items-center gap-0.5 text-[8px] font-bold text-amber-500 hover:text-amber-400 hover:underline"
            >
              Resolve Task <ChevronRight className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center justify-center py-2 text-center text-emerald-500">
          <Check className="mb-1 h-5 w-5" />
          <span className="text-[10px] font-bold">All sectors operating normally</span>
          <p className="text-muted-foreground/60 mt-0.5 text-[8px]">
            Your daily agenda is completely clear.
          </p>
        </div>
      )}

      {items.length > 1 && (
        <div className="absolute top-0 right-2 bottom-0 z-20 flex flex-col justify-center gap-1">
          <button
            onClick={() => setActiveIndex((prev) => (prev - 1 + items.length) % items.length)}
            className="text-muted-foreground/50 hover:text-foreground/80 p-0.5 transition-colors active:scale-90"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <div className="my-0.5 flex flex-col items-center gap-1">
            {items.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1 w-1 rounded-full transition-all duration-300",
                  idx === activeIndex ? "scale-125 bg-amber-500" : "bg-white/20"
                )}
              />
            ))}
          </div>
          <button
            onClick={() => setActiveIndex((prev) => (prev + 1) % items.length)}
            className="text-muted-foreground/50 hover:text-foreground/80 p-0.5 transition-colors active:scale-90"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
