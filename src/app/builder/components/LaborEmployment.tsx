// src/app/economy/components/LaborEmployment.tsx
"use client";

import { useState } from "react";
import {
  Users,
  Briefcase,
  Clock,
  DollarSign,
  TrendingDown,
  BarChart2,
  Info,
  AlertCircle,
} from "lucide-react";
import type { LaborEmploymentData, RealCountryData, CoreEconomicIndicators } from "../lib/economy-data-service"; // Added CoreEconomicIndicators
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { formatNumber, formatPercentage } from "~/lib/chart-utils";

interface LaborEmploymentProps {
  laborData: LaborEmploymentData;
  referenceCountry?: RealCountryData;
  totalPopulation: number;
  /** SERVER ACTION */
  onLaborDataChangeAction: (laborData: LaborEmploymentData) => void; // Renamed prop
  isReadOnly?: boolean;
  showComparison?: boolean;
  // Added missing props that might be passed by EconomicDataDisplay based on the errors
  indicators?: CoreEconomicIndicators; 
  onIndicatorsChangeAction?: (i: CoreEconomicIndicators) => void;
}

export function LaborEmploymentComponent({ // Renamed component
  laborData,
  referenceCountry,
  totalPopulation,
  onLaborDataChangeAction, // Use renamed prop
  isReadOnly = false,
  showComparison = true,
  indicators, // Accept the prop
  onIndicatorsChangeAction, // Accept the prop
}: LaborEmploymentProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed'>('overview');
  const [data, setData] = useState(laborData);

  const handleInputChange = (field: keyof LaborEmploymentData, value: number) => {
    if (isReadOnly) return;
    const newLaborData = { ...data, [field]: value };
    
    if (field === 'laborForceParticipationRate') {
      const workingAgePopulation = totalPopulation * 0.65; 
      newLaborData.totalWorkforce = Math.round(workingAgePopulation * (value / 100));
    } else if (field === 'unemploymentRate') {
      newLaborData.employmentRate = 100 - value;
    } else if (field === 'employmentRate') {
      newLaborData.unemploymentRate = 100 - value;
    }
    
    setData(newLaborData);
    onLaborDataChangeAction(newLaborData); // Use renamed prop
  };

  const formatNumber = (num: number, precision = 0): string => {
    if (num === undefined || num === null || isNaN(num)) return 'N/A';
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(precision)}K`;
    return num.toFixed(precision);
  };

  const workingAgePopulation = Math.round(totalPopulation * 0.65);
  const laborForce = Math.round(workingAgePopulation * (data.laborForceParticipationRate / 100));
  const employed = Math.round(laborForce * (data.employmentRate / 100));
  const unemployed = laborForce - employed;

  const laborMetrics = [
    {
      label: "Labor Force Participation",
      value: data.laborForceParticipationRate,
      unit: "%",
      target: 65,
      color: "bg-blue-500",
      description: "% of working-age population in labor force"
    },
    {
      label: "Employment Rate",
      value: data.employmentRate,
      unit: "%",
      target: 95,
      color: "bg-green-500",
      description: "% of labor force employed"
    },
    {
      label: "Unemployment Rate",
      value: data.unemploymentRate,
      unit: "%",
      target: 5,
      color: "bg-red-500",
      description: "% of labor force seeking employment",
      reverse: true
    },
  ];

  const getEmploymentHealth = () => {
    if (data.unemploymentRate <= 4) return { color: "text-green-600", label: "Full Employment" };
    if (data.unemploymentRate <= 7) return { color: "text-blue-600", label: "Healthy" };
    if (data.unemploymentRate <= 12) return { color: "text-yellow-600", label: "Moderate Concern" };
    return { color: "text-red-600", label: "High Unemployment" };
  };

  const employmentHealth = getEmploymentHealth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Labor & Employment
        </CardTitle>
        <CardDescription>
          Key indicators for the workforce and job market.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isReadOnly && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Editing these values will affect overall economic calculations.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="laborForceParticipationRate">Labor Force Participation Rate (%)</Label>
            <Input
              id="laborForceParticipationRate"
              type="number"
              value={data.laborForceParticipationRate}
              onChange={(e) =>
                handleInputChange(
                  "laborForceParticipationRate",
                  parseFloat(e.target.value)
                )
              }
              step="0.1"
              disabled={isReadOnly}
            />
          </div>

          <div>
            <Label htmlFor="employmentRate">Employment Rate (%)</Label>
            <Input
              id="employmentRate"
              type="number"
              value={data.employmentRate}
              onChange={(e) =>
                handleInputChange("employmentRate", parseFloat(e.target.value))
              }
              step="0.1"
              disabled={isReadOnly}
            />
          </div>

          <div>
            <Label htmlFor="unemploymentRate">Unemployment Rate (%)</Label>
            <Input
              id="unemploymentRate"
              type="number"
              value={data.unemploymentRate}
              onChange={(e) =>
                handleInputChange("unemploymentRate", parseFloat(e.target.value))
              }
              step="0.1"
              disabled={isReadOnly}
            />
            {showComparison && referenceCountry && (
              <p className={`text-sm mt-1 ${data.unemploymentRate < referenceCountry.unemploymentRate ? 'text-green-600' : 'text-red-600'}`}>
                {data.unemploymentRate < referenceCountry.unemploymentRate ? 'Lower' : 'Higher'} than {referenceCountry.name} ({referenceCountry.unemploymentRate.toFixed(1)}%)
              </p>
            )}
          </div>

           <div>
            <Label htmlFor="totalWorkforce">Total Workforce</Label>
             <Input
               id="totalWorkforce"
               type="text"
               value={formatNumber(data.totalWorkforce, 0) } 
               disabled={true} 
             />
             <p className="text-xs text-muted-foreground mt-1">{formatPercentage(data.laborForceParticipationRate)} of working age pop. ({formatNumber(workingAgePopulation,0)})</p>
           </div>

          <div>
            <Label htmlFor="averageWorkweekHours">Average Workweek Hours</Label>
            <Input
              id="averageWorkweekHours"
              type="number"
              value={data.averageWorkweekHours}
              onChange={(e) =>
                handleInputChange("averageWorkweekHours", parseFloat(e.target.value))
              }
              step="0.1"
              disabled={isReadOnly}
            />
          </div>

          <div>
            <Label htmlFor="minimumWage">Minimum Wage</Label>
            <Input
              id="minimumWage"
              type="number"
              value={data.minimumWage}
              onChange={(e) => handleInputChange("minimumWage", parseFloat(e.target.value))}
              step="0.01"
              disabled={isReadOnly}
            />
          </div>

          <div>
            <Label htmlFor="averageAnnualIncome">Average Annual Income</Label>
            <Input
              id="averageAnnualIncome"
              type="number"
              value={data.averageAnnualIncome}
              onChange={(e) =>
                handleInputChange("averageAnnualIncome", parseFloat(e.target.value))
              }
              step="100"
              disabled={isReadOnly}
            />
          </div>
        </div>

        <div className="mt-4">
          <Label>Labor Market Health</Label>
          <div className="flex items-center gap-2 mt-1">
            <span className={`font-medium ${employmentHealth.color}`}>{employmentHealth.label}</span>
             <Progress value={100 - data.unemploymentRate} className="w-full" />
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
