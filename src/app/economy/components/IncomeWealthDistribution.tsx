// src/app/economy/components/IncomeWealthDistribution.tsx
"use client";

import { useState } from "react";
import {
  Users,
  DollarSign,
  TrendingUp,
  BarChart3,
  Scale,
  ArrowUpRight,
  Info,
  AlertCircle,
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface EconomicClass {
  name: string;
  populationPercent: number;
  wealthPercent: number;
  averageIncome: number;
  color: string;
}

interface IncomeWealthData {
  economicClasses: EconomicClass[];
  povertyRate: number;
  incomeInequalityGini: number;
  socialMobilityIndex: number;
}

interface IncomeWealthDistributionProps {
  incomeData: IncomeWealthData;
  totalPopulation: number;
  gdpPerCapita: number;
  onIncomeDataChange: (incomeData: IncomeWealthData) => void;
}

export function IncomeWealthDistribution({
  incomeData,
  totalPopulation,
  gdpPerCapita,
  onIncomeDataChange,
}: IncomeWealthDistributionProps) {
  const [selectedView, setSelectedView] = useState<'classes' | 'inequality' | 'mobility'>('classes');

  const handleClassPercentChange = (index: number, value: number) => {
    const newClasses = [...incomeData.economicClasses];
    
    // Calculate the total of all other percentages
    const totalOthers = newClasses.reduce((sum, cls, idx) => 
      idx !== index ? sum + cls.populationPercent : sum, 0);
    
    // Adjust the new value to ensure total is 100%
    const adjustedValue = Math.min(value, 100 - totalOthers);
    
    if (newClasses[index]) {
      newClasses[index] = {
        ...newClasses[index],
        populationPercent: adjustedValue
      };
      
      // Normalize other values to ensure total is 100%
      const remainingPercent = 100 - adjustedValue;
      const normalizedClasses = newClasses.map((cls, idx) => {
        if (idx === index) return cls;
        
        const normalizedPercent = (cls.populationPercent / totalOthers) * remainingPercent;
        return {
          ...cls,
          populationPercent: normalizedPercent
        };
      });
      
      onIncomeDataChange({
        ...incomeData,
        economicClasses: normalizedClasses
      });
    }
  };

  const handleWealthPercentChange = (index: number, value: number) => {
    const newClasses = [...incomeData.economicClasses];
    
    // Calculate the total of all other percentages
    const totalOthers = newClasses.reduce((sum, cls, idx) => 
      idx !== index ? sum + cls.wealthPercent : sum, 0);
    
    // Adjust the new value to ensure total is 100%
    const adjustedValue = Math.min(value, 100 - totalOthers);
    
    if (newClasses[index]) {
      newClasses[index] = {
        ...newClasses[index],
        wealthPercent: adjustedValue
      };
      
      // Normalize other values to ensure total is 100%
      const remainingPercent = 100 - adjustedValue;
      const normalizedClasses = newClasses.map((cls, idx) => {
        if (idx === index) return cls;
        
        const normalizedPercent = (cls.wealthPercent / totalOthers) * remainingPercent;
        return {
          ...cls,
          wealthPercent: normalizedPercent
        };
      });
      
      onIncomeDataChange({
        ...incomeData,
        economicClasses: normalizedClasses
      });
    }
  };

  const handleIncomeChange = (index: number, value: number) => {
    const newClasses = [...incomeData.economicClasses];
    
    if (newClasses[index]) {
      newClasses[index] = {
        ...newClasses[index],
        averageIncome: value
      };
      
      onIncomeDataChange({
        ...incomeData,
        economicClasses: newClasses
      });
    }
  };

  const handleInputChange = (field: keyof IncomeWealthData, value: number) => {
    if (field === 'economicClasses') return;
    
    onIncomeDataChange({
      ...incomeData,
      [field]: value
    });
  };

  const formatNumber = (num: number, precision = 0, isCurrency = true): string => {
    const prefix = isCurrency ? '$' : '';
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(precision)}`;
  };

  const calculatePopulationInClass = (percent: number): number => {
    return Math.round(totalPopulation * (percent / 100));
  };

  const getInequalityRating = () => {
    const gini = incomeData.incomeInequalityGini;
    if (gini <= 0.25) return { color: "text-green-600", label: "Very Equal" };
    if (gini <= 0.35) return { color: "text-blue-600", label: "Moderately Equal" };
    if (gini <= 0.45) return { color: "text-yellow-600", label: "Average Inequality" };
    if (gini <= 0.55) return { color: "text-orange-600", label: "High Inequality" };
    return { color: "text-red-600", label: "Extreme Inequality" };
  };

  const getMobilityRating = () => {
    const mobility = incomeData.socialMobilityIndex;
    if (mobility >= 80) return { color: "text-green-600", label: "Very High Mobility" };
    if (mobility >= 60) return { color: "text-blue-600", label: "High Mobility" };
    if (mobility >= 40) return { color: "text-yellow-600", label: "Moderate Mobility" };
    if (mobility >= 20) return { color: "text-orange-600", label: "Low Mobility" };
    return { color: "text-red-600", label: "Very Low Mobility" };
  };

  const inequalityRating = getInequalityRating();
  const mobilityRating = getMobilityRating();

  // Data for pie chart
  const populationData = incomeData.economicClasses.map(cls => ({
    name: cls.name,
    value: cls.populationPercent,
    color: cls.color
  }));

  const wealthData = incomeData.economicClasses.map(cls => ({
    name: cls.name,
    value: cls.wealthPercent,
    color: cls.color
  }));

  // Data for bar chart
  const incomeData2 = incomeData.economicClasses.map(cls => ({
    name: cls.name,
    income: cls.averageIncome,
    color: cls.color
  }));

  // Lorenz curve data for inequality visualization
  const generateLorenzCurveData = () => {
    const sortedClasses = [...incomeData.economicClasses].sort((a, b) => a.averageIncome - b.averageIncome);
    
    let cumulativePopulation = 0;
    let cumulativeIncome = 0;
    const totalIncome = sortedClasses.reduce((sum, cls) => 
      sum + (cls.averageIncome * cls.populationPercent), 0);
    
    const points = [{ x: 0, y: 0 }]; // Start at origin
    
    sortedClasses.forEach(cls => {
      cumulativePopulation += cls.populationPercent;
      cumulativeIncome += (cls.averageIncome * cls.populationPercent);
      
      points.push({
        x: cumulativePopulation,
        y: (cumulativeIncome / totalIncome) * 100
      });
    });
    
    // Add perfect equality line
    const equalityLine = [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ];
    
    return { lorenzCurve: points, equalityLine };
  };

  const { lorenzCurve, equalityLine } = generateLorenzCurveData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
          <Scale className="h-5 w-5 mr-2 text-[var(--color-brand-primary)]" />
          Income & Wealth Distribution
        </h3>
        <div className="flex bg-[var(--color-bg-tertiary)] rounded-lg p-1">
          {['classes', 'inequality', 'mobility'].map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view as any)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                selectedView === view
                  ? 'bg-[var(--color-brand-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      {/* Distribution Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {incomeData.economicClasses.length}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Economic Classes</div>
        </div>

        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <Scale className="h-6 w-6 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {incomeData.incomeInequalityGini.toFixed(2)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Gini Coefficient</div>
          <div className={`text-xs ${inequalityRating.color}`}>
            {inequalityRating.label}
          </div>
        </div>

        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <ArrowUpRight className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {incomeData.socialMobilityIndex}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Social Mobility Index</div>
          <div className={`text-xs ${mobilityRating.color}`}>
            {mobilityRating.label}
          </div>
        </div>
      </div>

      {selectedView === 'classes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-4">Population Distribution</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={populationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    >
                      {populationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-4">Wealth Distribution</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={wealthData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    >
                      {wealthData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-md font-semibold text-[var(--color-text-primary)]">Economic Classes</h4>
            
            {incomeData.economicClasses.map((cls, index) => (
              <div key={cls.name} className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: cls.color }}></div>
                    <h5 className="font-medium text-[var(--color-text-primary)]">{cls.name}</h5>
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)]">
                    ~{formatNumber(calculatePopulationInClass(cls.populationPercent), 1, false)} people
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--color-text-muted)]">Population %</label>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min="1"
                        max="80"
                        step="0.1"
                        value={cls.populationPercent}
                        onChange={(e) => handleClassPercentChange(index, parseFloat(e.target.value))}
                        className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider mr-2"
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] w-12 text-right">
                        {cls.populationPercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--color-text-muted)]">Wealth %</label>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min="0.1"
                        max="80"
                        step="0.1"
                        value={cls.wealthPercent}
                        onChange={(e) => handleWealthPercentChange(index, parseFloat(e.target.value))}
                        className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider mr-2"
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] w-12 text-right">
                        {cls.wealthPercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--color-text-muted)]">Average Income</label>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min={gdpPerCapita * 0.1}
                        max={gdpPerCapita * 5}
                        step={100}
                        value={cls.averageIncome}
                        onChange={(e) => handleIncomeChange(index, parseFloat(e.target.value))}
                        className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider mr-2"
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] w-20 text-right">
                        {formatNumber(cls.averageIncome, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedView === 'inequality' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-4">Income Distribution</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeData2}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="income" name="Average Income">
                      {incomeData2.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-4">Lorenz Curve</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <XAxis 
                      type="number" 
                      domain={[0, 100]} 
                      label={{ value: 'Cumulative % of Population', position: 'insideBottom', offset: -5 }} 
                    />
                    <YAxis 
                      type="number" 
                      domain={[0, 100]} 
                      label={{ value: 'Cumulative % of Income', angle: -90, position: 'insideLeft' }} 
                    />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Line 
                      data={equalityLine} 
                      type="linear" 
                      dataKey="y" 
                      stroke="#8884d8" 
                      name="Perfect Equality" 
                      dot={false} 
                      strokeDasharray="5 5" 
                    />
                    <Line 
                      data={lorenzCurve} 
                      type="monotone" 
                      dataKey="y" 
                      stroke="#82ca9d" 
                      name="Actual Distribution" 
                      dot={false} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="form-label flex items-center">
                    <Scale className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                    Gini Coefficient
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0.2"
                      max="0.7"
                      step="0.01"
                      value={incomeData.incomeInequalityGini}
                      onChange={(e) => handleInputChange('incomeInequalityGini', parseFloat(e.target.value))}
                      className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>0.2 (Very Equal)</span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {incomeData.incomeInequalityGini.toFixed(2)}
                      </span>
                      <span>0.7 (Very Unequal)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="form-label flex items-center">
                    <Users className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                    Poverty Rate (%)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="0.1"
                      value={incomeData.povertyRate}
                      onChange={(e) => handleInputChange('povertyRate', parseFloat(e.target.value))}
                      className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>0%</span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {incomeData.povertyRate.toFixed(1)}%
                      </span>
                      <span>50%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
                <h5 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Inequality Analysis</h5>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] mb-1">Gini Coefficient</div>
                    <div className={`text-sm font-medium ${inequalityRating.color}`}>
                      {incomeData.incomeInequalityGini.toFixed(2)} - {inequalityRating.label}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] mb-1">Poverty Rate</div>
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">
                      {incomeData.povertyRate.toFixed(1)}% (~{formatNumber(totalPopulation * (incomeData.povertyRate / 100), 1, false)} people)
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] mb-1">Top 10% Wealth Share</div>
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">
                      {incomeData.economicClasses
                        .sort((a, b) => b.averageIncome - a.averageIncome)
                        .slice(0, Math.ceil(incomeData.economicClasses.length * 0.1))
                        .reduce((sum, cls) => sum + cls.wealthPercent, 0)
                        .toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedView === 'mobility' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="form-label flex items-center">
                  <ArrowUpRight className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                  Social Mobility Index
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={incomeData.socialMobilityIndex}
                    onChange={(e) => handleInputChange('socialMobilityIndex', parseFloat(e.target.value))}
                    className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                    <span>0 (Low Mobility)</span>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {incomeData.socialMobilityIndex}
                    </span>
                    <span>100 (High Mobility)</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
                <h5 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Mobility Factors</h5>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">Education Access</span>
                    <div className="w-32 bg-[var(--color-bg-secondary)] rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${incomeData.socialMobilityIndex}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">Job Opportunities</span>
                    <div className="w-32 bg-[var(--color-bg-secondary)] rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${incomeData.socialMobilityIndex * 0.9}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">Wealth Transfer</span>
                    <div className="w-32 bg-[var(--color-bg-secondary)] rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-purple-500"
                        style={{ width: `${incomeData.socialMobilityIndex * 0.8}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">Social Programs</span>
                    <div className="w-32 bg-[var(--color-bg-secondary)] rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-orange-500"
                        style={{ width: `${incomeData.socialMobilityIndex * 0.85}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
              <h5 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Mobility Analysis</h5>
              <div className="space-y-4">
                <div className={`text-sm ${mobilityRating.color}`}>
                  <span className="font-medium">{mobilityRating.label}</span> - Social mobility index of {incomeData.socialMobilityIndex}/100
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {incomeData.socialMobilityIndex >= 80 
                    ? "Your society has excellent social mobility. Citizens can readily move between economic classes based on merit and effort."
                    : incomeData.socialMobilityIndex >= 60
                    ? "Your society has good social mobility. Most citizens have opportunities to improve their economic status."
                    : incomeData.socialMobilityIndex >= 40
                    ? "Your society has moderate social mobility. Some barriers exist between economic classes."
                    : incomeData.socialMobilityIndex >= 20
                    ? "Your society has limited social mobility. Economic class at birth strongly determines outcomes."
                    : "Your society has very low social mobility. Economic classes are nearly fixed at birth."
                  }
                </p>
                <div className="text-sm text-[var(--color-text-muted)]">
                  <span className="font-medium">Generational Change:</span> It takes approximately 
                  {incomeData.socialMobilityIndex >= 80 ? " 1-2 generations" 
                    : incomeData.socialMobilityIndex >= 60 ? " 2-3 generations"
                    : incomeData.socialMobilityIndex >= 40 ? " 3-4 generations"
                    : incomeData.socialMobilityIndex >= 20 ? " 4-5 generations"
                    : " 5+ generations"
                  } for a family to move from the bottom to the middle class.
                </div>
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
              Distribution Analysis
            </h4>
            <p className="text-xs text-[var(--color-text-muted)]">
              Your society has a Gini coefficient of {incomeData.incomeInequalityGini.toFixed(2)} ({inequalityRating.label}) 
              with {incomeData.povertyRate.toFixed(1)}% of the population living in poverty. 
              Social mobility is {mobilityRating.label.toLowerCase()}, meaning 
              {incomeData.socialMobilityIndex >= 60 
                ? " citizens have good opportunities to improve their economic status through education and work."
                : incomeData.socialMobilityIndex >= 40
                ? " citizens have moderate opportunities to improve their economic status, though some barriers exist."
                : " citizens face significant challenges in improving their economic status across generations."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
