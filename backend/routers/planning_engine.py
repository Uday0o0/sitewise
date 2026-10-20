"""Construction Project Planning API endpoints (Activity 3.1)."""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from services.project_planning_service import (
    ProjectPlanningRequest,
    ProjectPlanningResponse,
    calculate_project_plan,
    CITY_COST_INDEX,
    TYPOLOGY_BASE_RATE_PER_SQFT,
)

router = APIRouter(prefix="/api/v4/planning", tags=["planning_engine"])


@router.get("/presets")
async def get_planning_presets():
    """Return available building typologies, benchmark cities, and standard baseline rates."""
    return {
        "cities": [
            {"city": k, "cost_index": v} for k, v in CITY_COST_INDEX.items()
        ],
        "typologies": [
            {
                "code": k,
                "name": k.replace("_", " ").title(),
                "base_rate_sqft_inr": v,
            }
            for k, v in TYPOLOGY_BASE_RATE_PER_SQFT.items()
        ],
        "standard_plot_presets": [
            {"label": "Standard 30x50 Villa Plot (1,500 sq.ft)", "length_ft": 50, "width_ft": 30, "area_sqft": 1500},
            {"label": "Independent House 40x60 (2,400 sq.ft)", "length_ft": 60, "width_ft": 40, "area_sqft": 2400},
            {"label": "Urban Infill 20x40 (800 sq.ft)", "length_ft": 40, "width_ft": 20, "area_sqft": 800},
            {"label": "Commercial Plot 60x80 (4,800 sq.ft)", "length_ft": 80, "width_ft": 60, "area_sqft": 4800},
        ],
    }


@router.post("/generate-plan", response_model=ProjectPlanningResponse)
async def generate_construction_plan(req: ProjectPlanningRequest):
    """Generate a unified construction project plan with material takeoff, INR costing, and phase schedule."""
    try:
        return calculate_project_plan(req)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to generate project plan: {str(exc)}")


@router.get("/projects/{project_id}/quick-plan", response_model=ProjectPlanningResponse)
async def get_quick_project_plan(
    project_id: str,
    area_sqft: float = Query(2400.0, gt=0, le=500000, description="Built-up or plot area in sq.ft"),
    floors: int = Query(2, ge=1, le=50, description="Number of stories"),
    typology: str = Query("RESIDENTIAL_STANDARD", description="Construction typology"),
    city: str = Query("Gurugram", description="Location city"),
):
    """Quickly compute an indicative construction project plan with query parameters."""
    valid_typology = typology.upper()
    if valid_typology not in TYPOLOGY_BASE_RATE_PER_SQFT:
        valid_typology = "RESIDENTIAL_STANDARD"

    req = ProjectPlanningRequest(
        plot_area_sqft=area_sqft,
        floors=floors,
        ground_coverage_percent=75.0,
        construction_type=valid_typology,  # type: ignore
        location_city=city,
        project_id=project_id,
    )
    return calculate_project_plan(req)
