# Integrated Country Profile Design
*Unifying Traditional Data with Intelligence Framework & Wiki Integration*

**Design Date**: January 2025  
**Focus**: Enhance Intelligence Section with traditional country data and wiki integration  
**Goal**: Build towards comprehensive social/country profile system

---

## 🎯 **Design Philosophy**

**Core Principle**: Transform the Intelligence tab into a comprehensive country profile that maintains its sophisticated intelligence authority while incorporating all traditional country data and rich wiki content.

**User Experience Flow**:
1. **Intelligence Briefing** (enhanced) - Core country data + intelligence summary
2. **Country Overview** (new) - Traditional metrics with intelligence styling  
3. **Wiki Integration** (new) - Native infobox display and content embedding
4. **Diplomatic Intelligence** - Existing advanced features
5. **Social Features** - Building towards social/country profile refactor

---

## 📊 **Current State Analysis**

### **Traditional View Assets** ✅
- National Vitality rings (Economic Health, Population Growth, Development Index)
- Key Metrics display (Population, GDP, Growth Rate, Density, Land Area)
- Country Information (Location, Government, Leader, Religion)
- CountryAtGlance component with comprehensive overview
- Flag-based color theming system

### **Intelligence View Assets** ✅  
- Professional intelligence authority design
- Glass physics framework with classification levels
- 11 specialized intelligence sections
- Advanced diplomatic components
- Achievement constellation system
- Real-time features (WebSocket infrastructure)

### **Wiki Integration Assets** ✅
- Sophisticated MediaWiki service (`mediawiki-service.ts`)
- Country infobox parsing with 100+ fields
- Page content fetching and template extraction
- File URL resolution and caching
- Comprehensive error handling and fallbacks

---

## 🏗️ **Integrated Design Architecture**

### **New Intelligence Section Structure**

#### **1. Enhanced Executive Briefing** (Primary Tab)
**Purpose**: Core country intelligence + traditional overview data  
**Content**:
- **Intelligence Summary**: Current briefing content (alerts, insights, trends)
- **National Vitality Dashboard**: Integrated vitality rings with intelligence styling
- **Key Performance Indicators**: Traditional metrics in intelligence card format
- **Strategic Assessment**: Economic tier, population tier, growth analysis
- **Risk & Opportunity Matrix**: Intelligence-style analysis of country status

#### **2. Country Intelligence Dossier** (New Tab)
**Purpose**: Comprehensive country data with intelligence authority  
**Content**:
- **Geographic Intelligence**: Location, area, borders, strategic position
- **Government Intelligence**: Leadership structure, political system, stability
- **Economic Intelligence**: Detailed financial metrics, trade analysis
- **Demographic Intelligence**: Population analysis, cultural composition
- **Historical Context**: Key events, establishment dates, development timeline

#### **3. Wiki Intelligence Integration** (New Tab)
**Purpose**: Native wiki content display with intelligence framework  
**Content**:
- **Country Infobox Display**: Parsed and styled country infobox
- **Strategic Documentation**: Relevant wiki articles and sections
- **Cultural Intelligence**: Cultural artifacts, traditions, national symbols
- **Economic Documentation**: Economic history, trade relationships
- **Political Intelligence**: Government structure, international relations

#### **4. Diplomatic Network** (Enhanced)
**Purpose**: Maintain existing diplomatic features + country context  
**Content**: Existing embassy network visualization + country-specific context

#### **5. Achievement & Social** (Enhanced)
**Purpose**: Gamification + social features building towards profile refactor  
**Content**: Existing achievement system + social activity feeds

---

## 🎨 **Visual Design Integration**

### **Intelligence Authority Styling**
**Apply glass physics framework to traditional data**:
- **Vitality Rings**: Maintain health ring visual but with intelligence card styling
- **Metrics Display**: Transform key metrics into intelligence "briefing cards"
- **Classification Levels**: Apply PUBLIC/RESTRICTED/CONFIDENTIAL to different data
- **Color Theming**: Maintain flag-based colors but with intelligence authority

### **Layout Hierarchy**
```
┌─ Intelligence Header (Country Name + Classification)
├─ Navigation Tabs (Enhanced Briefing, Dossier, Wiki, Diplomatic, etc.)
└─ Content Areas:
   ├─ Primary Content (Tab-specific intelligence displays)
   ├─ Sidebar (Context-aware intelligence metrics)
   └─ Footer (Quick actions, social features)
```

### **Responsive Considerations**
- **Mobile**: Stack vitality rings vertically, collapsible sections
- **Tablet**: Two-column layout with primary/secondary content
- **Desktop**: Full intelligence dashboard with sidebar metrics

---

## 🔗 **Wiki Integration Architecture**

### **Enhanced MediaWiki Service** (Building on existing)

#### **New Functions Needed**:
```typescript
// Country overview content
getCountryOverview(countryName: string): Promise<CountryOverview>

// Relevant sections for country
getRelevantSections(countryName: string): Promise<WikiSection[]>

// Cultural and historical content
getCulturalContent(countryName: string): Promise<CulturalData>

// Economic and political articles
getEconomicIntelligence(countryName: string): Promise<EconomicWikiData>
```

#### **Enhanced Infobox Integration**:
- **Visual Display**: Style wiki infobox with intelligence framework
- **Data Validation**: Cross-reference wiki data with IxStats data
- **Conflict Resolution**: Handle discrepancies between wiki and database
- **Real-time Updates**: Cache management with intelligent refresh

#### **Content Embedding**:
- **Section Extraction**: Pull relevant wiki sections (History, Economy, Politics)
- **Image Integration**: Display wiki images with proper attribution
- **Link Management**: Convert wiki links to internal navigation where possible
- **Content Filtering**: Show country-relevant content with intelligence context

### **Wiki Content Types**

#### **Country Infobox** (Enhanced Display)
- **Government Structure**: Leader hierarchy, political system
- **Geographic Data**: Area, borders, strategic location
- **Cultural Information**: Languages, religions, demographics
- **Economic Overview**: Currency, major industries, trade
- **Historical Timeline**: Key establishment dates and events

#### **Strategic Documentation**
- **Economic Articles**: Trade relationships, economic history
- **Political Articles**: Government structure, international relations
- **Cultural Articles**: National traditions, cultural heritage
- **Geographic Articles**: Strategic location, natural resources
- **Historical Articles**: Formation, key events, development

#### **Visual Assets**
- **Country Maps**: Geographic and political maps
- **Cultural Images**: National symbols, architecture, landscapes
- **Historical Images**: Key events, historical figures
- **Economic Diagrams**: Trade flows, economic indicators

---

## 📱 **Implementation Strategy**

### **Phase 1: Enhanced Briefing Integration** (2-3 weeks)
**Goal**: Integrate traditional data into existing Intelligence Briefing

**Tasks**:
1. **Create Intelligence-styled Vitality Component**
   - Wrap existing health rings in intelligence card framework
   - Add classification levels and intelligence glyph system
   - Maintain existing vitality calculations but with authority styling

2. **Transform Key Metrics Display**
   - Convert traditional metrics into "intelligence briefing cards"
   - Add trend indicators and risk assessment styling
   - Integrate with existing intelligence alert system

3. **Enhance Country Information Section**
   - Style country info with intelligence authority
   - Add strategic context to basic information
   - Integrate government intelligence and risk assessment

4. **Update Executive Briefing Tab**
   - Add vitality dashboard to existing briefing content
   - Integrate traditional metrics with intelligence insights
   - Maintain existing functionality while adding country overview

### **Phase 2: Wiki Integration Foundation** (3-4 weeks)
**Goal**: Native wiki content display within intelligence framework

**Tasks**:
1. **Enhanced Wiki Service Functions**
   - Implement country overview and section extraction
   - Add cultural and economic content fetching
   - Create intelligent caching for wiki content

2. **Wiki Intelligence Tab**
   - Create new tab for wiki content display
   - Design infobox display with intelligence styling
   - Implement section-based content organization

3. **Content Integration System**
   - Cross-reference wiki data with IxStats database
   - Handle data conflicts and validation
   - Create unified country data model

4. **Visual Integration**
   - Style wiki content with glass physics framework
   - Implement responsive design for content display
   - Add classification levels to different content types

### **Phase 3: Country Intelligence Dossier** (2-3 weeks)
**Goal**: Comprehensive country data with intelligence authority

**Tasks**:
1. **Dossier Tab Implementation**
   - Create comprehensive country intelligence display
   - Organize data by intelligence categories
   - Add strategic analysis and context

2. **Advanced Data Integration**
   - Combine IxStats data, wiki content, and intelligence insights
   - Create predictive analysis based on historical data
   - Add comparative intelligence with other countries

3. **Interactive Features**
   - Timeline visualization for historical events
   - Interactive maps for geographic intelligence
   - Relationship mapping for diplomatic intelligence

### **Phase 4: Social Profile Foundation** (4-5 weeks)
**Goal**: Build towards comprehensive social/country profile system

**Tasks**:
1. **Enhanced Social Features**
   - Integrate existing achievement and social systems
   - Add country-specific social context
   - Create social intelligence feeds

2. **Profile Refactor Preparation**
   - Design unified country profile architecture
   - Create component system for easy refactoring
   - Implement social gaming elements

3. **Advanced Integration**
   - Real-time updates for all data sources
   - Cross-platform synchronization
   - Advanced search and discovery features

---

## 🔧 **Technical Implementation Details**

### **Component Architecture**

#### **Enhanced Intelligence Briefing**
```typescript
// New integrated briefing component
interface EnhancedIntelligenceBriefingProps {
  country: CountryData;
  intelligenceData: IntelligenceData;
  vitalityData: VitalityData;
  wikiData?: WikiCountryData;
  viewerClearanceLevel: ClearanceLevel;
}

// Combines existing briefing with traditional data
const EnhancedIntelligenceBriefing: React.FC<EnhancedIntelligenceBriefingProps>
```

#### **Wiki Intelligence Tab**
```typescript
// New wiki integration component
interface WikiIntelligenceTabProps {
  countryName: string;
  infoboxData: CountryInfobox;
  relevantSections: WikiSection[];
  viewerClearanceLevel: ClearanceLevel;
}

// Displays wiki content with intelligence styling
const WikiIntelligenceTab: React.FC<WikiIntelligenceTabProps>
```

#### **Intelligence-Styled Vitality**
```typescript
// Enhanced vitality display with intelligence authority
interface IntelligenceVitalityDashboardProps {
  vitalityData: VitalityMetrics[];
  classification: ClassificationLevel;
  showTrends: boolean;
  includeRiskAssessment: boolean;
}

const IntelligenceVitalityDashboard: React.FC<IntelligenceVitalityDashboardProps>
```

### **Data Flow Architecture**

#### **Unified Country Data Model**
```typescript
interface UnifiedCountryProfile {
  // Core IxStats data
  ixStatsData: CountryData;
  
  // Wiki integration
  wikiData: {
    infobox: CountryInfobox;
    relevantSections: WikiSection[];
    culturalContent: CulturalData;
    economicIntelligence: EconomicWikiData;
  };
  
  // Intelligence analysis
  intelligence: {
    briefings: IntelligenceBriefing[];
    assessments: StrategicAssessment[];
    alerts: IntelligenceAlert[];
    trends: TrendAnalysis[];
  };
  
  // Social and diplomatic
  social: {
    achievements: Achievement[];
    diplomaticRelations: DiplomaticRelation[];
    socialMetrics: SocialMetrics;
  };
}
```

#### **Wiki Service Enhancement**
```typescript
// Enhanced MediaWiki service with country-focused methods
class EnhancedIxnayWikiService extends IxnayWikiService {
  async getCountryProfile(countryName: string): Promise<WikiCountryProfile>;
  async getRelevantContent(countryName: string, categories: string[]): Promise<WikiContent[]>;
  async getCulturalIntelligence(countryName: string): Promise<CulturalIntelligence>;
  async getEconomicDocumentation(countryName: string): Promise<EconomicDocs>;
  async getHistoricalContext(countryName: string): Promise<HistoricalData>;
}
```

### **Caching & Performance**

#### **Multi-Layer Caching**
- **Level 1**: Component-level caching for UI state
- **Level 2**: Service-level caching for API responses
- **Level 3**: Browser caching for static wiki content
- **Level 4**: CDN caching for images and media

#### **Intelligent Refresh**
- **IxStats Data**: Real-time updates via existing tRPC
- **Wiki Content**: Smart refresh based on content age and edit history
- **Intelligence Analysis**: Periodic recalculation with new data
- **Social Features**: Real-time updates via WebSocket

---

## 🎯 **Success Metrics**

### **User Experience Goals**
- **Unified Experience**: Traditional data accessible within intelligence framework
- **Rich Context**: Wiki content enhances country understanding
- **Professional Authority**: Maintains sophisticated intelligence styling
- **Performance**: <2s load times for all content

### **Technical Goals**
- **Integration Completeness**: 100% traditional data incorporated
- **Wiki Coverage**: Infobox + 5 relevant sections per country
- **Mobile Responsiveness**: Full functionality on all devices
- **Cache Efficiency**: >95% cache hit rate for repeated visits

### **Strategic Goals**
- **Foundation for Refactor**: Clear pathway to social/country profile system
- **Competitive Advantage**: Unique combination of intelligence + wiki integration
- **User Engagement**: Increased time on country pages
- **Social Gaming Preparation**: Enhanced achievement and social systems

---

## 🚀 **Next Steps**

### **Immediate Actions** (Next 1-2 weeks)
1. **Create Enhanced Briefing Component**: Integrate vitality rings and metrics
2. **Enhance Wiki Service**: Add country-focused content methods
3. **Design Wiki Intelligence Tab**: Create comprehensive wiki content display
4. **Update Navigation**: Add new tabs to intelligence section

### **Development Priorities**
1. **Phase 1 Implementation**: Enhanced briefing with traditional data
2. **Wiki Integration Testing**: Verify content quality and performance
3. **Mobile Optimization**: Ensure responsive design across all features
4. **Performance Optimization**: Caching and loading optimization

### **Future Considerations**
- **Social Profile Refactor**: Use integrated system as foundation
- **Advanced Features**: Real-time collaboration, advanced analytics
- **Cross-Platform Integration**: Enhanced Discord/MediaWiki sync
- **Internationalization**: Multi-language wiki content support

---

**Design Status**: Ready for Implementation  
**Next Phase**: Enhanced Intelligence Briefing Component Development  
**Timeline**: 8-12 weeks for complete integration

This design maintains the sophisticated intelligence authority while providing users with comprehensive country information and rich wiki content integration, creating a pathway to the advanced social/country profile system.