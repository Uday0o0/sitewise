"""
SITEWISE V4.2 — Crack Detection Summary Automated Test Suite
Verifies:
1. Blank images: uniform clean concrete produces status 'No candidates detected' and count 0.
2. Isolated noise specks: microscopic speckle noise / salt-and-pepper dots are filtered out.
3. Single narrow synthetic line: produces status 'Potential crack-like regions detected' and count 1.
4. Multiple disconnected synthetic lines: distinct separate lines produce distinct candidates without over-merging.
5. Nearby fragment grouping: broken crack fragments with small gaps (<= 10px) are bridged into 1 coherent fissure.
6. Textured image with shadows: surface texture and illumination gradients do not produce spurious candidates; crack is detected.
7. Calibrated vs uncalibrated: physical dimensions are populated only when valid calibration is provided.
8. API persistence: GET /api/v4/findings/{finding_id}/analysis returns identical crackSummary, imageResolution, and candidates.
"""

import io
import pytest
import pytest_asyncio
import numpy as np
import cv2
from PIL import Image
from httpx import AsyncClient, ASGITransport

from main import app
from seed import seed


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Ensure database is seeded before each test."""
    await seed()
    yield


def create_test_image(
    lines: list[tuple[tuple[int, int], tuple[int, int], int]] = None,
    noise_dots: list[tuple[int, int]] = None,
    width: int = 300,
    height: int = 300,
    background_gray: int = 200,
    add_texture_and_shadow: bool = False,
) -> bytes:
    """Generate in-memory test JPEG image with exact controlled lines/noise/texture."""
    if add_texture_and_shadow:
        np.random.seed(42)
        arr = np.random.randint(185, 215, (height, width, 3), dtype=np.uint8)
        # Apply shadow gradient on left half
        for x in range(width // 2):
            factor = 0.65 + 0.35 * (x / float(width // 2))
            arr[:, x] = (arr[:, x] * factor).astype(np.uint8)
    else:
        arr = np.full((height, width, 3), background_gray, dtype=np.uint8)

    # Draw specified fissure lines: [((x1, y1), (x2, y2), thickness), ...]
    if lines:
        for (pt1, pt2, thick) in lines:
            cv2.line(arr, pt1, pt2, (25, 25, 25), thick)

    # Draw specified tiny noise specks (1-2 pixel dots)
    if noise_dots:
        for (x, y) in noise_dots:
            cv2.circle(arr, (x, y), 1, (30, 30, 30), -1)

    pil_img = Image.fromarray(arr)
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_summary_blank_image():
    """Test image with clean/uniform surface produces 0 candidates and clean status."""
    img_bytes = create_test_image(lines=None, width=320, height=240)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("uniform_clean.jpg", img_bytes, "image/jpeg")},
            data={"structureElement": "Pier 12 Abutment"},
        )
        assert res.status_code == 200
        data = res.json()
        summary = data["crackSummary"]
        assert summary["status"] in ("No candidates detected", "No potential cracks detected")
        assert summary["candidateCount"] == 0
        assert summary["imageResolution"] == "320 × 240 px"
        assert "No potential crack-like regions were detected" in summary["explanation"]
        assert "Candidate regions are not confirmed physical cracks" in summary["preliminaryReviewNotice"] or "human" in summary["preliminaryReviewNotice"]
        assert len(summary["candidates"]) == 0


@pytest.mark.asyncio
async def test_summary_isolated_noise_specks():
    """Test that isolated microscopic noise specks are filtered out and not counted as candidates."""
    noise_dots = [(40, 40), (100, 60), (180, 120), (70, 210), (250, 250), (210, 50)]
    img_bytes = create_test_image(lines=None, noise_dots=noise_dots)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("noisy_surface.jpg", img_bytes, "image/jpeg")},
            data={"structureElement": "Pier Cap 4"},
        )
        assert res.status_code == 200
        data = res.json()
        summary = data["crackSummary"]
        # Noise specks must NOT qualify as candidates
        assert summary["status"] in ("No candidates detected", "No potential cracks detected")
        assert summary["candidateCount"] == 0
        assert len(summary["candidates"]) == 0


@pytest.mark.asyncio
async def test_summary_single_narrow_line():
    """Test image with single crack line produces 1 candidate with valid metrics and no clutter."""
    img_bytes = create_test_image(lines=[((40, 40), (220, 220), 4)], width=400, height=300)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("single_crack.jpg", img_bytes, "image/jpeg")},
            data={"structureElement": "Pier 14 Column"},
        )
        assert res.status_code == 200
        data = res.json()
        summary = data["crackSummary"]
        assert summary["status"] in ("Potential crack-like regions detected", "Potential cracks detected")
        assert summary["candidateCount"] == 1
        assert "1 potential crack-like region" in summary["candidateCountLabel"]
        assert summary["imageResolution"] == "400 × 300 px"
        assert len(summary["candidates"]) == 1
        c1 = summary["candidates"][0]
        assert c1["id"] == "Candidate 1"
        assert c1["areaPx"] > 50
        assert c1["traceLengthPx"] > 50
        assert c1["meanWidthPx"] > 0
        assert c1["maxWidthPx"] > 0
        assert len(c1["boundingBox"]) == 4
        assert len(c1["centroid"]) == 2


@pytest.mark.asyncio
async def test_summary_multiple_disconnected_lines():
    """Test image with three separate disconnected crack lines produces 3 distinct candidates."""
    lines = [
        ((30, 30), (120, 30), 4),       # Top line
        ((30, 150), (120, 230), 4),     # Bottom-left line
        ((200, 80), (280, 160), 4),     # Right diagonal
    ]
    img_bytes = create_test_image(lines=lines)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("multi_crack.jpg", img_bytes, "image/jpeg")},
            data={"structureElement": "Deck Slab Span 3"},
        )
        assert res.status_code == 200
        data = res.json()
        summary = data["crackSummary"]
        assert summary["status"] in ("Potential crack-like regions detected", "Potential cracks detected")
        assert summary["candidateCount"] == 3
        assert "3 potential crack-like regions detected" in summary["candidateCountLabel"]
        assert len(summary["candidates"]) == 3
        candidate_ids = [c["id"] for c in summary["candidates"]]
        assert candidate_ids == ["Candidate 1", "Candidate 2", "Candidate 3"]


@pytest.mark.asyncio
async def test_summary_nearby_fragments_grouped():
    """Test that nearby fragments along the same fissure (separated by <= 10px) are merged into 1 candidate."""
    # Two line segments separated by a 6px gap along the diagonal
    lines = [
        ((40, 40), (100, 100), 4),
        ((106, 106), (180, 180), 4),
    ]
    img_bytes = create_test_image(lines=lines)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("broken_crack.jpg", img_bytes, "image/jpeg")},
            data={"structureElement": "Abutment Retaining Wall"},
        )
        assert res.status_code == 200
        data = res.json()
        summary = data["crackSummary"]
        # The 6px gap must be bridged by the grouping rule, yielding exactly 1 candidate
        assert summary["candidateCount"] == 1
        assert summary["candidates"][0]["id"] == "Candidate 1"
        assert summary["candidates"][0]["traceLengthPx"] > 100


@pytest.mark.asyncio
async def test_summary_textured_image_with_shadows():
    """Test that concrete aggregate texture and illumination gradients do not produce false positive clutter."""
    # A textured image with shadow gradient, plus 1 real crack line
    lines = [((50, 150), (250, 160), 4)]
    img_bytes = create_test_image(lines=lines, add_texture_and_shadow=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("textured_shadow_concrete.jpg", img_bytes, "image/jpeg")},
            data={"structureElement": "Pier 7 Cantilever"},
        )
        assert res.status_code == 200
        data = res.json()
        summary = data["crackSummary"]
        # The single genuine crack line is detected, and texture/shadows do not explode into hundreds of candidates
        assert summary["candidateCount"] == 1
        assert summary["candidates"][0]["id"] == "Candidate 1"
        assert summary["candidates"][0]["areaPx"] > 100


@pytest.mark.asyncio
async def test_summary_calibration_provenance():
    """Test physical metrics are present and labelled unverified when calibrated, and null when uncalibrated."""
    lines = [((40, 40), (160, 160), 4)]
    img_bytes = create_test_image(lines=lines)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Uncalibrated upload
        res_uncal = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("uncal.jpg", img_bytes, "image/jpeg")},
            data={"structureElement": "Pier 5"},
        )
        assert res_uncal.status_code == 200
        uncal_summary = res_uncal.json()["crackSummary"]
        assert uncal_summary["isCalibrated"] is False
        assert uncal_summary["calibrationProvenance"] == "UNAVAILABLE"
        assert "uncalibrated pixel-space only" in uncal_summary["calibrationStatusText"]
        assert uncal_summary["candidates"][0]["calibratedWidthMm"] is None
        assert uncal_summary["candidates"][0]["calibratedLengthMm"] is None

        # Calibrated upload with 0.5 mm/px GSD
        res_cal = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("cal.jpg", img_bytes, "image/jpeg")},
            data={"structureElement": "Pier 5", "userGsdMmPerPx": "0.5"},
        )
        assert res_cal.status_code == 200
        cal_data = res_cal.json()
        cal_summary = cal_data["crackSummary"]
        assert cal_summary["isCalibrated"] is True
        assert cal_summary["calibrationProvenance"] == "USER_PROVIDED_UNVERIFIED"
        assert "calibrated with user-supplied unverified calibration" in cal_summary["calibrationStatusText"]
        assert cal_summary["candidates"][0]["calibratedWidthMm"] is not None
        assert cal_summary["candidates"][0]["calibratedWidthMm"] > 0
        assert cal_summary["candidates"][0]["calibratedLengthMm"] is not None
        assert cal_summary["candidates"][0]["calibratedLengthMm"] > 0

        # Verify GET /analysis persistence
        finding_id = cal_data["findingId"]
        res_get = await ac.get(f"/api/v4/findings/{finding_id}/analysis")
        assert res_get.status_code == 200
        get_summary = res_get.json()["crackSummary"]
        assert get_summary["candidateCount"] == cal_summary["candidateCount"]
        assert get_summary["imageResolution"] == cal_summary["imageResolution"]
        assert get_summary["calibrationStatusText"] == cal_summary["calibrationStatusText"]
        assert get_summary["candidates"][0]["calibratedWidthMm"] == cal_summary["candidates"][0]["calibratedWidthMm"]
