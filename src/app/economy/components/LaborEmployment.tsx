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
import type { LaborEmploymentData, RealCountryData } from "../lib/economy-data-service";

interface LaborEmploymentProps {
  laborData: LaborEmploymentData;
  referenceCountry: RealCountryData;
  totalPopulation: number;
  onLaborDataChange: (laborData: LaborEmploymentData) => void;
}

export function LaborEmploymentComponent({
  laborData,
  referenceCountry,
  totalPopulation,
  onLaborDataChange,
}: LaborEmploymentProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed'>('overview');

  const handleInputChange = (field: keyof LaborEmploymentData, value: number) => {
    const newLaborData = { ...laborData, [field]: value };
    
    // Auto-calculate derived values
    if (field === 'laborForceParticipationRate') {
      const workingAgePopulation = totalPopulation * 0.65; // Assume 65% working age
      newLaborData.totalWorkforce = Math.round(workingAgePopulation * (value / 100));
    } else if (field === 'unemploymentRate') {
      newLaborData.employmentRate = 100 - value;
    } else if (field === 'employmentRate') {
      newLaborData.unemploymentRate = 100 - value;
    }
    
    onLaborDataChange(newLaborData);
  };

  const formatNumber = (num: number, precision = 0): string => {
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(precision)}K`;
    return num.toFixed(precision);
  };

  const workingAgePopulation = Math.round(totalPopulation * 0.65);
  const laborForce = Math.round(workingAgePopulation * (laborData.laborForceParticipationRate / 100));
  const employed = Math.round(laborForce * (laborData.employmentRate / 100));
  const unemployed = laborForce - employed;

  const laborMetrics = [
    {
      label: "Labor Force Participation",
      value: laborData.laborForceParticipationRate,
      unit: "%",
      target: 65,
      color: "bg-blue-500",
      description: "% of working-age population in labor force"
    },
    {
      label: "Employment Rate",
      value: laborData.employmentRate,
      unit: "%",
      target: 95,
      color: "bg-green-500",
      description: "% of labor force employed"
    },
    {
      label: "Unemployment Rate",
      value: laborData.unemploymentRate,
      unit: "%",
      target: 5,
      color: "bg-red-500",
      description: "% of labor force seeking employment",
      reverse: true
    },
  ];

  const getEmploymentHealth = () => {
    if (laborData.unemploymentRate <= 4) return { color: "text-green-600", label: "Full Employment" };
    if (laborData.unemploymentRate <= 7) return { color: "text-blue-600", label: "Healthy" };
    if (laborData.unemploymentRate <= 12) return { color: "text-yellow-600", label: "Moderate Concern" };
    return { color: "text-red-600", label: "High Unemployment" };
  };

  const employmentHealth = getEmploymentHealth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
          <Briefcase className="h-5 w-5 mr-2 text-[var(--color-brand-primary)]" />
          Labor & Employment
        </h3>
        <div className="flex bg-[var(--color-bg-tertiary)] rounded-lg p-1">
          <button
            onClick={() => setSelectedView('overview')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedView === 'overview'
                ? 'bg-[var(--color-brand-primary)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedView('detailed')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedView === 'detailed'
                ? 'bg-[var(--color-brand-primary)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Detailed
          </button>
        </div>
      </div>

      {/* Labor Force Visualization */}
      <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center">
          <BarChart2 className="h-4 w-4 mr-2" />
          Labor Force Breakdown
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {formatNumber(totalPopulation)}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">Total Population</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(workingAgePopulation)}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">Working Age (65%)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-brand-primary)]">
              {formatNumber(laborForce)}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">Labor Force</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-lg font-bold text-green-600">
                {formatNumber(employed)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Employed</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-600">
                {formatNumber(unemployed)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Unemployed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Labor Metrics with Bar Charts */}
      <div className="space-y-4">
        {laborMetrics.map((metric) => {
          const percentage = metric.reverse 
            ? Math.max(0, 100 - metric.value) 
            : Math.min(100, (metric.value / metric.target) * 100);
          
          return (
            <div key={metric.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">
                  {metric.label}
                </label>
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {metric.value.toFixed(1)}{metric.unit}
                </div>
              </div>
              <div className="relative">
                <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${metric.color} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max={metric.label === "Labor Force Participation" ? "100" : "100"}
                  step="0.1"
                  value={metric.value}
                  onChange={(e) => handleInputChange(
                    metric.label === "Labor Force Participation" ? 'laborForceParticipationRate' :
                    metric.label === "Employment Rate" ? 'employmentRate' : 'unemploymentRate',
                    parseFloat(e.target.value)
                  )}
                  className="absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
                />
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {metric.description}
                {referenceCountry && metric.label === "Unemployment Rate" && (
                  <span className="ml-2 text-[var(--color-brand-secondary)]">
                    Ref: {referenceCountry.unemploymentRate.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedView === 'detailed' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="form-label flex items-center">
                <Clock className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                Average Workweek Hours
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="20"
                  max="60"
                  step="1"
                  value={laborData.averageWorkweekHours}
                  onChange={(e) => handleInputChange('averageWorkweekHours', parseFloat(e.target.value))}
                  className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>20h</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {laborData.averageWorkweekHours}h/week
                  </span>
                  <span>60h</span>
                </div>
              </div>
            </div>

            <div>
              <label className="form-label flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                Minimum Wage ($/hour)
              </label>
              <input
                type="number"
                value={laborData.minimumWage}
                onChange={(e) => handleInputChange('minimumWage', parseFloat(e.target.value) || 0)}
                className="form-input"
                step="0.25"
                min="0"
              />
              <div className="text-xs text-[var(--color-text-muted)]">
                Annual: ${(laborData.minimumWage * laborData.averageWorkweekHours * 52).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                Average Annual Income ($)
              </label>
              <input
                type="number"
                value={laborData.averageAnnualIncome}
                onChange={(e) => handleInputChange('averageAnnualIncome', parseFloat(e.target.value) || 0)}
                className="form-input"
                step="1000"
                min="0"
              />
              <div className="text-xs text-[var(--color-text-muted)]">
                Hourly equiv: ${(laborData.averageAnnualIncome / (laborData.averageWorkweekHours * 52)).toFixed(2)}/hour
              </div>
            </div>

            <div>
              <label className="form-label flex items-center">
                <Users className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                Total Workforce
              </label>
              <input
                type="number"
                value={laborData.totalWorkforce}
                onChange={(e) => handleInputChange('totalWorkforce', parseFloat(e.target.value) || 0)}
                className="form-input"
                step="1000"
                min="0"
              />
              <div className="text-xs text-[var(--color-text-muted)]">
                {((laborData.totalWorkforce / totalPopulation) * 100).toFixed(1)}% of total population
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-[var(--color-info)] mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Employment Health: <span className={employmentHealth.color}>{employmentHealth.label}</span>
            </h4>
            <p className="text-xs text-[var(--color-text-muted)]">
              {laborData.unemploymentRate <= 4 
                ? "Your economy is at full employment. Consider policies to avoid labor shortages."
                : laborData.unemploymentRate <= 7
                ? "Healthy employment levels with room for sustainable growth."
                : laborData.unemploymentRate <= 12
                ? "Moderate unemployment may require job creation programs."
                : "High unemployment requires significant economic intervention and job creation initiatives."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
