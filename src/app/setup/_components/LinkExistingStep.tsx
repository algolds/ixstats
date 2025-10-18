"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, MapPin, Link, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { LoadingState } from "~/components/shared/feedback/LoadingState";
import { ErrorDisplay } from "~/components/shared/feedback/ErrorDisplay";

interface Country {
  id: string;
  name: string;
  continent?: string | null;
  region?: string | null;
  economicTier: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
}

interface LinkExistingStepProps {
  countries: Country[];
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  onLink: (countryId: string) => void;
  isLinking: boolean;
}

export function LinkExistingStep({
  countries,
  isLoading,
  error,
  onBack,
  onLink,
  isLinking
}: LinkExistingStepProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.continent?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.region?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Advanced': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      case 'Developed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'Emerging': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 border border-gray-200 dark:border-gray-800';
    }
  };

  return (
    <motion.div
      key="link-existing"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-10">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-8 glass-hierarchy-child px-6 py-3 rounded-xl"
        >
          <ArrowLeft className="h-5 w-5 mr-3" />
          Back to options
        </Button>

        <h1 className="text-5xl font-bold text-foreground mb-6">
          Link to Existing Country
        </h1>

        <p className="text-2xl text-muted-foreground max-w-3xl">
          Search and select an existing country to link to your account.
        </p>
      </div>

      <div className="glass-hierarchy-parent rounded-3xl p-8 border border-border">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground flex items-center mb-4">
            <div className="glass-hierarchy-child p-3 rounded-xl mr-4">
              <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            Search Countries
          </h2>
          <p className="text-muted-foreground text-lg">
            Find your country by name, continent, or region
          </p>
        </div>

        <div className="space-y-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, continent, or region..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 py-4 text-lg glass-hierarchy-child border-border rounded-2xl"
            />
          </div>

          {isLoading ? (
            <LoadingState message="Loading countries..." />
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredCountries.map((country, index) => (
                <motion.button
                  key={country.id}
                  onClick={() => setSelectedCountryId(country.id)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`w-full p-6 glass-hierarchy-child rounded-2xl text-left transition-all duration-500 ${
                    selectedCountryId === country.id
                      ? 'glass-hierarchy-interactive border-2 border-primary scale-105'
                      : 'hover:glass-hierarchy-interactive border border-border hover:scale-102'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 glass-hierarchy-child rounded-xl flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground mb-2">
                          {country.name}
                        </h3>
                        <p className="text-muted-foreground">
                          {country.continent} {country.region && `• ${country.region}`}
                        </p>
                      </div>
                    </div>
                    <Badge className={getTierColor(country.economicTier)}>
                      {country.economicTier}
                    </Badge>
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {error && (
            <ErrorDisplay
              message={error}
              severity="error"
              variant="alert"
            />
          )}

          {selectedCountryId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-8 border-t border-border"
            >
              <Button
                onClick={() => onLink(selectedCountryId)}
                disabled={isLinking}
                className="w-full glass-hierarchy-interactive py-6 text-lg font-semibold rounded-2xl"
                size="lg"
              >
                {isLinking ? (
                  <>
                    <LoadingState variant="spinner" size="sm" className="mr-4" />
                    Linking Country...
                  </>
                ) : (
                  <>
                    <Link className="h-6 w-6 mr-4" />
                    Link Country
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
