// src/app/admin/_components/StatusCards.tsx
"use client";

import { Server, Users, Database, Clock, BarChart2, Bot, AlertCircle, CheckCircle2, Settings2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton"; // For loading state
import type { SystemStatus, AdminPageBotStatusView } from "~/types/ixstats";
import { IxTime } from "~/lib/ixtime"; // Assuming IxTime is correctly imported

interface StatusCardsProps {
  systemStatus: SystemStatus | null | undefined;
  botStatus: AdminPageBotStatusView | null | undefined;
  statusLoading: boolean;
  configLoading: boolean;
  globalGrowthFactor: number;
}

const StatusItem = ({ title, value, icon: Icon, description, isLoading, statusColor }: {
  title: string;
  value: string | number | undefined;
  icon: React.ElementType;
  description?: string;
  isLoading?: boolean;
  statusColor?: string; // e.g., 'text-green-500', 'text-red-500'
}) => {
  if (isLoading) {
    return (
      <Card className="dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-3/4 mb-1" />
          {description && <Skeleton className="h-4 w-1/2" />}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${statusColor ?? 'text-muted-foreground dark:text-gray-300'}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold text-gray-900 dark:text-white ${statusColor ?? ''}`}>{value ?? "N/A"}</div>
        {description && <p className="text-xs text-muted-foreground dark:text-gray-500">{description}</p>}
      </CardContent>
    </Card>
  );
};

export function StatusCards({
  systemStatus,
  botStatus,
  statusLoading,
  configLoading,
  globalGrowthFactor,
}: StatusCardsProps) {
  const currentTime = systemStatus?.currentTime
    ? IxTime.fromJSON(systemStatus.currentTime).toDisplayDateTime()
    : "N/A";
  
  const nextUpdateTime = systemStatus?.nextScheduledUpdate
    ? new Date(systemStatus.nextScheduledUpdate).toLocaleTimeString()
    : "N/A";

  const botStatusText = botStatus?.isPaused ? "Paused" : botStatus?.isActive ? "Active" : "Inactive";
  const botStatusColor = botStatus?.isPaused ? "text-yellow-500" : botStatus?.isActive ? "text-green-500" : "text-red-500";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
      <StatusItem
        title="System Status"
        value={systemStatus?.databaseStatus === "OK" ? "Operational" : "Error"}
        icon={systemStatus?.databaseStatus === "OK" ? CheckCircle2 : AlertCircle}
        description={`DB: ${systemStatus?.databaseStatus ?? 'N/A'}`}
        isLoading={statusLoading}
        statusColor={systemStatus?.databaseStatus === "OK" ? "text-green-500" : "text-red-500"}
      />
      <StatusItem
        title="Current IxTime"
        value={currentTime}
        icon={Clock}
        description={`Multiplier: ${systemStatus?.timeMultiplier ?? 'N/A'}x`}
        isLoading={statusLoading}
      />
      <StatusItem
        title="Total Countries"
        value={systemStatus?.totalCountries}
        icon={Users}
        description="Tracked in database"
        isLoading={statusLoading}
      />
      <StatusItem
        title="Next Update"
        value={nextUpdateTime}
        icon={Zap}
        description={systemStatus?.autoUpdateEnabled ? "Auto-update ON" : "Auto-update OFF"}
        isLoading={statusLoading}
      />
      <StatusItem
        title="Bot Status"
        value={botStatusText}
        icon={Bot}
        description={`Last Sync: ${botStatus?.lastSyncTime ? new Date(botStatus.lastSyncTime).toLocaleTimeString() : 'N/A'}`}
        isLoading={botStatusLoading}
        statusColor={botStatusColor}
      />
       <StatusItem
        title="Bot Overrides"
        value={botStatus?.overriddenCountriesCount ?? 0}
        icon={Settings2}
        description="Countries with manual inputs"
        isLoading={botStatusLoading}
      />
      <StatusItem
        title="Global Growth"
        value={`${(globalGrowthFactor * 100).toFixed(2)}%`}
        icon={BarChart2}
        description="Annual economic adjustment"
        isLoading={configLoading}
      />
      <StatusItem
        title="Last Calculation"
        value={systemStatus?.lastCalculationTime ? new Date(systemStatus.lastCalculationTime).toLocaleTimeString() : "Never"}
        icon={Database}
        description={systemStatus?.lastCalculationError ? "Failed" : "Successful"}
        isLoading={statusLoading}
        statusColor={systemStatus?.lastCalculationError ? "text-red-500" : undefined}
      />
    </div>
  );
}
