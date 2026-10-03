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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { Card } from "~/components/ui/card";

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
    <Card className="p-4">
      <h6 className="text-label text-headline mb-3 flex items-center gap-2">
        <Icon className="text-label-secondary h-4 w-4" />
        {title}
      </h6>
      {children}
    </Card>
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
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent size="wide" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Globe className="text-label-secondary h-5 w-5" />
              Exchange details
            </SheetTitle>
            <SheetDescription>Cultural exchange program details</SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <h5 className="text-label text-title-3 mb-2">{exchange.title}</h5>
                <div className="text-body mb-3 flex items-center gap-2">
                  {React.createElement(typeConfig.icon, {
                    className: "text-label-secondary h-4 w-4",
                  })}
                  <span className="text-label-secondary">{typeConfig.label}</span>
                </div>
                <p className="text-label-secondary text-body">{exchange.description}</p>
              </div>

              {exchange.narrative && (
                <DetailSection icon={EditPencil} title="Exchange narrative">
                  <p className="text-label-secondary text-body leading-relaxed">
                    {exchange.narrative}
                  </p>
                </DetailSection>
              )}

              {objectives.length > 0 && (
                <DetailSection icon={WhiteFlag} title="Program objectives">
                  <ul className="space-y-2">
                    {objectives.map((objective, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="text-green mt-0.5 h-4 w-4 shrink-0" />
                        <span className="text-label-secondary text-body">{objective}</span>
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              )}

              <DetailSection icon={Brain} title="Diplomatic outlook">
                <p className="text-label-secondary text-body italic">
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
                  <div key={m.label} className="bg-fill-3 rounded-row p-3 text-center">
                    <dd className="text-label text-title-3 tabular-nums">{m.value}</dd>
                    <dt>
                      <span className="text-stat-label text-label-secondary">{m.label}</span>
                    </dt>
                  </div>
                ))}
              </dl>

              <DetailSection icon={Settings} title="Program details">
                <div className="space-y-2">
                  <div className="text-body flex items-center justify-between">
                    <span className="text-label-secondary">Duration</span>
                    <span className="text-label flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(exchange.startDate).toLocaleDateString()} –{" "}
                      {new Date(exchange.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-body flex items-center justify-between">
                    <span className="text-label-secondary">Visibility</span>
                    <span className="text-label flex items-center gap-1">
                      {exchange.isPublic !== false ? (
                        <>
                          <Eye className="text-label-secondary h-3.5 w-3.5" />
                          Public
                        </>
                      ) : (
                        <>
                          <EyeClosed className="text-label-secondary h-3.5 w-3.5" />
                          Private
                        </>
                      )}
                    </span>
                  </div>
                  {exchange.maxParticipants && (
                    <div className="text-body flex items-center justify-between">
                      <span className="text-label-secondary">Max participants</span>
                      <span className="text-label tabular-nums">{exchange.maxParticipants}</span>
                    </div>
                  )}
                </div>
              </DetailSection>

              {exchange.participatingCountries.length > 0 && (
                <div className="space-y-3">
                  <h6 className="text-label text-headline flex items-center gap-2">
                    <MicrophoneSpeaking className="text-label-secondary h-4 w-4" />
                    NPC Responses ({npcResponses?.length || exchange.participatingCountries.length})
                  </h6>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {npcResponses && npcResponses.length > 0
                      ? npcResponses.map((response) => (
                          <Card variant="inset" key={response.countryId} className="p-3">
                            <div className="mb-2 flex items-center gap-2">
                              {response.flagUrl && (
                                <img
                                  src={response.flagUrl}
                                  alt={`${response.countryName} flag`}
                                  className="border-separator h-3 w-5 rounded-xs border object-cover"
                                />
                              )}
                              <span className="text-label text-body font-medium">
                                {response.countryName}
                              </span>
                              <Badge
                                variant={response.willParticipate ? "success" : "destructive"}
                                className="ml-auto capitalize"
                              >
                                {response.role}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <p className="text-label-secondary text-footnote">
                                <span className="text-label">{response.personality.archetype}</span>{" "}
                                · {response.responseTimeline} response
                              </p>

                              <div className="text-footnote flex items-center justify-between">
                                <span className="text-label-secondary">Enthusiasm</span>
                                <span className="text-label font-medium tabular-nums">
                                  {Math.round(response.enthusiasmLevel)}%
                                </span>
                              </div>
                              <Progress
                                value={response.enthusiasmLevel}
                                className="h-1.5"
                                indicatorClassName={
                                  response.enthusiasmLevel > 70
                                    ? "bg-green"
                                    : response.enthusiasmLevel > 50
                                      ? "bg-yellow"
                                      : "bg-destructive"
                                }
                              />

                              <div className="text-footnote flex items-center justify-between">
                                <span className="text-label-secondary">Resource commitment</span>
                                <span className="text-label font-medium tabular-nums">
                                  {Math.round(response.resourceCommitment)}%
                                </span>
                              </div>
                              <Progress value={response.resourceCommitment} className="h-1.5" />

                              <p className="text-label-secondary text-footnote mt-2 italic">
                                &ldquo;{response.responseMessage}&rdquo;
                              </p>

                              {response.conditions && response.conditions.length > 0 && (
                                <div className="border-separator mt-2 border-t pt-2">
                                  <Eyebrow>Conditions</Eyebrow>
                                  <ul className="text-label-secondary text-footnote mt-1 list-disc space-y-0.5 pl-4">
                                    {response.conditions.map((condition, idx) => (
                                      <li key={idx}>{condition}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {!response.willParticipate && response.alternativeProposal && (
                                <div className="border-separator mt-2 border-t pt-2">
                                  <Eyebrow>Alternative proposal</Eyebrow>
                                  <p className="text-label-secondary text-footnote mt-1">
                                    {response.alternativeProposal.reasoning}
                                  </p>
                                </div>
                              )}
                            </div>
                          </Card>
                        ))
                      : exchange.participatingCountries.map((country) => (
                          <Card variant="inset" key={country.id} className="p-3">
                            <div className="mb-2 flex items-center gap-2">
                              {country.flagUrl && (
                                <img
                                  src={country.flagUrl}
                                  alt={`${country.name} flag`}
                                  className="border-separator h-3 w-5 rounded-xs border object-cover"
                                />
                              )}
                              <span className="text-label text-body font-medium">
                                {country.name}
                              </span>
                              <Badge variant="outline" className="ml-auto capitalize">
                                {country.role}
                              </Badge>
                            </div>
                            <p className="text-label-secondary text-footnote italic">
                              Analyzing response…
                            </p>
                          </Card>
                        ))}
                  </div>
                </div>
              )}

              {exchange.status === "active" && (
                <DetailSection icon={Flash} title="Generate scenario">
                  <p className="text-label-secondary text-footnote mb-3">
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
                  <h6 className="text-label text-headline flex items-center gap-2">
                    <Camera className="text-label-secondary h-4 w-4" />
                    Cultural Artifacts ({exchange.culturalArtifacts.length})
                  </h6>
                  <div className="grid grid-cols-2 gap-2">
                    {exchange.culturalArtifacts.slice(0, 4).map((artifact) => (
                      <button
                        key={artifact.id}
                        type="button"
                        onClick={() => onViewArtifact?.(artifact.id)}
                        aria-label={`View ${artifact.title}`}
                        className="border-separator bg-fill-3 hover:border-ring focus-visible:ring-tint rounded-row flex aspect-square cursor-pointer items-center justify-center overflow-hidden border transition-colors outline-none focus-visible:ring-2"
                      >
                        {artifact.thumbnailUrl ? (
                          <img
                            src={artifact.thumbnailUrl}
                            alt={artifact.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Camera className="text-label-secondary h-6 w-6" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {(exchange.status === "active" || exchange.status === "completed") && (
              <div className="border-separator flex flex-col gap-2 border-t pt-4 sm:flex-row">
                {exchange.status === "active" && (
                  <>
                    <Button className="flex-1" onClick={() => onJoin(exchange.id, "participant")}>
                      <User aria-hidden="true" className="h-4 w-4" />
                      Join as participant
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => onJoin(exchange.id, "observer")}
                    >
                      <Eye className="h-4 w-4" />
                      Observe exchange
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={onUploadArtifact}>
                      <Camera className="h-4 w-4" />
                      Upload artifact
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

            <div className="border-separator flex flex-col gap-2 border-t pt-4 sm:flex-row">
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
        </SheetContent>
      </Sheet>
    );
  }
);

ExchangeDetailsModal.displayName = "ExchangeDetailsModal";
