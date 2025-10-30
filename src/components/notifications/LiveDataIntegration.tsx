/**
 * Live Data Integration Component
 * Connects all available data streams to the global notification system
 */

"use client";

import { useEffect, useRef } from "react";
import { useOptimizedIntelligenceData } from "~/hooks/useOptimizedIntelligenceData";
import { useGlobalNotificationBridge } from "~/services/GlobalNotificationBridge";
import {
  diplomaticNotificationService,
  achievementNotificationService,
} from "~/services/DiplomaticNotificationService";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";

interface LiveDataIntegrationProps {
  countryId?: string;
  isExecutiveMode?: boolean;
  enableIntelligenceStream?: boolean;
  enableEconomicStream?: boolean;
  enableDiplomaticStream?: boolean;
}

export function LiveDataIntegration({
  countryId = "",
  isExecutiveMode = false,
  enableIntelligenceStream = true,
  enableEconomicStream = true,
  enableDiplomaticStream = true,
}: LiveDataIntegrationProps) {
  const { user } = useUser();

  // Get notification bridge
  const { bridge, wireIntelligence, wireEconomic, wireDiplomatic } = useGlobalNotificationBridge();

  // Track previous data to detect changes
  const previousDataRef = useRef<{
    intelligence: any[];
    economic: any;
    diplomatic: any[];
  }>({
    intelligence: [],
    economic: null,
    diplomatic: [],
  });

  // Get user profile for country context
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  const effectiveCountryId = countryId || userProfile?.countryId || "";

  // Intelligence data stream
  const { intelligence } = useOptimizedIntelligenceData({
    countryId: effectiveCountryId || "",
    enableIntelligence: enableIntelligenceStream && !!effectiveCountryId,
    enableVitality: false,
  });

  // Economic data stream - using country data as proxy for economic metrics
  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: effectiveCountryId || "" },
    {
      enabled: enableEconomicStream && !!effectiveCountryId && effectiveCountryId.trim() !== "",
      refetchInterval: 30000, // Refresh every 30 seconds
      retry: false, // Don't retry on error
    }
  );

  // Transform country data into economic metrics
  const economicData = countryData
    ? {
        gdp: (countryData as any).currentTotalGdp || 0,
        gdpPerCapita: (countryData as any).currentGdpPerCapita || 0,
        growthRate: (countryData as any).adjustedGdpGrowth || 0,
        population: (countryData as any).currentPopulation || 0,
        economicTier: (countryData as any).economicTier || "emerging",
        populationGrowthRate: (countryData as any).populationGrowthRate || 0,
      }
    : null;

  // Diplomatic events stream - using diplomatic relations and recent changes
  const { data: diplomaticRelations } = api.diplomatic.getRelationships.useQuery(
    { countryId: effectiveCountryId },
    {
      enabled: enableDiplomaticStream && !!effectiveCountryId,
      refetchInterval: 60000, // Refresh every minute
      retry: false, // Don't retry on error
    }
  );

  const { data: recentDiplomaticChanges } = api.diplomatic.getRecentChanges.useQuery(
    { countryId: effectiveCountryId, hours: 24 },
    {
      enabled: enableDiplomaticStream && !!effectiveCountryId,
      refetchInterval: 30000, // Refresh every 30 seconds for recent changes
      retry: false, // Don't retry on error
    }
  );

  // Transform diplomatic data into events format
  const diplomaticEvents = [
    // Current relationships (for status monitoring)
    ...(diplomaticRelations
      ? diplomaticRelations.map((relation: any) => ({
          id: `rel-${relation.id}`,
          type: relation.relationship || "general",
          title: `Diplomatic Relations: ${relation.targetCountry}`,
          description: `Current relationship: ${relation.relationship} (${relation.strength}/100 strength)`,
          timestamp: new Date(relation.lastContact).getTime() || Date.now(),
          countries: [relation.targetCountryId].filter(Boolean),
          significance:
            relation.strength > 80 ? "major" : relation.strength > 50 ? "moderate" : "minor",
        }))
      : []),

    // Recent changes (actual events)
    ...(recentDiplomaticChanges
      ? recentDiplomaticChanges.map((change: any) => ({
          id: `change-${change.id || Date.now()}`,
          type: change.type || "update",
          title: change.title || "Diplomatic Update",
          description: change.description || "Recent diplomatic development",
          timestamp: new Date(change.timestamp || Date.now()).getTime(),
          countries: [effectiveCountryId],
          significance: change.significance || "moderate",
        }))
      : []),
  ];

  // Intelligence feed integration
  useEffect(() => {
    if (!enableIntelligenceStream || !intelligence || !Array.isArray(intelligence)) return;

    const previous = previousDataRef.current.intelligence;
    const newItems = intelligence.filter((item) => !previous.some((prev) => prev.id === item.id));

    if (newItems.length > 0) {
      console.log(`[LiveDataIntegration] Processing ${newItems.length} new intelligence items`);
      wireIntelligence(newItems);
      previousDataRef.current.intelligence = intelligence;
    }
  }, [intelligence, wireIntelligence, enableIntelligenceStream]);

  // Economic data integration
  useEffect(() => {
    if (!enableEconomicStream || !economicData) return;

    const previous = previousDataRef.current.economic;

    // Check for significant changes in available economic data
    if (previous && economicData) {
      const changes = [];

      // GDP changes
      if (economicData.gdp && previous.gdp && economicData.gdp !== previous.gdp) {
        const gdpChange = ((economicData.gdp - previous.gdp) / previous.gdp) * 100;
        if (Math.abs(gdpChange) > 1) {
          // 1% change threshold
          changes.push({
            metric: "GDP",
            value: economicData.gdp,
            changePercent: gdpChange,
            countryId: effectiveCountryId,
          });
        }
      }

      // GDP per capita changes
      if (
        economicData.gdpPerCapita &&
        previous.gdpPerCapita &&
        economicData.gdpPerCapita !== previous.gdpPerCapita
      ) {
        const gdpPerCapitaChange =
          ((economicData.gdpPerCapita - previous.gdpPerCapita) / previous.gdpPerCapita) * 100;
        if (Math.abs(gdpPerCapitaChange) > 2) {
          // 2% change threshold
          changes.push({
            metric: "GDP per Capita",
            value: economicData.gdpPerCapita,
            changePercent: gdpPerCapitaChange,
            countryId: effectiveCountryId,
          });
        }
      }

      // Growth rate changes
      if (
        economicData.growthRate !== undefined &&
        previous.growthRate !== undefined &&
        economicData.growthRate !== previous.growthRate
      ) {
        const growthRateChange = economicData.growthRate - previous.growthRate;
        if (Math.abs(growthRateChange) > 0.5) {
          // 0.5% change threshold
          changes.push({
            metric: "Growth Rate",
            value: economicData.growthRate,
            changePercent: growthRateChange,
            countryId: effectiveCountryId,
          });
        }
      }

      // Wire economic changes
      changes.forEach((change) => {
        console.log(`[LiveDataIntegration] Economic change detected:`, change);
        wireEconomic(change);
      });
    }

    previousDataRef.current.economic = economicData;
  }, [economicData, wireEconomic, enableEconomicStream, effectiveCountryId]);

  // Diplomatic events integration with specialized service
  useEffect(() => {
    if (!enableDiplomaticStream || !Array.isArray(diplomaticEvents)) return;

    const previous = previousDataRef.current.diplomatic;
    const newEvents = diplomaticEvents.filter(
      (event: any) => !previous.some((prev: any) => prev.id === event.id)
    );

    if (newEvents.length > 0) {
      console.log(
        `[LiveDataIntegration] Processing ${newEvents.length} new diplomatic events via specialized service`
      );

      // Use the specialized diplomatic notification service
      newEvents.forEach(async (event: any) => {
        const diplomaticEvent = {
          id: event.id || `event-${Date.now()}`,
          type: (event.type || "meeting") as
            | "agreement"
            | "treaty"
            | "conflict"
            | "trade"
            | "alliance"
            | "sanction"
            | "embassy"
            | "meeting",
          title: event.title || "Diplomatic Event",
          description: event.description || "New diplomatic development",
          countries: event.countries || [effectiveCountryId],
          significance: (event.significance || "moderate") as
            | "minor"
            | "moderate"
            | "major"
            | "historic",
          timestamp: event.timestamp || Date.now(),
          relatedData: event,
        };

        try {
          await diplomaticNotificationService.processDiplomaticEvent(diplomaticEvent);
        } catch (error) {
          console.warn("[LiveDataIntegration] Failed to process diplomatic event:", error);
        }
      });

      previousDataRef.current.diplomatic = diplomaticEvents;
    }
  }, [diplomaticEvents, enableDiplomaticStream, effectiveCountryId]);

  // Advanced achievement system integration
  useEffect(() => {
    const checkAchievements = () => {
      if (economicData && economicData.gdp) {
        const achievements = [];

        // GDP milestone achievements
        if (economicData.gdp > 1000000000000 && economicData.gdp < 1100000000000) {
          achievements.push({
            id: "trillion-gdp",
            name: "Trillion Dollar Economy",
            description: "Your country has reached a GDP of $1 trillion!",
            category: "economic" as const,
            rarity: "epic" as const,
            unlocked: true,
            unlockedAt: Date.now(),
          });
        }

        if (economicData.gdp > 5000000000000) {
          achievements.push({
            id: "economic-superpower",
            name: "Economic Superpower",
            description: "Your country has achieved a massive $5 trillion GDP!",
            category: "economic" as const,
            rarity: "legendary" as const,
            unlocked: true,
            unlockedAt: Date.now(),
          });
        }

        // Growth rate achievements
        if (economicData.growthRate && economicData.growthRate > 8) {
          achievements.push({
            id: "rapid-growth",
            name: "Economic Boom",
            description: "Sustained economic growth above 8% annually",
            category: "economic" as const,
            rarity: "uncommon" as const,
            unlocked: true,
            unlockedAt: Date.now(),
          });
        }

        // Process achievements through specialized service
        achievements.forEach(async (achievement) => {
          try {
            await achievementNotificationService.processAchievementUnlock(achievement);
          } catch (error) {
            console.warn("[LiveDataIntegration] Failed to process achievement:", error);
          }
        });
      }

      // Intelligence-based achievements
      if (intelligence && Array.isArray(intelligence)) {
        const securityEvents = intelligence.filter((item) => item.category === "security").length;
        if (securityEvents > 10) {
          achievementNotificationService
            .processAchievementUnlock({
              id: "security-expert",
              name: "Security Intelligence Expert",
              description: "Processed over 10 security intelligence reports",
              category: "military" as const,
              rarity: "rare" as const,
              unlocked: true,
              unlockedAt: Date.now(),
            })
            .catch((error) => {
              console.warn("[LiveDataIntegration] Failed to process achievement:", error);
            });
        }
      }
    };

    if (enableEconomicStream || enableIntelligenceStream) {
      const achievementInterval = setInterval(checkAchievements, 120000); // Check every 2 minutes

      return () => clearInterval(achievementInterval);
    }
  }, [economicData, intelligence, enableEconomicStream, enableIntelligenceStream]);

  // Initialize bridge
  useEffect(() => {
    bridge.initialize().catch((error) => {
      console.error("[LiveDataIntegration] Bridge initialization failed:", error);
    });

    // Set up event listeners
    const handleNotificationCreated = (data: any) => {
      console.log("[LiveDataIntegration] Notification created:", data.notification.title);
    };

    bridge.on("notificationCreated", handleNotificationCreated);

    return () => {
      bridge.off("notificationCreated", handleNotificationCreated);
    };
  }, [bridge]);

  // Comprehensive system monitoring
  useEffect(() => {
    const logSystemStats = () => {
      const bridgeStats = bridge.getStats();
      const diplomaticStats = diplomaticNotificationService.getStats();

      console.log("[LiveDataIntegration] System Stats:", {
        bridge: bridgeStats,
        diplomatic: diplomaticStats,
        timestamp: new Date().toISOString(),
      });
    };

    const statsInterval = setInterval(logSystemStats, 300000); // Log every 5 minutes

    // Cleanup diplomatic service periodically
    const cleanupInterval = setInterval(() => {
      diplomaticNotificationService.cleanup();
    }, 600000); // Cleanup every 10 minutes

    return () => {
      clearInterval(statsInterval);
      clearInterval(cleanupInterval);
    };
  }, [bridge]);

  // This component doesn't render anything - it's a pure integration component
  return null;
}

export default LiveDataIntegration;
