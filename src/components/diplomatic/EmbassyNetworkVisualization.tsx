"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { 
  RiShakeHandsLine,
  RiGlobalLine,
  RiEyeLine,
  RiShieldLine,
  RiSearchLine,
  RiFilterLine,
  RiCloseLine,
  RiArrowRightLine,
  RiInformationLine,
  RiMapPinLine,
  RiBuildingLine,
  RiCalendarLine,
  RiAddLine,
  RiStarLine,
  RiStarFill,
  RiTrophyLine,
  RiCoinLine,
  RiUploadLine,
  RiPlayLine,
  RiPauseLine,
  RiRefreshLine,
  RiTimeLine,
  RiUserLine,
  RiTeamLine,
  RiLockLine,
  RiSettings2Line,
  RiFireLine,
  RiBarChartLine
} from "react-icons/ri";

interface DiplomaticRelation {
  id: string;
  countryId: string;
  countryName: string;
  relationType: 'alliance' | 'trade' | 'neutral' | 'tension';
  strength: number;
  recentActivity?: string;
  establishedAt: string;
  flagUrl?: string;
  economicTier?: string;
}

interface Embassy {
  id: string;
  targetCountryId: string;
  targetCountryName: string;
  level: number;
  experience: number;
  influence: number;
  budget: number;
  maintenanceCost: number;
  staffCount: number;
  location: string;
  ambassador: string;
  securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM';
  status: 'ACTIVE' | 'MAINTENANCE' | 'SUSPENDED' | 'CLOSED';
  specializations: string[];
  establishedAt: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  availableMissions?: EmbassyMission[];
  availableUpgrades?: EmbassyUpgrade[];
}

interface EmbassyMission {
  id: string;
  type: 'TRADE_NEGOTIATION' | 'CULTURAL_EXCHANGE' | 'INTELLIGENCE_GATHERING' | 'CRISIS_MANAGEMENT' | 'ECONOMIC_COOPERATION';
  title: string;
  description: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  duration: number;
  requiredLevel: number;
  experienceReward: number;
  influenceReward: number;
  budgetCost: number;
  successChance: number;
  status: 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  startedAt?: string;
  completedAt?: string;
}

interface EmbassyUpgrade {
  id: string;
  name: string;
  description: string;
  type: 'SECURITY' | 'STAFF' | 'FACILITIES' | 'TECHNOLOGY' | 'SPECIALIZATION';
  cost: number;
  requiredLevel: number;
  effects: Record<string, number>;
  duration?: number;
  isActive: boolean;
  purchasedAt?: string;
}

interface EmbassyNetworkVisualizationProps {
  primaryCountry: {
    id: string;
    name: string;
    flagUrl?: string;
    economicTier?: string;
  };
  diplomaticRelations: DiplomaticRelation[];
  onRelationClick?: (relation: DiplomaticRelation) => void;
  onEstablishEmbassy?: (targetCountryId: string) => void;
  viewerClearanceLevel?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
}

// Relation type configurations
const RELATION_TYPES = {
  alliance: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/40',
    icon: RiShakeHandsLine,
    label: 'Alliance',
    priority: 4
  },
  trade: {
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/40',
    icon: RiGlobalLine,
    label: 'Trade Partner',
    priority: 3
  },
  neutral: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20', 
    borderColor: 'border-gray-500/40',
    icon: RiEyeLine,
    label: 'Neutral',
    priority: 2
  },
  tension: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/40', 
    icon: RiShieldLine,
    label: 'Tension',
    priority: 1
  }
} as const;

const EmbassyNetworkVisualizationComponent: React.FC<EmbassyNetworkVisualizationProps> = ({
  primaryCountry,
  diplomaticRelations: propRelations,
  onRelationClick,
  onEstablishEmbassy,
  viewerClearanceLevel = 'PUBLIC'
}) => {
  const [selectedRelation, setSelectedRelation] = useState<DiplomaticRelation | null>(null);
  const [selectedEmbassy, setSelectedEmbassy] = useState<Embassy | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'network' | 'list' | 'game'>('network');
  const [showEmbassyDetails, setShowEmbassyDetails] = useState(false);
  const [showEstablishEmbassy, setShowEstablishEmbassy] = useState(false);
  const [showMissionsPanel, setShowMissionsPanel] = useState(false);
  const [showUpgradesPanel, setShowUpgradesPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'missions' | 'upgrades' | 'economics'>('overview');
  const networkContainerRef = useRef<HTMLDivElement>(null);

  // Fetch live diplomatic relationships
  const { data: liveRelations, isLoading, error } = api.diplomatic.getRelationships.useQuery(
    { countryId: primaryCountry.id },
    { enabled: !!primaryCountry.id, refetchInterval: 30000 } // Refetch every 30 seconds
  );

  // Fetch embassy game data
  const { data: embassyData, isLoading: embassyLoading } = api.diplomatic.getEmbassyDetails.useQuery(
    { embassyId: primaryCountry.id },
    { enabled: !!primaryCountry.id && viewMode === 'game', refetchInterval: 60000 }
  );

  // Fetch available missions
  const { data: availableMissions } = api.diplomatic.getAvailableMissions.useQuery(
    { embassyId: primaryCountry.id },
    { enabled: !!primaryCountry.id && viewMode === 'game' }
  );

  // Fetch available upgrades
  const { data: availableUpgrades } = api.diplomatic.getAvailableUpgrades.useQuery(
    { embassyId: primaryCountry.id },
    { enabled: !!primaryCountry.id && viewMode === 'game' }
  );

  // Game action mutations
  const establishEmbassyMutation = api.diplomatic.establishEmbassy.useMutation({
    onSuccess: (data) => {
      toast.success(`Embassy established in ${(data as any).targetCountryName}!`, {
        description: `Your new Level ${(data as any).level} embassy is now operational.`
      });
    },
    onError: (error) => {
      toast.error('Failed to establish embassy', {
        description: error.message
      });
    }
  });

  const startMissionMutation = api.diplomatic.startMission.useMutation({
    onSuccess: (data) => {
      toast.success(`Mission "${(data as any).name || 'Mission'}" started!`, {
        description: `Expected completion in ${(data as any).duration || 0} hours.`
      });
    },
    onError: (error) => {
      toast.error('Failed to start mission', {
        description: error.message
      });
    }
  });

  const completeMissionMutation = api.diplomatic.completeMission.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Mission completed successfully!`, {
          description: `Gained ${(data as any).rewards?.experience || 0} XP and ${(data as any).rewards?.influence || 0} influence.`
        });
      } else {
        toast.warning(`Mission failed`, {
          description: (data as any).message || 'The mission did not succeed, but experience was gained.'
        });
      }
    },
    onError: (error) => {
      toast.error('Error completing mission', {
        description: error.message
      });
    }
  });

  const upgradeEmbassyMutation = api.diplomatic.upgradeEmbassy.useMutation({
    onSuccess: (data) => {
      toast.success(`Embassy upgraded!`, {
        description: `${(data as any).upgradeType || 'Upgrade'} has been installed successfully.`
      });
    },
    onError: (error) => {
      toast.error('Failed to upgrade embassy', {
        description: error.message
      });
    }
  });

  const payMaintenanceMutation = api.diplomatic.payMaintenance.useMutation({
    onSuccess: (data) => {
      toast.success('Maintenance paid successfully!', {
        description: `Embassy maintenance paid successfully`
      });
    },
    onError: (error) => {
      toast.error('Failed to pay maintenance', {
        description: error.message
      });
    }
  });

  // Use live data if available, fallback to prop data
  const diplomaticRelations: DiplomaticRelation[] = useMemo(() => {
    if (liveRelations && liveRelations.length > 0) {
      return liveRelations.map((relation: any): DiplomaticRelation => ({
        id: relation.id,
        countryId: relation.targetCountryId,
        countryName: relation.targetCountry,
        relationType: relation.relationship as 'alliance' | 'trade' | 'neutral' | 'tension',
        strength: relation.strength,
        recentActivity: relation.recentActivity,
        establishedAt: relation.establishedAt,
        flagUrl: relation.flagUrl,
        economicTier: relation.economicTier
      }));
    }
    return propRelations;
  }, [liveRelations, propRelations]);

  // Transform embassy data
  const embassies = useMemo(() => {
    if (!embassyData) return [];
    return (embassyData as any).map((embassy: any) => ({
      id: embassy.id,
      targetCountryId: embassy.targetCountryId,
      targetCountryName: embassy.targetCountry || 'Unknown',
      level: embassy.level || 1,
      experience: embassy.experience || 0,
      influence: embassy.influence || 0,
      budget: embassy.budget || 0,
      maintenanceCost: embassy.maintenanceCost || 1000,
      staffCount: embassy.staffCount || 10,
      location: embassy.location || 'Diplomatic Quarter',
      ambassador: embassy.ambassador || 'TBD',
      securityLevel: embassy.securityLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM',
      status: embassy.status as 'ACTIVE' | 'MAINTENANCE' | 'SUSPENDED' | 'CLOSED',
      specializations: embassy.specializations || [],
      establishedAt: embassy.establishedAt,
      lastMaintenance: embassy.lastMaintenance,
      nextMaintenance: embassy.nextMaintenance,
      availableMissions: availableMissions?.filter((m: any) => m.embassyId === embassy.id) || [],
      availableUpgrades: availableUpgrades?.filter((u: any) => u && u.embassyId === embassy.id) || []
    }));
  }, [embassyData, availableMissions, availableUpgrades]);

  // Filter and sort relations
  const filteredRelations = useMemo(() => {
    let filtered = diplomaticRelations;

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(relation => relation.relationType === filterType);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(relation => 
        relation.countryName.toLowerCase().includes(query) ||
        relation.relationType.toLowerCase().includes(query)
      );
    }

    // Sort by priority and strength
    return filtered.sort((a, b) => {
      const aPriority = RELATION_TYPES[a.relationType]?.priority || 0;
      const bPriority = RELATION_TYPES[b.relationType]?.priority || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      return b.strength - a.strength; // Higher strength first
    });
  }, [diplomaticRelations, filterType, searchQuery]);

  // Calculate network positions for visualization
  const networkPositions = useMemo(() => {
    const positions: Array<{ relation: DiplomaticRelation; x: number; y: number; angle: number }> = [];
    const centerX = 200;
    const centerY = 200;
    const baseRadius = 120;
    
    filteredRelations.forEach((relation, index) => {
      // Calculate position based on relation type and strength
      const typeConfig = RELATION_TYPES[relation.relationType] || { priority: 0 };
      const radius = baseRadius + ((relation.strength || 0) / 100) * 40; // Stronger relations further out
      const angleStep = filteredRelations.length > 0 ? (Math.PI * 2) / filteredRelations.length : 0;
      const angle = angleStep * index - Math.PI / 2; // Start from top
      
      // Add some variation based on relation type
      const typeOffset = (typeConfig?.priority || 0) * 10;
      const finalRadius = radius + (Math.sin(angle * 3) * typeOffset);
      
      // Ensure coordinates are valid numbers
      const x = isFinite(finalRadius) && isFinite(angle) 
        ? centerX + Math.cos(angle) * finalRadius 
        : centerX;
      const y = isFinite(finalRadius) && isFinite(angle) 
        ? centerY + Math.sin(angle) * finalRadius 
        : centerY;
      
      positions.push({ relation: relation as DiplomaticRelation, x, y, angle });
    });
    
    return positions;
  }, [filteredRelations]);

  const handleRelationClick = useCallback((relation: DiplomaticRelation) => {
    setSelectedRelation(relation);
    onRelationClick?.(relation);
  }, [onRelationClick]);

  return (
    <div className="embassy-network-visualization space-y-6">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-[--intel-gold] flex items-center gap-3">
            <RiBuildingLine className="h-6 w-6" />
            Embassy Network
            <span className="text-sm font-normal text-[--intel-silver] ml-2">
              ({filteredRelations.length} active relations)
            </span>
            {isLoading && (
              <div className="w-4 h-4 border-2 border-[--intel-gold]/20 border-t-[--intel-gold] rounded-full animate-spin" />
            )}
          </h3>
          <p className="text-[--intel-silver] text-sm mt-1">
            Interactive diplomatic relationship visualization for {primaryCountry.name}
            {error && <span className="text-red-400 ml-2">(Using fallback data)</span>}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode('network')}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                viewMode === 'network' 
                  ? "bg-[--intel-gold]/20 text-[--intel-gold]" 
                  : "text-[--intel-silver] hover:text-foreground"
              )}
            >
              Network
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                viewMode === 'list' 
                  ? "bg-[--intel-gold]/20 text-[--intel-gold]" 
                  : "text-[--intel-silver] hover:text-foreground"
              )}
            >
              List
            </button>
            {viewerClearanceLevel !== 'PUBLIC' && (
              <button
                onClick={() => setViewMode('game')}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                  viewMode === 'game' 
                    ? "bg-[--intel-gold]/20 text-[--intel-gold]" 
                    : "text-[--intel-silver] hover:text-foreground"
                )}
              >
                <RiTrophyLine className="h-4 w-4" />
                Game
                {embassyLoading && (
                  <div className="w-3 h-3 border border-[--intel-gold]/20 border-t-[--intel-gold] rounded-full animate-spin" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-[--intel-gold]/20">
        <div className="flex-1 relative">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--intel-silver]" />
          <input
            type="text"
            placeholder="Search diplomatic relations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg text-foreground placeholder:text-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <RiFilterLine className="h-4 w-4 text-[--intel-silver]" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-[--intel-gold]/50"
          >
            <option value="all">All Relations</option>
            <option value="alliance">Alliances</option>
            <option value="trade">Trade Partners</option>
            <option value="neutral">Neutral</option>
            <option value="tension">Tensions</option>
          </select>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main View Area */}
        <div className={cn(
          viewMode === 'game' ? "col-span-full" : "xl:col-span-2"
        )}>
          <div className="glass-hierarchy-child rounded-lg p-6" style={{ minHeight: viewMode === 'game' ? '600px' : '500px' }}>
            {viewMode === 'game' ? (
              /* Embassy Game Management View */
              <div className="space-y-6">
                {/* Game Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h4 className="text-xl font-bold text-[--intel-gold] flex items-center gap-2">
                      <RiTrophyLine className="h-6 w-6" />
                      Embassy Management System
                    </h4>
                    {embassyLoading && (
                      <div className="w-5 h-5 border-2 border-[--intel-gold]/20 border-t-[--intel-gold] rounded-full animate-spin" />
                    )}
                  </div>
                  
                  {/* Game Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <RiBuildingLine className="h-4 w-4 text-[--intel-gold]" />
                      <span className="text-foreground font-medium">{embassies.length}</span>
                      <span className="text-[--intel-silver]">Embassies</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiCoinLine className="h-4 w-4 text-yellow-400" />
                      <span className="text-foreground font-medium">
                        {embassies.reduce((sum: number, e: Embassy) => sum + e.budget, 0).toLocaleString()}
                      </span>
                      <span className="text-[--intel-silver]">Budget</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiBarChartLine className="h-4 w-4 text-blue-400" />
                      <span className="text-foreground font-medium">
                        {embassies.reduce((sum: number, e: Embassy) => sum + e.influence, 0).toLocaleString()}
                      </span>
                      <span className="text-[--intel-silver]">Influence</span>
                    </div>
                  </div>
                </div>

                {/* Game Tabs */}
                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 w-fit">
                  {[
                    { id: 'overview', label: 'Overview', icon: RiEyeLine },
                    { id: 'missions', label: 'Missions', icon: RiPlayLine },
                    { id: 'upgrades', label: 'Upgrades', icon: RiUploadLine },
                    { id: 'economics', label: 'Economics', icon: RiCoinLine }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                        activeTab === tab.id
                          ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                          : "text-[--intel-silver] hover:text-foreground"
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Game Content */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {embassies.length === 0 ? (
                      <div className="text-center py-12">
                        <RiBuildingLine className="h-16 w-16 mx-auto mb-4 text-[--intel-silver] opacity-50" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">No Embassies Yet</h3>
                        <p className="text-[--intel-silver] mb-6">Establish your first embassy to begin diplomatic expansion</p>
                        <button
                          onClick={() => setShowEstablishEmbassy(true)}
                          className="inline-flex items-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                          <RiAddLine className="h-5 w-5" />
                          Establish First Embassy
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {embassies.map((embassy: Embassy) => (
                          <EmbassyGameCard
                            key={embassy.id}
                            embassy={embassy}
                            onSelect={setSelectedEmbassy}
                            onStartMission={(missionId: string) => {
                              startMissionMutation.mutate({ missionType: 'trade_negotiation', staffAssigned: 1 } as any);
                            }}
                            onUpgrade={(upgradeId: string) => {
                              upgradeEmbassyMutation.mutate({ upgradeType: 'staff_expansion', level: 1 } as any);
                            }}
                          />
                        ))}
                        
                        {/* Add New Embassy Card */}
                        <div
                          onClick={() => setShowEstablishEmbassy(true)}
                          className="glass-hierarchy-interactive rounded-lg p-6 cursor-pointer border-2 border-dashed border-[--intel-gold]/30 hover:border-[--intel-gold]/50 transition-colors group"
                        >
                          <div className="text-center py-8">
                            <RiAddLine className="h-12 w-12 mx-auto mb-4 text-[--intel-gold] group-hover:scale-110 transition-transform" />
                            <h4 className="font-semibold text-[--intel-gold] mb-2">Establish Embassy</h4>
                            <p className="text-[--intel-silver] text-sm">Expand your diplomatic network</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'missions' && (
                  <MissionsPanel
                    embassies={embassies}
                    onStartMission={(embassyId: string, missionId: string) => {
                      startMissionMutation.mutate({ missionType: 'trade_negotiation', staffAssigned: 1 } as any);
                    }}
                    onCompleteMission={(embassyId: string, missionId: string) => {
                      completeMissionMutation.mutate({ missionId });
                    }}
                  />
                )}

                {activeTab === 'upgrades' && (
                  <UpgradesPanel
                    embassies={embassies}
                    onUpgrade={(embassyId: string, upgradeId: string) => {
                      upgradeEmbassyMutation.mutate({ upgradeType: 'staff_expansion', level: 1 } as any);
                    }}
                  />
                )}

                {activeTab === 'economics' && (
                  <EconomicsPanel
                    embassies={embassies}
                    onPayMaintenance={(embassyId) => {
                      payMaintenanceMutation.mutate({ embassyId });
                    }}
                  />
                )}
              </div>
            ) : viewMode === 'network' ? (
              /* Network Visualization */
              <div className="relative w-full h-[400px] overflow-hidden">
                <svg
                  width="400"
                  height="400"
                  className="w-full h-full"
                  viewBox="0 0 400 400"
                >
                  {/* Connection Lines */}
                  {networkPositions.map(({ relation, x, y }) => (
                    <line
                      key={`line-${relation.id}`}
                      x1="200"
                      y1="200"
                      x2={isNaN(x) ? 200 : x}
                      y2={isNaN(y) ? 200 : y}
                      stroke={`rgba(212, 175, 55, ${0.2 + ((relation.strength || 0) / 100) * 0.3})`}
                      strokeWidth={1 + ((relation.strength || 0) / 100) * 2}
                      strokeDasharray={relation.relationType === 'tension' ? '5,5' : 'none'}
                      className="transition-all duration-300"
                    />
                  ))}
                  
                  {/* Central Country Node */}
                  <circle
                    cx="200"
                    cy="200"
                    r="30"
                    fill="rgba(212, 175, 55, 0.3)"
                    stroke="rgba(212, 175, 55, 0.8)"
                    strokeWidth="2"
                    className="cursor-pointer"
                  />
                  <text
                    x="200"
                    y="205"
                    textAnchor="middle"
                    fontSize="12"
                    fill="white"
                    className="font-semibold pointer-events-none"
                  >
                    {primaryCountry.name.length > 10 
                      ? primaryCountry.name.substring(0, 8) + '...' 
                      : primaryCountry.name}
                  </text>
                  
                  {/* Relation Nodes */}
                  {networkPositions.map(({ relation, x, y }) => {
                    const typeConfig = RELATION_TYPES[relation.relationType] || { priority: 0 };
                    const isSelected = selectedRelation?.id === relation.id;
                    
                    return (
                      <g key={relation.id}>
                        <circle
                          cx={isNaN(x) ? 200 : x}
                          cy={isNaN(y) ? 200 : y}
                          r={isSelected ? 25 : 15 + ((relation.strength || 0) / 100) * 5}
                          fill={(typeConfig.bgColor || 'bg-white/20').replace('bg-', 'rgba(').replace('/20', ', 0.2)')}
                          stroke={(typeConfig.color || 'text-white').replace('text-', 'rgba(').replace('400', '400, 1)')}
                          strokeWidth={isSelected ? 3 : 2}
                          className="cursor-pointer transition-all duration-300 hover:opacity-80"
                          onClick={() => handleRelationClick(relation as DiplomaticRelation)}
                        />
                        <text
                          x={isNaN(x) ? 200 : x}
                          y={(isNaN(y) ? 200 : y) + 4}
                          textAnchor="middle"
                          fontSize={isSelected ? "11" : "9"}
                          fill="white"
                          className="font-medium pointer-events-none"
                        >
                          {relation.countryName.length > 8 
                            ? relation.countryName.substring(0, 6) + '..' 
                            : relation.countryName}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                
                {/* Network Legend */}
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg p-3">
                  <h4 className="text-foreground text-sm font-semibold mb-2">Relations</h4>
                  <div className="space-y-1">
                    {Object.entries(RELATION_TYPES).map(([type, config]) => (
                      <div key={type} className="flex items-center gap-2 text-xs">
                        <div className={cn("w-3 h-3 rounded-full", config.bgColor, config.borderColor, "border")} />
                        <span className="text-foreground">{config.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* List View */
              <div className="space-y-3">
                {filteredRelations.map((relation, index) => {
                  const typeConfig = RELATION_TYPES[relation.relationType] || { priority: 0 };
                  const Icon = typeConfig.icon || RiGlobalLine;
                  
                  return (
                    <motion.div
                      key={relation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleRelationClick(relation as DiplomaticRelation)}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer",
                        "bg-white/5 hover:bg-white/10 border-white/10 hover:border-[--intel-gold]/30",
                        selectedRelation?.id === relation.id && "border-[--intel-gold]/50 bg-[--intel-gold]/10"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          typeConfig.bgColor || "bg-white/20", typeConfig.borderColor || "border-white/20", "border"
                        )}>
                          <Icon className={cn("h-5 w-5", typeConfig.color || "text-white")} />
                        </div>
                        
                        <div>
                          <div className="font-semibold text-foreground">{relation.countryName}</div>
                          <div className="flex items-center gap-3 text-sm text-[--intel-silver]">
                            <span className={cn("capitalize", typeConfig.color || "text-white")}>
                              {typeConfig.label || relation.relationType}
                            </span>
                            <span>•</span>
                            <span>Strength: {relation.strength || 0}%</span>
                            {relation.economicTier && (
                              <>
                                <span>•</span>
                                <span>{relation.economicTier}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-[--intel-silver] text-sm">
                          Est. {new Date(relation.establishedAt).getFullYear()}
                        </div>
                        {relation.recentActivity && (
                          <div className="text-[--intel-amber] text-xs mt-1">
                            Recent Activity
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                
                {filteredRelations.length === 0 && (
                  <div className="text-center py-12 text-[--intel-silver]">
                    <RiSearchLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No diplomatic relations found</p>
                    <p className="text-sm mb-4">Try adjusting your search or filter criteria</p>
                    {viewerClearanceLevel !== 'PUBLIC' && onEstablishEmbassy && (
                      <button
                        onClick={() => setShowEstablishEmbassy(true)}
                        className="inline-flex items-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        <RiBuildingLine className="h-4 w-4" />
                        Establish Embassy
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Relation Details Panel - Hidden in game mode */}
        {viewMode !== 'game' && (
          <div className="xl:col-span-1">
            <div className="glass-hierarchy-child rounded-lg p-6 sticky top-6">
              {selectedRelation ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-foreground">Diplomatic Relation</h4>
                  <button
                    onClick={() => setSelectedRelation(null)}
                    className="p-2 text-[--intel-silver] hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <RiCloseLine className="h-4 w-4" />
                  </button>
                </div>

                {/* Country Info */}
                <div className="flex items-center gap-4">
                  {selectedRelation.flagUrl && (
                    <img
                      src={selectedRelation.flagUrl}
                      alt={`${selectedRelation.countryName} flag`}
                      className="w-12 h-8 object-cover rounded border border-white/20"
                    />
                  )}
                  <div>
                    <h5 className="text-xl font-bold text-foreground">{selectedRelation.countryName}</h5>
                    {selectedRelation.economicTier && (
                      <p className="text-[--intel-silver] text-sm">{selectedRelation.economicTier}</p>
                    )}
                  </div>
                </div>

                {/* Relation Details */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {React.createElement(RELATION_TYPES[selectedRelation.relationType]?.icon || RiGlobalLine, {
                        className: cn("h-5 w-5", RELATION_TYPES[selectedRelation.relationType]?.color || "text-white")
                      })}
                      <span className="font-medium text-foreground">
                        {RELATION_TYPES[selectedRelation.relationType]?.label || selectedRelation.relationType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/10 rounded-full h-2">
                        <div
                          className={cn("h-full rounded-full transition-all duration-300", 
                            RELATION_TYPES[selectedRelation.relationType]?.bgColor || "bg-white/20"
                          )}
                          style={{ width: `${selectedRelation.strength}%` }}
                        />
                      </div>
                      <span className="text-sm text-[--intel-silver] min-w-[3rem]">
                        {selectedRelation.strength}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-[--intel-silver]">
                    <RiCalendarLine className="h-4 w-4" />
                    <span>Established: {new Date(selectedRelation.establishedAt).toLocaleDateString()}</span>
                  </div>

                  {selectedRelation.recentActivity && (
                    <div className="p-3 bg-[--intel-amber]/10 rounded-lg border border-[--intel-amber]/20">
                      <div className="flex items-start gap-2">
                        <RiInformationLine className="h-4 w-4 text-[--intel-amber] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[--intel-amber] text-sm font-medium">Recent Activity</p>
                          <p className="text-foreground text-sm mt-1">{selectedRelation.recentActivity}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <button
                    onClick={() => onRelationClick?.(selectedRelation)}
                    className="w-full flex items-center justify-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-3 rounded-lg font-medium transition-colors"
                  >
                    <RiArrowRightLine className="h-4 w-4" />
                    View Country Profile
                  </button>
                  
                  {viewerClearanceLevel !== 'PUBLIC' && (
                    <button 
                      onClick={() => setShowEmbassyDetails(true)}
                      className="w-full flex items-center justify-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-3 rounded-lg font-medium transition-colors"
                    >
                      <RiMapPinLine className="h-4 w-4" />
                      View Embassy Details
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-[--intel-silver]">
                <RiBuildingLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a diplomatic relation</p>
                <p className="text-sm">Click on a country node or list item to view detailed information</p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Embassy Details Modal */}
      <AnimatePresence>
        {showEmbassyDetails && selectedRelation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEmbassyDetails(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-hierarchy-modal rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="glass-hierarchy-child rounded-t-lg p-4 border-b border-[--intel-gold]/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-[--intel-gold] flex items-center gap-2">
                    <RiBuildingLine className="h-6 w-6" />
                    Embassy Details - {selectedRelation.countryName}
                  </h3>
                  <button
                    onClick={() => setShowEmbassyDetails(false)}
                    className="p-2 text-[--intel-silver] hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <RiCloseLine className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-[--intel-silver] text-sm mt-2">
                  Comprehensive embassy operations and diplomatic status
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Embassy Operations */}
                <div className="glass-hierarchy-child rounded-lg p-6">
                  <h4 className="font-semibold text-foreground mb-4">Embassy Operations</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-medium text-foreground mb-2">Embassy Status</h5>
                        <div className="bg-green-500/10 text-green-400 px-3 py-2 rounded-lg text-sm">
                          Active - Full Operations
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="font-medium text-foreground mb-2">Location</h5>
                        <p className="text-muted-foreground text-sm">Diplomatic Quarter, Capital City</p>
                      </div>

                      <div>
                        <h5 className="font-medium text-foreground mb-2">Ambassador</h5>
                        <p className="text-muted-foreground text-sm">Ambassador Sarah Chen</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h5 className="font-medium text-foreground mb-2">Established</h5>
                        <p className="text-muted-foreground text-sm">{new Date(selectedRelation.establishedAt || Date.now()).toLocaleDateString()}</p>
                      </div>

                      <div>
                        <h5 className="font-medium text-foreground mb-2">Staff Count</h5>
                        <p className="text-muted-foreground text-sm">24 diplomatic personnel</p>
                      </div>

                      <div>
                        <h5 className="font-medium text-foreground mb-2">Security Level</h5>
                        <div className="bg-blue-500/10 text-blue-400 px-3 py-2 rounded-lg text-sm">
                          Standard Security Protocol
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Embassy Services */}
                <div className="glass-hierarchy-child rounded-lg p-6">
                  <h4 className="font-semibold text-foreground mb-4">Embassy Services</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Visa Processing', 'Trade Support', 'Consular Services', 'Cultural Exchange', 'Business Relations', 'Emergency Assistance'].map(service => (
                      <div key={service} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-[--intel-gold] rounded-full" />
                        <span className="text-muted-foreground">{service}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Diplomatic Activity */}
                <div className="glass-hierarchy-child rounded-lg p-6">
                  <h4 className="font-semibold text-foreground mb-4">Recent Activity</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-white/5 dark:bg-black/20 rounded-lg">
                      <div className="w-2 h-2 bg-green-400 rounded-full mt-2" />
                      <div>
                        <p className="text-foreground text-sm font-medium">Trade Agreement Renewal</p>
                        <p className="text-muted-foreground text-xs mt-1">3 days ago</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/5 dark:bg-black/20 rounded-lg">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mt-2" />
                      <div>
                        <p className="text-foreground text-sm font-medium">Cultural Exchange Program Planning</p>
                        <p className="text-muted-foreground text-xs mt-1">1 week ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Establish Embassy Modal */}
      <AnimatePresence>
        {showEstablishEmbassy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEstablishEmbassy(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-hierarchy-modal rounded-lg max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="glass-hierarchy-child rounded-t-lg p-4 border-b border-[--intel-gold]/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-[--intel-gold] flex items-center gap-2">
                    <RiAddLine className="h-6 w-6" />
                    Establish Embassy
                  </h3>
                  <button
                    onClick={() => setShowEstablishEmbassy(false)}
                    className="p-2 text-[--intel-silver] hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <RiCloseLine className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-[--intel-silver] text-sm mt-2">
                  Create a new diplomatic post to strengthen international relations
                </p>
              </div>

              <div className="p-6">
                <div className="glass-hierarchy-child rounded-lg p-6 space-y-4">
                  <h4 className="font-semibold text-foreground mb-4">Embassy Details</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Target Country</label>
                    <select className="w-full bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-foreground">
                      <option value="">Select a country...</option>
                      <option value="caphiria">Caphiria</option>
                      <option value="urcea">Urcea</option>
                      <option value="burgundie">Burgundie</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Embassy Location</label>
                    <input
                      type="text"
                      placeholder="e.g., Diplomatic Quarter, Capital City"
                      className="w-full bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Ambassador Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Ambassador John Smith"
                      className="w-full bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowEstablishEmbassy(false)}
                    className="flex-1 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Handle embassy establishment
                      onEstablishEmbassy?.('selected-country-id');
                      setShowEstablishEmbassy(false);
                    }}
                    className="flex-1 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Establish Embassy
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Embassy Game Components
const EmbassyGameCard: React.FC<{
  embassy: Embassy;
  onSelect: (embassy: Embassy) => void;
  onStartMission: (missionId: string) => void;
  onUpgrade: (upgradeId: string) => void;
}> = ({ embassy, onSelect, onStartMission, onUpgrade }) => {
  const levelProgress = (embassy.experience % 1000) / 1000; // Each level = 1000 XP
  const statusColor = {
    ACTIVE: 'text-green-400',
    MAINTENANCE: 'text-yellow-400',
    SUSPENDED: 'text-red-400',
    CLOSED: 'text-gray-400'
  }[embassy.status];

  const securityColor = {
    LOW: 'text-gray-400',
    MEDIUM: 'text-yellow-400',
    HIGH: 'text-orange-400',
    MAXIMUM: 'text-red-400'
  }[embassy.securityLevel];

  return (
    <div
      onClick={() => onSelect(embassy)}
      className="glass-hierarchy-interactive rounded-lg p-4 cursor-pointer group hover:scale-[1.02] transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-bold text-foreground text-lg">{embassy.targetCountryName}</h4>
          <p className="text-[--intel-silver] text-sm">{embassy.location}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 mb-1">
            {[...Array(5)].map((_, i) => (
              <RiStarFill
                key={i}
                className={cn(
                  "h-3 w-3",
                  i < embassy.level ? "text-[--intel-gold]" : "text-gray-600"
                )}
              />
            ))}
            <span className="text-[--intel-gold] text-sm ml-1">L{embassy.level}</span>
          </div>
          <div className={cn("text-xs", statusColor)}>{embassy.status}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-blue-400 font-bold text-sm">{embassy.influence.toLocaleString()}</div>
          <div className="text-[--intel-silver] text-xs">Influence</div>
        </div>
        <div className="text-center">
          <div className="text-yellow-400 font-bold text-sm">₫{embassy.budget.toLocaleString()}</div>
          <div className="text-[--intel-silver] text-xs">Budget</div>
        </div>
        <div className="text-center">
          <div className="text-[--intel-silver] font-bold text-sm">{embassy.staffCount}</div>
          <div className="text-[--intel-silver] text-xs">Staff</div>
        </div>
      </div>

      {/* Level Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-[--intel-silver]">Level {embassy.level} Progress</span>
          <span className="text-[--intel-gold]">{embassy.experience} XP</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div
            className="bg-[--intel-gold] h-2 rounded-full transition-all duration-300"
            style={{ width: `${levelProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <RiLockLine className={cn("h-3 w-3", securityColor)} />
          <span className="text-[--intel-silver]">{embassy.securityLevel}</span>
        </div>
        
        {embassy.availableMissions && embassy.availableMissions.length > 0 && (
          <div className="flex items-center gap-1 text-green-400">
            <RiPlayLine className="h-3 w-3" />
            <span>{embassy.availableMissions.length} missions</span>
          </div>
        )}
        
        {embassy.availableUpgrades && embassy.availableUpgrades.length > 0 && (
          <div className="flex items-center gap-1 text-blue-400">
            <RiUploadLine className="h-3 w-3" />
            <span>{embassy.availableUpgrades.length} upgrades</span>
          </div>
        )}
      </div>
    </div>
  );
};

const MissionsPanel: React.FC<{
  embassies: Embassy[];
  onStartMission: (embassyId: string, missionId: string) => void;
  onCompleteMission: (embassyId: string, missionId: string) => void;
}> = ({ embassies, onStartMission, onCompleteMission }) => {
  const [selectedMissionType, setSelectedMissionType] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const allMissions = embassies.flatMap(embassy => 
    (embassy.availableMissions || []).map(mission => ({
      ...mission,
      embassyId: embassy.id,
      embassyName: embassy.targetCountryName,
      embassyLevel: embassy.level,
      progress: mission.status === 'IN_PROGRESS' ? calculateMissionProgress(mission) : 0,
      timeRemaining: mission.status === 'IN_PROGRESS' && mission.startedAt ? 
        calculateTimeRemaining(mission.startedAt, mission.duration) : null
    }))
  );

  // Filter missions
  const filteredMissions = allMissions.filter(mission => {
    if (selectedMissionType !== 'all' && mission.type !== selectedMissionType) return false;
    if (selectedDifficulty !== 'all' && mission.difficulty !== selectedDifficulty) return false;
    return true;
  });

  // Group missions by status
  const missionsByStatus = {
    available: filteredMissions.filter(m => m.status === 'AVAILABLE'),
    inProgress: filteredMissions.filter(m => m.status === 'IN_PROGRESS'),
    completed: filteredMissions.filter(m => m.status === 'COMPLETED'),
    failed: filteredMissions.filter(m => m.status === 'FAILED')
  };

  const difficultyColor = {
    EASY: 'text-green-400',
    MEDIUM: 'text-yellow-400',  
    HARD: 'text-orange-400',
    EXPERT: 'text-red-400'
  };

  const missionTypeColor = {
    TRADE_NEGOTIATION: 'text-yellow-400',
    CULTURAL_EXCHANGE: 'text-purple-400',
    INTELLIGENCE_GATHERING: 'text-red-400',
    CRISIS_MANAGEMENT: 'text-orange-400',
    ECONOMIC_COOPERATION: 'text-green-400'
  };

  return (
    <div className="space-y-6">
      {/* Mission Filters and Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={selectedMissionType}
            onChange={(e) => setSelectedMissionType(e.target.value)}
            className="bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-foreground text-sm"
          >
            <option value="all">All Types</option>
            <option value="TRADE_NEGOTIATION">Trade Negotiation</option>
            <option value="CULTURAL_EXCHANGE">Cultural Exchange</option>
            <option value="INTELLIGENCE_GATHERING">Intelligence Gathering</option>
            <option value="CRISIS_MANAGEMENT">Crisis Management</option>
            <option value="ECONOMIC_COOPERATION">Economic Cooperation</option>
          </select>
          
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-foreground text-sm"
          >
            <option value="all">All Difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
            <option value="EXPERT">Expert</option>
          </select>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-[--intel-silver]">Available: {missionsByStatus.available.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full" />
            <span className="text-[--intel-silver]">Active: {missionsByStatus.inProgress.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[--intel-gold] rounded-full" />
            <span className="text-[--intel-silver]">Completed: {missionsByStatus.completed.length}</span>
          </div>
        </div>
      </div>

      {/* Mission Tabs */}
      <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 w-fit">
        {[
          { id: 'available', label: `Available (${missionsByStatus.available.length})`, icon: RiPlayLine },
          { id: 'active', label: `Active (${missionsByStatus.inProgress.length})`, icon: RiTimeLine },
          { id: 'completed', label: `Completed (${missionsByStatus.completed.length})`, icon: RiTrophyLine }
        ].map(tab => (
          <button
            key={tab.id}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 text-[--intel-silver] hover:text-foreground"
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mission Content */}
      {filteredMissions.length === 0 ? (
        <div className="text-center py-12 text-[--intel-silver]">
          <RiPlayLine className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Missions Available</h3>
          <p>Check back later or upgrade your embassies to unlock new missions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMissions.map(mission => (
            <div key={mission.id} className="glass-hierarchy-child rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">{mission.title}</h4>
                    <div className={cn("text-xs font-medium px-2 py-1 rounded", missionTypeColor[mission.type])}>
                      {mission.type.replace('_', ' ')}
                    </div>
                  </div>
                  <p className="text-[--intel-silver] text-sm">{mission.embassyName} • Level {mission.embassyLevel}</p>
                </div>
                <div className={cn("text-xs font-medium px-2 py-1 rounded", difficultyColor[mission.difficulty])}>
                  {mission.difficulty}
                </div>
              </div>
              
              <p className="text-[--intel-silver] text-sm mb-4">{mission.description}</p>
              
              {/* Mission Progress (for active missions) */}
              {mission.status === 'IN_PROGRESS' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-[--intel-silver]">Progress</span>
                    <span className="text-[--intel-gold]">{Math.round(mission.progress)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                    <div
                      className="bg-[--intel-gold] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${mission.progress}%` }}
                    />
                  </div>
                  {mission.timeRemaining && (
                    <div className="flex items-center gap-2 text-xs text-[--intel-silver]">
                      <RiTimeLine className="h-3 w-3" />
                      <span>{mission.timeRemaining} remaining</span>
                    </div>
                  )}
                </div>
              )}

              {/* Mission Rewards and Stats */}
              <div className="flex items-center justify-between text-xs mb-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <RiTrophyLine className="h-3 w-3 text-[--intel-gold]" />
                    {mission.experienceReward} XP
                  </span>
                  <span className="flex items-center gap-1">
                    <RiBarChartLine className="h-3 w-3 text-blue-400" />
                    {mission.influenceReward} Influence
                  </span>
                  <span className="flex items-center gap-1">
                    <RiCoinLine className="h-3 w-3 text-yellow-400" />
                    ₫{mission.budgetCost.toLocaleString()}
                  </span>
                </div>
                <div className="text-[--intel-silver]">
                  {mission.duration}h • {mission.successChance}% success
                </div>
              </div>

              {/* Mission Actions */}
              {mission.status === 'AVAILABLE' && (
                <button
                  onClick={() => onStartMission(mission.embassyId, mission.id)}
                  className="w-full px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400"
                >
                  <RiPlayLine className="h-4 w-4" />
                  Start Mission
                </button>
              )}

              {mission.status === 'IN_PROGRESS' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onCompleteMission(mission.embassyId, mission.id)}
                    disabled={mission.progress < 100}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                      mission.progress >= 100
                        ? "bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold]"
                        : "bg-gray-500/20 text-gray-400 cursor-not-allowed"
                    )}
                  >
                    <RiTrophyLine className="h-4 w-4" />
                    {mission.progress >= 100 ? 'Complete Mission' : 'In Progress'}
                  </button>
                  <button className="px-3 py-2 rounded-lg font-medium transition-colors bg-red-500/20 hover:bg-red-500/30 text-red-400">
                    <RiPauseLine className="h-4 w-4" />
                  </button>
                </div>
              )}

              {mission.status === 'COMPLETED' && (
                <div className="flex items-center justify-center py-2 text-[--intel-gold] text-sm font-medium">
                  <RiTrophyLine className="h-4 w-4 mr-2" />
                  Mission Completed
                </div>
              )}

              {mission.status === 'FAILED' && (
                <div className="flex items-center justify-center py-2 text-red-400 text-sm font-medium">
                  <RiCloseLine className="h-4 w-4 mr-2" />
                  Mission Failed
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const UpgradesPanel: React.FC<{
  embassies: Embassy[];
  onUpgrade: (embassyId: string, upgradeId: string) => void;
}> = ({ embassies, onUpgrade }) => {
  const allUpgrades = embassies.flatMap(embassy => 
    (embassy.availableUpgrades || []).map(upgrade => ({
      ...upgrade,
      embassyId: embassy.id,
      embassyName: embassy.targetCountryName
    }))
  );

  const upgradeTypeColor = {
    SECURITY: 'text-red-400',
    STAFF: 'text-blue-400',
    FACILITIES: 'text-green-400',
    TECHNOLOGY: 'text-purple-400',
    SPECIALIZATION: 'text-[--intel-gold]'
  };

  return (
    <div className="space-y-4">
      {allUpgrades.length === 0 ? (
        <div className="text-center py-12 text-[--intel-silver]">
          <RiUploadLine className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Upgrades Available</h3>
          <p>Level up your embassies to unlock more upgrade options</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allUpgrades.map(upgrade => (
            <div key={upgrade.id} className="glass-hierarchy-child rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-foreground">{upgrade.name}</h4>
                  <p className="text-[--intel-silver] text-sm">{upgrade.embassyName}</p>
                </div>
                <div className={cn("text-xs font-medium", upgradeTypeColor[upgrade.type])}>
                  {upgrade.type}
                </div>
              </div>
              
              <p className="text-[--intel-silver] text-sm mb-4">{upgrade.description}</p>
              
              <div className="space-y-2 mb-4">
                {Object.entries(upgrade.effects).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-[--intel-silver] capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="text-green-400">+{value}{typeof value === 'number' && value < 1 ? '%' : ''}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-4 text-xs">
                <span className="text-yellow-400 font-medium">₫{upgrade.cost.toLocaleString()}</span>
                <span className="text-[--intel-silver]">Level {upgrade.requiredLevel}+ required</span>
              </div>

              <button
                onClick={() => onUpgrade(upgrade.embassyId, upgrade.id)}
                disabled={upgrade.isActive}
                className={cn(
                  "w-full px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                  !upgrade.isActive
                    ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
                    : "bg-green-500/20 text-green-400 cursor-not-allowed"
                )}
              >
                <RiUploadLine className="h-4 w-4" />
                {upgrade.isActive ? 'Installed' : 'Purchase Upgrade'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EconomicsPanel: React.FC<{
  embassies: Embassy[];
  onPayMaintenance: (embassyId: string) => void;
}> = ({ embassies, onPayMaintenance }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [budgetView, setBudgetView] = useState<'current' | 'projected' | 'optimization'>('current');
  const totalBudget = embassies.reduce((sum, e) => sum + e.budget, 0);
  const totalMaintenance = embassies.reduce((sum, e) => sum + e.maintenanceCost, 0);
  const netIncome = totalBudget - totalMaintenance;
  
  // Calculate timeframe multipliers
  const timeframeMultiplier = { monthly: 1, quarterly: 3, annual: 12 }[selectedTimeframe];
  const projectedMaintenance = totalMaintenance * timeframeMultiplier;
  const projectedIncome = netIncome * timeframeMultiplier;
  
  // Calculate efficiency metrics
  const averageEfficiency = embassies.length > 0 ? 
    embassies.reduce((sum, e) => sum + ((e.influence || 0) / Math.max(e.budget, 1)), 0) / embassies.length : 0;
  
  // Identify optimization opportunities
  const inefficientEmbassies = embassies.filter(e => 
    (e.influence || 0) / Math.max(e.budget, 1) < averageEfficiency * 0.7
  );
  
  const overbudgetEmbassies = embassies.filter(e => 
    e.budget < e.maintenanceCost * 3 // Less than 3 months of maintenance
  );

  return (
    <div className="space-y-6">
      {/* Economics Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value as typeof selectedTimeframe)}
            className="bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-foreground text-sm"
          >
            <option value="monthly">Monthly View</option>
            <option value="quarterly">Quarterly View</option>
            <option value="annual">Annual View</option>
          </select>
          
          <select
            value={budgetView}
            onChange={(e) => setBudgetView(e.target.value as typeof budgetView)}
            className="bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-foreground text-sm"
          >
            <option value="current">Current Status</option>
            <option value="projected">Projections</option>
            <option value="optimization">Optimization</option>
          </select>
        </div>
        
        <div className="text-sm text-[--intel-silver]">
          {embassies.length} embassies • {selectedTimeframe} forecast
        </div>
      </div>

      {budgetView === 'optimization' && (inefficientEmbassies.length > 0 || overbudgetEmbassies.length > 0) && (
        <div className="glass-hierarchy-child rounded-lg p-4 border-l-4 border-yellow-400">
          <div className="flex items-center gap-2 mb-3">
            <RiFireLine className="h-5 w-5 text-yellow-400" />
            <h3 className="font-semibold text-foreground">Optimization Opportunities</h3>
          </div>
          
          <div className="space-y-3 text-sm">
            {inefficientEmbassies.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-2">Low Efficiency Embassies ({inefficientEmbassies.length})</h4>
                <div className="space-y-1">
                  {inefficientEmbassies.slice(0, 3).map(embassy => (
                    <div key={embassy.id} className="flex items-center justify-between text-[--intel-silver]">
                      <span>{embassy.targetCountryName}</span>
                      <span className="text-yellow-400">
                        {((embassy.influence || 0) / Math.max(embassy.budget, 1) * 100).toFixed(1)}% efficiency
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {overbudgetEmbassies.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-2">Budget Concerns ({overbudgetEmbassies.length})</h4>
                <div className="space-y-1">
                  {overbudgetEmbassies.slice(0, 3).map(embassy => (
                    <div key={embassy.id} className="flex items-center justify-between text-[--intel-silver]">
                      <span>{embassy.targetCountryName}</span>
                      <span className="text-red-400">
                        {Math.floor(embassy.budget / embassy.maintenanceCost)} months remaining
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <RiCoinLine className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
          <div className="text-2xl font-bold text-yellow-400">₫{totalBudget.toLocaleString()}</div>
          <div className="text-[--intel-silver] text-sm">Total Budget</div>
        </div>
        
        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <RiRefreshLine className="h-8 w-8 mx-auto mb-2 text-red-400" />
          <div className="text-2xl font-bold text-red-400">₫{(budgetView === 'projected' ? projectedMaintenance : totalMaintenance).toLocaleString()}</div>
          <div className="text-[--intel-silver] text-sm">
            {budgetView === 'projected' ? `${selectedTimeframe} Maintenance` : 'Monthly Maintenance'}
          </div>
        </div>
        
        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <RiBarChartLine className={cn("h-8 w-8 mx-auto mb-2", (budgetView === 'projected' ? projectedIncome : netIncome) >= 0 ? "text-green-400" : "text-red-400")} />
          <div className={cn("text-2xl font-bold", (budgetView === 'projected' ? projectedIncome : netIncome) >= 0 ? "text-green-400" : "text-red-400")}>
            ₫{(budgetView === 'projected' ? projectedIncome : netIncome).toLocaleString()}
          </div>
          <div className="text-[--intel-silver] text-sm">
            {budgetView === 'projected' ? `${selectedTimeframe} Net` : 'Monthly Net'}
          </div>
        </div>
        
        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <RiFireLine className="h-8 w-8 mx-auto mb-2 text-blue-400" />
          <div className="text-2xl font-bold text-blue-400">{(averageEfficiency * 100).toFixed(1)}%</div>
          <div className="text-[--intel-silver] text-sm">Avg Efficiency</div>
        </div>
      </div>

      {/* Embassy Financial Details */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-foreground">Embassy Resource Management</h4>
          <div className="text-sm text-[--intel-silver]">
            Sorted by {budgetView === 'optimization' ? 'optimization priority' : 'budget size'}
          </div>
        </div>
        {embassies
          .sort((a, b) => {
            if (budgetView === 'optimization') {
              // Sort by efficiency (influence per budget unit)
              const efficiencyA = (a.influence || 0) / Math.max(a.budget, 1);
              const efficiencyB = (b.influence || 0) / Math.max(b.budget, 1);
              return efficiencyA - efficiencyB; // Lowest efficiency first for optimization
            }
            return b.budget - a.budget; // Highest budget first
          })
          .map(embassy => {
          const maintenanceDue = embassy.nextMaintenance && new Date(embassy.nextMaintenance) < new Date();
          const monthsRemaining = Math.floor(embassy.budget / embassy.maintenanceCost);
          const efficiency = (embassy.influence || 0) / Math.max(embassy.budget, 1) * 100;
          const isInefficient = efficiency < averageEfficiency * 70; // Below 70% of average
          
          return (
            <div key={embassy.id} className={cn(
              "glass-hierarchy-child rounded-lg p-4",
              budgetView === 'optimization' && isInefficient && "border-l-4 border-yellow-400"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-medium text-foreground">{embassy.targetCountryName}</h5>
                    {budgetView === 'optimization' && (
                      <div className={cn(
                        "text-xs px-2 py-1 rounded",
                        efficiency >= averageEfficiency * 100 ? "bg-green-500/20 text-green-400" :
                        efficiency >= averageEfficiency * 70 ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-red-500/20 text-red-400"
                      )}>
                        {efficiency.toFixed(1)}% efficiency
                      </div>
                    )}
                  </div>
                  <p className="text-[--intel-silver] text-sm">Level {embassy.level} • {embassy.specializations?.join(', ') || 'General Purpose'}</p>
                </div>
                {maintenanceDue && (
                  <div className="text-red-400 text-sm font-medium">Maintenance Due</div>
                )}
              </div>
              
              {/* Resource Allocation Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-[--intel-silver]">Resource Allocation</span>
                  <span className="text-foreground">{monthsRemaining} months remaining</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      monthsRemaining >= 6 ? "bg-green-400" :
                      monthsRemaining >= 3 ? "bg-yellow-400" :
                      "bg-red-400"
                    )}
                    style={{ width: `${Math.min(monthsRemaining / 12 * 100, 100)}%` }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <div>
                  <div className="text-[--intel-silver]">Budget</div>
                  <div className="text-yellow-400 font-medium">₫{embassy.budget.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[--intel-silver]">Monthly Cost</div>
                  <div className="text-red-400 font-medium">₫{embassy.maintenanceCost.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[--intel-silver]">Staff</div>
                  <div className="text-foreground font-medium">{embassy.staffCount}</div>
                </div>
                <div>
                  <div className="text-[--intel-silver]">Influence</div>
                  <div className="text-blue-400 font-medium">{(embassy.influence || 0).toLocaleString()}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {maintenanceDue && (
                  <button
                    onClick={() => onPayMaintenance(embassy.id)}
                    className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <RiCoinLine className="h-4 w-4" />
                    Pay Maintenance
                  </button>
                )}
                
                {budgetView === 'optimization' && isInefficient && (
                  <button className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                    <RiFireLine className="h-4 w-4" />
                    Optimize
                  </button>
                )}
                
                {monthsRemaining < 3 && (
                  <button className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                    <RiUploadLine className="h-4 w-4" />
                    Allocate Budget
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Helper functions for mission progress and time calculations
function calculateMissionProgress(mission: EmbassyMission): number {
  if (!mission.startedAt) return 0;
  
  const startTime = new Date(mission.startedAt).getTime();
  const now = new Date().getTime();
  const durationMs = mission.duration * 60 * 60 * 1000; // Convert hours to milliseconds
  
  const elapsed = now - startTime;
  const progress = Math.min((elapsed / durationMs) * 100, 100);
  
  return Math.max(0, progress);
}

function calculateTimeRemaining(startedAt: string, duration: number): string {
  const startTime = new Date(startedAt).getTime();
  const now = new Date().getTime();
  const durationMs = duration * 60 * 60 * 1000; // Convert hours to milliseconds
  const endTime = startTime + durationMs;
  
  const remaining = endTime - now;
  
  if (remaining <= 0) return "Ready to complete";
  
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

EmbassyNetworkVisualizationComponent.displayName = 'EmbassyNetworkVisualization';

export const EmbassyNetworkVisualization = React.memo(EmbassyNetworkVisualizationComponent);