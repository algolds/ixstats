import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { uploadImageFile } from "~/lib/media/upload-image";
import type { ArtifactUploadData } from "./ArtifactUploadForm";
import type { Scenario } from "./ScenarioModal";
import {
  EXCHANGE_TYPES,
  type CulturalExchange,
  type CulturalExchangeProgramProps,
  type ExchangeType,
} from "./cultural-exchange-types";

export interface ExchangeMutationCallbacks {
  refetch: () => unknown;
  onCreated: () => void;
  onArtifactUploaded: () => void;
  onScenario: (scenario: Scenario) => void;
  onImpact: () => void;
  onUpdated: () => void;
  onCancelled: () => void;
}

function useExchangeMutations(cb: ExchangeMutationCallbacks) {
  const notify = useNotify();
  const cx = api.diplomaticCultural;
  const failed = (action: string) => (error: { message: string }) =>
    notify.error(`Failed to ${action}: ${error.message}`);
  /** Success toast, the caller's follow-up, then a list refresh. */
  const succeeded = (message: string, followUp?: () => void) => () => {
    notify.success(message);
    followUp?.();
    void cb.refetch();
  };

  return {
    createExchangeMutation: cx.createCulturalExchange.useMutation({
      onSuccess: succeeded("Cultural exchange created", cb.onCreated),
      onError: failed("create exchange"),
    }),
    joinExchangeMutation: cx.joinCulturalExchange.useMutation({
      onSuccess: succeeded("Joined cultural exchange"),
      onError: failed("join exchange"),
    }),
    voteExchangeMutation: cx.voteOnExchange.useMutation({
      onSuccess: succeeded("Vote recorded"),
      onError: failed("vote"),
    }),
    uploadArtifactMutation: cx.uploadCulturalArtifact.useMutation({
      onSuccess: succeeded("Artifact uploaded", cb.onArtifactUploaded),
      onError: failed("upload artifact"),
    }),
    generateScenarioMutation: cx.generateCulturalScenario.useMutation({
      onSuccess: (data) => {
        cb.onScenario({
          title: data.scenario.title,
          narrative: data.scenario.narrative,
          responseOptions: data.responseOptions,
        });
        notify.success("Scenario generated");
      },
      onError: failed("generate scenario"),
    }),
    calculateImpactMutation: cx.calculateExchangeImpact.useMutation({
      onSuccess: succeeded("Impact calculated", cb.onImpact),
      onError: failed("calculate impact"),
    }),
    updateExchangeMutation: cx.updateCulturalExchange.useMutation({
      onSuccess: succeeded("Exchange updated", cb.onUpdated),
      onError: failed("update exchange"),
    }),
    cancelExchangeMutation: cx.cancelCulturalExchange.useMutation({
      onSuccess: ({ penalties }) => {
        notify.success(
          "Exchange cancelled",
          `Reputation: ${penalties.reputationLoss}, Relations: ${penalties.relationshipPenalty}%`
        );
        cb.onCancelled();
        void cb.refetch();
      },
      onError: failed("cancel exchange"),
    }),
    shareToThinkPagesMutation: api.thinkpages.createPost.useMutation({
      onSuccess: () =>
        notify.success(
          "Shared to ThinkPages!",
          "Your cultural exchange is now visible on the global feed"
        ),
      onError: failed("share"),
    }),
  };
}

/**
 * The exchange mutations plus the handlers that act on the selected exchange. Each mutation toasts,
 * refreshes the list and hands UI follow-ups to the caller.
 */
export function useExchangeActions(
  selectedExchange: CulturalExchange | null,
  primaryCountry: CulturalExchangeProgramProps["primaryCountry"],
  callbacks: ExchangeMutationCallbacks
) {
  const notify = useNotify();
  const [isUploadingArtifactFile, setIsUploadingArtifactFile] = useState(false);
  const [votedExchanges, setVotedExchanges] = useState<Set<string>>(new Set());
  const mutations = useExchangeMutations(callbacks);
  const {
    createExchangeMutation,
    joinExchangeMutation,
    voteExchangeMutation,
    uploadArtifactMutation,
    generateScenarioMutation,
    calculateImpactMutation,
    cancelExchangeMutation,
    shareToThinkPagesMutation,
  } = mutations;

  const handleCreateExchange = (wizardData: {
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
    if (
      !wizardData.title ||
      !wizardData.description ||
      !wizardData.startDate ||
      !wizardData.endDate
    ) {
      notify.error("Please fill in all required fields");
      return;
    }

    createExchangeMutation.mutate({
      title: wizardData.title,
      type: wizardData.type as ExchangeType,
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
    });
  };

  const handleJoinExchange = (exchangeId: string, role: "participant" | "observer") =>
    joinExchangeMutation.mutate({
      exchangeId,
      countryId: primaryCountry.id,
      countryName: primaryCountry.name,
      flagUrl: primaryCountry.flagUrl,
      role,
    });

  const handleVoteExchange = (exchangeId: string, voteType: "up" | "down") => {
    if (votedExchanges.has(exchangeId)) {
      notify.info("You have already voted on this exchange");
      return;
    }
    voteExchangeMutation.mutate({
      exchangeId,
      vote: voteType === "up" ? "support" : "oppose",
    });
    setVotedExchanges((prev) => new Set(prev).add(exchangeId));
  };

  // Store the file via /api/upload/image first, then record the artifact with its URL.
  // `contributor` is the display attribution; the server derives countryId from the session.
  const handleUploadArtifact = async (artifact: ArtifactUploadData) => {
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
  };

  const handleShareToThinkPages = () => {
    if (!selectedExchange) return;
    const typeConfig = EXCHANGE_TYPES[selectedExchange.type];
    shareToThinkPagesMutation.mutate({
      accountId: primaryCountry.id,
      content: `${typeConfig.emoji} **${selectedExchange.title}**\n\n${selectedExchange.description}\n\n#CulturalExchange #${selectedExchange.type}`,
      visibility: "public",
      hashtags: ["cultural-exchange", selectedExchange.type],
    });
  };

  const handleGenerateScenario = () => {
    if (!selectedExchange) return;
    generateScenarioMutation.mutate({
      targetCountryId:
        selectedExchange.participatingCountries[0]?.id || selectedExchange.hostCountry.id,
      preferredScenarioType: selectedExchange.type,
    });
  };

  const handleCalculateImpact = () => {
    if (!selectedExchange) return;
    calculateImpactMutation.mutate({
      exchangeId: selectedExchange.id,
      responseChoice: "collaborative",
      participantSatisfaction: selectedExchange.metrics.culturalImpact,
      publicPerception: selectedExchange.metrics.socialEngagement,
    });
  };

  const handleCancelExchange = () => {
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
  };

  return {
    ...mutations,
    handleCreateExchange,
    votedExchanges,
    isUploadingArtifactFile,
    handleJoinExchange,
    handleVoteExchange,
    handleUploadArtifact,
    handleShareToThinkPages,
    handleGenerateScenario,
    handleCalculateImpact,
    handleCancelExchange,
  };
}
