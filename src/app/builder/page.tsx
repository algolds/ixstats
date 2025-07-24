"use client";
export const dynamic = 'force-dynamic';
// src/app/economy/page.tsx

import { useState, useEffect } from "react";
import { CountrySelector } from "./components/CountrySelector";
import { EconomicInputForm } from "./components/EconomicInputForm";
import { EconomicPreview } from "./components/EconomicPreview";
import type { RealCountryData, EconomicInputs } from "./lib/economy-data-service";
import { parseEconomyData, createDefaultEconomicInputs, saveBaselineToStorage } from "./lib/economy-data-service";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";

type BuilderPhase = 'select' | 'customize' | 'preview';

export default function CreateCountryBuilder() {
  useEffect(() => {
    document.title = "Country Builder - IxStats";
  }, []);

  const { user } = useUser();
  const router = useRouter();
  const [currentPhase, setCurrentPhase] = useState<BuilderPhase>('select');
  const [allCountries, setAllCountries] = useState<RealCountryData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<RealCountryData | null>(null);
  const [economicInputs, setEconomicInputs] = useState<EconomicInputs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // TRPC mutations
  const createCountryMutation = api.users.createCountry.useMutation();
  const linkCountryMutation = api.users.linkCountry.useMutation();

  useEffect(() => {
    const loadData = async () => {
      try {
        const countries = await parseEconomyData();
        setAllCountries(countries);
        
        // Check for imported data from wiki
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('import') === 'true') {
          const importedDataStr = localStorage.getItem('builder_imported_data');
          if (importedDataStr) {
            try {
              const importedData = JSON.parse(importedDataStr);
              console.log('Found imported data:', importedData);
              
              // Create a synthetic country data from imported data
              const syntheticCountry: RealCountryData = {
                name: importedData.name,
                countryCode: 'IMPORT',
                population: importedData.population || 1000000,
                gdpPerCapita: importedData.gdpPerCapita || 25000,
                gdp: importedData.gdp || (importedData.population || 1000000) * (importedData.gdpPerCapita || 25000),
                unemploymentRate: 5.0,
                inflationRate: 2.0,
                growthRate: 2.5,
                taxRevenuePercent: 20.0,
                governmentSpending: 18.0,
                continent: 'Unknown',
                region: 'Unknown'
              };
              
              setSelectedCountry(syntheticCountry);
              setCurrentPhase('customize');
              
              // Clear the imported data
              localStorage.removeItem('builder_imported_data');
              
              // Update URL to remove import parameter
              window.history.replaceState({}, '', window.location.pathname);
            } catch (error) {
              console.error('Failed to parse imported data:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load country data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCountry) {
      const defaultInputs = createDefaultEconomicInputs(selectedCountry);
      setEconomicInputs(defaultInputs);
    }
  }, [selectedCountry]);

  const handleCountrySelect = (country: RealCountryData) => {
    setSelectedCountry(country);
    setCurrentPhase('customize');
  };

  const handleInputsChange = (newInputs: EconomicInputs) => setEconomicInputs(newInputs);
  const handlePreview = () => setCurrentPhase('preview');
  const handleBack = () => {
    if (currentPhase === 'customize') setCurrentPhase('select');
    else if (currentPhase === 'preview') setCurrentPhase('customize');
  };

  const handleConfirmBaseline = async () => {
    if (!economicInputs || !user?.id) return;
    
    setIsCreating(true);
    try {
      // Create the country in the database with the built economic data
      const result = await createCountryMutation.mutateAsync({
        userId: user.id,
        countryName: economicInputs.countryName,
        initialData: {
          baselinePopulation: economicInputs.coreIndicators.totalPopulation,
          baselineGdpPerCapita: economicInputs.coreIndicators.gdpPerCapita,
          // Add other fields as needed from the nested structure
        }
      });

      // Save to local storage as well for backup
      saveBaselineToStorage(economicInputs);
      
      // Redirect to the newly created country
      router.push(createUrl(`/mycountry`));
    } catch (error) {
      console.error('Failed to create country:', error);
      alert(`Failed to create ${economicInputs.countryName}. Please try again.`);
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-brand-primary)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-muted)]">Loading country builder...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-[var(--color-bg-primary)]">
          <div className="container mx-auto">
            {currentPhase === 'select' && (
              <div>
                <div className="text-center py-8">
                  <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                    Create a Country
                  </h1>
                  <p className="text-[var(--color-text-muted)] text-lg">
                    Build a custom nation for your campaign using real-world economic data as a foundation
                  </p>
                </div>
                <CountrySelector
                  countries={allCountries}
                  onCountrySelect={handleCountrySelect}
                  selectedCountry={selectedCountry}
                />
              </div>
            )}

            {currentPhase === 'customize' && selectedCountry && economicInputs && (
              <EconomicInputForm
                inputs={economicInputs}
                referenceCountry={selectedCountry}
                onInputsChange={handleInputsChange}
                onPreview={handlePreview}
                onBack={handleBack}
              />
            )}

            {currentPhase === 'preview' && selectedCountry && economicInputs && (
              <EconomicPreview
                inputs={economicInputs}
                referenceCountry={selectedCountry}
                allCountries={allCountries}
                onBack={handleBack}
                onConfirm={handleConfirmBaseline}
                isCreating={isCreating}
              />
            )}
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
    </>
  );
}

