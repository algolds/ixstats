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

  // API hooks
  const { data: strategicPlans, refetch: refetchPlans } = api.eci.getStrategicPlans.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const { data: advancedAnalytics } = api.eci.getAdvancedAnalytics.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const { data: aiRecommendations } = api.eci.getAIRecommendations.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const { data: predictiveModels } = api.eci.getPredictiveModels.useQuery(
    {
      userId: userId || '',
      timeframe: '1_year',
      scenarios: ['realistic', 'optimistic', 'pessimistic']
    },
    { enabled: !!userId }
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
            <DialogDescription>Unlock advanced analytics, AI advisor, and more. (Feature coming soon!)</DialogDescription>
          </DialogHeader>
          <div className="py-4">[Upgrade form, pricing, benefits, etc.]</div>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'premium'} onOpenChange={v => setOpenModal(v ? 'premium' : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Premium Tools</DialogTitle>
            <DialogDescription>Access all premium features. (Feature coming soon!)</DialogDescription>
          </DialogHeader>
          <div className="py-4">[Premium dashboard, quick links, etc.]</div>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'planning'} onOpenChange={v => setOpenModal(v ? 'planning' : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Strategic Planning Suite</DialogTitle>
            <DialogDescription>Create and manage long-term strategic plans for your nation</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Existing plans */}
            {strategicPlans && strategicPlans.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white/90 mb-2">Current Strategic Plans</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {strategicPlans.slice(0, 3).map((plan: any) => (
                    <div key={plan.id} className="p-2 bg-emerald-900/20 rounded border border-emerald-700/30">
                      <div className="text-sm font-medium text-emerald-300">{plan.title}</div>
                      <div className="text-xs text-emerald-400 flex gap-2">
                        <span className="capitalize">{plan.timeframe.replace('_', ' ')}</span>
                        <span>•</span>
                        <span className="capitalize">{plan.priority} Priority</span>
                        <span>•</span>
                        <span className="capitalize">{plan.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* New plan form */}
            <div>
              <h4 className="text-sm font-semibold text-white/90 mb-3">Create New Strategic Plan</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plan-title" className="text-xs text-white/70">Plan Title *</Label>
                  <Input
                    id="plan-title"
                    value={planForm.title}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Economic Diversification Initiative"
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="plan-timeframe" className="text-xs text-white/70">Timeframe</Label>
                    <Select value={planForm.timeframe} onValueChange={(value: any) => setPlanForm(prev => ({ ...prev, timeframe: value }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short_term">Short Term (1-2 years)</SelectItem>
                        <SelectItem value="medium_term">Medium Term (3-5 years)</SelectItem>
                        <SelectItem value="long_term">Long Term (5+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="plan-priority" className="text-xs text-white/70">Priority</Label>
                    <Select value={planForm.priority} onValueChange={(value: any) => setPlanForm(prev => ({ ...prev, priority: value }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <Label htmlFor="plan-description" className="text-xs text-white/70">Description *</Label>
                <Textarea
                  id="plan-description"
                  value={planForm.description}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed plan description, rationale, and expected outcomes..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs text-white/70">Strategic Objectives</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addObjective}>
                    Add Objective
                  </Button>
                </div>
                {planForm.objectives.map((objective, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      value={objective}
                      onChange={(e) => updateObjective(index, e.target.value)}
                      placeholder={`Objective ${index + 1}`}
                      className="flex-1"
                    />
                    {planForm.objectives.length > 1 && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeObjective(index)}>
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs text-white/70">Target Metrics (Optional)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addMetric}>
                    Add Metric
                  </Button>
                </div>
                {planForm.targetMetrics.map((metric, index) => (
                  <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                    <Input
                      value={metric.metric}
                      onChange={(e) => updateMetric(index, 'metric', e.target.value)}
                      placeholder="Metric name"
                      className="col-span-2"
                    />
                    <Input
                      type="number"
                      value={metric.currentValue}
                      onChange={(e) => updateMetric(index, 'currentValue', e.target.value)}
                      placeholder="Current"
                    />
                    <Input
                      type="number"
                      value={metric.targetValue}
                      onChange={(e) => updateMetric(index, 'targetValue', e.target.value)}
                      placeholder="Target"
                    />
                    <Input
                      type="date"
                      value={metric.deadline}
                      onChange={(e) => updateMetric(index, 'deadline', e.target.value)}
                    />
                    {planForm.targetMetrics.length > 1 && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeMetric(index)} className="col-span-1">
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-6">
                <Button 
                  onClick={handleSubmitPlan} 
                  disabled={createPlanMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {createPlanMutation.isPending ? 'Creating...' : 'Create Plan'}
                </Button>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'analytics'} onOpenChange={v => setOpenModal(v ? 'analytics' : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Advanced Analytics</DialogTitle>
            <DialogDescription>Deep-dive analytics and trend analysis for your nation</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {advancedAnalytics ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-900/20 rounded border border-blue-700/30">
                    <h4 className="text-sm font-semibold text-blue-300 mb-2">Economic Volatility</h4>
                    <div className="text-lg font-bold text-white">{advancedAnalytics.volatility?.overall?.toFixed(2) || 'N/A'}</div>
                    <div className="text-xs text-blue-400">GDP Volatility: {advancedAnalytics.volatility?.gdp?.toFixed(2) || 'N/A'}</div>
                  </div>
                  <div className="p-4 bg-green-900/20 rounded border border-green-700/30">
                    <h4 className="text-sm font-semibold text-green-300 mb-2">Trend Analysis</h4>
                    <div className="text-lg font-bold text-white capitalize">{advancedAnalytics.trends?.overall || 'Stable'}</div>
                    <div className="text-xs text-green-400">GDP: {advancedAnalytics.trends?.gdp || 'Stable'}</div>
                  </div>
                </div>
                <div className="p-4 bg-purple-900/20 rounded border border-purple-700/30">
                  <h4 className="text-sm font-semibold text-purple-300 mb-2">Correlation Analysis</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>GDP-Population: <span className="font-semibold">{advancedAnalytics.correlations?.gdpPopulation?.toFixed(2) || 'N/A'}</span></div>
                    <div>Growth-Stability: <span className="font-semibold">{advancedAnalytics.correlations?.gdpGrowthStability?.toFixed(2) || 'N/A'}</span></div>
                    <div>Overall Health: <span className="font-semibold">{advancedAnalytics.correlations?.overallHealth?.toFixed(2) || 'N/A'}</span></div>
                  </div>
                </div>
                <div className="text-xs text-white/60">
                  Data points analyzed: {advancedAnalytics.dataPoints || 0} | Last updated: {new Date(advancedAnalytics.lastUpdated).toLocaleString()}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-white/60">Loading analytics data...</div>
            )}
          </div>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'ai'} onOpenChange={v => setOpenModal(v ? 'ai' : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Economic Advisor</DialogTitle>
            <DialogDescription>AI-powered recommendations based on your nation's data</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {aiRecommendations ? (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white/90">Current Recommendations</h4>
                {aiRecommendations.map((rec: any, index: number) => (
                  <div key={rec.id || index} className="p-4 bg-cyan-900/20 rounded border border-cyan-700/30">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="text-sm font-semibold text-cyan-300">{rec.title}</h5>
                      <Badge className={`text-xs ${
                        rec.priority === 'high' ? 'bg-red-900/30 text-red-300' :
                        rec.priority === 'medium' ? 'bg-yellow-900/30 text-yellow-300' :
                        'bg-green-900/30 text-green-300'
                      }`}>
                        {rec.priority} priority
                      </Badge>
                    </div>
                    <p className="text-xs text-cyan-400 mb-2">{rec.description}</p>
                    <div className="text-xs text-cyan-500">
                      <span className="font-semibold">Category:</span> {rec.category} • 
                      <span className="font-semibold"> Impact:</span> {rec.impact}
                    </div>
                  </div>
                ))}
                {aiRecommendations.length === 0 && (
                  <div className="text-center py-8 text-white/60">
                    No specific recommendations at this time. Your nation appears to be performing well!
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-white/60">Analyzing your nation's data...</div>
            )}
          </div>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'predictive'} onOpenChange={v => setOpenModal(v ? 'predictive' : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Predictive Economic Models</DialogTitle>
            <DialogDescription>Economic forecasts and scenario analysis for your nation</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {predictiveModels ? (
              <>
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-white/90">1-Year Economic Projections</h4>
                  <div className="text-xs text-white/60">
                    Methodology: {predictiveModels.methodology}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {predictiveModels.scenarios?.map((scenario: any, index: number) => (
                    <div key={index} className="p-4 bg-indigo-900/20 rounded border border-indigo-700/30">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="text-sm font-semibold text-indigo-300 capitalize">{scenario.scenario}</h5>
                        <Badge className="text-xs bg-indigo-900/30 text-indigo-300">
                          {scenario.confidence}% confidence
                        </Badge>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-indigo-400">GDP:</span>
                          <span className="font-semibold text-white ml-1">
                            ${(scenario.projectedGdp / 1e12).toFixed(2)}T
                          </span>
                        </div>
                        <div>
                          <span className="text-indigo-400">Population:</span>
                          <span className="font-semibold text-white ml-1">
                            {(scenario.projectedPopulation / 1e6).toFixed(1)}M
                          </span>
                        </div>
                        <div>
                          <span className="text-indigo-400">GDP per Capita:</span>
                          <span className="font-semibold text-white ml-1">
                            ${Math.round(scenario.projectedGdpPerCapita).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-white/60">
                  Last updated: {new Date(predictiveModels.lastUpdated).toLocaleString()}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-white/60">Generating predictive models...</div>
            )}
          </div>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}