# Prediction Engine

Version: 1.0

Status: LOCKED

---

# Purpose

Prediction Engine is the reasoning system behind the platform.

It converts competitive match data into explainable predictions rather than simply producing probabilities.

The engine should never feel like a black box.

Every prediction must be supported by understandable evidence.

---

# Product Goal

Users should trust the prediction.

Instead of displaying:

"Team A has a 67% chance to win."

the platform should answer:

"Team A has a 67% chance to win because..."

Prediction without explanation provides little value.

Explanation is considered part of the prediction itself.

---

# Core Philosophy

Prediction Engine is not an AI model.

Prediction Engine is a decision system.

Machine learning is only one possible implementation.

The product should always separate:

Data

↓

Features

↓

Reasoning

↓

Prediction

↓

Explanation

The user should only experience the final reasoning.

---

# Inputs

The engine consumes structured match information.

Examples include:

- Team statistics
- Player statistics
- Map information
- Recent performance
- Team composition
- Historical matches
- Tournament context
- Economy patterns

Raw statistics are never exposed directly to users.

---

# Feature Extraction

Raw statistics are transformed into higher-level concepts.

Examples:

Entry Success

↓

Aggression

Utility Usage

↓

Utility Efficiency

Economy History

↓

Economy Discipline

Recent Results

↓

Momentum

These abstractions make the platform easier to understand.

---

# Prediction Pipeline

The engine follows a deterministic pipeline.

Step 1

Collect data.

↓

Step 2

Validate data.

↓

Step 3

Generate behavioral features.

↓

Step 4

Calculate Team DNA.

↓

Step 5

Compare Match DNA.

↓

Step 6

Estimate probabilities.

↓

Step 7

Generate explanations.

↓

Step 8

Return prediction.

---

# Outputs

Every prediction includes:

Win Probability

Confidence Score

Top Influencing Factors

Key Advantages

Key Weaknesses

Supporting Evidence

Users should never receive only a percentage.

---

# Confidence Score

Prediction confidence is different from win probability.

Example:

Win Probability

67%

Confidence

91%

A close match can still have high confidence.

An uncertain prediction can produce low confidence even if one team appears favored.

---

# Explainability

Every prediction should answer:

Why?

What changed?

Which factors mattered most?

Which assumptions were made?

The engine should avoid hidden reasoning.

---

# Error Handling

If insufficient data exists:

The platform should communicate uncertainty rather than invent information.

Possible responses include:

- Insufficient recent matches
- Limited player history
- Low confidence prediction

Honesty is preferred over certainty.

---

# Future Extensions

Future versions may include:

Live match prediction

Round-by-round prediction

Agent-level prediction

Economy simulation

Meta adaptation

These are outside Version 1.


