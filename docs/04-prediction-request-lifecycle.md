# VALORANT ANALYTICS STUDIO

# PREDICTION REQUEST LIFECYCLE

Version: 2.0
Status: Frozen
Priority: Critical

---

# Purpose

This document describes how a user's prediction request travels through the platform.

Unlike the Prediction Engine document, which defines how predictions are calculated, this document defines how the entire system processes, validates, executes, and returns prediction requests.

---

# Scope

This document begins when the user presses "Predict".

It ends when the prediction is rendered on screen.

The internal prediction logic is defined separately in:

08-prediction-engine.md

---

# High-Level Lifecycle

User Request

↓

Frontend Validation

↓

API Request

↓

Request Validation

↓

Scenario Construction

↓

Prediction Engine

↓

Response Construction

↓

Frontend Rendering

↓

User Interaction

---

# Stage 1

User Request

The user configures a prediction.

Possible inputs include:

- Team A
- Team B
- BO3 / BO5
- Selected Maps
- Feature Weights
- Scenario Mode

The frontend creates a Prediction Request.

---

# Stage 2

Frontend Validation

Before contacting the backend the frontend validates:

Required teams selected

Valid tournament

No duplicated maps

Valid series length

Allowed feature ranges

Invalid requests never reach the backend.

---

# Stage 3

API Request

Frontend sends

POST /prediction

Payload

Prediction Request

Scenario Configuration

Client Version

Timestamp

Request ID

---

# Stage 4

Backend Validation

Backend validates

Request schema

Existing teams

Supported maps

Scenario integrity

Feature ranges

Business rules

If validation fails

↓

Return Validation Error

---

# Stage 5

Scenario Construction

The backend converts user inputs into a Scenario object.

Example

Prediction Request

↓

Scenario

↓

Prediction Engine

Scenario is immutable.

The Prediction Engine never reads frontend objects directly.

---

# Stage 6

Prediction Execution

Prediction Engine begins execution.

Internal logic is defined in:

08-prediction-engine.md

Outputs include

Probability

Confidence

Trust Score

Explanation

Feature Contributions

Warnings

---

# Stage 7

Response Construction

Backend assembles a Prediction Response.

Prediction Response contains

Prediction Summary

Probability

Confidence

Trust Score

Explanation

Scenario Summary

Metadata

Warnings

Execution Time

Prediction Version

No frontend formatting occurs here.

---

# Stage 8

Frontend Rendering

Frontend receives the response.

Responsibilities

Render probability

Animate charts

Display explanation

Render confidence

Display warnings

Show feature importance

Present Team DNA

The frontend never calculates predictions.

---

# Stage 9

Interactive Learning Loop

After rendering, the prediction remains interactive.

Users may modify

Maps

Series

Weights

Scenario

Each modification creates a completely new Prediction Request.

Previous predictions remain unchanged.

---

# Request Lifecycle Principles

Prediction requests are stateless.

Every request is independent.

Every prediction is reproducible.

Prediction results are immutable.

Scenarios are explicit.

Business logic belongs only to backend services.

---

# Error Handling

Validation Error

↓

Return User Message

↓

No Prediction

--------------------------------

Prediction Failure

↓

Graceful Recovery

↓

Fallback Response

↓

Reduced Confidence

↓

Warning Display

--------------------------------

Partial Feature Failure

↓

Disable Feature

↓

Continue Prediction

↓

Lower Trust Score

---

# Performance Targets

Frontend Validation

< 20 ms

API Validation

< 30 ms

Prediction Engine

< 200 ms

Response Construction

< 30 ms

Frontend Rendering

< 100 ms

Target End-to-End

< 350 ms

---

# Definition of Success

A prediction request succeeds when

- the request is valid,
- the prediction is completed,
- uncertainty is communicated,
- explanations are generated,
- the response is rendered without ambiguity,
- the user is encouraged to continue exploring.

The lifecycle is complete only when the user receives both a prediction and the information necessary to understand it.


