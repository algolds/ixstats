"use client";
// src/app/admin/_components/LiveAdminDashboard.tsx

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { WarningPanel } from "./WarningPanel";
import { SystemCronScheduleWidget } from "./SystemCronScheduleWidget";
import { SystemLogs } from "./SystemLogs";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "~/components/ui/tooltip";
import {
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
import { Card } from "~/components/ui/card";

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
        label: "General settings",
        description: "Time, economy & general parameters",
        href: "/admin/platform",
        section: "platform",
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
        label: "User management",
        description: "User list & country binders",
        href: "/admin/users",
        section: "users",
        color: "emerald",
      },
      {
        icon: Users,
        label: "User roles",
        description: "Role assignments & permissions",
        href: "/admin/user-roles",
        section: "user-roles",
        color: "amber",
      },
      {
        icon: Package,
        label: "Card settings",
        description: "Sync, packs, lore & seasons",
        href: "/admin/cards",
        section: "cards",
        color: "amber",
      },
      {
        icon: Layers,
        label: "Facet materials lab",
        description: "Material configurator & sandbox",
        href: "/admin/facet-lab",
        section: "facet-lab",
        color: "teal",
      },
      {
        icon: Coins,
        label: "Vault settings",
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
        label: "Reference data",
        description: "Unified database manager",
        href: "/admin/reference-data",
        section: "reference-data",
        color: "rose",
      },
      {
        icon: Activity,
        label: "User logs",
        description: "Audit trail & terminal outputs",
        href: "/admin/logs",
        section: "logs",
        color: "indigo",
      },
      {
        icon: Vote,
        label: "Polls management",
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
      <PageHeader title="Admin dashboard" />

      {/* Quick Actions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-label text-headline">Quick actions</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setQuickActionsCollapsed(!quickActionsCollapsed)}
            className="flex items-center gap-2"
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
            <Card className="flex flex-wrap items-center gap-2 p-3">
              {QUICK_ACTIONS.map((action) => (
                <Tooltip key={action.label}>
                  <TooltipTrigger asChild>
                    <Link
                      href={action.href}
                      onClick={(e) => handleActionClick(e, action.href, action.section)}
                      className="bg-tint-fill border-separator hover:border-tint/30 hover:bg-tint-fill text-tint group rounded-row duration-fast block border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.95]"
                    >
                      <action.icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs p-3 text-left">
                    <p className="text-label text-caption">{action.label}</p>
                    <p className="text-label-secondary text-footnote mt-0.5">
                      {action.description}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  onClick={(e) => handleActionClick(e, action.href, action.section)}
                  className="border-separator bg-surface hover:border-tint/40 group rounded-card shadow-card flex items-center justify-between border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-tint-fill border-separator group-hover:bg-tint-fill text-tint rounded-row border p-2 transition-colors">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-label group-hover:text-tint text-caption transition-colors">
                        {action.label}
                      </h3>
                      <p className="text-label-secondary text-footnote mt-0.5">
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
