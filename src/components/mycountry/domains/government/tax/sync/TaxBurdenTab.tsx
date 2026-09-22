"use client";

import React from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Group as Users, ScaleFrameEnlarge as Scale } from "iconoir-react";
import type { TaxBurdenAnalysis } from "./taxSyncTypes";

interface TaxBurdenTabProps {
  taxBurdenAnalysis: TaxBurdenAnalysis[];
  formatCurrency: (amount: number) => string;
  formatPercentage: (rate: number) => string;
}

export function TaxBurdenTab({
  taxBurdenAnalysis,
  formatCurrency,
  formatPercentage,
}: TaxBurdenTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Tax Burden Distribution by Income Class
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {taxBurdenAnalysis.map((burden, index) => (
          <motion.div
            key={burden.incomeClass}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="rounded-lg border bg-gradient-to-r from-white/50 to-gray-50/50 p-4 dark:from-gray-800/50 dark:to-gray-900/50"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  {burden.incomeClass}
                  <Badge
                    variant={
                      burden.status === "low"
                        ? "default"
                        : burden.status === "moderate"
                          ? "secondary"
                          : burden.status === "high"
                            ? "outline"
                            : "destructive"
                    }
                  >
                    {burden.status}
                  </Badge>
                </div>
                <div className="text-muted-foreground text-sm">
                  {burden.populationPercent}% of population
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold" style={{ color: burden.color }}>
                  {formatPercentage(burden.effectiveTaxRate)}
                </div>
                <div className="text-muted-foreground text-xs">Effective Rate</div>
              </div>
            </div>

            <div className="space-y-2">
              <Progress value={burden.effectiveTaxRate} className="h-2" />

              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Average Income</div>
                  <div className="font-semibold">{formatCurrency(burden.averageIncome)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Tax Burden</div>
                  <div className="font-semibold text-red-600">
                    {formatCurrency(burden.taxBurden)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Disposable Income</div>
                  <div className="font-semibold text-green-600">
                    {formatCurrency(burden.disposableIncome)}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Progressivity Analysis */}
        {taxBurdenAnalysis.length >= 2 && (
          <Alert>
            <Scale className="h-4 w-4" />
            <AlertDescription>
              <strong>Progressivity Analysis:</strong> Tax rate increases from{" "}
              {formatPercentage(taxBurdenAnalysis[0].effectiveTaxRate)} (low income) to{" "}
              {formatPercentage(
                taxBurdenAnalysis[taxBurdenAnalysis.length - 1].effectiveTaxRate
              )}{" "}
              (high income).
              {taxBurdenAnalysis[0].effectiveTaxRate >=
                taxBurdenAnalysis[taxBurdenAnalysis.length - 1].effectiveTaxRate && (
                <span className="font-semibold text-red-600">
                  {" "}
                  WARNING: System is regressive!
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
