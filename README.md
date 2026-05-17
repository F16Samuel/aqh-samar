# Nexorium — Goal Setting & Tracking Portal

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **AtomQuest Hackathon 1.0** — In-House Employee Performance Management System

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                 │
│   Vite + React (TypeScript)  ─  React Router v6      │
│   React Query  ─  Axios  ─  Role-based layouts       │
└────────────────────────┬─────────────────────────────┘
                         │ HTTPS / REST
┌────────────────────────▼─────────────────────────────┐
│                   Railway (Backend)                  │
│   FastAPI (Python 3.11)  ─  SQLAlchemy 2.0 async     │
│   Alembic  ─  Pydantic v2  ─  openpyxl               │
└────────────────────────┬─────────────────────────────┘
                         │ asyncpg / Supabase JWT
┌────────────────────────▼─────────────────────────────┐
│              Supabase (PostgreSQL + Auth)            │
│   Supabase Auth (JWT)  ─  PostgreSQL 15              │
└──────────────────────────────────────────────────────┘
```

## Monorepo Layout

```
/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── api/      # Route handlers
│   │   ├── core/     # Config, security, middleware
│   │   ├── db/       # Engine, session, base
│   │   ├── models/   # SQLAlchemy ORM models
│   │   ├── schemas/  # Pydantic v2 schemas
│   │   └── services/ # Business logic
│   ├── alembic/      # DB migrations
│   ├── scripts/      # Seed scripts
│   └── pyproject.toml
├── frontend/         # Vite + React (TypeScript)
│   ├── src/
│   │   ├── api/      # Axios client + React Query hooks
│   │   ├── components/
│   │   ├── layouts/  # Role-aware layouts
│   │   ├── pages/
│   │   └── store/    # Auth state
│   └── vite.config.ts
├── railway.json
├── vercel.json
└── .env.example
```

## Quick Start (Local)

### Prerequisites

- Python 3.11+
- Node.js 20+
- A Supabase project with Auth enabled

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -e ".[dev]"
cp ../.env.example .env       # fill in values
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp ../.env.example .env.local  # fill VITE_ vars
npm run dev
```

## User Roles

| Role | Responsibilities |
|------|-----------------|
| **Employee** | Create goals, log quarterly achievements, update status |
| **Manager (L1)** | Review & approve team goals, conduct check-ins, add comments |
| **Admin / HR** | Configure cycles, manage org, audit trail, goal unlock |

## Validation Rules

- Total weightage across all goals **must equal 100%**
- Minimum weightage per goal: **10%**
- Maximum goals per employee: **8**
- Goals locked after manager approval — edits only via Admin

## Progress Score Formulas

| UoM Type | Formula |
|----------|---------|
| Min (Numeric/%) | Achievement ÷ Target |
| Max (Numeric/%) | Target ÷ Achievement |
| Timeline | Completion date vs Deadline |
| Zero | If 0 → 100%, else 0% |

## Check-in Windows

| Period | Window Opens | Action |
|--------|-------------|--------|
| Phase 1 – Goal Setting | 1st May | Goal Creation, Submission & Approval |
| Q1 Check-in | July | Progress Update – Planned vs. Actual |
| Q2 Check-in | October | Progress Update – Planned vs. Actual |
| Q3 Check-in | January | Progress Update – Planned vs. Actual |
| Q4 / Annual | March / April | Final Achievement Capture |

## Deployment

- **Backend**: Railway — auto-deploy from `main` via `railway.json`
- **Frontend**: Vercel — auto-deploy from `main` via `vercel.json`
- **Database**: Supabase (PostgreSQL 15 + Auth)

## Demo Credentials

See `docs/demo-credentials.md` (generated during Phase 10 seed).
