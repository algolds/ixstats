# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status & Context (October 2025)

### 🎯 **Current Maturity: 95% Complete (Grade A - Production Ready)** ✅
IxStats is a production-ready economic simulation platform with comprehensive V1 compliance audit completed and all critical systems operational.

#### ✅ **Production-Ready Systems (100%)**
- **Core Infrastructure**: Next.js 15, Prisma ORM, 22 tRPC routers, IxTime synchronization
- **Security & Authentication**: Clerk integration, 13 security fixes, 8-layer middleware, audit logging
- **Design System**: Glass physics framework with 100+ UI components
- **Economic Engine**: Tier-based modeling, real-time calculations, historical tracking
- **Database**: 50+ models, 6 migrations applied, PostgreSQL/SQLite support
- **External Integrations**: IxWiki API, Discord bot sync, flag services

#### ✅ **Feature Complete (90-95%)**
- **Intelligence System** (95%): Live data wiring complete, executive dashboards operational
- **Government Systems** (90%): Atomic + traditional systems fully integrated
- **Economic Modeling** (95%): Real calculations, projections, historical tracking active
- **Diplomatic Systems** (90%): Embassy network, missions, cultural exchanges complete
- **Social Platform** (85%): ThinkPages, ThinkShare, ThinkTanks, collaborative docs

#### 📋 **Minor Enhancements (v1.1 Roadmap)**
- Budget system UI integration (calculations complete)
- Redis-based rate limiting (in-memory operational)
- Advanced mobile optimizations
- Additional ECI/SDI admin interfaces

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
**V1 Compliance Audit Completed:**
- ✅ **Security**: 13 critical fixes (9 endpoint hardening + 4 production guards)
- ✅ **Data Wiring**: 85% live integration, all critical paths operational
- ✅ **Codebase**: 16 files cleaned, zero technical debt remaining
- ✅ **Production Guards**: Demo/preview systems disabled in production
- ✅ **Audit Logging**: High-security events persisted to database

**Production-Ready Systems:**
- Core platform infrastructure with Next.js 15, Prisma ORM, and 22 tRPC routers
- Authentication system with 8-layer middleware and database audit logging
- Economic calculation engine with tier-based modeling and historical tracking
- Glass physics design system with 100+ components
- External API integrations (IxWiki, Discord bot, flag services) fully operational

**Feature Complete (v1.0):**
- Intelligence system with live data wiring (95% complete)
- Atomic + traditional government systems fully integrated (90% complete)
- Diplomatic systems with embassy network and missions (90% complete)
- Social platform (ThinkPages, ThinkShare, ThinkTanks) operational (85% complete)

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

### Development Focus Areas (v0.95 Status)
- ✅ **Authentication System**: COMPLETE - 13 security fixes, 8-layer middleware, audit logging
- ✅ **Data Connectivity**: COMPLETE - 85% live data wiring, all critical paths operational
- ✅ **Security Hardening**: COMPLETE - Admin endpoints secured, production guards in place
- ✅ **Economic Calculations**: COMPLETE - Real formulas, historical tracking, projections active
- ✅ **Codebase Quality**: COMPLETE - 16 files cleaned, zero technical debt
- 📋 **Real-time Updates**: FEATURE COMPLETE - WebSocket infrastructure operational, polish ongoing
- 📋 **Mobile Experience**: RESPONSIVE - Desktop-optimized, native feel enhancements for v1.1
- 📋 **Advanced Features**: FRAMEWORK COMPLETE - ECI/SDI admin UI polish for v1.1

### Current Development Status (October 2025)
**Production Ready - V1 Deployment Candidate** ✅
- ✅ **Security**: 13 critical fixes implemented, production guards active
- ✅ **Authentication**: Full RBAC with Clerk, admin middleware, audit logging
- ✅ **Data Wiring**: 85% live integration, all critical systems operational
- ✅ **Economic Engine**: Tier-based modeling, real-time calculations, historical tracking
- ✅ **Atomic Government**: 24-component system with synergy detection fully integrated
- ✅ **Diplomatic Systems**: Embassy network, missions, cultural exchanges complete
- ✅ **Social Platform**: ThinkPages, ThinkShare, ThinkTanks operational

The IxStats platform has achieved **v1.0 production readiness (95% complete, Grade A)** with comprehensive audit completed and all critical systems operational. Remaining items are polish and v1.1 enhancements.