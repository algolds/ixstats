"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Zap, Activity, AlertTriangle, CheckCircle } from "lucide-react";
import type { Country } from "~/types/ixstats";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface StatusBarProps {
  country: Country;
  flagUrl: string;
  hasChanges: boolean;
  economicInputs: EconomicInputs | null;
  errors: ValidationError[];
  realTimeValidation: boolean;
}

export function StatusBar({
  country,
  flagUrl,
  hasChanges,
  economicInputs,
  errors,
  realTimeValidation,
}: StatusBarProps) {
  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="glass-hierarchy-parent border-amber-200 dark:border-amber-700/40 overflow-hidden relative">
        {flagUrl && (
          <div className="absolute inset-0">
            <img
              src={flagUrl}
              alt={`${country.name} flag`}
              className="w-full h-full object-cover opacity-20 scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-amber-50/90 to-yellow-50/90 dark:from-amber-900/20 dark:to-yellow-800/15" />
          </div>
        )}
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="bg-white/80 dark:bg-gray-800/80">{(country as any).economicTier || 'Unknown'}</Badge>
              <Badge variant="outline" className="bg-white/80 dark:bg-gray-800/80">Tier {(country as any).populationTier || 'Unknown'}</Badge>
              {hasChanges && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    <Zap className="h-3 w-3" />
                    <NumberFlowDisplay value={Object.keys(economicInputs || {}).length} /> Changes Pending
                  </Badge>
                </motion.div>
              )}
              <Badge variant="outline" className="flex items-center gap-1 bg-white/80 dark:bg-gray-800/80">
                <Activity className="h-3 w-3" />
                Real-time Validation: {realTimeValidation ? 'ON' : 'OFF'}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              {errorCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    <NumberFlowDisplay value={errorCount} /> Error{errorCount !== 1 ? 's' : ''}
                  </Badge>
                </motion.div>
              )}
              {warningCount > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                  <AlertTriangle className="h-3 w-3" />
                  <NumberFlowDisplay value={warningCount} /> Warning{warningCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {!hasChanges && errorCount === 0 && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  <CheckCircle className="h-3 w-3" />
                  All Systems Operational
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}