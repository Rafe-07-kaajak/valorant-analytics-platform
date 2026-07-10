# VALORANT ANALYTICS STUDIO

# INFORMATION ARCHITECTURE

Version: 1.0
Status: Frozen
Priority: High

---

# Purpose

This document defines the complete structure of the product.

It specifies

• Pages

• Modules

• Navigation

• Component hierarchy

• Information flow

This document does NOT describe implementation.

It only defines how the product is organized.

---

# Product Structure

The platform consists of six primary sections.

1.

Landing

↓

2.

Prediction Studio

↓

3.

Team Profile

↓

4.

Tournament Profile

↓

5.

Replay Prediction

↓

6.

About

Prediction Studio is the primary product.

All other pages support it.

---

# Navigation

────────────────────────

Top Navigation

────────────────────────

Logo

Prediction Studio

Teams

Tournaments

Replay

About

Search

Theme Switch

Github

No dropdown menus.

Navigation should remain simple.

---

# Landing Page

Purpose

Introduce the product.

Generate curiosity.

────────────────────────

Sections

────────────────────────

Hero

↓

Interactive Demo

↓

Why This Product Exists

↓

Core Features

↓

Supported Tournaments

↓

Call To Action

↓

Footer

Landing should contain almost no statistics.

Its purpose is inspiration.

---

# Prediction Studio

Purpose

The core experience.

Everything revolves around this page.

────────────────────────

Layout

────────────────────────

┌───────────────────────────────────────────────┐

Header

├────────────┬────────────────────┬────────────┤

Scenario     Prediction Engine     Analytics

Builder                            Dashboard

├────────────┴────────────────────┴────────────┤

Timeline

└───────────────────────────────────────────────┘

---

# Prediction Studio Modules

Scenario Builder

Prediction Result

Confidence

Explanation

Feature Contribution

Probability Timeline

Monte Carlo

Scenario History

Quick Compare

Everything updates together.

---

# Team Profile

Purpose

Understand one team deeply.

────────────────────────

Sections

────────────────────────

Overview

↓

Team DNA

↓

Roster

↓

Map Pool

↓

Historical Performance

↓

Tournament Results

↓

Recent Matches

↓

Analytics

↓

Prediction History

---

# Team DNA

Dedicated section.

Contains

Identity

Radar Chart

Strengths

Weaknesses

Playstyle

Derived Metrics

Narrative Summary

This section transforms statistics into intuition.

---

# Tournament Page

Purpose

Understand one tournament.

Sections

Overview

↓

Participating Teams

↓

Bracket

↓

Upcoming Matches

↓

Tournament Statistics

↓

Predictions

↓

Historical Winners

---

# Replay Prediction

Purpose

Validate prediction quality.

Users choose

Historical Match

↓

System predicts

↓

Reveal actual result

↓

Compare

↓

Explain differences

Replay should never use future information.

---

# About

Purpose

Explain transparency.

Contains

Mission

Methodology

Prediction Engine

Data Sources

Limitations

Roadmap

Open Source

This page builds trust.

---

# Search

Global search.

Supports

Teams

Players (Future)

Tournaments

Maps (Future)

Results appear instantly.

---

# Component Hierarchy

Application

↓

Layout

↓

Page

↓

Section

↓

Module

↓

Component

↓

Visualization

↓

Interaction

Components should remain reusable.

---

# Shared Components

Team Card

Tournament Card

Prediction Card

Confidence Badge

DNA Card

Chart Card

Scenario Card

Map Badge

Explanation Block

Timeline Card

All pages reuse these components.

---

# Information Flow

User Input

↓

Scenario Builder

↓

Prediction Engine

↓

Analytics Engine

↓

Visualization Layer

↓

Explanation Layer

↓

User

Information always flows downward.

No circular dependencies.

---

# Design Rules

Every page has one primary purpose.

Every section answers one question.

Every component has one responsibility.

No duplicated functionality.

Navigation should always feel obvious.

---

# Product Hierarchy

Landing

↓

Prediction Studio

↓

Team Profile

↓

Tournament Profile

↓

Replay Prediction

↓

About

Everything supports Prediction Studio.

Prediction Studio supports understanding.

Understanding supports the product mission.

