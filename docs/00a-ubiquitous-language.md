# VALORANT ANALYTICS STUDIO

# UBIQUITOUS LANGUAGE

Version: 1.0
Status: Frozen
Priority: Critical

---

# Purpose

This document defines the official vocabulary of the platform.

Every document, API, database schema, frontend component, backend service, and AI model should use the same terminology.

A concept should have exactly one official name.

Consistency is more important than personal preference.

---

# Naming Principles

Each business concept has one official term.

Avoid synonyms.

Avoid abbreviations unless officially defined.

Prefer business language over technical language.

Names should describe meaning rather than implementation.

---

# Core Concepts

## Prediction

Official Definition

The estimated probability of one team defeating another under a specific scenario.

Official Usage

Prediction

Do Not Use

Forecast

Guess

Estimate

Winner Prediction

Match Prediction

---

## Scenario

Official Definition

A collection of user-defined assumptions that influence a prediction.

Examples

Selected Maps

BO3 / BO5

Feature Weights

Future Patch

Roster Changes

Do Not Use

Configuration

Settings

Parameters

Input

---

## Simulation

Official Definition

The execution of the Prediction Engine using a Scenario.

Simulation produces a Prediction.

Do Not Use

Calculation

Execution

Processing

---

## Prediction Engine

Official Definition

The inference component responsible for transforming validated features into predictions.

Responsibilities

Probability

Confidence

Trust Score

Prediction

The Prediction Engine does not perform feature engineering.

---

## AI Pipeline

Official Definition

The complete data preparation pipeline that produces prediction-ready features.

Includes

Cleaning

Normalization

Aggregation

Feature Engineering

Feature Validation

Do Not Use

Prediction Engine

Backend

Analytics

---

## Feature

Official Definition

A measurable competitive signal used by the Prediction Engine.

Examples

Momentum

Map Strength

Consistency

Team DNA

Pressure Rating

---

## Feature Platform

Official Definition

The platform responsible for managing engineered features.

Responsibilities

Registry

Versioning

Validation

Metadata

Monitoring

Serving

Do Not Use

Feature Store

Feature Database

Feature Table

---

## Team DNA

Official Definition

A long-term representation of a team's competitive identity.

Examples

Aggression

Discipline

Consistency

Adaptability

Clutch Performance

Team DNA evolves over time.

---

## Confidence

Official Definition

A measure of prediction reliability.

Confidence reflects model certainty.

It does not indicate data quality.

---

## Trust Score

Official Definition

An assessment of whether users should trust a prediction.

Trust Score considers

Data Quality

Feature Coverage

Pipeline Health

Confidence

Scenario Reliability

Confidence and Trust Score are different concepts.

---

## Explanation

Official Definition

Human-readable reasoning describing why a prediction was generated.

Every prediction should have an explanation.

---

## Analytics

Official Definition

Insights generated from competitive data.

Analytics supports understanding.

Analytics does not perform prediction.

---

## Intelligence

Official Definition

High-level competitive knowledge derived from analytics.

Examples

Team Intelligence

Tournament Intelligence

Meta Intelligence

---

# Official Naming Rules

Frontend

Prediction Studio

Scenario Mode

Team DNA

Feature Importance

Confidence

Trust Score

Explanation

---

Backend

PredictionService

ScenarioService

SimulationService

AnalyticsService

FeaturePlatform

PredictionEngine

AIPipeline

---

API

POST /prediction

GET /teams

GET /team-dna

GET /features

GET /analytics

Avoid inconsistent endpoint naming.

---

Database

prediction

scenario

team

match

feature

prediction_version

feature_version

Use singular nouns unless a specific exception exists.

---

Documentation

Always capitalize official product concepts.

Prediction

Scenario

Simulation

Team DNA

Feature Platform

AI Pipeline

Prediction Engine

---

# Terminology Rules

One concept

↓

One name

One responsibility

↓

One owner

One owner

↓

One document

No synonyms should exist for official concepts.

---

# Definition of Success

The platform succeeds when every engineer, designer, product manager, and AI assistant uses identical terminology.

Shared language reduces ambiguity.

Reduced ambiguity improves software quality.

