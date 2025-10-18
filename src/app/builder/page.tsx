"use client";
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { AtomicBuilderPage } from "./components/enhanced/AtomicBuilderPage";
import { BuilderOnboardingWizard } from './components/BuilderOnboardingWizard';
import { BuilderErrorBoundary } from './components/BuilderErrorBoundary';
import { GlobalBuilderLoading } from './components/GlobalBuilderLoading';
import { useRouter } from 'next/navigation';
import { createUrl } from "~/lib/url-utils";

export default function CreateCountryBuilder() {
  const [isBuilding, setIsBuilding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    document.title = "Country Builder - IxStats";
  }, []);

  const handleStartBuilding = () => {
    setIsLoading(true);
    // Simulate loading time for the builder initialization
    setTimeout(() => {
      setIsBuilding(true);
      setIsLoading(false);
    }, 2000);
  };

  const handleBackToIntro = () => {
    setIsBuilding(false);
  };

  const handleSkipToImport = () => {
    router.push(createUrl('/builder/import'));
  };

  return (
    <BuilderErrorBoundary>
      {isLoading ? (
        <GlobalBuilderLoading 
          message="Initializing MyCountry builder..."
          variant="full"
          showSubsystems={true}
        />
      ) : isBuilding ? (
        <AtomicBuilderPage onBackToIntro={handleBackToIntro} />
      ) : (
        <BuilderOnboardingWizard
          onStartBuilding={handleStartBuilding}
          onSkipToImport={handleSkipToImport}
        />
      )}
    </BuilderErrorBoundary>
  );
}