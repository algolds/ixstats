"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Flag, RefreshCw, Loader2 } from "lucide-react";
import { flagService } from "~/lib/flag-service";

interface FlagTestResult {
  country: string;
  flagUrl: string | null;
  isPlaceholder: boolean;
  stats: {
    totalCountries: number;
    cachedFlags: number;
    failedFlags: number;
    isUpdating: boolean;
    updateProgress: {
      current: number;
      total: number;
      percentage: number;
    };
  };
  timestamp: string;
}

export function FlagTest() {
  const [country, setCountry] = useState("United_States");
  const [result, setResult] = useState<FlagTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testFlag = async () => {
    if (!country.trim()) {
      setError("Please enter a country name");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/flags/test?country=${encodeURIComponent(country.trim())}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to test flag");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      testFlag();
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="h-5 w-5" />
          Flag Cache Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter country name (e.g., United_States, Germany, Japan)"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button
            onClick={testFlag}
            disabled={isLoading || !country.trim()}
            className="min-w-[100px]"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Test
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-semibold">Country: {result.country}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Flag URL:</span>
                  <Badge variant={result.isPlaceholder ? "destructive" : "default"}>
                    {result.isPlaceholder ? "Placeholder" : "Found"}
                  </Badge>
                </div>
                {result.flagUrl && (
                  <div className="mt-2">
                    <img
                      src={result.flagUrl}
                      alt={`Flag of ${result.country}`}
                      className="h-16 w-auto rounded border"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Cache Statistics</h3>
                <div className="space-y-1 text-sm">
                  <div>Total Countries: {result.stats.totalCountries}</div>
                  <div>Cached Flags: {result.stats.cachedFlags}</div>
                  <div>Failed Flags: {result.stats.failedFlags}</div>
                  <div>Is Updating: {result.stats.isUpdating ? "Yes" : "No"}</div>
                  {result.stats.isUpdating && (
                    <div>
                      Progress: {result.stats.updateProgress.current}/
                      {result.stats.updateProgress.total}({result.stats.updateProgress.percentage}%)
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-muted-foreground text-xs">
              Tested at: {new Date(result.timestamp).toLocaleString()}
            </div>
          </div>
        )}

        <div className="text-muted-foreground text-xs">
          <p>This test verifies the flag cache system by:</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>Fetching the "Template:Country_data" for the specified country</li>
            <li>Extracting the "flag alias" parameter from the template</li>
            <li>Getting the actual flag file URL from MediaWiki</li>
            <li>Caching the result for future use</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
