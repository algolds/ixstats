import { motion } from "framer-motion";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Activity, Zap, AlertTriangle, CheckCircle } from "lucide-react";

interface EditorStatusBarProps {
  flagUrl: string | null;
  country: any; // TODO: Define a proper type for country
  hasChanges: boolean;
  economicInputs: any; // TODO: Define a proper type for economicInputs
  realTimeValidation: boolean;
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
  errorCount: number;
  warningCount: number;
  realGDPGrowthRate: number; // New prop
  inflationRate: number;     // New prop
  gdpPerCapita: number;      // New prop
  populationTier: string;    // New prop
}

// Helper functions (copied from CoreEconomicIndicatorsComponent.tsx)
function calculateEconomicTierLocally(gdp: number): string {
  if (gdp >= 65000) return "Extravagant";
  if (gdp >= 55000) return "Very Strong";
  if (gdp >= 45000) return "Strong";
  if (gdp >= 35000) return "Healthy";
  if (gdp >= 25000) return "Developed";
  if (gdp >= 10000) return "Emerging";
  return "Developing";
}

function computeHealth(g: number, i: number) {
  if (g > 0.04 && i < 0.03) return { label: "Excellent", color: "text-green-600" };
  if (g > 0.02 && i < 0.05) return { label: "Good", color: "text-blue-600" };
  if (g > 0 && i < 0.08) return { label: "Moderate", color: "text-yellow-600" };
  return { label: "Concerning", color: "text-red-600" };
}

export function EditorStatusBar({
  flagUrl,
  country,
  hasChanges,
  economicInputs,
  realTimeValidation,
  showAdvanced,
  setShowAdvanced,
  errorCount,
  warningCount,
  realGDPGrowthRate, // Destructure new prop
  inflationRate,     // Destructure new prop
  gdpPerCapita,      // Destructure new prop
  populationTier,    // Destructure new prop
}: EditorStatusBarProps) {
  const economicTier = calculateEconomicTierLocally(gdpPerCapita);
  const healthIndicator = computeHealth(realGDPGrowthRate, inflationRate);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="glass-hierarchy-parent border-amber-200 dark:border-amber-700/40 overflow-hidden relative">
        {/* Flag Background */}
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
              <Badge variant="outline" className="bg-white/80 dark:bg-gray-800/80">{economicTier}</Badge> {/* Updated tier badge */}
              <Badge variant="outline" className="bg-white/80 dark:bg-gray-800/80">Tier {populationTier}</Badge>
              <Badge variant="outline" className={`bg-white/80 dark:bg-gray-800/80 ${healthIndicator.color}`}> {/* Economic Health Badge */}
                Economic Health: {healthIndicator.label}
              </Badge>
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
              <Badge variant="outline" className="bg-white/80 dark:bg-gray-800/80">
                <Activity className="h-3 w-3" />
                Real-time Validation: {realTimeValidation ? 'ON' : 'OFF'}
              </Badge>
              <div className="flex items-center space-x-2">
                <Switch id="advanced-mode" checked={showAdvanced} onCheckedChange={setShowAdvanced} />
                <Label htmlFor="advanced-mode">Advanced</Label>
              </div>
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
