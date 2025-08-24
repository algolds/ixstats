"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { IxTime } from "~/lib/ixtime";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { 
  RiGlobalLine,
  RiStarLine,
  RiBookLine,
  RiPaletteLine,
  RiBuildingLine,
  RiCameraLine,
  RiMusicLine,
  RiGamepadLine,
  RiPlaneLine,
  RiRestaurantLine,
  RiUserLine,
  RiGroupLine,
  RiTrophyLine,
  RiHeartLine,
  RiEyeLine,
  RiShareLine,
  RiAddLine,
  RiCloseLine,
  RiArrowRightLine,
  RiCalendarLine,
  RiMapPinLine,
  RiTimeLine,
  RiCheckLine,
  RiMoreLine,
  RiFireLine,
  RiThumbUpLine,
  RiChat3Line
} from "react-icons/ri";

interface CulturalExchange {
  id: string;
  title: string;
  type: 'festival' | 'exhibition' | 'education' | 'cuisine' | 'arts' | 'sports' | 'technology' | 'diplomacy';
  description: string;
  hostCountry: {
    id: string;
    name: string;
    flagUrl?: string;
  };
  participatingCountries: Array<{
    id: string;
    name: string;
    flagUrl?: string;
    role: 'co-host' | 'participant' | 'observer';
  }>;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string;
  ixTimeContext: number;
  metrics: {
    participants: number;
    culturalImpact: number; // 0-100 score
    diplomaticValue: number; // 0-100 score
    socialEngagement: number;
  };
  achievements: string[];
  culturalArtifacts: Array<{
    id: string;
    type: 'photo' | 'video' | 'document' | 'artwork' | 'recipe' | 'music';
    title: string;
    thumbnailUrl?: string;
    contributor: string;
    countryId: string;
  }>;
  diplomaticOutcomes?: {
    newPartnerships: number;
    tradeAgreements: number;
    futureCollaborations: string[];
  };
}

interface CulturalExchangeProgramProps {
  primaryCountry: {
    id: string;
    name: string;
    flagUrl?: string;
    economicTier?: string;
  };
  exchanges: CulturalExchange[];
  onCreateExchange?: (exchangeData: Partial<CulturalExchange>) => void;
  onJoinExchange?: (exchangeId: string, role: 'participant' | 'observer') => void;
  onViewArtifact?: (artifactId: string) => void;
  viewerClearanceLevel?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
}

// Cultural exchange type configurations
const EXCHANGE_TYPES = {
  festival: {
    icon: RiStarLine,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/40',
    label: 'Cultural Festival',
    description: 'Celebration of traditions and customs'
  },
  exhibition: {
    icon: RiBuildingLine,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/40',
    label: 'Cultural Exhibition',
    description: 'Showcase of cultural heritage and artifacts'
  },
  education: {
    icon: RiBookLine,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/40',
    label: 'Educational Exchange',
    description: 'Knowledge sharing and academic collaboration'
  },
  cuisine: {
    icon: RiRestaurantLine,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/40',
    label: 'Culinary Exchange',
    description: 'Food culture and culinary traditions'
  },
  arts: {
    icon: RiPaletteLine,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500/40',
    label: 'Arts Exchange',
    description: 'Visual arts and creative expression'
  },
  sports: {
    icon: RiTrophyLine,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/40',
    label: 'Sports Exchange',
    description: 'Athletic competition and physical culture'
  },
  technology: {
    icon: RiGamepadLine,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/40',
    label: 'Tech Exchange',
    description: 'Innovation and technological collaboration'
  },
  diplomacy: {
    icon: RiGlobalLine,
    color: 'text-[--intel-gold]',
    bgColor: 'bg-[--intel-gold]/20',
    borderColor: 'border-[--intel-gold]/40',
    label: 'Diplomatic Summit',
    description: 'High-level diplomatic and cultural dialogue'
  }
} as const;

// Exchange status configurations
const STATUS_STYLES = {
  planning: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: '⏳', label: 'Planning' },
  active: { color: 'text-green-400', bg: 'bg-green-500/20', icon: '🔴', label: 'Live' },
  completed: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: '✓', label: 'Completed' },
  cancelled: { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: '✗', label: 'Cancelled' }
} as const;

const CulturalExchangeProgramComponent: React.FC<CulturalExchangeProgramProps> = ({
  primaryCountry,
  exchanges: propExchanges,
  onCreateExchange,
  onJoinExchange,
  onViewArtifact,
  viewerClearanceLevel = 'PUBLIC'
}) => {
  const [selectedExchange, setSelectedExchange] = useState<CulturalExchange | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

  // Fetch live cultural exchanges
  const { data: liveExchanges, isLoading: exchangesLoading, refetch: refetchExchanges } = api.diplomatic.getCulturalExchanges.useQuery(
    { 
      countryId: primaryCountry.id,
      status: filterStatus !== 'all' ? filterStatus as any : undefined,
      type: filterType !== 'all' ? filterType : undefined
    },
    { 
      enabled: !!primaryCountry.id,
      refetchInterval: 30000
    }
  );

  // Create exchange mutation
  const createExchangeMutation = api.diplomatic.createCulturalExchange.useMutation({
    onSuccess: () => {
      toast.success('Cultural exchange created successfully!');
      setShowCreateModal(false);
      refetchExchanges();
    },
    onError: (error) => {
      toast.error(`Failed to create exchange: ${error.message}`);
    }
  });

  // Join exchange mutation
  const joinExchangeMutation = api.diplomatic.joinCulturalExchange.useMutation({
    onSuccess: () => {
      toast.success('Successfully joined cultural exchange!');
      refetchExchanges();
    },
    onError: (error) => {
      toast.error(`Failed to join exchange: ${error.message}`);
    }
  });

  // Use live data if available, fallback to prop data
  const exchanges = useMemo(() => {
    if (liveExchanges && liveExchanges.length > 0) {
      return liveExchanges.map(exchange => ({
        id: exchange.id,
        title: exchange.title,
        type: exchange.type as CulturalExchange['type'],
        description: exchange.description,
        hostCountry: exchange.hostCountry,
        participatingCountries: exchange.participatingCountries,
        status: exchange.status as CulturalExchange['status'],
        startDate: exchange.startDate,
        endDate: exchange.endDate,
        ixTimeContext: exchange.ixTimeContext,
        metrics: exchange.metrics,
        achievements: exchange.achievements,
        culturalArtifacts: exchange.culturalArtifacts,
        diplomaticOutcomes: undefined // Not included in API response yet
      }));
    }
    return propExchanges;
  }, [liveExchanges, propExchanges]);

  // Filter exchanges
  const filteredExchanges = useMemo(() => {
    let filtered = exchanges;

    if (filterType !== 'all') {
      filtered = filtered.filter(exchange => exchange.type === filterType);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(exchange => exchange.status === filterStatus);
    }

    // Sort by start date (newest first for active, oldest first for completed)
    return filtered.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      
      const aDate = new Date(a.startDate).getTime();
      const bDate = new Date(b.startDate).getTime();
      
      return a.status === 'completed' ? aDate - bDate : bDate - aDate;
    });
  }, [exchanges, filterType, filterStatus]);

  const handleCreateExchange = useCallback((exchangeData: Partial<CulturalExchange>) => {
    if (!exchangeData.title || !exchangeData.description || !exchangeData.startDate || !exchangeData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    createExchangeMutation.mutate({
      title: exchangeData.title,
      type: exchangeData.type || 'festival',
      description: exchangeData.description,
      hostCountryId: primaryCountry.id,
      hostCountryName: primaryCountry.name,
      hostCountryFlag: primaryCountry.flagUrl,
      startDate: exchangeData.startDate,
      endDate: exchangeData.endDate
    });
  }, [primaryCountry, createExchangeMutation]);

  const handleJoinExchange = useCallback((exchangeId: string, role: 'participant' | 'observer') => {
    joinExchangeMutation.mutate({
      exchangeId,
      countryId: primaryCountry.id,
      countryName: primaryCountry.name,
      flagUrl: primaryCountry.flagUrl,
      role
    });
  }, [primaryCountry, joinExchangeMutation]);

  // Calculate participation metrics
  const participationMetrics = useMemo(() => {
    const totalExchanges = exchanges.length;
    const activeExchanges = exchanges.filter(e => e.status === 'active').length;
    const completedExchanges = exchanges.filter(e => e.status === 'completed').length;
    const totalParticipants = exchanges.reduce((sum, e) => sum + e.metrics.participants, 0);
    const avgCulturalImpact = totalExchanges > 0 ? 
      exchanges.reduce((sum, e) => sum + e.metrics.culturalImpact, 0) / totalExchanges : 0;

    return {
      totalExchanges,
      activeExchanges,
      completedExchanges,
      totalParticipants,
      avgCulturalImpact: Math.round(avgCulturalImpact)
    };
  }, [exchanges]);

  return (
    <div className="cultural-exchange-program space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-[--intel-gold] flex items-center gap-3">
            <RiGlobalLine className="h-6 w-6" />
            Cultural Exchange Program
            <span className="text-sm font-normal text-[--intel-silver] ml-2">
              ({filteredExchanges.length} exchanges)
            </span>
            {exchangesLoading && (
              <div className="w-4 h-4 border-2 border-[--intel-gold]/20 border-t-[--intel-gold] rounded-full animate-spin" />
            )}
          </h3>
          <p className="text-[--intel-silver] text-sm mt-1">
            Cross-cultural collaboration and diplomatic engagement for {primaryCountry.name}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                viewMode === 'grid' 
                  ? "bg-[--intel-gold]/20 text-[--intel-gold]" 
                  : "text-[--intel-silver] hover:text-foreground"
              )}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                viewMode === 'timeline' 
                  ? "bg-[--intel-gold]/20 text-[--intel-gold]" 
                  : "text-[--intel-silver] hover:text-foreground"
              )}
            >
              Timeline
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RiAddLine className="h-4 w-4" />
            Create Exchange
          </button>
        </div>
      </div>

      {/* Participation Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-[--intel-gold]">{participationMetrics.totalExchanges}</div>
          <div className="text-[--intel-silver] text-sm">Total Programs</div>
        </div>
        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{participationMetrics.activeExchanges}</div>
          <div className="text-[--intel-silver] text-sm">Currently Active</div>
        </div>
        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{participationMetrics.completedExchanges}</div>
          <div className="text-[--intel-silver] text-sm">Completed</div>
        </div>
        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{participationMetrics.totalParticipants}</div>
          <div className="text-[--intel-silver] text-sm">Total Participants</div>
        </div>
        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-[--intel-amber]">{participationMetrics.avgCulturalImpact}%</div>
          <div className="text-[--intel-silver] text-sm">Cultural Impact</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white/5 rounded-lg border border-[--intel-gold]/20">
        <div className="flex items-center gap-2">
          <RiPaletteLine className="h-4 w-4 text-[--intel-silver]" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-[--intel-gold]/50 dark:bg-black/20 dark:border-white/30"
            style={{
              backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              backgroundSize: '16px',
              appearance: 'none',
              paddingRight: '32px'
            }}
          >
            <option value="all" className="bg-black text-foreground">All Types</option>
            {Object.entries(EXCHANGE_TYPES).map(([type, config]) => (
              <option key={type} value={type} className="bg-black text-foreground">{config.label}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <RiTimeLine className="h-4 w-4 text-[--intel-silver]" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-[--intel-gold]/50 dark:bg-black/20 dark:border-white/30"
            style={{
              backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              backgroundSize: '16px',
              appearance: 'none',
              paddingRight: '32px'
            }}
          >
            <option value="all" className="bg-black text-foreground">All Status</option>
            {Object.entries(STATUS_STYLES).map(([status, config]) => (
              <option key={status} value={status} className="bg-black text-foreground">{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Exchange List/Timeline */}
        <div className="xl:col-span-2">
          <div className="glass-hierarchy-child rounded-lg p-6">
            {viewMode === 'grid' ? (
              /* Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredExchanges.map((exchange, index) => {
                  const typeConfig = EXCHANGE_TYPES[exchange.type];
                  const statusConfig = STATUS_STYLES[exchange.status];
                  const Icon = typeConfig.icon;
                  
                  return (
                    <motion.div
                      key={exchange.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedExchange(exchange)}
                      className={cn(
                        "p-4 rounded-lg border cursor-pointer transition-all",
                        "bg-white/5 hover:bg-white/10 border-white/10 hover:border-[--intel-gold]/30",
                        selectedExchange?.id === exchange.id && "border-[--intel-gold]/50 bg-[--intel-gold]/10"
                      )}
                    >
                      {/* Exchange Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            typeConfig.bgColor, typeConfig.borderColor, "border"
                          )}>
                            <Icon className={cn("h-5 w-5", typeConfig.color)} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground text-sm">{exchange.title}</h4>
                            <p className="text-xs text-[--intel-silver]">{typeConfig.label}</p>
                          </div>
                        </div>
                        
                        <div className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          statusConfig.bg, statusConfig.color
                        )}>
                          <span className="mr-1">{statusConfig.icon}</span>
                          {statusConfig.label}
                        </div>
                      </div>

                      {/* Exchange Info */}
                      <div className="space-y-2">
                        <p className="text-[--intel-silver] text-sm line-clamp-2">{exchange.description}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-[--intel-silver]">
                          <div className="flex items-center gap-1">
                            <RiUserLine className="h-3 w-3" />
                            <span>{exchange.metrics.participants}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <RiStarLine className="h-3 w-3" />
                            <span>{exchange.metrics.culturalImpact}% impact</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <RiCalendarLine className="h-3 w-3" />
                            <span>{new Date(exchange.startDate).getFullYear()}</span>
                          </div>
                        </div>

                        {/* Participating Countries */}
                        <div className="flex items-center gap-2 mt-2">
                          <RiGlobalLine className="h-3 w-3 text-[--intel-silver]" />
                          <div className="flex items-center gap-1">
                            {exchange.participatingCountries.slice(0, 3).map((country) => (
                              <div
                                key={country.id}
                                className="w-4 h-3 bg-white/20 rounded border border-white/20 flex items-center justify-center"
                                title={country.name}
                              >
                                {country.flagUrl ? (
                                  <img
                                    src={country.flagUrl}
                                    alt={`${country.name} flag`}
                                    className="w-full h-full object-cover rounded"
                                  />
                                ) : (
                                  <span className="text-xs text-foreground">{country.name.charAt(0)}</span>
                                )}
                              </div>
                            ))}
                            {exchange.participatingCountries.length > 3 && (
                              <span className="text-xs text-[--intel-silver] ml-1">
                                +{exchange.participatingCountries.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* Timeline View */
              <div className="space-y-6">
                <div className="relative">
                  <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-[--intel-gold]/30" />
                  
                  {filteredExchanges.map((exchange, index) => {
                    const typeConfig = EXCHANGE_TYPES[exchange.type];
                    const statusConfig = STATUS_STYLES[exchange.status];
                    const Icon = typeConfig.icon;
                    
                    return (
                      <motion.div
                        key={exchange.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative flex items-start gap-6 pb-6"
                      >
                        {/* Timeline Marker */}
                        <div className={cn(
                          "w-16 h-16 rounded-full border-4 flex items-center justify-center relative z-10",
                          statusConfig.bg, statusConfig.color, "border-current"
                        )}>
                          <Icon className="h-6 w-6" />
                        </div>
                        
                        {/* Exchange Card */}
                        <div
                          onClick={() => setSelectedExchange(exchange)}
                          className={cn(
                            "flex-1 p-4 rounded-lg border cursor-pointer transition-all",
                            "bg-white/5 hover:bg-white/10 border-white/10 hover:border-[--intel-gold]/30",
                            selectedExchange?.id === exchange.id && "border-[--intel-gold]/50 bg-[--intel-gold]/10"
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-foreground">{exchange.title}</h4>
                              <p className="text-[--intel-silver] text-sm">{typeConfig.label}</p>
                            </div>
                            <div className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium",
                              statusConfig.bg, statusConfig.color
                            )}>
                              {statusConfig.label}
                            </div>
                          </div>
                          
                          <p className="text-[--intel-silver] text-sm mb-3">{exchange.description}</p>
                          
                          <div className="flex items-center gap-4 text-sm text-[--intel-silver]">
                            <span>📅 {new Date(exchange.startDate).toLocaleDateString()}</span>
                            <span>👥 {exchange.metrics.participants} participants</span>
                            <span>🌟 {exchange.metrics.culturalImpact}% impact</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {filteredExchanges.length === 0 && (
              <div className="text-center py-12 text-[--intel-silver]">
                <RiGlobalLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No cultural exchanges found</p>
                <p className="text-sm">Try adjusting your filters or create a new exchange</p>
              </div>
            )}
          </div>
        </div>

        {/* Exchange Details Panel */}
        <div className="xl:col-span-1">
          <div className="glass-hierarchy-child rounded-lg p-6 sticky top-6">
            {selectedExchange ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-foreground">Exchange Details</h4>
                  <button
                    onClick={() => setSelectedExchange(null)}
                    className="p-2 text-[--intel-silver] hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <RiCloseLine className="h-4 w-4" />
                  </button>
                </div>

                {/* Exchange Overview */}
                <div className="space-y-4">
                  <div>
                    <h5 className="text-lg font-bold text-foreground mb-2">{selectedExchange.title}</h5>
                    <div className="flex items-center gap-2 mb-3">
                      {React.createElement(EXCHANGE_TYPES[selectedExchange.type].icon, {
                        className: cn("h-5 w-5", EXCHANGE_TYPES[selectedExchange.type].color)
                      })}
                      <span className="text-[--intel-silver]">
                        {EXCHANGE_TYPES[selectedExchange.type].label}
                      </span>
                    </div>
                    <p className="text-[--intel-silver] text-sm">{selectedExchange.description}</p>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-lg font-bold text-purple-400">
                        {selectedExchange.metrics.participants}
                      </div>
                      <div className="text-xs text-[--intel-silver]">Participants</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-lg font-bold text-[--intel-gold]">
                        {selectedExchange.metrics.culturalImpact}%
                      </div>
                      <div className="text-xs text-[--intel-silver]">Cultural Impact</div>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-[--intel-silver]">
                      <RiCalendarLine className="h-4 w-4" />
                      <span>
                        {new Date(selectedExchange.startDate).toLocaleDateString()} - {' '}
                        {new Date(selectedExchange.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Cultural Artifacts Preview */}
                  {selectedExchange.culturalArtifacts.length > 0 && (
                    <div className="space-y-3">
                      <h6 className="font-medium text-foreground flex items-center gap-2">
                        <RiCameraLine className="h-4 w-4" />
                        Cultural Artifacts ({selectedExchange.culturalArtifacts.length})
                      </h6>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedExchange.culturalArtifacts.slice(0, 4).map((artifact) => (
                          <div
                            key={artifact.id}
                            onClick={() => onViewArtifact?.(artifact.id)}
                            className="aspect-square bg-white/5 rounded-lg border border-white/10 hover:border-[--intel-gold]/30 cursor-pointer transition-colors flex items-center justify-center"
                          >
                            {artifact.thumbnailUrl ? (
                              <img
                                src={artifact.thumbnailUrl}
                                alt={artifact.title}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <RiCameraLine className="h-6 w-6 text-[--intel-silver]" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  {selectedExchange.status === 'active' && (
                    <>
                      <button
                        onClick={() => handleJoinExchange(selectedExchange.id, 'participant')}
                        className="w-full flex items-center justify-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-3 rounded-lg font-medium transition-colors"
                      >
                        <RiUserLine className="h-4 w-4" />
                        Join as Participant
                      </button>
                      <button
                        onClick={() => handleJoinExchange(selectedExchange.id, 'observer')}
                        className="w-full flex items-center justify-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-3 rounded-lg font-medium transition-colors"
                      >
                        <RiEyeLine className="h-4 w-4" />
                        Observe Exchange
                      </button>
                    </>
                  )}
                  
                  <button className="w-full flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-4 py-3 rounded-lg font-medium transition-colors">
                    <RiShareLine className="h-4 w-4" />
                    Share Exchange
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-[--intel-silver]">
                <RiGlobalLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select an exchange</p>
                <p className="text-sm">Click on any cultural exchange to view detailed information</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Exchange Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10001]"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-[10002] glass-modal rounded-xl p-6"
            >
              <CreateExchangeForm
                onSubmit={handleCreateExchange}
                onCancel={() => setShowCreateModal(false)}
                hostCountry={primaryCountry}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Create Exchange Form Component
interface CreateExchangeFormProps {
  onSubmit: (data: Partial<CulturalExchange>) => void;
  onCancel: () => void;
  hostCountry: { id: string; name: string; flagUrl?: string };
}

const CreateExchangeForm: React.FC<CreateExchangeFormProps> = ({ onSubmit, onCancel, hostCountry }) => {
  const [formData, setFormData] = useState({
    title: '',
    type: 'festival' as keyof typeof EXCHANGE_TYPES,
    description: '',
    startDate: '',
    endDate: '',
    invitedCountries: [] as string[],
    isPublic: true,
    maxParticipants: 100,
    culturalFocus: '',
    expectedOutcomes: ''
  });
  
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [availableCountries] = useState([
    { id: 'caphiria', name: 'Caphiria', flagUrl: '/flags/caphiria.png' },
    { id: 'urcea', name: 'Urcea', flagUrl: '/flags/urcea.png' },
    { id: 'burgundie', name: 'Burgundie', flagUrl: '/flags/burgundie.png' },
    { id: 'kiravia', name: 'Kiravia', flagUrl: '/flags/kiravia.png' },
    { id: 'varshan', name: 'Varshan', flagUrl: '/flags/varshan.png' },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    // Send global notifications to invited countries
    if (formData.invitedCountries.length > 0) {
      formData.invitedCountries.forEach(countryId => {
        const country = availableCountries.find(c => c.id === countryId);
        if (country) {
          toast.success(`Cultural exchange invitation sent to ${country.name}`);
        }
      });
    }
    
    onSubmit({
      title: formData.title,
      type: formData.type,
      description: formData.description,
      startDate: formData.startDate,
      endDate: formData.endDate,
      participatingCountries: formData.invitedCountries.map(id => ({
        id,
        name: availableCountries.find(c => c.id === id)?.name || id,
        flagUrl: availableCountries.find(c => c.id === id)?.flagUrl,
        role: 'participant' as const
      })),
      metrics: {
        participants: 0,
        culturalImpact: 0,
        diplomaticValue: 0,
        socialEngagement: 0
      },
      achievements: [],
      culturalArtifacts: []
    });
  };

  const toggleCountryInvite = (countryId: string) => {
    setFormData(prev => ({
      ...prev,
      invitedCountries: prev.invitedCountries.includes(countryId)
        ? prev.invitedCountries.filter(id => id !== countryId)
        : [...prev.invitedCountries, countryId]
    }));
  };

  return (
    <div className="glass-hierarchy-modal">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="glass-hierarchy-child rounded-lg p-4 border-b border-[--intel-gold]/20">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-[--intel-gold] flex items-center gap-2">
              <RiGlobalLine className="h-6 w-6" />
              Create Cultural Exchange
            </h3>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 text-[--intel-silver] hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>
          <p className="text-[--intel-silver] text-sm mt-2">
            Foster diplomatic relationships through cultural collaboration
          </p>
        </div>

        {/* Basic Information */}
        <div className="glass-hierarchy-child rounded-lg p-6 space-y-4">
          <h4 className="font-semibold text-foreground mb-4">Basic Information</h4>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Exchange Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Annual Cultural Festival 2024..."
              className="w-full bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-4 py-3 text-foreground placeholder:text-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50"
              required
            />
          </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Exchange Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as keyof typeof EXCHANGE_TYPES }))}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-foreground focus:outline-none focus:border-[--intel-gold]/50 dark:bg-black/20 dark:border-white/30"
            style={{
              backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              backgroundSize: '16px',
              appearance: 'none',
              paddingRight: '40px'
            }}
          >
            {Object.entries(EXCHANGE_TYPES).map(([type, config]) => (
              <option key={type} value={type} className="bg-black text-foreground">{config.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Host Country</label>
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/20">
            {hostCountry.flagUrl && (
              <img
                src={hostCountry.flagUrl}
                alt={`${hostCountry.name} flag`}
                className="w-6 h-4 object-cover rounded border border-white/20"
              />
            )}
            <span className="text-foreground font-medium">{hostCountry.name}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Start Date</label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-[--intel-gold]/50"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">End Date</label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-[--intel-gold]/50"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe the cultural exchange program..."
          rows={4}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-foreground placeholder:text-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50 resize-none"
          required
        />
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <div className="text-sm text-[--intel-silver]">
          Creating as {hostCountry.name}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-[--intel-silver] hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-6 py-2 rounded-lg font-medium transition-colors"
          >
            <RiAddLine className="h-4 w-4" />
            Create Exchange
          </button>
        </div>
      </div>
    </form>
    </div>
  );
};

CulturalExchangeProgramComponent.displayName = 'CulturalExchangeProgram';

export const CulturalExchangeProgram = React.memo(CulturalExchangeProgramComponent);