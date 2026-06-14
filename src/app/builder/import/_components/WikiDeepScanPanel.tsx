"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Search,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Loader2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Database,
  Settings2,
} from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import type { ExtractedBuilderData } from "~/app/builder/lib/wiki-data-extractor";

interface WikiDeepScanPanelProps {
  countryName: string;
  wikiSource: "ixwiki" | "iiwiki" | "althistory";
  onDataExtracted: (enhancedData: ExtractedBuilderData) => void;
  onSkip: () => void;
}

export function WikiDeepScanPanel({
  countryName,
  wikiSource,
  onDataExtracted,
  onSkip,
}: WikiDeepScanPanelProps) {
  const { data, isLoading, error } = api.wikiCache.builderDeepScan.useQuery(
    {
      countryName,
      wikiSource,
    },
    {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  );

  if (isLoading) {
    return (
      <Card className="border-2 border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-8 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto mb-4 h-12 w-12 text-emerald-500"
          >
            <Search className="h-full w-full" />
          </motion.div>
          <h3 className="mb-2 text-xl font-bold">
            LoreScanner is analyzing your nation's lore ...
          </h3>
          <p className="text-muted-foreground mx-auto mb-4 max-w-md text-sm">
            LoreScanner is searching for related pages (Economy, Politics, Demographics) to extract
            richer data for your nation.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-2 border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
            <Settings2 className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-xl font-bold">LoreScanner Unavailable</h3>
          <p className="text-muted-foreground mx-auto mb-6 max-w-md text-sm">
            LoreScanner encountered an error! You can still proceed with the basic infobox data for
            now and we'll try again later.
          </p>
          <Button onClick={onSkip} className="bg-amber-500 hover:bg-amber-600">
            Proceed
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { extractedData, foundVariants } = data;

  // Calculate total confidence / data points
  const hasGov = !!extractedData.government;
  const hasEcon = !!extractedData.economy;
  const hasDemo = !!extractedData.demographics;

  if (!hasGov && !hasEcon && !hasDemo) {
    return (
      <Card className="border-2 border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-xl font-bold">Scan Complete</h3>
          <p className="text-muted-foreground mx-auto mb-6 max-w-md text-sm">
            Scanned {foundVariants.length} pages, but didn't find any additional structured data.
            We'll proceed with the infobox data.
          </p>
          <Button onClick={onSkip} className="bg-emerald-500 hover:bg-emerald-600">
            Continue to Builder <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10">
      <CardContent className="p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-500">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Deep Scan Results</h3>
            <p className="text-muted-foreground text-sm">
              Analyzed {foundVariants.length} pages. We found additional data we can pre-fill!
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hasGov && (
            <div className="border-border/50 bg-muted/20 rounded-lg border p-4">
              <h4 className="mb-3 flex items-center gap-2 font-medium text-blue-500">
                <FileText className="h-4 w-4" /> Government
              </h4>
              <ul className="space-y-2 text-sm">
                {extractedData.government?.governmentType && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium capitalize">
                      {extractedData.government.governmentType}
                    </span>
                  </li>
                )}
                {extractedData.government?.legislature && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Legislature</span>
                    <span className="font-medium">{extractedData.government.legislature}</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {hasEcon && (
            <div className="border-border/50 bg-muted/20 rounded-lg border p-4">
              <h4 className="mb-3 flex items-center gap-2 font-medium text-green-500">
                <FileText className="h-4 w-4" /> Economy
              </h4>
              <ul className="space-y-2 text-sm">
                {extractedData.economy?.gdpNominal && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Nominal GDP</span>
                    <span className="font-medium">
                      {(extractedData.economy.gdpNominal / 1e9).toFixed(1)}B
                    </span>
                  </li>
                )}
                {extractedData.economy?.gdpPerCapita && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Per Capita</span>
                    <span className="font-medium">
                      ${extractedData.economy.gdpPerCapita.toLocaleString()}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {hasDemo && (
            <div className="border-border/50 bg-muted/20 rounded-lg border p-4">
              <h4 className="mb-3 flex items-center gap-2 font-medium text-amber-500">
                <FileText className="h-4 w-4" /> Demographics
              </h4>
              <ul className="space-y-2 text-sm">
                {extractedData.demographics?.population && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Population</span>
                    <span className="font-medium">
                      {(extractedData.demographics.population / 1e6).toFixed(1)}M
                    </span>
                  </li>
                )}
                {extractedData.demographics?.lifeExpectancy && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Life Exp.</span>
                    <span className="font-medium">
                      {extractedData.demographics.lifeExpectancy} yrs
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onSkip}>
            Skip Deep Data
          </Button>
          <Button
            className="bg-emerald-500 text-white hover:bg-emerald-600"
            onClick={() => onDataExtracted(extractedData)}
          >
            Import Enhanced Data <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
