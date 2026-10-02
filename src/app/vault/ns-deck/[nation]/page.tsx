"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import {
  SystemRestart as Loader2,
  OpenNewWindow as ExternalLink,
  StatUp as TrendingUp,
  MediaImage as ImageOff,
} from "iconoir-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import Image from "next/image";
import { NationStatesAttribution } from "~/components/cards/display/NationStatesAttribution";
import { getRarityTheme } from "~/lib/cards/display-utils";

export default function NSDeckPage() {
  const params = useParams();
  const nationName = params?.nation as string;
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = api.nsImport.fetchPublicDeck.useQuery({
    nationName: decodeURIComponent(nationName),
  });

  const handleImageError = (cardKey: string) => {
    setFailedImages((prev) => new Set(prev).add(cardKey));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl space-y-6 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl space-y-6 py-8">
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-large-title capitalize">{data.nation}'s Deck</h1>
        <p className="text-label-secondary">NationStates Trading Cards Collection</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-label-secondary text-body font-medium">
              Total Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-title-1">{data.totalCards}</div>
            <p className="text-label-secondary text-footnote mt-1">All copies</p>
          </CardContent>
        </Card>

        <Card className="flex flex-col gap-6 py-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-label-secondary text-body font-medium">
              Unique Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-title-1">{data.uniqueCards || data.cards.length}</div>
            <p className="text-label-secondary text-footnote mt-1">Different cards</p>
          </CardContent>
        </Card>

        <Card className="flex flex-col gap-6 py-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-label-secondary text-body font-medium">Deck Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="text-green h-4 w-4" />
              <div className="text-title-1">{data.deckValue.toFixed(2)}</div>
            </div>
            <p className="text-label-secondary text-footnote mt-1">Bank value</p>
          </CardContent>
        </Card>

        <Card className="flex flex-col gap-6 py-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-label-secondary text-body font-medium">Showing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-title-1">{data.cards.length}</div>
            <p className="text-label-secondary text-footnote mt-1">Unique cards displayed</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards Grid */}
      <div>
        <h2 className="text-title-2 mb-4 font-semibold">Cards</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.cards.map((card, index) => {
            const cardKey = `${card.id}-${card.season}-${index}`;
            const hasImageFailed = failedImages.has(cardKey);

            return (
              <Card key={cardKey} className="flex flex-col gap-6 overflow-hidden py-6">
                <CardHeader className="p-0">
                  <div className="bg-fill-3 relative aspect-[3/4] w-full">
                    {card.flag && !hasImageFailed ? (
                      <Image
                        src={`/api/proxy-ns-image?url=${encodeURIComponent(card.flag)}`}
                        alt={card.name || `Card ${card.id}`}
                        fill
                        className="object-cover"
                        unoptimized
                        onError={() => handleImageError(cardKey)}
                      />
                    ) : (
                      <div className="text-label-secondary flex h-full flex-col items-center justify-center gap-2">
                        <ImageOff className="h-8 w-8" />
                        <span className="text-footnote">Image Unavailable</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex flex-col items-end gap-2">
                      <Badge variant="outline" className={getRarityTheme(card.rarity).badgeStyle}>
                        {card.rarity.replace("_", " ")}
                      </Badge>
                      {card.quantity && card.quantity > 1 && (
                        <Badge variant="default" className="bg-blue text-on-blue font-semibold">
                          x{card.quantity}
                        </Badge>
                      )}
                    </div>
                    <div className="absolute right-2 bottom-2">
                      <Badge variant="secondary">S{card.season}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 p-4">
                  <div>
                    <h3 className="line-clamp-1 font-semibold">{card.name || `Card ${card.id}`}</h3>
                    {card.region && (
                      <p className="text-label-secondary text-body line-clamp-1">{card.region}</p>
                    )}
                  </div>
                  {card.category && (
                    <p className="text-label-secondary text-footnote line-clamp-2">
                      {card.category}
                    </p>
                  )}
                  {card.slogan && (
                    <p className="text-label-secondary text-footnote line-clamp-1 italic">
                      "{card.slogan}"
                    </p>
                  )}
                  <div className="space-y-1 pt-2">
                    <div className="text-body flex items-center justify-between">
                      <span className="text-label-secondary">Market Value:</span>
                      <span className="font-medium">{card.market_value}</span>
                    </div>
                    {card.quantity && card.quantity > 1 && (
                      <div className="text-body flex items-center justify-between">
                        <span className="text-label-secondary">Owned:</span>
                        <span className="text-blue font-semibold">{card.quantity}x</span>
                      </div>
                    )}
                  </div>
                  <a
                    href={`https://www.nationstates.net/page=deck/card=${card.id}/season=${card.season}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-tint text-footnote flex items-center gap-1 pt-2 hover:underline"
                  >
                    View on NationStates <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Info Card */}
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle>About This Deck</CardTitle>
          <CardDescription>Data pulled from NationStates public API</CardDescription>
        </CardHeader>
        <CardContent className="text-body space-y-2">
          <p>
            This page displays the trading card collection for the nation{" "}
            <strong className="capitalize">{data.nation}</strong> on NationStates.
          </p>
          <p className="text-label-secondary">
            Showing {data.cards.length} unique cards from their collection. Full deck contains{" "}
            {data.totalCards} total cards ({data.uniqueCards || data.cards.length} unique) with a
            total value of {data.deckValue.toFixed(2)}.
          </p>
          {data.cards.some((card) => card.quantity && card.quantity > 1) && (
            <p className="text-footnote text-blue">
              <strong>Note:</strong> Cards marked with "x#" indicate multiple copies owned.
            </p>
          )}
          <NationStatesAttribution className="pt-2" />
        </CardContent>
      </Card>
    </div>
  );
}
