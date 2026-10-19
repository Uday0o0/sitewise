"""
SITEWISE V4.2 — Milestone 1 Automated Test Suite
Real Image Upload, Verification, and Deterministic Crack Candidate Analysis.

Covers:
1. Valid JPEG upload succeeds.
2. Valid PNG upload succeeds.
3. Empty, malformed, unsupported, and oversized uploads are rejected with proper status codes.
4. A renamed executable or invalid byte sequence cannot pass image validation.
5. Uploaded files are stored using generated safe names (path traversal prevention).
6. Image metadata and analysis records persist across database sessions.
7. Two different test images produce image-derived results rather than the fixed FND-104 values.
8. Synthetic image with a wider dark line produces a wider candidate in pixel space than a narrower line.
9. Missing calibration never produces a physical measurement.
10. User-provided calibration is labelled correctly and is not represented as independently verified.
11. An image with no detectable candidate does not receive a fabricated crack measurement.
12. Existing disposition workflow works on newly uploaded findings.
"""

import io
import re
import pytest
import pytest_asyncio
import numpy as np
import cv2
from PIL import Image
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from main import app
from database import engine, async_session, Base
from seed import seed
from models import UploadedImage, ImageAnalysis, Finding


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Seed test database before each test."""
    await seed()
    yield


def generate_synthetic_image(
    format_type: str = "PNG",
    line_thickness: int = 4,
    draw_line: bool = True,
    width: int = 150,
    height: int = 150,
    background_gray: int = 200,
) -> bytes:
    """Helper to generate in-memory synthetic concrete-like test images."""
    arr = np.full((height, width, 3), background_gray, dtype=np.uint8)
    if draw_line:
        # Draw dark crack-like diagonal fissure
        cv2.line(arr, (25, 25), (width - 25, height - 25), (30, 30, 30), line_thickness)

    pil_img = Image.fromarray(arr)
    buf = io.BytesIO()
    save_format = "JPEG" if format_type.upper() in ("JPEG", "JPG") else "PNG"
    pil_img.save(buf, format=save_format)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_01_valid_jpeg_upload_succeeds():
    """Verify that a valid JPEG upload succeeds with structured metadata."""
    jpeg_bytes = generate_synthetic_image("JPEG", line_thickness=3)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("pier18_crack.jpg", jpeg_bytes, "image/jpeg")},
            data={"structureElement": "Pier Cap 22 Cantilever", "gsdMmPerPx": "0.5"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["findingId"].startswith("FND-UPL-")
        assert data["imageId"].startswith("IMG-")
        assert data["analysisId"].startswith("ANA-")
        assert data["dimensions"]["channels"] == 3
        assert data["hasCandidate"] is True
        assert data["status"] == "COMPLETED"
        assert data["calibration"]["isCalibrated"] is True
        assert data["calibration"]["provenance"] == "USER_PROVIDED_UNVERIFIED"
        assert data["physicalMetrics"]["calibratedApertureMm"] is not None
        assert "HUMAN REVIEW REQUIRED" in data["disclaimer"]


@pytest.mark.asyncio
async def test_02_valid_png_upload_succeeds():
    """Verify that a valid PNG upload succeeds and generates retrievable endpoints."""
    png_bytes = generate_synthetic_image("PNG", line_thickness=4)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("deck_fissure.png", png_bytes, "image/png")},
            data={"structureElement": "Deck Slab Span 12"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["findingId"].startswith("FND-UPL-")
        assert data["hasCandidate"] is True

        # Verify image retrieval endpoint
        img_res = await ac.get(data["imageUrl"])
        assert img_res.status_code == 200
        assert img_res.headers.get("x-content-type-options") == "nosniff"

        # Verify mask overlay endpoint
        assert data["maskUrl"] is not None
        mask_res = await ac.get(data["maskUrl"])
        assert mask_res.status_code == 200
        assert mask_res.headers.get("content-type") == "image/png"


@pytest.mark.asyncio
async def test_03_empty_malformed_unsupported_oversized_rejected():
    """Verify robust rejection of invalid upload payloads."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Empty file
        res_empty = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("empty.jpg", b"", "image/jpeg")},
        )
        assert res_empty.status_code == 400

        # Malformed byte stream
        res_malformed = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("corrupt.jpg", b"NOT_AN_IMAGE_HEADER_XYZ", "image/jpeg")},
        )
        assert res_malformed.status_code == 400

        # Unsupported format (e.g. BMP / GIF / WEBP)
        bmp_buf = io.BytesIO()
        Image.new("RGB", (30, 30), color="white").save(bmp_buf, format="BMP")
        res_unsupported = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("test.bmp", bmp_buf.getvalue(), "image/bmp")},
        )
        assert res_unsupported.status_code == 415

        # Oversized file (> 25MB check)
        oversized_bytes = b"0" * (25 * 1024 * 1024 + 10)
        res_oversized = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("huge.jpg", oversized_bytes, "image/jpeg")},
        )
        assert res_oversized.status_code in (413, 400)


@pytest.mark.asyncio
async def test_04_renamed_executable_cannot_pass():
    """Verify that a Windows PE executable renamed to .jpg is rejected."""
    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00This program cannot be run in DOS mode."
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("crack_inspection.jpg", fake_exe, "image/jpeg")},
        )
        assert res.status_code == 400
        assert "cannot identify image file" in res.json()["detail"] or "Malformed" in res.json()["detail"]


@pytest.mark.asyncio
async def test_05_uploaded_files_stored_with_safe_names():
    """Verify that uploads are stored with generated UUID safe names preventing path traversal."""
    png_bytes = generate_synthetic_image("PNG")
    traversal_filename = "../../../etc/passwd_evil.png"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": (traversal_filename, png_bytes, "image/png")},
        )
        assert res.status_code == 200
        data = res.json()
        assert not data["imageUrl"].endswith("passwd_evil.png")
        assert re.match(r"^/api/v4/evidence/images/IMG-[A-Z0-9]+$", data["imageUrl"])

        # Check DB record
        async with async_session() as s:
            img_row = await s.scalar(select(UploadedImage).where(UploadedImage.id == data["imageId"]))
            assert img_row is not None
            assert not img_row.storage_key.startswith("..")
            assert img_row.storage_key.startswith("images/IMG-")


@pytest.mark.asyncio
async def test_06_metadata_and_analysis_persist_across_sessions():
    """Verify that uploaded image metadata and analysis persist across database queries."""
    jpeg_bytes = generate_synthetic_image("JPEG")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("persist_test.jpg", jpeg_bytes, "image/jpeg")},
            data={"gsdMmPerPx": "0.75"},
        )
        assert res.status_code == 200
        upload_data = res.json()
        finding_id = upload_data["findingId"]

        # Fetch analysis via separate endpoint
        ana_res = await ac.get(f"/api/v4/findings/{finding_id}/analysis")
        assert ana_res.status_code == 200
        ana_data = ana_res.json()
        assert ana_data["findingId"] == finding_id
        assert ana_data["imageId"] == upload_data["imageId"]
        assert ana_data["sha256"] == upload_data["sha256"]
        assert ana_data["algorithm"]["name"] == "SITEWISE-MORPH-BLACKHAT"
        assert ana_data["calibration"]["gsdMmPerPx"] == 0.75


@pytest.mark.asyncio
async def test_07_two_different_images_produce_different_metrics_not_fnd104():
    """Verify that different images produce genuinely different image-derived metrics."""
    # Image 1: shorter line (thickness 2, 100x100)
    img1 = generate_synthetic_image("PNG", line_thickness=2, width=100, height=100)
    # Image 2: longer line (thickness 6, 200x200)
    img2 = generate_synthetic_image("PNG", line_thickness=6, width=200, height=200)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res1 = await ac.post("/api/v4/findings/upload", files={"file": ("img1.png", img1, "image/png")})
        res2 = await ac.post("/api/v4/findings/upload", files={"file": ("img2.png", img2, "image/png")})

        data1 = res1.json()
        data2 = res2.json()

        # Both must differ from FND-104 fixed values
        assert data1["pixelMetrics"]["areaPx"] != 3360
        assert data2["pixelMetrics"]["areaPx"] != 3360

        # data1 and data2 must differ from each other
        assert data1["pixelMetrics"]["areaPx"] != data2["pixelMetrics"]["areaPx"]
        assert data1["pixelMetrics"]["traceLengthPx"] != data2["pixelMetrics"]["traceLengthPx"]


@pytest.mark.asyncio
async def test_08_controlled_test_wide_line_produces_wider_candidate():
    """
    Verify that an image with a wider dark line produces a wider candidate
    in pixel space than an otherwise equivalent image with a narrower line.
    """
    narrow_bytes = generate_synthetic_image("PNG", line_thickness=2, width=160, height=160)
    wide_bytes = generate_synthetic_image("PNG", line_thickness=7, width=160, height=160)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_narrow = await ac.post("/api/v4/findings/upload", files={"file": ("narrow.png", narrow_bytes, "image/png")})
        res_wide = await ac.post("/api/v4/findings/upload", files={"file": ("wide.png", wide_bytes, "image/png")})

        data_narrow = res_narrow.json()
        data_wide = res_wide.json()

        assert data_wide["pixelMetrics"]["meanAperturePx"] > data_narrow["pixelMetrics"]["meanAperturePx"]
        assert data_wide["pixelMetrics"]["areaPx"] > data_narrow["pixelMetrics"]["areaPx"]


@pytest.mark.asyncio
async def test_09_missing_calibration_never_produces_physical_measurement():
    """Verify that when calibration is omitted, physical dimensions are null."""
    img_bytes = generate_synthetic_image("PNG", line_thickness=4)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v4/findings/upload", files={"file": ("uncalibrated.png", img_bytes, "image/png")})
        assert res.status_code == 200
        data = res.json()

        assert data["calibration"]["isCalibrated"] is False
        assert data["calibration"]["provenance"] == "UNAVAILABLE"
        assert data["calibration"]["gsdMmPerPx"] is None
        assert data["physicalMetrics"]["calibratedApertureMm"] is None
        assert data["physicalMetrics"]["linearTraceLengthMm"] is None
        assert data["pixelMetrics"]["meanAperturePx"] is not None


@pytest.mark.asyncio
async def test_10_user_calibration_is_labelled_correctly_and_unverified():
    """Verify user calibration provenance is USER_PROVIDED_UNVERIFIED and disclaimer is clear."""
    img_bytes = generate_synthetic_image("PNG", line_thickness=4)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("user_cal.png", img_bytes, "image/png")},
            data={"gsdMmPerPx": "0.45"},
        )
        assert res.status_code == 200
        data = res.json()

        assert data["calibration"]["provenance"] == "USER_PROVIDED_UNVERIFIED"
        assert "NOT independently verified" in data["calibration"]["note"] or "CAUTION" in data["calibration"]["note"]
        assert data["physicalMetrics"]["calibratedApertureMm"] is not None


@pytest.mark.asyncio
async def test_11_blank_image_does_not_fabricate_defect():
    """Verify an image with no defect receives NO_CANDIDATE_DETECTED without fabricated values."""
    blank_bytes = generate_synthetic_image("PNG", draw_line=False, width=120, height=120)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v4/findings/upload", files={"file": ("blank.png", blank_bytes, "image/png")})
        assert res.status_code == 200
        data = res.json()

        assert data["status"] == "NO_CANDIDATE_DETECTED"
        assert data["hasCandidate"] is False
        assert data["pixelMetrics"]["areaPx"] == 0
        assert data["pixelMetrics"]["meanAperturePx"] is None
        assert data["physicalMetrics"]["calibratedApertureMm"] is None
        assert data["maskUrl"] is None


@pytest.mark.asyncio
async def test_12_disposition_workflow_on_uploaded_finding():
    """Verify resident reviewer disposition workflow operates on newly uploaded findings."""
    img_bytes = generate_synthetic_image("JPEG", line_thickness=4)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_upload = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("pier_defect.jpg", img_bytes, "image/jpeg")},
        )
        finding_id = res_upload.json()["findingId"]

        # Submit resident disposition
        disp_payload = {
            "disposition": "CONFIRM_NCR",
            "engineerNotes": "Field uploaded defect candidate confirmed upon manual tactile crack gauge review.",
            "signerName": "Lead Structural Resident",
            "signerLicenseId": "RE-2024-FIELD",
        }
        res_disp = await ac.post(f"/api/v4/findings/{finding_id}/disposition", json=disp_payload)
        assert res_disp.status_code == 200
        disp_data = res_disp.json()
        assert disp_data["newStatus"] == "CONFIRMED_NCR"
        assert len(disp_data["auditHash"]) == 64
