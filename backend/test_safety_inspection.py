"""Unit and API tests for Construction Site Safety Image Inspection (Activity 2.1)."""

import pytest
import io
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

import main
from services.safety_analysis_service import (
    validate_image_bytes,
    compute_deterministic_site_metrics,
    analyze_construction_safety_image,
    SafetyAnalysisRequest,
    MAX_UPLOAD_SIZE_BYTES
)

client = TestClient(main.app)


def _create_test_image(width=400, height=300, color=(128, 128, 128), add_vest=False, is_dark=False):
    """Helper to create synthetic test JPEG bytes."""
    fill = (20, 20, 20) if is_dark else color
    img = Image.new("RGB", (width, height), color=fill)
    draw = ImageDraw.Draw(img)
    if add_vest:
        # Draw fluorescent orange/yellow rectangle to simulate safety vest
        draw.rectangle([100, 100, 200, 250], fill=(255, 140, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_01_standards_endpoint():
    """Verify standards endpoint returns OSHA 1926, BOCW Act, and IS clauses."""
    response = client.get("/api/v4/safety-inspection/standards")
    assert response.status_code == 200
    data = response.json()
    assert "OSHA 1926.100" in data
    assert "OSHA 1926.501" in data
    assert "BOCW Act 1996 Cl. 38" in data


def test_02_empty_image_rejection():
    """Verify empty image payload is rejected with 400."""
    with pytest.raises(ValueError, match="empty"):
        validate_image_bytes(b"")


def test_03_corrupt_image_rejection():
    """Verify corrupt non-image bytes are rejected with 400."""
    corrupt_bytes = b"NOT_A_REAL_IMAGE_DATA_HEADER_CORRUPTED"
    with pytest.raises(ValueError, match="corrupt or unrecognized"):
        validate_image_bytes(corrupt_bytes)


def test_04_oversized_image_rejection():
    """Verify file exceeding 25MB is rejected."""
    # Create simulated oversized byte array
    fake_oversized = b"x" * (MAX_UPLOAD_SIZE_BYTES + 1024)
    with pytest.raises(ValueError, match="exceeds maximum permissible upload size"):
        validate_image_bytes(fake_oversized)


def test_05_valid_synthetic_image_cv_metrics():
    """Verify valid synthetic image decodes and computes deterministic CV metrics."""
    raw = _create_test_image(width=200, height=150, add_vest=True)
    cv_img, meta = validate_image_bytes(raw)
    assert meta["width"] == 200
    assert meta["height"] == 150
    assert meta["channels"] == 3

    metrics = compute_deterministic_site_metrics(cv_img)
    assert "mean_luminance" in metrics
    assert "highvis_pixel_ratio" in metrics
    assert metrics["highvis_pixel_ratio"] > 0.05  # Detected fluorescent rectangle


def test_06_low_lighting_hazard_detection():
    """Verify dark image triggers insufficient illumination hazard."""
    dark_raw = _create_test_image(is_dark=True)
    cv_img, _ = validate_image_bytes(dark_raw)
    metrics = compute_deterministic_site_metrics(cv_img)
    assert metrics["is_poor_lighting"] is True


@pytest.mark.asyncio
async def test_07_analyze_service_execution():
    """Verify end-to-end service execution on synthetic worksite image."""
    raw = _create_test_image(add_vest=True)
    req = SafetyAnalysisRequest(
        project_id="PRJ-NH48-PKG3",
        site_location="Pier 18 Worksite",
        activity_type="Erection of precast girders"
    )
    result = await analyze_construction_safety_image(raw, req)
    assert result.status == "COMPLETED"
    assert result.project_id == "PRJ-NH48-PKG3"
    assert "MANDATORY SAFETY DISCLAIMER" in result.uncertainty_disclaimer
    assert len(result.applicable_standards) >= 4
    assert "ppe_compliance" in result.model_dump()


def test_08_api_analyze_endpoint():
    """Verify POST /api/v4/safety-inspection/analyze endpoint with multipart form."""
    raw = _create_test_image(add_vest=True)
    response = client.post(
        "/api/v4/safety-inspection/analyze",
        data={
            "project_id": "PRJ-NH48-PKG3",
            "site_location": "Slab Pouring Sector 4",
            "activity_type": "Reinforced Concrete Casting"
        },
        files={"image": ("site_photo.jpg", raw, "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"
    assert "overall_risk_level" in data
    assert "uncertainty_disclaimer" in data
