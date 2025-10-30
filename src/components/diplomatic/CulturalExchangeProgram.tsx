"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { CulturalExchangeWizard } from "./CulturalExchangeWizard";
import type { CulturalExchange, CulturalExchangeProgramProps } from "./cultural-exchange-types";
import { EXCHANGE_TYPES, STATUS_STYLES } from "./cultural-exchange-types";
import { ExchangeHeader } from "./ExchangeHeader";
import { ExchangeMetrics } from "./ExchangeMetrics";
import { ExchangeFilters } from "./ExchangeFilters";
import { ExchangeCard } from "./ExchangeCard";
import { ExchangeDetailsModal } from "./ExchangeDetailsModal";
import { EditExchangeModal } from "./EditExchangeModal";
import { ScenarioModal } from "./ScenarioModal";
import { ImpactVisualizationModal } from "./ImpactVisualizationModal";
import { ArtifactUploadModal } from "./ArtifactUploadModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

const CulturalExchangeProgramComponent: React.FC<CulturalExchangeProgramProps> = ({
  primaryCountry,
  exchanges: propExchanges,
}) => {
  const [selectedExchange, setSelectedExchange] = useState<CulturalExchange | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showArtifactUpload, setShowArtifactUpload] = useState(false);
  const [votedExchanges, setVotedExchanges] = useState<Set<string>>(new Set());
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [showImpactVisualization, setShowImpactVisualization] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({ title: '', description: '' });

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

  // Vote on exchange mutation
  const voteExchangeMutation = api.diplomatic.voteOnExchange.useMutation({
    onSuccess: () => {
      toast.success('Vote recorded!');
      refetchExchanges();
    },
    onError: (error) => {
      toast.error(`Failed to vote: ${error.message}`);
    }
  });

  // Upload artifact mutation
  const uploadArtifactMutation = api.diplomatic.uploadCulturalArtifact.useMutation({
    onSuccess: () => {
      toast.success('Cultural artifact uploaded successfully!');
      setShowArtifactUpload(false);
      refetchExchanges();
    },
    onError: (error) => {
      toast.error(`Failed to upload artifact: ${error.message}`);
    }
  });

  // Generate cultural scenario mutation
  const generateScenarioMutation = api.diplomatic.generateCulturalScenario.useMutation({
    onSuccess: (data) => {
      setSelectedScenario(data);
      setShowScenarioModal(true);
      toast.success('Cultural scenario generated!');
    },
    onError: (error) => {
      toast.error(`Failed to generate scenario: ${error.message}`);
    }
  });

  // Calculate exchange impact mutation
  const calculateImpactMutation = api.diplomatic.calculateExchangeImpact.useMutation({
    onSuccess: () => {
      setShowImpactVisualization(true);
      toast.success('Impact calculated successfully!');
      refetchExchanges();
    },
    onError: (error) => {
      toast.error(`Failed to calculate impact: ${error.message}`);
    }
  });

  // Get NPC responses for selected exchange
  const { data: npcResponses } = api.diplomatic.getNPCCulturalResponses.useQuery(
    {
      exchangeId: selectedExchange?.id || '',
      hostCountryId: primaryCountry.id
    },
    {
      enabled: !!selectedExchange?.id && selectedExchange.participatingCountries.length > 0
    }
  );

  // Update exchange mutation
  const updateExchangeMutation = api.diplomatic.updateCulturalExchange.useMutation({
    onSuccess: () => {
      toast.success('Exchange updated successfully!');
      setShowEditModal(false);
      refetchExchanges();
    },
    onError: (error) => {
      toast.error(`Failed to update exchange: ${error.message}`);
    }
  });

  // Cancel exchange mutation (with negative effects)
  const cancelExchangeMutation = api.diplomatic.cancelCulturalExchange.useMutation({
    onSuccess: (data) => {
      const penalties = data.penalties;
      toast.success('Exchange cancelled', {
        description: `Reputation: ${penalties.reputationLoss}, Relations: ${penalties.relationshipPenalty}%`
      });
      setShowDetailsModal(false);
      setSelectedExchange(null);
      refetchExchanges();
    },
    onError: (error) => {
      toast.error(`Failed to cancel exchange: ${error.message}`);
    }
  });

  // Share to ThinkPages mutation
  const shareToThinkPagesMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      toast.success('Shared to ThinkPages!', {
        description: 'Your cultural exchange is now visible on the global feed'
      });
    },
    onError: (error) => {
      toast.error(`Failed to share: ${error.message}`);
    }
  });

  // Use live data if available, fallback to prop data
  const exchanges = useMemo((): CulturalExchange[] => {
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
        linkedMissions: exchange.linkedMissions,
        bonusReasoning: exchange.bonusReasoning,
        achievements: exchange.achievements,
        culturalArtifacts: exchange.culturalArtifacts,
        diplomaticOutcomes: {
          newPartnerships: 0,
          tradeAgreements: 0,
          futureCollaborations: []
        }
      })) as CulturalExchange[];
    }
    return (propExchanges || []) as CulturalExchange[];
  }, [liveExchanges, propExchanges]);

  // Filter exchanges
  const filteredExchanges = useMemo(() => {
    if (!exchanges || !Array.isArray(exchanges)) return [];
    let filtered: CulturalExchange[] = exchanges;

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

  const handleCreateExchange = useCallback((wizardData: {
    title: string;
    type: string;
    description: string;
    participantCountryId: string;
    narrative: string;
    objectives: string[];
    startDate: string;
    endDate: string;
    isPublic: boolean;
    maxParticipants: number;
  }) => {
    console.log('handleCreateExchange received:', wizardData);

    if (!wizardData.title || !wizardData.description || !wizardData.startDate || !wizardData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    const mutationData = {
      title: wizardData.title,
      type: wizardData.type as 'festival' | 'exhibition' | 'education' | 'cuisine' | 'arts' | 'sports' | 'technology' | 'diplomacy' | 'music' | 'film' | 'environmental' | 'science' | 'trade' | 'humanitarian' | 'agriculture' | 'heritage' | 'youth',
      description: wizardData.description,
      hostCountryId: primaryCountry.id,
      hostCountryName: primaryCountry.name,
      hostCountryFlag: primaryCountry.flagUrl,
      startDate: wizardData.startDate,
      endDate: wizardData.endDate,
      narrative: wizardData.narrative,
      objectives: wizardData.objectives,
      isPublic: wizardData.isPublic,
      maxParticipants: wizardData.maxParticipants,
      participantCountryId: wizardData.participantCountryId
    };

    console.log('Sending to mutation:', mutationData);
    createExchangeMutation.mutate(mutationData);
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

  const handleVoteExchange = useCallback((exchangeId: string, voteType: 'up' | 'down') => {
    if (votedExchanges.has(exchangeId)) {
      toast.info('You have already voted on this exchange');
      return;
    }

    // Map vote types to API expected values
    const voteValue = voteType === 'up' ? 'support' : 'oppose';

    voteExchangeMutation.mutate({
      exchangeId,
      vote: voteValue
    });

    setVotedExchanges(prev => new Set(prev).add(exchangeId));
  }, [votedExchanges, voteExchangeMutation]);

  const handleUploadArtifact = useCallback((artifactData: any) => {
    if (!selectedExchange) return;
    uploadArtifactMutation.mutate({
      exchangeId: selectedExchange.id,
      countryId: primaryCountry.id,
      countryName: primaryCountry.name,
      ...artifactData
    });
  }, [selectedExchange, primaryCountry, uploadArtifactMutation]);

  // Calculate participation metrics
  const participationMetrics = useMemo(() => {
    if (!exchanges || !Array.isArray(exchanges)) {
      return { totalExchanges: 0, activeExchanges: 0, completedExchanges: 0, totalParticipants: 0, avgCulturalImpact: 0 };
    }
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

  // Calculate achievements
  const achievements = useMemo(() => {
    if (!exchanges || !Array.isArray(exchanges)) return [];
    const myParticipation = exchanges.filter(e =>
      e.hostCountry.id === primaryCountry.id ||
      e.participatingCountries.some(c => c.id === primaryCountry.id)
    );

    const badges = [];

    if (myParticipation.length >= 1) badges.push({ id: 'first-exchange', name: 'Cultural Pioneer', icon: '🌟', description: 'Participated in first exchange' });
    if (myParticipation.length >= 5) badges.push({ id: 'active-participant', name: 'Active Participant', icon: '🎭', description: 'Participated in 5+ exchanges' });
    if (myParticipation.length >= 10) badges.push({ id: 'cultural-ambassador', name: 'Cultural Ambassador', icon: '🏆', description: 'Participated in 10+ exchanges' });
    if (myParticipation.some(e => e.hostCountry.id === primaryCountry.id)) badges.push({ id: 'host', name: 'Gracious Host', icon: '🏛️', description: 'Hosted a cultural exchange' });
    if (myParticipation.filter(e => e.status === 'completed').length >= 3) badges.push({ id: 'completionist', name: 'Completionist', icon: '✅', description: 'Completed 3+ exchanges' });

    const avgImpact = myParticipation.length > 0
      ? myParticipation.reduce((sum, e) => sum + e.metrics.culturalImpact, 0) / myParticipation.length
      : 0;
    if (avgImpact >= 70) badges.push({ id: 'high-impact', name: 'High Impact', icon: '💫', description: '70+ avg cultural impact' });

    return badges;
  }, [exchanges, primaryCountry.id]);

  // Handler functions for modals and actions
  const handleCardClick = useCallback((exchange: CulturalExchange) => {
    setSelectedExchange(exchange);
    setShowDetailsModal(true);
  }, []);

  const handleEditClick = useCallback((exchange: CulturalExchange) => {
    setSelectedExchange(exchange);
    setEditFormData({ title: exchange.title, description: exchange.description });
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!selectedExchange) return;
    updateExchangeMutation.mutate({
      exchangeId: selectedExchange.id,
      title: editFormData.title,
      description: editFormData.description
    });
  }, [selectedExchange, editFormData, updateExchangeMutation]);

  const handleShareToThinkPages = useCallback(() => {
    if (!selectedExchange) return;
    const typeConfig = EXCHANGE_TYPES[selectedExchange.type];
    shareToThinkPagesMutation.mutate({
      accountId: primaryCountry.id,
      content: `${typeConfig.emoji} **${selectedExchange.title}**\n\n${selectedExchange.description}\n\n#CulturalExchange #${selectedExchange.type}`,
      visibility: 'public',
      hashtags: ['cultural-exchange', selectedExchange.type],
    });
  }, [selectedExchange, primaryCountry.id, shareToThinkPagesMutation]);

  const handleGenerateScenario = useCallback(() => {
    if (!selectedExchange) return;
    // Find a participating country to generate scenario with
    const targetCountryId = selectedExchange.participatingCountries[0]?.id || selectedExchange.hostCountry.id;
    generateScenarioMutation.mutate({
      targetCountryId,
      preferredScenarioType: selectedExchange.type
    });
  }, [selectedExchange, generateScenarioMutation]);

  const handleCalculateImpact = useCallback(() => {
    if (!selectedExchange) return;
    calculateImpactMutation.mutate({
      exchangeId: selectedExchange.id,
      responseChoice: 'collaborative',
      participantSatisfaction: selectedExchange.metrics.culturalImpact,
      publicPerception: selectedExchange.metrics.socialEngagement
    });
  }, [selectedExchange, calculateImpactMutation]);

  const handleCancelExchange = useCallback(() => {
    if (!selectedExchange) return;
    if (confirm('Are you sure you want to cancel this exchange? This will negatively impact diplomatic relations.')) {
      cancelExchangeMutation.mutate({
        exchangeId: selectedExchange.id,
        hostCountryId: primaryCountry.id
      });
    }
  }, [selectedExchange, primaryCountry.id, cancelExchangeMutation]);

  const handleSelectScenarioResponse = useCallback((option: any) => {
    console.log('Selected scenario response:', option);
    toast.success(`Selected: ${option.label}`);
    setShowScenarioModal(false);
  }, []);

  return (
    <div className="cultural-exchange-program space-y-6">
      {/* Header */}
      <ExchangeHeader
        primaryCountry={primaryCountry}
        achievements={achievements}
        filteredExchangesCount={filteredExchanges.length}
        isLoading={exchangesLoading}
        onCreateExchange={() => setShowCreateModal(true)}
      />

      {/* Participation Metrics */}
      <ExchangeMetrics metrics={participationMetrics} />

      {/* Filters */}
      <ExchangeFilters
        filterType={filterType}
        setFilterType={setFilterType}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        exchangeTypes={EXCHANGE_TYPES}
        statusStyles={STATUS_STYLES}
      />

      {/* Exchange Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredExchanges.map((exchange, index) => (
          <ExchangeCard
            key={exchange.id}
            exchange={exchange}
            index={index}
            isSelected={selectedExchange?.id === exchange.id}
            primaryCountryId={primaryCountry.id}
            votedExchanges={votedExchanges}
            onClick={() => handleCardClick(exchange)}
            onEdit={() => handleEditClick(exchange)}
            onVote={(voteType) => handleVoteExchange(exchange.id, voteType)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredExchanges.length === 0 && !exchangesLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-hierarchy-child rounded-lg p-12 text-center"
        >
          <div className="text-5xl mb-4">🌍</div>
          <h4 className="text-lg font-semibold text-foreground mb-2">No Cultural Exchanges Found</h4>
          <p className="text-[--intel-silver] mb-6">
            {filterType !== 'all' || filterStatus !== 'all'
              ? 'Try adjusting your filters or create a new exchange to get started.'
              : 'Be the first to create a cultural exchange and connect nations!'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Create Your First Exchange
          </button>
        </motion.div>
      )}

      {/* Create Exchange Modal (Wizard) */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Create Cultural Exchange</DialogTitle>
          </DialogHeader>
          <CulturalExchangeWizard
            hostCountry={primaryCountry}
            onComplete={handleCreateExchange}
            onCancel={() => setShowCreateModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Exchange Details Modal */}
      <ExchangeDetailsModal
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        exchange={selectedExchange}
        onJoin={handleJoinExchange}
        onShare={handleShareToThinkPages}
        onUploadArtifact={() => setShowArtifactUpload(true)}
        onCancel={handleCancelExchange}
        onEdit={() => {
          setShowDetailsModal(false);
          handleEditClick(selectedExchange!);
        }}
        onCalculateImpact={handleCalculateImpact}
        onGenerateScenario={handleGenerateScenario}
        primaryCountry={primaryCountry}
        npcResponses={npcResponses}
        exchangeTypes={EXCHANGE_TYPES}
        isGeneratingScenario={generateScenarioMutation.isPending}
        isSharing={shareToThinkPagesMutation.isPending}
        isCancelling={cancelExchangeMutation.isPending}
        isCalculating={calculateImpactMutation.isPending}
      />

      {/* Edit Exchange Modal */}
      <EditExchangeModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        exchange={selectedExchange}
        formData={editFormData}
        onFormDataChange={setEditFormData}
        onSave={handleSaveEdit}
        isPending={updateExchangeMutation.isPending}
      />

      {/* Scenario Modal */}
      <ScenarioModal
        open={showScenarioModal}
        onOpenChange={setShowScenarioModal}
        scenario={selectedScenario}
        onSelectResponse={handleSelectScenarioResponse}
      />

      {/* Impact Visualization Modal */}
      <ImpactVisualizationModal
        open={showImpactVisualization}
        onOpenChange={setShowImpactVisualization}
        impactData={calculateImpactMutation.data || null}
      />

      {/* Artifact Upload Modal */}
      <ArtifactUploadModal
        open={showArtifactUpload}
        onOpenChange={setShowArtifactUpload}
        selectedExchange={selectedExchange}
        onSubmit={handleUploadArtifact}
      />
    </div>
  );
};

CulturalExchangeProgramComponent.displayName = 'CulturalExchangeProgram';

export const CulturalExchangeProgram = CulturalExchangeProgramComponent;
export default CulturalExchangeProgramComponent;
