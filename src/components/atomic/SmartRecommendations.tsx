"use client";

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, 
  Zap, 
  Shield, 
  AlertTriangle,
  Target,
  Plus,
  Info,
  TrendingUp,
  CheckCircle
} from 'lucide-react';
import { ComponentType } from '@prisma/client';
import { cn } from '~/lib/utils';
import { 
  AtomicRecommendationEngine,
  type SmartRecommendation,
  type CountryProfile 
} from '~/lib/atomic-recommendations';
import { ATOMIC_COMPONENT_INFO } from './AtomicComponentSelector';

interface SmartRecommendationsProps {
  selectedComponents: ComponentType[];
  countryProfile: CountryProfile;
  onComponentAdd: (component: ComponentType) => void;
  maxRecommendations?: number;
  className?: string;
}

interface RecommendationCardProps {
  recommendation: SmartRecommendation;
  onAdd: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function RecommendationCard({ 
  recommendation, 
  onAdd, 
  isExpanded, 
  onToggleExpand 
}: RecommendationCardProps) {
  const componentInfo = ATOMIC_COMPONENT_INFO[recommendation.component];
  
  const typeConfig = {
    synergy_complete: {
      icon: <Zap className="w-4 h-4" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 border-purple-200',
      label: 'Complete Synergy'
    },
    effectiveness_boost: {
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50 border-green-200',
      label: 'Effectiveness Boost'
    },
    conflict_avoid: {
      icon: <Shield className="w-4 h-4" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 border-orange-200',
      label: 'Avoid Conflict'
    },
    country_fit: {
      icon: <Target className="w-4 h-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
      label: 'Perfect Fit'
    }
  };

  const config = typeConfig[recommendation.type];
  
  const priorityColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-gray-100 text-gray-800'
  };

  return (
    <motion.div
      layout
      className={cn(
        "p-4 rounded-lg border transition-all cursor-pointer",
        config.bgColor,
        isExpanded ? "ring-2 ring-offset-1" : ""
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <div className={cn("p-1.5 rounded-full bg-white/50", config.color)}>
              {config.icon}
            </div>
            <div className="flex items-center space-x-2">
              <h4 className="font-semibold text-sm text-foreground">
                {componentInfo?.name}
              </h4>
              <span className={cn(
                "px-2 py-0.5 text-xs font-medium rounded-full",
                priorityColors[recommendation.priority]
              )}>
                {recommendation.priority}
              </span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mb-2">
            {recommendation.reason}
          </p>
          
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground">Confidence:</span>
              <span className="font-medium">
                {Math.round(recommendation.confidence * 100)}%
              </span>
            </div>
            
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground">Effectiveness:</span>
              <span className="font-medium">
                {componentInfo?.effectiveness}%
              </span>
            </div>
            
            {recommendation.impactPreview.synergiesAdded > 0 && (
              <div className="flex items-center space-x-1 text-green-600">
                <CheckCircle className="w-3 h-3" />
                <span>+{recommendation.impactPreview.synergiesAdded} synergy</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-white/50 rounded transition-colors"
            title="Show details"
          >
            <Info className="w-3 h-3 text-muted-foreground" />
          </button>
          
          <button
            onClick={onAdd}
            className={cn(
              "p-1.5 rounded-full transition-colors",
              "bg-white/70 hover:bg-white",
              config.color
            )}
            title="Add component"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/50 pt-3 mt-3 space-y-3"
          >
            {/* Impact Preview */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-muted-foreground">Impact Preview:</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>Economic:</span>
                    <span className="font-medium text-green-600">
                      +{(recommendation.impactPreview.economicImpact * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stability:</span>
                    <span className="font-medium text-blue-600">
                      +{recommendation.impactPreview.stabilityImpact.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="text-muted-foreground">Changes:</div>
                <div className="space-y-0.5">
                  {recommendation.impactPreview.synergiesAdded > 0 && (
                    <div className="flex items-center space-x-1 text-green-600">
                      <Plus className="w-2 h-2" />
                      <span>{recommendation.impactPreview.synergiesAdded} synergies</span>
                    </div>
                  )}
                  {recommendation.impactPreview.conflictsAdded > 0 && (
                    <div className="flex items-center space-x-1 text-red-600">
                      <AlertTriangle className="w-2 h-2" />
                      <span>{recommendation.impactPreview.conflictsAdded} conflicts</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Component Description */}
            <div className="text-xs">
              <div className="text-muted-foreground mb-1">About this component:</div>
              <p className="text-foreground/80">
                {componentInfo?.description}
              </p>
            </div>

            {/* Pros and Cons */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-green-600 font-medium mb-1">Advantages:</div>
                <ul className="space-y-0.5 text-muted-foreground">
                  {componentInfo?.pros.slice(0, 2).map((pro, idx) => (
                    <li key={idx} className="flex items-start space-x-1">
                      <span>•</span>
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <div className="text-red-600 font-medium mb-1">Considerations:</div>
                <ul className="space-y-0.5 text-muted-foreground">
                  {componentInfo?.cons.slice(0, 2).map((con, idx) => (
                    <li key={idx} className="flex items-start space-x-1">
                      <span>•</span>
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SmartRecommendations({
  selectedComponents,
  countryProfile,
  onComponentAdd,
  maxRecommendations = 5,
  className
}: SmartRecommendationsProps) {
  const [expandedCard, setExpandedCard] = React.useState<string | null>(null);

  const recommendations = useMemo(() => {
    return AtomicRecommendationEngine.getSmartRecommendations(
      selectedComponents,
      countryProfile,
      maxRecommendations
    );
  }, [selectedComponents, countryProfile, maxRecommendations]);

  const handleComponentAdd = (component: ComponentType) => {
    onComponentAdd(component);
    // Close expanded card after adding
    setExpandedCard(null);
  };

  const toggleExpand = (recommendationId: string) => {
    setExpandedCard(expandedCard === recommendationId ? null : recommendationId);
  };

  if (recommendations.length === 0) {
    return (
      <div className={cn("smart-recommendations", className)}>
        <div className="text-center py-8 text-muted-foreground">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted/30 rounded-full flex items-center justify-center">
            <Lightbulb className="w-8 h-8" />
          </div>
          <p className="text-sm">
            No recommendations available yet. Select some components to get AI-powered suggestions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("smart-recommendations space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center space-x-2">
        <div className="p-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg">
          <Lightbulb className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Smart Recommendations</h3>
          <p className="text-xs text-muted-foreground">
            AI-powered suggestions based on your country profile
          </p>
        </div>
      </div>

      {/* Recommendation Cards */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              onAdd={() => handleComponentAdd(recommendation.component)}
              isExpanded={expandedCard === recommendation.id}
              onToggleExpand={() => toggleExpand(recommendation.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Summary Stats */}
      <div className="p-3 bg-muted/20 rounded-lg">
        <div className="text-xs text-center space-y-1">
          <div className="font-medium text-foreground">
            {recommendations.length} recommendations available
          </div>
          <div className="text-muted-foreground">
            {recommendations.filter(r => r.priority === 'high').length} high priority • 
            {recommendations.filter(r => r.priority === 'medium').length} medium priority • 
            {recommendations.filter(r => r.priority === 'low').length} low priority
          </div>
        </div>
      </div>
    </div>
  );
}