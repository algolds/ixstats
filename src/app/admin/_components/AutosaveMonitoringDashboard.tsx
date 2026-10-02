"use client";
import { Stat } from "~/components/ui/stat";
import { useState } from "react";
import { api } from "~/trpc/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import {
  Activity,
  StatUp as TrendingUp,
  WarningTriangle as AlertTriangle,
  Group as Users,
  CheckCircle,
  XmarkCircle as XCircle,
  Refresh as RefreshCw,
  Clock,
} from "iconoir-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

type TimeRange = "1h" | "24h" | "7d" | "30d";
type Granularity = "minute" | "hour" | "day";

const COLORS = {
  primary: "var(--color-chart-1)",
  success: "var(--color-chart-3)",
  warning: "var(--color-chart-2)",
  danger: "var(--color-chart-8)",
  purple: "var(--color-chart-4)",
  indigo: "var(--color-indigo)",
};

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-3)",
  "var(--color-chart-2)",
  "var(--color-chart-8)",
  "var(--color-chart-4)",
  "var(--color-indigo)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
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

  const { data: health, refetch: refetchHealth } = api.autosaveMonitoring.getSystemHealth.useQuery(
    undefined,
    {
      refetchInterval: autoRefresh ? 10000 : false,
    }
  );

  const handleRefreshAll = () => {
    void refetchStats();
    void refetchTimeSeries();
    void refetchFailures();
    void refetchUsers();
    void refetchHealth();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-large-title text-label">Autosave Monitoring</h1>
          <p className="text-label-secondary">System health and performance metrics</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Auto-refresh toggle */}
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={cn("h-4 w-4", autoRefresh && "animate-spin motion-reduce:animate-none")}
            />
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
      <Card className="flex flex-col gap-6 py-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                health?.status === "healthy" && "bg-green/10",
                health?.status === "degraded" && "bg-yellow/10",
                health?.status === "critical" && "bg-red/10"
              )}
            >
              <Activity
                className={cn(
                  "h-6 w-6",
                  health?.status === "healthy" && "text-green",
                  health?.status === "degraded" && "text-yellow",
                  health?.status === "critical" && "text-red"
                )}
              />
            </div>
            <div>
              <h3 className="text-title-3 capitalize">{health?.status || "Loading..."}</h3>
              <p className="text-body text-label-secondary">
                {health?.autosavesLast5Min || 0} autosaves in last 5 minutes
              </p>
            </div>
            {health && (
              <div className="text-body text-label-secondary ml-auto text-right">
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
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle>Autosave Activity</CardTitle>
            <CardDescription>Autosaves over time</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart data={timeSeries?.series || []} />
          </CardContent>
        </Card>

        {/* Section Breakdown */}
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle>Section Breakdown</CardTitle>
            <CardDescription>Autosaves by builder section</CardDescription>
          </CardHeader>
          <CardContent>
            <SectionBreakdownChart
              data={
                stats?.sectionBreakdown
                  ? Object.entries(stats.sectionBreakdown).map(([section, count]) => ({
                      section,
                      count,
                    }))
                  : []
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Failure Analysis */}
      {failureAnalysis && failureAnalysis.errorTypes.length > 0 && (
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="text-yellow h-5 w-5" />
              Failure Analysis
            </CardTitle>
            <CardDescription>Most common errors and failures</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failureAnalysis.errorTypes.map((error, index) => (
                <div
                  key={`${error.type}-${index}`}
                  className="rounded-control-sm hover:bg-fill-4 flex items-center justify-between border p-3"
                >
                  <div className="flex items-center gap-3">
                    <XCircle className="text-red h-5 w-5" />
                    <div>
                      <span className="text-body font-medium">{error.type}</span>
                      <p className="text-footnote text-label-secondary">
                        {error.count} occurrence{error.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-title-3 text-red">{error.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Users Table */}
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle>Active Users</CardTitle>
          <CardDescription>Users with recent autosave activity</CardDescription>
        </CardHeader>
        <CardContent>
          <ActiveUsersTable
            users={
              activeUsers?.users.map((u) => ({
                userId: u.userId ?? "",
                userName: ((u as Record<string, unknown>).userName as string | null) ?? null,
                section: ((u as Record<string, unknown>).section as string | null) ?? null,
                lastAutosave:
                  u.lastAutosave instanceof Date
                    ? u.lastAutosave.toISOString()
                    : String(u.lastAutosave ?? ""),
                autosaveCount: u.autosaveCount ?? 0,
                failureCount: u.failureCount ?? 0,
              })) || []
            }
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
  const iconColor = {
    blue: "text-blue",
    green: "text-green",
    red: "text-red",
    purple: "text-purple",
    indigo: "text-indigo",
    yellow: "text-yellow",
  }[color];

  return (
    <Card padding="md">
      <Stat
        label={title}
        value={value}
        icon={<span className={iconColor}>{icon}</span>}
        iconPlacement="trailing"
        hint={
          trend ? (
            <span
              className={cn(
                trend === "good" && "text-success",
                trend === "bad" && "text-destructive",
                trend === "neutral" && "text-label-secondary"
              )}
            >
              {trend === "good" && "Healthy"}
              {trend === "bad" && "Needs attention"}
              {trend === "neutral" && "Normal"}
            </span>
          ) : undefined
        }
      />
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
      <div className="text-label-secondary flex h-64 items-center justify-center">
        No data available for this time range
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
        <XAxis
          dataKey="timestamp"
          stroke="var(--color-label-secondary)"
          fontSize={12}
          tickFormatter={(value) => {
            const date = new Date(value);
            return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          }}
        />
        <YAxis stroke="var(--color-label-secondary)" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface-elevated)",
            border: "1px solid var(--color-separator)",
            borderRadius: "8px",
            padding: "8px",
          }}
          labelFormatter={(value: any) => (value ? new Date(value).toLocaleString() : "")}
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
      <div className="text-label-secondary flex h-64 items-center justify-center">
        No section data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
        <XAxis dataKey="section" stroke="var(--color-label-secondary)" fontSize={12} />
        <YAxis stroke="var(--color-label-secondary)" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface-elevated)",
            border: "1px solid var(--color-separator)",
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
      <div className="text-label-secondary flex h-32 items-center justify-center">
        No active users in this time range
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-4">User</TableHead>
          <TableHead className="px-4">Last Autosave</TableHead>
          <TableHead className="px-4">Section</TableHead>
          <TableHead className="px-4 text-right">Count</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.userId}>
            <TableCell className="px-4 font-medium">
              {user.userName || <span className="text-label-secondary">Unknown</span>}
            </TableCell>
            <TableCell className="text-label-secondary px-4">
              {new Date(user.lastAutosave).toLocaleString()}
            </TableCell>
            <TableCell className="px-4">
              <Badge variant="blue">{user.section || "N/A"}</Badge>
            </TableCell>
            <TableCell className="px-4 text-right font-semibold">{user.autosaveCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
