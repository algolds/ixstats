# Vexel Technical Architecture
## TypeScript/React Port Implementation Guide

### Architecture Overview

Vexel is designed as a sophisticated heraldic creation system that seamlessly integrates into the IxStats ecosystem. The architecture follows modern React patterns with TypeScript for type safety, leveraging the existing IxStats infrastructure while introducing specialized heraldic capabilities.

---

## 1. Core Technology Stack

### Primary Technologies
```typescript
// Framework & Language
- Next.js 15 with App Router
- TypeScript 5.0+ with strict mode
- React 18 with concurrent features

// Styling & UI
- Tailwind CSS v4
- IxStats Glass Physics Framework
- Radix UI primitives
- Framer Motion for animations

// Data Layer
- Prisma ORM with PostgreSQL/SQLite
- tRPC for type-safe APIs
- React Query for state management

// Heraldic Rendering
- SVG.js for advanced SVG manipulation
- Canvas API for complex rendering
- Web Workers for heavy computations
```

### Development Tools
```json
{
  "devDependencies": {
    "@types/svg.js": "^3.0.0",
    "svg.js": "^3.2.0",
    "canvas": "^2.11.0",
    "sharp": "^0.33.0",
    "react-use-gesture": "^9.1.3"
  }
}
```

---

## 2. Directory Structure

```
/app/labs/vexel/
├── components/
│   ├── creation/
│   │   ├── VexelBuilder.tsx          # Main creation interface
│   │   ├── DesignCanvas.tsx          # Interactive design surface
│   │   ├── ElementLibrary.tsx        # Heraldic elements palette
│   │   ├── BlazonyParser.tsx         # Text-to-design converter
│   │   └── PropertyPanel.tsx         # Element customization panel
│   ├── gallery/
│   │   ├── PublicGallery.tsx         # Community designs browser
│   │   ├── DesignCard.tsx           # Individual design preview
│   │   ├── FilterSidebar.tsx        # Search and filtering
│   │   └── DesignDetails.tsx        # Detailed design view
│   ├── renderer/
│   │   ├── SVGRenderer.tsx          # Primary SVG rendering engine
│   │   ├── HeraldricElements.tsx    # Reusable heraldic components
│   │   ├── StyleSystem.tsx          # Theming and customization
│   │   └── ExportSystem.tsx         # Export functionality
│   ├── integration/
│   │   ├── MediaModalBridge.tsx     # MediaSearchModal integration
│   │   ├── ShareDialog.tsx          # Community sharing interface
│   │   └── MyCountryIntegration.tsx # National heraldry features
│   └── ui/
│       ├── HeraldricInput.tsx       # Specialized form inputs
│       ├── ColorPicker.tsx          # Heraldic color selection
│       └── PatternSelector.tsx      # Heraldic pattern selection
├── lib/
│   ├── heraldic/
│   │   ├── blazonry-parser.ts       # Blazonry text parsing
│   │   ├── design-validator.ts      # Heraldic rule validation
│   │   ├── element-library.ts       # Heraldic elements database
│   │   └── svg-generator.ts         # SVG generation utilities
│   ├── types/
│   │   ├── heraldic.ts             # Core heraldic types
│   │   ├── design.ts               # Design data structures
│   │   └── community.ts            # Community sharing types
│   └── utils/
│       ├── coordinates.ts          # Coordinate system utilities
│       ├── color-conversion.ts     # Heraldic color handling
│       └── export-utilities.ts    # Export format handling
├── hooks/
│   ├── use-heraldic-design.ts      # Design state management
│   ├── use-blazonry-parser.ts      # Blazonry parsing hook
│   └── use-svg-renderer.ts         # SVG rendering hook
└── page.tsx                        # Main Vexel application entry
```

---

## 3. Core Type Definitions

### Heraldic Data Model
```typescript
// lib/types/heraldic.ts

export interface CoatOfArms {
  id: string;
  userId: string;
  name: string;
  blazonry: string;
  design: HeraldricDesign;
  metadata: DesignMetadata;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  tags: string[];
  likes: number;
  forks: number;
  parentDesignId?: string;
}

export interface HeraldricDesign {
  escutcheon: EscutcheonDefinition;
  field: FieldDefinition;
  charges: ChargeElement[];
  ordinaries: OrdinaryElement[];
  supporters?: SupporterElement[];
  crest?: CrestElement;
  motto?: MottoElement;
  style: RenderingStyle;
  version: number;
}

export interface EscutcheonDefinition {
  shape: EscutcheonShape;
  size: { width: number; height: number };
  style: 'traditional' | 'modern' | 'minimalist';
}

export interface FieldDefinition {
  tincture: HeraldricTincture;
  pattern?: FieldPattern;
  divisions?: FieldDivision[];
}

export interface ChargeElement {
  id: string;
  type: ChargeType;
  position: Position;
  size: Size;
  tincture: HeraldricTincture;
  orientation?: number;
  variations?: ChargeVariation[];
}

export interface HeraldricTincture {
  type: 'metal' | 'colour' | 'fur';
  name: string;
  hex: string;
  historical: boolean;
}

export interface Position {
  x: number; // Percentage from left
  y: number; // Percentage from top
  placement?: 'chief' | 'base' | 'dexter' | 'sinister' | 'centre';
}

export interface RenderingStyle {
  theme: 'medieval' | 'renaissance' | 'modern' | 'minimalist';
  lineWeight: number;
  shading: boolean;
  texture: boolean;
  colorSaturation: number;
}
```

### Community Integration Types
```typescript
// lib/types/community.ts

export interface VexelMediaItem {
  id: string;
  type: 'heraldic-design';
  url: string;
  thumbnail: string;
  metadata: {
    name: string;
    blazonry: string;
    creator: string;
    tags: string[];
    createdAt: Date;
  };
}

export interface DesignShare {
  designId: string;
  shareType: 'public' | 'unlisted' | 'private';
  allowForking: boolean;
  allowCommercialUse: boolean;
  attribution: string;
}

export interface DesignFork {
  originalDesignId: string;
  forkedDesignId: string;
  userId: string;
  changes: DesignChange[];
  createdAt: Date;
}
```

---

## 4. Component Architecture

### Main Application Component
```typescript
// app/labs/vexel/page.tsx

'use client';

import { useState, useCallback } from 'react';
import { VexelBuilder } from './components/creation/VexelBuilder';
import { PublicGallery } from './components/gallery/PublicGallery';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useHeraldricDesign } from './hooks/use-heraldic-design';

export default function VexelPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'gallery'>('create');
  const { design, updateDesign, saveDesign } = useHeraldricDesign();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/5 to-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Vexel
          </h1>
          <p className="text-muted-foreground">
            Create precise heraldic designs with modern tools
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'create' | 'gallery')}>
          <TabsList className="grid w-full grid-cols-2 glass-panel">
            <TabsTrigger value="create">Create Design</TabsTrigger>
            <TabsTrigger value="gallery">Community Gallery</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-6">
            <VexelBuilder design={design} onDesignUpdate={updateDesign} />
          </TabsContent>

          <TabsContent value="gallery" className="mt-6">
            <PublicGallery />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

### Core Creation Interface
```typescript
// components/creation/VexelBuilder.tsx

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { DesignCanvas } from './DesignCanvas';
import { ElementLibrary } from './ElementLibrary';
import { PropertyPanel } from './PropertyPanel';
import { BlazonyParser } from './BlazonyParser';
import { ExportDialog } from '../renderer/ExportSystem';
import { ShareDialog } from '../integration/ShareDialog';
import { HeraldricDesign } from '../../lib/types/heraldic';
import { useSVGRenderer } from '../../hooks/use-svg-renderer';

interface VexelBuilderProps {
  design: HeraldricDesign;
  onDesignUpdate: (design: HeraldricDesign) => void;
}

export function VexelBuilder({ design, onDesignUpdate }: VexelBuilderProps) {
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [showBlazonyParser, setShowBlazonyParser] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const { svgString, isRendering } = useSVGRenderer(design);

  const handleElementSelect = useCallback((elementId: string) => {
    setSelectedElement(elementId);
  }, []);

  const handleElementUpdate = useCallback((elementId: string, updates: Partial<any>) => {
    // Update specific element in design
    const updatedDesign = updateElementInDesign(design, elementId, updates);
    onDesignUpdate(updatedDesign);
  }, [design, onDesignUpdate]);

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
      {/* Left Sidebar - Element Library */}
      <div className="col-span-3">
        <ElementLibrary onElementSelect={handleElementSelect} />
      </div>

      {/* Main Canvas Area */}
      <div className="col-span-6">
        <div className="glass-panel h-full flex flex-col">
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Design Canvas</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBlazonyParser(true)}
                >
                  Import Blazonry
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportDialog(true)}
                >
                  Export
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowShareDialog(true)}
                >
                  Share
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4">
            <DesignCanvas
              design={design}
              selectedElement={selectedElement}
              onElementSelect={handleElementSelect}
              onElementUpdate={handleElementUpdate}
            />
          </div>
        </div>
      </div>

      {/* Right Sidebar - Properties Panel */}
      <div className="col-span-3">
        <PropertyPanel
          selectedElement={selectedElement}
          design={design}
          onElementUpdate={handleElementUpdate}
        />
      </div>

      {/* Modals */}
      {showBlazonyParser && (
        <BlazonyParser
          onClose={() => setShowBlazonyParser(false)}
          onDesignImport={onDesignUpdate}
        />
      )}

      {showExportDialog && (
        <ExportDialog
          design={design}
          svgString={svgString}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {showShareDialog && (
        <ShareDialog
          design={design}
          onClose={() => setShowShareDialog(false)}
        />
      )}
    </div>
  );
}
```

---

## 5. Heraldic Engine Implementation

### SVG Rendering System
```typescript
// lib/heraldic/svg-generator.ts

import { SVG, Svg } from '@svgdotjs/svg.js';
import { HeraldricDesign, EscutcheonDefinition, FieldDefinition } from '../types/heraldic';

export class HeraldricSVGGenerator {
  private canvas: Svg;
  private width: number;
  private height: number;

  constructor(width: number = 400, height: number = 480) {
    this.width = width;
    this.height = height;
    this.canvas = SVG().size(width, height);
  }

  public generateCoatOfArms(design: HeraldricDesign): string {
    this.canvas.clear();

    // 1. Draw escutcheon (shield shape)
    this.drawEscutcheon(design.escutcheon);

    // 2. Apply field (background)
    this.drawField(design.field);

    // 3. Draw ordinaries (lines of division)
    design.ordinaries.forEach(ordinary => {
      this.drawOrdinary(ordinary);
    });

    // 4. Draw charges (heraldic elements)
    design.charges.forEach(charge => {
      this.drawCharge(charge);
    });

    // 5. Apply style effects
    this.applyStyleEffects(design.style);

    return this.canvas.svg();
  }

  private drawEscutcheon(escutcheon: EscutcheonDefinition): void {
    const { shape, size } = escutcheon;
    
    switch (shape) {
      case 'heater':
        this.drawHeaterShield();
        break;
      case 'french':
        this.drawFrenchShield();
        break;
      case 'english':
        this.drawEnglishShield();
        break;
      default:
        this.drawHeaterShield();
    }
  }

  private drawHeaterShield(): void {
    const path = `M 50 50 
                 L 350 50 
                 L 350 250 
                 Q 350 300 325 340
                 Q 300 380 270 400
                 Q 240 420 200 430
                 Q 160 420 130 400
                 Q 100 380 75 340
                 Q 50 300 50 250
                 Z`;
    
    this.canvas.path(path)
      .fill('white')
      .stroke({ color: 'black', width: 2 })
      .addClass('escutcheon');
  }

  private drawField(field: FieldDefinition): void {
    const { tincture, pattern, divisions } = field;
    
    // Apply base tincture
    const fieldGroup = this.canvas.group().addClass('field');
    
    if (pattern) {
      this.applyFieldPattern(fieldGroup, pattern);
    } else {
      // Solid color field
      fieldGroup.rect(this.width, this.height)
        .fill(tincture.hex)
        .addClass(`tincture-${tincture.name}`);
    }

    if (divisions) {
      divisions.forEach(division => {
        this.drawFieldDivision(fieldGroup, division);
      });
    }
  }

  private drawCharge(charge: ChargeElement): void {
    const chargeGroup = this.canvas.group().addClass('charge');
    
    // Position calculation based on heraldic placement
    const position = this.calculateChargePosition(charge.position);
    
    // Load charge SVG from library
    const chargeSvg = this.loadChargeFromLibrary(charge.type);
    
    if (chargeSvg) {
      chargeGroup.svg(chargeSvg)
        .move(position.x, position.y)
        .size(charge.size.width, charge.size.height)
        .fill(charge.tincture.hex);
        
      if (charge.orientation) {
        chargeGroup.rotate(charge.orientation);
      }
    }
  }
}
```

### Blazonry Parser Implementation
```typescript
// lib/heraldic/blazonry-parser.ts

export interface BlazonyParseResult {
  success: boolean;
  design?: HeraldricDesign;
  errors?: string[];
  warnings?: string[];
}

export class BlazonyParser {
  private static readonly TINCTURE_PATTERNS = {
    metals: /\b(or|argent|silver|gold)\b/gi,
    colours: /\b(azure|blue|gules|red|vert|green|sable|black|purpure|purple)\b/gi,
    furs: /\b(ermine|ermines|erminois|pean|vair|counter-vair)\b/gi,
  };

  private static readonly ORDINARY_PATTERNS = {
    chief: /\b(chief)\b/gi,
    pale: /\b(pale)\b/gi,
    fess: /\b(fess)\b/gi,
    bend: /\b(bend(?:\s+sinister)?)\b/gi,
    chevron: /\b(chevron)\b/gi,
    cross: /\b(cross)\b/gi,
    saltire: /\b(saltire)\b/gi,
  };

  private static readonly CHARGE_PATTERNS = {
    animals: /\b(lion|eagle|bear|boar|stag|hart|wolf)\b/gi,
    objects: /\b(sword|crown|castle|tower|ship|anchor|star|sun|moon)\b/gi,
    plants: /\b(tree|oak|rose|lily|thistle|shamrock)\b/gi,
  };

  public static parse(blazonry: string): BlazonyParseResult {
    const result: BlazonyParseResult = {
      success: false,
      errors: [],
      warnings: []
    };

    try {
      // Normalize the blazonry text
      const normalized = this.normalizeBlazonryText(blazonry);
      
      // Parse field
      const field = this.parseField(normalized);
      
      // Parse ordinaries
      const ordinaries = this.parseOrdinaries(normalized);
      
      // Parse charges
      const charges = this.parseCharges(normalized);
      
      // Create design object
      const design: HeraldricDesign = {
        escutcheon: {
          shape: 'heater',
          size: { width: 400, height: 480 },
          style: 'traditional'
        },
        field,
        charges,
        ordinaries,
        style: {
          theme: 'traditional',
          lineWeight: 2,
          shading: true,
          texture: false,
          colorSaturation: 1.0
        },
        version: 1
      };

      result.success = true;
      result.design = design;
    } catch (error) {
      result.errors?.push(`Parse error: ${error.message}`);
    }

    return result;
  }

  private static parseField(blazonry: string): FieldDefinition {
    // Extract field tincture
    const tinctures = this.extractTinctures(blazonry);
    
    if (tinctures.length === 0) {
      throw new Error('No field tincture specified');
    }

    return {
      tincture: tinctures[0],
      pattern: this.parseFieldPattern(blazonry),
      divisions: this.parseFieldDivisions(blazonry)
    };
  }

  private static extractTinctures(text: string): HeraldricTincture[] {
    const tinctures: HeraldricTincture[] = [];
    
    // Extract metals
    const metalMatches = text.match(this.TINCTURE_PATTERNS.metals);
    metalMatches?.forEach(match => {
      tinctures.push(this.createTincture('metal', match));
    });

    // Extract colours
    const colourMatches = text.match(this.TINCTURE_PATTERNS.colours);
    colourMatches?.forEach(match => {
      tinctures.push(this.createTincture('colour', match));
    });

    return tinctures;
  }

  private static createTincture(type: 'metal' | 'colour' | 'fur', name: string): HeraldricTincture {
    const tinctureMappings = {
      or: { hex: '#FFD700', historical: true },
      argent: { hex: '#FFFFFF', historical: true },
      azure: { hex: '#0F47AF', historical: true },
      gules: { hex: '#CE1126', historical: true },
      vert: { hex: '#009639', historical: true },
      sable: { hex: '#000000', historical: true },
      purpure: { hex: '#9C2CB6', historical: true },
    };

    const mapping = tinctureMappings[name.toLowerCase()] || { hex: '#666666', historical: false };
    
    return {
      type,
      name: name.toLowerCase(),
      hex: mapping.hex,
      historical: mapping.historical
    };
  }
}
```

---

## 6. MediaSearchModal Integration

### Vexel Media Bridge Component
```typescript
// components/integration/MediaModalBridge.tsx

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { MediaSearchModal } from '~/components/MediaSearchModal';
import { api } from '~/trpc/react';
import { VexelMediaItem } from '../../lib/types/community';

interface VexelMediaBridgeProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (imageUrl: string) => void;
}

export function VexelMediaBridge({ isOpen, onClose, onImageSelect }: VexelMediaBridgeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);

  // Fetch public Vexel designs
  const { data: vexelDesigns, isLoading } = api.vexel.getPublicGallery.useQuery(
    { 
      query: searchQuery,
      limit: 20,
      includeMetadata: true
    },
    { 
      enabled: isOpen && searchQuery.length > 0,
      staleTime: 5 * 60 * 1000
    }
  );

  // Convert Vexel designs to MediaSearchModal format
  const vexelMediaItems: VexelMediaItem[] = useMemo(() => {
    if (!vexelDesigns) return [];
    
    return vexelDesigns.map(design => ({
      id: design.id,
      type: 'heraldic-design',
      url: design.svgDataUrl, // Generated SVG data URL
      thumbnail: design.thumbnailUrl,
      metadata: {
        name: design.name,
        blazonry: design.blazonry,
        creator: design.user.displayName || design.user.username,
        tags: design.tags,
        createdAt: design.createdAt
      }
    }));
  }, [vexelDesigns]);

  const handleVexelDesignSelect = useCallback((designUrl: string) => {
    onImageSelect(designUrl);
    onClose();
  }, [onImageSelect, onClose]);

  // Extend MediaSearchModal with Vexel tab
  return (
    <EnhancedMediaSearchModal
      isOpen={isOpen}
      onClose={onClose}
      onImageSelect={onImageSelect}
      customTabs={[
        {
          id: 'vexel',
          label: 'Heraldic Designs',
          component: (
            <VexelGalleryTab
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              designs={vexelMediaItems}
              selectedDesign={selectedDesign}
              onDesignSelect={setSelectedDesign}
              onDesignConfirm={handleVexelDesignSelect}
              isLoading={isLoading}
            />
          )
        }
      ]}
    />
  );
}
```

---

## 7. Performance Optimizations

### Rendering Optimizations
```typescript
// hooks/use-svg-renderer.ts

import { useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HeraldricDesign } from '../lib/types/heraldic';
import { HeraldricSVGGenerator } from '../lib/heraldic/svg-generator';

export function useSVGRenderer(design: HeraldricDesign) {
  const rendererRef = useRef<HeraldricSVGGenerator>();
  
  // Initialize renderer once
  if (!rendererRef.current) {
    rendererRef.current = new HeraldricSVGGenerator();
  }

  // Memoize design hash for caching
  const designHash = useMemo(() => {
    return JSON.stringify(design);
  }, [design]);

  // Use React Query for caching expensive renders
  const { data: svgString, isLoading: isRendering } = useQuery({
    queryKey: ['heraldic-render', designHash],
    queryFn: async () => {
      return rendererRef.current!.generateCoatOfArms(design);
    },
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  const downloadSVG = useCallback((filename: string = 'coat-of-arms.svg') => {
    if (!svgString) return;
    
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [svgString]);

  return {
    svgString,
    isRendering,
    downloadSVG
  };
}
```

### Component Optimization
```typescript
// Optimized component patterns

import React, { memo, useMemo } from 'react';

export const DesignCanvas = memo(function DesignCanvas({
  design,
  selectedElement,
  onElementSelect,
  onElementUpdate
}) {
  // Memoize expensive calculations
  const canvasTransform = useMemo(() => {
    return calculateCanvasTransform(design.escutcheon.size);
  }, [design.escutcheon.size]);

  const renderElements = useMemo(() => {
    return design.charges.map(charge => (
      <HeraldricElement
        key={charge.id}
        element={charge}
        isSelected={selectedElement === charge.id}
        onSelect={() => onElementSelect(charge.id)}
        onUpdate={(updates) => onElementUpdate(charge.id, updates)}
      />
    ));
  }, [design.charges, selectedElement, onElementSelect, onElementUpdate]);

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox="0 0 400 480"
        className="w-full h-full"
        transform={canvasTransform}
      >
        {renderElements}
      </svg>
    </div>
  );
});
```

---

## 8. Database Schema Extensions

### Prisma Schema Updates
```prisma
// prisma/schema.prisma - Add to existing schema

model HeraldricDesign {
  id        String   @id @default(cuid())
  userId    String
  name      String
  blazonry  String?
  designData Json    // Stores HeraldricDesign object
  isPublic  Boolean  @default(false)
  tags      String[]
  likes     Int      @default(0)
  forks     Int      @default(0)
  parentDesignId String?
  
  // SVG and image data
  svgData      String? // Generated SVG string
  thumbnailUrl String? // Generated thumbnail
  
  // Metadata
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  user       User @relation(fields: [userId], references: [id], onDelete: Cascade)
  parentDesign HeraldricDesign? @relation("DesignForks", fields: [parentDesignId], references: [id])
  forks      HeraldricDesign[] @relation("DesignForks")
  
  // Usage tracking
  mediaUsages MediaUsage[]
  
  @@index([userId])
  @@index([isPublic])
  @@index([createdAt])
  @@map("heraldric_designs")
}

model HeraldricElement {
  id          String   @id @default(cuid())
  category    ElementCategory // CHARGE, ORDINARY, FIELD_PATTERN
  name        String
  svgData     String   // SVG path or complete element
  tags        String[]
  description String?
  historical  Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([category])
  @@index([tags])
  @@map("heraldric_elements")
}

model MediaUsage {
  id        String   @id @default(cuid())
  designId  String
  usageType MediaUsageType // MYCOUNTRY_SYMBOL, BUILDER_IMAGE, PROFILE_AVATAR
  contextId String? // Country ID, Page ID, etc.
  
  createdAt DateTime @default(now())
  
  design    HeraldricDesign @relation(fields: [designId], references: [id], onDelete: Cascade)
  
  @@index([designId])
  @@index([usageType])
  @@map("media_usages")
}

enum ElementCategory {
  CHARGE
  ORDINARY
  FIELD_PATTERN
  ESCUTCHEON
  SUPPORTER
  CREST
  MOTTO
}

enum MediaUsageType {
  MYCOUNTRY_SYMBOL
  BUILDER_IMAGE
  PROFILE_AVATAR
  THINKPAGE_CONTENT
  CARD_ILLUSTRATION
}

// Extend User model
model User {
  // ... existing fields
  heraldricDesigns HeraldricDesign[]
}
```

---

## 9. API Implementation (tRPC)

### Vexel Router
```typescript
// server/api/routers/vexel.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { HeraldricSVGGenerator } from "~/app/labs/vexel/lib/heraldic/svg-generator";
import sharp from 'sharp';

const createHeraldricDesignSchema = z.object({
  name: z.string().min(1).max(100),
  blazonry: z.string().optional(),
  designData: z.any(), // HeraldricDesign object
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const galleryFiltersSchema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
  includeMetadata: z.boolean().default(false),
});

export const vexelRouter = createTRPCRouter({
  // Create new heraldric design
  create: protectedProcedure
    .input(createHeraldricDesignSchema)
    .mutation(async ({ input, ctx }) => {
      // Generate SVG
      const generator = new HeraldricSVGGenerator();
      const svgData = generator.generateCoatOfArms(input.designData);
      
      // Generate thumbnail
      const thumbnailBuffer = await sharp(Buffer.from(svgData))
        .resize(200, 240)
        .png()
        .toBuffer();
      
      const thumbnailUrl = `data:image/png;base64,${thumbnailBuffer.toString('base64')}`;
      
      const design = await ctx.db.heraldricDesign.create({
        data: {
          userId: ctx.session.user.id,
          name: input.name,
          blazonry: input.blazonry,
          designData: input.designData,
          isPublic: input.isPublic,
          tags: input.tags,
          svgData,
          thumbnailUrl,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
      });

      return design;
    }),

  // Get public gallery
  getPublicGallery: publicProcedure
    .input(galleryFiltersSchema)
    .query(async ({ input, ctx }) => {
      const { query, tags, limit, offset, includeMetadata } = input;

      const whereClause: any = {
        isPublic: true,
      };

      if (query) {
        whereClause.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { blazonry: { contains: query, mode: 'insensitive' } },
          { tags: { hasSome: [query] } },
        ];
      }

      if (tags && tags.length > 0) {
        whereClause.tags = {
          hassome: tags,
        };
      }

      const designs = await ctx.db.heraldricDesign.findMany({
        where: whereClause,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          ...(includeMetadata && {
            _count: {
              select: {
                forks: true,
                mediaUsages: true,
              },
            },
          }),
        },
      });

      return designs;
    }),

  // Get design for MediaSearchModal
  getForMediaModal: protectedProcedure
    .input(z.object({
      query: z.string(),
      limit: z.number().default(10),
    }))
    .query(async ({ input, ctx }) => {
      const designs = await ctx.db.heraldricDesign.findMany({
        where: {
          isPublic: true,
          OR: [
            { name: { contains: input.query, mode: 'insensitive' } },
            { tags: { hasSome: [input.query] } },
          ],
        },
        take: input.limit,
        select: {
          id: true,
          name: true,
          blazonry: true,
          thumbnailUrl: true,
          svgData: true,
          tags: true,
          createdAt: true,
          user: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
        orderBy: { likes: 'desc' },
      });

      return designs.map(design => ({
        ...design,
        svgDataUrl: `data:image/svg+xml;base64,${Buffer.from(design.svgData || '').toString('base64')}`,
      }));
    }),

  // Fork existing design
  fork: protectedProcedure
    .input(z.object({
      parentDesignId: z.string(),
      name: z.string().min(1).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const parentDesign = await ctx.db.heraldricDesign.findUnique({
        where: { id: input.parentDesignId },
      });

      if (!parentDesign || !parentDesign.isPublic) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Design not found or not public',
        });
      }

      // Create fork
      const fork = await ctx.db.heraldricDesign.create({
        data: {
          userId: ctx.session.user.id,
          name: input.name,
          blazonry: parentDesign.blazonry,
          designData: parentDesign.designData,
          parentDesignId: input.parentDesignId,
          isPublic: false, // Forks start as private
          svgData: parentDesign.svgData,
          thumbnailUrl: parentDesign.thumbnailUrl,
        },
      });

      // Update parent fork count
      await ctx.db.heraldricDesign.update({
        where: { id: input.parentDesignId },
        data: { forks: { increment: 1 } },
      });

      return fork;
    }),

  // Like/unlike design
  toggleLike: protectedProcedure
    .input(z.object({ designId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Implementation for like/unlike functionality
      // This would require a separate likes table for tracking
    }),
});
```

---

## 10. Testing Strategy

### Unit Testing
```typescript
// __tests__/heraldic/blazonry-parser.test.ts

import { BlazonyParser } from '../../lib/heraldic/blazonry-parser';

describe('BlazonyParser', () => {
  it('should parse simple blazonry correctly', () => {
    const result = BlazonyParser.parse('Azure, a lion or');
    
    expect(result.success).toBe(true);
    expect(result.design).toBeDefined();
    expect(result.design!.field.tincture.name).toBe('azure');
    expect(result.design!.charges).toHaveLength(1);
    expect(result.design!.charges[0].type).toBe('lion');
  });

  it('should handle complex blazonry with ordinaries', () => {
    const result = BlazonyParser.parse('Gules, a fess argent between three lions or');
    
    expect(result.success).toBe(true);
    expect(result.design!.ordinaries).toHaveLength(1);
    expect(result.design!.charges).toHaveLength(3);
  });

  it('should return errors for invalid blazonry', () => {
    const result = BlazonyParser.parse('Invalid blazonry text');
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });
});
```

### Integration Testing
```typescript
// __tests__/integration/vexel-workflow.test.ts

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VexelBuilder } from '../../components/creation/VexelBuilder';
import { mockHeraldricDesign } from '../mocks/heraldic-data';

describe('Vexel Workflow Integration', () => {
  it('should create and export a design successfully', async () => {
    const onDesignUpdate = jest.fn();
    
    render(
      <VexelBuilder design={mockHeraldricDesign} onDesignUpdate={onDesignUpdate} />
    );

    // Add a charge
    fireEvent.click(screen.getByText('Lion'));
    fireEvent.click(screen.getByTestId('design-canvas'));

    // Verify design update
    expect(onDesignUpdate).toHaveBeenCalled();

    // Export design
    fireEvent.click(screen.getByText('Export'));
    
    await waitFor(() => {
      expect(screen.getByText('Download SVG')).toBeInTheDocument();
    });
  });
});
```

---

This technical architecture provides a comprehensive foundation for implementing Vexel as a sophisticated heraldic design system within IxStats. The modular design allows for incremental development while maintaining integration with the existing ecosystem.