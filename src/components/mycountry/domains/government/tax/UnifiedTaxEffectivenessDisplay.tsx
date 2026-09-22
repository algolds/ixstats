"use client";

import React from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { TooltipProvider } from "~/components/ui/tooltip";
import {
  WarningTriangle as AlertTriangle,
  CheckCircle,
  InfoCircle as Info,
  StatsReport as BarChart3,
  City as Building2,
} from "iconoir-react";
import {
  type UnifiedTaxEffectivenessDisplayProps,
  computeUnifiedTaxEffectiveness,
  containerVariants,
  itemVariants,
  TaxEffectivenessGauge,
  TaxSynergiesConflicts,
  TaxEconomicImpactTab,
  TaxGovernmentIntegrationTab,
} from "./effectiveness";

export function UnifiedTaxEffectivenessDisplay({
  taxComponents = [],
  governmentComponents = [],
  economicData,
  taxSystem,
  onViewDetails,
  className = "",
}: UnifiedTaxEffectivenessDisplayProps) {
  const unifiedEffectiveness = React.useMemo(() => {
    return computeUnifiedTaxEffectiveness(
      taxComponents,
      governmentComponents,
      economicData,
      taxSystem
    );
  }, [taxComponents, governmentComponents, economicData, taxSystem]);

  return (
    <TooltipProvider>
      <motion.div
        className={`space-y-6 ${className}`}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Overall Effectiveness Gauge */}
        <TaxEffectivenessGauge
          unifiedEffectiveness={unifiedEffectiveness}
          onViewDetails={onViewDetails}
        />

        {/* Synergies and Conflicts */}
        <TaxSynergiesConflicts unifiedEffectiveness={unifiedEffectiveness} />

        {/* Tabbed Content: Economic Impact & Government Integration */}
        <motion.div variants={itemVariants}>
          <Card>
            <Tabs defaultValue="economic" className="w-full">
              <CardHeader>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="economic" className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Economic Impact</span>
                  </TabsTrigger>
                  <TabsTrigger value="government" className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4" />
                    <span>Government Integration</span>
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                <TabsContent value="economic" className="space-y-4">
                  <TaxEconomicImpactTab
                    economicImpact={unifiedEffectiveness.economicImpact}
                  />
                </TabsContent>

                <TabsContent value="government" className="space-y-4">
                  <TaxGovernmentIntegrationTab
                    governmentIntegration={unifiedEffectiveness.governmentIntegration}
                  />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </motion.div>

        {/* Summary Alerts */}
        {unifiedEffectiveness.overallScore < 60 && (
          <motion.div variants={itemVariants}>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Critical Tax Effectiveness:</strong> Your tax system effectiveness is below
                60%. Consider adding government components like Professional Bureaucracy or Rule of
                Law to improve collection and compliance.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {unifiedEffectiveness.overallScore >= 80 && (
          <motion.div variants={itemVariants}>
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                <strong>Excellent Tax System:</strong> Your unified tax effectiveness is{" "}
                {Math.round(unifiedEffectiveness.overallScore)}%. This configuration maximizes
                revenue collection while maintaining high compliance.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* No Components Warning */}
        {governmentComponents.length === 0 && taxComponents.length === 0 && (
          <motion.div variants={itemVariants}>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No government or tax components detected. Build your government structure and tax
                system to see unified effectiveness metrics.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </motion.div>
    </TooltipProvider>
  );
}
