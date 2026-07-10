# VALORANT ANALYTICS STUDIO

# DOMAIN MODEL

Version: 2.0
Status: Frozen
Priority: Critical

---

# Purpose

This document defines the business domains of the platform.

It does not describe databases.

It does not describe APIs.

It describes the concepts that exist in the product and how they relate to one another.

Every backend component should respect this domain model.

---

# Domain Philosophy

The platform is not a collection of statistics.

It is a system that transforms competitive data into explainable competitive intelligence.

The architecture should reflect business meaning rather than database structure.

---

# Domain Overview

The system is divided into four domains.

Core Domain

↓

Supporting Domains

↓

Infrastructure Domain

↓

External Systems

The Core Domain receives the highest engineering priority.

---

# Core Domain

The Core Domain contains the features that make this product unique.

These components define the product's competitive advantage.

---

## Prediction

Purpose

Estimate the probability of each team winning a professional match.

Responsibilities

- Generate prediction
- Produce probability
- Trigger simulation
- Produce explanation
- Produce confidence

Owns

- Prediction Result
- Win Probability
- Confidence
- Explanation

---

## Scenario

Purpose

Represent user-controlled assumptions.

Responsibilities

- Selected maps
- BO3 / BO5
- Feature weights
- Match conditions

A Scenario changes the prediction without changing historical data.

---

## Simulation

Purpose

Execute prediction logic under a specific scenario.

Responsibilities

- Load engineered features
- Apply modifiers
- Run prediction engine
- Produce intermediate outputs

Simulation is stateless.

---

## Explanation

Purpose

Transform model outputs into understandable reasoning.

Responsibilities

- Rank feature importance
- Explain prediction
- Generate supporting evidence
- Build trust

The platform should never expose raw model outputs without explanation.

---

# Supporting Domains

Supporting domains enrich the prediction process but do not define the product.

---

## Team DNA

Represents the long-term competitive identity of a professional team.

Examples

- Aggression
- Consistency
- Adaptability
- Clutch Performance
- Map Flexibility

Team DNA evolves over time.

---

## Feature Store

Stores engineered features used by multiple services.

Each feature includes:

- Definition
- Formula
- Version
- Validation
- Owner
- Consumers

The Feature Store serves Prediction, Research, and Analytics.

---

## Analytics

Generates reusable competitive intelligence.

Responsibilities

- Feature importance
- Historical trends
- Correlation
- Distribution
- Team comparisons

Analytics supports both users and internal prediction logic.

---

# Infrastructure Domain

Infrastructure exists to support the business domains.

---

## Data Collection

Collects professional match data.

Responsibilities

- Fetch
- Validate
- Normalize

---

## Data Warehouse

Stores historical competitive data.

Responsibilities

- Historical storage
- Query optimization
- Feature generation

---

## Cache

Provides low-latency access to frequently requested data.

---

## API Layer

Exposes platform capabilities to the frontend.

Business logic should never exist inside controllers.

---

# External Systems

Examples

- Riot API
- vlr.gg
- Liquipedia
- Internal datasets

External systems provide raw information only.

Business meaning is created inside the platform.

---

# Domain Relationships

External Data

↓

Data Collection

↓

Warehouse

↓

Feature Store

↓

Simulation

↓

Prediction

↓

Explanation

↓

Frontend

Analytics operates alongside the Prediction pipeline and continuously enriches future predictions.

---

# Domain Boundaries

Prediction never accesses raw external data directly.

Simulation never modifies historical data.

Explanation never changes prediction outputs.

Feature Store never performs prediction.

Analytics never controls business logic.

Each domain has one clear responsibility.

---

# Engineering Rules

A new feature must belong to exactly one domain.

If ownership is unclear, the domain model should be updated before implementation.

Cross-domain dependencies should remain minimal.

---

# Definition of Success

A developer unfamiliar with the project should be able to understand:

- where a feature belongs,
- who owns it,
- what it is responsible for,
- what it must never do,

simply by reading this document.

If not, the domain model is incomplete.

