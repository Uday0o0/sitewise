"""SITEWISE V4.2 — FastAPI Application Entry Point."""

from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment from backend/.env or root .env
_base_dir = Path(__file__).resolve().parent
load_dotenv(_base_dir / ".env")
load_dotenv(_base_dir.parent / ".env")

from database import init_db
from routers import projects, findings, graphs, simulator, evidence, documents




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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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




@app.get("/api/v4/health")
async def health():
    return {"status": "ok", "version": "4.2.0", "demo": True}
