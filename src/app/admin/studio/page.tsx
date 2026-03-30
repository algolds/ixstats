"use client";
export const dynamic = "force-dynamic";

/**
 * Admin World Studio — Realm & world configuration management.
 *
 * Tabs: Realms, World Configs, Users (realm associations), Templates
 */

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { api } from "~/trpc/react";
import { Sparkles } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { RealmsTab } from "./_components/RealmsTab";
import { WorldConfigsTab } from "./_components/WorldConfigsTab";
import { RealmUsersTab } from "./_components/RealmUsersTab";
import { TemplatesTab } from "./_components/TemplatesTab";

type TabId = "realms" | "world-configs" | "users" | "templates";

const TABS: { id: TabId; label: string }[] = [
  { id: "realms", label: "Realms" },
  { id: "world-configs", label: "World Configs" },
  { id: "users", label: "User Assignments" },
  { id: "templates", label: "Templates" },
];

export default function AdminStudioPage() {
  usePageTitle({ title: "Admin - World Studio" });
  const [activeTab, setActiveTab] = useState<TabId>("realms");

  const { data: stats, isLoading } = api.studio.adminGetStats.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Sparkles}
        title="World Studio"
        description="Manage realms, world configurations, and user-realm assignments"
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Realms" value={stats?.realmCount} sub={`${stats?.activeRealmCount ?? 0} active`} isLoading={isLoading} color="violet" />
        <StatCard label="World Configs" value={stats?.worldConfigCount} isLoading={isLoading} color="blue" />
        <StatCard label="Countries" value={stats?.countryCount} isLoading={isLoading} color="emerald" />
        <StatCard label="Users" value={stats?.userCount} sub={`${stats?.templateCount ?? 0} templates`} isLoading={isLoading} color="amber" />
      </div>

      {/* Realm breakdown */}
      {stats?.realmBreakdown && stats.realmBreakdown.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Realm Breakdown</h3>
          <div className="flex flex-wrap gap-3">
            {stats.realmBreakdown.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5"
              >
                <div className={`h-2 w-2 rounded-full ${r.status === "active" ? "bg-green-500" : r.status === "draft" ? "bg-yellow-500" : "bg-gray-400"}`} />
                <span className="text-sm font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">{r._count.countries} countries</span>
                <span className="text-xs text-muted-foreground/60">{r.visibility}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-violet-500 text-violet-500"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "realms" && <RealmsTab />}
      {activeTab === "world-configs" && <WorldConfigsTab />}
      {activeTab === "users" && <RealmUsersTab />}
      {activeTab === "templates" && <TemplatesTab />}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  isLoading,
  color,
}: {
  label: string;
  value: string | number | undefined;
  sub?: string;
  isLoading: boolean;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    violet: "border-violet-500/20 from-violet-500/10 to-violet-600/5",
    blue: "border-blue-500/20 from-blue-500/10 to-blue-600/5",
    emerald: "border-emerald-500/20 from-emerald-500/10 to-emerald-600/5",
    amber: "border-amber-500/20 from-amber-500/10 to-amber-600/5",
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${colorMap[color] || colorMap.blue}`}>
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      {isLoading ? (
        <Skeleton className="mt-1 h-8 w-20" />
      ) : (
        <>
          <div className="mt-1 text-2xl font-bold text-foreground">{value ?? "—"}</div>
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </>
      )}
    </div>
  );
}
