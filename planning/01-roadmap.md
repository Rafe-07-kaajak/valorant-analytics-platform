# Roadmap

## Purpose

This roadmap translates the product specification into an implementation plan.

The documents inside `/docs` define **what** the platform must become.

This roadmap defines **when** and **in what order** those capabilities will be built.

This document never overrides the specification inside `/docs`.

---

# Current Project Status

| Phase | Status |
|--------|--------|
| Documentation | ✅ Completed |
| Repository Foundation | ✅ Completed |
| Development | ⏳ Not Started |

---

# Phase 1 — Documentation (Completed)

## Objective

Freeze the product specification before implementation begins.

## Deliverables

- Product vision
- Architecture
- Domain model
- Data architecture
- Prediction pipeline
- UX specification
- Quality checklist

## Exit Criteria

- All documentation reviewed
- Documentation frozen
- CLAUDE.md completed

---

# Phase 2 — Repository Foundation (Completed)

## Objective

Prepare a scalable development environment.

## Deliverables

- Turborepo
- pnpm workspace
- Next.js application
- Shared packages
- Repository structure
- Task system
- Planning system

## Exit Criteria

- Repository runs locally
- Claude understands project structure
- Documentation synchronized

---

# Phase 3 — Frontend Foundation

## Objective

Build the reusable frontend foundation used by every future feature.

## Deliverables

- Design tokens
- Theme
- Typography
- Layout system
- Navigation
- Shared UI components
- Responsive framework
- Animation foundation

## Exit Criteria

- Every page shares the same design system
- No duplicated UI implementation
- Components are reusable

---

# Phase 4 — Landing Experience

## Objective

Create the public-facing landing experience.

## Deliverables

- Hero section
- Product introduction
- Feature overview
- Prediction Studio preview
- Match DNA preview
- Call to action
- Responsive landing page

## Exit Criteria

- Landing is production quality
- Responsive on all supported devices
- Performance targets satisfied

---

# Phase 5 — Prediction Studio MVP

## Objective

Build the core product experience.

## Deliverables

- Prediction Studio
- Team selection
- Map selection
- Scenario Builder
- Prediction request flow
- Result presentation

## Exit Criteria

- User can generate a prediction
- Prediction flow is complete
- UI follows documentation

---

# Phase 6 — Analytics Experience

## Objective

Deliver explainable predictions.

## Deliverables

- Match DNA
- Team DNA
- Statistical comparison
- Confidence indicators
- Explanation panels
- Interactive visualization

## Exit Criteria

- Every prediction has explanations
- Match DNA fully operational
- Analytics are interactive

---

# Phase 7 — Data Integration

## Objective

Connect the frontend with the real backend.

## Deliverables

- API integration
- Data fetching
- Loading states
- Error handling
- Cache layer

## Exit Criteria

- Live professional match data
- Stable API communication
- Reliable error recovery

---

# Phase 8 — Prediction Engine

## Objective

Integrate the prediction engine into the application.

## Deliverables

- Prediction service
- Feature Platform integration
- Scenario processing
- Confidence calculation
- Explanation generation

## Exit Criteria

- Predictions generated successfully
- Results reproducible
- Performance targets satisfied

---

# Phase 9 — Production Readiness

## Objective

Prepare the platform for deployment.

## Deliverables

- Performance optimization
- Accessibility improvements
- SEO
- Testing
- Bug fixes
- Documentation review

## Exit Criteria

- Production checklist completed
- Lighthouse targets achieved
- Stable release candidate

---

# Phase 10 — Public Release

## Objective

Deploy Version 1 of the Valorant Analytics Platform.

## Deliverables

- Production deployment
- Monitoring
- Analytics
- Release documentation

## Exit Criteria

- Public website online
- Stable production environment
- Ready for Version 2 planning

---

# Principles

Every phase must satisfy the following rules:

- Documentation first.
- One completed phase before the next.
- No implementation without specification.
- Reuse before creating new components.
- Every feature must remain explainable.
- Quality is more important than speed.

---

# Success Definition

Version 1 is considered complete when:

- Users can create professional VALORANT match predictions.
- Every prediction is explainable.
- Match DNA is available.
- Prediction Studio is production-ready.
- The platform satisfies all quality requirements defined in `/docs`.