# CodeMRI – Free Tier Deployment Guide 🚀

This guide explains how to deploy the entire CodeMRI stack (Next.js frontend, BullMQ queue, background worker, Postgres database, and Redis cache) using 100% free cloud services.

---

## 📐 Architecture & Services

Since CodeMRI requires a persistent worker process (to clone repositories, run AST analysis, and stream logs) alongside serverless pages, we will split the deployment across three specialized free-tier providers:

```text
       ┌────────────────────────┐
       │   Vercel (Free Tier)   │
       │  Next.js Frontend App  │
       └───────────┬────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌─────────────────┐ ┌──────────────────┐
│   Neon (Free)   │ │  Upstash (Free)  │
│ Serverless PgDb │ │ Serverless Redis │
└─────────────────┘ └────────┬─────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Koyeb or Render      │
                │ Persistent Worker VM   │
                └────────────────────────┘
```

| Service Component | Cloud Provider | Free Tier Benefits |
| :--- | :--- | :--- |
| **Database (Postgres)** | [Neon](https://neon.tech) | 1 Project, 3 GiB storage, Serverless scale-to-zero |
| **Queue & Cache (Redis)** | [Upstash](https://upstash.com) | Serverless Redis, 10,000 requests/day, SSL enabled |
| **Frontend (Next.js)** | [Vercel](https://vercel.com) | Unlimited builds, Global Edge CDN, SSL automatic |
| **Background Worker** | [Koyeb](https://koyeb.com) or [Render](https://render.com) | Continuous runtime, Docker execution, no spin-down (Koyeb) |

---

## 1. Database Setup: Neon Postgres

1. Sign up on [Neon.tech](https://neon.tech).
2. Create a new project named `codemri`.
3. Copy the connection string. Choose the **Pooled Connection** string format (usually starts with `postgres://` or `postgresql://` and includes `-pooler` in the host).
4. Save this connection string for your environment variables as `DATABASE_URL`.

---

## 2. Queue & Cache Setup: Upstash Redis

BullMQ requires a Redis instance that supports Redis scripts and persistent connections. Upstash is a serverless Redis provider that offers a fully compatible free tier.

1. Sign up on [Upstash.com](https://upstash.com).
2. Create a new **Redis Database** named `codemri-queue`.
3. Choose the region closest to your Vercel/Koyeb deployments to minimize latency.
4. Scroll down to the **Node.js** connection section and copy the **Redis URI** (e.g. `rediss://default:password@host:port`).
5. Save this URI for your environment variables as `REDIS_URL`.
   > [!IMPORTANT]
   > Make sure the connection string starts with `rediss://` (with an extra `s`) to ensure secure SSL connectivity.

---

## 3. Frontend Deployment: Vercel (Next.js)

Vercel is the natural choice for deploying Next.js applications.

1. Push your repository code to GitHub (e.g. as a private repository).
2. Log in to [Vercel](https://vercel.com) and click **Add New > Project**.
3. Import your GitHub repository.
4. In the configuration settings:
    - **Root Directory**: Select `apps/web`.
    - **Framework Preset**: Next.js.
    - **Build Command**: `pnpm --filter @codemri/web build`
    - **Install Command**: `pnpm install` (Vercel automatically detects pnpm).
5. Add the following **Environment Variables**:
    ```env
    DATABASE_URL=your_neon_pooled_connection_string
    REDIS_URL=your_upstash_redis_uri
    AUTH_SECRET=generate_a_random_32_character_string
    NEXTAUTH_URL=https://your-vercel-domain-name.vercel.app
    # Optional GitHub OAuth Credentials (if authentication is used)
    GITHUB_CLIENT_ID=your_github_oauth_client_id
    GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
    ```
6. Click **Deploy**. Vercel will build the frontend and serve it globally.

---

## 4. Worker Deployment: Koyeb (Recommended)

Next.js Serverless Functions are short-lived (10-second limit on Vercel free tier) and cannot run the BullMQ worker loop. We need to deploy the worker on a service that supports persistent processes.

**Koyeb** provides a free tier with 512MB RAM and 0.1 vCPU that runs continuously without sleeping.

### Method A: Docker Deployment (Easiest)

1. Create a `Dockerfile.worker` in the root of your project:
   ```dockerfile
   FROM node:22-alpine AS base
   RUN npm install -g pnpm
   WORKDIR /app

   COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
   COPY apps/worker/package.json ./apps/worker/
   COPY packages/ ./packages/

   RUN pnpm install --frozen-lockfile

   COPY apps/worker/ ./apps/worker/
   RUN pnpm --filter @codemri/worker build

   CMD ["pnpm", "--filter", "@codemri/worker", "start"]
   ```
2. Link your GitHub account to [Koyeb.com](https://koyeb.com).
3. Click **Create Service** and choose **GitHub**.
4. Select your repository and configure:
    - **Builder**: Select **Dockerfile**.
    - **Dockerfile Path**: `Dockerfile.worker`
    - **Run Command**: (Leave empty, it will read `CMD` from Dockerfile).
5. Add the following **Environment Variables**:
    ```env
    DATABASE_URL=your_neon_pooled_connection_string
    REDIS_URL=your_upstash_redis_uri
    ```
6. Deploy the service. It will run in the background, listening to the Upstash Redis queue and executing jobs pushed by the Vercel frontend.

---

## 5. Alternative Worker Deployment: Render

If you prefer to keep your deployment under **Render**, you can run the worker as a Web Service on their free tier, but we must make the worker listen to a port so Render does not fail the deployment.

1. Modify `apps/worker/src/index.ts` to spin up a dummy HTTP server:
   ```typescript
   import http from "http";

   // Spin up dummy server to satisfy Render PORT check
   const port = process.env.PORT || 8000;
   http.createServer((req, res) => {
     res.writeHead(200, { 'Content-Type': 'text/plain' });
     res.end('Worker is active');
   }).listen(port, () => {
     console.log(`Dummy HTTP health check listening on port ${port}`);
   });
   ```
2. Deploy to Render as a **Web Service**:
    - **Build Command**: `pnpm install && pnpm --filter @codemri/worker build`
    - **Start Command**: `pnpm --filter @codemri/worker start`
    - Add `DATABASE_URL` and `REDIS_URL` to Render environment variables.
   > [!NOTE]
   > Render's free tier web services spin down after 15 minutes of inactivity. You can use a free pinging service (like [UptimeRobot](https://uptimerobot.com)) to ping your Render dummy URL once every 10 minutes to keep the worker active.

---

## 🧪 Verifying the Production Environment

Once all services are deployed, check the connection status:
1. Navigate to your Vercel URL.
2. Verify you can access `/api/health`.
3. Trigger a test repository analysis from the UI and observe the progress bar update as the Vercel frontend pushes a job to Upstash and the Koyeb worker picks it up.
