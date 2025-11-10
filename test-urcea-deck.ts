/**
 * Test: Fetch Urcea's NationStates Card Deck
 */

import { fetchNSDeck, getNSCardData } from "./src/lib/ns-api-client";

async function testUrceaDeck() {
  console.log("🎴 Fetching Urcea's NationStates Card Deck\n");
  console.log("=" + "=".repeat(60) + "\n");

  try {
    // Fetch Urcea's deck
    console.log("📡 Fetching deck for nation: Urcea...\n");
    const deck = await fetchNSDeck("Urcea");

    console.log("✅ Successfully fetched Urcea's deck!\n");
    console.log("=" + "=".repeat(60));

    // Deck Statistics
    console.log("\n📊 DECK STATISTICS");
    console.log("-".repeat(60));
    console.log(`Total Cards: ${deck.cards.length}`);
    console.log(`Deck Value: ${deck.value?.toLocaleString() || '0'} bank`);
    console.log(`Last Valued At: ${deck.lastValued ? new Date(deck.lastValued).toLocaleString() : 'N/A'}`);

    // Check if deck is empty
    if (deck.cards.length === 0) {
      console.log("\n⚠️  This nation currently has no cards in their deck.");
      console.log("=" + "=".repeat(60));
      return;
    }

    // Rarity breakdown
    const rarityCount: Record<string, number> = {};
    deck.cards.forEach(card => {
      rarityCount[card.rarity] = (rarityCount[card.rarity] || 0) + 1;
    });

    console.log("\n🎨 RARITY BREAKDOWN");
    console.log("-".repeat(60));
    Object.entries(rarityCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([rarity, count]) => {
        const percentage = ((count / deck.cards.length) * 100).toFixed(1);
        console.log(`${rarity.padEnd(12)}: ${count.toString().padStart(4)} (${percentage}%)`);
      });

    // Season breakdown
    const seasonCount: Record<number, number> = {};
    deck.cards.forEach(card => {
      seasonCount[card.season] = (seasonCount[card.season] || 0) + 1;
    });

    console.log("\n🗓️  SEASON BREAKDOWN");
    console.log("-".repeat(60));
    Object.entries(seasonCount)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .forEach(([season, count]) => {
        const percentage = ((count / deck.cards.length) * 100).toFixed(1);
        console.log(`Season ${season}: ${count.toString().padStart(4)} cards (${percentage}%)`);
      });

    // Top 10 most valuable cards
    console.log("\n💎 TOP 10 MOST VALUABLE CARDS");
    console.log("-".repeat(60));

    const sortedByValue = [...deck.cards]
      .sort((a, b) => b.marketValue - a.marketValue)
      .slice(0, 10);

    for (let i = 0; i < sortedByValue.length; i++) {
      const card = sortedByValue[i]!;
      console.log(
        `${(i + 1).toString().padStart(2)}. ${card.nation.padEnd(30)} | ` +
        `S${card.season} | ${card.rarity.padEnd(10)} | ` +
        `Value: ${card.marketValue.toLocaleString().padStart(6)} bank`
      );
    }

    // Legendary/Epic cards
    const legendaryCards = deck.cards.filter(c => c.rarity === 'legendary');
    const epicCards = deck.cards.filter(c => c.rarity === 'epic');

    if (legendaryCards.length > 0) {
      console.log("\n🌟 LEGENDARY CARDS");
      console.log("-".repeat(60));
      legendaryCards.slice(0, 5).forEach((card, i) => {
        console.log(
          `${(i + 1).toString().padStart(2)}. ${card.nation.padEnd(30)} | ` +
          `S${card.season} | Value: ${card.marketValue.toLocaleString()} bank`
        );
      });
      if (legendaryCards.length > 5) {
        console.log(`   ... and ${legendaryCards.length - 5} more legendary cards`);
      }
    }

    if (epicCards.length > 0) {
      console.log("\n⭐ EPIC CARDS");
      console.log("-".repeat(60));
      epicCards.slice(0, 5).forEach((card, i) => {
        console.log(
          `${(i + 1).toString().padStart(2)}. ${card.nation.padEnd(30)} | ` +
          `S${card.season} | Value: ${card.marketValue.toLocaleString()} bank`
        );
      });
      if (epicCards.length > 5) {
        console.log(`   ... and ${epicCards.length - 5} more epic cards`);
      }
    }

    // Sample: Fetch detailed data for one of the top cards
    if (deck.cards.length > 0) {
      console.log("\n🔍 DETAILED CARD EXAMPLE (Top Card)");
      console.log("-".repeat(60));
      const topCard = sortedByValue[0]!;
      console.log(`Fetching full details for: ${topCard.nation} (S${topCard.season})...\n`);

      const cardDetails = await getNSCardData(topCard.cardId, topCard.season);
      if (cardDetails) {
        console.log("Card Details:");
        console.log(`  Nation: ${cardDetails.nation}`);
        console.log(`  Season: ${cardDetails.season}`);
        console.log(`  Rarity: ${cardDetails.rarity}`);
        console.log(`  Region: ${cardDetails.region}`);
        console.log(`  Category: ${cardDetails.cardCategory}`);
        console.log(`  Market Value: ${cardDetails.marketValue.toLocaleString()} bank`);
        console.log(`  Flag: ${cardDetails.flag}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Urcea Deck Test Complete!\n");

  } catch (error) {
    console.error("❌ Error fetching Urcea's deck:", error);
    if (error instanceof Error) {
      console.error("   Error message:", error.message);
      console.error("   Stack:", error.stack);
    }
  }
}

// Run test
testUrceaDeck()
  .then(() => {
    console.log("Test completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
