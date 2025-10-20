"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '~/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { cn } from '~/lib/utils';
import {
  Building2,
  Globe,
  Send,
  Users,
  Calendar,
  TrendingUp,
  TrendingDown,
  Star,
  Zap,
  Shield,
  Target,
  Award,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  ExternalLink,
  Heart,
  FileText,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  MapPin,
  Briefcase,
  Sparkles,
  Filter
} from 'lucide-react';
import { LoadingState } from '~/components/shared';

interface DiplomaticOperationsHubProps {
  countryId: string;
  countryName: string;
}

type TabType = 'embassy-network' | 'missions' | 'cultural-exchanges' | 'treaties';
type MissionFilter = 'all' | 'active' | 'completed' | 'available';
type ExchangeFilter = 'all' | 'planning' | 'active' | 'completed';

// Embassy Card Component
interface EmbassyCardProps {
  embassy: any;
  isExpanded: boolean;
  onToggle: () => void;
  onUpgrade: () => void;
  onStartMission: () => void;
  onAllocateBudget: () => void;
}

function EmbassyCard({ embassy, isExpanded, onToggle, onUpgrade, onStartMission, onAllocateBudget }: EmbassyCardProps) {
  const statusColors = {
    active: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
    strengthening: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    neutral: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
    suspended: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
    closed: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
  };

  const influenceColor = embassy.strength >= 75 ? 'text-green-600' : embassy.strength >= 50 ? 'text-blue-600' : embassy.strength >= 25 ? 'text-yellow-600' : 'text-red-600';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-surface glass-refraction rounded-lg overflow-hidden"
    >
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-lg">{embassy.country}</h3>
              <Badge className={cn('text-xs', statusColors[embassy.status as keyof typeof statusColors] || statusColors.neutral)}>
                {embassy.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Influence</p>
                <div className="flex items-center gap-2">
                  <p className={cn('text-xl font-bold', influenceColor)}>{embassy.strength}%</p>
                  <Progress value={embassy.strength} className="h-2 flex-1" />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Level</p>
                <p className="text-xl font-bold text-purple-600">
                  {embassy.level || 1}
                </p>
              </div>
            </div>

            {embassy.role && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="capitalize">{embassy.role}</span>
                {embassy.location && <span>• {embassy.location}</span>}
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border/50"
          >
            <div className="p-4 space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">Staff</span>
                  </div>
                  <p className="text-lg font-bold">{embassy.staffCount || 10}/{embassy.maxStaff || 15}</p>
                </div>

                <div className="p-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-muted-foreground">Budget</span>
                  </div>
                  <p className="text-lg font-bold">${((embassy.budget || 50000) / 1000).toFixed(0)}k</p>
                </div>

                <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                    <span className="text-xs text-muted-foreground">Missions</span>
                  </div>
                  <p className="text-lg font-bold">{embassy.currentMissions || 0}/{embassy.maxMissions || 2}</p>
                </div>

                <div className="p-3 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-amber-600" />
                    <span className="text-xs text-muted-foreground">Security</span>
                  </div>
                  <p className="text-sm font-semibold capitalize">{embassy.securityLevel || 'Standard'}</p>
                </div>
              </div>

              {/* Ambassador Info */}
              {embassy.ambassadorName && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Ambassador</p>
                  <p className="font-semibold">{embassy.ambassadorName}</p>
                </div>
              )}

              {/* Services */}
              {embassy.services && embassy.services.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Services Offered</p>
                  <div className="flex flex-wrap gap-2">
                    {embassy.services.map((service: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Specialization */}
              {embassy.specialization && (
                <div className="p-3 rounded-lg border border-purple-200 dark:border-purple-800/40 bg-purple-50/50 dark:bg-purple-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Specialization</span>
                  </div>
                  <p className="text-sm font-semibold capitalize">{embassy.specialization}</p>
                  {embassy.specializationLevel && (
                    <Progress value={(embassy.specializationLevel / 3) * 100} className="h-1 mt-2" />
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
                <Button
                  onClick={(e) => { e.stopPropagation(); onStartMission(); }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={(embassy.currentMissions || 0) >= (embassy.maxMissions || 2)}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Start Mission
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Upgrade
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); onAllocateBudget(); }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Allocate Budget
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Mission Card Component
interface MissionCardProps {
  mission: any;
  onComplete?: () => void;
}

function MissionCard({ mission, onComplete }: MissionCardProps) {
  const statusIcons = {
    active: <Activity className="h-4 w-4 text-blue-600" />,
    completed: <CheckCircle className="h-4 w-4 text-green-600" />,
    failed: <XCircle className="h-4 w-4 text-red-600" />,
    cancelled: <AlertTriangle className="h-4 w-4 text-yellow-600" />
  };

  const statusColors = {
    active: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    completed: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
    failed: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
    cancelled: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20'
  };

  const difficultyColors = {
    easy: 'text-green-600',
    medium: 'text-yellow-600',
    hard: 'text-orange-600',
    expert: 'text-red-600'
  };

  const isActive = mission.status === 'active';
  const canComplete = isActive && mission.progress >= 100;

  return (
    <Card className="glass-surface glass-refraction hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {statusIcons[mission.status as keyof typeof statusIcons] || statusIcons.active}
              <CardTitle className="text-base">{mission.name}</CardTitle>
            </div>
            <CardDescription className="text-sm">{mission.description}</CardDescription>
          </div>
          <Badge className={cn('text-xs', statusColors[mission.status as keyof typeof statusColors] || statusColors.active)}>
            {mission.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Mission Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Type</p>
            <p className="font-semibold capitalize">{mission.type.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Difficulty</p>
            <p className={cn('font-semibold capitalize', difficultyColors[mission.difficulty as keyof typeof difficultyColors])}>
              {mission.difficulty}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Staff Assigned</p>
            <p className="font-semibold">{mission.requiredStaff}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Success Rate</p>
            <p className="font-semibold text-green-600">{mission.successChance}%</p>
          </div>
        </div>

        {/* Progress Bar (for active missions) */}
        {isActive && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="text-xs font-semibold">{Math.round(mission.progress || 0)}%</p>
            </div>
            <Progress value={mission.progress || 0} className="h-2" />
          </div>
        )}

        {/* Time Remaining */}
        {isActive && mission.completesAt && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Completes: {new Date(mission.completesAt).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* Rewards */}
        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
          <p className="text-xs text-muted-foreground mb-2">Rewards</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-600" />
              <span>+{mission.experienceReward} XP</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-blue-600" />
              <span>+{mission.influenceReward} Influence</span>
            </div>
            <div className="flex items-center gap-1">
              <Award className="h-3 w-3 text-purple-600" />
              <span>+{mission.reputationReward} Rep</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-green-600" />
              <span>${(mission.economicReward || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Complete Button */}
        {canComplete && onComplete && (
          <Button onClick={onComplete} className="w-full" size="sm">
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete Mission
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Main Component
export function DiplomaticOperationsHub({ countryId, countryName }: DiplomaticOperationsHubProps) {
  const [activeTab, setActiveTab] = useState<TabType>('embassy-network');
  const [expandedEmbassy, setExpandedEmbassy] = useState<string | null>(null);
  const [missionFilter, setMissionFilter] = useState<MissionFilter>('all');
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('all');
  const [selectedEmbassy, setSelectedEmbassy] = useState<string | null>(null);

  // Dialog states
  const [establishEmbassyOpen, setEstablishEmbassyOpen] = useState(false);
  const [startMissionOpen, setStartMissionOpen] = useState(false);
  const [createExchangeOpen, setCreateExchangeOpen] = useState(false);
  const [allocateBudgetOpen, setAllocateBudgetOpen] = useState(false);
  const [upgradeEmbassyOpen, setUpgradeEmbassyOpen] = useState(false);

  // Form states
  const [newEmbassyData, setNewEmbassyData] = useState({ hostCountry: '', name: '', location: '', ambassador: '' });
  const [newMissionData, setNewMissionData] = useState({ type: 'trade_negotiation', staff: 1, priority: 'normal' });
  const [newExchangeData, setNewExchangeData] = useState({ title: '', type: 'festival', description: '', startDate: '', endDate: '' });
  const [budgetAmount, setBudgetAmount] = useState(10000);
  const [selectedUpgradeType, setSelectedUpgradeType] = useState<string>('staff_expansion');

  // Fetch data
  const { data: embassies, isLoading: embassiesLoading, refetch: refetchEmbassies } = api.diplomatic.getEmbassies.useQuery({ countryId });
  const { data: missions, isLoading: missionsLoading, refetch: refetchMissions } = api.diplomatic.getAvailableMissions.useQuery(
    { embassyId: selectedEmbassy || '' },
    { enabled: !!selectedEmbassy }
  );
  const { data: exchanges, isLoading: exchangesLoading, refetch: refetchExchanges } = api.diplomatic.getCulturalExchanges.useQuery({ countryId });
  const { data: relationships } = api.diplomatic.getRelationships.useQuery({ countryId });
  const { data: availableUpgrades, isLoading: upgradesLoading } = api.diplomatic.getAvailableUpgrades.useQuery(
    { embassyId: selectedEmbassy || '' },
    { enabled: upgradeEmbassyOpen && !!selectedEmbassy }
  );
  const { data: countryOptionsData, isLoading: countriesLoading } = api.countries.getSelectList.useQuery();

  const hostCountryOptions = useMemo(
    () => (countryOptionsData ?? []).filter((country) => country.id !== countryId),
    [countryOptionsData, countryId]
  );

  const existingGuestEmbassyHosts = useMemo(() => {
    if (!embassies || embassies.length === 0) return new Set<string>();
    return new Set(
      embassies
        .filter((embassy: any) => embassy.guestCountryId === countryId || embassy.role === 'guest')
        .map((embassy: any) => embassy.hostCountryId)
        .filter((id: string | undefined): id is string => Boolean(id))
    );
  }, [embassies, countryId]);

  useEffect(() => {
    if (!upgradeEmbassyOpen || !availableUpgrades || availableUpgrades.length === 0) return;
    if (!availableUpgrades.some(upgrade => upgrade?.upgradeType === selectedUpgradeType)) {
      setSelectedUpgradeType(availableUpgrades[0]?.upgradeType ?? 'staff_expansion');
    }
  }, [availableUpgrades, upgradeEmbassyOpen, selectedUpgradeType]);

  useEffect(() => {
    if (!establishEmbassyOpen || hostCountryOptions.length === 0) return;
    setNewEmbassyData((prev) => {
      if (prev.hostCountry && hostCountryOptions.some((option) => option.id === prev.hostCountry)) {
        return prev;
      }

      const availableOption = hostCountryOptions.find((option) => !existingGuestEmbassyHosts.has(option.id)) || hostCountryOptions[0];
      if (!availableOption) return prev;

      return {
        ...prev,
        hostCountry: availableOption.id,
        name: `Embassy of ${countryName} in ${availableOption.name}`,
      };
    });
  }, [establishEmbassyOpen, hostCountryOptions, existingGuestEmbassyHosts, countryName]);

  // Mutations
  const establishEmbassyMutation = api.diplomatic.establishEmbassy.useMutation({
    onSuccess: (data) => {
      toast.success('Embassy Established', {
        description: `Your embassy is now active in ${(data as any).hostCountryName || 'the host nation'}.`,
      });
      setEstablishEmbassyOpen(false);
      setNewEmbassyData({ hostCountry: '', name: '', location: '', ambassador: '' });
      void refetchEmbassies();
    },
    onError: (error) => {
      toast.error('Failed to Establish Embassy', { description: error.message });
    }
  });

  const startMissionMutation = api.diplomatic.startMission.useMutation({
    onSuccess: () => {
      toast.success('Mission Started', { description: 'Your diplomatic mission has been initiated!' });
      setStartMissionOpen(false);
      setNewMissionData({ type: 'trade_negotiation', staff: 1, priority: 'normal' });
      refetchMissions();
      refetchEmbassies();
    },
    onError: (error) => {
      toast.error('Failed to Start Mission', { description: error.message });
    }
  });

  const completeMissionMutation = api.diplomatic.completeMission.useMutation({
    onSuccess: (data) => {
      const message = data.success
        ? `Mission successful! Earned +${data.rewards.experience} XP and +${data.rewards.influence.toFixed(0)} influence.`
        : 'Mission failed. Better luck next time.';
      toast[data.success ? 'success' : 'warning']('Mission Complete', { description: message });
      refetchMissions();
      refetchEmbassies();
    },
    onError: (error) => {
      toast.error('Failed to Complete Mission', { description: error.message });
    }
  });

  const createExchangeMutation = api.diplomatic.createCulturalExchange.useMutation({
    onSuccess: () => {
      toast.success('Cultural Exchange Created', { description: 'Your cultural exchange program has been created!' });
      setCreateExchangeOpen(false);
      setNewExchangeData({ title: '', type: 'festival', description: '', startDate: '', endDate: '' });
      refetchExchanges();
    },
    onError: (error) => {
      toast.error('Failed to Create Exchange', { description: error.message });
    }
  });

  const allocateBudgetMutation = api.diplomatic.allocateBudget.useMutation({
    onSuccess: () => {
      toast.success('Budget Allocated', { description: `$${budgetAmount.toLocaleString()} has been allocated to the embassy.` });
      setAllocateBudgetOpen(false);
      setBudgetAmount(10000);
      refetchEmbassies();
    },
    onError: (error) => {
      toast.error('Failed to Allocate Budget', { description: error.message });
    }
  });

  const upgradeEmbassyMutation = api.diplomatic.upgradeEmbassy.useMutation({
    onSuccess: (upgrade) => {
      toast.success('Upgrade Initiated', {
        description: `${upgrade.name || 'Embassy upgrade'} will complete in ${upgrade.duration} days.`,
      });
      setUpgradeEmbassyOpen(false);
      setSelectedUpgradeType('staff_expansion');
      refetchEmbassies();
    },
    onError: (error) => {
      toast.error('Failed to upgrade embassy', { description: error.message });
    }
  });

  // Handlers
  const handleHostCountrySelect = useCallback(
    (value: string) => {
      const selected = hostCountryOptions.find((option) => option.id === value);
      setNewEmbassyData((prev) => {
        const shouldOverrideName =
          !prev.name || prev.name.startsWith(`Embassy of ${countryName} in `);
        return {
          ...prev,
          hostCountry: value,
          name:
            selected && shouldOverrideName
              ? `Embassy of ${countryName} in ${selected.name}`
              : prev.name,
        };
      });
    },
    [hostCountryOptions, countryName]
  );

  useEffect(() => {
    if (!establishEmbassyOpen || hostCountryOptions.length === 0) return;
    setNewEmbassyData((prev) => {
      if (prev.hostCountry && hostCountryOptions.some((option) => option.id === prev.hostCountry)) {
        return prev;
      }
      const firstAvailable =
        hostCountryOptions.find((option) => !existingGuestEmbassyHosts.has(option.id)) ||
        hostCountryOptions[0];
      if (!firstAvailable) return prev;
      return {
        ...prev,
        hostCountry: firstAvailable.id,
        name: `Embassy of ${countryName} in ${firstAvailable.name}`,
      };
    });
  }, [establishEmbassyOpen, hostCountryOptions, existingGuestEmbassyHosts, countryName]);

  const handleEstablishEmbassy = useCallback(() => {
    if (!newEmbassyData.hostCountry) {
      toast.error('Missing Information', { description: 'Please select a host country.' });
      return;
    }

    const selectedHost = hostCountryOptions.find(
      (option) => option.id === newEmbassyData.hostCountry
    );

    const embassyName =
      newEmbassyData.name && newEmbassyData.name.trim().length > 0
        ? newEmbassyData.name
        : selectedHost
          ? `Embassy of ${countryName} in ${selectedHost.name}`
          : '';

    if (!embassyName) {
      toast.error('Missing Information', { description: 'Please provide host country and embassy name.' });
      return;
    }

    establishEmbassyMutation.mutate({
      hostCountryId: newEmbassyData.hostCountry,
      guestCountryId: countryId,
      name: embassyName,
      location: newEmbassyData.location || undefined,
      ambassadorName: newEmbassyData.ambassador || undefined
    });
  }, [newEmbassyData, countryId, establishEmbassyMutation, hostCountryOptions, countryName]);

  const handleStartMission = useCallback(() => {
    if (!selectedEmbassy) {
      toast.error('No Embassy Selected', { description: 'Please select an embassy first.' });
      return;
    }

    startMissionMutation.mutate({
      embassyId: selectedEmbassy,
      missionType: newMissionData.type as any,
      staffAssigned: newMissionData.staff,
      priorityLevel: newMissionData.priority as any
    });
  }, [selectedEmbassy, newMissionData, startMissionMutation]);

  const handleCompleteMission = useCallback((missionId: string) => {
    completeMissionMutation.mutate({ missionId });
  }, [completeMissionMutation]);

  const handleCreateExchange = useCallback(() => {
    if (!newExchangeData.title || !newExchangeData.description) {
      toast.error('Missing Information', { description: 'Please provide title and description.' });
      return;
    }

    createExchangeMutation.mutate({
      title: newExchangeData.title,
      type: newExchangeData.type as any,
      description: newExchangeData.description,
      hostCountryId: countryId,
      hostCountryName: countryName,
      startDate: newExchangeData.startDate || new Date().toISOString(),
      endDate: newExchangeData.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }, [newExchangeData, countryId, countryName, createExchangeMutation]);

  const handleAllocateBudget = useCallback(() => {
    if (!selectedEmbassy) {
      toast.error('No Embassy Selected', { description: 'Please select an embassy first.' });
      return;
    }

    allocateBudgetMutation.mutate({
      embassyId: selectedEmbassy,
      additionalBudget: budgetAmount
    });
  }, [selectedEmbassy, budgetAmount, allocateBudgetMutation]);

  const handleUpgradeEmbassy = useCallback(() => {
    if (!selectedEmbassy) {
      toast.error('No Embassy Selected', { description: 'Please select an embassy to upgrade.' });
      return;
    }

    const upgrade = availableUpgrades?.find(option => option?.upgradeType === selectedUpgradeType);
    if (!upgrade) {
      toast.error('Upgrade Unavailable', { description: 'No upgrades available for this embassy.' });
      return;
    }

    upgradeEmbassyMutation.mutate({
      embassyId: selectedEmbassy,
      upgradeType: upgrade.upgradeType as any,
      level: upgrade.nextLevel,
    });
  }, [selectedEmbassy, availableUpgrades, selectedUpgradeType, upgradeEmbassyMutation]);

  // Computed values
  const networkMetrics = useMemo(() => {
    if (!embassies || embassies.length === 0) return null;

    const totalEmbassies = embassies.length;
    const avgInfluence = embassies.reduce((sum, e) => sum + (e.strength || 0), 0) / totalEmbassies;
    const activeCount = embassies.filter(e => e.status === 'active').length;
    const totalLevel = embassies.reduce((sum, e) => sum + ((e as any).level || 1), 0);

    return {
      totalEmbassies,
      avgInfluence,
      activeCount,
      totalLevel,
      networkPower: Math.round(totalEmbassies * 10 + avgInfluence + totalLevel * 5)
    };
  }, [embassies]);

  const filteredMissions = useMemo(() => {
    if (!missions) return [];
    if (missionFilter === 'all') return missions;
    return missions.filter(m => (m as any).status === missionFilter);
  }, [missions, missionFilter]);

  const filteredExchanges = useMemo(() => {
    if (!exchanges) return [];
    if (exchangeFilter === 'all') return exchanges;
    return exchanges.filter(e => (e as any).status === exchangeFilter);
  }, [exchanges, exchangeFilter]);

  const selectedUpgrade = useMemo(() => {
    if (!availableUpgrades) return null;
    return availableUpgrades.find(upgrade => upgrade?.upgradeType === selectedUpgradeType) ?? null;
  }, [availableUpgrades, selectedUpgradeType]);

  if (embassiesLoading && !embassies) {
    return <LoadingState variant="spinner" size="lg" message="Loading diplomatic operations..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-surface glass-refraction border-purple-200 dark:border-purple-800/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-6 w-6 text-purple-600" />
                Diplomatic Operations Hub
              </CardTitle>
              <CardDescription>
                Manage embassies, missions, and cultural exchanges
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {countryName}
            </Badge>
          </div>
        </CardHeader>

        {/* Network Overview */}
        {networkMetrics && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">Embassies</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{networkMetrics.totalEmbassies}</p>
              </div>

              <div className="p-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Active</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{networkMetrics.activeCount}</p>
              </div>

              <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-muted-foreground">Avg Influence</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">{Math.round(networkMetrics.avgInfluence)}%</p>
              </div>

              <div className="p-3 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-muted-foreground">Total Levels</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">{networkMetrics.totalLevel}</p>
              </div>

              <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs text-muted-foreground">Network Power</span>
                </div>
                <p className="text-2xl font-bold text-indigo-600">{networkMetrics.networkPower}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="embassy-network" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Embassy Network</span>
            <span className="sm:hidden">Network</span>
          </TabsTrigger>
          <TabsTrigger value="missions" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Missions</span>
            <span className="sm:hidden">Missions</span>
          </TabsTrigger>
          <TabsTrigger value="cultural-exchanges" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Cultural Exchanges</span>
            <span className="sm:hidden">Exchanges</span>
          </TabsTrigger>
          <TabsTrigger value="treaties" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Treaties</span>
            <span className="sm:hidden">Treaties</span>
          </TabsTrigger>
        </TabsList>

        {/* Embassy Network Tab */}
        <TabsContent value="embassy-network" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Your Embassy Network</h3>
            <Button onClick={() => setEstablishEmbassyOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Establish Embassy
            </Button>
          </div>

          {embassies && embassies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {embassies.map((embassy) => (
                <EmbassyCard
                  key={embassy.id}
                  embassy={embassy}
                  isExpanded={expandedEmbassy === embassy.id}
                  onToggle={() => setExpandedEmbassy(expandedEmbassy === embassy.id ? null : embassy.id)}
                  onUpgrade={() => {
                    setSelectedEmbassy(embassy.id);
                    setUpgradeEmbassyOpen(true);
                  }}
                  onStartMission={() => {
                    setSelectedEmbassy(embassy.id);
                    setStartMissionOpen(true);
                  }}
                  onAllocateBudget={() => {
                    setSelectedEmbassy(embassy.id);
                    setAllocateBudgetOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <Card className="glass-surface glass-refraction">
              <CardContent className="py-12 text-center">
                <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Embassies Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Establish your first embassy to begin building diplomatic relationships
                </p>
                <Button onClick={() => setEstablishEmbassyOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Establish First Embassy
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Missions Tab */}
        <TabsContent value="missions" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold">Diplomatic Missions</h3>
            <div className="flex items-center gap-2">
              <Select value={missionFilter} onValueChange={(v) => setMissionFilter(v as MissionFilter)}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Missions</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setStartMissionOpen(true)} size="sm" disabled={!selectedEmbassy}>
                <Plus className="h-4 w-4 mr-2" />
                Start Mission
              </Button>
            </div>
          </div>

          {!selectedEmbassy ? (
            <Card className="glass-surface glass-refraction">
              <CardContent className="py-12 text-center">
                <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Select an Embassy</h3>
                <p className="text-sm text-muted-foreground">
                  Go to the Embassy Network tab and select an embassy to view and start missions
                </p>
              </CardContent>
            </Card>
          ) : missionsLoading ? (
            <LoadingState variant="spinner" message="Loading missions..." />
          ) : filteredMissions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMissions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onComplete={(mission as any).status === 'active' && (mission as any).progress >= 100 ? () => handleCompleteMission(mission.id) : undefined}
                />
              ))}
            </div>
          ) : (
            <Card className="glass-surface glass-refraction">
              <CardContent className="py-12 text-center">
                <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No {missionFilter !== 'all' ? missionFilter : ''} Missions</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {missionFilter === 'all'
                    ? 'Start your first diplomatic mission to expand your influence'
                    : `No ${missionFilter} missions at this time`}
                </p>
                {missionFilter === 'all' && (
                  <Button onClick={() => setStartMissionOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Start First Mission
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cultural Exchanges Tab */}
        <TabsContent value="cultural-exchanges" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold">Cultural Exchange Programs</h3>
            <div className="flex items-center gap-2">
              <Select value={exchangeFilter} onValueChange={(v) => setExchangeFilter(v as ExchangeFilter)}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exchanges</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setCreateExchangeOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Exchange
              </Button>
            </div>
          </div>

          {exchangesLoading ? (
            <LoadingState variant="spinner" message="Loading exchanges..." />
          ) : filteredExchanges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredExchanges.map((exchange) => (
                <Card key={exchange.id} className="glass-surface glass-refraction hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Heart className="h-5 w-5 text-pink-600" />
                          {exchange.title}
                        </CardTitle>
                        <CardDescription className="mt-1">{exchange.description}</CardDescription>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {exchange.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Type</p>
                        <p className="font-semibold capitalize">{exchange.type}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Participants</p>
                        <p className="font-semibold">{exchange.metrics.participants}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Cultural Impact</span>
                        <span className="font-semibold">{exchange.metrics.culturalImpact}/100</span>
                      </div>
                      <Progress value={exchange.metrics.culturalImpact} className="h-2" />
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(exchange.startDate).toLocaleDateString()} - {new Date(exchange.endDate).toLocaleDateString()}
                      </span>
                    </div>

                    {exchange.participatingCountries.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Participating Countries</p>
                        <div className="flex flex-wrap gap-2">
                          {exchange.participatingCountries.slice(0, 3).map((country: any) => (
                            <Badge key={country.id} variant="outline" className="text-xs">
                              {country.name}
                            </Badge>
                          ))}
                          {exchange.participatingCountries.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{exchange.participatingCountries.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass-surface glass-refraction">
              <CardContent className="py-12 text-center">
                <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No {exchangeFilter !== 'all' ? exchangeFilter : ''} Cultural Exchanges</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {exchangeFilter === 'all'
                    ? 'Create your first cultural exchange to strengthen international ties'
                    : `No ${exchangeFilter} exchanges at this time`}
                </p>
                {exchangeFilter === 'all' && (
                  <Button onClick={() => setCreateExchangeOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Exchange
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Treaties Tab */}
        <TabsContent value="treaties" className="space-y-4">
          <h3 className="text-lg font-semibold">Active Treaties</h3>

          {relationships && relationships.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relationships
                .filter(r => r.treaties && r.treaties.length > 0)
                .map((relationship) => (
                  <Card key={relationship.id} className="glass-surface glass-refraction">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        {relationship.targetCountry}
                      </CardTitle>
                      <CardDescription>
                        Relationship: <span className="capitalize font-semibold">{relationship.relationship}</span> • Strength: {relationship.strength}%
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-2">Active Treaties</p>
                      <div className="flex flex-wrap gap-2">
                        {relationship.treaties.map((treaty: string, idx: number) => (
                          <Badge key={idx} variant="outline">
                            {treaty}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <Card className="glass-surface glass-refraction">
              <CardContent className="py-12 text-center">
                <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Active Treaties</h3>
                <p className="text-sm text-muted-foreground">
                  Build diplomatic relationships to negotiate and sign treaties
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Establish Embassy Dialog */}
      <Dialog open={establishEmbassyOpen} onOpenChange={setEstablishEmbassyOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Establish New Embassy</DialogTitle>
            <DialogDescription>
              Create a new diplomatic mission in another country
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="host-country">Host Country *</Label>
              <Select
                value={newEmbassyData.hostCountry}
                onValueChange={handleHostCountrySelect}
                disabled={countriesLoading || hostCountryOptions.length === 0}
              >
                <SelectTrigger id="host-country">
                  <SelectValue placeholder={countriesLoading ? 'Loading countries...' : 'Select a country'} />
                </SelectTrigger>
                <SelectContent>
                  {hostCountryOptions.map((option) => (
                    <SelectItem
                      key={option.id}
                      value={option.id}
                      disabled={existingGuestEmbassyHosts.has(option.id)}
                    >
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="embassy-name">Embassy Name *</Label>
              <Input
                id="embassy-name"
                placeholder="e.g., Embassy of [Your Country] in [Host Country]"
                value={newEmbassyData.name}
                onChange={(e) => setNewEmbassyData({ ...newEmbassyData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                placeholder="e.g., Capital City"
                value={newEmbassyData.location}
                onChange={(e) => setNewEmbassyData({ ...newEmbassyData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ambassador">Ambassador Name (Optional)</Label>
              <Input
                id="ambassador"
                placeholder="Name of appointed ambassador"
                value={newEmbassyData.ambassador}
                onChange={(e) => setNewEmbassyData({ ...newEmbassyData, ambassador: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstablishEmbassyOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEstablishEmbassy}
              disabled={establishEmbassyMutation.isPending || hostCountryOptions.length === 0}
            >
              {establishEmbassyMutation.isPending ? 'Establishing...' : 'Establish Embassy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Mission Dialog */}
      <Dialog open={startMissionOpen} onOpenChange={setStartMissionOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Start Diplomatic Mission</DialogTitle>
            <DialogDescription>
              Launch a new mission from your selected embassy
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mission-type">Mission Type</Label>
              <Select value={newMissionData.type} onValueChange={(v) => setNewMissionData({ ...newMissionData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trade_negotiation">Trade Negotiation</SelectItem>
                  <SelectItem value="intelligence_gathering">Intelligence Gathering</SelectItem>
                  <SelectItem value="cultural_outreach">Cultural Outreach</SelectItem>
                  <SelectItem value="security_cooperation">Security Cooperation</SelectItem>
                  <SelectItem value="research_collaboration">Research Collaboration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-count">Staff to Assign</Label>
              <Input
                id="staff-count"
                type="number"
                min="1"
                max="5"
                value={newMissionData.staff}
                onChange={(e) => setNewMissionData({ ...newMissionData, staff: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority Level</Label>
              <Select value={newMissionData.priority} onValueChange={(v) => setNewMissionData({ ...newMissionData, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (Slower, lower cost)</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High (Faster, higher success)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartMissionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartMission} disabled={startMissionMutation.isPending}>
              {startMissionMutation.isPending ? 'Starting...' : 'Start Mission'}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Upgrade Embassy Dialog */}
    <Dialog open={upgradeEmbassyOpen} onOpenChange={setUpgradeEmbassyOpen}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Upgrade Embassy</DialogTitle>
          <DialogDescription>
            Invest in targeted upgrades to improve embassy effectiveness and mission success.
          </DialogDescription>
        </DialogHeader>

        {!selectedEmbassy ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Select an embassy from the network list to view upgrade options.
          </div>
        ) : upgradesLoading ? (
          <LoadingState variant="spinner" message="Loading upgrade options..." />
        ) : availableUpgrades && availableUpgrades.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upgrade-type">Upgrade Focus</Label>
              <Select value={selectedUpgradeType} onValueChange={setSelectedUpgradeType}>
                <SelectTrigger id="upgrade-type">
                  <SelectValue placeholder="Select upgrade" />
                </SelectTrigger>
                <SelectContent>
                  {availableUpgrades.filter(upgrade => upgrade !== null).map(upgrade => (
                    <SelectItem key={upgrade.upgradeType} value={upgrade.upgradeType}>
                      {upgrade.upgradeType.replace(/_/g, ' ')} (Lvl {upgrade.nextLevel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUpgrade && (
              <div className="grid gap-3 rounded-lg border border-purple-200/60 bg-purple-50/40 p-4 dark:border-purple-900/60 dark:bg-purple-950/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold capitalize">{selectedUpgrade.upgradeType.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">Level {selectedUpgrade.nextLevel} upgrade</p>
                  </div>
                  <Badge variant="outline">{selectedUpgrade.duration} day project</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-white/60 p-3 dark:bg-black/40">
                    <p className="text-xs text-muted-foreground">Cost</p>
                    <p className="font-semibold">${selectedUpgrade.cost.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md bg-white/60 p-3 dark:bg-black/40">
                    <p className="text-xs text-muted-foreground">Requirements</p>
                    <p className="font-semibold">Level {selectedUpgrade.requirements.embassyLevel}+ | Budget ${selectedUpgrade.requirements.budget.toLocaleString()}</p>
                  </div>
                </div>

                {selectedUpgrade.effects && (
                  <div className="rounded-md bg-muted/50 p-3 text-xs">
                    <p className="mb-1 font-semibold">Projected Effects</p>
                    <ul className="space-y-1">
                      {Object.entries(selectedUpgrade.effects).map(([key, value]) => (
                        <li key={key} className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">
                            {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                          </Badge>
                          <span className="font-medium">+{String(value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md border border-dashed border-green-300/60 p-3 text-green-700 dark:border-green-700/60 dark:text-green-300">
                    {selectedUpgrade.canAfford ? 'Budget available' : 'Insufficient budget'}
                  </div>
                  <div className="rounded-md border border-dashed border-blue-300/60 p-3 text-blue-700 dark:border-blue-700/60 dark:text-blue-300">
                    {selectedUpgrade.meetsLevelReq ? 'Level requirement met' : `Requires embassy level ${selectedUpgrade.requirements.embassyLevel}`}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No upgrades are currently available for this embassy.
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setUpgradeEmbassyOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpgradeEmbassy}
            disabled={
              upgradeEmbassyMutation.isPending ||
              !selectedEmbassy ||
              !selectedUpgrade ||
              !selectedUpgrade.canAfford ||
              !selectedUpgrade.meetsLevelReq
            }
          >
            {upgradeEmbassyMutation.isPending ? 'Starting Upgrade...' : 'Start Upgrade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Create Cultural Exchange Dialog */}
    <Dialog open={createExchangeOpen} onOpenChange={setCreateExchangeOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Cultural Exchange</DialogTitle>
            <DialogDescription>
              Organize a new cultural exchange program
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="exchange-title">Title *</Label>
              <Input
                id="exchange-title"
                placeholder="e.g., International Arts Festival"
                value={newExchangeData.title}
                onChange={(e) => setNewExchangeData({ ...newExchangeData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exchange-type">Type</Label>
              <Select value={newExchangeData.type} onValueChange={(v) => setNewExchangeData({ ...newExchangeData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="festival">Festival</SelectItem>
                  <SelectItem value="exhibition">Exhibition</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="cuisine">Cuisine</SelectItem>
                  <SelectItem value="arts">Arts</SelectItem>
                  <SelectItem value="sports">Sports</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="diplomacy">Diplomacy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exchange-description">Description *</Label>
              <Textarea
                id="exchange-description"
                placeholder="Describe the cultural exchange program..."
                rows={3}
                value={newExchangeData.description}
                onChange={(e) => setNewExchangeData({ ...newExchangeData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={newExchangeData.startDate}
                  onChange={(e) => setNewExchangeData({ ...newExchangeData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={newExchangeData.endDate}
                  onChange={(e) => setNewExchangeData({ ...newExchangeData, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateExchangeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateExchange} disabled={createExchangeMutation.isPending}>
              {createExchangeMutation.isPending ? 'Creating...' : 'Create Exchange'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocate Budget Dialog */}
      <Dialog open={allocateBudgetOpen} onOpenChange={setAllocateBudgetOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Allocate Embassy Budget</DialogTitle>
            <DialogDescription>
              Add additional funding to your embassy
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="budget-amount">Amount to Allocate</Label>
              <Input
                id="budget-amount"
                type="number"
                min="1000"
                max="1000000"
                step="1000"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Amount: ${budgetAmount.toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateBudgetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAllocateBudget} disabled={allocateBudgetMutation.isPending}>
              {allocateBudgetMutation.isPending ? 'Allocating...' : 'Allocate Budget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
