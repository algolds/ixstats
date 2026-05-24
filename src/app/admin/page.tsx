// src/app/admin/page.tsx
// Admin dashboard - system overview, quick actions, health status
"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./_components/AdminHeader";
import { WarningPanel } from "./_components/WarningPanel";
import { UpcomingEventsWidget } from "./_components/UpcomingEventsWidget";
import { RealTimeClock } from "~/components/ui/real-time-clock";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
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
    icon: Wallet,
    label: "Vault & Credits",
    description: "Manage Credits & Personal Vaults",
    href: "/admin/vault",
    color: "amber",
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

  const { data: systemStatus, isLoading: statusLoading } = api.admin.getSystemStatus.useQuery(
    undefined,
    { refetchInterval: 30000, refetchOnWindowFocus: false }
  );

  const { data: botStatus, isLoading: botStatusLoading } = api.admin.getBotStatus.useQuery(
    undefined,
    { refetchInterval: 15000, refetchOnWindowFocus: false }
  );

  const { data: configData, isLoading: configLoading } = api.admin.getConfig.useQuery();

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={LayoutDashboard}
        title="Admin Dashboard"
        description="System overview and quick actions"
      >
        <RealTimeClock className="bg-card/80 border-border rounded-full px-4 py-1.5 text-sm backdrop-blur-sm" />
      </AdminHeader>

      {/* System Health Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* IxTime */}
        <div className="glass-card-child rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium tracking-wider text-blue-700 uppercase dark:text-blue-300">
              IxTime
            </span>
          </div>
          {statusLoading ? (
            <Skeleton className="h-6 w-full" />
          ) : (
            <div className="text-foreground text-sm font-bold">
              {systemStatus?.ixTime?.formattedIxTime || "N/A"}
            </div>
          )}
        </div>

        {/* Bot Status */}
        <div className="glass-card-child rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Bot className="h-4 w-4 text-green-500" />
            <span className="text-xs font-medium tracking-wider text-green-700 uppercase dark:text-green-300">
              Discord Bot
            </span>
          </div>
          {botStatusLoading ? (
            <Skeleton className="h-6 w-full" />
          ) : (
            <div
              className={`text-sm font-bold ${botStatus?.botHealth?.available ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              {botStatus?.botHealth?.available ? "Connected" : "Disconnected"}
            </div>
          )}
        </div>

        {/* Growth Factor */}
        <div className="glass-card-child rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-purple-600/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-medium tracking-wider text-indigo-700 uppercase dark:text-indigo-300">
              Growth Factor
            </span>
          </div>
          {configLoading ? (
            <Skeleton className="h-6 w-16" />
          ) : (
            <div className="text-foreground text-sm font-bold">
              +{(((configData?.globalGrowthFactor ?? 1) - 1) * 100).toFixed(1)}%
            </div>
          )}
        </div>

        {/* System Status */}
        <div className="glass-card-child rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium tracking-wider text-emerald-700 uppercase dark:text-emerald-300">
              Countries
            </span>
          </div>
          {statusLoading ? (
            <Skeleton className="h-6 w-16" />
          ) : (
            <div className="text-foreground text-sm font-bold">
              {systemStatus?.countryCount ?? 0} active
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-foreground mb-3 text-lg font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="glass-card-child group rounded-xl border border-border/50 p-4 transition-all duration-200 hover:scale-[1.02] hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 border-primary/20 group-hover:bg-primary/20 rounded-lg border p-2 transition-colors">
                  <action.icon className="text-primary h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-foreground group-hover:text-primary text-sm font-medium transition-colors">
                    {action.label}
                  </h3>
                  <p className="text-muted-foreground text-xs">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Upcoming Events & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingEventsWidget />

        {/* Recent Admin Activity */}
        <div>
          <h2 className="text-foreground mb-3 text-lg font-semibold">System Status</h2>
          <div className="glass-card-child space-y-3 rounded-xl border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Active Interventions</span>
              <span className="text-foreground font-mono text-sm font-medium">
                {systemStatus?.activeStorytellerEffects ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Last Calculation</span>
              <span className="text-foreground text-sm font-medium">
                {systemStatus?.lastCalculation?.timestamp
                  ? new Date(systemStatus.lastCalculation.timestamp).toLocaleTimeString()
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Countries Updated</span>
              <span className="text-foreground font-mono text-sm font-medium">
                {systemStatus?.lastCalculation?.countriesUpdated ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Time Multiplier</span>
              <span className="text-foreground font-mono text-sm font-medium">
                {configData?.timeMultiplier ?? 2.0}x
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {systemStatus && <WarningPanel systemStatus={systemStatus} />}
    </div>
  );
}
