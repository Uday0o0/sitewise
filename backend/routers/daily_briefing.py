"""Daily Site Assistant Briefing API routes."""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Project
from services.daily_briefing_service import (
    DailyBriefingRequest,
    DailyBriefingResponse,
    generate_daily_briefing,
)

router = APIRouter(tags=["daily_briefing"])


@router.get("/api/v4/projects/{project_id}/assistant/daily-briefing", response_model=DailyBriefingResponse)
async def get_daily_site_briefing(
    project_id: str,
    activity: str = Query("Pier 18 Cap Concreting & Segment Stitching", description="Planned daily construction activity"),
    workforce_count: int = Query(24, ge=1, le=500, description="Available labor force count"),
    site_conditions: str = Query("Elevated staging on Pier 18, traffic flowing below on NH-48", description="Site conditions"),
    shift: str = Query("DAY_SHIFT", description="Planned shift"),
    db: AsyncSession = Depends(get_db),
):
    """Generate or retrieve a daily morning site briefing grounded in project records."""
    proj_res = await db.execute(select(Project).where((Project.id == project_id) | (Project.package_id == project_id)))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    valid_shift = "NIGHT_SHIFT" if shift.upper() == "NIGHT_SHIFT" else "DAY_SHIFT"

    req = DailyBriefingRequest(
        daily_activity=activity,
        workforce_count=workforce_count,
        site_conditions=site_conditions,
        shift=valid_shift,
    )
    return await generate_daily_briefing(project_id=project.id, req=req, db=db)


@router.post("/api/v4/projects/{project_id}/assistant/daily-briefing", response_model=DailyBriefingResponse)
async def post_daily_site_briefing(
    project_id: str,
    req: DailyBriefingRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate a custom daily site briefing with specific workforce and condition parameters."""
    proj_res = await db.execute(select(Project).where((Project.id == project_id) | (Project.package_id == project_id)))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    return await generate_daily_briefing(project_id=project.id, req=req, db=db)
