// src/app/admin/_components/LiveAdminDashboard.tsx
"use client";

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
  LayoutDashboard,
  Settings,
  Gamepad2,
  Users,
  Package,
  Layers,
  Coins,
  BookOpen,
  Database,
  Activity,
  Vote,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface LiveAdminDashboardProps {
  onNavigate?: (section: string) => void;
}

export function LiveAdminDashboard({ onNavigate }: LiveAdminDashboardProps) {
  usePageTitle({ title: "Admin Dashboard" });
  const [quickActionsCollapsed, setQuickActionsCollapsed] = useState(true);

  const { data: systemStatus } = api.admin.getSystemStatus.useQuery(
    undefined,
    { refetchInterval: 30000, refetchOnWindowFocus: false }
  );

  const QUICK_ACTIONS = useMemo(() => [
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
  ], []);

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
            <div className="glass-surface border-border/40 flex flex-wrap items-center gap-3.5 rounded-xl p-3.5 shadow-sm">
              {QUICK_ACTIONS.map((action) => (
                <Tooltip key={action.label}>
                  <TooltipTrigger asChild>
                    <Link
                      href={action.href}
                      onClick={(e) => handleActionClick(e, action.href, action.section)}
                      className="bg-primary/5 border-border/30 hover:border-primary/30 hover:bg-primary/10 text-primary group block rounded-xl border p-3 transition-all duration-200 hover:scale-108 hover:shadow-md"
                    >
                      <action.icon className="h-5 w-5 transition-transform group-hover:rotate-6" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="bg-card/95 border-border/40 max-w-xs p-2.5 text-left shadow-md"
                  >
                    <p className="text-foreground text-xs font-bold">{action.label}</p>
                    <p className="text-muted-foreground mt-0.5 text-[10px]">{action.description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  onClick={(e) => handleActionClick(e, action.href, action.section)}
                  className="glass-surface border-border/40 hover:border-primary/30 group flex items-center justify-between rounded-xl p-4 transition-all duration-250 hover:scale-[1.015] hover:shadow-md"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="bg-primary/5 border-border/30 group-hover:bg-primary/10 rounded-xl border p-2.5 transition-colors">
                      <action.icon className="text-primary h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-foreground group-hover:text-primary text-sm font-semibold transition-colors">
                        {action.label}
                      </h3>
                      <p className="text-muted-foreground mt-0.5 text-xs">{action.description}</p>
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
