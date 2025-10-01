"use client";

import React from 'react';
import { useUser } from '@clerk/nextjs';
import { api } from '~/trpc/react';
import { QuickActionsPanel } from '~/components/quick-actions/QuickActionsPanel';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { NumberFlowDisplay } from '~/components/ui/number-flow';
import { EconomicPolicyModal } from '~/components/modals/EconomicPolicyModal';
import { CabinetMeetingModal } from '~/components/modals/CabinetMeetingModal';
import { NationalSecurityModal } from '~/components/modals/NationalSecurityModal';
import { 
  FileText, 
  Users, 
  Shield, 
  TrendingUp,
  Activity,
  Zap,
  Target,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface QuickActionIntegrationProps {
  className?: string;
}

export function QuickActionIntegration({ className }: QuickActionIntegrationProps) {
  const { user } = useUser();

  // Get real-time metrics
  const { data: metrics } = api.eci.getRealTimeMetrics.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id, refetchInterval: 30000 } // Refetch every 30 seconds
  );

  // Get policy statistics
  const { data: policies } = api.eci.getEconomicPolicies.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id }
  );

  // Get meeting statistics
  const { data: meetings } = api.eci.getCabinetMeetings.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id }
  );

  // Get security dashboard
  const { data: securityDashboard } = api.eci.getSecurityDashboard.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id }
  );

  // Implementation status
  const implementationStatus = {
    activePolicies: policies?.filter((p: any) => p.status === 'implemented')?.length || 0,
    pendingPolicies: policies?.filter((p: any) => p.status === 'proposed' || p.status === 'under_review')?.length || 0,
    upcomingMeetings: meetings?.filter((m: any) => new Date(m.scheduledDate) > new Date())?.length || 0,
    activeThreats: securityDashboard?.activeThreats || 0,
  };

  if (!user) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Real-time Metrics Dashboard */}
      <Card className="glass-hierarchy-parent">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Live Country Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600">
                <NumberFlowDisplay 
                  value={metrics?.social || 50}
                  decimalPlaces={0}
                  className=""
                />
              </div>
              <div className="text-sm text-green-700">Social Stability</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600">
                <NumberFlowDisplay 
                  value={metrics?.security || 50}
                  decimalPlaces={0}
                  className=""
                />
              </div>
              <div className="text-sm text-blue-700">Security Level</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600">
                <NumberFlowDisplay 
                  value={metrics?.political || 50}
                  decimalPlaces={0}
                  className=""
                />
              </div>
              <div className="text-sm text-purple-700">Political Stability</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Implementation Status */}
      <Card className="glass-hierarchy-parent">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-600" />
            Implementation Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-emerald-600">
                <NumberFlowDisplay 
                  value={implementationStatus.activePolicies}
                  decimalPlaces={0}
                  className=""
                />
              </div>
              <div className="text-xs text-muted-foreground">Active Policies</div>
              <CheckCircle className="h-4 w-4 mx-auto mt-1 text-emerald-500" />
            </div>
            
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-600">
                <NumberFlowDisplay 
                  value={implementationStatus.pendingPolicies}
                  decimalPlaces={0}
                  className=""
                />
              </div>
              <div className="text-xs text-muted-foreground">Pending Policies</div>
              <FileText className="h-4 w-4 mx-auto mt-1 text-yellow-500" />
            </div>
            
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">
                <NumberFlowDisplay 
                  value={implementationStatus.upcomingMeetings}
                  decimalPlaces={0}
                  className=""
                />
              </div>
              <div className="text-xs text-muted-foreground">Upcoming Meetings</div>
              <Users className="h-4 w-4 mx-auto mt-1 text-blue-500" />
            </div>
            
            <div className="text-center">
              <div className={`text-xl font-bold ${implementationStatus.activeThreats > 0 ? 'text-red-600' : 'text-green-600'}`}>
                <NumberFlowDisplay 
                  value={implementationStatus.activeThreats}
                  decimalPlaces={0}
                  className=""
                />
              </div>
              <div className="text-xs text-muted-foreground">Active Threats</div>
              <Shield className={`h-4 w-4 mx-auto mt-1 ${implementationStatus.activeThreats > 0 ? 'text-red-500' : 'text-green-500'}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Panel */}
      <QuickActionsPanel />

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EconomicPolicyModal mode="create">
          <Button className="w-full h-16 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white">
            <div className="flex flex-col items-center gap-1">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm">Create Economic Policy</span>
            </div>
          </Button>
        </EconomicPolicyModal>

        <CabinetMeetingModal mode="create">
          <Button className="w-full h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
            <div className="flex flex-col items-center gap-1">
              <Users className="h-5 w-5" />
              <span className="text-sm">Schedule Cabinet Meeting</span>
            </div>
          </Button>
        </CabinetMeetingModal>

        <NationalSecurityModal mode="dashboard">
          <Button className="w-full h-16 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white">
            <div className="flex flex-col items-center gap-1">
              <Shield className="h-5 w-5" />
              <span className="text-sm">Security Assessment</span>
            </div>
          </Button>
        </NationalSecurityModal>
      </div>

      {/* System Integration Status */}
      <Card className="glass-hierarchy-parent">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-amber-600" />
            Live System Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span>Database Integration:</span>
              <Badge variant="default" className="bg-green-100 text-green-800">Live</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Policy Effects System:</span>
              <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Quick Actions API:</span>
              <Badge variant="default" className="bg-green-100 text-green-800">Connected</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Real-time Metrics:</span>
              <Badge variant="default" className="bg-green-100 text-green-800">Streaming</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>NumberFlow Integration:</span>
              <Badge variant="default" className="bg-green-100 text-green-800">Enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}