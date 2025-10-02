"use client";
import { BentoGridItem } from "@/components/ui/bento-grid";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { StrategicPlanningModal } from "@/components/modals/StrategicPlanningModal";
import { AdvancedAnalyticsModal } from "@/components/modals/AdvancedAnalyticsModal";
import { AIAdvisorModal } from "@/components/modals/AIAdvisorModal";
import { PredictiveModelsModal } from "@/components/modals/PredictiveModelsModal";

interface UserProfile {
  id: string;
  role: string;
  countryId?: string;
}

interface MyCountryPremiumProps {
  profile?: UserProfile;
  userId?: string;
}

export function MyCountryPremium({ profile, userId }: MyCountryPremiumProps) {
  const isPremiumUser = profile?.role === 'admin' || profile?.role === 'dm';
  const [openModal, setOpenModal] = useState<null | 'upgrade' | 'premium' | 'planning' | 'analytics' | 'ai' | 'predictive'>(null);
  const [planForm, setPlanForm] = useState({
    title: '',
    description: '',
    objectives: [''],
    timeframe: 'medium_term' as const,
    priority: 'medium' as const,
    targetMetrics: [{ metric: '', currentValue: '', targetValue: '', deadline: '' }]
  });

  // Get country data for the StrategicPlanningModal
  const { data: countryData } = api.countries.getByIdWithEconomicData.useQuery(
    { id: profile?.countryId || '' },
    { enabled: !!profile?.countryId }
  );

  // API hooks
  const { data: strategicPlans, refetch: refetchPlans } = api.eci.getStrategicPlans.useQuery(
    { userId: userId || 'disabled' },
    { enabled: !!userId && !!profile?.countryId }
  );
  const { data: advancedAnalytics } = api.eci.getAdvancedAnalytics.useQuery(
    { userId: userId || 'disabled' },
    { enabled: !!userId && !!profile?.countryId }
  );
  const { data: aiRecommendations } = api.eci.getAIRecommendations.useQuery(
    { userId: userId || 'disabled' },
    { enabled: !!userId && !!profile?.countryId }
  );
  const { data: predictiveModels } = api.eci.getPredictiveModels.useQuery(
    {
      userId: userId || 'disabled',
      timeframe: '1_year',
      scenarios: ['realistic', 'optimistic', 'pessimistic']
    },
    { enabled: !!userId && !!profile?.countryId }
  );
  
  const createPlanMutation = api.eci.createStrategicPlan.useMutation({
    onSuccess: () => {
      toast.success('Strategic plan created successfully');
      refetchPlans();
      setOpenModal(null);
      setPlanForm({
        title: '',
        description: '',
        objectives: [''],
        timeframe: 'medium_term',
        priority: 'medium',
        targetMetrics: [{ metric: '', currentValue: '', targetValue: '', deadline: '' }]
      });
    },
    onError: (error) => {
      toast.error('Failed to create plan: ' + error.message);
    }
  });

  // Helper functions for plan form
  const addObjective = () => {
    setPlanForm(prev => ({ ...prev, objectives: [...prev.objectives, ''] }));
  };

  const removeObjective = (index: number) => {
    setPlanForm(prev => ({ ...prev, objectives: prev.objectives.filter((_, i) => i !== index) }));
  };

  const updateObjective = (index: number, value: string) => {
    setPlanForm(prev => ({
      ...prev,
      objectives: prev.objectives.map((item, i) => i === index ? value : item)
    }));
  };

  const addMetric = () => {
    setPlanForm(prev => ({ 
      ...prev, 
      targetMetrics: [...prev.targetMetrics, { metric: '', currentValue: '', targetValue: '', deadline: '' }] 
    }));
  };

  const removeMetric = (index: number) => {
    setPlanForm(prev => ({ 
      ...prev, 
      targetMetrics: prev.targetMetrics.filter((_, i) => i !== index) 
    }));
  };

  const updateMetric = (index: number, field: string, value: string) => {
    setPlanForm(prev => ({
      ...prev,
      targetMetrics: prev.targetMetrics.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleSubmitPlan = () => {
    if (!planForm.title || !planForm.description) {
      toast.error('Please fill in required fields (title and description)');
      return;
    }

    const targetMetrics = planForm.targetMetrics
      .filter(metric => metric.metric && metric.currentValue && metric.targetValue && metric.deadline)
      .map(metric => ({
        metric: metric.metric,
        currentValue: parseFloat(metric.currentValue),
        targetValue: parseFloat(metric.targetValue),
        deadline: new Date(metric.deadline)
      }));

    if (!userId) {
      toast.error('User not authenticated');
      return;
    }

    createPlanMutation.mutate({
      userId,
      title: planForm.title,
      description: planForm.description,
      objectives: planForm.objectives.filter(obj => obj.trim() !== ''),
      timeframe: planForm.timeframe,
      priority: planForm.priority,
      targetMetrics: targetMetrics.length > 0 ? targetMetrics : undefined
    });
  };

  return (
    <>
      <BentoGridItem 
        className="md:col-span-3 bg-gradient-to-br from-purple-500/10 to-pink-600/10 border-purple-500/20"
        title="MyCountry® Premium Suite"
        description={
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <Card className="bg-purple-900/20 border-purple-700/30 cursor-pointer" onClick={() => setOpenModal('planning')}>
                <CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-purple-300 mb-1">🎯</div>
                  <div className="text-xs text-purple-400">Strategic Planning</div>
                </CardContent>
              </Card>
              <Card className="bg-purple-900/20 border-purple-700/30 cursor-pointer" onClick={() => setOpenModal('analytics')}>
                <CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-pink-300 mb-1">📊</div>
                  <div className="text-xs text-pink-400">Advanced Analytics</div>
                </CardContent>
              </Card>
              <Card className="bg-purple-900/20 border-purple-700/30 cursor-pointer" onClick={() => setOpenModal('ai')}>
                <CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-blue-300 mb-1">🤖</div>
                  <div className="text-xs text-blue-400">AI Advisor</div>
                </CardContent>
              </Card>
              <Card className="bg-purple-900/20 border-purple-700/30 cursor-pointer" onClick={() => setOpenModal('predictive')}>
                <CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-green-300 mb-1">📈</div>
                  <div className="text-xs text-green-400">Predictive Models</div>
                </CardContent>
              </Card>
            </div>
            <div className="mt-4 flex justify-center">
              {isPremiumUser ? (
                <Button className="bg-purple-600 text-white hover:bg-purple-700" onClick={() => setOpenModal('premium')}>
                  Access Premium Tools
                </Button>
              ) : (
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600" onClick={() => setOpenModal('upgrade')}>
                  Upgrade to Premium
                </Button>
              )}
            </div>
          </>
        }
        header={
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-xl">
              ⭐
            </div>
            <Badge className={`${isPremiumUser ? 'bg-gold-500/20 text-gold-300' : 'bg-purple-900/20'} border-purple-500/30`}>
              {isPremiumUser ? 'PREMIUM ACTIVE' : 'UPGRADE AVAILABLE'}
            </Badge>
          </div>
        }
      />
      {/* Modals for each feature */}
      <Dialog open={openModal === 'upgrade'} onOpenChange={v => setOpenModal(v ? 'upgrade' : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to Premium</DialogTitle>
            <DialogDescription>Unlock advanced analytics, AI advisor, strategic planning tools, and predictive economic models.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">⭐</div>
              <h3 className="text-xl font-bold text-white mb-2">MyCountry® Premium</h3>
              <p className="text-white/70 mb-6">Transform your nation management with premium tools</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                <h4 className="font-semibold text-purple-300 mb-2">🎯 Strategic Planning</h4>
                <p className="text-sm text-purple-400">Create comprehensive long-term plans with target metrics and timeline tracking.</p>
              </div>
              <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
                <h4 className="font-semibold text-blue-300 mb-2">📊 Advanced Analytics</h4>
                <p className="text-sm text-blue-400">Deep-dive analysis with volatility metrics, trend detection, and correlation studies.</p>
              </div>
              <div className="p-4 bg-cyan-900/20 rounded-lg border border-cyan-500/30">
                <h4 className="font-semibold text-cyan-300 mb-2">🤖 AI Economic Advisor</h4>
                <p className="text-sm text-cyan-400">Personalized recommendations based on your nation's unique economic profile.</p>
              </div>
              <div className="p-4 bg-green-900/20 rounded-lg border border-green-500/30">
                <h4 className="font-semibold text-green-300 mb-2">📈 Predictive Models</h4>
                <p className="text-sm text-green-400">Multi-scenario economic forecasting with confidence intervals and risk assessment.</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 p-4 rounded-lg border border-purple-500/20">
              <h4 className="font-semibold text-white mb-2">Premium Benefits</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• Priority access to new features</li>
                <li>• Advanced economic modeling tools</li>
                <li>• Detailed risk and volatility analysis</li>
                <li>• AI-powered strategic recommendations</li>
                <li>• Export and sharing capabilities</li>
              </ul>
            </div>
          </div>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'premium'} onOpenChange={v => setOpenModal(v ? 'premium' : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Premium Tools</DialogTitle>
            <DialogDescription>Welcome to your premium dashboard - access advanced tools and analytics.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button 
                onClick={() => setOpenModal('planning')}
                className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30 hover:bg-purple-900/30 transition-colors text-center"
              >
                <div className="text-2xl mb-2">🎯</div>
                <div className="text-sm font-medium text-purple-300">Strategic Planning</div>
              </button>
              <button 
                onClick={() => setOpenModal('analytics')}
                className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30 hover:bg-blue-900/30 transition-colors text-center"
              >
                <div className="text-2xl mb-2">📊</div>
                <div className="text-sm font-medium text-blue-300">Advanced Analytics</div>
              </button>
              <button 
                onClick={() => setOpenModal('ai')}
                className="p-4 bg-cyan-900/20 rounded-lg border border-cyan-500/30 hover:bg-cyan-900/30 transition-colors text-center"
              >
                <div className="text-2xl mb-2">🤖</div>
                <div className="text-sm font-medium text-cyan-300">AI Advisor</div>
              </button>
              <button 
                onClick={() => setOpenModal('predictive')}
                className="p-4 bg-green-900/20 rounded-lg border border-green-500/30 hover:bg-green-900/30 transition-colors text-center"
              >
                <div className="text-2xl mb-2">📈</div>
                <div className="text-sm font-medium text-green-300">Predictive Models</div>
              </button>
            </div>
            
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 p-4 rounded-lg border">
              <h4 className="font-semibold text-white mb-3">Quick Stats</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-purple-400">{strategicPlans?.length || 0}</div>
                  <div className="text-xs text-white/60">Active Plans</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-400">{advancedAnalytics?.dataPoints || 0}</div>
                  <div className="text-xs text-white/60">Data Points</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-400">{aiRecommendations?.length || 0}</div>
                  <div className="text-xs text-white/60">AI Insights</div>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-white/60">
                Your premium subscription gives you access to advanced economic modeling, 
                strategic planning tools, and AI-powered insights.
              </p>
            </div>
          </div>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <StrategicPlanningModal
        isOpen={openModal === 'planning'}
        onClose={() => setOpenModal(null)}
        countryId={profile?.countryId || ''}
        countryName={countryData?.name || ''}
      />
      <AdvancedAnalyticsModal
        isOpen={openModal === 'analytics'}
        onClose={() => setOpenModal(null)}
        countryId={profile?.countryId || ''}
        countryName={countryData?.name || ''}
      />
      <AIAdvisorModal
        isOpen={openModal === 'ai'}
        onClose={() => setOpenModal(null)}
        countryId={profile?.countryId || ''}
        countryName={countryData?.name || ''}
      />
      <PredictiveModelsModal
        isOpen={openModal === 'predictive'}
        onClose={() => setOpenModal(null)}
        countryId={profile?.countryId || ''}
        countryName={countryData?.name || ''}
      />
    </>
  );
}