# API Request/Response Examples

**Last Updated:** October 22, 2025
**Version:** v1.2

This guide provides practical request/response examples for the 20 most commonly used IxStats tRPC endpoints. Use these examples as templates for integrating with the IxStats API.

## Table of Contents
- [Authentication](#authentication)
- [Country Management](#country-management)
- [MyCountry Operations](#mycountry-operations)
- [Economic Data](#economic-data)
- [Diplomatic Relations](#diplomatic-relations)
- [Social Platform (ThinkPages)](#social-platform-thinkpages)
- [Admin Operations](#admin-operations)
- [Government Systems](#government-systems)
- [Tax System](#tax-system)
- [National Identity](#national-identity)
- [Error Handling](#error-handling)

---

## Authentication

All protected endpoints require Clerk authentication. The tRPC client automatically includes authentication headers when used within a ClerkProvider context.

### Client Setup
```typescript
import { api } from "~/lib/trpc";
import { ClerkProvider } from "@clerk/nextjs";

// Wrap your app with ClerkProvider in app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}

// Use tRPC hooks in your components
function MyComponent() {
  const { data, isLoading, error } = api.countries.getAll.useQuery();
  // ...
}
```

### Authentication Headers (Internal)
When the tRPC client makes requests, it automatically includes:
```
Authorization: Bearer <clerk_session_token>
Content-Type: application/json
```

---

## Country Management

### 1. countries.getAll
Retrieve all countries with optional filtering and pagination.

**Endpoint:** `countries.getAll`
**Type:** Query
**Authentication:** Public
**Rate Limit:** 100 requests/minute

**Request:**
```typescript
const { data: countries } = api.countries.getAll.useQuery({
  limit: 20,
  offset: 0,
  includeEconomicData: true,
  sortBy: 'gdp',
  sortOrder: 'desc'
});
```

**Response (Success):**
```typescript
{
  countries: [
    {
      id: "clx7y8z9a0000abc123def456",
      countryName: "Democratic Republic of Exemplaria",
      slug: "exemplaria",
      capitalCity: "New Capital",
      population: 50000000,
      currentTotalGdp: 1000000000000,
      currentGdpPerCapita: 20000,
      economicTier: "EMERGING",
      populationTier: "MEDIUM",
      flagUrl: "https://ixwiki.com/images/flags/exemplaria.png",
      createdAt: "2025-10-15T14:30:00.000Z",
      updatedAt: "2025-10-22T10:15:00.000Z",
      userId: "user_2abcdef123456",
      economicData: {
        gdpGrowthRate: 0.035,
        inflationRate: 0.02,
        unemploymentRate: 0.05,
        // ... additional economic indicators
      }
    },
    // ... more countries
  ],
  total: 45,
  hasMore: true
}
```

**Response (Error - Rate Limited):**
```typescript
{
  error: {
    code: "TOO_MANY_REQUESTS",
    message: "Rate limit exceeded. Please try again in 30 seconds."
  }
}
```

---

### 2. countries.createCountry
Create a new country with complete configuration.

**Endpoint:** `countries.createCountry`
**Type:** Mutation
**Authentication:** Required (Clerk session)
**Rate Limit:** 30 requests/minute

**Request:**
```typescript
const createCountry = api.countries.createCountry.useMutation({
  onSuccess: (data) => {
    console.log("Country created:", data.country.id);
    // Navigate to new country page
    router.push(`/countries/${data.country.slug}`);
  },
  onError: (error) => {
    console.error("Failed to create country:", error.message);
  }
});

// Invoke mutation
createCountry.mutate({
  countryName: "Republic of Innovation",
  officialName: "The Democratic Republic of Innovation",
  capitalCity: "Techville",
  population: 25000000,
  gdp: 500000000000,
  area: 250000,
  currencyName: "Innovation Dollar",
  currencySymbol: "I$",
  currencyCode: "IND",
  motto: "Progress Through Innovation",
  anthem: "Song of the Future",
  establishedDate: "1990-01-01",
  economicSystem: "mixed_market",
  governmentType: "federal_republic",
  // Optional: National identity data
  nationalIdentity: {
    officialLanguages: ["English", "Spanish"],
    ethnicGroups: {
      "Innovators": 65,
      "Traditionalists": 25,
      "Others": 10
    },
    majorReligions: {
      "Secular": 45,
      "Christian": 30,
      "Other": 25
    },
    nationalColors: ["#0066CC", "#FFFFFF", "#FFD700"],
    nationalSymbols: {
      animal: "Eagle",
      flower: "Lotus",
      tree: "Oak"
    }
  },
  // Optional: Tax system configuration
  taxSystem: {
    categories: [
      {
        name: "Personal Income Tax",
        type: "income",
        brackets: [
          { minIncome: 0, maxIncome: 50000, rate: 10 },
          { minIncome: 50000, maxIncome: 100000, rate: 20 },
          { minIncome: 100000, rate: 30 }
        ]
      }
    ]
  }
});
```

**Response (Success):**
```typescript
{
  success: true,
  country: {
    id: "clx8a1b2c3d4e5f6g7h8i9j0",
    countryName: "Republic of Innovation",
    slug: "republic-of-innovation",
    officialName: "The Democratic Republic of Innovation",
    capitalCity: "Techville",
    population: 25000000,
    currentTotalGdp: 500000000000,
    currentGdpPerCapita: 20000,
    economicTier: "EMERGING",
    populationTier: "MEDIUM",
    createdAt: "2025-10-22T15:30:00.000Z",
    userId: "user_2xyz789abc123",
    // ... full country object with all fields
  },
  message: "Country created successfully"
}
```

**Response (Error - Duplicate Name):**
```typescript
{
  error: {
    code: "BAD_REQUEST",
    message: "A country with the name 'Republic of Innovation' already exists"
  }
}
```

**Response (Error - Invalid Input):**
```typescript
{
  error: {
    code: "BAD_REQUEST",
    message: "Validation error",
    details: [
      {
        field: "population",
        message: "Population must be greater than 0"
      },
      {
        field: "gdp",
        message: "GDP must be a positive number"
      }
    ]
  }
}
```

**Common Issues:**
- Ensure `countryName` is unique across the platform
- `population` must be > 0
- `gdp` must be > 0
- `currencyCode` should be 3 uppercase letters (ISO 4217 format recommended)
- User can only create one country (check with `users.getProfile` first)

---

### 3. countries.updateCountry
Update an existing country's basic information.

**Endpoint:** `countries.updateCountry`
**Type:** Mutation
**Authentication:** Required (Country owner or admin)
**Rate Limit:** 60 requests/minute

**Request:**
```typescript
const updateCountry = api.countries.updateCountry.useMutation({
  onSuccess: () => {
    toast.success("Country updated successfully");
    utils.countries.getById.invalidate({ id: countryId });
  }
});

updateCountry.mutate({
  id: "clx8a1b2c3d4e5f6g7h8i9j0",
  countryName: "United Republic of Innovation",
  capitalCity: "New Techville",
  population: 26500000,
  motto: "Innovation for All",
  flagUrl: "https://example.com/new-flag.png"
});
```

**Response (Success):**
```typescript
{
  success: true,
  country: {
    id: "clx8a1b2c3d4e5f6g7h8i9j0",
    countryName: "United Republic of Innovation",
    slug: "united-republic-of-innovation",
    capitalCity: "New Techville",
    population: 26500000,
    updatedAt: "2025-10-22T16:45:00.000Z",
    // ... full updated country object
  }
}
```

**Response (Error - Unauthorized):**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "You do not have permission to update this country"
  }
}
```

---

### 4. countries.getById
Retrieve a single country by ID with full economic data.

**Endpoint:** `countries.getById`
**Type:** Query
**Authentication:** Public
**Rate Limit:** 100 requests/minute

**Request:**
```typescript
const { data: country, isLoading } = api.countries.getById.useQuery({
  id: "clx8a1b2c3d4e5f6g7h8i9j0",
  includeEconomicData: true,
  includeRelations: true
});
```

**Response (Success):**
```typescript
{
  id: "clx8a1b2c3d4e5f6g7h8i9j0",
  countryName: "United Republic of Innovation",
  slug: "united-republic-of-innovation",
  officialName: "The United Republic of Innovation",
  capitalCity: "New Techville",
  population: 26500000,
  currentTotalGdp: 530000000000,
  currentGdpPerCapita: 20000,
  economicTier: "EMERGING",
  populationTier: "MEDIUM",
  createdAt: "2025-10-22T15:30:00.000Z",
  updatedAt: "2025-10-22T16:45:00.000Z",

  // Economic data
  economicData: {
    gdpGrowthRate: 0.035,
    inflationRate: 0.022,
    unemploymentRate: 0.048,
    tradeBalance: 15000000000,
    publicDebt: 250000000000,
    // ... comprehensive economic indicators
  },

  // Diplomatic relations
  diplomaticRelations: [
    {
      id: "rel_123abc",
      targetCountryId: "clx9b2c3d4e5f6g7h8i9j0k1",
      targetCountryName: "Republic of Trade",
      relationship: "ally",
      strength: 85,
      lastContact: "2025-10-20T10:00:00.000Z"
    }
  ],

  // National identity
  nationalIdentity: {
    motto: "Innovation for All",
    anthem: "Song of the Future",
    officialLanguages: ["English", "Spanish"],
    // ... full national identity data
  }
}
```

**Response (Error - Not Found):**
```typescript
{
  error: {
    code: "NOT_FOUND",
    message: "Country with ID 'clx8a1b2c3d4e5f6g7h8i9j0' not found"
  }
}
```

---

## MyCountry Operations

### 5. mycountry.getDashboardData
Get comprehensive dashboard data for user's country.

**Endpoint:** `mycountry.getDashboardData`
**Type:** Query
**Authentication:** Required (Country owner)
**Rate Limit:** 60 requests/minute

**Request:**
```typescript
const { data: dashboard } = api.mycountry.getDashboardData.useQuery({
  timeRange: "30d",
  includeProjections: true
});
```

**Response (Success):**
```typescript
{
  country: {
    id: "clx8a1b2c3d4e5f6g7h8i9j0",
    countryName: "United Republic of Innovation",
    // ... basic country data
  },

  // Vitality scores (0-100)
  vitalityScores: {
    economicVitality: 78,
    populationWellbeing: 82,
    diplomaticStanding: 75,
    governmentalEfficiency: 80,
    overallScore: 79
  },

  // Intelligence feed
  intelligenceFeed: [
    {
      id: "intel_abc123",
      type: "economic_alert",
      priority: "high",
      title: "GDP Growth Exceeds Projections",
      summary: "Q3 GDP growth reached 4.2%, surpassing the projected 3.5%",
      timestamp: "2025-10-22T08:00:00.000Z",
      category: "economy",
      actionable: true,
      actions: [
        {
          label: "View Economic Report",
          route: "/mycountry/economy"
        }
      ]
    },
    // ... more intelligence items
  ],

  // Recent achievements
  achievements: [
    {
      id: "achievement_xyz789",
      name: "Economic Milestone",
      description: "GDP surpassed $500 billion",
      unlockedAt: "2025-10-21T14:30:00.000Z",
      rarity: "rare",
      points: 100
    }
  ],

  // Key metrics
  metrics: {
    gdpGrowth: 0.042,
    inflationRate: 0.022,
    unemploymentRate: 0.045,
    budgetBalance: -15000000000,
    diplomaticRelations: 12,
    activeEmbassies: 8
  },

  // Economic projections
  projections: {
    nextQuarter: {
      gdp: 545000000000,
      gdpGrowth: 0.038,
      confidence: 0.85
    },
    nextYear: {
      gdp: 580000000000,
      gdpGrowth: 0.035,
      confidence: 0.72
    }
  }
}
```

---

### 6. mycountry.updateEconomy
Update economic indicators for your country.

**Endpoint:** `mycountry.updateEconomy`
**Type:** Mutation
**Authentication:** Required (Country owner)
**Rate Limit:** 30 requests/minute

**Request:**
```typescript
const updateEconomy = api.mycountry.updateEconomy.useMutation({
  onSuccess: (data) => {
    toast.success("Economic data updated");
    // Invalidate related queries
    utils.mycountry.getDashboardData.invalidate();
    utils.countries.getById.invalidate({ id: data.countryId });
  }
});

updateEconomy.mutate({
  countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
  economicData: {
    gdp: 550000000000,
    gdpGrowthRate: 0.042,
    inflationRate: 0.021,
    unemploymentRate: 0.044,
    tradeBalance: 18000000000,
    publicDebt: 245000000000,
    foreignReserves: 120000000000,
    // Labor market data
    laborForce: 13000000,
    employmentByIndustry: {
      services: 65,
      manufacturing: 25,
      agriculture: 10
    },
    // Fiscal data
    governmentRevenue: 85000000000,
    governmentExpenditure: 95000000000,
    taxRevenue: 75000000000
  }
});
```

**Response (Success):**
```typescript
{
  success: true,
  countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
  economicData: {
    // Updated economic indicators
    gdp: 550000000000,
    gdpPerCapita: 20755,
    gdpGrowthRate: 0.042,
    // ... complete economic data with calculated fields
  },
  calculations: {
    tierChange: {
      previous: "EMERGING",
      current: "EMERGING",
      changed: false
    },
    milestones: [
      {
        type: "gdp_growth",
        threshold: 0.04,
        achieved: true,
        timestamp: "2025-10-22T17:00:00.000Z"
      }
    ]
  },
  message: "Economic data updated successfully"
}
```

---

## Economic Data

### 7. economics.getProjections
Get economic projections for a country.

**Endpoint:** `economics.getProjections`
**Type:** Query
**Authentication:** Public
**Rate Limit:** 100 requests/minute

**Request:**
```typescript
const { data: projections } = api.economics.getProjections.useQuery({
  countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
  years: 5,
  includeScenarios: true
});
```

**Response (Success):**
```typescript
{
  countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
  baseYear: 2025,

  projections: [
    {
      year: 2026,
      quarter: 1,
      gdp: 565000000000,
      gdpGrowthRate: 0.038,
      gdpPerCapita: 21132,
      population: 26740000,
      inflationRate: 0.022,
      unemploymentRate: 0.042,
      confidence: 0.88
    },
    {
      year: 2026,
      quarter: 2,
      gdp: 575000000000,
      gdpGrowthRate: 0.035,
      gdpPerCapita: 21453,
      population: 26800000,
      inflationRate: 0.021,
      unemploymentRate: 0.040,
      confidence: 0.85
    },
    // ... quarterly projections for 5 years
  ],

  // Alternative scenarios
  scenarios: {
    optimistic: {
      year5Gdp: 720000000000,
      avgGrowthRate: 0.048,
      assumptions: [
        "Strong foreign investment",
        "Technological innovation boom",
        "Stable political environment"
      ]
    },
    baseline: {
      year5Gdp: 680000000000,
      avgGrowthRate: 0.040,
      assumptions: [
        "Moderate growth continuation",
        "Stable trade relationships",
        "Normal economic conditions"
      ]
    },
    pessimistic: {
      year5Gdp: 620000000000,
      avgGrowthRate: 0.028,
      assumptions: [
        "Global economic downturn",
        "Trade restrictions",
        "Political instability"
      ]
    }
  },

  metadata: {
    calculatedAt: "2025-10-22T17:15:00.000Z",
    modelVersion: "v2.1.0",
    inputFactors: [
      "historical_gdp_growth",
      "population_trends",
      "economic_tier",
      "trade_relationships",
      "government_effectiveness"
    ]
  }
}
```

---

## Diplomatic Relations

### 8. diplomatic.createEmbassy
Establish an embassy in another country.

**Endpoint:** `diplomatic.createEmbassy`
**Type:** Mutation
**Authentication:** Required (Country owner)
**Rate Limit:** 20 requests/minute

**Request:**
```typescript
const createEmbassy = api.diplomatic.createEmbassy.useMutation({
  onSuccess: (data) => {
    toast.success(`Embassy established in ${data.embassy.targetCountryName}`);
    utils.diplomatic.getEmbassies.invalidate();
  }
});

createEmbassy.mutate({
  countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
  targetCountryId: "clx9b2c3d4e5f6g7h8i9j0k1",
  ambassadorName: "Ambassador Jane Smith",
  staffCount: 25,
  embassyLocation: "Downtown District, Capital City",
  specialization: "trade",
  budget: 5000000
});
```

**Response (Success):**
```typescript
{
  success: true,
  embassy: {
    id: "embassy_abc123xyz",
    countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
    targetCountryId: "clx9b2c3d4e5f6g7h8i9j0k1",
    targetCountryName: "Republic of Trade",
    ambassadorName: "Ambassador Jane Smith",
    staffCount: 25,
    embassyLocation: "Downtown District, Capital City",
    specialization: "trade",
    budget: 5000000,
    status: "active",
    establishedAt: "2025-10-22T17:30:00.000Z",
    relationshipBonus: 10,
    monthlyMaintenance: 250000
  },
  relationshipUpdate: {
    previousStrength: 65,
    newStrength: 75,
    statusChange: false
  }
}
```

**Response (Error - Already Exists):**
```typescript
{
  error: {
    code: "BAD_REQUEST",
    message: "An embassy already exists in Republic of Trade"
  }
}
```

---

### 9. diplomatic.getRelationships
Get all diplomatic relationships for a country.

**Endpoint:** `diplomatic.getRelationships`
**Type:** Query
**Authentication:** Public
**Rate Limit:** 100 requests/minute

**Request:**
```typescript
const { data: relations } = api.diplomatic.getRelationships.useQuery({
  countryId: "clx8a1b2c3d4e5f6g7h8i9j0"
});
```

**Response (Success):**
```typescript
[
  {
    id: "rel_abc123",
    targetCountryId: "clx9b2c3d4e5f6g7h8i9j0k1",
    targetCountry: "Republic of Trade",
    relationship: "ally",
    strength: 85,
    treaties: [
      {
        id: "treaty_xyz789",
        name: "Free Trade Agreement",
        type: "trade",
        signedAt: "2024-05-15T10:00:00.000Z",
        status: "active"
      },
      {
        id: "treaty_def456",
        name: "Cultural Exchange Program",
        type: "cultural",
        signedAt: "2024-08-20T14:30:00.000Z",
        status: "active"
      }
    ],
    lastContact: "2025-10-20T10:00:00.000Z",
    status: "active",
    diplomaticChannels: ["embassy", "consulate", "trade_mission"],
    tradeVolume: 25000000000,
    culturalExchange: "High",
    recentActivity: "Bilateral trade talks concluded successfully",
    economicTier: "EMERGING",
    flagUrl: "https://ixwiki.com/images/flags/trade-republic.png",
    establishedAt: "2023-01-10T08:00:00.000Z"
  },
  {
    id: "rel_ghi789",
    targetCountryId: "clx0c3d4e5f6g7h8i9j0k1l2",
    targetCountry: "Federation of Industry",
    relationship: "neutral",
    strength: 50,
    treaties: [],
    lastContact: "2025-09-15T16:00:00.000Z",
    status: "active",
    diplomaticChannels: ["consulate"],
    tradeVolume: 5000000000,
    culturalExchange: "Low",
    recentActivity: "Consular services agreement signed",
    economicTier: "DEVELOPED",
    flagUrl: "https://ixwiki.com/images/flags/industry-federation.png",
    establishedAt: "2024-11-05T12:00:00.000Z"
  }
  // ... more relationships
]
```

---

## Social Platform (ThinkPages)

### 10. thinkpages.createPost
Create a new ThinkPages post.

**Endpoint:** `thinkpages.createPost`
**Type:** Mutation
**Authentication:** Required
**Rate Limit:** 50 requests/minute

**Request:**
```typescript
const createPost = api.thinkpages.createPost.useMutation({
  onSuccess: (data) => {
    toast.success("Post published");
    utils.thinkpages.getFeed.invalidate();
  }
});

createPost.mutate({
  accountId: "account_abc123",
  content: "Excited to announce our new trade agreement with the Republic of Trade! This will boost bilateral trade by 30% over the next year. #diplomacy #trade #economicgrowth",
  hashtags: ["diplomacy", "trade", "economicgrowth"],
  mentions: ["@RepublicOfTrade"],
  visibility: "public",
  visualizations: [
    {
      type: "trade_flow",
      title: "Projected Trade Growth",
      config: {
        chartType: "line",
        dataSource: "trade_projections",
        timeRange: {
          start: "2025-10-01",
          end: "2026-10-01"
        },
        metrics: ["exports", "imports", "trade_balance"],
        countries: ["united-republic-of-innovation", "republic-of-trade"],
        colors: ["#0066CC", "#00CC66"],
        displayOptions: {
          showLegend: true,
          animateOnLoad: true
        }
      }
    }
  ]
});
```

**Response (Success):**
```typescript
{
  success: true,
  post: {
    id: "post_xyz789def",
    accountId: "account_abc123",
    content: "Excited to announce our new trade agreement with the Republic of Trade! This will boost bilateral trade by 30% over the next year. #diplomacy #trade #economicgrowth",
    hashtags: ["diplomacy", "trade", "economicgrowth"],
    mentions: ["@RepublicOfTrade"],
    visibility: "public",
    createdAt: "2025-10-22T18:00:00.000Z",
    updatedAt: "2025-10-22T18:00:00.000Z",

    // Engagement metrics
    engagement: {
      likes: 0,
      reposts: 0,
      replies: 0,
      views: 0
    },

    // Account info
    account: {
      id: "account_abc123",
      username: "URIOfficial",
      displayName: "United Republic of Innovation",
      accountType: "government",
      verified: true,
      profileImageUrl: "https://example.com/uri-flag.png"
    },

    // Visualizations
    visualizations: [
      {
        id: "viz_abc123",
        type: "trade_flow",
        title: "Projected Trade Growth",
        config: { /* ... */ },
        renderedUrl: "https://ixstats.com/api/visualizations/viz_abc123"
      }
    ]
  }
}
```

**Response (Error - Content Too Long):**
```typescript
{
  error: {
    code: "BAD_REQUEST",
    message: "Post content exceeds maximum length of 280 characters"
  }
}
```

**Response (Error - XSS Detected):**
```typescript
{
  error: {
    code: "BAD_REQUEST",
    message: "Content contains potentially unsafe HTML. Please avoid using script tags, javascript: URLs, or event handlers."
  }
}
```

---

### 11. thinkpages.getFeed
Get the ThinkPages feed with filtering options.

**Endpoint:** `thinkpages.getFeed`
**Type:** Query
**Authentication:** Public
**Rate Limit:** 100 requests/minute

**Request:**
```typescript
const { data: feed } = api.thinkpages.getFeed.useQuery({
  limit: 20,
  offset: 0,
  filter: "all", // "all" | "following" | "country"
  sortBy: "recent" // "recent" | "popular" | "trending"
});
```

**Response (Success):**
```typescript
{
  posts: [
    {
      id: "post_xyz789def",
      accountId: "account_abc123",
      content: "Excited to announce our new trade agreement...",
      hashtags: ["diplomacy", "trade", "economicgrowth"],
      createdAt: "2025-10-22T18:00:00.000Z",

      account: {
        id: "account_abc123",
        username: "URIOfficial",
        displayName: "United Republic of Innovation",
        accountType: "government",
        verified: true,
        profileImageUrl: "https://example.com/uri-flag.png",
        countryName: "United Republic of Innovation"
      },

      engagement: {
        likes: 45,
        reposts: 12,
        replies: 8,
        views: 523
      },

      userInteraction: {
        hasLiked: false,
        hasReposted: false,
        hasBookmarked: false
      },

      visualizations: [
        {
          id: "viz_abc123",
          type: "trade_flow",
          title: "Projected Trade Growth",
          thumbnailUrl: "https://ixstats.com/api/visualizations/viz_abc123/thumbnail"
        }
      ]
    }
    // ... more posts
  ],
  total: 247,
  hasMore: true,
  nextOffset: 20
}
```

---

## Admin Operations

### 12. admin.getSystemStatus
Get comprehensive system status (admin only).

**Endpoint:** `admin.getSystemStatus`
**Type:** Query
**Authentication:** Required (Admin role)
**Rate Limit:** 30 requests/minute

**Request:**
```typescript
const { data: status } = api.admin.getSystemStatus.useQuery();
```

**Response (Success):**
```typescript
{
  system: {
    version: "v1.2.0",
    environment: "production",
    uptime: 2592000, // seconds
    serverTime: "2025-10-22T18:30:00.000Z",
    ixTime: {
      current: "2051-10-22T18:30:00.000Z",
      multiplier: 2,
      botStatus: "connected"
    }
  },

  database: {
    status: "healthy",
    provider: "postgresql",
    connectionPool: {
      active: 12,
      idle: 8,
      waiting: 0,
      maxConnections: 20
    },
    queryPerformance: {
      avgQueryTime: 45, // milliseconds
      slowQueries: 3,
      queryCount: 15247
    }
  },

  statistics: {
    totalCountries: 45,
    activeUsers: 128,
    totalPosts: 1547,
    totalEmbassies: 89,
    totalTreaties: 156,
    dailyActiveUsers: 67,
    monthlyActiveUsers: 115
  },

  apiHealth: {
    status: "operational",
    totalRequests24h: 45892,
    avgResponseTime: 125, // milliseconds
    errorRate: 0.002, // 0.2%
    rateLimitHits: 34
  },

  externalServices: {
    ixwiki: {
      status: "connected",
      lastCheck: "2025-10-22T18:25:00.000Z",
      responseTime: 234 // milliseconds
    },
    discord: {
      status: "connected",
      lastWebhook: "2025-10-22T18:20:00.000Z"
    },
    redis: {
      status: "connected",
      memoryUsage: "45MB",
      keysCount: 1247
    }
  },

  errors: {
    last24h: 12,
    criticalErrors: 0,
    recentErrors: [
      {
        timestamp: "2025-10-22T17:45:00.000Z",
        level: "warning",
        message: "Rate limit exceeded for IP 192.168.1.100",
        code: "RATE_LIMIT"
      }
    ]
  }
}
```

**Response (Error - Unauthorized):**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Admin access required"
  }
}
```

---

## Government Systems

### 13. governmentStructure.update
Update government structure configuration.

**Endpoint:** `atomicGovernment.updateStructure`
**Type:** Mutation
**Authentication:** Required (Country owner)
**Rate Limit:** 30 requests/minute

**Request:**
```typescript
const updateGovernment = api.atomicGovernment.updateStructure.useMutation({
  onSuccess: () => {
    toast.success("Government structure updated");
    utils.mycountry.getDashboardData.invalidate();
  }
});

updateGovernment.mutate({
  countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
  structure: {
    governmentType: "federal_republic",
    executiveBranch: {
      type: "presidential",
      headOfState: "President",
      termLength: 4,
      termLimits: 2
    },
    legislativeBranch: {
      type: "bicameral",
      upperHouse: {
        name: "Senate",
        seats: 100,
        termLength: 6
      },
      lowerHouse: {
        name: "House of Representatives",
        seats: 435,
        termLength: 2
      }
    },
    judicialBranch: {
      type: "supreme_court",
      justices: 9,
      appointmentProcess: "presidential_nomination_senate_confirmation"
    }
  },
  components: [
    {
      type: "ExecutiveDepartment",
      name: "Ministry of Finance",
      budget: 15000000000,
      effectiveness: 85,
      priority: "high"
    },
    {
      type: "ExecutiveDepartment",
      name: "Ministry of Defense",
      budget: 25000000000,
      effectiveness: 90,
      priority: "critical"
    }
  ]
});
```

**Response (Success):**
```typescript
{
  success: true,
  structure: {
    id: "gov_struct_abc123",
    countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
    governmentType: "federal_republic",
    // ... full structure details
  },
  components: [
    {
      id: "comp_def456",
      type: "ExecutiveDepartment",
      name: "Ministry of Finance",
      effectiveness: 85,
      synergies: [
        {
          componentId: "comp_ghi789",
          componentName: "Ministry of Trade",
          synergyBonus: 15,
          description: "Finance and Trade departments coordinate on economic policy"
        }
      ]
    }
    // ... more components
  ],
  analytics: {
    totalBudget: 95000000000,
    averageEffectiveness: 82,
    synergyCount: 8,
    totalSynergyBonus: 12.5
  }
}
```

---

## Tax System

### 14. taxSystem.update
Update tax system configuration.

**Endpoint:** `taxSystem.update`
**Type:** Mutation
**Authentication:** Required (Country owner)
**Rate Limit:** 30 requests/minute

**Request:**
```typescript
const updateTaxSystem = api.taxSystem.update.useMutation({
  onSuccess: (data) => {
    toast.success("Tax system updated");
    console.log("Projected revenue:", data.projectedRevenue);
  }
});

updateTaxSystem.mutate({
  countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
  taxSystem: {
    categories: [
      {
        name: "Personal Income Tax",
        type: "income",
        enabled: true,
        brackets: [
          { minIncome: 0, maxIncome: 50000, rate: 10 },
          { minIncome: 50000, maxIncome: 100000, rate: 20 },
          { minIncome: 100000, maxIncome: 200000, rate: 30 },
          { minIncome: 200000, rate: 35 }
        ],
        deductions: [
          { name: "Standard Deduction", amount: 12000 },
          { name: "Mortgage Interest", amount: 5000 }
        ],
        credits: [
          { name: "Child Tax Credit", amount: 2000, perChild: true }
        ]
      },
      {
        name: "Corporate Income Tax",
        type: "corporate",
        enabled: true,
        flatRate: 21,
        exemptions: [
          { category: "small_business", threshold: 1000000 },
          { category: "startup", years: 3 }
        ]
      },
      {
        name: "Value Added Tax",
        type: "sales",
        enabled: true,
        standardRate: 20,
        reducedRates: [
          { category: "food", rate: 5 },
          { category: "books", rate: 0 }
        ]
      }
    ],
    fiscalYear: "calendar",
    currencyCode: "IND"
  }
});
```

**Response (Success):**
```typescript
{
  success: true,
  taxSystem: {
    id: "tax_sys_abc123",
    countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
    categories: [
      {
        id: "cat_income_001",
        name: "Personal Income Tax",
        type: "income",
        enabled: true,
        brackets: [ /* ... */ ],
        projectedRevenue: 45000000000,
        effectiveness: 88
      },
      {
        id: "cat_corp_001",
        name: "Corporate Income Tax",
        type: "corporate",
        enabled: true,
        flatRate: 21,
        projectedRevenue: 28000000000,
        effectiveness: 85
      },
      {
        id: "cat_vat_001",
        name: "Value Added Tax",
        type: "sales",
        enabled: true,
        standardRate: 20,
        projectedRevenue: 35000000000,
        effectiveness: 90
      }
    ],
    updatedAt: "2025-10-22T19:00:00.000Z"
  },

  analytics: {
    totalProjectedRevenue: 108000000000,
    revenueByCategory: {
      income: 45000000000,
      corporate: 28000000000,
      sales: 35000000000
    },
    effectivenessScore: 87.7,
    complianceRate: 92,
    administrativeCost: 2500000000,
    netRevenue: 105500000000
  },

  recommendations: [
    {
      type: "optimization",
      message: "Consider reducing VAT on essential goods to improve equity",
      impact: "medium"
    },
    {
      type: "warning",
      message: "Top income tax bracket is slightly above regional average",
      impact: "low"
    }
  ]
}
```

---

## National Identity

### 15. nationalIdentity.update
Update national identity information.

**Endpoint:** `nationalIdentity.update`
**Type:** Mutation
**Authentication:** Required (Country owner)
**Rate Limit:** 30 requests/minute

**Request:**
```typescript
const updateIdentity = api.nationalIdentity.update.useMutation({
  onSuccess: () => {
    toast.success("National identity updated");
  }
});

updateIdentity.mutate({
  countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
  identity: {
    motto: "Innovation for All, Progress for Everyone",
    anthem: "Song of the Future",
    nationalDay: "1990-01-01",

    officialLanguages: ["English", "Spanish", "Mandarin"],

    ethnicGroups: {
      "Innovators": 60,
      "Traditionalists": 25,
      "Internationalists": 10,
      "Others": 5
    },

    majorReligions: {
      "Secular/Non-religious": 45,
      "Christian": 30,
      "Buddhist": 15,
      "Other": 10
    },

    nationalColors: ["#0066CC", "#FFFFFF", "#FFD700"],

    nationalSymbols: {
      animal: "Phoenix",
      flower: "Lotus",
      tree: "Sequoia",
      bird: "Eagle",
      gemstone: "Sapphire"
    },

    culturalHeritage: {
      unesco_sites: 8,
      traditional_festivals: [
        "Innovation Day",
        "Unity Festival",
        "Harvest Celebration"
      ],
      national_sports: ["Football", "Basketball", "E-Sports"]
    },

    demographicData: {
      medianAge: 34,
      lifeExpectancy: 81,
      literacyRate: 99,
      urbanizationRate: 78
    }
  }
});
```

**Response (Success):**
```typescript
{
  success: true,
  identity: {
    id: "identity_abc123",
    countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
    motto: "Innovation for All, Progress for Everyone",
    anthem: "Song of the Future",
    nationalDay: "1990-01-01",
    officialLanguages: ["English", "Spanish", "Mandarin"],
    // ... full identity data
    updatedAt: "2025-10-22T19:15:00.000Z"
  },

  culturalMetrics: {
    diversityIndex: 72,
    culturalRichness: 85,
    heritageScore: 78
  }
}
```

---

## User Management

### 16. users.getProfile
Get the current user's profile and country information.

**Endpoint:** `users.getProfile`
**Type:** Query
**Authentication:** Optional (returns null if not authenticated)
**Rate Limit:** 100 requests/minute

**Request:**
```typescript
const { data: profile } = api.users.getProfile.useQuery();
```

**Response (Success - Authenticated User):**
```typescript
{
  userId: "user_2xyz789abc123",
  clerkUserId: "user_2xyz789abc123",
  countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
  hasCompletedSetup: true,

  country: {
    id: "clx8a1b2c3d4e5f6g7h8i9j0",
    countryName: "United Republic of Innovation",
    slug: "united-republic-of-innovation",
    capitalCity: "New Techville",
    population: 26500000,
    currentTotalGdp: 530000000000,
    economicTier: "EMERGING",
    flagUrl: "https://ixwiki.com/images/flags/uri.png",
    createdAt: "2025-10-22T15:30:00.000Z"
  },

  role: {
    id: "role_admin",
    name: "ADMIN",
    permissions: [
      "manage_countries",
      "manage_users",
      "view_admin_panel",
      "manage_system_settings"
    ]
  },

  preferences: {
    theme: "dark",
    language: "en",
    notifications: {
      email: true,
      push: false,
      diplomaticEvents: true,
      economicAlerts: true
    }
  }
}
```

**Response (Success - Unauthenticated):**
```typescript
{
  userId: null,
  countryId: null,
  country: null,
  hasCompletedSetup: false
}
```

---

### 17. users.updatePreferences
Update user preferences.

**Endpoint:** `users.updatePreferences`
**Type:** Mutation
**Authentication:** Required
**Rate Limit:** 60 requests/minute

**Request:**
```typescript
const updatePreferences = api.users.updatePreferences.useMutation({
  onSuccess: () => {
    toast.success("Preferences updated");
  }
});

updatePreferences.mutate({
  preferences: {
    theme: "dark",
    language: "en",
    notifications: {
      email: true,
      push: true,
      diplomaticEvents: true,
      economicAlerts: true,
      achievementUnlocks: true,
      weeklyDigest: true
    },
    displaySettings: {
      compactMode: false,
      showFlags: true,
      currencyDisplay: "symbol",
      dateFormat: "MM/DD/YYYY"
    }
  }
});
```

**Response (Success):**
```typescript
{
  success: true,
  preferences: {
    theme: "dark",
    language: "en",
    notifications: { /* ... */ },
    displaySettings: { /* ... */ },
    updatedAt: "2025-10-22T19:30:00.000Z"
  }
}
```

---

## Additional Common Endpoints

### 18. achievements.getByCountry
Get achievements for a specific country.

**Endpoint:** `achievements.getByCountry`
**Type:** Query
**Authentication:** Public
**Rate Limit:** 100 requests/minute

**Request:**
```typescript
const { data: achievements } = api.achievements.getByCountry.useQuery({
  countryId: "clx8a1b2c3d4e5f6g7h8i9j0",
  includeProgress: true
});
```

**Response (Success):**
```typescript
{
  unlocked: [
    {
      id: "achievement_gdp_500b",
      name: "Economic Powerhouse",
      description: "Reach $500 billion GDP",
      category: "economic",
      rarity: "rare",
      points: 100,
      unlockedAt: "2025-10-21T14:30:00.000Z",
      icon: "💰"
    },
    {
      id: "achievement_10_embassies",
      name: "Diplomatic Network",
      description: "Establish 10 embassies",
      category: "diplomatic",
      rarity: "uncommon",
      points: 50,
      unlockedAt: "2025-10-18T09:15:00.000Z",
      icon: "🏛️"
    }
  ],

  inProgress: [
    {
      id: "achievement_gdp_1t",
      name: "Trillion Dollar Club",
      description: "Reach $1 trillion GDP",
      category: "economic",
      rarity: "epic",
      points: 250,
      progress: {
        current: 530000000000,
        target: 1000000000000,
        percentage: 53
      },
      icon: "💎"
    }
  ],

  locked: [
    {
      id: "achievement_global_influence",
      name: "Global Influence",
      description: "Maintain 50+ diplomatic relationships",
      category: "diplomatic",
      rarity: "legendary",
      points: 500,
      requirements: "Unlock after establishing 50 diplomatic relationships",
      icon: "🌍"
    }
  ],

  statistics: {
    totalUnlocked: 12,
    totalPoints: 750,
    rank: 8,
    percentileRank: 82
  }
}
```

---

### 19. notifications.getRecent
Get recent notifications for the current user.

**Endpoint:** `notifications.getRecent`
**Type:** Query
**Authentication:** Required
**Rate Limit:** 100 requests/minute

**Request:**
```typescript
const { data: notifications } = api.notifications.getRecent.useQuery({
  limit: 20,
  includeRead: false
});
```

**Response (Success):**
```typescript
{
  notifications: [
    {
      id: "notif_abc123",
      type: "achievement_unlocked",
      priority: "medium",
      title: "Achievement Unlocked!",
      message: "You've unlocked 'Economic Powerhouse' - Your GDP reached $500 billion!",
      timestamp: "2025-10-21T14:30:00.000Z",
      read: false,
      actionUrl: "/mycountry/achievements",
      data: {
        achievementId: "achievement_gdp_500b",
        achievementName: "Economic Powerhouse",
        points: 100
      }
    },
    {
      id: "notif_def456",
      type: "diplomatic_event",
      priority: "high",
      title: "New Embassy Proposal",
      message: "Republic of Trade has proposed establishing an embassy",
      timestamp: "2025-10-22T10:00:00.000Z",
      read: false,
      actionUrl: "/diplomatic/proposals",
      data: {
        proposingCountryId: "clx9b2c3d4e5f6g7h8i9j0k1",
        proposingCountryName: "Republic of Trade",
        proposalId: "proposal_xyz789"
      }
    },
    {
      id: "notif_ghi789",
      type: "economic_alert",
      priority: "low",
      title: "Quarterly Economic Report",
      message: "Q3 economic data is now available for review",
      timestamp: "2025-10-22T08:00:00.000Z",
      read: true,
      actionUrl: "/mycountry/economy",
      data: {
        quarter: "Q3",
        year: 2025
      }
    }
  ],

  unreadCount: 7,
  total: 45,
  hasMore: true
}
```

---

### 20. wikiCache.searchCountries
Search for countries in the IxWiki cache.

**Endpoint:** `wikiCache.searchCountries`
**Type:** Query
**Authentication:** Public
**Rate Limit:** 100 requests/minute

**Request:**
```typescript
const { data: searchResults } = api.wikiCache.searchCountries.useQuery({
  query: "innovation",
  limit: 10
});
```

**Response (Success):**
```typescript
{
  results: [
    {
      wikiTitle: "United Republic of Innovation",
      wikiSlug: "United_Republic_of_Innovation",
      matchedCountryId: "clx8a1b2c3d4e5f6g7h8i9j0",
      matched: true,

      wikiData: {
        population: 26500000,
        capital: "New Techville",
        area: 250000,
        gdp: 530000000000,
        governmentType: "Federal Republic",
        officialLanguages: ["English", "Spanish"],
        currency: "Innovation Dollar (I$)",

        infobox: {
          flag: "https://ixwiki.com/images/flags/uri.png",
          coat_of_arms: "https://ixwiki.com/images/coa/uri.png",
          motto: "Innovation for All",
          anthem: "Song of the Future"
        }
      },

      lastCached: "2025-10-22T12:00:00.000Z",
      cacheStatus: "fresh"
    },
    {
      wikiTitle: "Innovation City-State",
      wikiSlug: "Innovation_City-State",
      matched: false,
      matchedCountryId: null,

      wikiData: {
        population: 5000000,
        capital: "Innovation City",
        area: 500,
        // ... wiki data only
      },

      lastCached: "2025-10-20T08:00:00.000Z",
      cacheStatus: "stale"
    }
  ],

  total: 2,
  searchTime: 45 // milliseconds
}
```

---

## Error Handling

### Common Error Codes

All tRPC errors follow this structure:

```typescript
{
  error: {
    code: string,        // Error code (see below)
    message: string,     // Human-readable error message
    details?: any        // Optional additional error details
  }
}
```

### Error Code Reference

| Code | HTTP Status | Description | Common Causes |
|------|-------------|-------------|---------------|
| `BAD_REQUEST` | 400 | Invalid input data | Missing required fields, invalid format, constraint violations |
| `UNAUTHORIZED` | 401 | Not authenticated | Missing or invalid Clerk session token |
| `FORBIDDEN` | 403 | Authenticated but not authorized | Trying to access another user's country, admin-only endpoint |
| `NOT_FOUND` | 404 | Resource not found | Invalid ID, deleted resource |
| `CONFLICT` | 409 | Resource conflict | Duplicate country name, existing embassy |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded | Exceeded endpoint rate limit |
| `INTERNAL_SERVER_ERROR` | 500 | Server error | Database connection issue, unexpected error |

### Error Handling Pattern

```typescript
const mutation = api.countries.createCountry.useMutation({
  onSuccess: (data) => {
    toast.success("Country created successfully");
    router.push(`/countries/${data.country.slug}`);
  },

  onError: (error) => {
    // Handle specific error codes
    switch (error.data?.code) {
      case "BAD_REQUEST":
        if (error.message.includes("already exists")) {
          toast.error("A country with this name already exists. Please choose a different name.");
        } else {
          toast.error("Invalid input. Please check your data and try again.");
        }
        break;

      case "UNAUTHORIZED":
        toast.error("Please sign in to create a country.");
        router.push("/sign-in");
        break;

      case "FORBIDDEN":
        toast.error("You don't have permission to perform this action.");
        break;

      case "TOO_MANY_REQUESTS":
        toast.error("You're making requests too quickly. Please wait a moment and try again.");
        break;

      case "INTERNAL_SERVER_ERROR":
        toast.error("An unexpected error occurred. Please try again later.");
        console.error("Server error:", error);
        break;

      default:
        toast.error(error.message || "An error occurred");
    }
  }
});
```

### Validation Errors

Input validation errors provide detailed field-level feedback:

```typescript
{
  error: {
    code: "BAD_REQUEST",
    message: "Validation error",
    details: [
      {
        field: "population",
        message: "Expected number, received string"
      },
      {
        field: "currencyCode",
        message: "String must contain at most 3 character(s)"
      }
    ]
  }
}
```

---

## Best Practices

### 1. Query Invalidation
After mutations, invalidate related queries to refresh data:

```typescript
const utils = api.useUtils();

const updateCountry = api.countries.updateCountry.useMutation({
  onSuccess: (data) => {
    // Invalidate specific query
    utils.countries.getById.invalidate({ id: data.country.id });

    // Invalidate all countries queries
    utils.countries.invalidate();

    // Invalidate dashboard data
    utils.mycountry.getDashboardData.invalidate();
  }
});
```

### 2. Optimistic Updates
For better UX, update UI optimistically before server response:

```typescript
const updateCountry = api.countries.updateCountry.useMutation({
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await utils.countries.getById.cancel({ id: newData.id });

    // Get current data
    const previousData = utils.countries.getById.getData({ id: newData.id });

    // Optimistically update
    utils.countries.getById.setData({ id: newData.id }, (old) => ({
      ...old,
      ...newData
    }));

    // Return rollback function
    return { previousData };
  },

  onError: (err, newData, context) => {
    // Rollback on error
    utils.countries.getById.setData({ id: newData.id }, context.previousData);
  },

  onSettled: (data, error, variables) => {
    // Refetch to ensure sync with server
    utils.countries.getById.invalidate({ id: variables.id });
  }
});
```

### 3. Pagination
Use offset-based pagination for large datasets:

```typescript
const [page, setPage] = useState(0);
const limit = 20;

const { data, isLoading } = api.countries.getAll.useQuery({
  limit,
  offset: page * limit
});

// Next page
const nextPage = () => {
  if (data?.hasMore) {
    setPage(page + 1);
  }
};

// Previous page
const prevPage = () => {
  if (page > 0) {
    setPage(page - 1);
  }
};
```

### 4. Loading States
Always handle loading, error, and success states:

```typescript
function CountryList() {
  const { data, isLoading, error } = api.countries.getAll.useQuery({ limit: 20 });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage error={error} />;
  }

  if (!data || data.countries.length === 0) {
    return <EmptyState message="No countries found" />;
  }

  return (
    <div>
      {data.countries.map(country => (
        <CountryCard key={country.id} country={country} />
      ))}
    </div>
  );
}
```

### 5. Type Safety
Use TypeScript inference for type-safe API calls:

```typescript
import { type RouterInputs, type RouterOutputs } from "~/lib/trpc";

// Input types
type CreateCountryInput = RouterInputs["countries"]["createCountry"];
type UpdateCountryInput = RouterInputs["countries"]["updateCountry"];

// Output types
type Country = RouterOutputs["countries"]["getById"];
type CountryList = RouterOutputs["countries"]["getAll"];

// Use in components
function CountryEditor({ initialData }: { initialData: Country }) {
  const [formData, setFormData] = useState<UpdateCountryInput>({
    id: initialData.id,
    countryName: initialData.countryName,
    // ... TypeScript will enforce correct fields
  });
}
```

---

## Rate Limiting

All endpoints are protected by rate limiting. Default limits:

- **Public endpoints**: 100 requests/minute
- **Protected endpoints**: 60 requests/minute
- **Mutations**: 30 requests/minute
- **Admin endpoints**: 30 requests/minute

When rate limited, wait for the `Retry-After` header value (in seconds) before retrying.

Rate limit headers included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698067200
```

---

## Additional Resources

- **Full API Reference**: [/docs/reference/api.md](/docs/reference/api.md)
- **Database Schema**: [/docs/reference/database.md](/docs/reference/database.md)
- **Troubleshooting**: [/docs/TROUBLESHOOTING.md](/docs/TROUBLESHOOTING.md)
- **Environment Setup**: [/docs/operations/environments.md](/docs/operations/environments.md)

---

**Last Updated:** October 22, 2025
**Version:** v1.2
**Maintainer:** IxStats Development Team
