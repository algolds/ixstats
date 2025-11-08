"use client";

// Refactored from main CountryPage - displays diplomacy tab with embassy network, secure channels, and cultural exchanges
import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { EnhancedEmbassyNetwork } from "~/components/diplomatic/EnhancedEmbassyNetwork";
import { SecureCommunications } from "~/app/mycountry/intelligence/_components/SecureCommunications";
import { CulturalExchangeProgram } from "~/components/diplomatic/CulturalExchangeProgram";
import { InlineDiplomaticActions } from "~/components/diplomatic/InlineDiplomaticActions";
import { Building, Globe, Heart, Activity } from "lucide-react";

type DiplomacySubTab = "embassy-network" | "secure-channels" | "cultural-exchange";

interface CountryDiplomaticPanelProps {
  country: {
    id: string;
    name: string;
    economicTier: string;
  };
  flagUrl: string | null | undefined;
  isOwnCountry: boolean;
  viewerCountryId?: string | null;
  viewerCountryName?: string | null;
}

export function CountryDiplomaticPanel({
  country,
  flagUrl,
  isOwnCountry,
  viewerCountryId,
  viewerCountryName,
}: CountryDiplomaticPanelProps) {
  const [showDiplomaticActions, setShowDiplomaticActions] = useState(false);
  const [activeDiplomacyTab, setActiveDiplomacyTab] = useState<DiplomacySubTab>("embassy-network");

  return (
    <div className="space-y-6">
      {/* Header with Diplomatic Actions Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Diplomatic Network</h2>
          <p className="text-muted-foreground">
            Embassy network, secure channels, and cultural exchanges
          </p>
        </div>
        {!isOwnCountry && (
          <Button
            onClick={() => setShowDiplomaticActions(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Activity className="mr-2 h-4 w-4" />
            Diplomatic Actions
          </Button>
        )}
      </div>

      {/* Diplomatic Actions Modal */}
      <InlineDiplomaticActions
        viewerCountryId={viewerCountryId ?? undefined}
        viewerCountryName={viewerCountryName ?? undefined}
        targetCountryId={country.id}
        targetCountryName={country.name}
        isOwner={isOwnCountry}
        isOpen={showDiplomaticActions}
        onClose={() => setShowDiplomaticActions(false)}
      />

      {/* Sub-Tabs for Diplomacy Section */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeDiplomacyTab === "embassy-network" ? "default" : "ghost"}
          onClick={() => setActiveDiplomacyTab("embassy-network")}
          className="rounded-b-none"
        >
          <Building className="mr-2 h-4 w-4" />
          Embassy Network
        </Button>
        <Button
          variant={activeDiplomacyTab === "secure-channels" ? "default" : "ghost"}
          onClick={() => setActiveDiplomacyTab("secure-channels")}
          className="rounded-b-none"
        >
          <Globe className="mr-2 h-4 w-4" />
          Secure Channels
        </Button>
        <Button
          variant={activeDiplomacyTab === "cultural-exchange" ? "default" : "ghost"}
          onClick={() => setActiveDiplomacyTab("cultural-exchange")}
          className="rounded-b-none"
        >
          <Heart className="mr-2 h-4 w-4" />
          Cultural Exchange
        </Button>
      </div>

      {/* Embassy Network */}
      {activeDiplomacyTab === "embassy-network" && (
        <EnhancedEmbassyNetwork
          countryId={country.id}
          countryName={country.name}
          isOwner={isOwnCountry}
        />
      )}

      {/* Secure Diplomatic Channels */}
      {activeDiplomacyTab === "secure-channels" && (
        <SecureCommunications
          countryId={country.id}
          countryName={country.name}
          clearanceLevel={isOwnCountry ? "CONFIDENTIAL" : "PUBLIC"}
        />
      )}

      {/* Cultural Exchange Program */}
      {activeDiplomacyTab === "cultural-exchange" && (
        <CulturalExchangeProgram
          primaryCountry={{
            id: country.id,
            name: country.name,
            flagUrl: flagUrl ?? undefined,
            economicTier: country.economicTier,
          }}
        />
      )}
    </div>
  );
}
