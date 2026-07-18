# CodeMRI – Master Project Specification

## Mission

Build a production-quality AI-powered repository analysis platform called **CodeMRI**.

The goal is to help developers understand any software repository the same way a doctor understands a patient's MRI.

The application must not simply display metrics. It must analyze, reason about, explain, prioritize, and recommend improvements using AI.

The final product should feel like GitHub + SonarQube + Linear + OpenAI combined into one modern developer experience.

---

# Product Philosophy

Every feature must answer these questions:

- What is wrong?
- Why is it wrong?
- Which files are responsible?
- What happens if nothing changes?
- What is the highest impact fix?
- Can AI automatically generate the fix?

Never build features that only display data.

Always explain.

Always reason.

Always provide evidence.

---

# Core Features

1. Repository Import
2. Repository Cloning
3. Static Code Analysis
4. AST Analysis
5. Dependency Graph Generation
6. Repository Embeddings
7. AI Repository Understanding
8. AI Engineering Report
9. Interactive Dashboard
10. Repository Chat
11. Architecture Visualization
12. Engineering Metrics
13. AI Recommendations
14. Export Report

---

# Supported Languages (MVP)

- TypeScript
- JavaScript

Architecture must allow adding

- Python
- Go
- Java
- Rust

without redesign.

---

# Repository Pipeline

Repository

↓

Clone Repository

↓

Detect Languages

↓

Parse AST

↓

Extract Symbols

↓

Extract Imports

↓

Build Dependency Graph

↓

Compute Engineering Metrics

↓

Generate Embeddings

↓

Run AI Analysis

↓

Generate Reports

↓

Store Results

↓

Dashboard

---

# Engineering Metrics

Implement these metrics:

Overall Health

Maintainability

Technical Debt

Architecture Integrity

Performance Risk

Security Exposure

Code Complexity

Test Confidence

Dependency Health

Production Readiness

Each metric must include

- numerical score
- severity
- explanation
- affected files
- confidence
- suggested improvements
- estimated engineering effort

---

# AI Responsibilities

AI must never invent repository information.

AI only reasons from extracted repository context.

AI should receive structured JSON input.

AI should return structured JSON output.

Never return markdown from AI internally.

Only convert to markdown in the frontend.

---

# Dashboard

Repository Overview

Engineering Score

Architecture

Dependency Graph

Hot Files

Critical Risks

Recommendations

Repository Chat

Trend Analysis

---

# Repository Chat

The AI should answer questions such as

Why is authentication difficult?

Which module should be refactored first?

Which file has the highest technical debt?

Explain the payment flow.

Show architecture.

Find performance bottlenecks.

Explain the dependency graph.

Summarize this repository.

---

# User Experience

Scanning should happen asynchronously.

Users should always see progress.

Scanning should continue after refresh.

Every scan must be resumable.

Users can leave and come back.

---

# Queue System

Every stage is an isolated job.

Clone

↓

Parse

↓

Graph

↓

Metrics

↓

Embeddings

↓

AI

↓

Reports

↓

Completed

Retry each stage independently.

---

# Architecture Principles

Event Driven

Modular

Stateless Workers

Type Safe

Scalable

Observable

Fault Tolerant

Production Ready

---

# Code Quality

Strict TypeScript

No any

ESLint

Prettier

Reusable Components

Repository Pattern

Dependency Injection where appropriate

Well documented code

Small functions

Meaningful names

---

# Frontend

Next.js App Router

React

Tailwind CSS

shadcn/ui

React Flow

Framer Motion

Zustand

TanStack Query

Responsive Design

Accessible Components

Dark Mode

---

# Backend

Node.js

Next.js Route Handlers (or express using bunjs if architecture benefits)

PostgreSQL

Redis

BullMQ

Prisma ORM

GitHub API

Tree-sitter

ts-morph

OpenAI Responses API

---

# Infrastructure

Docker

Vercel

Supabase or Neon

Upstash Redis

Object Storage

Environment Variables

Logging

Monitoring

Health Checks

---

# Security

Never expose secrets.

Validate all inputs.

Rate limit APIs.

Secure GitHub tokens.

Sanitize repository paths.

Protect against prompt injection.

Limit AI context.

---

# Performance

Incremental scanning.

Hash files.

Skip unchanged files.

Cache embeddings.

Parallel workers.

Streaming responses.

Lazy loading.

---

# Deliverables

Production-quality code.

Professional folder structure.

Clean architecture.

Reusable packages.

Comprehensive documentation.

Readable code.

Zero placeholder implementations.

Every feature should feel polished.
