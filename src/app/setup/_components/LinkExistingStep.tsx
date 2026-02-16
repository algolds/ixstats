"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Search, MapPin, Link } from "lucide-react";
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
  isLinking,
}: LinkExistingStepProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);

  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country.continent?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country.region?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Advanced":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
      case "Developed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
      case "Emerging":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 border border-gray-200 dark:border-gray-800";
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
          className="glass-hierarchy-child mb-8 rounded-xl px-6 py-3"
        >
          <ArrowLeft className="mr-3 h-5 w-5" />
          Back to options
        </Button>

        <h1 className="text-foreground mb-4 text-2xl font-bold md:text-3xl">Link to Existing Country</h1>

        <p className="text-muted-foreground max-w-3xl text-base md:text-lg">
          Search and select an existing country to link to your account.
        </p>
      </div>

      <div className="glass-hierarchy-parent border-border rounded-xl border p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-foreground mb-3 flex items-center text-lg font-bold md:text-xl">
            <div className="glass-hierarchy-child mr-3 rounded-lg p-2">
              <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            Search Countries
          </h2>
          <p className="text-muted-foreground text-sm">
            Find your country by name, continent, or region
          </p>
        </div>

        <div className="space-y-8">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transform" />
            <Input
              type="text"
              placeholder="Search by name, continent, or region..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-hierarchy-child border-border rounded-xl py-3 pl-12 text-sm"
            />
          </div>

          {isLoading ? (
            <LoadingState message="Loading countries..." />
          ) : (
            <div className="max-h-96 space-y-4 overflow-y-auto">
              {filteredCountries.map((country, index) => (
                <motion.button
                  key={country.id}
                  onClick={() => setSelectedCountryId(country.id)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`glass-hierarchy-child w-full rounded-xl p-3 text-left transition-all duration-500 ${
                    selectedCountryId === country.id
                      ? "glass-hierarchy-interactive border-primary scale-105 border-2"
                      : "hover:glass-hierarchy-interactive border-border border hover:scale-102"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="glass-hierarchy-child flex h-12 w-12 items-center justify-center rounded-xl">
                        <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-foreground mb-1 text-sm font-bold">{country.name}</h3>
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

          {error && <ErrorDisplay message={error} severity="error" variant="alert" />}

          {selectedCountryId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-border border-t pt-8"
            >
              <Button
                onClick={() => onLink(selectedCountryId)}
                disabled={isLinking}
                className="glass-hierarchy-interactive w-full rounded-xl py-4 text-base font-semibold"
                size="lg"
              >
                {isLinking ? (
                  <>
                    <LoadingState variant="spinner" size="sm" className="mr-4" />
                    Linking Country...
                  </>
                ) : (
                  <>
                    <Link className="mr-4 h-6 w-6" />
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
