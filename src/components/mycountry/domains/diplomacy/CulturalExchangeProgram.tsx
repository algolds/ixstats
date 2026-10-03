"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Globe, Plus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { CulturalExchangeWizard } from "./CulturalExchangeWizard";
import type { CulturalExchange, CulturalExchangeProgramProps } from "./cultural-exchange-types";
import { EXCHANGE_TYPES, STATUS_STYLES } from "./cultural-exchange-types";
import { ExchangeHeader } from "./ExchangeHeader";
import { ExchangeMetrics } from "./ExchangeMetrics";
import { ExchangeFilters } from "./ExchangeFilters";
import { ExchangeCard } from "./ExchangeCard";
import { ExchangeDetailsModal } from "./ExchangeDetailsModal";
import { EditExchangeModal } from "./EditExchangeModal";
import { ScenarioModal, type ResponseOption, type Scenario } from "./ScenarioModal";
import { ImpactVisualizationModal } from "./ImpactVisualizationModal";
import { ArtifactUploadModal } from "./ArtifactUploadModal";
import type { ArtifactUploadData } from "./ArtifactUploadForm";
import { uploadImageFile } from "~/lib/media/upload-image";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Card } from "~/components/ui/card";

const isExchangeStatus = (value: string): value is keyof typeof STATUS_STYLES =>
  value in STATUS_STYLES;

const CulturalExchangeProgramComponent: React.FC<CulturalExchangeProgramProps> = ({
  primaryCountry,
  exchanges: propExchanges,
}) => {
  const notify = useNotify();
  const [selectedExchange, setSelectedExchange] = useState<CulturalExchange | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showArtifactUpload, setShowArtifactUpload] = useState(false);
  const [isUploadingArtifactFile, setIsUploadingArtifactFile] = useState(false);
  const [votedExchanges, setVotedExchanges] = useState<Set<string>>(new Set());
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [showImpactVisualization, setShowImpactVisualization] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [editFormData, setEditFormData] = useState({ title: "", description: "" });

  // Fetch live cultural exchanges
  const {
    data: liveExchanges,
    isLoading: exchangesLoading,
    refetch: refetchExchanges,
  } = api.diplomaticCultural.getCulturalExchanges.useQuery(
    {
      countryId: primaryCountry.id,
      status: isExchangeStatus(filterStatus) ? filterStatus : undefined,
      type: filterType !== "all" ? filterType : undefined,
    },
    {
      enabled: !!primaryCountry.id,
      refetchInterval: 30000,
    }
  );

  // Create exchange mutation
  const createExchangeMutation = api.diplomaticCultural.createCulturalExchange.useMutation({
    onSuccess: () => {
      notify.success("Cultural exchange created");
      setShowCreateModal(false);
      refetchExchanges();
    },
    onError: (error) => {
      notify.error(`Failed to create exchange: ${error.message}`);
    },
  });

  // Join exchange mutation
  const joinExchangeMutation = api.diplomaticCultural.joinCulturalExchange.useMutation({
    onSuccess: () => {
      notify.success("Joined cultural exchange");
      refetchExchanges();
    },
    onError: (error) => {
      notify.error(`Failed to join exchange: ${error.message}`);
    },
  });

  // Vote on exchange mutation
  const voteExchangeMutation = api.diplomaticCultural.voteOnExchange.useMutation({
    onSuccess: () => {
      notify.success("Vote recorded");
      refetchExchanges();
    },
    onError: (error) => {
      notify.error(`Failed to vote: ${error.message}`);
    },
  });

  // Upload artifact mutation
  const uploadArtifactMutation = api.diplomaticCultural.uploadCulturalArtifact.useMutation({
    onSuccess: () => {
      notify.success("Artifact uploaded");
      setShowArtifactUpload(false);
      refetchExchanges();
    },
    onError: (error) => {
      notify.error(`Failed to upload artifact: ${error.message}`);
    },
  });

  // Generate cultural scenario mutation
  const generateScenarioMutation = api.diplomaticCultural.generateCulturalScenario.useMutation({
    onSuccess: (data) => {
      setSelectedScenario({
        title: data.scenario.title,
        narrative: data.scenario.narrative,
        responseOptions: data.responseOptions,
      });
      setShowScenarioModal(true);
      notify.success("Scenario generated");
    },
    onError: (error) => {
      notify.error(`Failed to generate scenario: ${error.message}`);
    },
  });

  // Calculate exchange impact mutation
  const calculateImpactMutation = api.diplomaticCultural.calculateExchangeImpact.useMutation({
    onSuccess: () => {
      setShowImpactVisualization(true);
      notify.success("Impact calculated");
      refetchExchanges();
    },
    onError: (error) => {
      notify.error(`Failed to calculate impact: ${error.message}`);
    },
  });

  // Get NPC responses for selected exchange
  const { data: npcResponses } = api.diplomaticCultural.getNPCCulturalResponses.useQuery(
    {
      exchangeId: selectedExchange?.id || "",
      hostCountryId: primaryCountry.id,
    },
    {
      enabled: !!selectedExchange?.id && selectedExchange.participatingCountries.length > 0,
    }
  );

  // Update exchange mutation
  const updateExchangeMutation = api.diplomaticCultural.updateCulturalExchange.useMutation({
    onSuccess: () => {
      notify.success("Exchange updated");
      setShowEditModal(false);
      refetchExchanges();
    },
    onError: (error) => {
      notify.error(`Failed to update exchange: ${error.message}`);
    },
  });

  // Cancel exchange mutation (with negative effects)
  const cancelExchangeMutation = api.diplomaticCultural.cancelCulturalExchange.useMutation({
    onSuccess: (data) => {
      const penalties = data.penalties;
      notify.success(
        "Exchange cancelled",
        `Reputation: ${penalties.reputationLoss}, Relations: ${penalties.relationshipPenalty}%`
      );
      setShowDetailsModal(false);
      setSelectedExchange(null);
      refetchExchanges();
    },
    onError: (error) => {
      notify.error(`Failed to cancel exchange: ${error.message}`);
    },
  });

  // Share to ThinkPages mutation
  const shareToThinkPagesMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      notify.success(
        "Shared to ThinkPages!",
        "Your cultural exchange is now visible on the global feed"
      );
    },
    onError: (error) => {
      notify.error(`Failed to share: ${error.message}`);
    },
  });

  // Use live data if available, fallback to prop data
  const exchanges = useMemo((): CulturalExchange[] => {
    if (liveExchanges && liveExchanges.length > 0) {
      return liveExchanges.map((exchange) => ({
        id: exchange.id,
        title: exchange.title,
        type: exchange.type as CulturalExchange["type"],
        description: exchange.description,
        hostCountry: exchange.hostCountry,
        participatingCountries: exchange.participatingCountries,
        status: exchange.status as CulturalExchange["status"],
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
          futureCollaborations: [],
        },
      })) as CulturalExchange[];
    }
    return (propExchanges || []) as CulturalExchange[];
  }, [liveExchanges, propExchanges]);

  // Filter exchanges
  const filteredExchanges = useMemo(() => {
    if (!exchanges || !Array.isArray(exchanges)) return [];
    let filtered: CulturalExchange[] = exchanges;

    if (filterType !== "all") {
      filtered = filtered.filter((exchange) => exchange.type === filterType);
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((exchange) => exchange.status === filterStatus);
    }

    // Sort by start date (newest first for active, oldest first for completed)
    return filtered.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;

      const aDate = new Date(a.startDate).getTime();
      const bDate = new Date(b.startDate).getTime();

      return a.status === "completed" ? aDate - bDate : bDate - aDate;
    });
  }, [exchanges, filterType, filterStatus]);

  const handleCreateExchange = useCallback(
    (wizardData: {
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
      console.log("handleCreateExchange received:", wizardData);

      if (
        !wizardData.title ||
        !wizardData.description ||
        !wizardData.startDate ||
        !wizardData.endDate
      ) {
        notify.error("Please fill in all required fields");
        return;
      }

      const mutationData = {
        title: wizardData.title,
        type: wizardData.type as
          | "festival"
          | "exhibition"
          | "education"
          | "cuisine"
          | "arts"
          | "sports"
          | "technology"
          | "diplomacy"
          | "music"
          | "film"
          | "environmental"
          | "science"
          | "trade"
          | "humanitarian"
          | "agriculture"
          | "heritage"
          | "youth",
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
        participantCountryId: wizardData.participantCountryId,
      };

      console.log("Sending to mutation:", mutationData);
      createExchangeMutation.mutate(mutationData);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primaryCountry, createExchangeMutation]
  );

  const handleJoinExchange = useCallback(
    (exchangeId: string, role: "participant" | "observer") => {
      joinExchangeMutation.mutate({
        exchangeId,
        countryId: primaryCountry.id,
        countryName: primaryCountry.name,
        flagUrl: primaryCountry.flagUrl,
        role,
      });
    },
    [primaryCountry, joinExchangeMutation]
  );

  const handleVoteExchange = useCallback(
    (exchangeId: string, voteType: "up" | "down") => {
      if (votedExchanges.has(exchangeId)) {
        notify.info("You have already voted on this exchange");
        return;
      }

      // Map vote types to API expected values
      const voteValue = voteType === "up" ? "support" : "oppose";

      voteExchangeMutation.mutate({
        exchangeId,
        vote: voteValue,
      });

      setVotedExchanges((prev) => new Set(prev).add(exchangeId));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [votedExchanges, voteExchangeMutation]
  );

  // Store the file via /api/upload/image first, then record the artifact with its URL.
  // `contributor` is the display attribution; the server derives countryId from the session.
  const handleUploadArtifact = useCallback(
    async (artifact: ArtifactUploadData) => {
      if (!selectedExchange) return;
      setIsUploadingArtifactFile(true);
      let fileUrl: string;
      try {
        fileUrl = await uploadImageFile(artifact.file);
      } catch (error) {
        notify.error(
          `Failed to upload artifact: ${error instanceof Error ? error.message : "Upload failed"}`
        );
        return;
      } finally {
        setIsUploadingArtifactFile(false);
      }
      uploadArtifactMutation.mutate({
        exchangeId: selectedExchange.id,
        type: artifact.type,
        title: artifact.title,
        description: artifact.description,
        fileUrl,
        thumbnailUrl: fileUrl,
        contributor: primaryCountry.name,
      });
    },
    [selectedExchange, primaryCountry.name, uploadArtifactMutation, notify]
  );

  // Calculate participation metrics
  const participationMetrics = useMemo(() => {
    if (!exchanges || !Array.isArray(exchanges)) {
      return {
        totalExchanges: 0,
        activeExchanges: 0,
        completedExchanges: 0,
        totalParticipants: 0,
        avgCulturalImpact: 0,
      };
    }
    const totalExchanges = exchanges.length;
    const activeExchanges = exchanges.filter((e) => e.status === "active").length;
    const completedExchanges = exchanges.filter((e) => e.status === "completed").length;
    const totalParticipants = exchanges.reduce((sum, e) => sum + e.metrics.participants, 0);
    const avgCulturalImpact =
      totalExchanges > 0
        ? exchanges.reduce((sum, e) => sum + e.metrics.culturalImpact, 0) / totalExchanges
        : 0;

    return {
      totalExchanges,
      activeExchanges,
      completedExchanges,
      totalParticipants,
      avgCulturalImpact: Math.round(avgCulturalImpact),
    };
  }, [exchanges]);

  // Calculate achievements
  const achievements = useMemo(() => {
    if (!exchanges || !Array.isArray(exchanges)) return [];
    const myParticipation = exchanges.filter(
      (e) =>
        e.hostCountry.id === primaryCountry.id ||
        e.participatingCountries.some((c) => c.id === primaryCountry.id)
    );

    const badges = [];

    if (myParticipation.length >= 1)
      badges.push({
        id: "first-exchange",
        name: "Cultural Pioneer",
        icon: "🌟",
        description: "Participated in first exchange",
      });
    if (myParticipation.length >= 5)
      badges.push({
        id: "active-participant",
        name: "Active Participant",
        icon: "🎭",
        description: "Participated in 5+ exchanges",
      });
    if (myParticipation.length >= 10)
      badges.push({
        id: "cultural-ambassador",
        name: "Cultural Ambassador",
        icon: "🏆",
        description: "Participated in 10+ exchanges",
      });
    if (myParticipation.some((e) => e.hostCountry.id === primaryCountry.id))
      badges.push({
        id: "host",
        name: "Gracious Host",
        icon: "🏛️",
        description: "Hosted a cultural exchange",
      });
    if (myParticipation.filter((e) => e.status === "completed").length >= 3)
      badges.push({
        id: "completionist",
        name: "Completionist",
        icon: "✅",
        description: "Completed 3+ exchanges",
      });

    const avgImpact =
      myParticipation.length > 0
        ? myParticipation.reduce((sum, e) => sum + e.metrics.culturalImpact, 0) /
          myParticipation.length
        : 0;
    if (avgImpact >= 70)
      badges.push({
        id: "high-impact",
        name: "High Impact",
        icon: "💫",
        description: "70+ avg cultural impact",
      });

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
      description: editFormData.description,
    });
  }, [selectedExchange, editFormData, updateExchangeMutation]);

  const handleShareToThinkPages = useCallback(() => {
    if (!selectedExchange) return;
    const typeConfig = EXCHANGE_TYPES[selectedExchange.type];
    shareToThinkPagesMutation.mutate({
      accountId: primaryCountry.id,
      content: `${typeConfig.emoji} **${selectedExchange.title}**\n\n${selectedExchange.description}\n\n#CulturalExchange #${selectedExchange.type}`,
      visibility: "public",
      hashtags: ["cultural-exchange", selectedExchange.type],
    });
  }, [selectedExchange, primaryCountry.id, shareToThinkPagesMutation]);

  const handleGenerateScenario = useCallback(() => {
    if (!selectedExchange) return;
    // Find a participating country to generate scenario with
    const targetCountryId =
      selectedExchange.participatingCountries[0]?.id || selectedExchange.hostCountry.id;
    generateScenarioMutation.mutate({
      targetCountryId,
      preferredScenarioType: selectedExchange.type,
    });
  }, [selectedExchange, generateScenarioMutation]);

  const handleCalculateImpact = useCallback(() => {
    if (!selectedExchange) return;
    calculateImpactMutation.mutate({
      exchangeId: selectedExchange.id,
      responseChoice: "collaborative",
      participantSatisfaction: selectedExchange.metrics.culturalImpact,
      publicPerception: selectedExchange.metrics.socialEngagement,
    });
  }, [selectedExchange, calculateImpactMutation]);

  const handleCancelExchange = useCallback(() => {
    if (!selectedExchange) return;
    if (
      confirm(
        "Are you sure you want to cancel this exchange? This will negatively impact diplomatic relations."
      )
    ) {
      cancelExchangeMutation.mutate({
        exchangeId: selectedExchange.id,
        hostCountryId: primaryCountry.id,
      });
    }
  }, [selectedExchange, primaryCountry.id, cancelExchangeMutation]);

  const handleSelectScenarioResponse = useCallback((option: ResponseOption) => {
    console.log("Selected scenario response:", option);
    notify.success(`Selected: ${option.label}`);
    setShowScenarioModal(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        <Card className="rounded-card px-6 py-12 text-center">
          <Globe className="text-label-secondary mx-auto mb-3 h-6 w-6" />
          <h4 className="text-label text-title-3 mb-1">No cultural exchanges found</h4>
          <p className="text-label-secondary text-body mb-5">
            {filterType !== "all" || filterStatus !== "all"
              ? "Try adjusting your filters or create a new exchange to get started."
              : "Be the first to create a cultural exchange and connect nations."}
          </p>
          <Button variant="outline" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            Create your first exchange
          </Button>
        </Card>
      )}

      {/* Create Exchange Modal (Wizard) */}
      <Sheet open={showCreateModal} onOpenChange={setShowCreateModal}>
        <SheetContent size="wide" className="flex flex-col overflow-hidden p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Create cultural exchange</SheetTitle>
          </SheetHeader>
          <CulturalExchangeWizard
            hostCountry={primaryCountry}
            onComplete={handleCreateExchange}
            onCancel={() => setShowCreateModal(false)}
          />
        </SheetContent>
      </Sheet>

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
        isSubmitting={isUploadingArtifactFile || uploadArtifactMutation.isPending}
      />
    </div>
  );
};

CulturalExchangeProgramComponent.displayName = "CulturalExchangeProgram";

export const CulturalExchangeProgram = CulturalExchangeProgramComponent;
export default CulturalExchangeProgramComponent;
