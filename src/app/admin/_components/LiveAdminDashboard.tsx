"use client";
// src/app/admin/_components/LiveAdminDashboard.tsx

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./AdminHeader";
import { WarningPanel } from "./WarningPanel";
import { SystemCronScheduleWidget } from "./SystemCronScheduleWidget";
import { SystemLogs } from "./SystemLogs";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "~/components/ui/tooltip";
import {
  Dashboard as LayoutDashboard,
  Settings,
  Gamepad as Gamepad2,
  Group as Users,
  Package,
  Component as Layers,
  Coins,
  OpenBook as BookOpen,
  Database,
  Activity,
  CheckSquare as Vote,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
} from "iconoir-react";

interface LiveAdminDashboardProps {
  onNavigate?: (section: string) => void;
}

export function LiveAdminDashboard({ onNavigate }: LiveAdminDashboardProps) {
  usePageTitle({ title: "Admin Dashboard" });
  const [quickActionsCollapsed, setQuickActionsCollapsed] = useState(true);

  const { data: systemStatus } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  const QUICK_ACTIONS = useMemo(
    () => [
      {
        icon: Settings,
        label: "General Settings",
        description: "Time, economy & general parameters",
        href: "/admin/settings",
        section: "settings",
        color: "blue",
      },
      {
        icon: Gamepad2,
        label: "Storyteller",
        description: "World events & narrative tools",
        href: "/admin/storyteller",
        section: "storyteller",
        color: "purple",
      },
      {
        icon: Users,
        label: "User Management",
        description: "User list & country binders",
        href: "/admin/user-management",
        section: "user-management",
        color: "emerald",
      },
      {
        icon: Users,
        label: "User Roles",
        description: "Role assignments & permissions",
        href: "/admin/user-roles",
        section: "user-roles",
        color: "amber",
      },
      {
        icon: Package,
        label: "Card Settings",
        description: "Sync, packs, lore & seasons",
        href: "/admin/cards",
        section: "cards",
        color: "amber",
      },
      {
        icon: Layers,
        label: "Facet Materials Lab",
        description: "Material configurator & sandbox",
        href: "/admin/facet-lab",
        section: "facet-lab",
        color: "teal",
      },
      {
        icon: Coins,
        label: "Vault Settings",
        description: "Balances, streaks & store",
        href: "/admin/vault",
        section: "vault",
        color: "amber",
      },
      {
        icon: BookOpen,
        label: "WikiOS Settings",
        description: "Wiki page link configurations",
        href: "/admin/wikios-settings",
        section: "wikios-settings",
        color: "indigo",
      },
      {
        icon: Database,
        label: "Reference Data",
        description: "Unified database manager",
        href: "/admin/reference-data",
        section: "reference-data",
        color: "rose",
      },
      {
        icon: Activity,
        label: "User Logs",
        description: "Audit trail & terminal outputs",
        href: "/admin/user-logs",
        section: "user-logs",
        color: "indigo",
      },
      {
        icon: Vote,
        label: "Polls Management",
        description: "Create and manage active polls",
        href: "/admin/polls",
        section: "polls",
        color: "purple",
      },
    ],
    []
  );

  const handleActionClick = (e: React.MouseEvent, href: string, section: string) => {
    if (onNavigate && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
      e.preventDefault();
      onNavigate(section);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={LayoutDashboard}
        title="Admin Dashboard"
        description="System overview and quick actions"
      />

      {/* Quick Actions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-bold tracking-tight">Quick Actions</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setQuickActionsCollapsed(!quickActionsCollapsed)}
            className="text-muted-foreground hover:text-foreground flex h-8 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs"
          >
            {quickActionsCollapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Expand</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>

        <TooltipProvider delayDuration={150}>
          {quickActionsCollapsed ? (
            <div className="border-border/30 bg-card/25 flex flex-wrap items-center gap-2.5 rounded-2xl border p-3 shadow-xs backdrop-blur-md">
              {QUICK_ACTIONS.map((action) => (
                <Tooltip key={action.label}>
                  <TooltipTrigger asChild>
                    <Link
                      href={action.href}
                      onClick={(e) => handleActionClick(e, action.href, action.section)}
                      className="bg-primary/5 border-border/30 hover:border-primary/30 hover:bg-primary/10 text-primary group block rounded-xl border p-2.5 transition-all duration-200 active:scale-[0.95]"
                    >
                      <action.icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="bg-card/95 border-border/40 max-w-xs p-2.5 text-left shadow-md backdrop-blur-md"
                  >
                    <p className="text-foreground text-xs font-bold">{action.label}</p>
                    <p className="text-muted-foreground mt-0.5 text-[10px]">{action.description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  onClick={(e) => handleActionClick(e, action.href, action.section)}
                  className="border-border/30 bg-card/25 hover:border-primary/40 group flex items-center justify-between rounded-2xl border p-3.5 shadow-xs backdrop-blur-md transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 border-border/20 group-hover:bg-primary/20 text-primary rounded-xl border p-2 transition-colors">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-foreground group-hover:text-primary text-xs font-bold transition-colors">
                        {action.label}
                      </h3>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TooltipProvider>
      </div>

      {/* Cron Schedules & Logs */}
      <div className="space-y-6">
        <SystemCronScheduleWidget />
        <SystemLogs />
      </div>

      {/* Warnings */}
      {systemStatus && <WarningPanel systemStatus={systemStatus} />}
    </div>
  );
}
