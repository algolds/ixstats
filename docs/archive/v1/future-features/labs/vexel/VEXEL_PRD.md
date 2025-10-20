# Vexel: Heraldic Design System PRD
## Product Requirements Document for IxStats Integration

### Executive Summary

**Vexel** is a sophisticated heraldic coat of arms creation tool, serving as a TypeScript/React port of the open-source Heraldicon project. Integrated natively into IxStats as a Labs feature, Vexel enables users to create, customize, and share heraldic designs while maintaining the precision and rule-based approach of traditional heraldry.

**Key Value Propositions:**
- **Native Integration**: Seamlessly embedded within IxStats ecosystem
- **Community Sharing**: Users can share coat of arms with IxStats community
- **MediaSearchModal Integration**: Direct usage in image repository system
- **IxStats Design Language**: Consistent glass physics UI framework
- **Programmatic Generation**: Rule-based heraldic creation with TypeScript type safety

---

## 1. Product Goals & Objectives

### Primary Goals
1. **Heraldic Precision**: Maintain canonical accuracy of heraldic rules and traditions
2. **User Accessibility**: Make heraldry creation approachable for non-experts
3. **Community Integration**: Enable sharing and collaboration within IxStats
4. **Technical Excellence**: Leverage modern TypeScript/React architecture

### Success Metrics
- User engagement: >70% completion rate for coat of arms creation
- Community adoption: >50% of created designs shared publicly
- MediaSearchModal integration: >30% usage rate in image selection workflows
- Performance: <2s initial load time, <500ms for design updates

---

## 2. Target Audience

### Primary Users
- **IxStats Members**: Creating national/personal coat of arms for their countries
- **Heraldry Enthusiasts**: Users interested in traditional heraldic design
- **Content Creators**: Generating heraldic elements for world-building projects

### Secondary Users
- **Game Masters**: Creating heraldic elements for tabletop/digital games
- **Educators**: Teaching heraldic principles and history
- **Designers**: Leveraging heraldic elements in broader design projects

---

## 3. Core Features & Functionality

### 3.1 Heraldic Creation Engine
- **Blazonry Parser**: Convert textual heraldic descriptions to visual designs
- **Visual Builder**: Drag-and-drop interface for intuitive coat of arms creation
- **Rule Validation**: Real-time validation against heraldic principles
- **Element Library**: Comprehensive collection of charges, ordinaries, and patterns

### 3.2 Design Customization
- **Escutcheon Shapes**: Multiple shield shapes (traditional, modern, regional variants)
- **Color Themes**: Historical and modern tincture palettes
- **Style Variations**: Different artistic interpretations (medieval, modern, minimalist)
- **Cultural Variants**: Region-specific heraldic traditions

### 3.3 Community Features
- **Public Gallery**: Browse and discover community-created designs
- **Sharing System**: One-click sharing of coat of arms designs
- **Collaborative Creation**: Fork and modify existing designs (with attribution)
- **Rating & Feedback**: Community voting and constructive feedback system

### 3.4 Export & Integration
- **Multiple Formats**: SVG, PNG, PDF export options
- **MediaSearchModal Integration**: Direct embedding in IxStats image workflows
- **National Symbols**: Integration with MyCountry® features for official heraldry
- **Embedding**: Generate embed codes for external usage

---

## 4. Technical Architecture

### 4.1 Core Technology Stack
```typescript
// Primary Technologies
- Framework: Next.js 15 with App Router
- Language: TypeScript with strict type checking
- UI Library: React 18 with React.memo optimization
- Styling: Tailwind CSS v4 with IxStats glass physics framework
- Database: Prisma ORM with SQLite/PostgreSQL
- API: tRPC for type-safe API integration
```

### 4.2 Heraldic Data Model
```typescript
interface CoatOfArms {
  id: string;
  userId: string;
  name: string;
  blazonry: string;           // Textual heraldic description
  design: HeraldricDesign;    // Structured design data
  metadata: DesignMetadata;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  tags: string[];
}

interface HeraldricDesign {
  escutcheon: EscutcheonType;
  field: FieldDefinition;
  charges: ChargeElement[];
  ordinaries: OrdinaryElement[];
  style: RenderingStyle;
}
```

### 4.3 Component Architecture
```
/labs/vexel/
├── components/
│   ├── creation/
│   │   ├── VexelBuilder.tsx       # Main creation interface
│   │   ├── BlazonyParser.tsx      # Text-to-design converter
│   │   ├── ElementLibrary.tsx     # Heraldic elements palette
│   │   └── DesignCanvas.tsx       # Interactive design surface
│   ├── gallery/
│   │   ├── PublicGallery.tsx      # Community designs browser
│   │   ├── DesignCard.tsx         # Individual design preview
│   │   └── FilterSidebar.tsx      # Search and filtering
│   ├── renderer/
│   │   ├── SVGRenderer.tsx        # Primary heraldic renderer
│   │   ├── HeraldricElements.tsx  # Reusable heraldic components
│   │   └── StyleSystem.tsx        # Theming and customization
│   └── integration/
│       ├── MediaModalBridge.tsx   # MediaSearchModal integration
│       └── ShareDialog.tsx        # Community sharing interface
```

### 4.4 Performance Optimizations
- **Lazy Loading**: Dynamic imports for heavy heraldic libraries
- **Canvas Virtualization**: Efficient rendering for complex designs
- **Memoization**: React.memo for expensive heraldic calculations
- **Asset Optimization**: SVG sprite sheets for common heraldic elements

---

## 5. User Experience Design

### 5.1 Design Principles
- **Glass Physics Integration**: Consistent with IxStats visual framework
- **Progressive Disclosure**: Advanced features revealed as needed
- **Contextual Help**: Inline heraldic education and guidance
- **Responsive Design**: Mobile-first approach with desktop enhancements

### 5.2 Key User Flows

#### Creation Flow
1. **Entry Point**: Labs → Vexel from navigation dropdown
2. **Creation Mode**: Choose between Builder or Blazonry Parser
3. **Design Process**: Interactive element placement and customization
4. **Validation**: Real-time heraldic rule checking
5. **Export/Share**: Save, export, or share with community

#### Discovery Flow
1. **Gallery Access**: Browse public community designs
2. **Filtering**: Search by tags, creator, or heraldic elements
3. **Inspiration**: Fork existing designs for customization
4. **Integration**: Select designs for MediaSearchModal usage

### 5.3 Accessibility Features
- **Keyboard Navigation**: Full keyboard accessibility for all creation tools
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Color Contrast**: WCAG 2.1 AA compliance with heraldic accuracy
- **Alternative Input**: Voice-to-blazonry conversion capabilities

---

## 6. Integration Requirements

### 6.1 IxStats Ecosystem Integration
```typescript
// MediaSearchModal Integration
interface VexelMediaItem {
  id: string;
  type: 'heraldic-design';
  url: string;
  thumbnail: string;
  metadata: {
    name: string;
    blazonry: string;
    creator: string;
    tags: string[];
  };
}

// MyCountry® Integration
interface NationalHeraldry {
  countryId: string;
  officialCoatOfArms?: string;
  alternativeDesigns: string[];
  historicalVariants: string[];
}
```

### 6.2 Database Schema Extensions
```sql
-- New tables for Vexel
CREATE TABLE heraldic_designs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  blazonry TEXT,
  design_data JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES User(id)
);

CREATE TABLE heraldic_elements (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL, -- 'charge', 'ordinary', 'field'
  name TEXT NOT NULL,
  svg_data TEXT NOT NULL,
  tags TEXT[],
  historical_context TEXT
);
```

### 6.3 API Endpoints (tRPC)
```typescript
// tRPC Router Extensions
export const vexelRouter = createTRPCRouter({
  // Design Management
  create: protectedProcedure
    .input(createHeraldricDesignSchema)
    .mutation(async ({ input, ctx }) => { /* ... */ }),
  
  // Community Features  
  getPublicGallery: publicProcedure
    .input(galleryFiltersSchema)
    .query(async ({ input, ctx }) => { /* ... */ }),
    
  // MediaSearchModal Integration
  getForMediaModal: protectedProcedure
    .input(mediaSearchSchema)
    .query(async ({ input, ctx }) => { /* ... */ }),
});
```

---

## 7. Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-3)
- [ ] Set up `/labs/vexel` route structure
- [ ] Implement basic heraldic data models
- [ ] Create fundamental UI components with glass physics
- [ ] Establish SVG rendering pipeline

### Phase 2: Creation Engine (Weeks 4-7)
- [ ] Build visual design builder interface
- [ ] Implement blazonry parser with TypeScript
- [ ] Create comprehensive heraldic element library
- [ ] Add rule validation system

### Phase 3: Community Features (Weeks 8-10)
- [ ] Develop public gallery and sharing system
- [ ] Implement user authentication integration
- [ ] Create collaborative design features
- [ ] Add search and discovery functionality

### Phase 4: Integration & Polish (Weeks 11-12)
- [ ] Complete MediaSearchModal integration
- [ ] Implement MyCountry® heraldic features
- [ ] Performance optimization and testing
- [ ] Documentation and community onboarding

---

## 8. Risk Assessment & Mitigation

### Technical Risks
- **Complexity of Heraldic Rules**: *Mitigation - Progressive rule implementation*
- **SVG Rendering Performance**: *Mitigation - Canvas virtualization and caching*
- **Cross-browser Compatibility**: *Mitigation - Comprehensive testing matrix*

### User Experience Risks
- **Heraldic Learning Curve**: *Mitigation - Contextual help and tutorials*
- **Design Creation Complexity**: *Mitigation - Template system and guided flows*

### Business Risks
- **Community Adoption**: *Mitigation - Seeded content and creator incentives*
- **Resource Requirements**: *Mitigation - Phased rollout and performance monitoring*

---

## 9. Success Criteria & KPIs

### Engagement Metrics
- **Monthly Active Users**: Target 500+ within 3 months
- **Design Creation Rate**: Average 2+ designs per active user
- **Community Sharing**: 60%+ of designs marked public

### Technical Metrics
- **Performance**: <2s initial load, <500ms design updates
- **Reliability**: 99.5% uptime with error rate <0.1%
- **Mobile Usage**: 40%+ of sessions on mobile devices

### Integration Success
- **MediaSearchModal Usage**: 25%+ of heraldic designs used in media selection
- **MyCountry® Integration**: 15%+ of countries with custom heraldry
- **Export Activity**: 80%+ of finished designs exported

---

## 10. Future Enhancements

### Advanced Features
- **AI-Assisted Design**: ML-powered blazonry suggestions
- **Historical Database**: Integration with historical heraldic records
- **3D Rendering**: WebGL-based dimensional coat of arms
- **Animation Support**: Animated heraldic elements for digital usage

### Platform Extensions
- **Mobile App**: Dedicated iOS/Android applications
- **API Access**: Public API for third-party integrations
- **Merchandise Integration**: Print-on-demand heraldic products
- **Educational Content**: Interactive heraldic history and tutorials

---

*This PRD serves as the foundational document for Vexel development, ensuring alignment with IxStats ecosystem goals while maintaining the precision and tradition of heraldic design.*