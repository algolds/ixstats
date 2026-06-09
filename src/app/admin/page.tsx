// src/app/admin/page.tsx
// Admin dashboard - system overview, quick actions, health status
"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./_components/AdminHeader";
import { WarningPanel } from "./_components/WarningPanel";
import { SystemCronScheduleWidget } from "./_components/SystemCronScheduleWidget";
import { SystemLogs } from "./_components/SystemLogs";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "~/components/ui/tooltip";
import { LogViewerFilterable } from "~/components/log-viewer";
import {
  LayoutDashboard,
  Clock,
  Bot,
  TrendingUp,
  Settings,
  Gamepad2,
  Globe,
  Users,
  Database,
  Activity,
  Wallet,
  Package,
  Coins,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from "lucide-react";

const QUICK_ACTIONS = [
  {
    icon: Settings,
    label: "Platform Controls",
    description: "Time, economy & bot management",
    href: "/admin/platform",
    color: "blue",
  },
  {
    icon: Gamepad2,
    label: "Storyteller",
    description: "World events & narrative tools",
    href: "/admin/storyteller",
    color: "purple",
  },
  {
    icon: Globe,
    label: "Countries",
    description: "Live country grid & monitoring",
    href: "/admin/countries",
    color: "emerald",
  },
  {
    icon: Users,
    label: "Users & Roles",
    description: "User management & permissions",
    href: "/admin/users",
    color: "amber",
  },
  {
    icon: Package,
    label: "Card Management",
    description: "Sync, Packs & Lore",
    href: "/admin/cards",
    color: "amber",
  },
  {
    icon: Coins,
    label: "Vault & Economy",
    description: "Balances, Streaks & Store CRUD",
    href: "/admin/vault",
    color: "amber",
  },
  {
    icon: BookOpen,
    label: "WikiOS Admin",
    description: "Links, awards & scoring configs",
    href: "/admin/wiki",
    color: "indigo",
  },
  {
    icon: Database,
    label: "Reference Data",
    description: "Unified data manager",
    href: "/admin/reference-data",
    color: "rose",
  },
  {
    icon: Activity,
    label: "System Logs",
    description: "Audit trail & monitoring",
    href: "/admin/platform",
    color: "indigo",
  },
] as const;

export default function AdminDashboardPage() {
  usePageTitle({ title: "Admin" });
  const [quickActionsCollapsed, setQuickActionsCollapsed] = useState(true);

  const { data: systemStatus, isLoading: statusLoading } = api.admin.getSystemStatus.useQuery(
    undefined,
    { refetchInterval: 30000, refetchOnWindowFocus: false }
  );

  const { data: botStatus, isLoading: botStatusLoading } = api.admin.getBotStatus.useQuery(
    undefined,
    { refetchInterval: 15000, refetchOnWindowFocus: false }
  );

  const { data: configData, isLoading: configLoading } = api.admin.getConfig.useQuery();

  const { data: auditLogData } = api.admin.getAdminAuditLog.useQuery(
    { limit: 30 },
    { refetchInterval: 15000, refetchOnWindowFocus: false }
  );

  const auditLogEntries = useMemo(() => {
    if (!auditLogData?.logs) return [];
    return auditLogData.logs.map((log) => {
      let level: "info" | "warn" | "error" | "debug" = "info";
      if (log.action.includes("DELETE") || log.action.includes("REMOVE")) {
        level = "warn";
      } else if (log.action.includes("ERROR") || log.action.includes("FAIL")) {
        level = "error";
      }

      let detailText = "";
      if (log.changes) {
        try {
          const parsed = JSON.parse(log.changes);
          detailText = Object.entries(parsed)
            .filter(([k]) => k !== "eventId" && k !== "countryId")
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
        } catch {
          detailText = log.changes;
        }
      }

      return {
        level,
        message: `${log.adminName}: ${log.action.replace(/_/g, " ")}${detailText ? ` [ ${detailText} ]` : ""}`,
        timestamp: new Date(log.timestamp).toISOString(),
      };
    });
  }, [auditLogData]);

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
          <h2 className="text-foreground text-base font-bold tracking-tight">Quick Actions</h2>
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
