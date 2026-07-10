# Component Planning

## Purpose

This document defines the implementation order of reusable components.

Components should always be built once and reused everywhere.

Duplicate implementations are prohibited.

---

# Component Hierarchy

The project is built from the bottom up.

Design Tokens

↓

Primitive Components

↓

Shared Components

↓

Feature Components

↓

Page Components

↓

Layouts

↓

Pages

---

# Sprint 01 — Foundation Components

## Design Tokens

- Color system
- Typography scale
- Spacing scale
- Radius
- Shadows
- Motion variables
- Breakpoints

---

## Primitive Components

- Button
- Icon
- Input
- Label
- Badge
- Avatar
- Divider
- Spinner

---

## Shared Components

- Card
- Container
- Section
- Grid
- Stack
- Flex
- Modal
- Drawer
- Tooltip
- Dialog

---

## Navigation

- Navbar
- Mobile Navigation
- Sidebar
- Footer

---

# Sprint 02 — Landing Components

- Hero
- Hero Background
- Animated Headline
- CTA Buttons
- Feature Cards
- Statistics Section
- Timeline
- FAQ
- Footer CTA

---

# Sprint 03 — Prediction Studio

- Team Selector
- Map Selector
- Match Configuration
- Scenario Builder
- Prediction Form
- Validation Components

---

# Sprint 04 — Prediction Results

- Probability Card
- Confidence Meter
- Prediction Summary
- Explanation Card
- Result Header
- Result Timeline

---

# Sprint 05 — Match DNA

- Match DNA Card
- Team DNA Card
- DNA Radar Chart
- Comparison Table
- Tactical Overview
- Strength Matrix

---

# Sprint 06 — Analytics

- Dashboard Cards
- Trend Charts
- Heatmaps
- Filters
- Comparison Charts
- Tables

---

# Sprint 07 — Backend Integration

- Loading Skeletons
- Error Boundary
- Retry Components
- Empty States
- Toast Notifications

---

# Sprint 08 — Prediction Engine

- Prediction Status
- Processing Indicator
- Confidence Breakdown
- Explanation Viewer

---

# Sprint 09 — Production

- Accessibility Helpers
- Performance Monitor
- Debug Components
- Monitoring Widgets

---

# Component Rules

Every component must:

- Be reusable.
- Be responsive.
- Support dark mode.
- Support accessibility.
- Follow the design system.
- Follow CLAUDE.md.

---

# Naming Convention

Components should use PascalCase.

Examples:

- Button
- PredictionCard
- TeamSelector
- MatchDNAChart
- ScenarioBuilder

---

# Folder Structure

Example:

packages/ui/

components/

Button/

Card/

Modal/

Prediction/

Analytics/

DNA/

charts/

layouts/

---

# Definition of Done

A component is complete only if:

- It is reusable.
- It has no duplicated logic.
- It is documented.
- It follows the design system.
- It passes lint.
- It passes TypeScript.
- It supports responsive layouts.

---

# Future Expansion

Future versions may introduce:

- AI Components
- Admin Components
- Tournament Components
- User Profile Components
- Workspace Components
- Collaboration Components

These should extend the existing system rather than replace it.