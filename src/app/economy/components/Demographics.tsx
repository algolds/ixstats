// src/app/economy/components/Demographics.tsx
"use client";

import { useState } from "react";
import {
  Users,
  MapPin,
  GraduationCap,
  Heart,
  Baby,
  UserCheck,
  Building2,
  Home,
  Info,
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

interface AgeGroup {
  group: string;
  percent: number;
  color: string;
}

interface Region {
  name: string;
  population: number;
  urbanPercent: number;
  color: string;
}

interface EducationLevel {
  level: string;
  percent: number;
  color: string;
}

interface CitizenshipStatus {
  status: string;
  percent: number;
  color: string;
}

interface DemographicData {
  ageDistribution: AgeGroup[];
  lifeExpectancy: number;
  urbanRuralSplit: { urban: number; rural: number };
  regions: Region[];
  educationLevels: EducationLevel[];
  literacyRate: number;
  citizenshipStatuses: CitizenshipStatus[];
}

interface DemographicsProps {
  demographicData: DemographicData;
  totalPopulation: number;
  onDemographicDataChange: (demographicData: DemographicData) => void;
}

export function Demographics({
  demographicData,
  totalPopulation,
  onDemographicDataChange,
}: DemographicsProps) {
  const [selectedView, setSelectedView] = useState<'age' | 'geographic' | 'social'>('age');

  const handleAgeDistributionChange = (index: number, value: number) => {
    const newAgeGroups = [...demographicData.ageDistribution];
    
    // Calculate the total of all other percentages
    const totalOthers = newAgeGroups.reduce((sum, group, idx) => 
      idx !== index ? sum + group.percent : sum, 0);
    
    // Adjust the new value to ensure total is 100%
    const adjustedValue = Math.min(value, 100 - totalOthers);
    
    if (newAgeGroups[index]) {
      newAgeGroups[index] = {
        ...newAgeGroups[index],
        percent: adjustedValue
      };
      
      // Normalize other values to ensure total is 100%
      const remainingPercent = 100 - adjustedValue;
      const normalizedGroups = newAgeGroups.map((group, idx) => {
        if (idx === index) return group;
        
        const normalizedPercent = (group.percent / totalOthers) * remainingPercent;
        return {
          ...group,
          percent: normalizedPercent
        };
      });
      
      onDemographicDataChange({
        ...demographicData,
        ageDistribution: normalizedGroups
      });
    }
  };

  const handleUrbanRuralSplitChange = (urbanPercent: number) => {
    onDemographicDataChange({
      ...demographicData,
      urbanRuralSplit: {
        urban: urbanPercent,
        rural: 100 - urbanPercent
      }
    });
  };

  const handleRegionPopulationChange = (index: number, value: number) => {
    const newRegions = [...demographicData.regions];
    
    // Calculate the total of all other populations
    const totalOthers = newRegions.reduce((sum, region, idx) => 
      idx !== index ? sum + region.population : sum, 0);
    
    // Adjust the new value to ensure total is totalPopulation
    const adjustedValue = Math.min(value, totalPopulation - totalOthers);
    
    if (newRegions[index]) {
      newRegions[index] = {
        ...newRegions[index],
        population: adjustedValue
      };
      
      // Normalize other values to ensure total is totalPopulation
      const remainingPopulation = totalPopulation - adjustedValue;
      const normalizedRegions = newRegions.map((region, idx) => {
        if (idx === index) return region;
        
        const normalizedPopulation = (region.population / totalOthers) * remainingPopulation;
        return {
          ...region,
          population: normalizedPopulation
        };
      });
      
      onDemographicDataChange({
        ...demographicData,
        regions: normalizedRegions
      });
    }
  };

  const handleRegionUrbanPercentChange = (index: number, value: number) => {
    const newRegions = [...demographicData.regions];
    
    if (newRegions[index]) {
      newRegions[index] = {
        ...newRegions[index],
        urbanPercent: value
      };
      
      onDemographicDataChange({
        ...demographicData,
        regions: newRegions
      });
    }
  };

  const handleEducationLevelChange = (index: number, value: number) => {
    const newLevels = [...demographicData.educationLevels];
    
    // Calculate the total of all other percentages
    const totalOthers = newLevels.reduce((sum, level, idx) => 
      idx !== index ? sum + level.percent : sum, 0);
    
    // Adjust the new value to ensure total is 100%
    const adjustedValue = Math.min(value, 100 - totalOthers);
    
    if (newLevels[index]) {
      newLevels[index] = {
        ...newLevels[index],
        percent: adjustedValue
      };
      
      // Normalize other values to ensure total is 100%
      const remainingPercent = 100 - adjustedValue;
      const normalizedLevels = newLevels.map((level, idx) => {
        if (idx === index) return level;
        
        const normalizedPercent = (level.percent / totalOthers) * remainingPercent;
        return {
          ...level,
          percent: normalizedPercent
        };
      });
      
      onDemographicDataChange({
        ...demographicData,
        educationLevels: normalizedLevels
      });
    }
  };

  const handleCitizenshipStatusChange = (index: number, value: number) => {
    const newStatuses = [...demographicData.citizenshipStatuses];
    
    // Calculate the total of all other percentages
    const totalOthers = newStatuses.reduce((sum, status, idx) => 
      idx !== index ? sum + status.percent : sum, 0);
    
    // Adjust the new value to ensure total is 100%
    const adjustedValue = Math.min(value, 100 - totalOthers);
    
    if (newStatuses[index]) {
      newStatuses[index] = {
        ...newStatuses[index],
        percent: adjustedValue
      };
      
      // Normalize other values to ensure total is 100%
      const remainingPercent = 100 - adjustedValue;
      const normalizedStatuses = newStatuses.map((status, idx) => {
        if (idx === index) return status;
        
        const normalizedPercent = (status.percent / totalOthers) * remainingPercent;
        return {
          ...status,
          percent: normalizedPercent
        };
      });
      
     // src/app/economy/components/Demographics.tsx (continued)
     onDemographicDataChange({
        ...demographicData,
        citizenshipStatuses: normalizedStatuses
      });
    }
  };

  const handleInputChange = (field: keyof DemographicData, value: number) => {
    if (typeof value !== 'number') return;
    
    onDemographicDataChange({
      ...demographicData,
      [field]: value
    });
  };

  const formatNumber = (num: number, precision = 0): string => {
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(precision)}K`;
    return num.toFixed(precision);
  };

  const calculatePopulationInGroup = (percent: number): number => {
    return Math.round(totalPopulation * (percent / 100));
  };

  // Data for age distribution pie chart
  const ageData = demographicData.ageDistribution.map(group => ({
    name: group.group,
    value: group.percent,
    color: group.color,
    population: calculatePopulationInGroup(group.percent)
  }));

  // Data for urban/rural pie chart
  const urbanRuralData = [
    { name: 'Urban', value: demographicData.urbanRuralSplit.urban, color: '#4C51BF' },
    { name: 'Rural', value: demographicData.urbanRuralSplit.rural, color: '#68D391' }
  ];

  // Data for regions bar chart
  const regionData = demographicData.regions.map(region => ({
    name: region.name,
    population: region.population,
    urbanPercent: region.urbanPercent,
    color: region.color
  }));

  // Data for education levels pie chart
  const educationData = demographicData.educationLevels.map(level => ({
    name: level.level,
    value: level.percent,
    color: level.color
  }));

  // Data for citizenship statuses pie chart
  const citizenshipData = demographicData.citizenshipStatuses.map(status => ({
    name: status.status,
    value: status.percent,
    color: status.color
  }));

  // Population pyramid data
  const generatePopulationPyramid = () => {
    // Simplified age groups for pyramid
    const ageGroups = [
      { age: '0-9', male: 5, female: 5 },
      { age: '10-19', male: 6, female: 6 },
      { age: '20-29', male: 8, female: 8 },
      { age: '30-39', male: 7, female: 7 },
      { age: '40-49', male: 6, female: 6 },
      { age: '50-59', male: 5, female: 5 },
      { age: '60-69', male: 4, female: 4 },
      { age: '70-79', male: 2, female: 3 },
      { age: '80+', male: 1, female: 2 }
    ];
    
    // Adjust based on youth/elderly percentages
    const youthPercent = demographicData.ageDistribution.find(g => g.group === '0-15')?.percent || 20;
    const elderlyPercent = demographicData.ageDistribution.find(g => g.group === '65+')?.percent || 15;
    
    // Adjust younger and older age groups
    const youthFactor = youthPercent / 20; // Normalize against 20%
    const elderlyFactor = elderlyPercent / 15; // Normalize against 15%
    
    if (ageGroups[0] && ageGroups[1]) {
      ageGroups[0].male *= youthFactor;
      ageGroups[0].female *= youthFactor;
      ageGroups[1].male *= youthFactor;
      ageGroups[1].female *= youthFactor;
    }
    if (ageGroups[7] && ageGroups[8]) {
      ageGroups[7].male *= elderlyFactor;
      ageGroups[7].female *= elderlyFactor;
      ageGroups[8].male *= elderlyFactor;
      ageGroups[8].female *= elderlyFactor;
    }
    return ageGroups;
  };

  const populationPyramidData = generatePopulationPyramid();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
          <Users className="h-5 w-5 mr-2 text-[var(--color-brand-primary)]" />
          Demographics
        </h3>
        <div className="flex bg-[var(--color-bg-tertiary)] rounded-lg p-1">
          {['age', 'geographic', 'social'].map((view) => (
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

      {/* Demographics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {formatNumber(totalPopulation, 1)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Total Population</div>
        </div>

        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <Heart className="h-6 w-6 text-red-600" />
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {demographicData.lifeExpectancy.toFixed(1)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Life Expectancy (years)</div>
        </div>

        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <GraduationCap className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {demographicData.literacyRate.toFixed(1)}%
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Literacy Rate</div>
        </div>
      </div>

      {selectedView === 'age' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-4">Age Distribution</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ageData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    >
                      {ageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div>
              <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-4">Population Pyramid</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={populationPyramidData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis type="number" />
                    <YAxis dataKey="age" type="category" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="male" name="Male" fill="#3182CE" />
                    <Bar dataKey="female" name="Female" fill="#D53F8C" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {demographicData.ageDistribution.map((group, index) => (
                  <div key={group.group} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-[var(--color-text-primary)] flex items-center">
                        <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: group.color }}></div>
                        {group.group} Age Group
                      </label>
                      <div className="text-sm text-[var(--color-text-muted)]">
                        ~{formatNumber(calculatePopulationInGroup(group.percent), 1)}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="0.1"
                        value={group.percent}
                        onChange={(e) => handleAgeDistributionChange(index, parseFloat(e.target.value))}
                        className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider mr-2"
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] w-12 text-right">
                        {group.percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="form-label flex items-center">
                    <Heart className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                    Life Expectancy (years)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="50"
                      max="95"
                      step="0.1"
                      value={demographicData.lifeExpectancy}
                      onChange={(e) => handleInputChange('lifeExpectancy', parseFloat(e.target.value))}
                      className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>50 years</span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {demographicData.lifeExpectancy.toFixed(1)} years
                      </span>
                      <span>95 years</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
                  <h5 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Dependency Ratios</h5>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Youth Dependency</div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">
                        {(demographicData.ageDistribution.find(g => g.group === '0-15')?.percent || 0).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Elderly Dependency</div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">
                        {(demographicData.ageDistribution.find(g => g.group === '65+')?.percent || 0).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Total Dependency Ratio</div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">
                        {((demographicData.ageDistribution.find(g => g.group === '0-15')?.percent || 0) + 
                          (demographicData.ageDistribution.find(g => g.group === '65+')?.percent || 0)).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedView === 'geographic' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-4">Urban/Rural Split</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={urbanRuralData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    >
                      {urbanRuralData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div>
              <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-4">Regional Population</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatNumber(value as number, 1)} />
                    <Bar dataKey="population" name="Population">
                      {regionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label flex items-center">
                <Building2 className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                Urban Population (%)
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={demographicData.urbanRuralSplit.urban}
                  onChange={(e) => handleUrbanRuralSplitChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>0% (Fully Rural)</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {demographicData.urbanRuralSplit.urban.toFixed(1)}% Urban
                  </span>
                  <span>100% (Fully Urban)</span>
                </div>
              </div>
            </div>

            <h4 className="text-md font-semibold text-[var(--color-text-primary)] mt-6">Regions</h4>
            
            {demographicData.regions.map((region, index) => (
              <div key={region.name} className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: region.color }}></div>
                    <h5 className="font-medium text-[var(--color-text-primary)]">{region.name}</h5>
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)]">
                    {formatNumber(region.population, 1)} people
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--color-text-muted)]">Population</label>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min={totalPopulation * 0.01}
                        max={totalPopulation * 0.8}
                        step={totalPopulation * 0.01}
                        value={region.population}
                        onChange={(e) => handleRegionPopulationChange(index, parseFloat(e.target.value))}
                        className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider mr-2"
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] w-20 text-right">
                        {formatNumber(region.population, 1)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--color-text-muted)]">Urban %</label>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={region.urbanPercent}
                        onChange={(e) => handleRegionUrbanPercentChange(index, parseFloat(e.target.value))}
                        className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider mr-2"
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] w-12 text-right">
                        {region.urbanPercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedView === 'social' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-4">Education Levels</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={educationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    >
                      {educationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div>
              <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-4">Citizenship Status</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={citizenshipData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    >
                      {citizenshipData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="form-label flex items-center">
                    <GraduationCap className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                    Literacy Rate (%)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="0.1"
                      value={demographicData.literacyRate}
                      onChange={(e) => handleInputChange('literacyRate', parseFloat(e.target.value))}
                      className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>50%</span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {demographicData.literacyRate.toFixed(1)}%
                      </span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                <h5 className="text-md font-semibold text-[var(--color-text-primary)]">Education Levels</h5>
                {demographicData.educationLevels.map((level, index) => (
                  <div key={level.level} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-[var(--color-text-primary)] flex items-center">
                        <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: level.color }}></div>
                        {level.level}
                      </label>
                      <div className="text-sm text-[var(--color-text-muted)]">
                        ~{formatNumber(calculatePopulationInGroup(level.percent), 1)}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min="0"
                        max="60"
                        step="0.1"
                        value={level.percent}
                        onChange={(e) => handleEducationLevelChange(index, parseFloat(e.target.value))}
                        className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider mr-2"
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] w-12 text-right">
                        {level.percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h5 className="text-md font-semibold text-[var(--color-text-primary)]">Citizenship Status</h5>
                {demographicData.citizenshipStatuses.map((status, index) => (
                  <div key={status.status} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-[var(--color-text-primary)] flex items-center">
                        <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: status.color }}></div>
                        {status.status}
                      </label>
                      <div className="text-sm text-[var(--color-text-muted)]">
                        ~{formatNumber(calculatePopulationInGroup(status.percent), 1)}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={status.percent}
                        onChange={(e) => handleCitizenshipStatusChange(index, parseFloat(e.target.value))}
                        className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider mr-2"
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] w-12 text-right">
                        {status.percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
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
              Demographic Analysis
            </h4>
            <p className="text-xs text-[var(--color-text-muted)]">
              Your nation has a population of {formatNumber(totalPopulation, 1)} with a life expectancy of {demographicData.lifeExpectancy.toFixed(1)} years. 
              {demographicData.urbanRuralSplit.urban > 70 
                ? " It is highly urbanized"
                : demographicData.urbanRuralSplit.urban > 50
                ? " It has a moderate urban majority"
                : " It has a predominantly rural population"
              }, with {demographicData.urbanRuralSplit.urban.toFixed(1)}% of people living in urban areas. 
              The literacy rate is {demographicData.literacyRate.toFixed(1)}%, and 
              {demographicData.educationLevels.find(l => l.level === "Higher Education")?.percent || 0 > 25
                ? " a significant portion of the population has higher education."
                : " a smaller portion of the population has access to higher education."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
