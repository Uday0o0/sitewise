"""FastAPI router for Construction Site Safety Inspection (Activity 2.1)."""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, Dict, Any

from services.safety_analysis_service import (
    SafetyAnalysisRequest,
    SafetyAnalysisResponse,
    analyze_construction_safety_image,
    OSHA_STANDARDS_REFERENCE
)

router = APIRouter(prefix="/api/v4/safety-inspection", tags=["safety-inspection"])


@router.get("/standards", response_model=Dict[str, str])
def get_safety_standards():
    """Retrieve authoritative safety standards referenced by SITEWISE (OSHA 1926, BOCW Act 1996, IS 2925)."""
    return OSHA_STANDARDS_REFERENCE


@router.post("/analyze", response_model=SafetyAnalysisResponse)
async def analyze_safety_image(
    project_id: str = Form("PRJ-NH48-PKG3"),
    site_location: str = Form("Chainage 42+150 Pier Cap Zone"),
    activity_type: str = Form("Structural Gantry Launching & Rebar Tying"),
    notes: Optional[str] = Form(None),
    image: UploadFile = File(..., description="Inspection photo of construction site or worker crew")
):
    """Analyze construction site image for PPE compliance, worker proximity hazards,
    scaffolding/fall risks, and environmental site safety.
    """
    try:
        raw_bytes = await image.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read image stream: {exc}")

    req = SafetyAnalysisRequest(
        project_id=project_id,
        site_location=site_location,
        activity_type=activity_type,
        notes=notes
    )

    try:
        response = await analyze_construction_safety_image(raw_bytes, req)
        return response
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal safety analysis failed: {exc}")
