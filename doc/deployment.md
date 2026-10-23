# SITEWISE V4.2 — Cloud Deployment Guide (GitHub + Render + Vercel)

This guide documents the exact, verified deployment architecture and procedure for hosting SITEWISE V4.2 in the cloud.

---

## 1. Cloud Architecture Overview

```
 [ User Browser ]
       |
       +---> [ Vercel Edge CDN ] (Frontend SPA: React 19 / Vite)
       |          |
       |          | Calls REST API: https://sitewise-backend.onrender.com/api/v4/...
       |          v
       +---> [ Render Web Service ] (Backend: FastAPI / Python 3.11 / Uvicorn)
                  |
                  v
             [ SQLite Database ] (sitewise.db - Auto-seeded on startup)
```

---

## 2. Component Paths & Entry Points

| Component | Path in Repository | Entry Point / Root | Dependency File | Build / Start Command |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `frontend/` | `src/main.tsx` (`index.html`) | `frontend/package.json` | Build: `npm run build`<br>Output: `dist/` |
| **Backend** | `backend/` | `main:app` (FastAPI instance) | `backend/requirements.txt` | Build: `pip install -r requirements.txt`<br>Start: `uvicorn main:app --host 0.0.0.0 --port $PORT` |

---

## 3. Database & Persistent Storage Considerations

1. **Baseline Auto-Seeding (Zero Cold-Start Failure):**  
   On every cold start, `backend/database.py` executes `init_db()` and `backend/seed.py`. If tables are unpopulated, it immediately seeds the certified `PKG-3 Elevated Viaduct` project baseline, IRC:112 and Pier 18 QA documents, passage chunks, and benchmark findings. The service is immediately 100% operational upon initial launch on any ephemeral container.

2. **Ephemeral vs. Persistent Storage on Render:**
   - **Render Free Web Services:** The local filesystem is ephemeral. Data added during runtime (user-uploaded photos or new findings) persists while the container is running, but resets to the seeded baseline upon service sleep, restart, or new git deploy.
   - **Render Paid Web Service with Persistent Disk (Recommended for Production Data Retention):**  
     Attach a Render Disk mounted at `/var/data` (e.g. 1 GB disk) and configure the following environment variables:
     - `DATABASE_URL=sqlite+aiosqlite:////var/data/sitewise.db`
     - `SITEWISE_UPLOAD_DIR=/var/data/uploads`
     All user uploads and reviewer dispositions will then persist indefinitely across redeployments.
   - **Managed Database Migration (Future Enterprise Scale):**  
     SQLAlchemy async models are standard declarative classes. To connect a managed PostgreSQL instance (e.g. Render PostgreSQL or Supabase), provide:
     - `DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname`
     *(Note: requires installing `asyncpg`)*.

---

## 4. Required Environment Variables

### Backend Service (Render)

| Variable | Required? | Default / Example Value | Purpose |
| :--- | :---: | :--- | :--- |
| `PYTHON_VERSION` | Yes | `3.11.9` | Sets the Python runtime on Render. |
| `PORT` | Auto | Set automatically by Render (e.g. `10000`) | Port Uvicorn listens on. |
| `DATABASE_URL` | Optional | `sqlite+aiosqlite:///./sitewise.db` | SQLite or persistent disk database path. |
| `CORS_ORIGINS` | Recommended | `https://your-frontend.vercel.app` | Comma-separated allowed frontend origins. |
| `CORS_ORIGIN_REGEX` | Optional | `^https:\/\/.*\.vercel\.app$` | Matches all Vercel production and preview URLs. |
| `FRONTEND_URL` | Optional | `https://your-frontend.vercel.app` | Main frontend URL for CORS. |
| `GROQ_API_KEY` | Optional | `gsk_...` (Never commit) | Enables live Groq LLaMA-3.3 reasoning. |
| `GEMINI_API_KEY` | Optional | `AIza...` (Never commit) | Enables live Google Gemini reasoning. |
| `SITEWISE_AI_PROVIDER` | Optional | `auto` | Provider selector (`auto`, `groq`, or `gemini`). |

### Frontend Service (Vercel)

| Variable | Required? | Example Value | Purpose |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | Yes (for direct cross-origin) | `https://sitewise-backend.onrender.com` | Base URL of the deployed Render backend service. Omit if using Vercel proxy rewrites. |

---

## 5. Step-by-Step Deployment Procedure

### Step 1: Push Code to GitHub
1. Create a **Private** repository on GitHub (e.g. `sitewise-v42`).
2. Add the remote and push:
   ```bash
   git remote add origin https://github.com/<your-username>/sitewise-v42.git
   git branch -M master
   git push -u origin master
   ```

### Step 2: Deploy Backend on Render
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint** (or **Web Service**).
   - If using **Blueprint**: Select your repository; Render will read `render.yaml` automatically.
   - If using **Web Service**:
     - **Name:** `sitewise-backend`
     - **Language:** `Python 3`
     - **Root Directory:** `backend`
     - **Build Command:** `pip install -r requirements.txt`
     - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
     - **Health Check Path:** `/api/v4/health`
3. In **Environment Variables**, add:
   - `PYTHON_VERSION`: `3.11.9`
   - `CORS_ORIGIN_REGEX`: `^https:\/\/.*\.vercel\.app$`
   - Optional: `GROQ_API_KEY` or `GEMINI_API_KEY`
4. Deploy the service. Note the assigned public URL (e.g. `https://sitewise-backend.onrender.com`).
5. Verify health: visit `https://sitewise-backend.onrender.com/api/v4/health` (should return HTTP 200 OK).

### Step 3: Deploy Frontend on Vercel
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** → **Project** and import your GitHub repository.
3. In Project Configuration:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click *Edit* and select `frontend`.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. In **Environment Variables**:
   - `VITE_API_BASE_URL`: `https://sitewise-backend.onrender.com` (Your Render backend URL from Step 2).
5. Click **Deploy**.
6. When deployment finishes, test the live URL (e.g. `https://sitewise-frontend.vercel.app`).
