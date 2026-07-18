# CodeMRI – System Architecture

# Vision

CodeMRI is an AI-powered repository analysis platform that performs deep static analysis, graph analysis, and LLM reasoning to produce an engineering health report for any GitHub repository.

## High-Level Architecture

```text
                  User
                    │
            Next.js Frontend
                    │
          REST / Server Actions
                    │
               API Gateway
                    │
        ┌───────────┴───────────┐
        │                       │
   Repository Service      Auth Service
        │
        │
     BullMQ Queue
        │
   Analysis Workers
        │
 ┌──────┼─────────────────────────────────────────────┐
 │ Clone Repository                                   │
 │ Parse AST                                          │
 │ Build Dependency Graph                             │
 │ Compute Metrics                                    │
 │ Generate Embeddings                               │
 │ AI Reasoning                                      │
 │ Store Results                                     │
 └────────────────────────────────────────────────────┘
        │
 PostgreSQL + Vector Store + Object Storage
        │
 Dashboard + AI Chat
```

## Major Components

- Frontend (Next.js)
- API Layer
- Queue (BullMQ + Redis)
- Worker Service
- AST Parser
- Dependency Graph Builder
- Metrics Engine
- AI Reasoning Engine
- Report Generator
- Dashboard
- Repository Chat
- PostgreSQL
- Vector Database
- GitHub Integration

## Queue Pipeline

1. Repository Submitted
2. Clone Repository
3. Parse Source
4. Build Graph
5. Calculate Metrics
6. AI Analysis
7. Generate Report
8. Save Results
9. Notify User

## Design Principles

- Event-driven
- Idempotent jobs
- Stateless workers
- Incremental analysis
- Cached embeddings
- Structured LLM outputs
