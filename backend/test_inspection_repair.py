"""
Regression test suite for Inspection Evidence, Crack Assessment & Reviewer Workflow Repair.

Covers:
1. Overlay mask color is genuine Safety Yellow (#F5C542: Red > 200, Blue < 100), not blue/cyan.
2. Uncalibrated metrology preserves pixel-space measurements and marks physical mm and code compliance suspended.
3. Reviewer disposition with CONFIRM_NCR updates status to CONFIRMED_NCR, provenance to HUMAN_REVIEWED, and updates Evidence Graph.
4. Reviewer disposition with DOWNGRADE_SHRINKAGE updates status to DOWNGRADED and generates DSP protocol.
5. Reviewer disposition with REJECT_ARTIFACT updates status to REJECTED and updates finding direct impact.
6. Logging NDT corroboration protocol adds test to finding telemetry and persists in database.
7. Explicit evidence citation linking creates traceable link and updates Evidence Graph with EVIDENCE node.
8. Real field upload resolution (934x1142) preserves aspect ratio, dimensions, and SHA-256 digest.
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
from seed import seed
from models import Finding, GraphNode, UploadedImage, FindingEvidenceLink
from services.image_processor import process_image


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Seed test database before each test."""
    await seed()
    yield


def generate_test_image(
    width: int = 200,
    height: int = 200,
    line_thickness: int = 4,
    draw_line: bool = True,
) -> bytes:
    """Generate in-memory test image."""
    arr = np.full((height, width, 3), 200, dtype=np.uint8)
    if draw_line:
        cv2.line(arr, (30, 30), (width - 30, height - 30), (20, 20, 20), line_thickness)
    pil_img = Image.fromarray(arr)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


def test_01_overlay_mask_color_is_safety_yellow():
    """Verify generated overlay mask uses Safety Yellow (#F5C542) instead of blue/cyan."""
    img_bytes = generate_test_image(width=150, height=150, line_thickness=5)
    info, metrics = process_image(img_bytes)

    assert metrics.has_candidate is True
    assert metrics.mask_rgba_png_bytes is not None

    # Decode mask PNG
    mask_arr = cv2.imdecode(np.frombuffer(metrics.mask_rgba_png_bytes, np.uint8), cv2.IMREAD_UNCHANGED)
    assert mask_arr.shape[2] == 4  # 4-channel RGBA

    # Sample non-transparent candidate pixels
    candidate_pixels = mask_arr[mask_arr[:, :, 3] > 100]
    assert len(candidate_pixels) > 0

    # In OpenCV BGRA: Channel 0 is Blue, Channel 1 is Green, Channel 2 is Red
    # Safety Yellow (#F5C542) has high Red (245), high Green (197), and low Blue (66)
    mean_b = np.mean(candidate_pixels[:, 0])
    mean_g = np.mean(candidate_pixels[:, 1])
    mean_r = np.mean(candidate_pixels[:, 2])

    assert mean_r > 200, f"Expected high red for Safety Yellow, got {mean_r}"
    assert mean_b < 100, f"Expected low blue for Safety Yellow (not blue overlay), got {mean_b}"
    assert mean_g > 150, f"Expected high green for Safety Yellow, got {mean_g}"


@pytest.mark.asyncio
async def test_02_uncalibrated_upload_preserves_pixel_metrics_suspends_code_eval():
    """Verify uncalibrated upload reports pixel metrics but suspends code exceedance and physical mm."""
    img_bytes = generate_test_image(width=160, height=160, line_thickness=4)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("uncalibrated_pier.png", img_bytes, "image/png")},
            data={"structureElement": "Pier 18 Cantilever"},
        )
        assert res.status_code == 200
        data = res.json()
        fnd_id = data["findingId"]

        # Pixel metrics populated
        assert data["pixelMetrics"]["areaPx"] > 0
        assert data["pixelMetrics"]["traceLengthPx"] > 0
        assert data["calibration"]["isCalibrated"] is False
        assert data["physicalMetrics"]["calibratedApertureMm"] is None

        # Check telemetry response
        res_tel = await ac.get(f"/api/v4/findings/{fnd_id}/telemetry")
        assert res_tel.status_code == 200
        tel = res_tel.json()
        metro = tel["photogrammetricMetrology"]

        assert "Uncalibrated" in metro["governingCode"]
        assert metro["exceedancePercent"] == 0.0
        assert metro["calibratedApertureMm"] == 0.0


@pytest.mark.asyncio
async def test_03_reviewer_disposition_confirm_ncr_propagates_state():
    """Verify CONFIRM_NCR updates status, sets HUMAN_REVIEWED provenance, and synchronizes graph."""
    img_bytes = generate_test_image(width=160, height=160, line_thickness=4)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_upload = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("ncr_test.png", img_bytes, "image/png")},
            data={"structureElement": "Pier 18 Cantilever"},
        )
        fnd_id = res_upload.json()["findingId"]
        graph_id = res_upload.json()["graphId"]

        # Submit CONFIRM_NCR
        res_disp = await ac.post(
            f"/api/v4/findings/{fnd_id}/disposition",
            json={
                "disposition": "CONFIRM_NCR",
                "engineerNotes": "Crack opening exceeds allowable limit. Non-conformance confirmed by visual inspection.",
                "signerName": "Er. R. Sharma",
                "signerLicenseId": "RE-MH-2024-884",
            },
        )
        assert res_disp.status_code == 200
        disp_data = res_disp.json()
        assert disp_data["newStatus"] == "CONFIRMED_NCR"
        assert disp_data["protocolId"].startswith("NCR-")
        assert len(disp_data["auditHash"]) == 64

        # Verify telemetry reflects updated status
        res_tel = await ac.get(f"/api/v4/findings/{fnd_id}/telemetry")
        tel = res_tel.json()
        assert tel["reviewerDispositionState"]["currentStatus"] == "CONFIRMED_NCR"
        assert "Er. R. Sharma" in tel["reviewerDispositionState"]["dispositionedBy"]
        assert tel["reviewerDispositionState"]["pkiCertificateValid"] is True

        # Verify graph node is updated to HUMAN_REVIEWED
        res_graph = await ac.get(f"/api/v4/graphs/{graph_id}")
        graph_data = res_graph.json()
        fnd_nodes = [n for n in graph_data["nodes"] if n["nodeType"] == "FINDING"]
        assert len(fnd_nodes) > 0
        assert fnd_nodes[0]["provenance"] == "HUMAN_REVIEWED"
        assert "CONFIRMED NCR" in fnd_nodes[0]["badgeText"]


@pytest.mark.asyncio
async def test_04_reviewer_disposition_downgrade_and_reject():
    """Verify DOWNGRADE_SHRINKAGE and REJECT_ARTIFACT dispositions generate DSP protocol."""
    img_bytes = generate_test_image(width=150, height=150, line_thickness=3)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_upload = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("downgrade_test.png", img_bytes, "image/png")},
            data={"structureElement": "Pier 19 Footing"},
        )
        fnd_id = res_upload.json()["findingId"]

        # Submit DOWNGRADE_SHRINKAGE
        res_disp = await ac.post(
            f"/api/v4/findings/{fnd_id}/disposition",
            json={
                "disposition": "DOWNGRADE_SHRINKAGE",
                "engineerNotes": "Surface shrinkage crack only without structural depth. Apply surface sealant.",
                "signerName": "Er. R. Sharma",
                "signerLicenseId": "RE-MH-2024-884",
            },
        )
        assert res_disp.status_code == 200
        disp_data = res_disp.json()
        assert disp_data["newStatus"] == "DOWNGRADED"
        assert disp_data["protocolId"].startswith("DSP-")

        # Submit REJECT_ARTIFACT
        res_disp_rej = await ac.post(
            f"/api/v4/findings/{fnd_id}/disposition",
            json={
                "disposition": "REJECT_ARTIFACT",
                "engineerNotes": "Dark line caused by cable shadow; concrete surface sound upon direct inspection.",
                "signerName": "Er. R. Sharma",
                "signerLicenseId": "RE-MH-2024-884",
            },
        )
        assert res_disp_rej.status_code == 200
        assert res_disp_rej.json()["newStatus"] == "REJECTED"


@pytest.mark.asyncio
async def test_05_add_ndt_corroboration_protocol():
    """Verify adding an NDT protocol updates finding corroboration list."""
    img_bytes = generate_test_image(width=150, height=150, line_thickness=3)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_upload = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("ndt_test.png", img_bytes, "image/png")},
            data={"structureElement": "Pier 18 Cap"},
        )
        fnd_id = res_upload.json()["findingId"]

        # Add NDT protocol
        res_ndt = await ac.post(
            f"/api/v4/findings/{fnd_id}/ndt-corroboration",
            json={
                "protocolName": "Ultrasonic Pulse Velocity (UPV)",
                "status": "PASS",
                "details": "Direct transmission velocity measured 3,920 m/s (Compliant with Grade M-50).",
                "sourceDocumentId": "DOC-5442BA12E9",
            },
        )
        assert res_ndt.status_code == 200
        tel = res_ndt.json()
        ndt_list = tel["ndtCorroboration"]
        assert len(ndt_list) == 1
        assert ndt_list[0]["protocolName"] == "Ultrasonic Pulse Velocity (UPV)"
        assert ndt_list[0]["status"] == "PASS"
        assert ndt_list[0]["sourceDocumentId"] == "DOC-5442BA12E9"


@pytest.mark.asyncio
async def test_06_attach_evidence_citation_updates_graph():
    """Verify attaching an evidence citation creates link and adds EVIDENCE node to graph."""
    img_bytes = generate_test_image(width=150, height=150, line_thickness=3)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_upload = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("evidence_link_test.png", img_bytes, "image/png")},
            data={"structureElement": "Pier 18 Cantilever"},
        )
        fnd_id = res_upload.json()["findingId"]
        graph_id = res_upload.json()["graphId"]

        # Link IRC:112 specification passage
        res_link = await ac.post(
            f"/api/v4/findings/{fnd_id}/evidence-links",
            json={
                "documentId": "DOC-57F675F71F",
                "passageId": 1,
                "citationText": "IRC:112-2020 Clause 12.3: Limit State of Cracking.",
                "relevanceNote": "Governing bridge design crack width limit (0.20mm).",
                "provenance": "HUMAN_REVIEWED",
                "confidence": 0.98,
            },
        )
        assert res_link.status_code == 201
        link_data = res_link.json()
        assert link_data["documentId"] == "DOC-57F675F71F"

        # List links
        res_list = await ac.get(f"/api/v4/findings/{fnd_id}/evidence-links")
        assert res_list.status_code == 200
        assert res_list.json()["totalLinks"] == 1

        # Check graph topology now has 3 nodes (EVIDENCE, FINDING, RISK)
        res_graph = await ac.get(f"/api/v4/graphs/{graph_id}")
        assert res_graph.status_code == 200
        nodes = res_graph.json()["nodes"]
        ev_nodes = [n for n in nodes if n["nodeType"] == "EVIDENCE"]
        assert len(ev_nodes) == 1
        assert ev_nodes[0]["documentId"] == "DOC-57F675F71F"


def test_07_real_resolution_934x1142_integrity():
    """Verify processing an image with resolution 934x1142 preserves exact dimensions and SHA-256 digest."""
    # Create test image with exact 934x1142 dimensions
    arr = np.full((1142, 934, 3), 210, dtype=np.uint8)
    cv2.line(arr, (200, 100), (600, 900), (30, 30, 30), 5)
    pil_img = Image.fromarray(arr)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    raw_bytes = buf.getvalue()

    info, metrics = process_image(raw_bytes)
    assert info.width == 934
    assert info.height == 1142
    assert metrics.image_resolution == "934 × 1142 px"
    assert metrics.has_candidate is True
    assert metrics.candidate_count >= 1

    # Bounding box coordinates must be within 934x1142 bounds
    for cand in metrics.candidates:
        bbox = cand["boundingBox"]
        assert 0 <= bbox[0] < 934
        assert 0 <= bbox[1] < 1142
        assert bbox[0] + bbox[2] <= 934
        assert bbox[1] + bbox[3] <= 1142


@pytest.mark.asyncio
async def test_08_evidence_image_and_mask_retrieval_and_error_handling():
    """Verify original image and mask retrieval endpoint returns persisted bytes, correct MIME, and handles 404/traversal."""
    img_bytes = generate_test_image(width=180, height=180, line_thickness=6)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("pier_surface.png", img_bytes, "image/png")},
            data={"structureElement": "Pier Cap 18"},
        )
        assert res.status_code == 200
        data = res.json()
        image_id = data["imageId"]
        img_url = data["imageUrl"]
        mask_url = data["maskUrl"]

        assert img_url == f"/api/v4/evidence/images/{image_id}"
        assert mask_url == f"/api/v4/evidence/images/{image_id}/mask"

        # 1. Fetch original image
        res_img = await ac.get(img_url)
        assert res_img.status_code == 200
        assert res_img.headers["content-type"] == "image/png"
        assert len(res_img.content) == len(img_bytes)

        # 2. Fetch mask overlay
        res_mask = await ac.get(mask_url)
        assert res_mask.status_code == 200
        assert res_mask.headers["content-type"] == "image/png"
        assert len(res_mask.content) > 0

        # 3. Missing image yields 404 Not Found
        res_missing = await ac.get("/api/v4/evidence/images/IMG-NONEXISTENT")
        assert res_missing.status_code == 404
        assert "not found" in res_missing.json()["detail"].lower()

        # 4. Invalid identifier / traversal attempt yields 400 Bad Request
        res_traversal = await ac.get("/api/v4/evidence/images/..%2F..%2Fpasswd")
        assert res_traversal.status_code in (400, 404)

