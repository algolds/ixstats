"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Info, TrendingUp } from 'lucide-react';
import { cn } from '~/lib/utils';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../components/glass/GlassCard';
import type { PolicyAdvisorTip } from '../types/builder';

interface PolicyAdvisorProps {
  tips: PolicyAdvisorTip[];
  maxTips?: number;
  activeSection?: string;
}

export function PolicyAdvisor({ tips, maxTips = 3, activeSection }: PolicyAdvisorProps) {
  if (tips.length === 0) return null;
  
  // Get section-specific title
  const getSectionTitle = () => {
    if (!activeSection) return 'Policy Advisor';
    
    const sectionTitles: Record<string, string> = {
      'national-symbols': 'Identity Advisor',
      'core-indicators': 'Economic Advisor', 
      'labor-employment': 'Labor Advisor',
      'fiscal-system': 'Fiscal Advisor',
      'government-spending': 'Budget Advisor',
      'demographics': 'Demographics Advisor'
    };
    
    return sectionTitles[activeSection] || 'Policy Advisor';
  };

  const getTipIcon = (type: PolicyAdvisorTip['type']) => {
    switch (type) {
      case 'warning': return AlertTriangle;
      case 'suggestion': return Info;
      case 'optimization': return TrendingUp;
    }
  };

  const getTipColor = (type: PolicyAdvisorTip['type']) => {
    switch (type) {
      case 'warning': return 'border-red-400/30 bg-red-400/10 text-red-300 dark:text-red-200';
      case 'suggestion': return 'border-blue-400/30 bg-blue-400/10 text-blue-300 dark:text-blue-200';
      case 'optimization': return 'border-green-400/30 bg-green-400/10 text-green-300 dark:text-green-200';
      default: return '';
    }
  };

  return (
    <GlassCard depth="elevated" blur="medium" theme="gold">
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-300" />
          <h3 className="font-semibold text-foreground">{getSectionTitle()}</h3>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-3">
          {tips.slice(0, maxTips).map((tip) => {
            const Icon = getTipIcon(tip.type);
            return (
              <motion.div
                key={tip.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'p-3 rounded-lg border',
                  getTipColor(tip.type)
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-sm mb-1">{tip.title}</h4>
                    <p className="text-xs opacity-90 mb-2">{tip.description}</p>
                    <p className="text-xs opacity-75">{tip.impact}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}