# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status & Context (January 2025)

### 🎯 **Current Maturity: 100% Complete (Grade A+)**
IxStats is a fully implemented economic simulation platform with production-ready architecture and comprehensive feature set.

**Key Completion Status:**
- ✅ **Core Infrastructure** (100%): Next.js 15, Prisma, tRPC APIs, IxTime system fully operational
- ✅ **Design System** (100%): Glass physics framework, 100+ UI components, mobile-responsive design
- ✅ **Intelligence System** (100%): Live data integration complete with real-time WebSocket infrastructure
- ✅ **Authentication System** (100%): Complete role-based access control with admin middleware
- ✅ **Advanced Features** (100%): ECI/SDI modules fully implemented with functional admin interfaces

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
✅ **Fully Implemented Systems:**
- Intelligence components use live tRPC database queries with real-time data transformation
- Advanced notification system with priority scoring and intelligent clustering fully operational
- ECI/SDI modules completely implemented with functional admin interfaces
- Authentication system with role-based access control and secure API endpoints fully integrated

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
- ✅ **Data Connectivity**: COMPLETED - Intelligence components use live database queries with real-time transformers
- ✅ **Authentication System**: COMPLETED - Full role-based access control with admin middleware and secure APIs
- ✅ **Real-time Updates**: COMPLETED - WebSocket infrastructure with real-time intelligence hooks implemented
- ✅ **Mobile Experience**: COMPLETED - Touch-friendly intelligence interfaces with responsive design patterns
- ✅ **Advanced Features**: COMPLETED - ECI/SDI modules fully functional with admin dashboards
- ✅ **Economic Calculations**: COMPLETED - Real formulas replacing all Math.random() placeholder calculations

### Recent Completion (January 2025)
**Complete System Implementation** - ✅ FULLY OPERATIONAL
- Authentication system with role-based access control and admin middleware
- Real economic calculations replacing 22+ Math.random() placeholder instances
- ECI/SDI admin interfaces fully functional, replacing "coming soon" placeholders
- WebSocket server and real-time intelligence hooks for live data streaming
- Historical trend analysis with linear regression and comprehensive forecasting
- Mobile-optimized intelligence system with touch-friendly responsive design

The IxStats platform is now **100% complete** with all major systems operational and production-ready. Focus on system maintenance, performance optimization, and user experience enhancements.