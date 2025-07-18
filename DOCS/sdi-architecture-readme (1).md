# 🌐 SDI (Sovereign Digital Interface) Architecture & Development Guide

> **Apple Fitness-Inspired Economic Intelligence Platform for IxStats**

## 📋 Overview

The Sovereign Digital Interface (SDI) is IxStats' premier dashboard system, featuring Apple Fitness-inspired design language, real-time economic intelligence, and modular crisis management. Built with Next.js 14, TypeScript, and a comprehensive glassmorphism component system.

## 🎯 Quick Start for Cursor Users

### Essential Cursor Commands

```bash
# 1. Development environment setup
npm install && npm run dev

# 2. Key directories for SDI development:
src/app/sdi/                    # 🎯 Main SDI modules
src/components/ui/              # 🎨 Base UI components  
src/components/sdi/             # 🌐 SDI-specific components
src/styles/globals.css          # 🎨 Apple-style design system
src/types/ixstats.ts           # 📊 Core TypeScript interfaces

# 3. Create new SDI module:
mkdir src/app/sdi/your-module
touch src/app/sdi/your-module/page.tsx

# 4. Apple-style component template:
# Use GlassCard, health rings, metric cards, achievement systems
```

### Apple Design System Integration

```tsx
// Essential imports for SDI development
import { GlassCard } from "~/components/ui/enhanced-card";
import { type CountryStats, type EconomicTier } from "~/types/ixstats";
import { TrendingUp, Activity, Heart } from 'lucide-react';

// Apple Fitness-style metrics card
const MetricCard = ({ icon: Icon, title, value, change, trend, color }) => (
  <GlassCard className="hover:scale-105 transition-all duration-300">
    <div className={`p-3 rounded-2xl bg-gradient-to-r ${color} shadow-lg`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <h3 className="text-white/70 text-sm font-medium">{title}</h3>
    <p className="text-white text-2xl font-bold">{value}</p>
    <div className={`text-sm ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
      {change}
    </div>
  </GlassCard>
);
```

## 🏗️ Complete Module Architecture

### 📱 SDI Module Structure

```
IxStats/
├── src/app/sdi/
│   ├── page.tsx                        # ✅ Global Overview (Apple Health Rings)
│   ├── intelligence/
│   │   └── page.tsx                    # ✅ Intelligence Feed (Real-time alerts)
│   ├── diplomacy/
│   │   └── page.tsx                    # ✅ Diplomatic Matrix (Relationship monitoring)
│   ├── crisis/
│   │   └── page.tsx                    # ✅ Crisis Management (Emergency response)
│   ├── economic/
│   │   └── page.tsx                    # 🚧 Economic Intelligence (Market analysis)
│   ├── military/
│   │   └── page.tsx                    # 📋 Military Intelligence (Defense monitoring)
│   └── social/
│       └── page.tsx                    # 📋 Social Dynamics (Population trends)
```

## 🎨 Apple Fitness Design Language

### Core Design Principles

#### **1. Health Rings System**
```tsx
// Apple Activity Ring Component
const HealthRing = ({ metric, size = 120, strokeWidth = 8 }) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (metric.current / 100) * circumference;
  
  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" className="stroke-green-400" strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{metric.current}</span>
        <span className="text-xs text-white/60">of {metric.target}</span>
      </div>
    </div>
  );
};

// Usage in modules:
<HealthRing metric={{ current: 78, target: 100 }} />
```

#### **2. Metric Cards (Apple Fitness Style)**
```tsx
// Daily stats card with gradient backgrounds
const StatCard = ({ stat }) => (
  <GlassCard className="hover:scale-105 transition-all duration-300">
    <div className={`p-3 rounded-2xl bg-gradient-to-r ${stat.color} shadow-lg`}>
      <stat.icon className="w-6 h-6 text-white" />
    </div>
    <h3 className="text-white/70 text-sm font-medium">{stat.label}</h3>
    <p className="text-white text-2xl font-bold">{stat.value}</p>
    <div className={`text-sm ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
      {stat.change}
    </div>
  </GlassCard>
);
```

#### **3. Achievement System**
```tsx
// Apple-style achievement badges
const Achievement = ({ title, description, badge, time }) => (
  <div className="flex items-start space-x-3 p-3 rounded-xl bg-white/5 hover:bg-white/10">
    <span className="text-2xl">{badge}</span>
    <div className="flex-1">
      <h4 className="text-white font-medium text-sm">{title}</h4>
      <p className="text-white/70 text-xs mt-1">{description}</p>
      <span className="text-white/50 text-xs">{time}</span>
    </div>
  </div>
);
```

### **4. Crisis Alert Cards**
```tsx
// Crisis management alert system
const CrisisCard = ({ crisis }) => (
  <GlassCard gradient={crisis.color} className="cursor-pointer hover:scale-[1.02]">
    <div className="flex items-start justify-between">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-xl bg-white/20">
          <crisis.icon className="w-5 h-5 text-white" />
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          crisis.severity === 'high' ? 'bg-red-500/20 text-red-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          {crisis.severity.toUpperCase()}
        </span>
      </div>
      <div className="text-right">
        <div className="text-xs text-white/60">Confidence</div>
        <div className="text-sm font-bold text-white">{crisis.confidence}%</div>
      </div>
    </div>
    <h3 className="text-white font-bold text-lg mt-4">{crisis.title}</h3>
    <p className="text-white/80 text-sm">{crisis.description}</p>
  </GlassCard>
);
```

## 📊 Data Architecture & TypeScript

### Core Interfaces (Already Implemented)

```typescript
// src/types/ixstats.ts - Core data structures
export enum EconomicTier {
  IMPOVERISHED = "Impoverished",    // $0-$9,999
  DEVELOPING = "Developing",        // $10,000-$24,999
  DEVELOPED = "Developed",          // $25,000-$34,999
  HEALTHY = "Healthy",              // $35,000-$44,999
  STRONG = "Strong",                // $45,000-$54,999
  VERY_STRONG = "Very Strong",      // $55,000-$64,999
  EXTRAVAGANT = "Extravagant"       // $65,000+
}

export interface CountryStats {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: EconomicTier;
  populationTier: PopulationTier;
  // ... extensive interface
}
```

### SDI-Specific Types

```typescript
// src/types/sdi.ts - SDI module types
export interface HealthMetric {
  current: number;
  target: number;
  trend: string;
  category: 'economic' | 'political' | 'social';
}

export interface CrisisEvent {
  id: string;
  title: string;
  type: 'economic' | 'political' | 'logistical' | 'environmental';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'monitoring' | 'resolving' | 'resolved';
  affected: string[];
  impact: {
    economic: number;
    political: number;
    social: number;
  };
  confidence: number;
}

export interface IntelligenceAlert {
  id: string;
  priority: 'low' | 'medium' | 'high';
  type: 'economic' | 'political' | 'social' | 'technological';
  title: string;
  description: string;
  countries: string[];
  confidence: number;
  timestamp: string;
}
```

## 🧩 Module Development Patterns

### 1. Intelligence Feed Module ✅

**Key Features:**
- Real-time alert system with confidence scoring
- Filterable intelligence by type and priority
- Expandable cards with detailed impact analysis
- Network status monitoring sidebar
- Trending topics with sentiment analysis

**Development Pattern:**
```tsx
// src/app/sdi/intelligence/page.tsx
const IntelligenceFeed = () => {
  const [filter, setFilter] = useState('all');
  const [selectedIntel, setSelectedIntel] = useState(null);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3">
        {/* Main intelligence feed */}
      </div>
      <div className="space-y-6">
        {/* Network status, trending topics, quick actions */}
      </div>
    </div>
  );
};
```

### 2. Diplomatic Matrix Module ✅

**Key Features:**
- Relationship scoring with visual progress bars
- Country-to-country relationship cards
- Diplomatic event timeline
- Relationship health overview
- Quick mediation and summit tools

**Development Pattern:**
```tsx
// src/app/sdi/diplomacy/page.tsx
const DiplomaticMatrix = () => {
  const [selectedRelationship, setSelectedRelationship] = useState(null);
  
  const RelationshipCard = ({ relationship }) => (
    <GlassCard onClick={() => setSelectedRelationship(relationship)}>
      {/* Flag displays, relationship score, trade volume */}
    </GlassCard>
  );
};
```

### 3. Crisis Management Module ✅

**Key Features:**
- Real-time crisis monitoring with severity levels
- Impact assessment (economic, political, social)
- Response protocol readiness tracking
- Emergency action buttons
- Risk factor monitoring

**Development Pattern:**
```tsx
// src/app/sdi/crisis/page.tsx
const CrisisManagement = () => {
  const [alertLevel, setAlertLevel] = useState('normal');
  const [simulationMode, setSimulationMode] = useState(false);
  
  const CrisisCard = ({ crisis }) => (
    <GlassCard gradient={crisis.color}>
      {/* Crisis details, impact metrics, response actions */}
    </GlassCard>
  );
};
```

## 🎯 Advanced Development Patterns

### 1. Real-time Data Integration

```tsx
// Real-time data hooks for SDI modules
const useRealTimeData = (endpoint: string, interval = 5000) => {
  const [data, setData] = useState(null);
  const { data: apiData } = api[endpoint].useQuery(
    undefined,
    { refetchInterval: interval }
  );
  
  useEffect(() => {
    if (apiData) setData(apiData);
  }, [apiData]);
  
  return data;
};

// Usage in modules:
const crisisData = useRealTimeData('crisis.getActive', 3000);
```

### 2. State Management Patterns

```tsx
// Module-level state management
const [selectedItem, setSelectedItem] = useState(null);
const [filterState, setFilterState] = useState({ type: 'all', priority: 'all' });
const [viewMode, setViewMode] = useState('grid'); // or 'list', 'chart'

// Persistent preferences
const [preferences, setPreferences] = useLocalStorage('sdi-preferences', {
  theme: 'auto',
  notifications: true,
  refreshInterval: 5000
});
```

### 3. Animation & Interaction Patterns

```tsx
// Smooth expansions and transitions
<div className={`overflow-hidden transition-all duration-500 ease-in-out ${
  isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
}`}>
  {/* Expandable content */}
</div>

// Interactive hover states
<GlassCard className="hover:scale-[1.02] hover:shadow-3xl transition-all duration-300">
  {/* Interactive content */}
</GlassCard>

// Loading states with Apple-style skeletons
const LoadingSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-4 bg-white/10 rounded-xl w-3/4"></div>
    <div className="h-4 bg-white/10 rounded-xl w-1/2"></div>
  </div>
);
```

## 🛠️ Development Workflow

### Essential Commands

```bash
# Development
npm run dev                 # Start development server
npm run type-check         # TypeScript validation
npm run lint               # Code quality check

# SDI-specific development
npm run build              # Production build test
npm run db:migrate         # Database updates
npm run test:sdi           # SDI module testing
```

### Module Creation Checklist

1. **📁 Create module directory**: `src/app/sdi/your-module/`
2. **📄 Add page.tsx**: Follow Apple design patterns
3. **🎨 Use GlassCard system**: Import from `ui/enhanced-card`
4. **📊 Define TypeScript interfaces**: Add to `types/sdi.ts`
5. **🔄 Implement real-time data**: Use tRPC with intervals
6. **📱 Test responsive design**: Mobile-first approach
7. **🎯 Add to navigation**: Update sidebar navigation

### Component Library Usage

```tsx
// Essential SDI imports
import { GlassCard } from "~/components/ui/enhanced-card";
import { Activity, TrendingUp, AlertTriangle } from 'lucide-react';

// Apple-style typography classes
<h1 className="diplomatic-header">Module Title</h1>
<div className="diplomatic-value">89.2%</div>
<p className="diplomatic-label">Health Score</p>
```

## 🚀 Future Module Roadmap

### 📋 Next Development Priorities

#### **1. Economic Intelligence Module** 🚧
```tsx
// Market analysis, trade flow monitoring, economic forecasting
// Features: Sector analysis, market volatility, trade relationships
// Apple Design: Market health rings, sector performance cards
```

#### **2. Military Intelligence Module** 📋
```tsx
// Defense capabilities, conflict monitoring, security assessment
// Features: Military readiness, threat analysis, alliance tracking
// Apple Design: Defense strength rings, threat level indicators
```

#### **3. Social Dynamics Module** 📋
```tsx
// Population trends, social stability, cultural indicators
// Features: Demographic shifts, happiness index, cultural events
// Apple Design: Social health metrics, trend visualization
```

### 🔮 Advanced Features

1. **AI-Powered Insights**: Claude integration for predictive analysis
2. **3D Visualizations**: Three.js integration for geographic displays
3. **Collaborative Features**: Multi-user real-time editing
4. **Mobile App**: React Native companion app
5. **Voice Commands**: Speech integration for hands-free operation

## 📚 Quick Reference

### **Essential Files**
- **Main Dashboard**: `src/app/sdi/page.tsx`
- **Component Library**: `src/components/ui/enhanced-card.tsx`
- **Type Definitions**: `src/types/ixstats.ts`, `src/types/sdi.ts`
- **Styling System**: `src/styles/globals.css`
- **Chart Components**: `src/app/countries/_components/charts/`

### **CSS Variables (Apple Design System)**
```css
/* Health Ring Colors */
--health-economic: rgb(34, 197, 94);      /* Green */
--health-political: rgb(59, 130, 246);    /* Blue */
--health-social: rgb(139, 92, 246);       /* Purple */

/* Glass Effects */
--glass-diplomatic: rgba(16, 24, 40, 0.1);
--blur-prominent: 16px;
--shadow-glass-lg: 0 12px 48px rgba(99,102,241,0.18);
```

### **Icon System (Lucide React)**
```tsx
// Core SDI icons
import { 
  Activity, TrendingUp, AlertTriangle, Heart, Shield, 
  Globe, Users, DollarSign, Zap, Eye, Target 
} from 'lucide-react';
```

---

## 🎯 Success Metrics

**Development Speed**: Cursor users can create new SDI modules in <30 minutes  
**Design Consistency**: Apple Fitness aesthetic maintained across all modules  
**Type Safety**: 100% TypeScript coverage for all SDI components  
**Performance**: <2s load times, 60fps animations  
**User Experience**: Intuitive, engaging economic intelligence platform

---

**🌟 The SDI represents the future of economic intelligence platforms - combining Apple's intuitive design language with powerful real-time data analysis for world-builders and game masters.**