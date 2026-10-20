"""FastAPI Router for Centralized Typed AI Reasoning (Activities 4.1, 4.2 & 4.3)."""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, Dict, Any
import json

from services.ai_provider import (
    FeatureIdentifier,
    FEATURE_REASONING_GUIDELINES,
    ReasoningRequest,
    ReasoningResponse,
    execute_reasoning,
    SafetyMonitoringOutput,
    CrackDetectionOutput,
    PlanningValuationOutput,
    AdvisoryChatbotOutput
)

router = APIRouter(prefix="/api/v4/ai", tags=["ai-reasoning"])


@router.get("/features")
def get_ai_features():
    """Retrieve supported feature identifiers, reasoning guidelines, and target schemas."""
    return {
        "features": [f.value for f in FeatureIdentifier],
        "guidelines": {k.value: v for k, v in FEATURE_REASONING_GUIDELINES.items()},
        "schemas": {
            FeatureIdentifier.SAFETY_MONITORING.value: SafetyMonitoringOutput.model_json_schema(),
            FeatureIdentifier.CRACK_DETECTION.value: CrackDetectionOutput.model_json_schema(),
            FeatureIdentifier.PLANNING_VALUATION.value: PlanningValuationOutput.model_json_schema(),
            FeatureIdentifier.ADVISORY_CHATBOT.value: AdvisoryChatbotOutput.model_json_schema(),
        }
    }


@router.post("/reason")
async def trigger_ai_reasoning(
    feature: str = Form(..., description="Feature identifier: safety_monitoring | crack_detection | planning_valuation | advisory_chatbot"),
    prompt: str = Form(..., description="User reasoning prompt or instruction"),
    context_json: Optional[str] = Form(None, description="Optional JSON-encoded context dictionary"),
    image: Optional[UploadFile] = File(None, description="Optional multimodal image attachment")
):
    """Centralized typed reasoning endpoint supporting text-only and image-plus-text calls.
    
    Applies Activity 4.3 distinct domain guidelines and Activity 4.2 schema validation
    with bounded repair after generation.
    """
    try:
        feat_enum = FeatureIdentifier(feature)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid feature identifier '{feature}'. Supported: {[f.value for f in FeatureIdentifier]}"
        )

    context_data = None
    if context_json:
        try:
            context_data = json.loads(context_json)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid context_json: {e}")

    image_bytes = None
    image_mime = "image/jpeg"
    if image:
        image_bytes = await image.read()
        image_mime = image.content_type or "image/jpeg"

    req = ReasoningRequest(
        feature=feat_enum,
        prompt=prompt,
        image_bytes=image_bytes,
        image_mime=image_mime,
        context_data=context_data
    )

    resp = await execute_reasoning(req)
    return {
        "feature": resp.feature.value,
        "status": resp.status,
        "provenance": resp.provenance,
        "provider": resp.provider,
        "model": resp.model,
        "validated_data": resp.validated_data,
        "error": resp.error,
        "latency_ms": resp.latency_ms
    }
