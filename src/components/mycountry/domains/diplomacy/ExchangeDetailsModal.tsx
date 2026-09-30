"use client";

import {
  Brain,
  Calendar,
  Camera,
  CheckCircle,
  EditPencil,
  Eye,
  EyeClosed,
  WhiteFlag,
  Flash,
  Globe,
  LightBulb,
  Settings,
  ShareAndroid,
  StatsReport,
  User,
  MicrophoneSpeaking,
  Xmark,
} from "iconoir-react";

import React from "react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";

interface CulturalExchange {
  id: string;
  title: string;
  type:
    | "festival"
    | "exhibition"
    | "education"
    | "cuisine"
    | "arts"
    | "sports"
    | "technology"
    | "diplomacy";
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
    role: "co-host" | "participant" | "observer";
  }>;
  status: "planning" | "active" | "completed" | "cancelled";
  startDate: string;
  endDate: string;
  metrics: {
    participants: number;
    culturalImpact: number;
    socialEngagement: number;
  };
  culturalArtifacts: Array<{
    id: string;
    type: "photo" | "video" | "document" | "artwork" | "recipe" | "music";
    title: string;
    thumbnailUrl?: string;
  }>;
  // Optional program details (columns on the CulturalExchange model).
  narrative?: string | null;
  /** JSON-encoded string[] */
  objectives?: string | null;
  isPublic?: boolean;
  maxParticipants?: number | null;
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
  onJoin: (exchangeId: string, role: "participant" | "observer") => void;
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
  exchangeTypes: Record<
    string,
    {
      icon: React.ComponentType<{ className?: string }>;
      label: string;
      color: string;
      emoji: string;
    }
  >;
  isGeneratingScenario?: boolean;
  isSharing?: boolean;
  isCancelling?: boolean;
  isCalculating?: boolean;
}

/** A section inside the dialog: an opaque Facet surface so blur never stacks on the dialog. */
function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <FacetCard surface="solid" className="rounded-xl p-4">
      <h6 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="text-muted-foreground h-4 w-4" />
        {title}
      </h6>
      {children}
    </FacetCard>
  );
}

export const ExchangeDetailsModal = React.memo<ExchangeDetailsModalProps>(
  ({
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
    const objectives: string[] = exchange.objectives ? JSON.parse(exchange.objectives) : [];
    const shareButton = (
      <Button variant="outline" className="flex-1" onClick={onShare} disabled={isSharing}>
        <ShareAndroid className="h-4 w-4" />
        {isSharing ? "Sharing…" : "Share"}
      </Button>
    );

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="text-muted-foreground h-5 w-5" />
              Exchange Details
            </DialogTitle>
            <DialogDescription>Comprehensive view of cultural exchange program</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <h5 className="text-foreground mb-2 text-lg font-semibold">{exchange.title}</h5>
                <div className="mb-3 flex items-center gap-2 text-sm">
                  {React.createElement(typeConfig.icon, {
                    className: "text-muted-foreground h-4 w-4",
                  })}
                  <span className="text-muted-foreground">{typeConfig.label}</span>
                </div>
                <p className="text-muted-foreground text-sm">{exchange.description}</p>
              </div>

              {exchange.narrative && (
                <DetailSection icon={EditPencil} title="Exchange Narrative">
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {exchange.narrative}
                  </p>
                </DetailSection>
              )}

              {objectives.length > 0 && (
                <DetailSection icon={WhiteFlag} title="Program Objectives">
                  <ul className="space-y-2">
                    {objectives.map((objective, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span className="text-muted-foreground text-sm">{objective}</span>
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              )}

              <DetailSection icon={Brain} title="Diplomatic Outlook">
                <p className="text-muted-foreground text-sm italic">
                  This {typeConfig.label.toLowerCase()} between {exchange.hostCountry.name} and
                  participating nations shows potential for cultural bridge-building and long-term
                  diplomatic cooperation.
                </p>
              </DetailSection>

              <dl className="grid grid-cols-3 gap-3">
                {[
                  { label: "Participants", value: String(exchange.metrics.participants) },
                  { label: "Impact", value: `${exchange.metrics.culturalImpact}%` },
                  { label: "Engagement", value: String(exchange.metrics.socialEngagement) },
                ].map((m) => (
                  <div key={m.label} className="bg-muted/50 rounded-xl p-3 text-center">
                    <dd className="text-foreground text-lg font-semibold tabular-nums">
                      {m.value}
                    </dd>
                    <dt>
                      <Eyebrow>{m.label}</Eyebrow>
                    </dt>
                  </div>
                ))}
              </dl>

              <DetailSection icon={Settings} title="Program Details">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="text-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(exchange.startDate).toLocaleDateString()} –{" "}
                      {new Date(exchange.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Visibility</span>
                    <span className="text-foreground flex items-center gap-1">
                      {exchange.isPublic !== false ? (
                        <>
                          <Eye className="text-muted-foreground h-3.5 w-3.5" />
                          Public
                        </>
                      ) : (
                        <>
                          <EyeClosed className="text-muted-foreground h-3.5 w-3.5" />
                          Private
                        </>
                      )}
                    </span>
                  </div>
                  {exchange.maxParticipants && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Max Participants</span>
                      <span className="text-foreground tabular-nums">
                        {exchange.maxParticipants}
                      </span>
                    </div>
                  )}
                </div>
              </DetailSection>

              {exchange.participatingCountries.length > 0 && (
                <div className="space-y-3">
                  <h6 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <MicrophoneSpeaking className="text-muted-foreground h-4 w-4" />
                    NPC Responses ({npcResponses?.length || exchange.participatingCountries.length})
                  </h6>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {npcResponses && npcResponses.length > 0
                      ? npcResponses.map((response) => (
                          <FacetCard
                            key={response.countryId}
                            surface="solid"
                            className="rounded-xl p-3"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              {response.flagUrl && (
                                <img
                                  src={response.flagUrl}
                                  alt={`${response.countryName} flag`}
                                  className="border-border h-3 w-5 rounded-sm border object-cover"
                                />
                              )}
                              <span className="text-foreground text-sm font-medium">
                                {response.countryName}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "ml-auto capitalize",
                                  response.willParticipate ? "text-emerald-500" : "text-destructive"
                                )}
                              >
                                {response.role}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <p className="text-muted-foreground text-xs">
                                <span className="text-foreground">
                                  {response.personality.archetype}
                                </span>{" "}
                                · {response.responseTimeline} response
                              </p>

                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Enthusiasm</span>
                                <span className="text-foreground font-medium tabular-nums">
                                  {Math.round(response.enthusiasmLevel)}%
                                </span>
                              </div>
                              <Progress
                                value={response.enthusiasmLevel}
                                className="h-1.5"
                                indicatorClassName={
                                  response.enthusiasmLevel > 70
                                    ? "bg-emerald-500"
                                    : response.enthusiasmLevel > 50
                                      ? "bg-amber-500"
                                      : "bg-destructive"
                                }
                              />

                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Resource Commitment</span>
                                <span className="text-foreground font-medium tabular-nums">
                                  {Math.round(response.resourceCommitment)}%
                                </span>
                              </div>
                              <Progress value={response.resourceCommitment} className="h-1.5" />

                              <p className="text-muted-foreground mt-2 text-xs italic">
                                &ldquo;{response.responseMessage}&rdquo;
                              </p>

                              {response.conditions && response.conditions.length > 0 && (
                                <div className="border-border mt-2 border-t pt-2">
                                  <Eyebrow>Conditions</Eyebrow>
                                  <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4 text-xs">
                                    {response.conditions.map((condition, idx) => (
                                      <li key={idx}>{condition}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {!response.willParticipate && response.alternativeProposal && (
                                <div className="border-border mt-2 border-t pt-2">
                                  <Eyebrow>Alternative proposal</Eyebrow>
                                  <p className="text-muted-foreground mt-1 text-xs">
                                    {response.alternativeProposal.reasoning}
                                  </p>
                                </div>
                              )}
                            </div>
                          </FacetCard>
                        ))
                      : exchange.participatingCountries.map((country) => (
                          <FacetCard key={country.id} surface="solid" className="rounded-xl p-3">
                            <div className="mb-2 flex items-center gap-2">
                              {country.flagUrl && (
                                <img
                                  src={country.flagUrl}
                                  alt={`${country.name} flag`}
                                  className="border-border h-3 w-5 rounded-sm border object-cover"
                                />
                              )}
                              <span className="text-foreground text-sm font-medium">
                                {country.name}
                              </span>
                              <Badge variant="outline" className="ml-auto capitalize">
                                {country.role}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-xs italic">
                              Analyzing response…
                            </p>
                          </FacetCard>
                        ))}
                  </div>
                </div>
              )}

              {exchange.status === "active" && (
                <DetailSection icon={Flash} title="Generate Scenario">
                  <p className="text-muted-foreground mb-3 text-xs">
                    Create a dynamic cultural exchange scenario with narrative choices and predicted
                    outcomes
                  </p>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={onGenerateScenario}
                    disabled={isGeneratingScenario}
                  >
                    <LightBulb className="h-4 w-4" />
                    {isGeneratingScenario ? "Generating…" : "Generate Scenario"}
                  </Button>
                </DetailSection>
              )}

              {exchange.culturalArtifacts.length > 0 && (
                <div className="space-y-3">
                  <h6 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <Camera className="text-muted-foreground h-4 w-4" />
                    Cultural Artifacts ({exchange.culturalArtifacts.length})
                  </h6>
                  <div className="grid grid-cols-2 gap-2">
                    {exchange.culturalArtifacts.slice(0, 4).map((artifact) => (
                      <button
                        key={artifact.id}
                        type="button"
                        onClick={() => onViewArtifact?.(artifact.id)}
                        aria-label={`View ${artifact.title}`}
                        className="border-border bg-muted/50 hover:border-ring focus-visible:ring-ring flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border transition-colors outline-none focus-visible:ring-2"
                      >
                        {artifact.thumbnailUrl ? (
                          <img
                            src={artifact.thumbnailUrl}
                            alt={artifact.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Camera className="text-muted-foreground h-6 w-6" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {(exchange.status === "active" || exchange.status === "completed") && (
              <div className="border-border flex flex-col gap-2 border-t pt-4 sm:flex-row">
                {exchange.status === "active" && (
                  <>
                    <Button
                      className="flex-1 bg-amber-500 text-amber-950 hover:bg-amber-500/90"
                      onClick={() => onJoin(exchange.id, "participant")}
                    >
                      <User className="h-4 w-4" />
                      Join as Participant
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => onJoin(exchange.id, "observer")}
                    >
                      <Eye className="h-4 w-4" />
                      Observe Exchange
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={onUploadArtifact}>
                      <Camera className="h-4 w-4" />
                      Upload Artifact
                    </Button>
                  </>
                )}

                {exchange.status === "completed" && (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={onCalculateImpact}
                    disabled={isCalculating}
                  >
                    <StatsReport className="h-4 w-4" />
                    {isCalculating ? "Calculating…" : "Calculate Impact"}
                  </Button>
                )}
              </div>
            )}

            <div className="border-border flex flex-col gap-2 border-t pt-4 sm:flex-row">
              {exchange.hostCountry.id === primaryCountry.id ? (
                <>
                  <Button variant="outline" className="flex-1" onClick={onEdit}>
                    <EditPencil className="h-4 w-4" />
                    Edit
                  </Button>
                  {shareButton}
                  {exchange.status === "planning" && (
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={onCancel}
                      disabled={isCancelling}
                    >
                      <Xmark className="h-4 w-4" />
                      {isCancelling ? "Cancelling…" : "Cancel"}
                    </Button>
                  )}
                </>
              ) : (
                shareButton
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

ExchangeDetailsModal.displayName = "ExchangeDetailsModal";
