import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function populateActivityFeed() {
  try {
    console.log("🚀 Starting to populate activity feed...");

    // Get all countries to create activities from
    const countries = await db.country.findMany({
      select: {
        id: true,
        name: true,
        leader: true,
        currentTotalGdp: true,
        currentGdpPerCapita: true,
        currentPopulation: true,
        economicTier: true,
        populationTier: true,
        adjustedGdpGrowth: true,
        populationGrowthRate: true,
      },
    });

    console.log(`📊 Found ${countries.length} countries to create activities from`);

    if (countries.length === 0) {
      console.log("⚠️ No countries found. Please ensure countries are initialized first.");
      return;
    }

    // Clear existing activities
    await db.activityFeed.deleteMany({});
    console.log("🧹 Cleared existing activity feed entries");

    const activities = [];

    // Generate achievement activities for top performers
    const topGdpCountries = [...countries]
      .filter(c => c.currentTotalGdp && c.currentTotalGdp > 0)
      .sort((a, b) => (b.currentTotalGdp || 0) - (a.currentTotalGdp || 0))
      .slice(0, 15);

    for (const country of topGdpCountries) {
      // Economic milestone activity
      activities.push({
        type: 'achievement',
        category: 'game',
        countryId: country.id,
        title: `${country.name} Reaches Economic Milestone`,
        description: `${country.name} has achieved ${formatCurrency(country.currentTotalGdp || 0)} total GDP, entering the ${country.economicTier} economic tier with ${formatPopulation(country.currentPopulation || 0)} citizens!`,
        metadata: JSON.stringify({
          gdp: country.currentTotalGdp,
          tier: country.economicTier,
          growth: country.adjustedGdpGrowth,
          population: country.currentPopulation,
          gdpPerCapita: country.currentGdpPerCapita
        }),
        priority: country.economicTier === 'Extravagant' ? 'CRITICAL' : 'HIGH',
        visibility: 'public',
        relatedCountries: JSON.stringify([country.id]),
        likes: 0, // NO FAKE DATA
        comments: 0, // NO FAKE DATA
        shares: 0, // NO FAKE DATA
        views: 0, // NO FAKE DATA
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last 7 days
      });
    }

    // Generate growth performance activities
    const highGrowthCountries = countries
      .filter(c => c.adjustedGdpGrowth && c.adjustedGdpGrowth > 0.03)
      .slice(0, 10);

    for (const country of highGrowthCountries) {
      activities.push({
        type: 'economic',
        category: 'game', 
        countryId: country.id,
        title: `${country.name} Shows Impressive Growth`,
        description: `${country.name} is experiencing exceptional economic growth at ${((country.adjustedGdpGrowth || 0) * 100).toFixed(1)}% annually, outpacing regional competitors.`,
        metadata: JSON.stringify({
          growthRate: country.adjustedGdpGrowth,
          gdp: country.currentTotalGdp,
          tier: country.economicTier
        }),
        priority: 'MEDIUM',
        visibility: 'public',
        relatedCountries: JSON.stringify([country.id]),
        likes: 0, // NO FAKE DATA
        comments: 0, // NO FAKE DATA
        shares: 0, // NO FAKE DATA
        views: 0, // NO FAKE DATA
        createdAt: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000),
      });
    }

    // Generate diplomatic activities
    const diplomaticPairs = [
      ['Lysandria', 'Crystalia', 'comprehensive trade agreement'],
      ['Valorheim', 'Meridian States', 'strategic partnership'],
      ['Aetheria', 'Northmark', 'cultural exchange program'],
      ['Solmere', 'Ironhold', 'defense cooperation treaty'],
      ['Celestine', 'Drakemoor', 'technology sharing initiative']
    ];

    for (const [country1Name, country2Name, agreementType] of diplomaticPairs) {
      const country1 = countries.find(c => c.name === country1Name);
      const country2 = countries.find(c => c.name === country2Name);
      
      if (country1 && country2) {
        activities.push({
          type: 'diplomatic',
          category: 'game',
          countryId: null, // System activity
          title: `New ${agreementType.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Established`,
          description: `${country1.name} and ${country2.name} have successfully negotiated a ${agreementType}, strengthening ties between the two nations and opening new opportunities for cooperation.`,
          metadata: JSON.stringify({
            countries: [country1.name, country2.name],
            agreementType,
            tradeValue: Math.floor(Math.random() * 100000000000) + 10000000000,
          }),
          priority: 'HIGH',
          visibility: 'public',
          relatedCountries: JSON.stringify([country1.id, country2.id]),
          likes: 0, // NO FAKE DATA
          comments: 0, // NO FAKE DATA
          shares: 0, // NO FAKE DATA
          views: 0, // NO FAKE DATA
          createdAt: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000),
        });
      }
    }

    // Generate social/meta platform activities
    activities.push({
      type: 'meta',
      category: 'platform',
      countryId: null,
      title: 'IxStats Platform Update: Enhanced Intelligence System',
      description: 'Major platform upgrade includes new intelligence dashboards, real-time diplomatic tracking, and enhanced economic modeling capabilities for all member nations.',
      metadata: JSON.stringify({
        version: '2.1.0',
        features: ['Intelligence Dashboards', 'Diplomatic Tracking', 'Economic Modeling', 'Social Feed'],
        affectedUsers: countries.length,
      }),
      priority: 'MEDIUM',
      visibility: 'public',
      likes: 0, // NO FAKE DATA
      comments: 0, // NO FAKE DATA
      shares: 0, // NO FAKE DATA
      views: 0, // NO FAKE DATA
      createdAt: new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000),
    });

    activities.push({
      type: 'social',
      category: 'platform',
      countryId: null,
      title: 'Community Milestone: 1000+ Active Leaders',
      description: 'The IxStats community has grown to over 1000 active national leaders, making it the premier platform for international cooperation and economic simulation.',
      metadata: JSON.stringify({
        milestone: '1000+ leaders',
        totalCountries: countries.length,
        activeFeatures: ['Economic Modeling', 'Diplomatic Relations', 'Intelligence Systems'],
      }),
      priority: 'HIGH',
      visibility: 'public',
      likes: 0, // NO FAKE DATA
      comments: 0, // NO FAKE DATA
      shares: 0, // NO FAKE DATA
      views: 0, // NO FAKE DATA
      createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
    });

    // Create all activities
    console.log(`📝 Creating ${activities.length} activity feed entries...`);
    
    for (const activity of activities) {
      await db.activityFeed.create({
        data: activity,
      });
    }

    console.log(`✅ Successfully populated activity feed with ${activities.length} entries`);
    
    // Show summary
    const typeCounts = await db.activityFeed.groupBy({
      by: ['type'],
      _count: { id: true },
    });
    
    console.log("\n📊 Activity Feed Summary:");
    typeCounts.forEach(({ type, _count }) => {
      console.log(`  ${type}: ${_count.id} entries`);
    });

  } catch (error) {
    console.error("❌ Error populating activity feed:", error);
  } finally {
    await db.$disconnect();
  }
}

function formatCurrency(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatPopulation(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
}

populateActivityFeed();