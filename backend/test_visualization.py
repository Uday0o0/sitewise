"""Unit and API tests for Conceptual Architectural Visualisation."""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import main
from services.architectural_visualizer_service import (
    VisualizationRequest,
    generate_conceptual_visualization,
    _construct_prompt,
    DISCLAIMER_TEXT,
    get_visualization_options
)

client = TestClient(main.app)


def test_01_options_endpoint():
    """Verify options endpoint returns valid styles, building types, and legal disclaimer."""
    response = client.get("/api/v4/architectural-preview/options")
    assert response.status_code == 200
    data = response.json()
    assert "building_types" in data
    assert "residential_apartment" in data["building_types"]
    assert "commercial_office" in data["building_types"]
    assert "architectural_styles" in data
    assert "modern_sustainable" in data["architectural_styles"]
    assert "features" in data
    assert len(data["features"]) >= 5
    assert "disclaimer" in data
    assert "CONCEPTUAL VISUALISATION ONLY" in data["disclaimer"]


def test_02_prompt_construction():
    """Verify architectural prompt compiles accurately from specifications."""
    req = VisualizationRequest(
        project_id="PRJ-TEST",
        building_type="commercial_office",
        style="contemporary_glass",
        floors=12,
        context_environment="urban_highway",
        features=["Solar PV rooftop array", "EV charging shaded parking bays"],
        custom_notes="Double-height entrance lobby"
    )
    prompt = _construct_prompt(req)
    assert "12-storey" in prompt
    assert "corporate office complex" in prompt
    assert "contemporary international style" in prompt
    assert "urban highway" in prompt
    assert "Solar PV rooftop array" in prompt
    assert "Double-height entrance lobby" in prompt
    assert "Daylight illumination" in prompt


def test_03_successful_generation_mock():
    """Verify successful generation pipeline response structure, provenance, and disclaimer."""
    req = VisualizationRequest(
        project_id="PRJ-NH48-PKG3",
        building_type="industrial_warehouse",
        floors=2,
        style="brutalist_concrete"
    )
    fake_img_bytes = b"fake-jpeg-image-bytes-over-one-thousand-bytes-length" * 30
    
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = fake_img_bytes
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        
        result = generate_conceptual_visualization(req)
        assert result.status == "SUCCESS"
        assert result.provenance == "AI_GENERATED_CONCEPTUAL"
        assert result.image_base64 is not None
        assert result.image_base64.startswith("data:image/jpeg;base64,")
        assert result.disclaimer == DISCLAIMER_TEXT
        assert len(result.limitations) > 0


def test_04_provider_unavailable_handling():
    """Verify that network errors or provider timeout gracefully return PROVIDER_UNAVAILABLE without crashing."""
    req = VisualizationRequest(
        project_id="PRJ-NH48-PKG3",
        building_type="residential_apartment",
        floors=5
    )
    
    with patch("urllib.request.urlopen", side_effect=Exception("Connection refused or timed out")):
        result = generate_conceptual_visualization(req)
        assert result.status == "PROVIDER_UNAVAILABLE"
        assert result.provenance == "PROVIDER_UNAVAILABLE"
        assert result.image_url is None
        assert result.disclaimer == DISCLAIMER_TEXT
        assert any("unreachable" in lim.lower() for lim in result.limitations)


def test_05_api_endpoint_post():
    """Verify POST API endpoint validation and response serialization."""
    payload = {
        "building_type": "residential_apartment",
        "style": "vernacular_brick",
        "floors": 4,
        "context_environment": "suburban_greenery",
        "features": ["Perforated solar jaali facade"],
        "custom_notes": "Courtyard layout"
    }
    response = client.post("/api/v4/projects/PRJ-NH48-PKG3/architectural-preview", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] == "PRJ-NH48-PKG3"
    assert data["status"] in ["SUCCESS", "PROVIDER_UNAVAILABLE"]
    assert "disclaimer" in data
    assert "CONCEPTUAL VISUALISATION ONLY" in data["disclaimer"]
    assert "specifications_summary" in data


def test_06_floor_validation_bounds():
    """Verify input validation rejects invalid floor counts."""
    # Floor 0 (below min 1)
    res_zero = client.post("/api/v4/projects/PRJ-01/architectural-preview", json={"floors": 0})
    assert res_zero.status_code == 422
    
    # Floor 100 (above max 50)
    res_high = client.post("/api/v4/projects/PRJ-01/architectural-preview", json={"floors": 100})
    assert res_high.status_code == 422
