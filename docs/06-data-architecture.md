# VALORANT ANALYTICS STUDIO

# DATA ARCHITECTURE

Version: 1.0
Status: Frozen
Priority: Critical

---

# Purpose

This document defines how data is collected, processed, stored, and consumed throughout the platform.

The platform never predicts directly from API responses.

Every prediction is generated from validated, normalized, and engineered features.

---

# Data Philosophy

The data architecture follows five principles.

1.

Raw data is immutable.

2.

Every transformation is reproducible.

3.

No duplicated sources of truth.

4.

Every prediction is traceable back to raw data.

5.

Feature generation must be deterministic.

---

# Data Flow

VLRDevAPI

↓

Collector

↓

Raw Storage

↓

Normalizer

↓

Analytics Pipeline

↓

Feature Store

↓

Competitive Intelligence Engine

↓

Prediction API

↓

Frontend

---

# Data Sources

Current Version

• VLRDevAPI

Future

• Riot Official API (if available)

• Manual Patch Database

• Tournament Metadata

• Community Rating Dataset

The architecture must support multiple providers without changing downstream services.

---

# Layer 1 — Raw Storage

Purpose

Store every API response exactly as received.

Characteristics

• Append-only

• Immutable

• JSON format

• Timestamped

• Versioned

Examples

Match Response

Tournament Response

Team Response

Map Response

Player Response

No calculations are performed at this stage.

---

# Layer 2 — Normalized Database

Purpose

Convert raw API responses into a consistent internal schema.

Responsibilities

Standardize names

Resolve duplicated entities

Convert timestamps

Assign internal identifiers

Validate required fields

Examples

"Gen.G Esports"

↓

"GEN.G"

All downstream systems consume normalized data only.

---

# Layer 3 — Analytics Warehouse

Purpose

Store precomputed statistics.

Examples

Map Win Rate

Round Differential

Attack Success Rate

Defense Success Rate

Recent Form

Head-to-Head

Economy Rating

Average ACS

Everything inside this layer is generated automatically.

No frontend request should trigger heavy analytical computation.

---

# Layer 4 — Feature Store

Purpose

Provide machine-learning-ready features.

Features are generated from analytics.

Examples

Weighted Momentum

Opponent Strength

Consistency Score

Map Confidence

Pressure Rating

Recent Improvement

Tournament Experience

Feature Store never contains raw statistics.

Only processed competitive knowledge.

---

# Layer 5 — Prediction Cache

Purpose

Reduce response latency.

Cache stores

Prediction Result

Simulation Result

Confidence Score

Generated Explanation

Cache expires after

Nightly updates

Feature updates

Model version changes

---

# Data Refresh Strategy

Nightly Pipeline

Step 1

Fetch latest matches.

↓

Step 2

Validate responses.

↓

Step 3

Store raw data.

↓

Step 4

Normalize.

↓

Step 5

Generate analytics.

↓

Step 6

Generate features.

↓

Step 7

Generate Team DNA.

↓

Step 8

Invalidate prediction cache.

↓

Finished.

---

# Historical Integrity

Historical data must never be deleted.

Historical statistics must always be reproducible.

Replay Prediction must use historical snapshots instead of current data.

Every prediction should be reproducible years later.

---

# Data Validation

Every imported record must pass validation.

Checks include

Missing fields

Duplicate IDs

Invalid timestamps

Unknown teams

Invalid maps

Broken relationships

Invalid records are quarantined.

They are never used for analytics.

---

# Data Versioning

Every dataset has a version.

Example

Dataset Version

Feature Version

Prediction Engine Version

Model Version

Replay Prediction always references the correct versions.

---

# Traceability

Every prediction must answer

Which features were used?

↓

Which analytics produced them?

↓

Which raw matches generated those analytics?

No prediction should ever become a black box.

---

# Data Ownership

Collector

Owns Raw Storage.

Normalizer

Owns Normalized Database.

Analytics Engine

Owns Analytics Warehouse.

Feature Engine

Owns Feature Store.

Competitive Intelligence Engine

Consumes Feature Store.

Frontend

Consumes Prediction API only.

---

# Performance Goals

Nightly Update

< 10 minutes

Prediction Response

< 300 ms

Feature Loading

< 50 ms

Analytics Lookup

< 20 ms

Prediction Cache Hit Rate

> 90%

---

# Engineering Rules

Never overwrite raw data.

Never calculate heavy analytics inside API requests.

Never expose raw API responses to the frontend.

Never duplicate statistics across layers.

Always generate predictions from Feature Store.

Always maintain full traceability.

