# CodeMRI 🧠🔍

CodeMRI is a production-quality, AI-powered repository intelligence and static analysis platform. It maps a repository's structural DNA to generate navigable engineering reports—explaining what is connected, what is fragile, and highlighting the highest impact fixes. 

The application behaves like **GitHub + SonarQube + Linear + OpenAI** combined into one unified, modern developer experience.

---

## 🚀 Key Features

*   **Repository Analysis Pipeline**: Event-driven cloning, language detection, AST parsing, dependency graph extraction, metric computation, repository embeddings, and AI reasoning.
*   **Engineering Scoreboard**: Tracks and grades system health along 9 dimensions (Maintainability, Technical Debt, Architecture Integrity, Performance Risk, Security Exposure, Code Complexity, Test Confidence, Dependency Health, and Production Readiness).
*   **Redesigned Glassmorphic Home Page**: Implements high-end visual design primitives like floating glass navigation blocks, glowing radial backgrounds, CSS dotted mesh overlays, circular SVG gauges, and connected flowchart timelines.
*   **Terminal-Style Analysis Dashboard**: Displays scan progress with active build output log streams, inline monospace code evidence snippets, priority issue cards, and granular confidence bars.
*   **Robust Multi-Browser Rendering**: Scoped CSS variable overrides guarantee identical border rendering and layout consistency across Brave, Chrome, Safari, and other theme settings.

---

## 🛠️ Technology Stack

*   **Frontend**: Next.js App Router (React 19), Tailwind CSS v4, Turbopack, `@tanstack/react-query`, Framer Motion.
*   **Backend & Workers**: Node.js workers, Next.js Route Handlers.
*   **Queue System**: BullMQ backed by Redis for fault-tolerant, resumable, and isolated job stages.
*   **Database & Storage**: PostgreSQL database, Drizzle ORM, Vector store for embeddings.
*   **Tooling**: Prettier, ESLint, TypeScript 5.x.

---

## 📂 Workspace Layout

CodeMRI is managed as a monorepo via `pnpm` workspaces:

*   [`apps/web`](file:///Users/arbab/Desktop/hakton/apps/web) — Next.js web application shell, UI components, and API routes.
*   [`apps/worker`](file:///Users/arbab/Desktop/hakton/apps/worker) — BullMQ worker process foundation orchestrating isolated pipeline stages.
*   [`packages/auth`](file:///Users/arbab/Desktop/hakton/packages/auth) — NextAuth configuration and credentials management.
*   [`packages/config`](file:///Users/arbab/Desktop/hakton/packages/config) — Shared ESLint, Prettier, and TypeScript configuration.
*   [`packages/db`](file:///Users/arbab/Desktop/hakton/packages/db) — Drizzle schema definitions, client connectivity, and migrations.
*   [`packages/queue`](file:///Users/arbab/Desktop/hakton/packages/queue) — BullMQ connection setup and typed queue contracts.
*   [`packages/types`](file:///Users/arbab/Desktop/hakton/packages/types) — Shared API contract types and TypeScript models.
*   [`packages/ui`](file:///Users/arbab/Desktop/hakton/packages/ui) — Shared custom UI component primitives (buttons, inputs, cards).

---

## ⚙️ Architecture & Queue Pipeline

CodeMRI runs scans asynchronously as a sequence of isolated, resumable jobs:

```text
Repository
    │
    ▼
[Clone Repository] ──► [Detect Languages] ──► [Parse AST] ──► [Build Dependency Graph]
                                                                        │
                                                                        ▼
[Completed Report] ◄── [Save Results] ◄── [AI Reasoning] ◄── [Compute Metrics]
```

*   **Event-Driven & Isolated**: Each stage is a separate BullMQ job. If a worker fails, the scan is resumable from the last successful stage.
*   **Structured AI**: The AI reasons from extracted AST structure and dependency JSONs to return schema-validated recommendations.

---

## ⚡ Prerequisites

- **Node.js**: `v22.0.0+`
- **pnpm**: `v10.0.0+`
- **Docker**: For running database and cache services locally.

---

## 🏃 Quick Start

1.  **Configure Environment**:
    ```bash
    cp .env.example .env
    ```
2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```
3.  **Start Services (Postgres & Redis)**:
    ```bash
    docker compose up -d postgres redis
    ```
4.  **Sync Database Schemas**:
    ```bash
    pnpm db:generate
    pnpm db:migrate
    ```
5.  **Run Development Server**:
    ```bash
    pnpm dev
    ```

Open `http://localhost:3000` to view the application. The system health endpoint is exposed at `http://localhost:3000/api/health`.

---

## 🛠️ Useful Commands

-   `pnpm dev` — Starts the web shell and background worker processes in parallel.
-   `pnpm dev:web` — Runs only the Next.js web application.
-   `pnpm build` — Compiles and optimizes all applications and shared packages.
-   `pnpm typecheck` — Checks types across the entire project structure.
-   `pnpm lint` — Runs ESLint across all workspace directories.
-   `pnpm format` — Formats all codebase files with Prettier.
-   `pnpm db:studio` — Opens the Drizzle database management dashboard interface.

---

## 🛡️ Environment Policy

All credentials must be stored locally in `.env` and **never** committed to version control. The application validates environment parameters at startup. Use `SKIP_ENV_VALIDATION=1` only in CI/CD pipeline or build environments.
