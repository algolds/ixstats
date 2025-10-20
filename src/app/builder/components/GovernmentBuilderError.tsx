"use client";

import React from 'react';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { 
  AlertTriangle, 
  Building2, 
  ArrowRight, 
  Settings,
  Users,
  DollarSign,
  Info
} from 'lucide-react';
import type { GovernmentValidationResult } from '../utils/governmentValidation';
import { createAbsoluteUrl } from '~/lib/url-utils';

interface GovernmentBuilderErrorProps {
  validation: GovernmentValidationResult;
  onNavigateToBuilder?: () => void;
  className?: string;
  showDetailedSteps?: boolean;
}

export function GovernmentBuilderError({
  validation,
  onNavigateToBuilder,
  className = "",
  showDetailedSteps = true
}: GovernmentBuilderErrorProps) {
  const handleNavigateToBuilder = () => {
    if (onNavigateToBuilder) {
      onNavigateToBuilder();
    } else {
      // Default navigation to government builder
      window.location.href = createAbsoluteUrl('/builder?section=government');
    }
  };

  const getStatusIcon = () => {
    if (!validation.hasGovernmentBuilder) return <Building2 className="h-5 w-5" />;
    if (!validation.hasDepartments) return <Users className="h-5 w-5" />;
    if (!validation.hasBudgetAllocations) return <DollarSign className="h-5 w-5" />;
    return <Settings className="h-5 w-5" />;
  };

  const getStatusColor = () => {
    if (!validation.hasGovernmentBuilder) return "text-red-600";
    if (!validation.hasDepartments) return "text-orange-600";
    if (!validation.hasBudgetAllocations) return "text-yellow-600";
    return "text-blue-600";
  };

  const getStepStatus = (step: 'structure' | 'departments' | 'budget') => {
    switch (step) {
      case 'structure':
        return validation.hasGovernmentBuilder;
      case 'departments':
        return validation.hasDepartments;
      case 'budget':
        return validation.hasBudgetAllocations;
      default:
        return false;
    }
  };

  return (
    <Card className={`border-l-4 border-l-red-500 ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <AlertTriangle className={`h-6 w-6 ${getStatusColor()}`} />
          <span className={getStatusColor()}>
            {validation.errorMessage || "Government Builder Required"}
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main warning message */}
        <Alert className="border-yellow-200 bg-yellow-50">
          <Info className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            {validation.warningMessage || 
              "You must configure your government structure using the Government Builder before setting spending priorities."}
          </AlertDescription>
        </Alert>

        {/* Detailed steps if requested */}
        {showDetailedSteps && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              Complete these steps in the Government Builder:
            </h4>
            
            <div className="space-y-2">
              {/* Step 1: Government Structure */}
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                getStepStatus('structure') 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  getStepStatus('structure') 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {getStepStatus('structure') ? '✓' : '1'}
                </div>
                <Building2 className={`h-4 w-4 ${
                  getStepStatus('structure') ? 'text-green-600' : 'text-gray-400'
                }`} />
                <span className={`text-sm ${
                  getStepStatus('structure') ? 'text-green-800' : 'text-gray-600'
                }`}>
                  Define Government Structure
                </span>
                {getStepStatus('structure') && (
                  <span className="text-xs text-green-600 font-medium ml-auto">Complete</span>
                )}
              </div>

              {/* Step 2: Departments */}
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                getStepStatus('departments') 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  getStepStatus('departments') 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {getStepStatus('departments') ? '✓' : '2'}
                </div>
                <Users className={`h-4 w-4 ${
                  getStepStatus('departments') ? 'text-green-600' : 'text-gray-400'
                }`} />
                <span className={`text-sm ${
                  getStepStatus('departments') ? 'text-green-800' : 'text-gray-600'
                }`}>
                  Add Government Departments
                </span>
                {getStepStatus('departments') && (
                  <span className="text-xs text-green-600 font-medium ml-auto">Complete</span>
                )}
              </div>

              {/* Step 3: Budget Allocations */}
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                getStepStatus('budget') 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  getStepStatus('budget') 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {getStepStatus('budget') ? '✓' : '3'}
                </div>
                <DollarSign className={`h-4 w-4 ${
                  getStepStatus('budget') ? 'text-green-600' : 'text-gray-400'
                }`} />
                <span className={`text-sm ${
                  getStepStatus('budget') ? 'text-green-800' : 'text-gray-600'
                }`}>
                  Configure Budget Allocations
                </span>
                {getStepStatus('budget') && (
                  <span className="text-xs text-green-600 font-medium ml-auto">Complete</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action button */}
        <div className="pt-2">
          <Button 
            onClick={handleNavigateToBuilder}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <Building2 className="h-4 w-4 mr-2" />
            Open Government Builder
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Additional info */}
        <div className="text-xs text-muted-foreground text-center">
          Once you complete the Government Builder setup, you'll be able to configure detailed spending priorities here.
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for inline use
 */
export function GovernmentBuilderErrorInline({
  validation,
  onNavigateToBuilder,
  className = ""
}: Omit<GovernmentBuilderErrorProps, 'showDetailedSteps'>) {
  return (
    <GovernmentBuilderError
      validation={validation}
      onNavigateToBuilder={onNavigateToBuilder}
      className={className}
      showDetailedSteps={false}
    />
  );
}
