// src/app/economy/components/LaborEmployment.tsx
// Workforce analytics & charts  

import { useState, useEffect, useMemo } from "react";
import { Users, Briefcase, Clock, DollarSign, TrendingUp, BarChart3, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { EnhancedEconomicInputs, EconomicHint } from "../lib/enhanced-economic-types";

interface LaborEmploymentProps {
  inputs: EnhancedEconomicInputs;
  onInputsChange: (inputs: Partial<EnhancedEconomicInputs>) => void;
  referenceCountries: any[];
}

export function LaborEmployment({ 
  inputs, 
  onInputsChange, 
  referenceCountries 
}: LaborEmploymentProps) {
  const [hints, setHints] = useState<EconomicHint[]>([]);

  // Calculate derived labor statistics
  const workingAgePopulation = inputs.population * 0.65; // Assume 65% working age
  const laborForce = workingAgePopulation * (inputs.laborForceParticipationRate / 100);
  const employedPopulation = laborForce * (1 - inputs.unemploymentRate / 100);
  const unemployedPopulation = laborForce - employedPopulation;
  
  // Update calculated fields
  useEffect(() => {
    const newEmploymentRate = 100 - inputs.unemploymentRate;
    const newTotalWorkforce = Math.round(employedPopulation);
    
    onInputsChange({ 
      employmentRate: newEmploymentRate,
      totalWorkforce: newTotalWorkforce
    });
  }, [inputs.unemploymentRate, inputs.laborForceParticipationRate, inputs.population]);

  // Calculate productivity metrics
  const weeklyHours = inputs.averageWorkweekHours;
  const annualHours = weeklyHours * 52;
  const gdpPerHour = inputs.gdpPerCapita / annualHours;
  const productivityIndex = Math.min(100, (gdpPerHour / 50) * 100); // $50/hour = 100%

  // Generate labor market insights
  useEffect(() => {
    generateLaborHints();
  }, [inputs.unemploymentRate, inputs.laborForceParticipationRate, inputs.minimumWage, inputs.averageAnnualIncome]);

  const generateLaborHints = () => {
    const newHints: EconomicHint[] = [];

    // Unemployment analysis
    if (inputs.unemploymentRate > 15) {
      newHints.push({
        type: 'warning',
        title: 'High Unemployment Crisis',
        message: 'Unemployment above 15% indicates severe economic distress and requires immediate policy intervention.',
        relatedCountries: ['Spain (2012)', 'South Africa (current)'],
        impact: 'high'
      });
    } else if (inputs.unemploymentRate > 10) {
      newHints.push({
        type: 'warning',
        title: 'High Unemployment',
        message: 'Double-digit unemployment suggests significant labor market challenges.',
        relatedCountries: ['Greece', 'Italy'],
        impact: 'medium'
      });
    } else if (inputs.unemploymentRate < 3) {
      newHints.push({
        type: 'suggestion',
        title: 'Very Low Unemployment',
        message: 'Unemployment below 3% may indicate labor shortages and wage pressure.',
        relatedCountries: ['Japan', 'Czech Republic'],
        impact: 'medium'
      });
    }

    // Labor force participation
    if (inputs.laborForceParticipationRate > 80) {
      newHints.push({
        type: 'info',
        title: 'High Labor Participation',
        message: 'Very high labor force participation indicates strong economic opportunity.',
        relatedCountries: ['Iceland', 'Switzerland'],
        impact: 'low'
      });
    } else if (inputs.laborForceParticipationRate < 50) {
      newHints.push({
        type: 'warning',
        title: 'Low Labor Participation',
        message: 'Low participation may indicate economic barriers or social issues.',
        relatedCountries: ['Yemen', 'Algeria'],
        impact: 'high'
      });
    }

    // Wage analysis
    const wageToGdpRatio = inputs.minimumWage * annualHours / inputs.gdpPerCapita;
    if (wageToGdpRatio > 0.6) {
      newHints.push({
        type: 'warning',
        title: 'High Minimum Wage Burden',
        message: 'Minimum wage may be constraining business competitiveness.',
        relatedCountries: ['France', 'Australia'],
        impact: 'medium'
      });
    } else if (wageToGdpRatio < 0.2) {
      newHints.push({
        type: 'suggestion',
        title: 'Low Minimum Wage',
        message: 'Consider whether minimum wage provides adequate living standards.',
        relatedCountries: ['United States', 'Mexico'],
        impact: 'medium'
      });
    }

    setHints(newHints);
  };

  // Chart data for labor force breakdown
  const laborForceData = [
    { name: 'Employed', value: employedPopulation, percentage: (employedPopulation / inputs.population * 100) },
    { name: 'Unemployed', value: unemployedPopulation, percentage: (unemployedPopulation / inputs.population * 100) },
    { name: 'Not in Labor Force', value: inputs.population - laborForce, percentage: ((inputs.population - laborForce) / inputs.population * 100) }
  ];

  const laborStatsData = [
    { metric: 'Participation Rate', value: inputs.laborForceParticipationRate, max: 100, color: '#8b5cf6' },
    { metric: 'Employment Rate', value: 100 - inputs.unemploymentRate, max: 100, color: '#10b981' },
    { metric: 'Productivity Index', value: productivityIndex, max: 100, color: '#3b82f6' }
  ];

  const COLORS = ['#10b981', '#ef4444', '#6b7280'];

  const formatNumber = (num: number) => {
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
    return num.toFixed(0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold flex items-center">
            <Briefcase className="h-5 w-5 mr-2" />
            Labor & Employment
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Workforce composition, productivity, and employment metrics
          </p>
        </div>

        <div className="card-content space-y-6">
          {/* Labor Force Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Labor Force Pie Chart */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">Labor Force Composition</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={laborForceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {laborForceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        `${formatNumber(value)} (${((value / inputs.population) * 100).toFixed(1)}%)`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {laborForceData.map((item, index) => (
                  <div key={item.name} className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded mr-2" 
                      style={{ backgroundColor: COLORS[index] }}
                    ></div>
                    <span className="text-[var(--color-text-muted)]">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Labor Statistics Bar Chart */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">Key Labor Metrics</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={laborStatsData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                    <XAxis type="number" domain={[0, 100]} stroke="var(--color-text-muted)" />
                    <YAxis type="category" dataKey="metric" stroke="var(--color-text-muted)" />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Value']}
                      contentStyle={{
                        backgroundColor: 'var(--color-surface-blur)',
                        border: '1px solid var(--color-border-primary)',
                        borderRadius: '0.375rem',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                    <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Key Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <div className="flex items-center justify-between">
                <Users className="h-5 w-5 text-[var(--color-brand-primary)]" />
                <span className="text-xs text-[var(--color-text-muted)]">Total</span>
              </div>
              <div className="text-xl font-bold text-[var(--color-text-primary)] mt-2">
                {formatNumber(laborForce)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Labor Force</div>
            </div>
            
            <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <div className="flex items-center justify-between">
                <Briefcase className="h-5 w-5 text-green-500" />
                <span className="text-xs text-[var(--color-text-muted)]">Employed</span>
              </div>
              <div className="text-xl font-bold text-[var(--color-text-primary)] mt-2">
                {formatNumber(employedPopulation)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Workers</div>
            </div>

            <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <div className="flex items-center justify-between">
                <Clock className="h-5 w-5 text-blue-500" />
                <span className="text-xs text-[var(--color-text-muted)]">Weekly</span>
              </div>
              <div className="text-xl font-bold text-[var(--color-text-primary)] mt-2">
                {inputs.averageWorkweekHours}h
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Work Hours</div>
            </div>

            <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <span className="text-xs text-[var(--color-text-muted)]">Per Hour</span>
              </div>
              <div className="text-xl font-bold text-[var(--color-text-primary)] mt-2">
                {formatCurrency(gdpPerHour)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Productivity</div>
            </div>
          </div>

          {/* Input Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Labor Force Participation Rate */}
            <div className="space-y-3">
              <label className="form-label flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Labor Force Participation Rate
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="30"
                  max="90"
                  step="0.1"
                  value={inputs.laborForceParticipationRate}
                  onChange={(e) => onInputsChange({ laborForceParticipationRate: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>30%</span>
                  <span className="font-medium text-[var(--color-brand-primary)]">
                    {inputs.laborForceParticipationRate.toFixed(1)}%
                  </span>
                  <span>90%</span>
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Percentage of working-age population in the labor force
              </div>
            </div>

            {/* Unemployment Rate */}
            <div className="space-y-3">
              <label className="form-label flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                Unemployment Rate
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="0.1"
                  value={inputs.unemploymentRate}
                  onChange={(e) => onInputsChange({ unemploymentRate: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>0%</span>
                  <span className={`font-medium ${
                    inputs.unemploymentRate > 10 ? 'text-red-500' : 
                    inputs.unemploymentRate > 6 ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {inputs.unemploymentRate.toFixed(1)}%
                  </span>
                  <span>25%</span>
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Percentage of labor force actively seeking employment
              </div>
            </div>

            {/* Average Work Week Hours */}
            <div className="space-y-3">
              <label className="form-label flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Average Work Week Hours
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="20"
                  max="60"
                  step="0.5"
                  value={inputs.averageWorkweekHours}
                  onChange={(e) => onInputsChange({ averageWorkweekHours: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>20h</span>
                  <span className="font-medium text-[var(--color-brand-primary)]">
                    {inputs.averageWorkweekHours}h
                  </span>
                  <span>60h</span>
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Standard full-time work hours per week
              </div>
            </div>

            {/* Minimum Wage */}
            <div className="space-y-3">
              <label className="form-label flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                Minimum Wage (per hour)
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.25"
                  value={inputs.minimumWage}
                  onChange={(e) => onInputsChange({ minimumWage: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                  placeholder="7.25"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>Annual: {formatCurrency(inputs.minimumWage * annualHours)}</span>
                  <span>% of GDP per capita: {((inputs.minimumWage * annualHours / inputs.gdpPerCapita) * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Legal minimum hourly wage rate
              </div>
            </div>

            {/* Average Annual Income */}
            <div className="space-y-3 md:col-span-2">
              <label className="form-label flex items-center">
                <BarChart3 className="h-4 w-4 mr-2" />
                Average Annual Income
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min={inputs.minimumWage * annualHours}
                  max={inputs.gdpPerCapita * 2}
                  step="1000"
                  value={inputs.averageAnnualIncome}
                  onChange={(e) => onInputsChange({ averageAnnualIncome: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{formatCurrency(inputs.minimumWage * annualHours)}</span>
                  <span className="font-medium text-[var(--color-brand-primary)]">
                    {formatCurrency(inputs.averageAnnualIncome)}
                  </span>
                  <span>{formatCurrency(inputs.gdpPerCapita * 2)}</span>
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Mean annual income across all workers
              </div>
            </div>
          </div>

          {/* Labor Market Hints */}
          {hints.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center">
                <Briefcase className="h-4 w-4 mr-2" />
                Labor Market Analysis
              </h4>
              <div className="space-y-2">
                {hints.map((hint, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      hint.type === 'warning' ? 'border-[var(--color-warning)] bg-yellow-500/10' :
                      hint.type === 'suggestion' ? 'border-[var(--color-info)] bg-blue-500/10' :
                      'border-[var(--color-success)] bg-green-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="text-sm font-medium text-[var(--color-text-primary)]">
                          {hint.title}
                        </h5>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          {hint.message}
                        </p>
                        {hint.relatedCountries.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {hint.relatedCountries.map(country => (
                              <span 
                                key={country}
                                className="px-2 py-1 text-xs bg-[var(--color-bg-secondary)] rounded-full text-[var(--color-text-secondary)]"
                              >
                                {country}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: var(--color-brand-primary);
          cursor: pointer;
          border: 2px solid var(--color-bg-primary);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: var(--color-brand-primary);
          cursor: pointer;
          border: 2px solid var(--color-bg-primary);
        }
      `}</style>
    </div>
  );
}