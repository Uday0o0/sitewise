"""Weather-Aware Construction Advisory API endpoints."""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Project
from services.weather_service import (
    SUPPORTED_ACTIVITIES,
    DEFAULT_COORDINATES,
    WeatherMetrics,
    WeatherAdvisoryRequest,
    WeatherAdvisoryResponse,
    fetch_live_weather,
    evaluate_activity_advisory,
)

router = APIRouter(tags=["weather"])


@router.get("/api/v4/weather/activities")
async def list_weather_activities():
    """List construction activities supported by the weather advisory engine."""
    return [
        {"code": code, "name": meta["name"], "description": meta["description"]}
        for code, meta in SUPPORTED_ACTIVITIES.items()
    ]


@router.get("/api/v4/projects/{project_id}/weather/current")
async def get_current_weather(
    project_id: str,
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve normalized current meteorological conditions for a project site."""
    # Verify project
    proj_res = await db.execute(select(Project).where((Project.id == project_id) | (Project.package_id == project_id)))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    target_lat = lat if lat is not None else DEFAULT_COORDINATES.get(project.id, DEFAULT_COORDINATES["DEFAULT"])["lat"]
    target_lon = lon if lon is not None else DEFAULT_COORDINATES.get(project.id, DEFAULT_COORDINATES["DEFAULT"])["lon"]

    metrics, provider, freshness, provenance, error_msg = await fetch_live_weather(target_lat, target_lon)

    return {
        "projectId": project.id,
        "locationName": DEFAULT_COORDINATES.get(project.id, DEFAULT_COORDINATES["DEFAULT"]).get("city", "Site Location"),
        "coordinates": {"latitude": target_lat, "longitude": target_lon},
        "metrics": metrics,
        "provider": provider,
        "freshness": freshness,
        "provenance": provenance,
        "error": error_msg,
    }


@router.get("/api/v4/projects/{project_id}/weather/advisory", response_model=WeatherAdvisoryResponse)
async def get_project_weather_advisory(
    project_id: str,
    activity: str = Query("CONCRETE_POURING", description="Construction activity code"),
    scenario: bool = Query(False, description="Whether to simulate scenario conditions if offline"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Evaluate activity safety against current live meteorological conditions."""
    proj_res = await db.execute(select(Project).where((Project.id == project_id) | (Project.package_id == project_id)))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    act_code = activity.upper()
    if act_code not in SUPPORTED_ACTIVITIES:
        act_code = "GENERAL_SITE_ACTIVITY"

    target_lat = lat if lat is not None else DEFAULT_COORDINATES.get(project.id, DEFAULT_COORDINATES["DEFAULT"])["lat"]
    target_lon = lon if lon is not None else DEFAULT_COORDINATES.get(project.id, DEFAULT_COORDINATES["DEFAULT"])["lon"]

    metrics, provider, freshness, provenance, error_msg = await fetch_live_weather(target_lat, target_lon)

    # If live provider failed and user requested scenario, provide deterministic baseline fixture
    if metrics is None and scenario:
        metrics = WeatherMetrics(
            temperature_c=29.5,
            relative_humidity_pct=58.0,
            wind_speed_kmh=14.0,
            wind_gusts_kmh=20.0,
            precipitation_mm=0.0,
            precipitation_probability_pct=15.0,
            weather_condition="Scattered Clouds",
            is_forecast=False,
        )
        provider = "Deterministic Offline Scenario Fixture"
        freshness = "SYNTHETIC_FALLBACK"
        provenance = "SYNTHETIC_DEMO"
        error_msg = None

    return evaluate_activity_advisory(
        project_id=project.id,
        activity_code=act_code,
        metrics=metrics,
        provider_name=provider,
        freshness=freshness,
        provenance=provenance,
        error_msg=error_msg,
    )


@router.post("/api/v4/projects/{project_id}/weather/advisory", response_model=WeatherAdvisoryResponse)
async def post_custom_weather_advisory(
    project_id: str,
    req: WeatherAdvisoryRequest,
    db: AsyncSession = Depends(get_db),
):
    """Evaluate activity safety with custom scenario parameters or specified coordinates."""
    proj_res = await db.execute(select(Project).where((Project.id == project_id) | (Project.package_id == project_id)))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    act_code = req.activity.upper()
    if act_code not in SUPPORTED_ACTIVITIES:
        act_code = "GENERAL_SITE_ACTIVITY"

    # User provided explicit scenario weather metrics
    if req.custom_weather is not None:
        return evaluate_activity_advisory(
            project_id=project.id,
            activity_code=act_code,
            metrics=req.custom_weather,
            provider_name="User-Supplied What-If Scenario",
            freshness="USER_SCENARIO",
            provenance="USER_PROVIDED_UNVERIFIED",
        )

    # Otherwise fetch live weather with provided or default coordinates
    target_lat = req.latitude if req.latitude is not None else DEFAULT_COORDINATES.get(project.id, DEFAULT_COORDINATES["DEFAULT"])["lat"]
    target_lon = req.longitude if req.longitude is not None else DEFAULT_COORDINATES.get(project.id, DEFAULT_COORDINATES["DEFAULT"])["lon"]

    metrics, provider, freshness, provenance, error_msg = await fetch_live_weather(target_lat, target_lon)

    if req.is_scenario and metrics is None:
        metrics = WeatherMetrics(
            temperature_c=31.0,
            relative_humidity_pct=60.0,
            wind_speed_kmh=18.0,
            precipitation_mm=0.0,
            weather_condition="Partly Cloudy",
        )
        provider = "Synthetic Scenario Fallback"
        freshness = "SYNTHETIC_FALLBACK"
        provenance = "SYNTHETIC_DEMO"
        error_msg = None

    return evaluate_activity_advisory(
        project_id=project.id,
        activity_code=act_code,
        metrics=metrics,
        provider_name=provider,
        freshness=freshness,
        provenance=provenance,
        error_msg=error_msg,
    )
