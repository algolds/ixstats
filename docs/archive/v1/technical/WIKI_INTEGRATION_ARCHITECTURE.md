# Wiki Integration Architecture
*Comprehensive MediaWiki Integration for Country Intelligence*

**Architecture Date**: January 2025  
**Focus**: Enhanced wiki content integration within intelligence framework  
**Goal**: Native wiki content display with intelligence authority styling

---

## 🏗️ **Current Wiki Service Analysis**

### **Existing Capabilities** ✅
**File**: `/src/lib/mediawiki-service.ts`

**Core Functions**:
- `getCountryInfobox(countryName)` - Comprehensive infobox parsing (100+ fields)
- `getPageWikitext(pageName)` - Raw wikitext extraction
- `getFileUrl(fileName)` - Media file URL resolution
- `parseTemplate(templateContent)` - Template parameter extraction
- Sophisticated caching with LRU and TTL management
- Request deduplication and error handling

**Data Structures**:
- **CountryInfobox**: 100+ typed fields covering government, economy, culture, geography
- **Caching System**: Multi-layer with flag, infobox, template, and content caches
- **Error Handling**: Graceful degradation with fallback mechanisms

### **Enhancement Requirements**
**Missing Capabilities**:
- Section-specific content extraction
- Cultural and historical content aggregation
- Economic article parsing
- Image and media integration
- Cross-reference validation with IxStats data

---

## 🔧 **Enhanced Wiki Service Architecture**

### **New Service Functions**

#### **Country Profile Aggregation**
```typescript
// Comprehensive country data from multiple wiki sources
async getCountryProfile(countryName: string): Promise<WikiCountryProfile> {
  return {
    infobox: await this.getCountryInfobox(countryName),
    overview: await this.getCountryOverview(countryName),
    sections: await this.getRelevantSections(countryName),
    cultural: await this.getCulturalContent(countryName),
    economic: await this.getEconomicIntelligence(countryName),
    historical: await this.getHistoricalContext(countryName),
    media: await this.getCountryMedia(countryName)
  };
}
```

#### **Section-Specific Extraction**
```typescript
// Extract specific sections from country pages
async getRelevantSections(countryName: string): Promise<WikiSection[]> {
  const targetSections = [
    'History', 'Economy', 'Politics', 'Government', 
    'Geography', 'Demographics', 'Culture', 'International relations'
  ];
  
  return this.extractSections(countryName, targetSections);
}

// Individual section extraction with content parsing
async extractSections(pageName: string, sectionNames: string[]): Promise<WikiSection[]>
```

#### **Cultural Intelligence Gathering**
```typescript
// Cultural artifacts, traditions, and heritage
async getCulturalContent(countryName: string): Promise<CulturalIntelligence> {
  return {
    nationalSymbols: await this.getNationalSymbols(countryName),
    culturalHeritage: await this.getCulturalHeritage(countryName),
    traditions: await this.getTraditions(countryName),
    languages: await this.getLanguageInfo(countryName),
    religion: await this.getReligiousInfo(countryName),
    arts: await this.getArtsAndCulture(countryName)
  };
}
```

#### **Economic Documentation**
```typescript
// Economic articles and trade information
async getEconomicIntelligence(countryName: string): Promise<EconomicWikiData> {
  return {
    economyOverview: await this.getEconomySection(countryName),
    tradeRelations: await this.getTradeRelations(countryName),
    industries: await this.getMajorIndustries(countryName),
    currency: await this.getCurrencyInfo(countryName),
    economicHistory: await this.getEconomicHistory(countryName)
  };
}
```

#### **Historical Context Analysis**
```typescript
// Historical events and development timeline
async getHistoricalContext(countryName: string): Promise<HistoricalIntelligence> {
  return {
    formation: await this.getFormationHistory(countryName),
    keyEvents: await this.getKeyHistoricalEvents(countryName),
    politicalHistory: await this.getPoliticalHistory(countryName),
    wars: await this.getWarHistory(countryName),
    independence: await this.getIndependenceInfo(countryName),
    modernHistory: await this.getModernDevelopment(countryName)
  };
}
```

#### **Media Integration**
```typescript
// Images, maps, and multimedia content
async getCountryMedia(countryName: string): Promise<CountryMediaAssets> {
  return {
    maps: await this.getCountryMaps(countryName),
    landscapes: await this.getLandscapeImages(countryName),
    cultural: await this.getCulturalImages(countryName),
    historical: await this.getHistoricalImages(countryName),
    political: await this.getPoliticalImages(countryName),
    economic: await this.getEconomicDiagrams(countryName)
  };
}
```

### **Data Validation & Cross-Reference**

#### **IxStats Integration**
```typescript
// Cross-reference wiki data with IxStats database
class WikiDataValidator {
  async validateCountryData(
    wikiData: WikiCountryProfile, 
    ixStatsData: CountryData
  ): Promise<DataValidationResult> {
    return {
      conflicts: this.findDataConflicts(wikiData, ixStatsData),
      validations: this.validateConsistency(wikiData, ixStatsData),
      enrichments: this.suggestEnrichments(wikiData, ixStatsData),
      confidence: this.calculateConfidenceScore(wikiData, ixStatsData)
    };
  }
  
  private findDataConflicts(wiki: WikiCountryProfile, ixStats: CountryData): DataConflict[]
  private validateConsistency(wiki: WikiCountryProfile, ixStats: CountryData): ValidationResult[]
  private suggestEnrichments(wiki: WikiCountryProfile, ixStats: CountryData): EnrichmentSuggestion[]
  private calculateConfidenceScore(wiki: WikiCountryProfile, ixStats: CountryData): number
}
```

#### **Data Conflict Resolution**
```typescript
// Handle discrepancies between wiki and IxStats data
interface DataConflictResolution {
  field: string;
  wikiValue: any;
  ixStatsValue: any;
  resolution: 'prefer_ixstats' | 'prefer_wiki' | 'manual_review' | 'display_both';
  confidence: number;
  reasoning: string;
}

class ConflictResolver {
  resolveDataConflicts(conflicts: DataConflict[]): DataConflictResolution[]
  createUnifiedDataModel(wiki: WikiCountryProfile, ixStats: CountryData): UnifiedCountryData
}
```

---

## 💾 **Data Models & Types**

### **Enhanced Wiki Data Types**

#### **Wiki Country Profile**
```typescript
interface WikiCountryProfile {
  countryName: string;
  lastUpdated: number;
  confidence: number;
  
  // Core data
  infobox: CountryInfobox;
  overview: CountryOverview;
  
  // Structured content
  sections: {
    history: WikiSection;
    economy: WikiSection;
    politics: WikiSection;
    geography: WikiSection;
    demographics: WikiSection;
    culture: WikiSection;
    international: WikiSection;
  };
  
  // Specialized intelligence
  cultural: CulturalIntelligence;
  economic: EconomicWikiData;
  historical: HistoricalIntelligence;
  
  // Media assets
  media: CountryMediaAssets;
  
  // Metadata
  sources: WikiSource[];
  lastEdited: string;
  editHistory: WikiEdit[];
}
```

#### **Wiki Section Structure**
```typescript
interface WikiSection {
  title: string;
  content: string;
  subsections: WikiSubsection[];
  images: WikiImage[];
  references: WikiReference[];
  lastModified: string;
  wordCount: number;
  importance: 'high' | 'medium' | 'low';
}

interface WikiSubsection {
  title: string;
  content: string;
  level: number; // H2, H3, H4, etc.
  anchor: string;
}
```

#### **Cultural Intelligence**
```typescript
interface CulturalIntelligence {
  nationalSymbols: {
    flag: WikiImage;
    coat: WikiImage;
    anthem: AudioFile;
    motto: string;
    flower: string;
    bird: string;
    colors: string[];
  };
  
  heritage: {
    worldHeritageSites: WorldHeritageSite[];
    culturalLandmarks: CulturalLandmark[];
    traditions: Tradition[];
    festivals: Festival[];
  };
  
  languages: {
    official: Language[];
    regional: Language[];
    minority: Language[];
    extinct: Language[];
  };
  
  religion: {
    primary: Religion[];
    demographics: ReligiousDemographic[];
    freedom: ReligiousFreedomStatus;
  };
  
  arts: {
    literature: LiteraryWork[];
    music: MusicalTradition[];
    visual: VisualArt[];
    cinema: CinemaInfo[];
  };
}
```

#### **Economic Wiki Data**
```typescript
interface EconomicWikiData {
  overview: {
    economicSystem: string;
    majorSectors: EconomicSector[];
    gdpComposition: GdpComposition;
    laborForce: LaborForceData;
    unemployment: UnemploymentData;
  };
  
  trade: {
    exports: TradeData;
    imports: TradeData;
    majorPartners: TradingPartner[];
    tradeBalance: number;
    tradeAgreements: TradeAgreement[];
  };
  
  currency: {
    name: string;
    code: string;
    symbol: string;
    history: CurrencyHistory[];
    exchangeRate: ExchangeRateInfo;
  };
  
  industries: {
    manufacturing: Industry[];
    services: Industry[];
    agriculture: Industry[];
    mining: Industry[];
    technology: Industry[];
  };
}
```

#### **Historical Intelligence**
```typescript
interface HistoricalIntelligence {
  formation: {
    establishmentDate: string;
    foundingEvents: HistoricalEvent[];
    founders: HistoricalFigure[];
    originalTerritory: TerritorialInfo;
  };
  
  timeline: {
    ancientPeriod: HistoricalPeriod;
    medieval: HistoricalPeriod;
    early_modern: HistoricalPeriod;
    modern: HistoricalPeriod;
    contemporary: HistoricalPeriod;
  };
  
  conflicts: {
    wars: War[];
    civil_conflicts: CivilConflict[];
    international_disputes: Dispute[];
    resolutions: ConflictResolution[];
  };
  
  political: {
    governments: GovernmentPeriod[];
    constitutions: Constitution[];
    major_reforms: PoliticalReform[];
    leaders: PoliticalLeader[];
  };
}
```

### **Media Assets Structure**
```typescript
interface CountryMediaAssets {
  maps: {
    political: WikiImage[];
    physical: WikiImage[];
    economic: WikiImage[];
    historical: WikiImage[];
    administrative: WikiImage[];
  };
  
  photography: {
    landscapes: WikiImage[];
    cities: WikiImage[];
    landmarks: WikiImage[];
    people: WikiImage[];
    culture: WikiImage[];
  };
  
  diagrams: {
    economic: WikiImage[];
    political: WikiImage[];
    demographic: WikiImage[];
    infrastructure: WikiImage[];
  };
  
  multimedia: {
    videos: VideoFile[];
    audio: AudioFile[];
    interactive: InteractiveMedia[];
  };
}
```

---

## 📡 **Caching & Performance Strategy**

### **Multi-Tier Caching System**

#### **Level 1: Component Cache**
- **React Query**: Component-level caching for UI state
- **Memory Duration**: 5 minutes for active components
- **Invalidation**: Manual refresh or route change

#### **Level 2: Service Cache**
- **Enhanced LRU Cache**: Building on existing MediaWiki service cache
- **Content Duration**: 1 hour for sections, 6 hours for infobox
- **Size Limits**: 1000 entries per cache type
- **Smart Eviction**: Usage-based with timestamp consideration

#### **Level 3: Content Cache**
- **Parsed Content**: Pre-processed wiki content with intelligence styling
- **Duration**: 24 hours for stable content, 1 hour for frequently edited
- **Compression**: Gzip compression for large content blocks

#### **Level 4: Media Cache**
- **CDN Integration**: Wiki images and media through CDN
- **Local Fallback**: Backup local caching for critical media
- **Optimized Formats**: WebP conversion for better performance

### **Intelligent Refresh Strategy**

#### **Content Staleness Detection**
```typescript
class WikiContentManager {
  async checkContentFreshness(countryName: string): Promise<ContentFreshnessReport> {
    return {
      lastWikiEdit: await this.getLastEditTimestamp(countryName),
      lastCacheUpdate: this.getCacheTimestamp(countryName),
      staleness: this.calculateStaleness(),
      refreshNeeded: this.shouldRefreshContent(),
      priority: this.getRefreshPriority()
    };
  }
  
  async smartRefresh(countryName: string): Promise<RefreshResult> {
    const freshness = await this.checkContentFreshness(countryName);
    
    if (freshness.refreshNeeded) {
      return this.performIncrementalUpdate(countryName, freshness);
    }
    
    return { updated: false, reason: 'Content still fresh' };
  }
}
```

#### **Background Refresh**
- **Scheduled Updates**: Daily refresh for popular countries
- **Event-Driven**: Refresh on wiki edit notifications
- **User-Triggered**: Manual refresh with immediate update
- **Incremental**: Only update changed sections to minimize load

---

## 🔒 **Security & Validation**

### **Content Sanitization**

#### **Wiki Content Security**
```typescript
class WikiContentSanitizer {
  sanitizeContent(wikiContent: string): string {
    // Remove potentially malicious content
    return this.removeScripts()
      .sanitizeHtml()
      .validateLinks()
      .filterSensitiveInfo()
      .applyIntelligenceStyling();
  }
  
  validateMediaUrls(mediaUrls: string[]): ValidatedMedia[] {
    return mediaUrls.map(url => ({
      url,
      safe: this.isUrlSafe(url),
      type: this.detectMediaType(url),
      size: this.getMediaSize(url)
    }));
  }
}
```

#### **Data Validation Pipeline**
- **Input Validation**: Sanitize all wiki content before processing
- **Output Validation**: Verify processed content before display
- **Cross-Site Prevention**: Strict content security policy
- **Attribution Compliance**: Proper MediaWiki attribution and licensing

### **Error Handling & Fallbacks**

#### **Graceful Degradation**
```typescript
class WikiErrorHandler {
  handleWikiError(error: WikiError, countryName: string): FallbackStrategy {
    switch (error.type) {
      case 'content_not_found':
        return this.useAlternativeSource(countryName);
      case 'parse_error':
        return this.useBasicInfobox(countryName);
      case 'network_error':
        return this.useCachedContent(countryName);
      default:
        return this.useMinimalDisplay(countryName);
    }
  }
}
```

---

## 📊 **Performance Monitoring**

### **Metrics Tracking**

#### **Response Time Monitoring**
- **Wiki API Calls**: Track response times for different content types
- **Parsing Performance**: Monitor content parsing and transformation speed
- **Cache Hit Rates**: Measure cache effectiveness across all tiers
- **User Experience**: Track total page load times with wiki content

#### **Content Quality Metrics**
- **Coverage**: Percentage of countries with complete wiki profiles
- **Freshness**: Average age of cached content
- **Accuracy**: Validation success rates with IxStats data
- **User Engagement**: Time spent on wiki-enhanced country pages

### **Optimization Targets**

#### **Performance Goals**
- **Initial Load**: <2s for country page with basic wiki content
- **Full Profile**: <5s for complete wiki intelligence profile
- **Cache Hit Rate**: >95% for repeated visits
- **Content Coverage**: >90% of countries with quality wiki data

#### **Quality Goals**
- **Data Accuracy**: >98% validation success rate
- **Content Freshness**: <24h average staleness
- **Media Availability**: >95% image load success rate
- **Attribution Compliance**: 100% proper MediaWiki attribution

---

## 🚀 **Implementation Roadmap**

### **Phase 1: Enhanced Service Foundation** (1-2 weeks)
1. **Extend MediaWiki Service**: Add section extraction and content aggregation
2. **Data Models**: Implement new TypeScript interfaces
3. **Basic Validation**: Cross-reference validation with IxStats data
4. **Testing Framework**: Unit tests for all new service functions

### **Phase 2: Content Integration** (2-3 weeks)
1. **Wiki Intelligence Tab**: Create new tab in DiplomaticIntelligenceProfile
2. **Infobox Display**: Enhanced country infobox with intelligence styling
3. **Section Content**: Display relevant wiki sections with formatting
4. **Media Integration**: Images and media display with proper attribution

### **Phase 3: Advanced Features** (2-3 weeks)
1. **Cultural Intelligence**: Implement cultural content aggregation
2. **Economic Documentation**: Economic article parsing and display
3. **Historical Context**: Historical timeline and event integration
4. **Search Integration**: Wiki content searchability within intelligence framework

### **Phase 4: Optimization & Polish** (1-2 weeks)
1. **Performance Tuning**: Cache optimization and response time improvement
2. **Mobile Optimization**: Responsive wiki content display
3. **Error Handling**: Comprehensive fallback and error recovery
4. **User Testing**: Validation of wiki integration user experience

---

**Architecture Status**: Ready for Implementation  
**Next Phase**: Enhanced MediaWiki Service Development  
**Timeline**: 6-10 weeks for complete wiki integration

This architecture provides comprehensive wiki integration while maintaining the sophisticated intelligence framework, creating a rich and authoritative country profile experience.