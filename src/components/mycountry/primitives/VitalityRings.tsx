"use client";

import { Activity, DollarSign, Users, Shield, Building } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { HealthRing } from '~/components/ui/health-ring';

interface VitalityRingData {
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
}

interface VitalityRingsProps {
  data: VitalityRingData;
  variant?: 'sidebar' | 'horizontal' | 'grid';
  collapsed?: boolean;
}

const RING_CONFIG = [
  {
    key: 'economicVitality' as keyof VitalityRingData,
    label: 'Economic Health',
    subtitle: 'GDP & Growth',
    color: '#22c55e',
    icon: DollarSign,
  },
  {
    key: 'populationWellbeing' as keyof VitalityRingData,
    label: 'Population Wellbeing',
    subtitle: 'Demographics',
    color: '#3b82f6',
    icon: Users,
  },
  {
    key: 'diplomaticStanding' as keyof VitalityRingData,
    label: 'Diplomatic Standing',
    subtitle: 'International',
    color: '#a855f7',
    icon: Shield,
  },
  {
    key: 'governmentalEfficiency' as keyof VitalityRingData,
    label: 'Government Efficiency',
    subtitle: 'Administration',
    color: '#f97316',
    icon: Building,
  },
];

export function VitalityRings({ data, variant = 'sidebar', collapsed = false }: VitalityRingsProps) {
  if (collapsed && variant === 'sidebar') {
    return null; // Handle collapsed state in parent
  }

  const renderRing = (config: typeof RING_CONFIG[0], index: number) => {
    const value = data[config.key] || 0;
    
    if (variant === 'sidebar') {
      return (
        <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 hover:scale-102 transition-all duration-300 cursor-pointer group">
          <HealthRing
            value={Number(value)}
            size={48}
            color={config.color}
            className="flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <config.icon className="h-3 w-3" style={{ color: config.color }} />
              <span className="font-medium text-xs">{config.label}</span>
            </div>
            <div className="text-xs text-muted-foreground">{config.subtitle}</div>
            <div className="text-sm font-bold" style={{ color: config.color }}>
              {value.toFixed(1)}%
            </div>
          </div>
        </div>
      );
    }

    if (variant === 'horizontal') {
      return (
        <div key={index} className="flex items-center gap-4">
          <HealthRing
            value={Number(value)}
            size={80}
            color={config.color}
            className="flex-shrink-0"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <config.icon className="h-4 w-4" style={{ color: config.color }} />
              <span className="font-medium">{config.label}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {value.toFixed(1)}% performance
            </div>
          </div>
        </div>
      );
    }

    // Grid variant
    return (
      <div key={index} className="flex flex-col items-center text-center gap-3">
        <HealthRing
          value={Number(value)}
          size={80}
          color={config.color}
          className="flex-shrink-0"
        />
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <config.icon className="h-4 w-4" style={{ color: config.color }} />
            <span className="font-medium text-sm">{config.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {value.toFixed(1)}% performance
          </div>
        </div>
      </div>
    );
  };

  if (variant === 'sidebar') {
    return (
      <div className="space-y-4">
        {RING_CONFIG.map(renderRing)}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            <CardTitle>National Vitality</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">LIVE DATA</Badge>
        </div>
        <CardDescription>Real-time assessment of key national performance indicators</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={variant === 'horizontal' ? 'space-y-6' : 'grid grid-cols-2 lg:grid-cols-4 gap-6'}>
          {RING_CONFIG.map(renderRing)}
        </div>
      </CardContent>
    </Card>
  );
}