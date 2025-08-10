# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status & Context (January 2025)

### 🎯 **Current Maturity: 65% Complete (Grade A-)**
IxStats is a sophisticated economic simulation platform with exceptional architecture and strong foundational implementation. 

**Key Completion Status:**
- ✅ **Core Infrastructure** (95%): Next.js 15, Prisma, tRPC APIs, IxTime system fully functional
- ✅ **Design System** (90%): Glass physics framework, 100+ UI components, responsive design
- 🔄 **Intelligence System** (75%): Components built, needs live data integration
- 🔄 **Advanced Features** (65%): SDI/ECI modules documented, implementation in progress
- ⏳ **AI/ML Features** (40%): Architecture planned, no implementation yet

> See [PROGRESS_REPORT.md](./PROGRESS_REPORT.md) for comprehensive analysis

### 🏗️ **Architecture Overview**
- **Framework**: Next.js 15 with App Router, TypeScript, tRPC
- **Database**: SQLite (dev) / PostgreSQL (prod) with Prisma ORM
- **UI System**: Tailwind CSS v4 with custom glass physics design framework
- **Time System**: Custom IxTime (2x speed) synchronized with Discord bot
- **Economic Engine**: Tier-based growth modeling with sophisticated calculations

## Design Practices

### Unified Design Framework
- **Glass Physics System**: Use hierarchical depth levels (parent/child/interactive/modal)
- **Color Theming**: Section-specific themes (MyCountry=Gold, Global=Blue, ECI=Indigo, SDI=Red)
- **Component Architecture**: Follow atomic design with glass physics integration
- **Responsive Design**: Mobile-first with desktop enhancements
- Reference `/DOCS/UNIFIED_DESIGN_FRAMEWORK.md` for complete specifications

### Styling Guidelines
- **Tailwind v4**: All styling must use Tailwind CSS v4 syntax
- **Glass Effects**: Use predefined glass hierarchy classes for depth consistency
- **Theme Variables**: Use CSS custom properties for dynamic color theming
- **Accessibility**: Maintain WCAG 2.1 AA compliance with proper focus indicators

## Workflow & Codebase

### Development Priorities
1. **Live Data Integration**: Priority focus on connecting intelligence components to real database queries
2. **Backend Connectivity**: Many tRPC APIs exist but need frontend integration
3. **Mobile Optimization**: Intelligence system needs mobile responsive testing
4. **Performance**: React optimization patterns already implemented, maintain standards

### Code Quality Standards
- **TypeScript**: Maintain 100% TypeScript coverage with strict type checking
- **React Patterns**: Use React.memo, useMemo, useCallback for performance optimization
- **Error Handling**: Implement defensive programming with comprehensive error boundaries  
- **API Integration**: Prefer tRPC APIs over direct database access in components

### Current Implementation Gaps
⚠️ **Known Issues to Address:**
- Intelligence components use mock/transformed data instead of live DB queries
- Advanced notification system backend exists but UI not fully connected
- SDI/ECI modules are scaffolded but need functional implementation
- Authentication integration incomplete with executive features

### Key File Locations
**Intelligence System:**
- Components: `/src/app/mycountry/new/components/`
- Types: `/src/app/mycountry/new/types/intelligence.ts`
- Data Transformers: `/src/app/mycountry/new/utils/dataTransformers.ts`

**API Layer:**
- tRPC Routers: `/src/server/api/routers/`
- Database Schema: `/prisma/schema.prisma`

**Design System:**
- UI Components: `/src/components/ui/`
- Design Documentation: `/DOCS/UNIFIED_DESIGN_FRAMEWORK.md`

### Testing & Validation
- Run `npm run check` for full validation (lint + typecheck)
- Use `npm run dev` for development with comprehensive validation
- Database operations: `npm run db:setup` for initialization

### Performance Considerations
- **Component Optimization**: Already implemented React.memo patterns, maintain consistency
- **Bundle Size**: Monitor imports and use dynamic imports for large components
- **Database Queries**: Use tRPC caching and optimize query patterns
- **Glass Effects**: GPU acceleration already implemented for glass physics

## Important Implementation Notes

### Current Architecture Strengths
- **Exceptional TypeScript Coverage**: 20+ intelligence interfaces with comprehensive type safety
- **Professional UI/UX**: Advanced glass physics system with contextual intelligence
- **Solid Data Foundation**: Comprehensive Prisma schema with economic modeling
- **Performance Optimized**: React best practices with memoization and error boundaries

### Development Focus Areas
- ✅ **Data Connectivity**: COMPLETED - Intelligence components now use live database queries
- ⏳ **Real-time Updates**: NEXT PRIORITY - Implement WebSocket infrastructure for live intelligence  
- ⏳ **Mobile Experience**: Optimize intelligence system for mobile devices
- ⏳ **Advanced Features**: Complete SDI/ECI module implementation

### Recent Completion (January 2025)
**Phase 1 Live Data Integration** - ✅ COMPLETED
- ExecutiveCommandCenter, IntelligenceBriefings, NationalPerformanceCommandCenter now use live tRPC data
- Created comprehensive live data transformer system (`liveDataTransformers.ts`)
- Eliminated all mock data usage in intelligence components
- See [PHASE1_MIGRATION_GUIDE.md](./PHASE1_MIGRATION_GUIDE.md) for complete implementation details

When working on this project, **Phase 2 real-time updates** is now the next priority. The live data integration foundation is complete and solid - focus on WebSocket infrastructure for real-time intelligence updates.