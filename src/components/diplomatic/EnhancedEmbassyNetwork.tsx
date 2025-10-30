/**
 * @file EnhancedEmbassyNetwork.tsx
 * @description Main orchestrator component for embassy network visualization
 *
 * Architecture:
 * - Data: useEmbassyNetworkData (fetches and processes embassy data)
 * - Metrics: useNetworkMetrics (calculates network-wide statistics)
 * - UI: Composed from NetworkOverviewCard, EmbassyGrid, EmptyState
 * - Modal: useSharedDataModal + SharedDataModal
 */

"use client";

import React, { useState } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { SharedDataModal } from "~/components/diplomatic/SharedDataModal";
import { EstablishEmbassyModal } from "~/components/diplomatic/EstablishEmbassyModal";
import { AnimatePresence } from "framer-motion";

// Custom hooks
import { useEmbassyNetworkData } from "~/hooks/useEmbassyNetworkData";
import { useNetworkMetrics } from "~/hooks/useNetworkMetrics";
import { useSharedDataModal } from "~/hooks/useSharedDataModal";

// UI Components
import {
  NetworkOverviewCard,
  EmbassyGrid,
  EmptyState
} from "~/components/diplomatic/embassy-network";

interface EnhancedEmbassyNetworkProps {
  countryId: string;
  countryName: string;
  isOwner: boolean;
}

export function EnhancedEmbassyNetwork({
  countryId,
  countryName,
  isOwner
}: EnhancedEmbassyNetworkProps) {
  // Data layer: Fetch and process embassy data with synergies
  const { embassiesWithSynergies, isLoading, refetch } = useEmbassyNetworkData(countryId, isOwner);

  // Metrics layer: Calculate network-wide statistics
  const networkMetrics = useNetworkMetrics(embassiesWithSynergies);

  // Modal state management
  const { showSharedData, openModal, closeModal } = useSharedDataModal();
  const [showEstablishModal, setShowEstablishModal] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            Loading embassy network...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Network Overview Metrics */}
      {networkMetrics && (
        <NetworkOverviewCard networkMetrics={networkMetrics} />
      )}

      {/* Embassy Grid */}
      {embassiesWithSynergies.length > 0 && (
        <EmbassyGrid
          embassies={embassiesWithSynergies}
          isOwner={isOwner}
          onEmbassyClick={openModal}
        />
      )}

      {/* Empty State */}
      {embassiesWithSynergies.length === 0 && (
        <EmptyState
          isOwner={isOwner}
          onEstablishEmbassy={() => setShowEstablishModal(true)}
        />
      )}

      {/* Shared Data Modal */}
      <AnimatePresence>
        {showSharedData && (
          <SharedDataModal
            embassyId={showSharedData}
            onClose={closeModal}
            isOwner={isOwner}
          />
        )}
      </AnimatePresence>

      {/* Establish Embassy Modal */}
      <EstablishEmbassyModal
        open={showEstablishModal}
        onOpenChange={setShowEstablishModal}
        guestCountryId={countryId}
        guestCountryName={countryName}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

