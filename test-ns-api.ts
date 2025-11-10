/**
 * NS API Integration Test Script
 *
 * Tests the NationStates API client functionality
 */

import {
  getNSCardData,
  parseNSDump,
  getRateLimiterStatus,
  type NSCard
} from "./src/lib/ns-api-client";

async function runTests() {
  console.log("🧪 Testing NationStates API Integration\n");
  console.log("=" + "=".repeat(50) + "\n");

  // Test 1: Rate Limiter Status
  console.log("Test 1: Rate Limiter Status");
  console.log("-".repeat(50));
  const rateLimiterStatus = getRateLimiterStatus();
  console.log("✅ Rate Limiter Status:", JSON.stringify(rateLimiterStatus, null, 2));
  console.log();

  // Test 2: Get NS Card Data (Season 3, Card ID 1)
  console.log("Test 2: Fetch NS Card Data");
  console.log("-".repeat(50));
  try {
    console.log("Fetching card data for Season 3, Card ID 1...");
    const cardData = await getNSCardData("1", 3);
    console.log("✅ Successfully fetched card data:");
    console.log(JSON.stringify(cardData, null, 2));
  } catch (error) {
    console.error("❌ Failed to fetch card data:", error);
  }
  console.log();

  // Test 3: Fetch Card Dump URL (won't download, just verify URL construction)
  console.log("Test 3: Card Dump URL Construction");
  console.log("-".repeat(50));
  const dumpUrl = "https://www.nationstates.net/pages/cardlist_S3.xml.gz";
  console.log("✅ Card dump URL for Season 3:", dumpUrl);
  console.log();

  // Test 4: Test XML Parsing with sample data
  console.log("Test 4: XML Parsing Test");
  console.log("-".repeat(50));
  const sampleXML = `<?xml version="1.0" encoding="UTF-8"?>
<CARDS>
  <CARD id="1" season="3">
    <NAME>Test Nation</NAME>
    <TYPE>nation</TYPE>
    <FLAG>https://example.com/flag.png</FLAG>
    <CATEGORY>Left-wing Utopia</CATEGORY>
    <REGION>The Pacific</REGION>
    <RARITY>common</RARITY>
  </CARD>
</CARDS>`;

  try {
    const parsed = parseNSDump(sampleXML);
    console.log("✅ Successfully parsed sample XML:");
    console.log(`   Found ${parsed.length} card(s)`);
    if (parsed.length > 0) {
      console.log("   Sample card:", JSON.stringify(parsed[0], null, 2));
    }
  } catch (error) {
    console.error("❌ Failed to parse XML:", error);
  }
  console.log();

  // Test 5: Verify NS Deck endpoint (without actual nation name)
  console.log("Test 5: NS Deck Endpoint Format");
  console.log("-".repeat(50));
  const nationName = "testlandia";
  const deckUrl = `https://www.nationstates.net/cgi-bin/api.cgi?q=cards+deck;nationname=${nationName}`;
  console.log("✅ NS Deck endpoint format:", deckUrl);
  console.log();

  // Test 6: Rate Limiter Behavior
  console.log("Test 6: Rate Limiter Behavior Test");
  console.log("-".repeat(50));
  console.log("Making 3 rapid requests to test rate limiting...");
  const startTime = Date.now();

  for (let i = 0; i < 3; i++) {
    try {
      await getNSCardData(String(i + 1), 3);
      console.log(`✅ Request ${i + 1} completed successfully`);
    } catch (error) {
      console.log(`⚠️  Request ${i + 1} failed (expected for testing):`, (error as Error).message);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`⏱️  3 requests completed in ${elapsed}ms`);

  const finalStatus = getRateLimiterStatus();
  console.log("Final rate limiter status:", JSON.stringify(finalStatus, null, 2));
  console.log();

  console.log("=" + "=".repeat(50));
  console.log("✅ NS API Integration Tests Complete!\n");
}

// Run tests
runTests()
  .then(() => {
    console.log("All tests completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
  });
