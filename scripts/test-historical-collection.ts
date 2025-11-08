/**
 * Test script for Historical Data Collection Service
 *
 * Manually triggers a historical data collection and verifies the data was stored correctly.
 */

import { getHistoricalDataService } from "~/services/HistoricalDataCollectionService";
import { db } from "~/server/db";

async function testHistoricalCollection() {
  console.log("=== Testing Historical Data Collection Service ===\n");

  // Get the service
  const service = getHistoricalDataService();

  // Check initial counts
  console.log("Checking initial data counts...");
  const initialCounts = await Promise.all([
    db.historicalDataPoint.count(),
    db.vitalityHistory.count(),
    db.componentEffectivenessHistory.count(),
    db.diplomaticRelationshipHistory.count(),
  ]);

  console.log("Initial counts:");
  console.log(`  HistoricalDataPoint: ${initialCounts[0]}`);
  console.log(`  VitalityHistory: ${initialCounts[1]}`);
  console.log(`  ComponentEffectivenessHistory: ${initialCounts[2]}`);
  console.log(`  DiplomaticRelationshipHistory: ${initialCounts[3]}\n`);

  // Trigger collection
  console.log("Triggering manual collection...");
  const startTime = Date.now();
  await service.collectNow();
  const duration = Date.now() - startTime;
  console.log(`Collection completed in ${duration}ms\n`);

  // Check new counts
  console.log("Checking new data counts...");
  const newCounts = await Promise.all([
    db.historicalDataPoint.count(),
    db.vitalityHistory.count(),
    db.componentEffectivenessHistory.count(),
    db.diplomaticRelationshipHistory.count(),
  ]);

  console.log("New counts:");
  console.log(`  HistoricalDataPoint: ${newCounts[0]} (+${newCounts[0]! - initialCounts[0]!})`);
  console.log(`  VitalityHistory: ${newCounts[1]} (+${newCounts[1]! - initialCounts[1]!})`);
  console.log(`  ComponentEffectivenessHistory: ${newCounts[2]} (+${newCounts[2]! - initialCounts[2]!})`);
  console.log(`  DiplomaticRelationshipHistory: ${newCounts[3]} (+${newCounts[3]! - initialCounts[3]!})\n`);

  // Sample some data
  console.log("Sampling collected data...");

  const sampleHistorical = await db.historicalDataPoint.findFirst({
    orderBy: { createdAt: "desc" },
    include: { country: { select: { name: true } } },
  });

  if (sampleHistorical) {
    console.log("\nSample HistoricalDataPoint:");
    console.log(`  Country: ${sampleHistorical.country.name}`);
    console.log(`  Population: ${sampleHistorical.population.toLocaleString()}`);
    console.log(`  GDP: $${sampleHistorical.totalGdp.toLocaleString()}`);
    console.log(`  GDP Growth: ${(sampleHistorical.gdpGrowthRate * 100).toFixed(2)}%`);
    console.log(`  Timestamp: ${sampleHistorical.ixTimeTimestamp.toISOString()}`);
  }

  const sampleVitality = await db.vitalityHistory.findFirst({
    orderBy: { timestamp: "desc" },
    include: { country: { select: { name: true } } },
  });

  if (sampleVitality) {
    console.log("\nSample VitalityHistory:");
    console.log(`  Country: ${sampleVitality.country.name}`);
    console.log(`  Economic Vitality: ${sampleVitality.economicVitality.toFixed(1)}`);
    console.log(`  Population Wellbeing: ${sampleVitality.populationWellbeing.toFixed(1)}`);
    console.log(`  Diplomatic Standing: ${sampleVitality.diplomaticStanding.toFixed(1)}`);
    console.log(`  Government Efficiency: ${sampleVitality.governmentalEfficiency.toFixed(1)}`);
    console.log(`  Overall Health: ${sampleVitality.overallHealth.toFixed(1)}`);
  }

  // Get service status
  const status = service.getStatus();
  console.log("\n=== Service Status ===");
  console.log(`  Enabled: ${status.enabled}`);
  console.log(`  Running: ${status.running}`);
  console.log(`  Next Run: ${status.nextRun || "Not scheduled"}`);
  console.log(`  Interval: Every ${status.config.intervalHours} hours`);
  console.log(`  Retention: ${status.config.retentionDays} days`);
  console.log(`  Batch Size: ${status.config.batchSize} countries\n`);

  console.log("=== Test Complete ===");

  process.exit(0);
}

testHistoricalCollection().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
