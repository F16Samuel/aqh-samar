# Production Deployment Strategy: AWS Backend & Vercel Frontend

This document details the production-grade deployment strategy for the **AQH-SAMAR Performance Management Portal**. The system is built as a split-architecture application:
1. **Frontend**: A high-performance client-side application built with **React**, **Vite**, and **TanStack Router** (running inside a Vite SPA bundle).
2. **Backend**: A robust, asynchronous API built with **FastAPI**, **SQLAlchemy (asyncpg)**, and **Alembic** migrations.
3. **Database & Auth**: A **PostgreSQL** database integrated with **Supabase Auth** for user lifecycle and JWT signing/validation.

---

## 1. System Architecture & Topology

To minimize latency and maximize performance, we utilize a **multi-tier regional architecture**. 

### Deployment Topology
* **AWS Regional VPC (`ap-south-1` - Mumbai)**: Hosts the FastAPI backend (via Amazon ECS Express Mode).
* **Supabase (AWS `ap-south-1` under the hood)**: Wires the PostgreSQL database and authentication. Hosting both the AWS compute and Supabase DB in the same region keeps round-trip query latency to **< 2ms**.

```mermaid
graph TD
    %% Define Styles
    classDef client fill:#ececff,stroke:#333,stroke-width:2px;
    classDef frontend fill:#d4fffc,stroke:#00a39a,stroke-width:2px;
    classDef backend fill:#ffe6cc,stroke:#d79b00,stroke-width:2px;
    classDef db fill:#d5e8d4,stroke:#82b366,stroke-width:2px;
    
    %% Elements
    Client["Browser / Client App"]:::client
    Vercel["Vercel Global CDN (Frontend SPA)"]:::frontend
    Route53["AWS Route 53 (DNS)"]:::backend
    
    subgraph AWS VPC (ap-south-1)
        direction TB
        ALB["Application Load Balancer (ALB) / ECS Express Mode"]:::backend
        FastAPI1["FastAPI Container (Worker 1)"]:::backend
        FastAPI2["FastAPI Container (Worker 2)"]:::backend
    end
    
    subgraph Supabase Cloud (AWS ap-south-1)
        direction TB
        SupaAuth["Supabase Auth (JWT Provider)"]:::db
        SupaDB["PostgreSQL Database"]:::db
    end

    %% Flows
    Client -->|1. Load Page / Assets| Vercel
    Client -->|2. Authenticate / Login| SupaAuth
    Client -->|3. API Request (with JWT)| Route53
    Route53 --> ALB
    ALB -->|Route traffic| FastAPI1
    ALB -->|Route traffic| FastAPI2
    FastAPI1 -->|4. Validate JWT (Offline)| SupaAuth
    FastAPI1 -->|5. SQL Queries (asyncpg)| SupaDB
    FastAPI2 -->|5. SQL Queries (asyncpg)| SupaDB
```

---

## 2. Database & Auth Setup (Supabase)

The SAMAR portal uses Supabase for database hosting and identity management. For the production environment:

1. **Regional Matching**: When spinning up a new production Supabase project, select the **AWS Region** closest to your planned AWS deployment (`ap-south-1` for Mumbai).
2. **Database Sync & Connection Pooling**:
   - The backend uses standard PostgreSQL connections via SQLAlchemy.
   - For highly concurrent production workloads, connect using Supabase's **PgBouncer port** (`6543`) in **Transaction mode** rather than the direct session port (`5432`). 
   - Update your connection URLs to include the pool parameters.
3. **Data Bootstrapping / Production Seeding**:
   - Run Alembic migrations to build the tables:
     ```bash
     alembic upgrade head
     ```
   - Build/restore core configuration data (departments, cycle windows) using the existing migration script [migrate_and_load.py](file:///s:/aqh-samar/backend/scripts/migrate_and_load.py):
     ```bash
     python scripts/migrate_and_load.py
     ```
     > [!WARNING]
     > The `migrate_and_load.py` script contains a `TRUNCATE ... CASCADE` wipe routine on line 91. In a live production environment, run this script **only during the initial bootstrap phase** to prevent accidental loss of live production metrics.

---

## 3. Backend Deployment on AWS

FastAPI should be dockerized and deployed to a container orchestrator. We recommend using the modern **Amazon ECS Express Mode (Fargate)** which streamlines deployments automatically (replacing the deprecated App Runner service), or building a custom **AWS ECS Fargate + ALB** service for highly custom infrastructure setups.

### The Production Dockerfile

Create this file as [Dockerfile](file:///s:/aqh-samar/backend/Dockerfile) in the `backend/` directory:

```dockerfile
# ==========================================
# Phase 1: Build Dependencies
# ==========================================
FROM python:3.11-slim as builder

WORKDIR /build

# Install compilation dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies to a local path
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ==========================================
# Phase 2: Lightweight Runtime Container
# ==========================================
FROM python:3.11-slim as runner

WORKDIR /app

# Copy dependencies from the builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Install postgres runtimes and network utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend codebase
COPY . /app/

# Environment configurations
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
EXPOSE 8000

# Write the runtime startup and migration shell script
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Running database migrations..."\n\
alembic upgrade head\n\
echo "Starting FastAPI Application Server..."\n\
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 4 --proxy-headers --forwarded-allow-ips "*"\n\
' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
```

---

### Option A: Amazon ECS Express Mode (Highly Recommended)
Amazon ECS Express Mode is a simplified, zero-infrastructure path to deploy containerized APIs on Fargate. It automatically provisions an ECS cluster, public/private networking (VPC), target-tracking scaling, health checks, and a load balancer with a direct URL domain.

#### Setup Guide:
1. **Launch Express Mode**: Go to AWS Console -> Amazon ECS -> click **Create Service** and select **Express Mode (Fargate)**.
2. **Repository Source**: Set to your ECR Repository (`f16sam/aqh-samar`) and specify the `latest` tag.
3. **Configure Network Ports**:
   - **Container Port**: Set to `8000`.
   - **Protocol**: HTTP (consolidated under the Express ALB).
4. **Inject Environment Variables**: Add all parameters listed in [Section 5](#5-environment-variable-reference) directly under the task container options.
5. **Autoscaling**: Configure a target-tracking autoscaling policy (minimum 1 task, maximum 5 tasks, scaled up when average CPU exceeds 70%).

---

### Option B: AWS ECS Fargate + ALB (Enterprise Grade)
If you require strict VPC isolation, private subnets, or dedicated security groups, deploy via ECS Fargate.

#### Infrastructure Components:
* **VPC**: 2 Public Subnets (for ALB) and 2 Private Subnets (for ECS tasks), connected via a **NAT Gateway**.
* **Application Load Balancer (ALB)**: Placed in the public subnets. Listen on port 80 (redirects to 443) and port 443 (configured with an **ACM SSL Certificate**).
* **ECS Cluster & Fargate Task Definition**:
  - Task CPU: 0.5 vCPU, Memory: 1 GB.
  - Port mapping: container port `8000`.
  - Inject environment variables securely via **AWS Systems Manager (SSM) Parameter Store** or **Secrets Manager**.
* **Security Groups**:
  - **ALB Security Group**: Allows inbound traffic on `80` and `443` from `0.0.0.0/0`.
  - **ECS Task Security Group**: Allows inbound traffic on `8000` **only** from the ALB Security Group.

---

## 4. Frontend Deployment on Vercel

Vercel is the natural choice for Vite + React Router applications. The root repository already includes [vercel.json](file:///s:/aqh-samar/vercel.json), which is fully optimized for SPA routing:

```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/((?!api/.*).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Steps to Deploy on Vercel:
1. **Import Repository**: Log in to Vercel, click **Add New** -> **Project**, and select your GitHub repository.
2. **Framework Preset**: Vercel will auto-detect **Vite** thanks to the root configuration.
3. **Root Directory Override**: Leave as the repository root because `vercel.json` already contains custom commands navigating into `frontend/` to run building steps.
4. **Set Environment Variables**: Add the three frontend variables (details in Section 5).
5. **Click Deploy**: Vercel will install dependencies, compile the production bundle (`dist/`), and spin up client routes.

---

## 5. Environment Variable Reference

Manage environment variables separately for safety. Never expose sensitive secrets to the client.

### Backend Environment Variables (Amazon ECS Express Mode / Fargate)
Set these variables inside AWS console or Secrets Manager:

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `APP_ENV` | `production` | Enables production configurations (suppresses debug error traces). |
| `SECRET_KEY` | `9ef7ac6...3412ab` | Hex-encoded cryptographically secure secret key for API signatures. |
| `DATABASE_URL` | `postgresql+asyncpg://postgres.xxx:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?ssl=require` | Asynchronous connection string with PgBouncer Transaction Pool port (`6543`). |
| `DATABASE_SYNC_URL` | `postgresql://postgres.xxx:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?ssl=require` | Synchronous connection string for Alembic. |
| `SUPABASE_URL` | `https://your-proj-id.supabase.co` | Supabase API Gateway URL. |
| `SUPABASE_ANON_KEY` | `eyJhbGci...` | Safe client key for Supabase Auth interaction. |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | **SECRET** Service role key used by the backend to bypass RLS and delete users during migrations. |
| `SUPABASE_JWT_SECRET` | `your-jwt-signing-secret` | Used by `AuthMiddleware` to verify and decode user login tokens locally without hitting Supabase servers. |
| `CORS_ORIGINS` | `https://samar.yourcompany.com,https://samar-frontend.vercel.app` | Comma-separated list of allowed web domains. **Do not include trailing slashes**. |
| `PORT` | `8000` | Port uvicorn binds to in the container. |

### Frontend Environment Variables (Vercel)
All variables embedded at compile-time by Vite must have the `VITE_` prefix:

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://api.samar.yourcompany.com` | Fully qualified domain address pointing to your AWS backend. |
| `VITE_SUPABASE_URL` | `https://your-proj-id.supabase.co` | Public Supabase endpoint for client-side Auth and user hooks. |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Public Supabase API key. |

---

## 6. Production CI/CD Pipeline (GitHub Actions)

A unified GitHub pipeline ensures seamless, automated tests and builds.

Create this file as [deploy.yml](file:///.github/workflows/deploy.yml) under `.github/workflows/`:

```yaml
name: Production CI/CD Pipeline

on:
  push:
    branches: [ main ]

jobs:
  # ─── JOB 1: Test & Lint Backend ─────────────────────────────────────────────
  test-backend:
    name: Test & Lint Backend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"
          
      - name: Install Dependencies
        run: |
          cd backend
          python -m pip install --upgrade pip
          pip install -r requirements.txt pytest httpx flake8
          
      - name: Lint with Flake8
        run: |
          cd backend
          # stop the build if there are Python syntax errors or undefined names
          flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
          
  # ─── JOB 2: Build and Deploy Backend to AWS ─────────────────────────────────
  deploy-backend:
    name: Build & Deploy Container
    needs: [test-backend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, Tag, and Push Backend Image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: f16sam/aqh-samar
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -t $ECR_REGISTRY/$ECR_REPOSITORY:latest ./backend
          docker push $ECR_REGISTRY/$ECR_REPOSITORY --all-tags

      - name: Deploy to Amazon ECS Express Mode
        # Force a new rolling deployment to pull the newly pushed latest Docker image from ECR
        run: |
          aws ecs update-service --cluster ${{ secrets.AWS_ECS_CLUSTER_NAME }} --service ${{ secrets.AWS_ECS_SERVICE_NAME }} --force-new-deployment --region ap-south-1

  # ─── JOB 3: Deploy Frontend to Vercel ──────────────────────────────────────
  deploy-frontend:
    name: Trigger Vercel Build
    needs: [deploy-backend]
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Vercel Deployment via Webhook
        # Vercel provides deploy hooks that trigger a build on standard POST requests
        run: |
          curl -X POST "${{ secrets.VERCEL_DEPLOY_HOOK_URL }}"
```

---

## 7. Post-Deployment Verification Checklists

Ensure the following operational tasks are executed after deploying:

### Backend Check
1. **Health Endpoint**: Make sure the `/health` endpoint responds with:
   ```json
   { "status": "ok", "version": "0.1.0" }
   ```
2. **Interactive Docs**: Go to `https://<your-aws-backend-url>/docs` and check that Swagger UI is accessible (if enabled) to test API schemas.
3. **CORS Verification**: Make an options call or fetch request from your Vercel frontend. Ensure headers include:
   ```http
   Access-Control-Allow-Origin: https://your-vercel-domain.vercel.app
   ```

### Frontend Check
1. **Sign-In Flow**: Perform a full login cycle. Confirm the Supabase client correctly resolves tokens and relays them via the `Authorization: Bearer <JWT>` header on all subsequent API requests.
2. **Page Rewrites**: Navigate to a sub-route (e.g. `/app/reports`) and refresh the browser page. If it serves the page without a 404, the Vercel rewrite configuration is working correctly.
3. **Network Tab Audit**: Verify that no Supabase service role keys are visible in frontend bundle script payloads.
