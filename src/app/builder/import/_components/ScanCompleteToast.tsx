"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Building2,
  TrendingUp,
  Users,
  Globe,
  Shield,
  DollarSign,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import type { WikiImportResult } from "~/app/builder/lib/wiki-builder-assembler";

interface ScanCompleteToastProps {
  result: WikiImportResult;
  countryName: string;
  onProceed: () => void;
  onClose: () => void;
}

const sectionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  nationalIdentity: Globe,
  coreIndicators: TrendingUp,
  government: Shield,
  economy: DollarSign,
  demographics: Users,
  laborMarket: Building2,
  fiscalSystem: DollarSign,
};

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-500";
  const derived = label.includes("derived");

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`bg-muted h-2 w-24 overflow-hidden rounded-full`}>
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="text-muted-foreground w-10 text-right font-mono">{value}%</span>
      {derived && (
        <Badge variant="outline" className="h-4 px-1 text-[10px]">
          derived
        </Badge>
      )}
    </div>
  );
}

export function ScanCompleteToast({
  result,
  countryName,
  onProceed,
  onClose,
}: ScanCompleteToastProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    sectionCompleteness,
    selectedComponents,
    suggestedComponents,
    parsedDepartments,
    revenueSources,
    conflicts,
    warnings,
    // eslint-disable-next-line unused-imports/no-unused-vars
    overallCompleteness,
  } = result;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed right-4 bottom-4 z-50 w-full max-w-md"
      >
        <Card className="bg-card/95 border-emerald-500/30 shadow-lg shadow-emerald-500/10 backdrop-blur-md">
          <CardContent className="p-4">
            {/* Header */}
            <div className="mb-3 flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">LoreScanner Complete</h3>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Parsed {Object.values(sectionCompleteness).filter((v) => v >= 80).length}/
                  {Object.keys(sectionCompleteness).length} sections for{" "}
                  <strong>{countryName}</strong>
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick stats */}
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedComponents.length > 0 && (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400"
                >
                  {selectedComponents.length} components
                </Badge>
              )}
              {parsedDepartments.length > 0 && (
                <Badge
                  variant="outline"
                  className="border-blue-500/30 text-xs text-blue-600 dark:text-blue-400"
                >
                  {parsedDepartments.length} departments
                </Badge>
              )}
              {revenueSources.length > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 text-xs text-amber-600 dark:text-amber-400"
                >
                  {revenueSources.length} revenue sources
                </Badge>
              )}
              {conflicts.length > 0 && (
                <Badge
                  variant="outline"
                  className="border-red-500/30 text-xs text-red-600 dark:text-red-400"
                >
                  {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} resolved
                </Badge>
              )}
            </div>

            {/* Expandable details */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between py-1 text-xs transition-colors"
            >
              <span>{expanded ? "Hide" : "View"} details</span>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-border/50 mt-2 space-y-4 border-t pt-3">
                    {/* Section Completeness */}
                    <div>
                      <h4 className="mb-2 text-xs font-medium">Section Completeness</h4>
                      <div className="space-y-1">
                        {Object.entries(sectionCompleteness).map(([key, value]) => {
                          const Icon = sectionIcons[key] ?? Globe;
                          const label = key
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, (s) => s.toUpperCase());
                          // eslint-disable-next-line unused-imports/no-unused-vars
                          const isDerived = ["laborMarket", "fiscalSystem"].includes(key);
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <Icon className="text-muted-foreground h-3 w-3" />
                              <ConfidenceBar value={value} label={label} />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Government Components */}
                    {selectedComponents.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-xs font-medium">Government Components Detected</h4>
                        <div className="space-y-1">
                          {selectedComponents.map((c) => (
                            <div
                              key={c.component}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-muted-foreground">
                                {c.component
                                  .replace(/_/g, " ")
                                  .toLowerCase()
                                  .replace(/\b\w/g, (s) => s.toUpperCase())}
                              </span>
                              <Badge
                                variant="outline"
                                className="h-4 border-emerald-500/30 px-1 text-[10px] text-emerald-600"
                              >
                                {c.score}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested Components */}
                    {suggestedComponents.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-xs font-medium">Suggested (toggle to add)</h4>
                        <div className="space-y-1">
                          {suggestedComponents.map((c) => (
                            <div
                              key={c.component}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-muted-foreground">
                                {c.component
                                  .replace(/_/g, " ")
                                  .toLowerCase()
                                  .replace(/\b\w/g, (s) => s.toUpperCase())}
                              </span>
                              <Badge
                                variant="outline"
                                className="h-4 border-amber-500/30 px-1 text-[10px] text-amber-600"
                              >
                                {c.score}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Departments */}
                    {parsedDepartments.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-xs font-medium">Departments Found</h4>
                        <div className="space-y-1">
                          {parsedDepartments.map((d) => (
                            <div key={d.name} className="text-xs">
                              <span className="text-foreground">{d.name}</span>
                              <span className="text-muted-foreground ml-2">→ {d.category}</span>
                              {d.minister && (
                                <span className="text-muted-foreground ml-1">
                                  (Minister: {d.minister})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Revenue Sources */}
                    {revenueSources.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-xs font-medium">Revenue Sources (≥95%)</h4>
                        <div className="space-y-1">
                          {revenueSources.map((r) => (
                            <div key={r.name} className="flex items-center justify-between text-xs">
                              <span className="text-foreground">{r.name}</span>
                              <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                {r.category}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Conflicts */}
                    {conflicts.length > 0 && (
                      <div>
                        <h4 className="mb-2 flex items-center gap-1 text-xs font-medium">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          Auto-resolved Conflicts
                        </h4>
                        <div className="space-y-1">
                          {conflicts.map((c, i) => (
                            <div key={i} className="text-muted-foreground text-xs">
                              {c.description}
                              {c.resolution && (
                                <span className="mt-0.5 block text-[10px]">
                                  Resolved: {c.resolution}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warning */}
                    {warnings.length > 0 && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2">
                        <div className="flex items-start gap-2">
                          <Info className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                          <div className="space-y-1 text-[11px] text-amber-700 dark:text-amber-400">
                            <p className="font-medium">
                              Note: Automated parsing may not be perfect.
                            </p>
                            {warnings.slice(0, 2).map((w, i) => (
                              <p key={i} className="text-muted-foreground">
                                {w}
                              </p>
                            ))}
                            <p className="text-muted-foreground">
                              Review all sections in the builder before finalizing.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="border-border/50 mt-3 flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
                Review Later
              </Button>
              <Button
                size="sm"
                onClick={onProceed}
                className="h-8 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
              >
                Proceed to Builder <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
