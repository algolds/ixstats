"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useNotify } from "~/hooks/useNotify";
// eslint-disable-next-line unused-imports/no-unused-imports
import { SlidersHorizontal, Plus, Trash2, RotateCcw, AlertTriangle } from "lucide-react";

interface ThresholdForm {
  id: string | undefined;
  countryId: string;
  userId: string;
  alertType: string;
  metricName: string;
  criticalMin: string;
  criticalMax: string;
  highMin: string;
  highMax: string;
  mediumMin: string;
  mediumMax: string;
  notifyOnCritical: boolean;
  notifyOnHigh: boolean;
  notifyOnMedium: boolean;
  isActive: boolean;
}

const emptyForm: ThresholdForm = {
  id: undefined,
  countryId: "",
  userId: "system",
  alertType: "numeric",
  metricName: "",
  criticalMin: "",
  criticalMax: "",
  highMin: "",
  highMax: "",
  mediumMin: "",
  mediumMax: "",
  notifyOnCritical: true,
  notifyOnHigh: true,
  notifyOnMedium: false,
  isActive: true,
};

export function AlertRulesPanel() {
  const notify = useNotify();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ThresholdForm>(emptyForm);

  const { data, isLoading, refetch } = api.notifications.getAlertThresholds.useQuery();
  const { data: countries } = api.countries.getSelectList.useQuery({ limit: 250 });

  const updateMutation = api.notifications.updateAlertThreshold.useMutation({
    onSuccess: () => {
      notify.success("Threshold saved");
      setDialogOpen(false);
      setForm(emptyForm);
      refetch();
    },
    onError: (e) => notify.error("Save failed", e.message),
  });

  const deleteMutation = api.notifications.deleteAlertThreshold.useMutation({
    onSuccess: () => {
      notify.success("Threshold deleted");
      refetch();
    },
    onError: (e) => notify.error("Delete failed", e.message),
  });

  const handleEdit = (threshold: NonNullable<typeof data>["thresholds"][number]) => {
    setForm({
      id: threshold.id,
      countryId: threshold.countryId,
      userId: threshold.userId,
      alertType: threshold.alertType,
      metricName: threshold.metricName,
      criticalMin: threshold.criticalMin?.toString() ?? "",
      criticalMax: threshold.criticalMax?.toString() ?? "",
      highMin: threshold.highMin?.toString() ?? "",
      highMax: threshold.highMax?.toString() ?? "",
      mediumMin: threshold.mediumMin?.toString() ?? "",
      mediumMax: threshold.mediumMax?.toString() ?? "",
      notifyOnCritical: threshold.notifyOnCritical,
      notifyOnHigh: threshold.notifyOnHigh,
      notifyOnMedium: threshold.notifyOnMedium,
      isActive: threshold.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.metricName.trim()) {
      notify.error("Metric name required");
      return;
    }

    updateMutation.mutate({
      id: form.id,
      countryId: form.countryId,
      userId: form.userId,
      alertType: form.alertType,
      metricName: form.metricName,
      criticalMin: form.criticalMin ? parseFloat(form.criticalMin) : undefined,
      criticalMax: form.criticalMax ? parseFloat(form.criticalMax) : undefined,
      highMin: form.highMin ? parseFloat(form.highMin) : undefined,
      highMax: form.highMax ? parseFloat(form.highMax) : undefined,
      mediumMin: form.mediumMin ? parseFloat(form.mediumMin) : undefined,
      mediumMax: form.mediumMax ? parseFloat(form.mediumMax) : undefined,
      notifyOnCritical: form.notifyOnCritical,
      notifyOnHigh: form.notifyOnHigh,
      notifyOnMedium: form.notifyOnMedium,
      isActive: form.isActive,
    });
  };

  const field = (key: keyof ThresholdForm) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setForm(emptyForm);
              setDialogOpen(true);
            }}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Threshold
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <Badge variant="outline">
          {data?.thresholds.length ?? 0} rule{(data?.thresholds.length ?? 0) !== 1 ? "s" : ""}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Alert Type</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-center">Critical</TableHead>
                  <TableHead className="text-center">High</TableHead>
                  <TableHead className="text-center">Medium</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : data?.thresholds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                      <SlidersHorizontal className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      No alert rules configured
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.thresholds.map((t) => {
                    const country = countries?.find((c: any) => c.id === t.countryId);
                    return (
                      <TableRow
                        key={t.id}
                        className={!t.isActive ? "opacity-50" : "cursor-pointer"}
                        onClick={() => handleEdit(t)}
                      >
                        <TableCell className="font-medium">{t.metricName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {t.alertType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {country?.name ?? t.countryId.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.criticalMin ?? "—"} / {t.criticalMax ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.highMin ?? "—"} / {t.highMax ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.mediumMin ?? "—"} / {t.mediumMax ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div
                            className={`mx-auto h-2 w-2 rounded-full ${t.isActive ? "bg-green-500" : "bg-gray-400"}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Delete this threshold rule?")) {
                                deleteMutation.mutate({ id: t.id });
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit / Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Threshold" : "New Threshold"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Metric Name *</Label>
                <Input placeholder="e.g. GDP Growth Rate" {...field("metricName")} />
              </div>
              <div className="space-y-1.5">
                <Label>Alert Type</Label>
                <Input placeholder="numeric" {...field("alertType")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Country ID</Label>
              <Input placeholder="Country ID" {...field("countryId")} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-red-500">Critical Min</Label>
                <Input type="number" placeholder="Min" {...field("criticalMin")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-red-500">Critical Max</Label>
                <Input type="number" placeholder="Max" {...field("criticalMax")} />
              </div>
              <div className="space-y-1.5">
                <Label>Notify</Label>
                <div className="pt-2">
                  <Switch
                    checked={form.notifyOnCritical}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, notifyOnCritical: v }))}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-orange-500">High Min</Label>
                <Input type="number" placeholder="Min" {...field("highMin")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-orange-500">High Max</Label>
                <Input type="number" placeholder="Max" {...field("highMax")} />
              </div>
              <div className="space-y-1.5">
                <Label>Notify</Label>
                <div className="pt-2">
                  <Switch
                    checked={form.notifyOnHigh}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, notifyOnHigh: v }))}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-yellow-500">Medium Min</Label>
                <Input type="number" placeholder="Min" {...field("mediumMin")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-yellow-500">Medium Max</Label>
                <Input type="number" placeholder="Max" {...field("mediumMax")} />
              </div>
              <div className="space-y-1.5">
                <Label>Notify</Label>
                <div className="pt-2">
                  <Switch
                    checked={form.notifyOnMedium}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, notifyOnMedium: v }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
