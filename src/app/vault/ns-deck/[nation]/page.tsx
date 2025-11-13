"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { Loader2, ExternalLink, TrendingUp, ImageOff } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import Image from "next/image";

export default function NSDeckPage() {
  const params = useParams();
  const nationName = params?.nation as string;
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = api.nsImport.fetchPublicDeck.useQuery({
    nationName: decodeURIComponent(nationName),
  });

  const handleImageError = (cardKey: string) => {
    setFailedImages(prev => new Set(prev).add(cardKey));
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

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      COMMON: "bg-gray-500",
      UNCOMMON: "bg-green-500",
      RARE: "bg-blue-500",
      ULTRA_RARE: "bg-purple-500",
      EPIC: "bg-pink-500",
      LEGENDARY: "bg-amber-500",
    };
    return colors[rarity] || "bg-gray-500";
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold capitalize">{data.nation}'s Deck</h1>
        <p className="text-muted-foreground">
          NationStates Trading Cards Collection
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-hierarchy-child">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalCards}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All copies
            </p>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.uniqueCards || data.cards.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Different cards
            </p>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deck Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div className="text-2xl font-bold">{data.deckValue.toFixed(2)}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Bank value
            </p>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Showing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.cards.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unique cards displayed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards Grid */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Cards</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.cards.map((card, index) => {
            const cardKey = `${card.id}-${card.season}-${index}`;
            const hasImageFailed = failedImages.has(cardKey);

            return (
              <Card key={cardKey} className="glass-hierarchy-child overflow-hidden">
                <CardHeader className="p-0">
                  <div className="relative aspect-[3/4] w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
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
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <ImageOff className="h-8 w-8" />
                        <span className="text-xs">Image Unavailable</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex flex-col gap-2 items-end">
                      <Badge className={`${getRarityColor(card.rarity)} text-white`}>
                        {card.rarity.replace("_", " ")}
                      </Badge>
                      {card.quantity && card.quantity > 1 && (
                        <Badge variant="default" className="bg-blue-600 text-white font-bold">
                          x{card.quantity}
                        </Badge>
                      )}
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary">S{card.season}</Badge>
                    </div>
                  </div>
                </CardHeader>
              <CardContent className="space-y-2 p-4">
                <div>
                  <h3 className="font-semibold line-clamp-1">
                    {card.name || `Card ${card.id}`}
                  </h3>
                  {card.region && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {card.region}
                    </p>
                  )}
                </div>
                {card.category && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {card.category}
                  </p>
                )}
                {card.slogan && (
                  <p className="text-xs italic text-muted-foreground/80 line-clamp-1">
                    "{card.slogan}"
                  </p>
                )}
                <div className="space-y-1 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Market Value:</span>
                    <span className="font-medium">{card.market_value}</span>
                  </div>
                  {card.quantity && card.quantity > 1 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Owned:</span>
                      <span className="font-bold text-blue-600">{card.quantity}x</span>
                    </div>
                  )}
                </div>
                <a
                  href={`https://www.nationstates.net/page=deck/card=${card.id}/season=${card.season}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 pt-2"
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
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle>About This Deck</CardTitle>
          <CardDescription>
            Data pulled from NationStates public API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            This page displays the trading card collection for the nation{" "}
            <strong className="capitalize">{data.nation}</strong> on NationStates.
          </p>
          <p className="text-muted-foreground">
            Showing {data.cards.length} unique cards from their collection. Full deck contains{" "}
            {data.totalCards} total cards ({data.uniqueCards || data.cards.length} unique) with a total value of {data.deckValue.toFixed(2)}.
          </p>
          {data.cards.some(card => card.quantity && card.quantity > 1) && (
            <p className="text-xs text-blue-600 dark:text-blue-400">
              <strong>Note:</strong> Cards marked with "x#" indicate multiple copies owned.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
