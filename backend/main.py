import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure backend directory is in sys.path for direct or module imports
_base_dir = Path(__file__).resolve().parent
if str(_base_dir) not in sys.path:
    sys.path.insert(0, str(_base_dir))

# Load environment from backend/.env or root .env
load_dotenv(_base_dir / ".env")
load_dotenv(_base_dir.parent / ".env")

from database import init_db
from routers import projects, findings, graphs, simulator, evidence, documents, weather, daily_briefing, planning_engine, valuation, visualization, reasoning, safety_inspection




@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="SITEWISE V4.2 API",
    description="Construction Intelligence Backend — Synthetic Demo & Real Inspection Pipeline",
    version="4.2.0",
    lifespan=lifespan,
)

# Resolve allowed CORS origins from defaults and environment variables
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

cors_env = os.getenv("CORS_ORIGINS", "")
if cors_env:
    for origin in cors_env.split(","):
        clean_origin = origin.strip()
        if clean_origin and clean_origin not in allowed_origins:
            allowed_origins.append(clean_origin)

frontend_url = os.getenv("FRONTEND_URL", "").strip()
if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

vercel_url = os.getenv("VERCEL_URL", "").strip()
if vercel_url:
    v_origin = f"https://{vercel_url}" if not vercel_url.startswith("http") else vercel_url
    if v_origin not in allowed_origins:
        allowed_origins.append(v_origin)

# Allow Vercel preview deployments by regex or custom pattern
cors_regex = os.getenv("CORS_ORIGIN_REGEX", r"^https:\/\/.*\.vercel\.app$")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(findings.router)
app.include_router(graphs.router)
app.include_router(simulator.router)
app.include_router(evidence.router)
app.include_router(documents.router)
app.include_router(weather.router)
app.include_router(daily_briefing.router)
app.include_router(planning_engine.router)
app.include_router(valuation.router)
app.include_router(visualization.router)
app.include_router(reasoning.router)
app.include_router(safety_inspection.router)




@app.get("/api/v4/health")
async def health():
    return {"status": "ok", "version": "4.2.0", "demo": True}
