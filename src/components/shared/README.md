# Shared Component Library

**Last updated:** October 2025

`src/components/shared` contains reusable UI primitives shared across dashboards, builder flows, and admin tooling.

## Structure
| Directory | Description |
| --- | --- |
| `data-display/` | Metric cards, tables, charts, and summary widgets |
| `forms/` | Validated inputs, sliders, selectors, and form utilities |
| `feedback/` | Loading skeletons, error states, empty-state illustrations |
| `layouts/` | Panels, section wrappers, and layout scaffolding |
| `InterfaceSwitcher.tsx` | Runtime toggle used by developer tooling |
| `index.ts` | Barrel exports |

## Usage Guidelines
- Prefer shared components over feature-specific duplicates to maintain styling consistency
- Most components accept theme props (glass hierarchy, accent colour) – follow existing patterns
- Keep accessibility in mind (ARIA labels, keyboard support) when introducing new primitives
- Update documentation (`docs/architecture/frontend.md`) if adding major component families

## Maintenance
- Add tests for new form validation or data-display logic where practical
- When refactoring a feature area, migrate bespoke components into this library when they become generic enough
- Document breaking changes in pull requests and update import paths across the codebase
