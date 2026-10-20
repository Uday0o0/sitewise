"""Router for conceptual architectural visualisation preview."""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from services.architectural_visualizer_service import (
    VisualizationRequest,
    VisualizationResponse,
    generate_conceptual_visualization,
    get_visualization_options
)

router = APIRouter(prefix="/api/v4", tags=["architectural-visualisation"])


@router.get("/architectural-preview/options", response_model=Dict[str, Any])
def get_options():
    """Retrieve available architectural styles, building types, and design features."""
    return get_visualization_options()


@router.post("/projects/{project_id}/architectural-preview", response_model=VisualizationResponse)
def create_conceptual_preview(project_id: str, request: VisualizationRequest):
    """Generate a conceptual architectural visualization preview for a project.
    
    Returns structured model output with explicit legal disclaimer,
    generation prompt, and provenance metadata.
    """
    request.project_id = project_id
    response = generate_conceptual_visualization(request)
    return response
