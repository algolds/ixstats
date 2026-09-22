"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import {
  Flash as Zap,
  Shield,
  City as Building2,
  Group as Users,
  CheckCircle,
  WarningCircle as AlertCircle,
  InfoCircle as Info,
} from "iconoir-react";
import type { UnifiedEffectiveness } from "./taxEffectivenessTypes";

interface TaxGovernmentIntegrationTabProps {
  governmentIntegration: UnifiedEffectiveness["governmentIntegration"];
}

export function TaxGovernmentIntegrationTab({
  governmentIntegration,
}: TaxGovernmentIntegrationTabProps) {
  return (
    <div className="space-y-4">
      {/* Digital Infrastructure */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/20">
        <div className="flex items-center space-x-3">
          <div
            className={`rounded-lg p-2 ${
              governmentIntegration.digitalInfrastructure
                ? "bg-green-100 dark:bg-green-900/30"
                : "bg-gray-200 dark:bg-gray-800"
            }`}
          >
            <Zap
              className={`h-5 w-5 ${
                governmentIntegration.digitalInfrastructure
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-400"
              }`}
            />
          </div>
          <div>
            <div className="font-medium">Digital Infrastructure</div>
            <div className="text-muted-foreground text-sm">
              Automated tax filing and payment systems
            </div>
          </div>
        </div>
        {governmentIntegration.digitalInfrastructure ? (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="mr-1 h-3 w-3" />
            Active
          </Badge>
        ) : (
          <Badge variant="outline">
            <AlertCircle className="mr-1 h-3 w-3" />
            Not Active
          </Badge>
        )}
      </div>

      {/* Enforcement Capacity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="font-medium">Enforcement Capacity</span>
          </div>
          <Badge variant="outline">
            {Math.round(governmentIntegration.enforcementCapacity)}%
          </Badge>
        </div>
        <Progress value={governmentIntegration.enforcementCapacity} className="h-3" />
        <p className="text-muted-foreground text-xs">
          Government&apos;s ability to enforce tax compliance and prosecute evasion
        </p>
      </div>

      {/* Institutional Quality */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">Institutional Quality</span>
          </div>
          <Badge variant="outline">
            {Math.round(governmentIntegration.institutionalQuality)}%
          </Badge>
        </div>
        <Progress value={governmentIntegration.institutionalQuality} className="h-3" />
        <p className="text-muted-foreground text-xs">
          Quality and professionalism of tax administration institutions
        </p>
      </div>

      {/* Administrative Efficiency */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="font-medium">Administrative Efficiency</span>
          </div>
          <Badge variant="outline">
            {Math.round(governmentIntegration.administrativeEfficiency)}%
          </Badge>
        </div>
        <Progress value={governmentIntegration.administrativeEfficiency} className="h-3" />
        <p className="text-muted-foreground text-xs">
          Speed and cost-effectiveness of tax administration processes
        </p>
      </div>

      <Separator />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Integration Benefits:</strong> Government components directly impact tax system
          effectiveness. Add Digital Infrastructure or Professional Bureaucracy to maximize
          collection efficiency.
        </AlertDescription>
      </Alert>
    </div>
  );
}
