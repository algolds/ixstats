"use client";

import React, { useState, useMemo } from "react";
import { Globe, Plus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { CulturalExchangeWizard } from "./CulturalExchangeWizard";
import type { CulturalExchange, CulturalExchangeProgramProps } from "./cultural-exchange-types";
import { EXCHANGE_TYPES, STATUS_STYLES } from "./cultural-exchange-types";
import {
  deriveAchievements,
  filterExchanges,
  summarizeExchanges,
  toExchanges,
} from "./cultural-exchange-stats";
import { ExchangeHeader } from "./ExchangeHeader";
import { ExchangeMetrics } from "./ExchangeMetrics";
import { ExchangeFilters } from "./ExchangeFilters";
import { ExchangeCard } from "./ExchangeCard";
import { useExchangeActions } from "./useExchangeActions";
import { ExchangeDetailsModal } from "./ExchangeDetailsModal";
import { EditExchangeModal } from "./EditExchangeModal";
import { ScenarioModal, type ResponseOption, type Scenario } from "./ScenarioModal";
import { ImpactVisualizationModal } from "./ImpactVisualizationModal";
import { ArtifactUploadModal } from "./ArtifactUploadModal";
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
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [showImpactVisualization, setShowImpactVisualization] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [editFormData, setEditFormData] = useState({ title: "", description: "" });

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

  const {
    handleCreateExchange,
    updateExchangeMutation,
    generateScenarioMutation,
    calculateImpactMutation,
    uploadArtifactMutation,
    shareToThinkPagesMutation,
    cancelExchangeMutation,
    votedExchanges,
    isUploadingArtifactFile,
    handleJoinExchange,
    handleVoteExchange,
    handleUploadArtifact,
    handleShareToThinkPages,
    handleGenerateScenario,
    handleCalculateImpact,
    handleCancelExchange,
  } = useExchangeActions(selectedExchange, primaryCountry, {
    refetch: refetchExchanges,
    onCreated: () => setShowCreateModal(false),
    onArtifactUploaded: () => setShowArtifactUpload(false),
    onScenario: (scenario) => {
      setSelectedScenario(scenario);
      setShowScenarioModal(true);
    },
    onImpact: () => setShowImpactVisualization(true),
    onUpdated: () => setShowEditModal(false),
    onCancelled: () => {
      setShowDetailsModal(false);
      setSelectedExchange(null);
    },
  });

  const { data: npcResponses } = api.diplomaticCultural.getNPCCulturalResponses.useQuery(
    {
      exchangeId: selectedExchange?.id || "",
      hostCountryId: primaryCountry.id,
    },
    {
      enabled: !!selectedExchange?.id && selectedExchange.participatingCountries.length > 0,
    }
  );

  const exchanges = useMemo(
    () => (liveExchanges?.length ? toExchanges(liveExchanges) : (propExchanges ?? [])),
    [liveExchanges, propExchanges]
  );

  const filteredExchanges = filterExchanges(exchanges, filterType, filterStatus);
  const participationMetrics = summarizeExchanges(exchanges);
  const achievements = deriveAchievements(exchanges, primaryCountry.id);

  const handleCardClick = (exchange: CulturalExchange) => {
    setSelectedExchange(exchange);
    setShowDetailsModal(true);
  };

  const handleEditClick = (exchange: CulturalExchange) => {
    setSelectedExchange(exchange);
    setEditFormData({ title: exchange.title, description: exchange.description });
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!selectedExchange) return;
    updateExchangeMutation.mutate({ exchangeId: selectedExchange.id, ...editFormData });
  };

  const handleSelectScenarioResponse = (option: ResponseOption) => {
    notify.success(`Selected: ${option.label}`);
    setShowScenarioModal(false);
  };

  return (
    <div className="cultural-exchange-program space-y-6">
      <ExchangeHeader
        primaryCountry={primaryCountry}
        achievements={achievements}
        filteredExchangesCount={filteredExchanges.length}
        isLoading={exchangesLoading}
        onCreateExchange={() => setShowCreateModal(true)}
      />

      <ExchangeMetrics metrics={participationMetrics} />

      <ExchangeFilters
        filterType={filterType}
        setFilterType={setFilterType}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        exchangeTypes={EXCHANGE_TYPES}
        statusStyles={STATUS_STYLES}
      />

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

      <EditExchangeModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        exchange={selectedExchange}
        formData={editFormData}
        onFormDataChange={setEditFormData}
        onSave={handleSaveEdit}
        isPending={updateExchangeMutation.isPending}
      />

      <ScenarioModal
        open={showScenarioModal}
        onOpenChange={setShowScenarioModal}
        scenario={selectedScenario}
        onSelectResponse={handleSelectScenarioResponse}
      />

      <ImpactVisualizationModal
        open={showImpactVisualization}
        onOpenChange={setShowImpactVisualization}
        impactData={calculateImpactMutation.data || null}
      />

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
