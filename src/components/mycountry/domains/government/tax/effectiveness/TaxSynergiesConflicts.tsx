"use client";

import React from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import {
  Sparks as Sparkles,
  StatUp as TrendingUp,
  WarningTriangle as AlertTriangle,
  CheckCircle,
  WarningCircle as AlertCircle,
  LightBulb,
} from "iconoir-react";
import { type UnifiedEffectiveness, itemVariants } from "./taxEffectivenessTypes";

interface TaxSynergiesConflictsProps {
  unifiedEffectiveness: UnifiedEffectiveness;
}

export function TaxSynergiesConflicts({
  unifiedEffectiveness,
}: TaxSynergiesConflictsProps) {
  if (
    unifiedEffectiveness.synergies.length === 0 &&
    unifiedEffectiveness.conflicts.length === 0
  ) {
    return null;
  }

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <span>Active Synergies & Conflicts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Synergies */}
            {unifiedEffectiveness.synergies.length > 0 && (
              <div className="space-y-3">
                <h4 className="flex items-center space-x-2 text-sm font-semibold text-green-700 dark:text-green-400">
                  <TrendingUp className="h-4 w-4" />
                  <span>Positive Synergies ({unifiedEffectiveness.synergies.length})</span>
                </h4>
                <div className="space-y-2">
                  {unifiedEffectiveness.synergies.map((synergy, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start space-x-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20"
                    >
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-800 dark:text-green-300">
                        {synergy}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Conflicts */}
            {unifiedEffectiveness.conflicts.length > 0 && (
              <div className="space-y-3">
                <h4 className="flex items-center space-x-2 text-sm font-semibold text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Detected Conflicts ({unifiedEffectiveness.conflicts.length})</span>
                </h4>
                <div className="space-y-2">
                  {unifiedEffectiveness.conflicts.map((conflict, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start space-x-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                      <span className="text-sm text-red-800 dark:text-red-300">
                        {conflict}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recommended Fixes */}
          {unifiedEffectiveness.conflicts.length > 0 && (
            <>
              <Separator className="my-4" />
              <Alert>
                <LightBulb className="h-4 w-4" />
                <AlertDescription>
                  <strong>Recommendation:</strong> Review conflicting government components
                  and consider adjusting your system to maximize synergies. Components like
                  Professional Bureaucracy + Rule of Law create optimal tax administration.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
