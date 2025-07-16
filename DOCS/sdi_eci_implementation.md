# SDI & ECI Implementation Guide
*Integrating with Your Existing IxStats Codebase*

## 🏗️ File Structure Integration

### New Directory Structure
```
src/
├── app/
│   ├── sdi/                      # Sovereign Digital Interface
│   │   ├── page.tsx              # Main SDI landing
│   │   ├── intelligence/         # Intelligence modules
│   │   ├── communications/       # Secure comms
│   │   ├── analytics/           # Global analytics
│   │   └── regional/            # Regional command centers
│   ├── eci/                     # Executive Command Interface  
│   │   ├── page.tsx             # Main ECI dashboard
│   │   ├── focus/               # Focus area modules
│   │   │   ├── economic/
│   │   │   ├── government/
│   │   │   ├── diplomatic/
│   │   │   └── demographics/
│   │   ├── mycountry/           # MyCountry® suite
│   │   └── communications/      # Executive comms
│   ├── dashboard/               # Keep existing (redirect logic)
│   └── countries/               # Keep existing (enhanced)
├── components/
│   ├── sdi/                     # SDI-specific components
│   │   ├── GlobalStats.tsx
│   │   ├── IntelligenceFeed.tsx
│   │   ├── SecureComms.tsx
│   │   └── RegionalCommand.tsx
│   ├── eci/                     # ECI-specific components
│   │   ├── ExecutiveDashboard.tsx
│   │   ├── FocusCards.tsx
│   │   ├── MyCountryPremium.tsx
│   │   └── PersonalComms.tsx
│   ├── shared/                  # Cross-interface components
│   │   ├── InterfaceSwitcher.tsx
│   │   ├── SecureChannel.tsx
│   │   └── UnifiedSearch.tsx
│   └── ui/                      # Enhanced shadcn components
│       ├── aurora.tsx           # New Aceternity components
│       ├── bento-grid.tsx
│       ├── card-spotlight.tsx
│       ├── number-ticker.tsx
│       └── enhanced-card.tsx    # Extended Card component
└── lib/
    ├── interface-routing.ts     # SDI/ECI routing logic
    ├── user-permissions.ts      # Interface access control
    └── cross-interface.ts       # Shared functionality
```

---

## 🎯 Implementation Steps

### Step 1: Install Aceternity UI Components

```bash
# Install required dependencies
npm install framer-motion react-intersection-observer
npm install @radix-ui/react-scroll-area
```

### Step 2: Create Core Aceternity Components

```tsx
// components/ui/aurora.tsx
"use client";
import { cn } from "@/lib/utils";

interface AuroraProps {
  className?: string;
  children: React.ReactNode;
}

export function Aurora({ className, children }: AuroraProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="aurora-bg absolute inset-0" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// components/ui/bento-grid.tsx
import { cn } from "@/lib/utils";

interface BentoGridProps {
  className?: string;
  children: React.ReactNode;
}

export function BentoGrid({ className, children }: BentoGridProps) {
  return (
    <div className={cn(
      "grid auto-rows-[200px] grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto",
      className
    )}>
      {children}
    </div>
  );
}

// components/ui/card-spotlight.tsx
"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CardSpotlightProps {
  className?: string;
  children: React.ReactNode;
  focused?: boolean;
}

export function CardSpotlight({ className, children, focused = false }: CardSpotlightProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={cn("relative group", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn(
        "absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-0 transition-opacity duration-300 blur-xl",
        (isHovered || focused) && "opacity-100"
      )} />
      <div className={cn(
        "relative bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-6 transition-colors",
        (isHovered || focused) && "border-white/20",
        focused && "border-blue-500/50"
      )}>
        {children}
      </div>
    </div>
  );
}

// components/ui/number-ticker.tsx
"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface NumberTickerProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  duration?: number;
}

export function NumberTicker({ 
  value, 
  className, 
  prefix = '', 
  suffix = '', 
  decimalPlaces = 0,
  duration = 1000 
}: NumberTickerProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    const startValue = displayValue;
    const difference = value - startValue;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setDisplayValue(startValue + (difference * easeOut));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration, displayValue]);

  return (
    <span className={cn("font-variant-numeric tabular-nums", className)}>
      {prefix}{displayValue.toFixed(decimalPlaces)}{suffix}
    </span>
  );
}
```

### Step 3: Create Interface Routing Logic

```tsx
// lib/interface-routing.ts
import { UserProfile } from "@/types/user";

export type InterfaceType = 'sdi' | 'eci' | 'redirect';

export function determineUserInterface(user: UserProfile): InterfaceType {
  // Admin users get access to both (default to SDI)
  if (user.role === 'admin' || user.role === 'dm') {
    return 'sdi';
  }
  
  // Users with linked countries get ECI
  if (user.countryId) {
    return 'eci';
  }
  
  // Observers and global users get SDI
  if (user.role === 'observer' || user.preferences?.globalView) {
    return 'sdi';
  }
  
  // Default to setup/redirect
  return 'redirect';
}

export function getUserInterfacePreferences(user: UserProfile) {
  return {
    canAccessSDI: user.role === 'admin' || user.role === 'dm' || user.role === 'observer',
    canAccessECI: !!user.countryId,
    defaultInterface: determineUserInterface(user),
    hasSecureComms: user.role === 'admin' || user.role === 'dm' || !!user.countryId
  };
}

// components/shared/InterfaceSwitcher.tsx
"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { api } from "@/trpc/react";
import { getUserInterfacePreferences } from "@/lib/interface-routing";

export function InterfaceSwitcher({ currentInterface }: { currentInterface: 'sdi' | 'eci' }) {
  const router = useRouter();
  const { user } = useUser();
  const { data: profile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  if (!profile) return null;

  const permissions = getUserInterfacePreferences(profile);
  
  const switchToSDI = () => router.push('/sdi');
  const switchToECI = () => router.push('/eci');

  return (
    <div className="flex gap-2">
      {currentInterface === 'eci' && permissions.canAccessSDI && (
        <Button 
          onClick={switchToSDI}
          className="bg-blue-600/20 text-blue-300 border-blue-500/30 hover:bg-blue-600/30"
        >
          🌐 Global Overview
        </Button>
      )}
      
      {currentInterface === 'sdi' && permissions.canAccessECI && (
        <Button 
          onClick={switchToECI}
          className="bg-orange-600/20 text-orange-300 border-orange-500/30 hover:bg-orange-600/30"
        >
          🏛️ Executive Interface
        </Button>
      )}
    </div>
  );
}
```

### Step 4: Create Main Interface Pages

```tsx
// app/sdi/page.tsx
"use client";
import { Suspense } from "react";
import { Aurora } from "@/components/ui/aurora";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { NumberTicker } from "@/components/ui/number-ticker";
import { TypewriterEffect } from "@/components/ui/typewriter-effect";
import { InterfaceSwitcher } from "@/components/shared/InterfaceSwitcher";
import { GlobalStats } from "@/components/sdi/GlobalStats";
import { IntelligenceFeed } from "@/components/sdi/IntelligenceFeed";
import { SecureComms } from "@/components/sdi/SecureComms";
import { api } from "@/trpc/react";

export default function SovereignDigitalInterface() {
  const { data: globalStats } = api.system.getGlobalStats.useQuery();
  const { data: intelligenceFeed } = api.intelligence.getFeed.useQuery();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Aurora className="min-h-screen">
        <div className="relative z-10 container mx-auto px-4 py-8">
          
          {/* SDI Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-6 mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-3xl medallion-glow">
                🌐
              </div>
              <div className="text-left">
                <TypewriterEffect
                  words={[
                    { text: "Sovereign" },
                    { text: "Digital" },
                    { text: "Interface" }
                  ]}
                  className="text-5xl font-bold text-white"
                />
                <p className="text-xl text-gray-300 mt-2">
                  Global Intelligence • Strategic Oversight • International Monitoring
                </p>
              </div>
            </div>
            
            <div className="flex justify-center gap-4 flex-wrap">
              <InterfaceSwitcher currentInterface="sdi" />
            </div>
          </div>

          {/* Global Stats Overview */}
          <Suspense fallback={<div>Loading global statistics...</div>}>
            <GlobalStats data={globalStats} />
          </Suspense>

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            
            {/* Intelligence Feed */}
            <CardSpotlight className="lg:col-span-2">
              <Suspense fallback={<div>Loading intelligence feed...</div>}>
                <IntelligenceFeed data={intelligenceFeed} />
              </Suspense>
            </CardSpotlight>

            {/* Secure Communications */}
            <CardSpotlight>
              <Suspense fallback={<div>Loading secure communications...</div>}>
                <SecureComms />
              </Suspense>
            </CardSpotlight>
          </div>
        </div>
      </Aurora>
    </div>
  );
}

// app/eci/page.tsx  
"use client";
import { useState, Suspense } from "react";
import { BentoGrid } from "@/components/ui/bento-grid";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { InterfaceSwitcher } from "@/components/shared/InterfaceSwitcher";
import { ExecutiveDashboard } from "@/components/eci/ExecutiveDashboard";
import { FocusCards } from "@/components/eci/FocusCards";
import { MyCountryPremium } from "@/components/eci/MyCountryPremium";
import { api } from "@/trpc/react";
import { useUser } from "@clerk/nextjs";

export default function ExecutiveCommandInterface() {
  const { user } = useUser();
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null);
  
  const { data: profile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );
  
  const { data: countryData } = api.countries.getById.useQuery(
    { id: profile?.countryId || '' },
    { enabled: !!profile?.countryId }
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        
        {/* ECI Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-2xl medallion-glow">
                ⭐
              </div>
              <div>
                <h1 className="text-4xl font-bold">Executive Command Interface</h1>
                <p className="text-gray-400">
                  Personal Command Center • {countryData?.name || 'Loading...'}
                </p>
              </div>
            </div>
            <InterfaceSwitcher currentInterface="eci" />
          </div>
        </div>

        {/* Executive Dashboard */}
        <BentoGrid className="mb-8">
          <Suspense fallback={<div>Loading executive dashboard...</div>}>
            <ExecutiveDashboard countryData={countryData} />
          </Suspense>
          
          <Suspense fallback={<div>Loading MyCountry® suite...</div>}>
            <MyCountryPremium profile={profile} />
          </Suspense>
        </BentoGrid>

        {/* Focus Cards System */}
        <Suspense fallback={<div>Loading focus areas...</div>}>
          <FocusCards
            countryData={countryData}
            selectedFocus={selectedFocus}
            setSelectedFocus={setSelectedFocus}
          />
        </Suspense>
      </div>
    </div>
  );
}
```

### Step 5: Update tRPC Routes

```tsx
// server/api/routers/system.ts (enhance existing)
export const systemRouter = createTRPCRouter({
  // Existing routes...
  
  getGlobalStats: publicProcedure.query(async ({ ctx }) => {
    const totalNations = await ctx.db.country.count();
    const totalGDP = await ctx.db.country.aggregate({
      _sum: { currentTotalGdp: true }
    });
    
    return {
      totalNations,
      globalGDP: totalGDP._sum.currentTotalGdp || 0,
      activeDiplomats: await getActiveDiplomats(ctx.db),
      onlineUsers: await getOnlineUsers(ctx.db),
      tradeVolume: await getGlobalTradeVolume(ctx.db),
      activeConflicts: await getActiveConflicts(ctx.db)
    };
  }),
});

// server/api/routers/intelligence.ts (new)
export const intelligenceRouter = createTRPCRouter({
  getFeed: publicProcedure.query(async ({ ctx }) => {
    // Mock for now - implement real intelligence feed
    return [
      {
        id: 1,
        title: "Major Trade Agreement Signed",
        type: "Economic",
        region: "Latium",
        priority: "High",
        timestamp: new Date(),
        source: "Economic Intelligence Division"
      },
      // ... more intelligence items
    ];
  }),

  getSecureMessages: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Real implementation with user-specific secure messages
      return await ctx.db.secureMessage.findMany({
        where: { recipientId: input.userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
    }),
});

// server/api/root.ts (update)
export const appRouter = createTRPCRouter({
  // Existing routers...
  intelligence: intelligenceRouter,
});
```

### Step 6: Enhanced CSS Styles

```css
/* src/styles/globals.css - Add to existing styles */

/* === SDI & ECI SPECIFIC STYLES === */

/* Aurora Effect for SDI */
.aurora-bg {
  background: linear-gradient(
    45deg,
    rgba(59, 130, 246, 0.1) 0%,
    rgba(139, 92, 246, 0.1) 25%,
    rgba(16, 185, 129, 0.1) 50%,
    rgba(245, 158, 11, 0.1) 75%,
    rgba(59, 130, 246, 0.1) 100%
  );
  background-size: 400% 400%;
  animation: aurora-flow 20s ease infinite;
}

@keyframes aurora-flow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* Enhanced Medallion Glow */
.medallion-glow {
  filter: drop-shadow(0 0 12px rgba(99, 102, 241, 0.4));
  transition: filter var(--transition-standard);
}

.medallion-glow:hover {
  filter: drop-shadow(0 0 20px rgba(99, 102, 241, 0.6));
}

/* SDI Specific Styling */
.sdi-interface {
  background: radial-gradient(ellipse at top, rgba(59, 130, 246, 0.1) 0%, transparent 50%);
}

/* ECI Specific Styling */
.eci-interface {
  background: radial-gradient(ellipse at top, rgba(245, 158, 11, 0.1) 0%, transparent 50%);
}

/* Focus Card Animations */
.focus-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.focus-card:hover {
  transform: translateY(-4px);
}

.focus-card.selected {
  transform: scale(1.02);
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);
}

/* Interface Transition */
.interface-transition {
  transition: all 0.5s ease-in-out;
}

/* Number Ticker Enhancement */
.number-ticker {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}
```

### Step 7: User Flow Integration

```tsx
// app/page.tsx (Update main landing)
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { api } from "@/trpc/react";
import { determineUserInterface } from "@/lib/interface-routing";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  
  const { data: profile, isLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  useEffect(() => {
    if (isLoaded && user && profile) {
      const targetInterface = determineUserInterface(profile);
      
      switch (targetInterface) {
        case 'sdi':
          router.push('/sdi');
          break;
        case 'eci':
          router.push('/eci');
          break;
        case 'redirect':
          router.push('/setup');
          break;
      }
    }
  }, [isLoaded, user, profile, router]);

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="w-16 h-16 rounded-full mx-auto" />
          <Skeleton className="w-48 h-6" />
          <p className="text-gray-400">Initializing interface...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400">Redirecting to your interface...</p>
      </div>
    </div>
  );
}
```

---

## 🚀 Deployment Strategy

### Phase 1: Foundation (Week 1)
1. Install Aceternity components
2. Create basic SDI/ECI routing
3. Implement interface switching

### Phase 2: SDI Implementation (Week 2)
1. Global statistics integration
2. Intelligence feed with real data
3. Secure communications system

### Phase 3: ECI Implementation (Week 3)
1. Executive dashboard with nation data
2. Focus cards system
3. MyCountry® premium features

### Phase 4: Integration & Polish (Week 4)
1. Cross-interface communication
2. Performance optimization
3. Mobile responsiveness
4. Security audit

This implementation maintains your existing codebase while adding the sophisticated SDI/ECI interface system on top of your current tRPC/Prisma/shadcn foundation.