"""Unit and API tests for Activity 4.1, 4.2, and 4.3:
Centralized Typed Reasoning Engine, Schema Enforcement, and Multimodal Support.
"""

import pytest
import json
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

import main
from services.ai_provider import (
    FeatureIdentifier,
    FEATURE_REASONING_GUIDELINES,
    ReasoningRequest,
    ReasoningResponse,
    execute_reasoning,
    validate_and_repair_output,
    SafetyMonitoringOutput,
    CrackDetectionOutput,
    PlanningValuationOutput,
    AdvisoryChatbotOutput
)

client = TestClient(main.app)


def test_01_features_endpoint():
    """Verify features endpoint returns all 4 feature identifiers and their guidelines/schemas."""
    response = client.get("/api/v4/ai/features")
    assert response.status_code == 200
    data = response.json()
    assert "features" in data
    assert len(data["features"]) == 4
    assert FeatureIdentifier.SAFETY_MONITORING.value in data["features"]
    assert FeatureIdentifier.CRACK_DETECTION.value in data["features"]
    assert FeatureIdentifier.PLANNING_VALUATION.value in data["features"]
    assert FeatureIdentifier.ADVISORY_CHATBOT.value in data["features"]

    assert "guidelines" in data
    assert "schemas" in data
    assert FeatureIdentifier.SAFETY_MONITORING.value in data["schemas"]


def test_02_guidelines_content_audit():
    """Verify Activity 4.3 distinct reasoning guidelines content for all 4 domains."""
    safety_guide = FEATURE_REASONING_GUIDELINES[FeatureIdentifier.SAFETY_MONITORING]
    assert "PPE" in safety_guide or "helmets" in safety_guide
    assert "OSHA" in safety_guide or "BOCW" in safety_guide

    crack_guide = FEATURE_REASONING_GUIDELINES[FeatureIdentifier.CRACK_DETECTION]
    assert "morphology" in crack_guide.lower()
    assert "tactile" in crack_guide.lower()

    planning_guide = FEATURE_REASONING_GUIDELINES[FeatureIdentifier.PLANNING_VALUATION]
    assert "CPWD" in planning_guide or "takeoff" in planning_guide

    chatbot_guide = FEATURE_REASONING_GUIDELINES[FeatureIdentifier.ADVISORY_CHATBOT]
    assert "[DOC-N" in chatbot_guide or "grounding" in chatbot_guide


def test_03_schema_validation_success():
    """Verify valid JSON validates directly to LIVE_AI_MODEL."""
    sample_json = json.dumps({
        "feature": "safety_monitoring",
        "overall_risk_level": "HIGH",
        "ppe_compliance": {
            "helmets_compliant": False,
            "vests_compliant": True,
            "violations": ["Worker without helmet near crane swing radius"],
            "observations": "2 of 5 workers observed without head protection."
        },
        "worker_hazards": [{"hazard_type": "crane_proximity", "severity": "HIGH"}],
        "corrective_actions": ["Issue immediate stand-down", "Enforce IS 2925 helmet policy"]
    })
    
    data, prov = validate_and_repair_output(FeatureIdentifier.SAFETY_MONITORING, sample_json)
    assert prov == "LIVE_AI_MODEL"
    assert data["overall_risk_level"] == "HIGH"
    assert data["ppe_compliance"]["helmets_compliant"] is False
    assert len(data["corrective_actions"]) == 2


def test_04_schema_bounded_repair_markdown():
    """Verify markdown-wrapped JSON (```json ... ```) is cleaned and validated."""
    markdown_wrapped = """```json
    {
        "feature": "crack_detection",
        "morphology_type": "DIAGONAL_SHEAR",
        "probable_cause": "High shear stress near bridge abutment pier",
        "structural_significance": "HIGH",
        "spalling_or_rebar_exposed": true,
        "recommended_interventions": ["Core drilling shear test", "Epoxy pressure grouting"],
        "repair_urgency": "IMMEDIATE_ACTION"
    }
    ```"""
    
    data, prov = validate_and_repair_output(FeatureIdentifier.CRACK_DETECTION, markdown_wrapped)
    assert prov == "LIVE_AI_MODEL"
    assert data["morphology_type"] == "DIAGONAL_SHEAR"
    assert data["spalling_or_rebar_exposed"] is True
    assert data["repair_urgency"] == "IMMEDIATE_ACTION"


def test_05_schema_bounded_repair_malformed():
    """Verify completely malformed non-JSON output recovers gracefully to SCHEMA_REPAIR_FALLBACK."""
    malformed_text = "I apologize, but as an AI I cannot strictly output JSON right now."
    
    data, prov = validate_and_repair_output(FeatureIdentifier.SAFETY_MONITORING, malformed_text)
    assert prov == "SCHEMA_REPAIR_FALLBACK"
    assert "overall_risk_level" in data
    assert "ppe_compliance" in data
    assert "applicable_standards" in data


@pytest.mark.asyncio
async def test_06_execute_reasoning_mocked():
    """Verify execute_reasoning flow with mocked provider."""
    req = ReasoningRequest(
        feature=FeatureIdentifier.SAFETY_MONITORING,
        prompt="Inspect workers near excavation pit"
    )
    
    with patch("services.ai_provider.is_provider_available", return_value=True), \
         patch("services.ai_provider.get_active_provider_name", return_value="groq"), \
         patch("groq.AsyncGroq") as mock_groq_cls:
        
        mock_instance = AsyncMock()
        mock_groq_cls.return_value = mock_instance
        mock_instance.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps({
                "feature": "safety_monitoring",
                "overall_risk_level": "LOW",
                "corrective_actions": ["Maintain regular toolbox talks"]
            })))]
        )
        
        resp = await execute_reasoning(req)
        assert resp.status == "SUCCESS"
        assert resp.provenance == "LIVE_AI_MODEL"
        assert resp.feature == FeatureIdentifier.SAFETY_MONITORING
        assert resp.validated_data["overall_risk_level"] == "LOW"


@pytest.mark.asyncio
async def test_07_multimodal_image_payload():
    """Verify multimodal request handles image bytes without errors."""
    fake_img = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 50
    req = ReasoningRequest(
        feature=FeatureIdentifier.CRACK_DETECTION,
        prompt="Examine this concrete pier surface",
        image_bytes=fake_img,
        image_mime="image/jpeg"
    )
    
    with patch("services.ai_provider.is_provider_available", return_value=True), \
         patch("services.ai_provider.get_active_provider_name", return_value="groq"), \
         patch("groq.AsyncGroq") as mock_groq_cls:
        
        mock_instance = AsyncMock()
        mock_groq_cls.return_value = mock_instance
        mock_instance.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps({
                "feature": "crack_detection",
                "morphology_type": "TRANSVERSE",
                "structural_significance": "MODERATE"
            })))]
        )
        
        resp = await execute_reasoning(req)
        assert resp.status == "SUCCESS"
        assert resp.validated_data["morphology_type"] == "TRANSVERSE"


def test_08_api_reason_endpoint():
    """Verify API POST /api/v4/ai/reason endpoint with form data."""
    response = client.post(
        "/api/v4/ai/reason",
        data={
            "feature": "planning_valuation",
            "prompt": "Evaluate capital appreciation for commercial plot on NH-48",
            "context_json": json.dumps({"city": "Gurugram", "plot_sq_m": 1200})
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["feature"] == "planning_valuation"
    assert "status" in data
    assert "validated_data" in data
