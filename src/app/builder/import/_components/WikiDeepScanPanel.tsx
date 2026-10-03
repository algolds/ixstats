"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Search,
  CheckCircle as CheckCircle2,
  NavArrowRight as ChevronRight,
  Page as FileText,
  Database,
  Settings as Settings2,
} from "iconoir-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import type { ExtractedBuilderData } from "~/lib/builder/wiki-data-extractor";

interface WikiDeepScanPanelProps {
  countryName: string;
  wikiSource: "ixwiki" | "iiwiki" | "althistory";
  onDataExtracted: (
    enhancedData?: ExtractedBuilderData,
    pages?: Array<{ title: string; content: string }>
  ) => void;
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
      <Card className="border-green/20 bg-green/5 flex flex-col gap-6 border-2 py-6">
        <CardContent className="p-8 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-green mx-auto mb-4 h-12 w-12"
          >
            <Search className="h-full w-full" />
          </motion.div>
          <h3 className="text-title-2 mb-2">LoreScanner is analyzing your nation's lore ...</h3>
          <p className="text-label-secondary text-body mx-auto mb-4 max-w-md">
            LoreScanner is searching for related pages (economy, politics, demographics) to extract
            richer data for your nation.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-tint/20 bg-tint-fill flex flex-col gap-6 border-2 py-6">
        <CardContent className="p-8 text-center">
          <div className="bg-tint/20 text-tint mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Settings2 className="h-6 w-6" />
          </div>
          <h3 className="text-title-2 mb-2">LoreScanner unavailable</h3>
          <p className="text-label-secondary text-body mx-auto mb-6 max-w-md">
            LoreScanner encountered an error! You can still proceed with the basic infobox data for
            now and we'll try again later.
          </p>
          <Button onClick={onSkip}>Proceed</Button>
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
      <Card className="border-green/20 bg-green/5 flex flex-col gap-6 border-2 py-6">
        <CardContent className="p-8 text-center">
          <div className="bg-green/20 text-green mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-title-2 mb-2">Scan complete</h3>
          <p className="text-label-secondary text-body mx-auto mb-6 max-w-md">
            Scanned {foundVariants.length} pages, but didn't find any additional structured data.
            We'll proceed with the infobox data.
          </p>
          <Button
            onClick={() => onDataExtracted(undefined, data.pages)}
            className="bg-green hover:bg-green transition-[color,background-color,border-color,box-shadow,opacity,transform]"
          >
            Continue to builder <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green/30 shadow-floating flex flex-col gap-6 border-2 py-6">
      <CardContent className="p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-row bg-green/20 text-green flex h-12 w-12 items-center justify-center">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-title-2">Deep scan results</h3>
            <p className="text-label-secondary text-body">
              Analyzed {foundVariants.length} pages. We found additional data we can pre-fill!
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hasGov && (
            <div className="border-separator bg-fill-4 rounded-control border p-4">
              <h4 className="text-label mb-3 flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4" /> Government
              </h4>
              <ul className="text-body space-y-2">
                {extractedData.government?.governmentType && (
                  <li className="flex justify-between">
                    <span className="text-label-secondary">Type</span>
                    <span className="font-medium capitalize">
                      {extractedData.government.governmentType}
                    </span>
                  </li>
                )}
                {extractedData.government?.legislature && (
                  <li className="flex justify-between">
                    <span className="text-label-secondary">Legislature</span>
                    <span className="font-medium">{extractedData.government.legislature}</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {hasEcon && (
            <div className="border-separator bg-fill-4 rounded-control border p-4">
              <h4 className="text-label mb-3 flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4" /> Economy
              </h4>
              <ul className="text-body space-y-2">
                {extractedData.economy?.gdpNominal && (
                  <li className="flex justify-between">
                    <span className="text-label-secondary">Nominal GDP</span>
                    <span className="font-medium">
                      {(extractedData.economy.gdpNominal / 1e9).toFixed(1)}B
                    </span>
                  </li>
                )}
                {extractedData.economy?.gdpPerCapita && (
                  <li className="flex justify-between">
                    <span className="text-label-secondary">Per capita</span>
                    <span className="font-medium">
                      ${extractedData.economy.gdpPerCapita.toLocaleString()}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {hasDemo && (
            <div className="border-separator bg-fill-4 rounded-control border p-4">
              <h4 className="text-label mb-3 flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4" /> Demographics
              </h4>
              <ul className="text-body space-y-2">
                {extractedData.demographics?.population && (
                  <li className="flex justify-between">
                    <span className="text-label-secondary">Population</span>
                    <span className="font-medium">
                      {(extractedData.demographics.population / 1e6).toFixed(1)}M
                    </span>
                  </li>
                )}
                {extractedData.demographics?.lifeExpectancy && (
                  <li className="flex justify-between">
                    <span className="text-label-secondary">Life Exp.</span>
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
          <Button
            variant="outline"
            onClick={() => onDataExtracted(undefined, data.pages)}
            className="transition-[color,background-color,border-color,box-shadow,opacity,transform]"
          >
            Skip deep data
          </Button>
          <Button
            className="bg-green text-on-green hover:bg-green transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            onClick={() => onDataExtracted(extractedData, data.pages)}
          >
            Import enhanced data <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
