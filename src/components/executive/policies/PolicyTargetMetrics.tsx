"use client";

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Xmark as X, Plus } from "iconoir-react";
import { METRIC_OPTIONS } from "./policy-creator-constants";

export interface TargetMetric {
  metric: string;
  value: number;
  timeline: string;
}

interface PolicyTargetMetricsProps {
  metrics: TargetMetric[];
  onChange: (metrics: TargetMetric[]) => void;
}

export function PolicyTargetMetrics({ metrics, onChange }: PolicyTargetMetricsProps) {
  const [metricType, setMetricType] = useState<string>("gdpGrowth");
  const [metricValue, setMetricValue] = useState("");
  const [metricTimeline, setMetricTimeline] = useState("1year");

  const handleAdd = () => {
    if (!metricValue) return;
    const num = parseFloat(metricValue);
    if (isNaN(num)) return;

    onChange([
      ...metrics,
      {
        metric: metricType,
        value: num,
        timeline: metricTimeline,
      },
    ]);
    setMetricValue("");
  };

  const handleRemove = (index: number) => {
    onChange(metrics.filter((_, i) => i !== index));
  };

  return (
    <div className="border-border/40 space-y-3 border-t pt-3">
      <Label className="text-xs font-semibold">Target Simulation Metrics</Label>

      {metrics.length > 0 && (
        <div className="space-y-1.5">
          {metrics.map((m, idx) => {
            const opt = METRIC_OPTIONS.find((o) => o.value === m.metric);
            return (
              <div
                key={idx}
                className="bg-muted/40 border-border/40 flex items-center justify-between rounded border px-3 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{opt?.label ?? m.metric}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-semibold text-indigo-400">
                    {m.value}
                    {opt?.unit ?? ""}
                  </span>
                  <span className="text-muted-foreground">({m.timeline})</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="hover:bg-muted text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-5">
          <Select value={metricType} onValueChange={setMetricType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRIC_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3">
          <Input
            type="number"
            value={metricValue}
            onChange={(e) => setMetricValue(e.target.value)}
            placeholder="Target"
            className="h-8 text-xs"
          />
        </div>
        <div className="col-span-3">
          <Select value={metricTimeline} onValueChange={setMetricTimeline}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6months">6 Months</SelectItem>
              <SelectItem value="1year">1 Year</SelectItem>
              <SelectItem value="2years">2 Years</SelectItem>
              <SelectItem value="5years">5 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-1">
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={!metricValue}
            className="h-8 w-full p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
