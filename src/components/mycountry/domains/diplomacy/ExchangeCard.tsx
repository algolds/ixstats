"use client";

import { ArrowRight, Calendar, EditPencil, Globe, Star, User } from "iconoir-react";

import React from "react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { CulturalExchange } from "./cultural-exchange-types";
import { EXCHANGE_TYPES, STATUS_STYLES } from "./cultural-exchange-types";
import { Card } from "~/components/ui/card";

interface ExchangeCardProps {
  exchange: CulturalExchange;
  index: number;
  isSelected: boolean;
  primaryCountryId: string;
  votedExchanges: Set<string>;
  onClick: () => void;
  onEdit: () => void;
  onVote: (voteType: "up" | "down") => void;
}

/** A small flag tile; falls back to the country's initial on a muted surface. */
function FlagTile({
  name,
  flagUrl,
  className,
}: {
  name: string;
  flagUrl?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-separator bg-fill-3 rounded-control-sm overflow-hidden border",
        className
      )}
      title={name}
    >
      {flagUrl ? (
        <img src={flagUrl} alt={`${name} flag`} className="h-full w-full object-cover" />
      ) : (
        <span className="text-label-secondary text-headline flex h-full w-full items-center justify-center">
          {name.charAt(0)}
        </span>
      )}
    </div>
  );
}

const ExchangeCard: React.FC<ExchangeCardProps> = React.memo(
  ({ exchange, isSelected, primaryCountryId, onClick, onEdit }) => {
    const typeConfig = EXCHANGE_TYPES[exchange.type];
    const statusConfig = STATUS_STYLES[exchange.status];
    const Icon = typeConfig.icon;
    const firstParticipant = exchange.participatingCountries[0];

    return (
      <Card
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={`${exchange.title}, ${typeConfig.label}, ${statusConfig.label}`}
        aria-pressed={isSelected}
        className={cn("rounded-card overflow-hidden", isSelected && "ring-tint ring-2")}
        interactive
      >
        {/* Host → exchange type → participants */}
        <div className="border-separator bg-fill-3 flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FlagTile
              name={exchange.hostCountry.name}
              flagUrl={exchange.hostCountry.flagUrl}
              className="h-8 w-12 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-label text-caption truncate font-semibold">
                {exchange.hostCountry.name}
              </p>
              <p className="text-label-secondary text-footnote">Host</p>
            </div>
          </div>

          <div className="text-label-secondary flex shrink-0 items-center gap-1" aria-hidden>
            <ArrowRight className="h-3.5 w-3.5" />
            <Icon className="text-label h-4 w-4" />
            <ArrowRight className="h-3.5 w-3.5" />
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            <div className="min-w-0 text-right">
              <p className="text-label text-caption truncate font-semibold">
                {firstParticipant ? firstParticipant.name : "Open to all"}
              </p>
              <p className="text-label-secondary text-footnote">
                {exchange.participatingCountries.length > 1
                  ? `+${exchange.participatingCountries.length - 1} more`
                  : "Participant"}
              </p>
            </div>
            {firstParticipant && (
              <FlagTile
                name={firstParticipant.name}
                flagUrl={firstParticipant.flagUrl}
                className="h-8 w-12 shrink-0"
              />
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="text-label text-headline mb-1">{exchange.title}</h4>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={statusConfig.color}>
                  {statusConfig.label}
                </Badge>
                <span className="text-label-secondary text-footnote">{typeConfig.label}</span>
              </div>
            </div>

            {exchange.hostCountry.id === primaryCountryId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                aria-label="Edit exchange"
                title="Edit exchange"
              >
                <EditPencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-label-secondary text-body line-clamp-2">{exchange.description}</p>

            <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span className="tabular-nums">{exchange.metrics.participants}</span>
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                <span className="tabular-nums">{exchange.metrics.culturalImpact}% impact</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{new Date(exchange.startDate).getFullYear()}</span>
              </span>
            </div>

            {exchange.participatingCountries.length > 0 && (
              <div className="flex items-center gap-2">
                <Globe className="text-label-secondary h-3 w-3" />
                <div className="flex items-center gap-1">
                  {exchange.participatingCountries.slice(0, 3).map((country) => (
                    <FlagTile
                      key={country.id}
                      name={country.name}
                      flagUrl={country.flagUrl}
                      className="h-3 w-4 rounded-xs"
                    />
                  ))}
                  {exchange.participatingCountries.length > 3 && (
                    <span className="text-label-secondary text-footnote ml-1">
                      +{exchange.participatingCountries.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }
);

ExchangeCard.displayName = "ExchangeCard";

export { ExchangeCard };
