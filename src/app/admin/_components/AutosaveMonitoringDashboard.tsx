/**
 * AutosaveMonitoringDashboard Component
 *
 * Admin dashboard for monitoring autosave system health and performance.
 * Provides real-time metrics, time-series visualizations, failure analysis,
 * and active user monitoring.
 *
 * @module AutosaveMonitoringDashboard
 */

"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  Users,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "~/lib/utils";

type TimeRange = "1h" | "24h" | "7d" | "30d";
type Granularity = "minute" | "hour" | "day";

const COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  indigo: "#6366f1",
};

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
];

export function AutosaveMonitoringDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Determine granularity based on time range
  const granularity: Granularity =
    timeRange === "1h" ? "minute" : timeRange === "24h" ? "hour" : "day";

  // Queries with auto-refresh
  const { data: stats, refetch: refetchStats } = api.autosaveMonitoring.getAutosaveStats.useQuery(
    { timeRange },
    { refetchInterval: autoRefresh ? 30000 : false }
  );

  const { data: timeSeries, refetch: refetchTimeSeries } =
    api.autosaveMonitoring.getAutosaveTimeSeries.useQuery(
      { timeRange, granularity },
      { refetchInterval: autoRefresh ? 30000 : false }
    );

  const { data: failureAnalysis, refetch: refetchFailures } =
    api.autosaveMonitoring.getFailureAnalysis.useQuery(
      { timeRange },
      { refetchInterval: autoRefresh ? 30000 : false }
    );

  const { data: activeUsers, refetch: refetchUsers } =
    api.autosaveMonitoring.getActiveUsers.useQuery(
      { timeRange },
      { refetchInterval: autoRefresh ? 30000 : false }
    );

  const { data: health, refetch: refetchHealth } =
    api.autosaveMonitoring.getSystemHealth.useQuery(undefined, {
      refetchInterval: autoRefresh ? 10000 : false,
    });

  const handleRefreshAll = () => {
    void refetchStats();
    void refetchTimeSeries();
    void refetchFailures();
    void refetchUsers();
    void refetchHealth();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Autosave Monitoring</h1>
          <p className="text-gray-500">System health and performance metrics</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Auto-refresh toggle */}
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", autoRefresh && "animate-spin")} />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>

          {/* Manual refresh */}
          <Button variant="outline" size="sm" onClick={handleRefreshAll}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* Time Range Selector */}
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <TabsList>
              <TabsTrigger value="1h">1 Hour</TabsTrigger>
              <TabsTrigger value="24h">24 Hours</TabsTrigger>
              <TabsTrigger value="7d">7 Days</TabsTrigger>
              <TabsTrigger value="30d">30 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* System Health Badge */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                health?.status === "healthy" && "bg-green-100",
                health?.status === "degraded" && "bg-yellow-100",
                health?.status === "critical" && "bg-red-100"
              )}
            >
              <Activity
                className={cn(
                  "h-6 w-6",
                  health?.status === "healthy" && "text-green-600",
                  health?.status === "degraded" && "text-yellow-600",
                  health?.status === "critical" && "text-red-600"
                )}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold capitalize">
                {health?.status || "Loading..."}
              </h3>
              <p className="text-sm text-gray-500">
                {health?.autosavesLast5Min || 0} autosaves in last 5 minutes
              </p>
            </div>
            {health && (
              <div className="ml-auto text-right text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Autosaves"
          value={stats?.totalAutosaves.toLocaleString() || "0"}
          icon={<Activity className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          title="Success Rate"
          value={`${stats?.successRate.toFixed(1) || "0"}%`}
          icon={<CheckCircle className="h-5 w-5" />}
          color={stats?.successRate && stats.successRate >= 95 ? "green" : "red"}
          trend={stats?.successRate && stats.successRate >= 95 ? "good" : "bad"}
        />
        <StatsCard
          title="Avg Duration"
          value={`${stats?.averageDuration.toFixed(0) || "0"}ms`}
          icon={<TrendingUp className="h-5 w-5" />}
          color="purple"
        />
        <StatsCard
          title="Active Users"
          value={activeUsers?.users.length.toString() || "0"}
          icon={<Users className="h-5 w-5" />}
          color="indigo"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Time Series Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Autosave Activity</CardTitle>
            <CardDescription>Autosaves over time</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart data={timeSeries?.series || []} />
          </CardContent>
        </Card>

        {/* Section Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Section Breakdown</CardTitle>
            <CardDescription>Autosaves by builder section</CardDescription>
          </CardHeader>
          <CardContent>
            <SectionBreakdownChart
              data={stats?.sectionBreakdown
                ? Object.entries(stats.sectionBreakdown).map(([section, count]) => ({ section, count }))
                : []}
            />
          </CardContent>
        </Card>
      </div>

      {/* Failure Analysis */}
      {failureAnalysis && failureAnalysis.errorTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Failure Analysis
            </CardTitle>
            <CardDescription>Most common errors and failures</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failureAnalysis.errorTypes.map((error, index) => (
                <div
                  key={`${error.error}-${index}`}
                  className="flex items-center justify-between rounded border p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <span className="text-sm font-medium">{error.error}</span>
                      <p className="text-xs text-gray-500">
                        {error.count} occurrence{error.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-red-600">{error.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Users</CardTitle>
          <CardDescription>Users with recent autosave activity</CardDescription>
        </CardHeader>
        <CardContent>
          <ActiveUsersTable
            users={activeUsers?.users.map(u => ({
              ...u,
              userName: null,
              section: null,
              lastAutosave: u.lastAutosave instanceof Date ? u.lastAutosave.toISOString() : String(u.lastAutosave),
            })) || []}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Sub-components

interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color?: "blue" | "green" | "red" | "purple" | "indigo" | "yellow";
  trend?: "good" | "bad" | "neutral";
}

function StatsCard({ title, value, icon, color = "blue", trend }: StatsCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    indigo: "bg-indigo-50 text-indigo-600",
    yellow: "bg-yellow-50 text-yellow-600",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={cn("rounded-full p-2", colorClasses[color])}>{icon}</div>
        </div>
        {trend && (
          <div className="mt-2">
            <span
              className={cn(
                "text-xs font-medium",
                trend === "good" && "text-green-600",
                trend === "bad" && "text-red-600",
                trend === "neutral" && "text-gray-600"
              )}
            >
              {trend === "good" && "Healthy"}
              {trend === "bad" && "Needs attention"}
              {trend === "neutral" && "Normal"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TimeSeriesChartProps {
  data: Array<{
    timestamp: string;
    count: number;
    successCount: number;
    failureCount: number;
  }>;
}

function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No data available for this time range
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="timestamp"
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={(value) => {
            const date = new Date(value);
            return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          }}
        />
        <YAxis stroke="#6b7280" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "8px",
          }}
          labelFormatter={(value) => new Date(value).toLocaleString()}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="successCount"
          stroke={COLORS.success}
          strokeWidth={2}
          name="Successful"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="failureCount"
          stroke={COLORS.danger}
          strokeWidth={2}
          name="Failed"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface SectionBreakdownChartProps {
  data: Array<{
    section: string;
    count: number;
  }>;
}

function SectionBreakdownChart({ data }: SectionBreakdownChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No section data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="section" stroke="#6b7280" fontSize={12} />
        <YAxis stroke="#6b7280" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "8px",
          }}
        />
        <Bar dataKey="count" name="Autosaves">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface ActiveUsersTableProps {
  users: Array<{
    userId: string;
    userName: string | null;
    lastAutosave: string;
    autosaveCount: number;
    section: string | null;
  }>;
}

function ActiveUsersTable({ users }: ActiveUsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        No active users in this time range
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-gray-50 text-xs uppercase text-gray-700">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Last Autosave</th>
            <th className="px-4 py-3">Section</th>
            <th className="px-4 py-3 text-right">Count</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.userId} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">
                {user.userName || <span className="text-gray-400">Unknown</span>}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {new Date(user.lastAutosave).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                  {user.section || "N/A"}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold">{user.autosaveCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
