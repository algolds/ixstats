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
import type { CulturalExchange, ExchangeTypeConfig } from "./cultural-exchange-types";

/** Optional program details (columns on the CulturalExchange model). */
type ExchangeDetails = CulturalExchange & {
  narrative?: string | null;
  /** JSON-encoded string[] */
  objectives?: string | null;
  isPublic?: boolean;
  maxParticipants?: number | null;
};

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
  exchange: ExchangeDetails | null;
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
  exchangeTypes: Record<string, Pick<ExchangeTypeConfig, "icon" | "label">>;
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

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h6 className="text-label text-headline flex items-center gap-2">
      <Icon className="text-label-secondary h-4 w-4" />
      {children}
    </h6>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-body flex items-center justify-between">
      <span className="text-label-secondary">{label}</span>
      {children}
    </div>
  );
}

function CountryHeader({
  name,
  flagUrl,
  badge,
}: {
  name: string;
  flagUrl?: string;
  badge: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      {flagUrl && (
        <img
          src={flagUrl}
          alt={`${name} flag`}
          className="border-separator h-3 w-5 rounded-xs border object-cover"
        />
      )}
      <span className="text-label text-body font-medium">{name}</span>
      {badge}
    </div>
  );
}

function PercentMeter({
  label,
  value,
  indicatorClassName,
}: {
  label: string;
  value: number;
  indicatorClassName?: string;
}) {
  return (
    <>
      <div className="text-footnote flex items-center justify-between">
        <span className="text-label-secondary">{label}</span>
        <span className="text-label font-medium tabular-nums">{Math.round(value)}%</span>
      </div>
      <Progress value={value} className="h-1.5" indicatorClassName={indicatorClassName} />
    </>
  );
}

function enthusiasmColor(level: number) {
  if (level > 70) return "bg-green";
  return level > 50 ? "bg-yellow" : "bg-destructive";
}

function NpcResponseCard({ response }: { response: NPCResponse }) {
  return (
    <Card variant="well" className="p-3">
      <CountryHeader
        name={response.countryName}
        flagUrl={response.flagUrl}
        badge={
          <Badge
            variant={response.willParticipate ? "success" : "destructive"}
            className="ml-auto capitalize"
          >
            {response.role}
          </Badge>
        }
      />
      <div className="space-y-2">
        <p className="text-label-secondary text-footnote">
          <span className="text-label">{response.personality.archetype}</span> ·{" "}
          {response.responseTimeline} response
        </p>
        <PercentMeter
          label="Enthusiasm"
          value={response.enthusiasmLevel}
          indicatorClassName={enthusiasmColor(response.enthusiasmLevel)}
        />
        <PercentMeter label="Resource commitment" value={response.resourceCommitment} />
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
  );
}

function ExchangeActions({
  exchange,
  isHost,
  props: p,
}: {
  exchange: ExchangeDetails;
  isHost: boolean;
  props: ExchangeDetailsModalProps;
}) {
  const { status } = exchange;
  const shareButton = (
    <Button variant="outline" className="flex-1" onClick={p.onShare} disabled={p.isSharing}>
      <ShareAndroid className="h-4 w-4" />
      {p.isSharing ? "Sharing…" : "Share"}
    </Button>
  );
  const bar = "border-separator flex flex-col gap-2 border-t pt-4 sm:flex-row";

  return (
    <>
      {status === "active" && (
        <div className={bar}>
          <Button className="flex-1" onClick={() => p.onJoin(exchange.id, "participant")}>
            <User aria-hidden="true" className="h-4 w-4" />
            Join as participant
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => p.onJoin(exchange.id, "observer")}
          >
            <Eye className="h-4 w-4" />
            Observe exchange
          </Button>
          <Button variant="outline" className="flex-1" onClick={p.onUploadArtifact}>
            <Camera className="h-4 w-4" />
            Upload artifact
          </Button>
        </div>
      )}
      {status === "completed" && (
        <div className={bar}>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={p.onCalculateImpact}
            disabled={p.isCalculating}
          >
            <StatsReport className="h-4 w-4" />
            {p.isCalculating ? "Calculating…" : "Calculate Impact"}
          </Button>
        </div>
      )}
      <div className={bar}>
        {isHost ? (
          <>
            <Button variant="outline" className="flex-1" onClick={p.onEdit}>
              <EditPencil className="h-4 w-4" />
              Edit
            </Button>
            {shareButton}
            {status === "planning" && (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={p.onCancel}
                disabled={p.isCancelling}
              >
                <Xmark className="h-4 w-4" />
                {p.isCancelling ? "Cancelling…" : "Cancel"}
              </Button>
            )}
          </>
        ) : (
          shareButton
        )}
      </div>
    </>
  );
}

export const ExchangeDetailsModal = React.memo<ExchangeDetailsModalProps>((props) => {
  const { open, onOpenChange, exchange, onViewArtifact, npcResponses, exchangeTypes } = props;
  if (!exchange) return null;

  const typeConfig = exchangeTypes[exchange.type];
  const objectives: string[] = exchange.objectives ? JSON.parse(exchange.objectives) : [];

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
                <DetailRow label="Duration">
                  <span className="text-label flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(exchange.startDate).toLocaleDateString()} –{" "}
                    {new Date(exchange.endDate).toLocaleDateString()}
                  </span>
                </DetailRow>
                <DetailRow label="Visibility">
                  <span className="text-label flex items-center gap-1">
                    {exchange.isPublic !== false ? (
                      <Eye className="text-label-secondary h-3.5 w-3.5" />
                    ) : (
                      <EyeClosed className="text-label-secondary h-3.5 w-3.5" />
                    )}
                    {exchange.isPublic !== false ? "Public" : "Private"}
                  </span>
                </DetailRow>
                {exchange.maxParticipants && (
                  <DetailRow label="Max participants">
                    <span className="text-label tabular-nums">{exchange.maxParticipants}</span>
                  </DetailRow>
                )}
              </div>
            </DetailSection>

            {exchange.participatingCountries.length > 0 && (
              <div className="space-y-3">
                <SectionHeading icon={MicrophoneSpeaking}>
                  NPC Responses ({npcResponses?.length || exchange.participatingCountries.length})
                </SectionHeading>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {npcResponses && npcResponses.length > 0
                    ? npcResponses.map((response) => (
                        <NpcResponseCard key={response.countryId} response={response} />
                      ))
                    : exchange.participatingCountries.map((country) => (
                        <Card variant="well" key={country.id} className="p-3">
                          <CountryHeader
                            name={country.name}
                            flagUrl={country.flagUrl}
                            badge={
                              <Badge variant="outline" className="ml-auto capitalize">
                                {country.role}
                              </Badge>
                            }
                          />
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
                  onClick={props.onGenerateScenario}
                  disabled={props.isGeneratingScenario}
                >
                  <LightBulb className="h-4 w-4" />
                  {props.isGeneratingScenario ? "Generating…" : "Generate Scenario"}
                </Button>
              </DetailSection>
            )}

            {exchange.culturalArtifacts.length > 0 && (
              <div className="space-y-3">
                <SectionHeading icon={Camera}>
                  Cultural Artifacts ({exchange.culturalArtifacts.length})
                </SectionHeading>
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

          <ExchangeActions
            exchange={exchange}
            isHost={exchange.hostCountry.id === props.primaryCountry.id}
            props={props}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
});

ExchangeDetailsModal.displayName = "ExchangeDetailsModal";
