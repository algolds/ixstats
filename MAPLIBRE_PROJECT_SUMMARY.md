# MapLibre GL JS Custom Projection - Project Summary

**Date**: October 31, 2025
**Prepared For**: IxWiki Development Team
**Project**: Custom Projection Support for MapLibre GL JS

---

## Executive Summary

This research provides a comprehensive analysis and implementation plan for contributing custom projection support (Equal Earth, Natural Earth, IxMaps) to MapLibre GL JS, addressing community issues #168 and #272.

**Key Finding**: MapLibre has a well-designed, modular projection system introduced with Globe in v5.0. Adding new projections is achievable by following the proven 5-component architecture pattern.

**Recommended Approach**: Incremental PRs (one projection at a time), starting with Equal Earth as the foundation.

**Estimated Timeline**: 7-10 weeks for complete implementation

---

## Research Highlights

### Current State of MapLibre Projections

**Supported Projections** (as of v5.0):
- Mercator (default, EPSG:3857)
- Globe (spherical perspective, added v5.0)
- Vertical Perspective (tilted globe)

**Community Demand**:
- Issue #168: "Support rendering in multiple CRS" - 48 👍 reactions
- Issue #272: Bounty tracking for custom coordinate systems
- Discussion #163: Technical discussion with multiple stakeholders
- Strong interest from educational, scientific, and specialized mapping communities

**Existing Solutions**:
- Plugin approach (pka/maplibre-gl-equal-earth) exists but is limited
- Requires special pre-projected tiles
- Doesn't support true vector tile rendering
- Limited to low zoom levels

**Our Approach**: Full core integration like Globe, not a plugin wrapper

---

## Architecture Analysis

### 5-Component Projection System

Every projection in MapLibre requires these components:

1. **Projection Class** (`src/geo/projection/{name}.ts`)
   - Implements `Projection` interface
   - Defines shader variants and subdivision settings
   - Manages projection state
   - ~150-200 lines

2. **Transform Class** (`src/geo/projection/{name}_transform.ts`)
   - Handles coordinate transformations
   - Geographic ↔ Projected ↔ Screen coordinates
   - Matrix calculations for rendering
   - ~300-400 lines (most complex component)

3. **Camera Helper** (`src/geo/projection/{name}_camera_helper.ts`)
   - User interaction (pan, zoom, rotate)
   - Animation support (easeTo, flyTo)
   - Constraint handling
   - ~200-300 lines

4. **Vertex Shader** (`src/shaders/_projection_{name}.vertex.glsl`)
   - GPU-side coordinate transformation
   - Projects Mercator tiles to target projection
   - Handles elevation for 3D rendering
   - ~100-150 lines

5. **Utility Functions** (`src/geo/projection/{name}_utils.ts`)
   - Pure mathematical functions
   - Forward and inverse projection
   - Bounds calculations
   - ~50-100 lines

**Total per projection**: ~900-1,350 lines + comprehensive tests

### Key Architectural Insights

**From Globe Implementation (PR #3963)**:
- Geometry subdivision is critical for curved surfaces
- Adaptive transitions can mitigate precision issues
- Horizon clipping requires careful math
- GPU error correction may be needed for trigonometric functions
- Each layer type may need specific adaptations

**Design Philosophy**:
- Projections are singletons (one instance per type)
- Self-managed GPU resources
- Dynamic shader code injection
- Backward compatible (no breaking changes)

---

## Mathematical Foundations

### Equal Earth Projection (EPSG:8857)

**Properties**:
- Equal-area (preserves relative sizes)
- Pseudocylindrical (straight parallels, curved meridians)
- Visually similar to Robinson but mathematically precise
- Published 2018 by Šavrič, Patterson, & Jenny

**Forward Projection**:
```javascript
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
const M = Math.sqrt(3) / 2;

function equalEarthProject(lambda, phi) {
    const l = Math.asin(M * Math.sin(phi));
    const l2 = l * l, l6 = l2 * l2 * l2;

    return [
        lambda * Math.cos(l) / (M * (A1 + 3*A2*l2 + l6*(7*A3 + 9*A4*l2))),
        l * (A1 + A2*l2 + l6*(A3 + A4*l2))
    ];
}
```

**Inverse Projection**:
- Requires Newton-Raphson iteration (12 iterations for convergence)
- No closed-form solution

**Bounds**: X: ±2.6544, Y: ±1.3182

**Reference**: D3-geo implementation (https://github.com/d3/d3-geo/blob/main/src/projection/equalEarth.js)

### Natural Earth I Projection

**Properties**:
- Compromise projection (balances area, shape, distance)
- Polynomial approximation
- Popular for world atlases

**Forward Projection**:
```javascript
function naturalEarthProject(lambda, phi) {
    const phi2 = phi * phi, phi4 = phi2 * phi2;

    return [
        lambda * (0.8707 - 0.131979*phi2 + phi4*(-0.013791 + phi4*(0.003971*phi2 - 0.001529*phi4))),
        phi * (1.007226 + phi2*(0.015085 + phi4*(-0.044475 + 0.028874*phi2 - 0.005916*phi4)))
    ];
}
```

**Inverse Projection**:
- Requires numerical solver (no closed form)
- More complex than Equal Earth

**Reference**: D3-geo implementation (https://github.com/d3/d3-geo/blob/main/src/projection/naturalEarth1.js)

---

## Implementation Challenges & Solutions

### Challenge 1: Floating-Point Precision

**Issue**: GLSL has limited precision for trigonometric functions

**Solutions**:
- Use double-precision where available (`dvec2`, `dmat4`)
- Implement error correction like Globe's `atan()` verification
- Normalize intermediate values frequently
- Test across multiple GPUs

### Challenge 2: Geometry Subdivision

**Issue**: Mercator tiles have straight edges; projections need curves

**Solution**:
- Subdivide triangles/lines before projection
- Use granularity level 4 (same as Globe)
- Ensure tile boundary alignment to avoid seams

**Implementation**: Already handled by MapLibre's subdivision system

### Challenge 3: Tile Seam Artifacts

**Issue**: Adjacent tiles must align perfectly

**Solutions**:
- Use consistent subdivision at tile edges
- Force edge vertices to match neighbors
- Use coverage buffer to hide minor seams

### Challenge 4: Symbol Placement

**Issue**: Text/icons need proper placement in projected space

**Solutions**:
- Project symbol anchor points using transform
- Keep text upright (don't rotate with distortion)
- Adjust collision detection for projection space
- Scale icons based on local scale factor

### Challenge 5: Performance

**Issue**: Projection calculations can be expensive

**Solutions**:
- Cache projection matrices (recalculate only on camera change)
- Batch tile processing
- LOD system (simpler geometry at low zoom)
- Minimize shader branching
- Consider Web Workers for subdivision

---

## Development Workflow

### Initial Setup

```bash
# 1. Fork via GitHub UI, then clone
git clone https://github.com/YOUR_USERNAME/maplibre-gl-js.git
cd maplibre-gl-js

# 2. Install dependencies
npm install

# 3. Generate code (shaders, typings)
npm run codegen

# 4. Verify build
npm run build-dev
```

### Development Commands

```bash
# Start dev server with live reload (http://localhost:9966)
npm start

# Type checking (run in separate terminal)
npm run typecheck

# Linting
npm run lint
npm run lint-css

# Run all tests
npm test

# Run specific tests
npm run test-unit -- equal_earth.test.ts
npm run test-render -- equal-earth
npm run test-integration

# Build for production
npm run build-prod

# Analyze bundle size
npm run bundle-stats
```

### Testing Requirements

**Unit Tests**:
- >90% code coverage
- Test forward/inverse projection accuracy
- Round-trip accuracy (lng/lat → projected → lng/lat)
- Edge cases (poles, date line, bounds)
- Area preservation (for equal-area projections)

**Render Tests**:
- 10+ test cases per projection
- Test all layer types (fill, line, circle, symbol, etc.)
- Various zoom levels
- Geometry subdivision correctness
- Tile loading and caching

**Integration Tests**:
- Complete map scenarios
- User interaction (pan, zoom)
- Data loading and display
- API compatibility
- Performance benchmarks

---

## Community Engagement Strategy

### Phase 1: RFC (Request for Comments)

**Timing**: Week 1, before implementation

**Action**: Post detailed proposal in GitHub Discussions

**Key Points**:
- Link to architecture document
- Clearly define scope (Equal Earth, Natural Earth, IxMaps)
- Explain motivation (community demand, educational use cases)
- Show technical design (5-component architecture)
- Propose timeline (7-10 weeks)
- Ask open questions

**Tag Maintainers**:
- @HarelM (led Globe implementation)
- @wipfli (active in discussions)
- @kylebarron (participated in CRS discussions)

**Goal**: Get at least 2 maintainer approvals before coding

### Phase 2: Draft PR

**Timing**: Week 2-3, after basic implementation

**Action**: Create draft PR with checklist

**Contents**:
- Basic implementation (projection, transform, shader)
- Clear checklist of remaining work
- Screenshots/demos
- Performance benchmarks
- Questions for reviewers

**Benefits**:
- Early feedback on approach
- Demonstrates progress
- Catches issues before full implementation

### Phase 3: Code Review

**Timing**: Week 5+, when PR is complete

**Engagement Approach**:
- Respond to feedback within 24-48 hours
- Provide clear explanations for design decisions
- Be willing to iterate
- Show data/benchmarks to support decisions

### Phase 4: Post-Merge Announcement

**Channels**:
1. MapLibre Slack (#maplibre channel)
2. GitHub Discussions (technical detail)
3. Twitter/social media (broader awareness)
4. Blog post on ixwiki.com (showcase implementation)

**Template**:
> 🎉 MapLibre GL JS now supports Equal Earth projection!
>
> Equal Earth accurately represents area, making it ideal for educational and scientific applications.
>
> ✨ Features:
> - Native vector tile rendering
> - Smooth geometry subdivision
> - Full layer support
> - Seamless API integration
>
> 🔗 Try it: [demo]
> 📖 Docs: [guide]
> 💻 Code: [PR]

---

## Implementation Timeline

### Recommended Approach: Incremental PRs

**Rationale**:
- Easier to review (smaller changesets)
- Get feedback early, apply to later projections
- Show steady progress
- Less merge conflict risk
- Each PR can be merged independently

### Phase 1: Equal Earth Projection (Weeks 2-5)

**Week 2**: Core implementation
- Projection class, transform, utils, shader
- Update factory

**Week 3**: Camera helper & integration
- Camera helper implementation
- Subdivision system integration
- Initial testing

**Week 4**: Testing
- Unit tests (>90% coverage)
- Render tests (10+ cases)
- Integration tests
- Fix bugs

**Week 5**: Documentation & PR
- Developer guide
- Example page
- API documentation
- Create draft PR, request review

**Deliverable**: Complete Equal Earth implementation ready for merge

### Phase 2: Natural Earth I Projection (Weeks 6-8)

**Week 6**: Implementation
- Reuse Equal Earth patterns
- Focus on different math (polynomial approximation)

**Week 7**: Testing
- Full test suite
- Verify inverse projection accuracy

**Week 8**: Documentation & PR
- Complete docs and examples
- Submit PR

**Deliverable**: Complete Natural Earth implementation ready for merge

### Phase 3: IxMaps Custom Projection (Weeks 9-10)

**Week 9**: Implementation
- Document IxMaps coordinate system
- Implement following proven pattern

**Week 10**: Testing, docs, PR
- Full test suite
- Custom projection guide for community
- Submit PR

**Deliverable**: IxMaps projection + framework for community contributions

---

## File-by-File Change Summary

### New Files (Per Projection)

| File Path | Purpose | Lines | Complexity |
|-----------|---------|-------|-----------|
| `src/geo/projection/{name}.ts` | Main projection class | 150-200 | Medium |
| `src/geo/projection/{name}_transform.ts` | Coordinate transforms | 300-400 | High |
| `src/geo/projection/{name}_camera_helper.ts` | Camera/interaction | 200-300 | Medium |
| `src/geo/projection/{name}_utils.ts` | Helper functions | 50-100 | Low |
| `src/shaders/_projection_{name}.vertex.glsl` | GPU projection | 100-150 | Medium |
| `src/geo/projection/{name}.test.ts` | Unit tests | 100-200 | Medium |
| `src/geo/projection/{name}_transform.test.ts` | Transform tests | 50-100 | Medium |
| `test/integration/render/{name}/*.json` | Render tests | N/A | Medium |
| `test/examples/{name}-*.html` | Example pages | 50-100 | Low |
| `developer-guides/{name}-projection.md` | Documentation | N/A | Low |

**Total per projection**: ~900-1,350 lines + test files + documentation

### Modified Files (Shared)

| File Path | Modification | Lines | Complexity |
|-----------|-------------|-------|-----------|
| `src/geo/projection/projection_factory.ts` | Add case to switch | ~10 | Trivial |
| `src/render/subdivision.ts` | Add subdivision logic | ~20 | Low |
| `src/render/painter.ts` | Handle new projection | ~20 | Low |
| Individual layer files | Ensure compatibility | ~5 each | Low |

**Total modifications**: ~100-200 lines across all projections

---

## Success Criteria

### Equal Earth Projection

**Technical Requirements**:
- [ ] All 7 core files implemented
- [ ] Unit tests achieve >90% coverage
- [ ] 10+ render tests pass
- [ ] Performance within 10% of Globe
- [ ] No regressions in existing projections

**Documentation Requirements**:
- [ ] API documentation complete
- [ ] Developer guide written
- [ ] Example page functional
- [ ] Code comments comprehensive

**Community Requirements**:
- [ ] RFC posted and feedback received
- [ ] PR approved by 2+ maintainers
- [ ] PR merged to main branch
- [ ] No critical bugs in first month

### Natural Earth I Projection

- [ ] Same technical requirements as Equal Earth
- [ ] Polynomial approximation verified
- [ ] Inverse projection accuracy tested

### IxMaps Custom Projection

- [ ] Same technical requirements
- [ ] Custom coordinate system documented
- [ ] Projection math derived and validated

### Overall Project Success

**Metrics**:
1. **Code Quality**: All tests pass, zero regressions
2. **Performance**: <10% overhead vs Mercator baseline
3. **Community Reception**: Positive feedback in discussions
4. **Adoption**: 3+ community examples within 3 months post-merge
5. **Maintainability**: Zero critical bugs in first 6 months
6. **Documentation**: <5 "how do I use this?" questions
7. **Contribution**: Becomes reference for future projection additions

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GLSL precision issues | Medium | High | Implement error correction like Globe |
| Performance degradation | Medium | Medium | Benchmark early, optimize shaders |
| Tile seam artifacts | High | Medium | Careful subdivision alignment |
| Symbol placement errors | Medium | Low | Reuse existing symbol logic |
| Browser compatibility | Low | Medium | Test on multiple browsers/GPUs |
| Maintenance burden | Low | Medium | Comprehensive docs and tests |

### Community/Process Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PR rejection | Low | High | Engage early with RFC |
| Scope creep | Medium | Medium | Define v1 scope clearly |
| Slow review | Medium | Low | Patient engagement, clear docs |
| Breaking changes needed | Low | High | Design for backward compatibility |
| Approach disagreement | Low | Medium | Justify with data/examples |

### Mitigation Strategies

**Before Starting**:
1. Post RFC and get maintainer buy-in
2. Clarify scope and deliverables
3. Study Globe implementation thoroughly

**During Development**:
1. Create draft PR early (week 2-3)
2. Post progress updates weekly
3. Respond to feedback promptly
4. Keep PR description current

**If Issues Arise**:
1. Be willing to pivot based on maintainer guidance
2. Ask clarifying questions
3. Provide benchmarks/data
4. Consider breaking PR into smaller pieces

---

## Key Resources

### MapLibre Resources

- **Repository**: https://github.com/maplibre/maplibre-gl-js
- **Contributing Guide**: https://github.com/maplibre/maplibre-gl-js/blob/main/CONTRIBUTING.md
- **Developer Guides**: https://github.com/maplibre/maplibre-gl-js/tree/main/developer-guides
- **Globe Guide**: https://github.com/maplibre/maplibre-gl-js/blob/main/developer-guides/globe.md
- **Slack**: https://slack.openstreetmap.us/ (#maplibre channel)
- **Discussions**: https://github.com/maplibre/maplibre/discussions

### Key Issues & PRs

- **Issue #168**: Support rendering in multiple CRS
  - https://github.com/maplibre/maplibre-gl-js/issues/168
  - 48 👍 reactions, active discussion

- **Issue #272**: Bounty Direction: Custom Coordinate System
  - https://github.com/maplibre/maplibre/issues/272
  - Tracking issue for community funding

- **Discussion #163**: Custom coordinate system / EPSG / non-Mercator tiles
  - https://github.com/maplibre/maplibre/discussions/163
  - Technical discussion with maintainers

- **PR #3963**: Globe final PR
  - https://github.com/maplibre/maplibre-gl-js/pull/3963
  - Our implementation blueprint

### Projection Math References

**Equal Earth**:
- D3-geo: https://github.com/d3/d3-geo/blob/main/src/projection/equalEarth.js
- Paper: Šavrič et al. (2018) - The Equal Earth map projection
- Existing plugin: https://github.com/pka/maplibre-gl-equal-earth

**Natural Earth**:
- D3-geo: https://github.com/d3/d3-geo/blob/main/src/projection/naturalEarth1.js
- PROJ: https://proj.org/operations/projections/natearth.html

**General**:
- PROJ documentation: https://proj.org/
- USGS Professional Paper 1395: Map Projections - A Working Manual
- D3-geo documentation: https://github.com/d3/d3-geo

### Technical References

- **WebGL Fundamentals**: https://webglfundamentals.org/
- **GLSL Reference**: https://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf
- **Shader Precision**: https://webglfundamentals.org/webgl/lessons/webgl-precision-issues.html

---

## Next Steps (Immediate Actions)

### Week 1: Setup & Planning

1. **Fork Repository** ✓
   - Via GitHub UI: https://github.com/maplibre/maplibre-gl-js
   - Clone locally

2. **Setup Development Environment**
   ```bash
   cd maplibre-gl-js
   npm install
   npm run codegen
   npm run build-dev
   npm start  # Verify build works
   ```

3. **Post RFC in GitHub Discussions**
   - Draft RFC based on architecture document
   - Post at: https://github.com/maplibre/maplibre/discussions
   - Tag @HarelM, @wipfli, @kylebarron
   - Wait for feedback (at least 2 maintainer approvals)

4. **Create Feature Branch**
   ```bash
   git checkout -b feat/equal-earth-projection
   ```

5. **Study Globe Implementation**
   - Read `developer-guides/globe.md`
   - Review PR #3963 changes
   - Understand subdivision system
   - Note shader patterns

### Week 2+: Implementation

6. **Begin Equal Earth Implementation**
   - Only start after RFC approval
   - Follow roadmap step-by-step
   - Create draft PR early
   - Post weekly progress updates

---

## Conclusion

**Feasibility**: HIGH - MapLibre has a proven, extensible projection system

**Complexity**: MEDIUM - Following Globe pattern significantly reduces risk

**Community Support**: STRONG - Active demand with 48+ reactions on issue #168

**Timeline**: 7-10 weeks for complete implementation of 3 projections

**Value**: HIGH - Addresses long-standing community need, demonstrates MapLibre's extensibility

**Recommendation**: PROCEED with incremental PR approach, starting with Equal Earth

This is a significant but achievable contribution that will:
1. Benefit the MapLibre ecosystem
2. Enable educational/scientific use cases
3. Establish pattern for future community projections
4. Showcase IxWiki's technical capabilities

**The architecture is sound, the math is well-documented, the blueprint (Globe) exists, and the community is ready. Time to build.**

---

## Deliverables Summary

Three comprehensive documents created:

1. **MAPLIBRE_PROJECTION_ARCHITECTURE.md** (13,500+ words)
   - Complete architectural analysis
   - Projection system internals
   - Globe implementation study
   - Mathematical foundations
   - Technical challenges and solutions

2. **MAPLIBRE_IMPLEMENTATION_ROADMAP.md** (8,500+ words)
   - Week-by-week implementation plan
   - Complete code templates for all files
   - Testing specifications
   - Documentation templates
   - Success criteria

3. **MAPLIBRE_PROJECT_SUMMARY.md** (This document)
   - Executive summary
   - Key findings
   - Risk assessment
   - Community engagement strategy
   - Immediate action items

**Total Documentation**: 22,000+ words covering every aspect of the project

**Status**: Ready for RFC posting and implementation

---

**Document Version**: 1.0
**Last Updated**: October 31, 2025
**Author**: IxWiki Development Team
**Next Review**: After RFC feedback received
