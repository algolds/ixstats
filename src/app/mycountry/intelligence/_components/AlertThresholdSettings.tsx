"use client";

import React, { useState } from "react";
import { useUser } from "~/context/auth-context";
import { Save, Plus, Trash2, Settings, Bell, BellOff, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";
import { toast } from "sonner";

interface AlertThresholdSettingsProps {
  countryId: string;
}

interface ThresholdFormData {
  id?: string;
  alertType: string;
  metricName: string;
  criticalMin?: number;
  criticalMax?: number;
  highMin?: number;
  highMax?: number;
  mediumMin?: number;
  mediumMax?: number;
  notifyOnCritical: boolean;
  notifyOnHigh: boolean;
  notifyOnMedium: boolean;
  isActive: boolean;
}

const ALERT_TYPES = [
  { value: "gdp", label: "GDP Metrics" },
  { value: "population", label: "Population Metrics" },
  { value: "security", label: "Security Metrics" },
  { value: "diplomatic", label: "Diplomatic Metrics" },
  { value: "economic", label: "Economic Health" },
  { value: "governance", label: "Governance" },
];

const METRIC_NAMES: Record<string, { value: string; label: string; unit?: string }[]> = {
  gdp: [
    { value: "gdpGrowthRate", label: "GDP Growth Rate", unit: "%" },
    { value: "gdpPerCapita", label: "GDP Per Capita", unit: "$" },
    { value: "totalGDP", label: "Total GDP", unit: "$" },
  ],
  population: [
    { value: "populationGrowthRate", label: "Population Growth Rate", unit: "%" },
    { value: "totalPopulation", label: "Total Population", unit: "people" },
    { value: "populationWellbeing", label: "Population Wellbeing", unit: "/100" },
  ],
  security: [
    { value: "securityScore", label: "Security Score", unit: "/100" },
    { value: "militaryStrength", label: "Military Strength", unit: "/100" },
    { value: "threatLevel", label: "Threat Level", unit: "/10" },
  ],
  diplomatic: [
    { value: "diplomaticStanding", label: "Diplomatic Standing", unit: "/100" },
    { value: "activeRelationships", label: "Active Relationships", unit: "count" },
    { value: "embassyCount", label: "Embassy Count", unit: "count" },
  ],
  economic: [
    { value: "economicVitality", label: "Economic Vitality", unit: "/100" },
    { value: "tradeBalance", label: "Trade Balance", unit: "$" },
    { value: "unemploymentRate", label: "Unemployment Rate", unit: "%" },
  ],
  governance: [
    { value: "governmentalEfficiency", label: "Governmental Efficiency", unit: "/100" },
    { value: "activePolicies", label: "Active Policies", unit: "count" },
    { value: "publicApproval", label: "Public Approval", unit: "%" },
  ],
};

export function AlertThresholdSettings({ countryId }: AlertThresholdSettingsProps) {
  const { user } = useUser();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<ThresholdFormData>({
    alertType: "gdp",
    metricName: "gdpGrowthRate",
    notifyOnCritical: true,
    notifyOnHigh: true,
    notifyOnMedium: false,
    isActive: true,
  });

  // Fetch existing thresholds
  const {
    data: thresholdsData,
    isLoading,
    refetch,
  } = api.unifiedIntelligence.getAlertThresholds.useQuery(
    { countryId, userId: user?.id || "" },
    { enabled: !!user?.id }
  );

  // Mutations
  const updateMutation = api.unifiedIntelligence.updateAlertThreshold.useMutation({
    onSuccess: () => {
      toast.success("Alert threshold saved successfully");
      void refetch();
      setIsCreating(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to save threshold: ${error.message}`);
    },
  });

  const deleteMutation = api.unifiedIntelligence.deleteAlertThreshold.useMutation({
    onSuccess: () => {
      toast.success("Alert threshold deleted successfully");
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete threshold: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      alertType: "gdp",
      metricName: "gdpGrowthRate",
      notifyOnCritical: true,
      notifyOnHigh: true,
      notifyOnMedium: false,
      isActive: true,
    });
  };

  const handleSave = () => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return;
    }

    updateMutation.mutate({
      ...formData,
      countryId,
      userId: user.id,
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id, countryId });
  };

  const handleEdit = (threshold: any) => {
    setFormData({
      id: threshold.id,
      alertType: threshold.alertType,
      metricName: threshold.metricName,
      criticalMin: threshold.criticalMin ?? undefined,
      criticalMax: threshold.criticalMax ?? undefined,
      highMin: threshold.highMin ?? undefined,
      highMax: threshold.highMax ?? undefined,
      mediumMin: threshold.mediumMin ?? undefined,
      mediumMax: threshold.mediumMax ?? undefined,
      notifyOnCritical: threshold.notifyOnCritical,
      notifyOnHigh: threshold.notifyOnHigh,
      notifyOnMedium: threshold.notifyOnMedium,
      isActive: threshold.isActive,
    });
    setIsCreating(true);
  };

  const availableMetrics = METRIC_NAMES[formData.alertType] || [];
  const selectedMetric = availableMetrics.find((m) => m.value === formData.metricName);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-bold">
            <Settings className="h-6 w-6 text-purple-600" />
            Alert Threshold Settings
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure custom alert thresholds for automatic monitoring
          </p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Threshold
          </Button>
        )}
      </div>

      {/* Info Alert */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Set custom thresholds for metrics to receive automatic alerts when values fall outside
          your defined ranges. Configure separate thresholds for critical, high, and medium severity
          levels.
        </AlertDescription>
      </Alert>

      {/* Create/Edit Form */}
      {isCreating && (
        <Card className="border-2 border-purple-200 dark:border-purple-700">
          <CardHeader>
            <CardTitle>{formData.id ? "Edit Threshold" : "Create New Threshold"}</CardTitle>
            <CardDescription>Define threshold ranges and notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Alert Type & Metric Selection */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Alert Type</Label>
                <Select
                  value={formData.alertType}
                  onValueChange={(value) => {
                    const newMetrics = METRIC_NAMES[value] || [];
                    setFormData({
                      ...formData,
                      alertType: value,
                      metricName: newMetrics[0]?.value || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Metric Name</Label>
                <Select
                  value={formData.metricName}
                  onValueChange={(value) => setFormData({ ...formData, metricName: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMetrics.map((metric) => (
                      <SelectItem key={metric.value} value={metric.value}>
                        {metric.label} {metric.unit && `(${metric.unit})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Threshold Ranges */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Threshold Ranges</h4>

              {/* Critical Thresholds */}
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="font-semibold text-red-700 dark:text-red-400">
                    Critical Level
                  </Label>
                  <Badge variant="destructive">Highest Priority</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Minimum</Label>
                    <Input
                      type="number"
                      placeholder="Min value"
                      value={formData.criticalMin ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          criticalMin: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Maximum</Label>
                    <Input
                      type="number"
                      placeholder="Max value"
                      value={formData.criticalMax ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          criticalMax: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* High Thresholds */}
              <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="font-semibold text-orange-700 dark:text-orange-400">
                    High Level
                  </Label>
                  <Badge className="bg-orange-500">High Priority</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Minimum</Label>
                    <Input
                      type="number"
                      placeholder="Min value"
                      value={formData.highMin ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          highMin: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Maximum</Label>
                    <Input
                      type="number"
                      placeholder="Max value"
                      value={formData.highMax ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          highMax: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Medium Thresholds */}
              <div className="space-y-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="font-semibold text-yellow-700 dark:text-yellow-400">
                    Medium Level
                  </Label>
                  <Badge className="bg-yellow-500">Medium Priority</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Minimum</Label>
                    <Input
                      type="number"
                      placeholder="Min value"
                      value={formData.mediumMin ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mediumMin: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Maximum</Label>
                    <Input
                      type="number"
                      placeholder="Max value"
                      value={formData.mediumMax ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mediumMax: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="space-y-3 rounded-lg border p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Bell className="h-4 w-4" />
                Notification Preferences
              </h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex cursor-pointer items-center gap-2">
                    <span>Notify on Critical Alerts</span>
                    <Badge variant="destructive" className="text-xs">
                      Critical
                    </Badge>
                  </Label>
                  <Switch
                    checked={formData.notifyOnCritical}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, notifyOnCritical: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="flex cursor-pointer items-center gap-2">
                    <span>Notify on High Alerts</span>
                    <Badge className="bg-orange-500 text-xs">High</Badge>
                  </Label>
                  <Switch
                    checked={formData.notifyOnHigh}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, notifyOnHigh: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="flex cursor-pointer items-center gap-2">
                    <span>Notify on Medium Alerts</span>
                    <Badge className="bg-yellow-500 text-xs">Medium</Badge>
                  </Label>
                  <Switch
                    checked={formData.notifyOnMedium}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, notifyOnMedium: checked })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex-1 gap-2"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? "Saving..." : "Save Threshold"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Thresholds Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Thresholds</CardTitle>
          <CardDescription>
            {thresholdsData?.total || 0} active threshold
            {(thresholdsData?.total || 0) !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground py-8 text-center">Loading thresholds...</div>
          ) : !thresholdsData?.thresholds.length ? (
            <div className="text-muted-foreground py-8 text-center">
              No thresholds configured. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alert Type</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Critical Range</TableHead>
                    <TableHead>High Range</TableHead>
                    <TableHead>Medium Range</TableHead>
                    <TableHead>Notifications</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {thresholdsData.thresholds.map((threshold: any) => (
                    <TableRow key={threshold.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {ALERT_TYPES.find((t) => t.value === threshold.alertType)?.label ||
                            threshold.alertType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{threshold.metricName}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {threshold.criticalMin !== null && (
                            <div>Min: {threshold.criticalMin}</div>
                          )}
                          {threshold.criticalMax !== null && (
                            <div>Max: {threshold.criticalMax}</div>
                          )}
                          {threshold.criticalMin === null && threshold.criticalMax === null && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {threshold.highMin !== null && <div>Min: {threshold.highMin}</div>}
                          {threshold.highMax !== null && <div>Max: {threshold.highMax}</div>}
                          {threshold.highMin === null && threshold.highMax === null && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {threshold.mediumMin !== null && <div>Min: {threshold.mediumMin}</div>}
                          {threshold.mediumMax !== null && <div>Max: {threshold.mediumMax}</div>}
                          {threshold.mediumMin === null && threshold.mediumMax === null && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {threshold.notifyOnCritical && <Bell className="h-3 w-3 text-red-500" />}
                          {threshold.notifyOnHigh && <Bell className="h-3 w-3 text-orange-500" />}
                          {threshold.notifyOnMedium && <Bell className="h-3 w-3 text-yellow-500" />}
                          {!threshold.notifyOnCritical &&
                            !threshold.notifyOnHigh &&
                            !threshold.notifyOnMedium && (
                              <BellOff className="text-muted-foreground h-3 w-3" />
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(threshold)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(threshold.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
