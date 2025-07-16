# IxStats Design Architecture - Cursor Checklist

## 📐 Core Design System

### **Design Language Foundation**
- [ ] **Glassmorphism Core System**
  - [ ] Create `useGlassmorphism` hook with configurable opacity/blur levels
  - [ ] Base glassmorphism component with `backdrop-filter: blur()` and frosted glass effects
  - [ ] Multiple glass intensity levels: subtle, medium, strong for different UI hierarchy
  - [ ] CSS custom properties for glass effects: `--glass-opacity`, `--glass-blur`, `--glass-border`

### **Animated Gradient System (Based on Citizen CSS)**
- [ ] **Implement Citizen-style gradient system**
  ```css
  @property --gradient-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }
  ```
- [ ] **Diplomatic-themed gradient classes**
  - [ ] `.diplomatic-gradient-glow` - rotating gradient borders for important elements
  - [ ] `.embassy-gradient` - subtle background gradients for sections
  - [ ] `.nation-strength-gradient` - dynamic gradients based on economic tier
  - [ ] `.alliance-gradient` - relationship-based color transitions

### **CSS Custom Properties System**
- [ ] **Diplomatic Color Palette**
  ```css
  :root {
    --color-diplomatic-primary: #1a237e;
    --color-diplomatic-gold: #ffd700;
    --color-diplomatic-silver: #c0c0c0;
    --color-diplomatic-bronze: #cd7f32;
    --color-nation-strength-1: #ef4444; /* Impoverished */
    --color-nation-strength-7: #10b981; /* Extravagant */
    --color-alliance-friendly: #059669;
    --color-alliance-neutral: #6b7280;
    --color-alliance-hostile: #dc2626;
  }
  ```
- [ ] **Dynamic tier-based theming system**
- [ ] **Responsive spacing using existing system**: `--space-xs`, `--space-md`, etc.

### **Typography Hierarchy**
- [ ] **Diplomatic Typography Scale**
  - [ ] Government document inspired headers (serif for formal sections)
  - [ ] Modern sans-serif for data and metrics
  - [ ] Monospace for statistical displays
  - [ ] Letter-spacing for section headers: `letter-spacing: 0.05em`

### **Animation Standards**
- [ ] **Performance-optimized animations**
  - [ ] Standard transition timing: `250ms ease` (following Citizen pattern)
  - [ ] Hover state animations with `transform: translateY(-2px)`
  - [ ] Loading states with skeleton screens
  - [ ] Smooth section transitions with `scroll-behavior: smooth`

---

## 🎯 Component Architecture

### **Layout System**
- [ ] **Responsive Grid Framework**
  - [ ] 12-column CSS Grid system with diplomatic spacing
  - [ ] Breakpoint system: mobile-first approach
  - [ ] Container queries for component-level responsiveness

### **Card System (Glassmorphism + Gradients)**
- [ ] **Base Card Component**
  ```tsx
  interface DiplomaticCardProps {
    variant: 'glass' | 'solid' | 'gradient-glow';
    strength?: EconomicTier;
    elevation: 1 | 2 | 3;
    interactive?: boolean;
  }
  ```
- [ ] **Specialized Card Types**
  - [ ] `NationStatsCard` - key metrics with animated counters
  - [ ] `EconomicIndicatorCard` - charts with glassmorphism overlay
  - [ ] `DiplomaticRelationCard` - relationship status with gradient borders

### **Data Visualization Components**
- [ ] **Chart components with glassmorphism overlays**
  - [ ] GDP trend charts with frosted glass tooltips
  - [ ] Population demographic charts with diplomatic theming
  - [ ] Economic tier progress indicators with gradient fills

### **Navigation & Interaction**
- [ ] **Sticky Navigation System**
  - [ ] Glassmorphism navigation bar with backdrop-filter
  - [ ] Breadcrumb system with diplomatic hierarchy
  - [ ] Section anchor navigation with smooth scrolling

---

## 🔧 Technical Infrastructure

### **State Management**
- [ ] **Leverage existing tRPC infrastructure**
  - [ ] Extend `api.countries.getByIdWithEconomicData` for dashboard data
  - [ ] Create new endpoints for diplomatic relationships
  - [ ] Implement optimistic updates for DM editing capabilities

### **Performance Architecture**
- [ ] **Lazy Loading Strategy**
  - [ ] Intersection Observer for card animations
  - [ ] Dynamic imports for heavy visualization components
  - [ ] Image optimization for flags and maps

### **Accessibility Framework**
- [ ] **WCAG 2.1 AA Compliance**
  - [ ] High contrast mode support (extend existing Citizen system)
  - [ ] Screen reader optimization for data tables
  - [ ] Keyboard navigation patterns
  - [ ] Focus management for modal interactions

### **IxTime Integration**
- [ ] **Time-aware component system**
  - [ ] `useIxTime` hook for real-time calculations
  - [ ] Time-synchronized data refresh intervals
  - [ ] Historical data point calculations based on IxTime scale

---

## 📊 Data Architecture

### **Enhanced Type System**
```typescript
interface DiplomaticProfile extends CountryProfile {
  diplomaticRelations: Map<string, RelationshipStatus>;
  economicStrengthTier: EconomicTier;
  recentActivity: ActivityLog[];
  comparativeMetrics: ComparativeData;
}

interface DashboardMetrics {
  quickStats: QuickStatsData;
  trendIndicators: TrendData[];
  alertsNotifications: AlertData[];
  actionableInsights: InsightData[];
}
```

### **Real-time Data Flow**
- [ ] **WebSocket integration for live updates**
- [ ] **Optimistic UI updates for DM actions**
- [ ] **Data synchronization with existing calculation system**

---

## 🎨 Visual Design Standards

### **Glassmorphism Implementation**
- [ ] **Multi-layer glass effects**
  - [ ] Primary: `backdrop-filter: blur(12px)` with 20% opacity
  - [ ] Secondary: `backdrop-filter: blur(8px)` with 15% opacity
  - [ ] Subtle: `backdrop-filter: blur(4px)` with 10% opacity

### **Gradient Applications**
- [ ] **Strategic gradient usage**
  - [ ] Section dividers with subtle gradients
  - [ ] Call-to-action buttons with Citizen-style rotating gradients
  - [ ] Economic tier indicators with strength-based color progression
  - [ ] Relationship status with alliance-based gradient overlays

### **Micro-interactions**
- [ ] **Hover State System**
  - [ ] Cards: lift effect with increased shadow
  - [ ] Buttons: gradient rotation acceleration
  - [ ] Data points: tooltip with glassmorphism backdrop
  - [ ] Navigation: smooth underline animations

---

## 🌐 Integration Points

### **Existing System Compatibility**
- [ ] **Builder Tool Separation** (maintain existing architecture)
  - [ ] No imports from `src/app/builder/`
  - [ ] Independent utility functions for display-only operations
  - [ ] DM editing capabilities separate from country creation

### **Economy Component Integration**
- [ ] **Extend existing economy components**
  - [ ] Add glassmorphism variants to `EconomicDataDisplay`
  - [ ] Enhance `ComparativeAnalysis` with diplomatic theming
  - [ ] Upgrade `HistoricalEconomicTracker` with gradient visualization

### **Corporate System Hooks**
- [ ] **Future-proof for corporate integration**
  - [ ] Component interfaces ready for corporate diplomatic relationships
  - [ ] Economic impact visualization framework
  - [ ] Contract and trade relationship display system

---

## 📱 Responsive Strategy

### **Mobile-First Approach**
- [ ] **Touch-optimized interactions**
  - [ ] Swipe gestures for card navigation
  - [ ] Touch-friendly action buttons (44px minimum)
  - [ ] Collapsible sections for information density

### **Cross-Device Consistency**
- [ ] **Adaptive layouts**
  - [ ] Tablet: 2-column card grid with expanded details
  - [ ] Desktop: 3-4 column grid with hover interactions
  - [ ] Mobile: Single column with priority-based ordering

---

## ⚡ Performance Targets

### **Loading Performance**
- [ ] **Under 2s initial load** for Presidential Dashboard
- [ ] **Under 1s navigation** between dashboard and profile
- [ ] **60fps animations** for all gradient and glassmorphism effects

### **Memory Management**
- [ ] **Efficient component unmounting**
- [ ] **Chart data virtualization** for large datasets
- [ ] **Image lazy loading** with intersection observer

---

## 🔒 Security & Privacy

### **Data Protection**
- [ ] **Sensitive data handling** for DM-only information
- [ ] **Role-based component rendering**
- [ ] **Audit logging** for administrative actions

### **Performance Monitoring**
- [ ] **Core Web Vitals tracking**
- [ ] **Animation performance monitoring**
- [ ] **Error boundary implementation** with graceful fallbacks