# VALORANT ANALYTICS STUDIO

# SYSTEM ARCHITECTURE

Version: 1.0
Status: Frozen
Priority: Critical

---

# Purpose

This document defines the complete software architecture of the platform.

It specifies

• Services
• Data Flow
• Responsibilities
• System Boundaries
• Internal Communication

This document does NOT specify implementation details.

---

# High-Level Architecture

                    VLRDevAPI
                        │
                        ▼
                Data Collector
                        │
                        ▼
                Raw Data Storage
                        │
                        ▼
               Data Processing Pipeline
                        │
                        ▼
              Analytics Database
                        │
                        ▼
              Feature Engineering
                        │
                        ▼
              Prediction Engine
                        │
                        ▼
                Backend API
                        │
                        ▼
                  Next.js Frontend
                        │
                        ▼
                      User

---

# Core Services

The system consists of six major services.

1.

Data Collector

Responsible for synchronizing professional match data.

Runs automatically.

Never accessed by users.

---

2.

Analytics Engine

Calculates all derived statistics.

Examples

Map Win Rate

Recent Form

Head-to-head

Round Differential

Team DNA metrics

This service updates precomputed tables.

---

3.

Prediction Engine

Receives a scenario.

Produces

Win Probability

Confidence

Expected Score

Feature Contributions

Monte Carlo Results

Replay Prediction

No visualization logic.

Only prediction logic.

---

4.

Backend API

Acts as the communication layer.

Never performs expensive calculations.

Simply orchestrates

Database

Prediction Engine

Analytics Engine

Cache

---

5.

Frontend

Responsible for

User interaction

Visualization

Animations

Charts

Scenario Builder

Never performs prediction.

Never accesses database directly.

---

6.

Database

Single source of truth.

Stores

Raw Matches

Processed Statistics

Aggregated Features

Prediction Cache

Replay Data

Team DNA Metrics

---

# Responsibility Separation

Collector

↓

Collect

Analytics Engine

↓

Calculate

Prediction Engine

↓

Predict

Backend

↓

Serve

Frontend

↓

Present

Every service has exactly one responsibility.

---

# Prediction Workflow

User modifies scenario

↓

Frontend sends request

↓

Backend validates request

↓

Prediction Engine calculates

↓

Analytics Engine provides features

↓

Prediction returned

↓

Frontend updates UI

↓

Animation plays

Entire workflow target

<300 milliseconds

---

# Data Synchronization

Nightly Update

Every 24 hours

↓

Fetch latest matches

↓

Validate

↓

Store raw data

↓

Update derived statistics

↓

Update Team DNA

↓

Update prediction cache

↓

Complete

Prediction should never depend on live API requests.

---

# Data Layers

Layer 1

Raw Data

Original API responses.

Never modified.

---

Layer 2

Normalized Data

Converted into platform format.

---

Layer 3

Derived Features

Calculated statistics.

---

Layer 4

Prediction Features

Optimized for inference.

---

Layer 5

Presentation Layer

Human-readable data.

Used by frontend.

---

# Team DNA Pipeline

Raw Match Data

↓

Feature Extraction

↓

Behavior Metrics

↓

Derived Indicators

↓

DNA Generation

↓

Narrative Summary

↓

Frontend

The Team DNA system never uses manual descriptions.

Everything must originate from measurable statistics.

---

# Explainability Pipeline

Prediction

↓

Feature Importance

↓

Contribution Analysis

↓

Natural Language Explanation

↓

Frontend

Every prediction must include an explanation.

---

# Replay Prediction

Historical Match

↓

Load only historical data

↓

Generate prediction

↓

Reveal actual result

↓

Compare

↓

Explain

Replay mode must never access future information.

---

# Caching Strategy

Prediction Cache

Scenario Cache

Analytics Cache

Team Cache

Tournament Cache

Cache invalidates automatically after nightly updates.

---

# Performance Goals

Prediction Response

<300 ms

Scenario Update

<150 ms

Page Load

<2 s

Chart Animation

60 FPS

Autocomplete

<100 ms

---

# Error Handling

API unavailable

↓

Serve cached data

Prediction failed

↓

Display explanation

Missing statistics

↓

Gracefully degrade

System errors should never break the interface.

---

# Scalability

Future support

CS2

League of Legends

Dota 2

without redesigning the architecture.

Only new collectors and feature generators should be required.

---

# Engineering Principles

Single Responsibility

Loose Coupling

Reusable Components

Predictable Data Flow

No Business Logic Inside UI

No Heavy Computation Inside API

Database Is The Source Of Truth


