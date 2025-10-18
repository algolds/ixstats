"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Progress } from '~/components/ui/progress';
import { Button } from '~/components/ui/button';
import { 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Target,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Users,
  DollarSign,
  BarChart3,
  PieChart,
  Clock,
  Shield,
  Zap,
  ArrowUpDown,
  Lightbulb,
  AlertCircle,
  Crown,
  Scale,
  Gavel
} from 'lucide-react';

import type { 
  BidirectionalGovernmentSyncState, 
  GovernmentRecommendation, 
  EconomicImpactOfGovernment 
} from '../../services/BidirectionalGovernmentSyncService';
import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import { ATOMIC_COMPONENTS } from '~/components/government/atoms/AtomicGovernmentComponents';

interface BidirectionalGovernmentSyncDisplayProps {
  syncState?: BidirectionalGovernmentSyncState;
  onSync?: () => void;
  className?: string;
}

const DEFAULT_SYNC_STATE: BidirectionalGovernmentSyncState = {
  economyBuilder: null,
  governmentBuilder: null,
  governmentRecommendations: [],
  economicImpacts: [],
  isSyncing: false,
  lastSync: 0,
  syncHistory: [],
  errors: []
};

export function BidirectionalGovernmentSyncDisplay({
  syncState = DEFAULT_SYNC_STATE,
  onSync = () => {},
  className = ""
}: BidirectionalGovernmentSyncDisplayProps) {
  const {
    governmentRecommendations,
    economicImpacts,
    isSyncing,
    lastSync,
    syncHistory,
    errors
  } = syncState || DEFAULT_SYNC_STATE;

  const getPriorityColor = (priority: 'critical' | 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'critical': return 'text-red-600 dark:text-red-400';
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-green-600 dark:text-green-400';
    }
  };

  const getPriorityBadgeVariant = (priority: 'critical' | 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'critical': return 'destructive' as const;
      case 'high': return 'destructive' as const;
      case 'medium': return 'secondary' as const;
      case 'low': return 'default' as const;
    }
  };

  const getImpactIcon = (impact: number) => {
    if (impact > 0) return TrendingUp;
    if (impact < 0) return TrendingDown;
    return Target;
  };

  const getImpactColor = (impact: number) => {
    if (impact > 0) return 'text-green-600 dark:text-green-400';
    if (impact < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getTimeToEffectColor = (timeToEffect: string) => {
    switch (timeToEffect) {
      case 'immediate': return 'text-red-600 dark:text-red-400';
      case 'short_term': return 'text-orange-600 dark:text-orange-400';
      case 'medium_term': return 'text-yellow-600 dark:text-yellow-400';
      case 'long_term': return 'text-green-600 dark:text-green-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatTimeToEffect = (timeToEffect: string) => {
    switch (timeToEffect) {
      case 'immediate': return 'Immediate';
      case 'short_term': return '1-3 months';
      case 'medium_term': return '3-12 months';
      case 'long_term': return '1+ years';
      default: return 'Unknown';
    }
  };

  const getComponentIcon = (componentType: ComponentType) => {
    switch (componentType) {
      case ComponentType.CENTRALIZED_POWER:
      case ComponentType.FEDERAL_SYSTEM:
      case ComponentType.UNITARY_SYSTEM:
        return Crown;
      case ComponentType.DEMOCRATIC_PROCESS:
      case ComponentType.AUTOCRATIC_PROCESS:
      case ComponentType.TECHNOCRATIC_PROCESS:
        return Users;
      case ComponentType.PROFESSIONAL_BUREAUCRACY:
      case ComponentType.MILITARY_ADMINISTRATION:
        return Building2;
      case ComponentType.INDEPENDENT_JUDICIARY:
      case ComponentType.RULE_OF_LAW:
        return Scale;
      case ComponentType.DIGITAL_GOVERNMENT:
      case ComponentType.E_GOVERNANCE:
        return Zap;
      default:
        return Building2;
    }
  };

  const getRecommendationIcon = (recommendation: 'add' | 'remove' | 'enhance' | 'reduce') => {
    switch (recommendation) {
      case 'add': return CheckCircle;
      case 'remove': return AlertTriangle;
      case 'enhance': return TrendingUp;
      case 'reduce': return TrendingDown;
      default: return Info;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Sync Controls */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                <ArrowUpDown className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">Bidirectional Government Sync</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Real-time synchronization between economy and government systems
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  Last sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {syncHistory.length} sync events
                </div>
              </div>
              
              <Button 
                onClick={onSync} 
                disabled={isSyncing}
                variant="outline"
                size="sm"
              >
                {isSyncing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <span>Sync Errors</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errors.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Government Recommendations */}
      {governmentRecommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>Government Recommendations ({governmentRecommendations.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {governmentRecommendations.map((recommendation) => {
                const ComponentIcon = getComponentIcon(recommendation.componentType);
                const RecommendationIcon = getRecommendationIcon(recommendation.recommendation);
                const componentData = ATOMIC_COMPONENTS[recommendation.componentType];
                
                return (
                  <motion.div
                    key={recommendation.componentType}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <ComponentIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium text-blue-900 dark:text-blue-100">
                          {componentData?.name || recommendation.componentType}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getPriorityBadgeVariant(recommendation.priority)}>
                          {recommendation.priority} priority
                        </Badge>
                        <Badge variant="outline">
                          <RecommendationIcon className="h-3 w-3 mr-1" />
                          {recommendation.recommendation}
                        </Badge>
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTimeToEffect(recommendation.timeToImplement)}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                      {recommendation.rationale}
                    </p>

                    {/* Economic Impact Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <BarChart3 className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">GDP Impact</span>
                        </div>
                        <div className={`text-sm font-medium ${getImpactColor(recommendation.economicImpact.gdpImpact)}`}>
                          {recommendation.economicImpact.gdpImpact > 0 ? '+' : ''}{recommendation.economicImpact.gdpImpact.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Users className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Employment</span>
                        </div>
                        <div className={`text-sm font-medium ${getImpactColor(recommendation.economicImpact.employmentImpact)}`}>
                          {recommendation.economicImpact.employmentImpact > 0 ? '+' : ''}{recommendation.economicImpact.employmentImpact.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Investment</span>
                        </div>
                        <div className={`text-sm font-medium ${getImpactColor(recommendation.economicImpact.investmentImpact)}`}>
                          {recommendation.economicImpact.investmentImpact > 0 ? '+' : ''}{recommendation.economicImpact.investmentImpact.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Shield className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Stability</span>
                        </div>
                        <div className={`text-sm font-medium ${getImpactColor(recommendation.economicImpact.stabilityImpact)}`}>
                          {recommendation.economicImpact.stabilityImpact > 0 ? '+' : ''}{recommendation.economicImpact.stabilityImpact.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Cost Information */}
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex items-center space-x-4">
                        <span>
                          Implementation: {recommendation.implementationCost > 0 ? '+' : ''}₡{Math.abs(recommendation.implementationCost).toLocaleString()}
                        </span>
                        <span>
                          Maintenance: {recommendation.maintenanceCost > 0 ? '+' : ''}₡{Math.abs(recommendation.maintenanceCost).toLocaleString()}/mo
                        </span>
                      </div>
                      <span className="font-medium">
                        {recommendation.currentStatus === 'present' ? 'Currently Active' : 'Not Implemented'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Economic Impacts */}
      {economicImpacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <span>Economic Impacts ({economicImpacts.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {economicImpacts.map((impact, index) => {
                const ComponentIcon = getComponentIcon(impact.governmentChange.componentType);
                const componentData = ATOMIC_COMPONENTS[impact.governmentChange.componentType];
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <ComponentIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        <span className="font-medium text-orange-900 dark:text-orange-100">
                          {componentData?.name || impact.governmentChange.componentType}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {impact.governmentChange.effectivenessChange}% effectiveness
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={getTimeToEffectColor(impact.timeToEffect)}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTimeToEffect(impact.timeToEffect)}
                        </Badge>
                        <Badge variant="outline">
                          {impact.confidence}% confidence
                        </Badge>
                      </div>
                    </div>

                    {/* Economic Impact Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-3">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <BarChart3 className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">GDP Growth</span>
                        </div>
                        <div className={`text-sm font-medium ${getImpactColor(impact.economicImpact.gdpGrowthImpact)}`}>
                          {impact.economicImpact.gdpGrowthImpact > 0 ? '+' : ''}{impact.economicImpact.gdpGrowthImpact.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Users className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Employment</span>
                        </div>
                        <div className={`text-sm font-medium ${getImpactColor(impact.economicImpact.employmentImpact)}`}>
                          {impact.economicImpact.employmentImpact > 0 ? '+' : ''}{impact.economicImpact.employmentImpact.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Investment</span>
                        </div>
                        <div className={`text-sm font-medium ${getImpactColor(impact.economicImpact.investmentImpact)}`}>
                          {impact.economicImpact.investmentImpact > 0 ? '+' : ''}{impact.economicImpact.investmentImpact.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <TrendingUp className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Trade</span>
                        </div>
                        <div className={`text-sm font-medium ${getImpactColor(impact.economicImpact.tradeImpact)}`}>
                          {impact.economicImpact.tradeImpact > 0 ? '+' : ''}{impact.economicImpact.tradeImpact.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Lightbulb className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Innovation</span>
                        </div>
                        <div className={`text-sm font-medium ${getImpactColor(impact.economicImpact.innovationImpact)}`}>
                          {impact.economicImpact.innovationImpact > 0 ? '+' : ''}{impact.economicImpact.innovationImpact.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Shield className="h-3 w-3" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Stability</span>
                        </div>
                        <div className={`text-sm font-medium ${getImpactColor(impact.economicImpact.stabilityImpact)}`}>
                          {impact.economicImpact.stabilityImpact > 0 ? '+' : ''}{impact.economicImpact.stabilityImpact.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Sector Impacts */}
                    {Object.keys(impact.sectorImpacts).length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Sector Impacts:</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.entries(impact.sectorImpacts).map(([sector, sectorImpact]) => (
                            <div key={sector} className="flex items-center justify-between text-xs">
                              <span className="capitalize">{sector.replace('_', ' ')}</span>
                              <span className={`font-medium ${getImpactColor(sectorImpact)}`}>
                                {sectorImpact > 0 ? '+' : ''}{sectorImpact.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <span>Sync Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {governmentRecommendations.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Government Recommendations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {economicImpacts.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Economic Impacts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {syncHistory.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Sync Events</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
