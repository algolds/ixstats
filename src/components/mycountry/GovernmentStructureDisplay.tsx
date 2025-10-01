"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { 
  Building2, 
  Crown, 
  Users, 
  DollarSign, 
  Edit2, 
  Plus, 
  AlertTriangle,
  Settings,
  TrendingUp,
  Zap,
  Shield
} from 'lucide-react';
import { api } from "~/trpc/react";
import { useUser } from "@clerk/nextjs";
import Link from 'next/link';
import { createUrl } from '~/lib/url-utils';
import { useAtomicGovernment, useAtomicState } from '~/components/atomic/AtomicStateProvider';

interface GovernmentStructureDisplayProps {
  countryId: string;
  variant?: 'compact' | 'full';
}

export function GovernmentStructureDisplay({ 
  countryId, 
  variant = 'full' 
}: GovernmentStructureDisplayProps) {
  const { user } = useUser();
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id }
  );

  // Try to use atomic state if available
  let atomicState = null;
  let atomicGovernment = null;
  try {
    atomicState = useAtomicState();
    atomicGovernment = useAtomicGovernment();
  } catch {
    // Not in atomic context, fallback to traditional approach
  }

  // Use EXACT same pattern as other working queries
  const { data: governmentData, isLoading, refetch } = api.government.getByCountryId.useQuery(
    { countryId: countryId || '' },
    { enabled: !!countryId }
  );

  const isOwner = userProfile?.countryId === countryId;

  if (!countryId) {
    return (
      <Card className="border-2 border-dashed border-muted">
        <CardContent className="p-8 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h4 className="text-lg font-semibold mb-2">No Country ID</h4>
          <p className="text-muted-foreground">
            Cannot load government structure without a valid country ID.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-48" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if we have atomic state available
  if (atomicState && atomicGovernment && atomicState.state.selectedComponents.length > 0) {
    // Use atomic-driven government structure
    const { traditionalStructure, realTimeMetrics, effectivenessScore } = atomicGovernment;
    const { selectedComponents } = atomicState.state;

    return (
      <div className="space-y-6">
        {/* Atomic Government Overview */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-purple/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {traditionalStructure.governmentType}
                    <Badge variant="default" className="text-xs bg-primary/10 text-primary border-primary/20">
                      Atomic-Driven
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Powered by {selectedComponents.length} Atomic Components
                  </p>
                </div>
              </div>
              {isOwner && (
                <div className="flex items-center gap-2">
                  <Link href={createUrl("/mycountry/editor?tab=atomic")}>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Edit Components
                    </Button>
                  </Link>
                  <Link href={createUrl("/mycountry/editor?tab=structure")}>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Edit2 className="h-4 w-4" />
                      Legacy Editor
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Real-time Atomic Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary">{effectivenessScore.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">Effectiveness</div>
              </div>
              
              <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-center mb-2">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {realTimeMetrics.governmentCapacity.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Gov Capacity</div>
              </div>
              
              <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-700">
                  {realTimeMetrics.policyImplementationSpeed.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Policy Speed</div>
              </div>
              
              <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-center mb-2">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-purple-700">
                  {realTimeMetrics.crisisResiliency.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Crisis Resiliency</div>
              </div>
            </div>

            {/* Active Atomic Components */}
            <div className="mb-6">
              <h4 className="font-semibold mb-3">Active Atomic Components</h4>
              <div className="flex flex-wrap gap-2">
                {selectedComponents.map((component) => (
                  <Badge key={component} variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                    {component.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Generated Structure */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Executive Structure</h4>
                <div className="space-y-2 text-sm">
                  {traditionalStructure.executiveStructure.map((position, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>{position}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Key Departments</h4>
                <div className="space-y-2 text-sm">
                  {traditionalStructure.departments.slice(0, 5).map((dept, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{dept.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          +{dept.effectivenessBonus}% effectiveness
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          P{dept.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Budget Distribution (Atomic-Generated) */}
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Atomic Budget Allocation</h4>
              <div className="space-y-2">
                {Object.entries(traditionalStructure.budgetAllocations).map(([category, percentage]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="capitalize text-sm">{category.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-muted h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium min-w-[3rem]">{percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback to traditional government structure if no atomic data
  if (!governmentData) {
    return (
      <Card className="border-2 border-dashed border-muted">
        <CardContent className="p-8 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h4 className="text-lg font-semibold mb-2">No Government Structure</h4>
          <p className="text-muted-foreground mb-4">
            {isOwner 
              ? "Create your nation's government using atomic components or traditional structure." 
              : "This country has not configured its government structure yet."
            }
          </p>
          {isOwner && (
            <div className="flex items-center justify-center gap-3">
              <Link href={createUrl("/builder")}>
                <Button className="flex items-center gap-2 bg-primary">
                  <Zap className="h-4 w-4" />
                  Build with Atomic Components
                </Button>
              </Link>
              <Link href={createUrl("/mycountry/editor?tab=structure")}>
                <Button variant="outline" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Traditional Builder
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const getDepartmentStats = () => {
    const totalDepartments = governmentData.departments?.length || 0;
    const totalBudgetAllocated = governmentData.budgetAllocations?.reduce(
      (sum, a) => sum + (a.allocatedAmount || 0), 0
    ) || 0;
    const totalRevenueProjected = governmentData.revenueSources?.reduce(
      (sum, r) => sum + (r.revenueAmount || 0), 0
    ) || 0;
    
    return {
      totalDepartments,
      totalBudgetAllocated,
      totalRevenueProjected,
      budgetUtilization: governmentData.totalBudget > 0 
        ? (totalBudgetAllocated / governmentData.totalBudget) * 100 
        : 0
    };
  };

  const stats = getDepartmentStats();

  return (
    <div className="space-y-6">
      {/* Government Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-amber-500" />
              <div>
                <CardTitle className="flex items-center gap-2">
                  {governmentData.governmentName}
                  <Badge variant="outline" className="text-xs">
                    {governmentData.governmentType}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Government Structure & Budget Overview
                </p>
              </div>
            </div>
            {isOwner && (
              <Link href={createUrl("/mycountry/editor?tab=structure")}>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Edit2 className="h-4 w-4" />
                  Edit Structure
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold">{stats.totalDepartments}</div>
              <div className="text-xs text-muted-foreground">Departments</div>
            </div>
            
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('en-US', { 
                  notation: 'compact', 
                  maximumFractionDigits: 1 
                }).format(stats.totalBudgetAllocated)}
              </div>
              <div className="text-xs text-muted-foreground">Budget Allocated</div>
            </div>
            
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold">
                {governmentData.revenueSources?.length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Revenue Sources</div>
            </div>
            
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <div className={`h-5 w-5 rounded ${
                  stats.totalRevenueProjected >= stats.totalBudgetAllocated 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-red-100 text-red-600'
                } flex items-center justify-center text-xs`}>
                  {stats.totalRevenueProjected >= stats.totalBudgetAllocated ? '↑' : '↓'}
                </div>
              </div>
              <div className={`text-2xl font-bold ${
                stats.totalRevenueProjected >= stats.totalBudgetAllocated 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {stats.totalRevenueProjected >= stats.totalBudgetAllocated ? 'Surplus' : 'Deficit'}
              </div>
              <div className="text-xs text-muted-foreground">Fiscal Status</div>
            </div>
          </div>

          {/* Government Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Government Structure</h4>
              <div className="space-y-2 text-sm">
                {governmentData.headOfState && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Head of State:</span>
                    <span>{governmentData.headOfState}</span>
                  </div>
                )}
                {governmentData.headOfGovernment && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Head of Government:</span>
                    <span>{governmentData.headOfGovernment}</span>
                  </div>
                )}
                {governmentData.legislatureName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Legislature:</span>
                    <span>{governmentData.legislatureName}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Budget Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Budget:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: governmentData.budgetCurrency,
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                      notation: 'compact'
                    }).format(governmentData.totalBudget)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Allocation:</span>
                  <span className={`font-medium ${
                    stats.budgetUtilization > 100 ? 'text-red-600' :
                    stats.budgetUtilization > 90 ? 'text-orange-600' :
                    'text-green-600'
                  }`}>
                    {stats.budgetUtilization.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fiscal Year:</span>
                  <span>{governmentData.fiscalYear}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Departments */}
          {governmentData.departments && governmentData.departments.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Top Departments</h4>
              <div className="space-y-2">
                {governmentData.departments.slice(0, variant === 'compact' ? 3 : 5).map((dept, index) => {
                  const allocation = governmentData.budgetAllocations?.find(
                    a => a.departmentId === index.toString()
                  );
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: dept.color }}
                        />
                        <div>
                          <div className="font-medium text-sm">{dept.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {dept.category}
                            {dept.minister && ` • ${dept.ministerTitle}: ${dept.minister}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">
                          {allocation ? `${allocation.allocatedPercent.toFixed(1)}%` : '0%'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {allocation 
                            ? new Intl.NumberFormat('en-US', { 
                                notation: 'compact', 
                                maximumFractionDigits: 1 
                              }).format(allocation.allocatedAmount)
                            : '0'
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {governmentData.departments.length > (variant === 'compact' ? 3 : 5) && (
                  <div className="text-center py-2 text-xs text-muted-foreground">
                    +{governmentData.departments.length - (variant === 'compact' ? 3 : 5)} more departments
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Budget Warnings */}
          {stats.budgetUtilization > 100 && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium text-destructive">Budget Overallocation</div>
                  <div className="text-muted-foreground">
                    Departments are allocated {stats.budgetUtilization.toFixed(1)}% of total budget. 
                    Consider reducing allocations or increasing the total budget.
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}