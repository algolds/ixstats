"use client";
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { AtomicBuilderPageEnhanced } from "./components/enhanced/AtomicBuilderPageEnhanced";
import { BuilderOnboardingWizard } from './components/BuilderOnboardingWizard';
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

  if (isBuilding) {
    return <AtomicBuilderPageEnhanced onBackToIntro={handleBackToIntro} />;
  }

  return (
    <BuilderOnboardingWizard 
      onStartBuilding={handleStartBuilding}
      onSkipToImport={handleSkipToImport}
    />
  );
}