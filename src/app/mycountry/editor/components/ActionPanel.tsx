"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Activity, RotateCcw, Sparkles, Zap, Save } from "lucide-react";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";

interface ActionPanelProps {
  realTimeValidation: boolean;
  setRealTimeValidation: (value: boolean) => void;
  handleReset: () => void;
  hasChanges: boolean;
  showAdvanced: boolean;
  setShowAdvanced: (value: boolean) => void;
  economicInputs: EconomicInputs | null;
  handleSave: () => Promise<void>;
  isSaving: boolean;
  errorCount: number;
}

export function ActionPanel({
  realTimeValidation,
  setRealTimeValidation,
  handleReset,
  hasChanges,
  showAdvanced,
  setShowAdvanced,
  economicInputs,
  handleSave,
  isSaving,
  errorCount,
}: ActionPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="glass-hierarchy-parent border-gray-200/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setRealTimeValidation(!realTimeValidation)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Activity className={`h-4 w-4 ${realTimeValidation ? 'text-green-500' : 'text-gray-400'}`} />
                Real-time Validation
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                disabled={!hasChanges}
                className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <RotateCcw className="h-4 w-4" />
                Reset All Changes
              </Button>
              <Button
                onClick={() => setShowAdvanced(!showAdvanced)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
              </Button>
            </div>

            <div className="flex items-center gap-4">
              {hasChanges && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Zap className="h-4 w-4 text-blue-500" />
                  <NumberFlowDisplay value={Object.keys(economicInputs || {}).length} /> unsaved changes
                </motion.div>
              )}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || errorCount > 0 || isSaving}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                      />
                      Saving Changes...
                    </>
                  ) : (
                    `Save ${hasChanges ? 'Changes' : 'All Data'}`
                  )}
                </Button>
              </motion.div>
            </div>
          </div>
          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Changes will be applied immediately and reflected in your country's public profile.
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}