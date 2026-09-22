"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  LightBulb,
  WarningTriangle as AlertTriangle,
  CheckCircle,
  InfoCircle as Info,
} from "iconoir-react";
import type { EconomicTierRecommendation } from "./taxSyncTypes";

interface TaxRecommendationsTabProps {
  tierRecommendation: EconomicTierRecommendation;
}

export function TaxRecommendationsTab({
  tierRecommendation,
}: TaxRecommendationsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LightBulb className="h-5 w-5" />
          Tier-Based Policy Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tierRecommendation.recommendations.map((rec, index) => (
          <Alert key={index} variant={rec.includes("WARNING") ? "destructive" : "default"}>
            {rec.includes("WARNING") ? (
              <AlertTriangle className="h-4 w-4" />
            ) : tierRecommendation.currentAlignment === "aligned" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4" />
            )}
            <AlertDescription>{rec}</AlertDescription>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}
