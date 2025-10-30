"use client";

import React from "react";
import { cn } from "~/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import {
  RiGlobalLine,
  RiQuillPenLine,
  RiFlagLine,
  RiCheckboxCircleLine,
  RiBrainLine,
  RiSettings4Line,
  RiCalendarLine,
  RiEyeLine,
  RiEyeOffLine,
  RiUserVoiceLine,
  RiFlashlightLine,
  RiLightbulbLine,
  RiCameraLine,
  RiUserLine,
  RiEditLine,
  RiShareLine,
  RiCloseLine,
  RiCheckLine,
  RiBarChartLine,
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
  metrics: {
    participants: number;
    culturalImpact: number;
    socialEngagement: number;
  };
  culturalArtifacts: Array<{
    id: string;
    type: 'photo' | 'video' | 'document' | 'artwork' | 'recipe' | 'music';
    title: string;
    thumbnailUrl?: string;
  }>;
}

interface NPCResponse {
  countryId: string;
  countryName: string;
  flagUrl?: string;
  role: string;
  willParticipate: boolean;
  personality: {
    archetype: string;
  };
  responseTimeline: string;
  enthusiasmLevel: number;
  resourceCommitment: number;
  responseMessage: string;
  conditions?: string[];
  alternativeProposal?: {
    reasoning: string;
  };
}

interface ExchangeDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exchange: CulturalExchange | null;
  onJoin: (exchangeId: string, role: 'participant' | 'observer') => void;
  onShare: () => void;
  onUploadArtifact: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onCalculateImpact: () => void;
  onViewArtifact?: (artifactId: string) => void;
  onGenerateScenario: () => void;
  primaryCountry: {
    id: string;
    name: string;
  };
  npcResponses?: NPCResponse[];
  exchangeTypes: Record<string, { icon: any; label: string; color: string; emoji: string }>;
  isGeneratingScenario?: boolean;
  isSharing?: boolean;
  isCancelling?: boolean;
  isCalculating?: boolean;
}

export const ExchangeDetailsModal = React.memo<ExchangeDetailsModalProps>(({
  open,
  onOpenChange,
  exchange,
  onJoin,
  onShare,
  onUploadArtifact,
  onCancel,
  onEdit,
  onCalculateImpact,
  onViewArtifact,
  onGenerateScenario,
  primaryCountry,
  npcResponses,
  exchangeTypes,
  isGeneratingScenario = false,
  isSharing = false,
  isCancelling = false,
  isCalculating = false,
}) => {
  if (!exchange) return null;

  const typeConfig = exchangeTypes[exchange.type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <RiGlobalLine className="h-6 w-6 text-[--intel-gold]" />
            Exchange Details
          </DialogTitle>
          <DialogDescription>
            Comprehensive view of cultural exchange program
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            {/* Exchange Overview */}
            <div className="space-y-4">
              <div>
                <h5 className="text-lg font-bold text-foreground mb-2">{exchange.title}</h5>
                <div className="flex items-center gap-2 mb-3">
                  {React.createElement(typeConfig.icon, {
                    className: cn("h-5 w-5", typeConfig.color)
                  })}
                  <span className="text-[--intel-silver]">
                    {typeConfig.label}
                  </span>
                </div>
                <p className="text-[--intel-silver] text-sm">{exchange.description}</p>
              </div>

              {/* Narrative */}
              {(exchange as any).narrative && (
                <div className="glass-hierarchy-child rounded-lg p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <RiQuillPenLine className="h-4 w-4 text-purple-400" />
                    <h6 className="font-medium text-foreground">Exchange Narrative</h6>
                  </div>
                  <p className="text-[--intel-silver] text-sm leading-relaxed">
                    {(exchange as any).narrative}
                  </p>
                </div>
              )}

              {/* Objectives */}
              {(exchange as any).objectives && JSON.parse((exchange as any).objectives || '[]').length > 0 && (
                <div className="glass-hierarchy-child rounded-lg p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <RiFlagLine className="h-4 w-4 text-green-400" />
                    <h6 className="font-medium text-foreground">Program Objectives</h6>
                  </div>
                  <div className="space-y-2">
                    {JSON.parse((exchange as any).objectives || '[]').map((objective: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2">
                        <RiCheckboxCircleLine className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-[--intel-silver]">{objective}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Diplomatic Analysis */}
              <div className="glass-hierarchy-child rounded-lg p-4 border border-cyan-500/30 bg-cyan-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <RiBrainLine className="h-4 w-4 text-cyan-400" />
                  <h6 className="font-medium text-foreground">Diplomatic Analysis</h6>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[--intel-silver] mb-2">Predicted Impact</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[--intel-silver]">Cultural Alignment</span>
                        <span className="text-cyan-400 font-medium">
                          {Math.round(60 + Math.random() * 30)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[--intel-silver]">Diplomatic Benefit</span>
                        <span className="text-green-400 font-medium">High</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[--intel-silver]">Success Probability</span>
                        <span className="text-purple-400 font-medium">
                          {Math.round(65 + Math.random() * 25)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-xs text-cyan-400/80 italic">
                      "This {typeConfig.label.toLowerCase()} between{' '}
                      {exchange.hostCountry.name} and participating nations shows strong potential
                      for cultural bridge-building and long-term diplomatic cooperation."
                    </p>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-white/5 rounded-lg">
                  <div className="text-lg font-bold text-purple-400">
                    {exchange.metrics.participants}
                  </div>
                  <div className="text-xs text-[--intel-silver]">Participants</div>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-lg">
                  <div className="text-lg font-bold text-[--intel-gold]">
                    {exchange.metrics.culturalImpact}%
                  </div>
                  <div className="text-xs text-[--intel-silver]">Impact</div>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-lg">
                  <div className="text-lg font-bold text-blue-400">
                    {exchange.metrics.socialEngagement}
                  </div>
                  <div className="text-xs text-[--intel-silver]">Engagement</div>
                </div>
              </div>

              {/* Schedule & Settings */}
              <div className="glass-hierarchy-child rounded-lg p-4 border border-white/10">
                <h6 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <RiSettings4Line className="h-4 w-4" />
                  Program Details
                </h6>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[--intel-silver]">Duration</span>
                    <div className="flex items-center gap-1 text-foreground">
                      <RiCalendarLine className="h-3.5 w-3.5" />
                      <span>
                        {new Date(exchange.startDate).toLocaleDateString()} -{' '}
                        {new Date(exchange.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[--intel-silver]">Visibility</span>
                    <span className="text-foreground flex items-center gap-1">
                      {(exchange as any).isPublic !== false ? (
                        <>
                          <RiEyeLine className="h-3.5 w-3.5 text-green-400" />
                          Public
                        </>
                      ) : (
                        <>
                          <RiEyeOffLine className="h-3.5 w-3.5 text-orange-400" />
                          Private
                        </>
                      )}
                    </span>
                  </div>
                  {(exchange as any).maxParticipants && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[--intel-silver]">Max Participants</span>
                      <span className="text-foreground">{(exchange as any).maxParticipants}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* NPC Participant Responses */}
              {exchange.participatingCountries.length > 0 && (
                <div className="space-y-3">
                  <h6 className="font-medium text-foreground flex items-center gap-2">
                    <RiUserVoiceLine className="h-4 w-4" />
                    NPC Responses ({npcResponses?.length || exchange.participatingCountries.length})
                  </h6>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {npcResponses && npcResponses.length > 0 ? (
                      // Real AI-generated responses
                      npcResponses.map((response) => (
                        <div
                          key={response.countryId}
                          className="glass-hierarchy-child rounded-lg p-3 border border-white/10"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {response.flagUrl && (
                              <img
                                src={response.flagUrl}
                                alt={`${response.countryName} flag`}
                                className="w-5 h-3 object-cover rounded border border-white/20"
                              />
                            )}
                            <span className="font-medium text-foreground text-sm">{response.countryName}</span>
                            <span className={cn(
                              "ml-auto px-2 py-0.5 rounded-full text-xs",
                              response.willParticipate
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                            )}>
                              {response.role.charAt(0).toUpperCase() + response.role.slice(1)}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {/* Personality Archetype */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-purple-400">{response.personality.archetype}</span>
                              <span className="text-[--intel-silver]">•</span>
                              <span className="text-[--intel-silver]">{response.responseTimeline} response</span>
                            </div>

                            {/* Enthusiasm Level */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[--intel-silver]">Enthusiasm</span>
                              <span className="text-foreground font-medium">{Math.round(response.enthusiasmLevel)}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1.5">
                              <div
                                className={cn(
                                  "h-1.5 rounded-full",
                                  response.enthusiasmLevel > 70 ? "bg-green-400" :
                                  response.enthusiasmLevel > 50 ? "bg-yellow-400" : "bg-orange-400"
                                )}
                                style={{ width: `${response.enthusiasmLevel}%` }}
                              />
                            </div>

                            {/* Resource Commitment */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[--intel-silver]">Resource Commitment</span>
                              <span className="text-foreground font-medium">{Math.round(response.resourceCommitment)}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1.5">
                              <div
                                className="bg-blue-400 h-1.5 rounded-full"
                                style={{ width: `${response.resourceCommitment}%` }}
                              />
                            </div>

                            {/* AI Response Message */}
                            <p className="text-xs text-[--intel-silver] italic mt-2">
                              "{response.responseMessage}"
                            </p>

                            {/* Conditions (if any) */}
                            {response.conditions && response.conditions.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-white/5">
                                <span className="text-xs text-orange-400 font-medium">Conditions:</span>
                                <ul className="text-xs text-[--intel-silver] mt-1 space-y-0.5">
                                  {response.conditions.map((condition, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <span className="text-orange-400">•</span>
                                      <span>{condition}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Alternative Proposal (if rejected) */}
                            {!response.willParticipate && response.alternativeProposal && (
                              <div className="mt-2 pt-2 border-t border-white/5">
                                <span className="text-xs text-cyan-400 font-medium">Alternative Proposal:</span>
                                <p className="text-xs text-[--intel-silver] mt-1">
                                  {response.alternativeProposal.reasoning}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      // Loading state or fallback
                      exchange.participatingCountries.map((country) => (
                        <div
                          key={country.id}
                          className="glass-hierarchy-child rounded-lg p-3 border border-white/10"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {country.flagUrl && (
                              <img
                                src={country.flagUrl}
                                alt={`${country.name} flag`}
                                className="w-5 h-3 object-cover rounded border border-white/20"
                              />
                            )}
                            <span className="font-medium text-foreground text-sm">{country.name}</span>
                            <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-400">
                              {country.role.charAt(0).toUpperCase() + country.role.slice(1)}
                            </span>
                          </div>
                          <p className="text-xs text-[--intel-silver] italic">
                            Analyzing response...
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Scenario Generation */}
              {exchange.status === 'active' && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <RiFlashlightLine className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h6 className="font-medium text-foreground mb-1">Generate Scenario</h6>
                      <p className="text-xs text-[--intel-silver] mb-3">
                        Create a dynamic cultural exchange scenario with narrative choices and predicted outcomes
                      </p>
                      <button
                        onClick={onGenerateScenario}
                        disabled={isGeneratingScenario}
                        className="w-full flex items-center justify-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGeneratingScenario ? (
                          <>
                            <div className="w-4 h-4 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <RiLightbulbLine className="h-4 w-4" />
                            Generate Scenario
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Cultural Artifacts Preview */}
              {exchange.culturalArtifacts.length > 0 && (
                <div className="space-y-3">
                  <h6 className="font-medium text-foreground flex items-center gap-2">
                    <RiCameraLine className="h-4 w-4" />
                    Cultural Artifacts ({exchange.culturalArtifacts.length})
                  </h6>
                  <div className="grid grid-cols-2 gap-2">
                    {exchange.culturalArtifacts.slice(0, 4).map((artifact) => (
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
              {exchange.status === 'active' && (
                <>
                  <button
                    onClick={() => onJoin(exchange.id, 'participant')}
                    className="w-full flex items-center justify-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-3 rounded-lg font-medium transition-colors"
                  >
                    <RiUserLine className="h-4 w-4" />
                    Join as Participant
                  </button>
                  <button
                    onClick={() => onJoin(exchange.id, 'observer')}
                    className="w-full flex items-center justify-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-3 rounded-lg font-medium transition-colors"
                  >
                    <RiEyeLine className="h-4 w-4" />
                    Observe Exchange
                  </button>
                  <button
                    onClick={onUploadArtifact}
                    className="w-full flex items-center justify-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-3 rounded-lg font-medium transition-colors"
                  >
                    <RiCameraLine className="h-4 w-4" />
                    Upload Artifact
                  </button>
                </>
              )}

              {exchange.status === 'completed' && (
                <button
                  onClick={onCalculateImpact}
                  disabled={isCalculating}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isCalculating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-orange-400/20 border-t-orange-400 rounded-full animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <RiBarChartLine className="h-4 w-4" />
                      Calculate Impact
                    </>
                  )}
                </button>
              )}

            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            {exchange.hostCountry.id === primaryCountry.id ? (
              <>
                <button
                  onClick={onEdit}
                  className="flex-1 flex items-center justify-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  <RiEditLine className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={onShare}
                  disabled={isSharing}
                  className="flex-1 flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isSharing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-purple-400/20 border-t-purple-400 rounded-full animate-spin" />
                      Sharing...
                    </>
                  ) : (
                    <>
                      <RiShareLine className="h-4 w-4" />
                      Share
                    </>
                  )}
                </button>
                {exchange.status === 'planning' && (
                  <button
                    onClick={onCancel}
                    disabled={isCancelling}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isCancelling ? (
                      <>
                        <div className="w-4 h-4 border-2 border-red-400/20 border-t-red-400 rounded-full animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <RiCloseLine className="h-4 w-4" />
                        Cancel
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onShare}
                disabled={isSharing}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isSharing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-purple-400/20 border-t-purple-400 rounded-full animate-spin" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <RiShareLine className="h-4 w-4" />
                    Share
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

ExchangeDetailsModal.displayName = 'ExchangeDetailsModal';
