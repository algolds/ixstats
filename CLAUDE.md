# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status & Context (January 2025)

### 🎯 **Current Maturity: 80% Complete (Grade A-)**
IxStats is a robust economic simulation platform with production-ready core systems and advanced features in active development.

#### ✅ **Fully Operational Systems (100%)**
- **Core Infrastructure**: Next.js 15, Prisma, tRPC APIs, IxTime system fully operational
- **Authentication System**: Complete role-based access control with admin middleware
- **Design System**: Glass physics framework with 100+ UI components implemented
- **Economic Engine**: Advanced tier-based modeling with real calculations
- **Database & API**: Complete Prisma schema with 17 tRPC routers

#### ⚠️ **Near Complete (75-90%)**
- **Intelligence System** (85%): Live data integration mostly complete, some mock data remains
- **Government Systems** (85%): Architecture complete, UI integration ongoing
- **Economic Modeling** (90%): Real calculations implemented, some placeholder data remains

#### 🔧 **In Active Development (60-75%)**
- **Advanced Features** (70%): ECI/SDI frameworks complete, admin UI implementation ongoing
- **Mobile Experience** (65%): Desktop-optimized, mobile improvements in progress
- **ThinkPages/Social** (70%): Core features complete, advanced features in development

> See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for detailed feature matrix

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
1. **System Maintenance**: Ongoing performance optimization and security updates
2. **Feature Enhancement**: User experience improvements and accessibility enhancements
3. **Documentation**: Keeping system documentation current with implementation status
4. **Performance**: Continue React optimization patterns and database query optimization

### Code Quality Standards
- **TypeScript**: Maintain 100% TypeScript coverage with strict type checking
- **React Patterns**: Use React.memo, useMemo, useCallback for performance optimization
- **Error Handling**: Implement defensive programming with comprehensive error boundaries  
- **API Integration**: Prefer tRPC APIs over direct database access in components

### System Architecture Status
**Production Ready Systems:**
- Core platform infrastructure with Next.js 15, Prisma, and tRPC fully operational
- Authentication system with role-based access control and secure API endpoints
- Economic calculation engine with tier-based modeling
- Glass physics design system with 100+ components

**In Active Development:**
- Intelligence components transitioning from mock to live data (85% complete)
- ECI/SDI modules with framework complete, UI implementation ongoing (70% complete)
- Mobile optimization and responsive improvements (65% complete)

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
- ✅ **Authentication System**: COMPLETED - Full role-based access control with admin middleware
- ⚠️ **Data Connectivity**: IN PROGRESS - Transitioning from mock to live data (85% complete)
- ⚠️ **Real-time Updates**: PARTIAL - WebSocket infrastructure ready, full integration ongoing
- 🔧 **Mobile Experience**: ONGOING - Desktop-first complete, mobile improvements needed (65%)
- 🔧 **Advanced Features**: ACTIVE - ECI/SDI frameworks done, UI implementation in progress (70%)
- ⚠️ **Economic Calculations**: MOSTLY COMPLETE - Real formulas implemented, some placeholders remain

### Current Development Status (January 2025)
**Production Core Ready - Advanced Features In Progress**
- ✅ Authentication system fully operational with admin middleware
- ✅ Core economic engine with tier-based modeling complete
- ⚠️ Transitioning from mock to live data across intelligence components
- 🔧 ECI/SDI admin interfaces framework complete, UI implementation ongoing
- 🔧 WebSocket infrastructure deployed, full real-time integration in progress
- ⚠️ Mobile optimization ongoing - desktop experience prioritized

The IxStats platform has a **production-ready core (80% complete)** with advanced features in active development. Focus areas: completing data integration, finalizing ECI/SDI UI, and improving mobile experience.