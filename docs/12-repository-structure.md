# Naming Convention

A consistent naming convention improves readability, reduces ambiguity, and makes the repository easier to navigate.

Every file and directory should follow predictable naming rules.

Developers should be able to infer a file's purpose from its name alone.

---

## Components

React components should use PascalCase.

Examples:

- PredictionCard.tsx
- TeamDNA.tsx
- MatchComparisonChart.tsx
- ConfidenceIndicator.tsx

Component names should describe what they represent rather than how they are implemented.

---

## Hooks

Custom hooks should always begin with `use`.

Examples:

- usePrediction.ts
- useMatchData.ts
- useTheme.ts
- useAnimation.ts

Each hook should have a single responsibility.

---

## Services

Business logic should reside inside services.

Use descriptive names ending with `.service.ts`.

Examples:

- prediction.service.ts
- match.service.ts
- team.service.ts

Services should remain independent from the user interface whenever possible.

---

## Utilities

Utility files should describe their purpose clearly.

Examples:

- formatPercentage.ts
- calculateMomentum.ts
- validatePrediction.ts

Avoid generic names such as:

- utils.ts
- helper.ts
- common.ts

Generic files become difficult to maintain as the project grows.

---

## Types

Shared TypeScript definitions should be centralized.

Examples:

- prediction.types.ts
- match.types.ts
- api.types.ts

Type names should represent domain concepts rather than implementation details.

---

## Constants

Constant files should group related values.

Examples:

- colors.ts
- routes.ts
- animations.ts
- breakpoints.ts

Constants should remain immutable.

---

## Assets

Asset names should be lowercase and use hyphens.

Examples:

- hero-background.webp
- team-logo-fnatic.png
- prediction-icon.svg

Avoid spaces and inconsistent capitalization.

---

## Folder Naming

Folders should use lowercase letters.

Words should be separated using hyphens.

Examples:

- prediction-engine
- shared-components
- match-analysis

Avoid:

- PredictionEngine
- prediction_engine
- Prediction-Engine

Consistency is more important than personal preference.

---

## General Principles

Every name should satisfy three requirements.

It should be:

- descriptive
- consistent
- predictable

If another developer cannot understand a file's purpose from its name,

the name should be reconsidered.


