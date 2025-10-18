"use client";
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { AtomicBuilderPage } from "./components/enhanced/AtomicBuilderPage";
import { BuilderOnboardingWizard } from './components/BuilderOnboardingWizard';
import { BuilderErrorBoundary } from './components/BuilderErrorBoundary';
import { useRouter } from 'next/navigation';
import { createUrl } from "~/lib/url-utils";

export default function CreateCountryBuilder() {
  const [isBuilding, setIsBuilding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    document.title = "Country Builder - IxStats";
  }, []);

  const handleStartBuilding = () => {
    setIsBuilding(true);
  };

  const handleBackToIntro = () => {
    setIsBuilding(false);
  };

  const handleSkipToImport = () => {
    router.push(createUrl('/builder/import'));
  };

  return (
    <BuilderErrorBoundary>
      {isBuilding ? (
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