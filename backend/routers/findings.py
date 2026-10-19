"""Findings / Inspection Workbench API routes including real image upload and analysis."""

from __future__ import annotations
import os
import uuid
import hashlib
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database import get_db
from models import Finding, UploadedImage, ImageAnalysis, Document, DocumentPassage, FindingEvidenceLink, Project
from schemas import (
    InspectionTelemetryResponse, CaptureSource, PhotogrammetricMetrology,
    NdtCorroborationItem, ReviewerDispositionState,
    DispositionUpdateRequest, DispositionUpdateResponse,
    FindingUploadResponse, FindingAnalysisResponse, FindingListItem,
    ImageDimensions, PixelMetrics, PhysicalMetrics, CalibrationInfo,
    AlgorithmInfo, UploadedImageMetadata, CandidateRegion, CrackDetectionSummary,
    FindingEvidenceLinkCreate, FindingEvidenceLinkResponse, FindingEvidenceLinksListResponse,
)
from services.image_processor import process_image, ImageValidationError, MAX_UPLOAD_SIZE_BYTES

router = APIRouter(prefix="/api/v4/findings", tags=["findings"])

UPLOAD_DIR = os.getenv(
    "SITEWISE_UPLOAD_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
)


@router.get("", response_model=list[FindingListItem])
@router.get("/", response_model=list[FindingListItem])
async def list_findings(db: AsyncSession = Depends(get_db)):
    """
    List all findings available for inspection, distinguishing between
    seeded demo findings and newly uploaded real inspection findings.
    """
    result = await db.execute(select(Finding).order_by(Finding.id))
    findings = result.scalars().all()

    items = []
    for f in findings:
        is_uploaded = bool(f.image_id or f.id.startswith("FND-UPL"))
        mask_url = f"/api/v4/evidence/images/{f.image_id}/mask" if f.image_id else None
        items.append(
            FindingListItem(
                id=f.id,
                title=f.title,
                structureElement=f.structure_element or f.location_desc or "",
                chainageFormatted=f.chainage_formatted or "",
                provenance=f.provenance,
                category=f.category or "structural",
                dispositionStatus=f.disposition_status or "AWAITING_REVIEW",
                isUploaded=is_uploaded,
                imageUrl=f.image_url,
                maskUrl=mask_url,
                calibratedApertureMm=f.calibrated_aperture_mm,
                linearTraceLengthMm=f.linear_trace_length_mm,
            )
        )
    return items


@router.post("/upload", response_model=FindingUploadResponse)
async def upload_finding_image(
    file: UploadFile = File(...),
    structure_element: Optional[str] = Form(None),
    structureElement: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None),
    projectId: Optional[str] = Form(None),
    gsd_mm_per_px: Optional[float] = Form(None),
    gsdMmPerPx: Optional[float] = Form(None),
    userGsdMmPerPx: Optional[float] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload and analyze an inspection image for concrete crack candidates.
    Validates image data, computes SHA-256 digest, performs deterministic
    black-hat segmentation, saves original image and mask overlay, and
    creates persistent database records.
    NOTE: Project-level multi-tenant authorization is not yet implemented in this development version.
    """
    # Normalize inputs (accept both snake_case and camelCase form fields)
    elem = structure_element or structureElement or "Inspected Structural Element"
    prj_id = project_id or projectId or "PRJ-NH48-PKG3"
    gsd_input = gsd_mm_per_px if gsd_mm_per_px is not None else (gsdMmPerPx if gsdMmPerPx is not None else userGsdMmPerPx)

    # Read uploaded bytes with size validation
    try:
        content = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file payload: {str(exc)}",
        )

    if not content or len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file uploaded. Please select a valid JPEG or PNG image.",
        )

    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Upload exceeds maximum allowable size of 25 MB (Received {len(content)} bytes).",
        )

    # Validate calibration value: only accept positive numbers
    cal_gsd: Optional[float] = None
    if gsd_input is not None:
        try:
            val = float(gsd_input)
            if val > 0.0:
                cal_gsd = val
            else:
                raise ValueError("Calibration GSD must be greater than zero.")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid calibration parameter 'gsdMmPerPx'. Must be a positive numerical value in mm/px.",
            )

    # Execute deterministic image processing
    try:
        info, metrics = process_image(content, user_gsd_mm_per_px=cal_gsd)
    except ImageValidationError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message)
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image decoding failed: {str(err)}",
        )

    # Generate safe non-colliding IDs and storage filenames
    # Never use user-supplied filename directly to prevent path traversal
    image_uuid = uuid.uuid4().hex[:12].upper()
    image_id = f"IMG-{image_uuid}"
    finding_uuid = uuid.uuid4().hex[:8].upper()
    finding_id = f"FND-UPL-{finding_uuid}"
    analysis_uuid = uuid.uuid4().hex[:12].upper()
    analysis_id = f"ANA-{analysis_uuid}"

    ext = "jpg" if info.format in ("JPEG", "JPG") else "png"
    storage_filename = f"{image_id}.{ext}"
    storage_key = f"images/{storage_filename}"
    images_dir = os.path.join(UPLOAD_DIR, "images")
    masks_dir = os.path.join(UPLOAD_DIR, "masks")
    os.makedirs(images_dir, exist_ok=True)
    os.makedirs(masks_dir, exist_ok=True)

    abs_img_path = os.path.join(images_dir, storage_filename)
    with open(abs_img_path, "wb") as f_out:
        f_out.write(content)

    mask_storage_key: Optional[str] = None
    if metrics.has_candidate and metrics.mask_rgba_png_bytes:
        mask_filename = f"{image_id}_mask.png"
        mask_storage_key = f"masks/{mask_filename}"
        abs_mask_path = os.path.join(masks_dir, mask_filename)
        with open(abs_mask_path, "wb") as f_mask:
            f_mask.write(metrics.mask_rgba_png_bytes)

    # Persist records in SQLite via SQLAlchemy
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"

    uploaded_img_record = UploadedImage(
        id=image_id,
        project_id=prj_id,
        finding_id=finding_id,
        original_filename=os.path.basename(file.filename or "uploaded_image"),
        file_size_bytes=info.file_size_bytes,
        mime_type=info.mime_type,
        sha256_hash=info.sha256_hash,
        storage_key=storage_key,
        mask_storage_key=mask_storage_key,
        width=info.width,
        height=info.height,
        channels=info.channels,
        color_mode=info.color_mode,
        structure_element=elem,
        user_gsd_mm_per_px=metrics.user_gsd_mm_per_px,
        calibration_provenance=metrics.calibration_provenance,
        uploaded_at=now_iso,
    )
    db.add(uploaded_img_record)

    analysis_record = ImageAnalysis(
        id=analysis_id,
        image_id=image_id,
        finding_id=finding_id,
        algorithm_name=metrics.algorithm_name,
        algorithm_version=metrics.algorithm_version,
        status=metrics.status,
        has_candidate=metrics.has_candidate,
        candidate_pixel_area=metrics.candidate_pixel_area,
        candidate_trace_length_px=metrics.candidate_trace_length_px,
        candidate_mean_aperture_px=metrics.candidate_mean_aperture_px,
        candidate_max_aperture_px=metrics.candidate_max_aperture_px,
        calibrated_aperture_mm=metrics.calibrated_aperture_mm,
        linear_trace_length_mm=metrics.linear_trace_length_mm,
        calibration_provenance=metrics.calibration_provenance,
        user_gsd_mm_per_px=metrics.user_gsd_mm_per_px,
        processing_time_ms=metrics.processing_time_ms,
        disclaimer=metrics.disclaimer,
        limitations=metrics.limitations,
        metrics_json=metrics.raw_metrics,
        created_at=now_iso,
    )

    # Build CrackDetectionSummary
    candidates_models = [CandidateRegion(**c) for c in metrics.candidates]
    crack_summary = CrackDetectionSummary(
        status=metrics.summary_status,
        candidateCount=metrics.candidate_count,
        candidateCountLabel=(
            f"{metrics.candidate_count} potential crack-like region{'s' if metrics.candidate_count != 1 else ''} detected"
            if metrics.candidate_count > 0
            else "No candidates detected"
        ),
        imageResolution=metrics.image_resolution,
        calibrationStatusText=metrics.calibration_status_text,
        explanation=metrics.plain_explanation,
        preliminaryReviewNotice=metrics.preliminary_notice,
        candidates=candidates_models,
        isCalibrated=metrics.is_calibrated,
        calibrationProvenance=metrics.calibration_provenance,
        calibrationNote=metrics.calibration_note,
        algorithmVersion=metrics.algorithm_version,
        algorithmConfig=metrics.algorithm_config,
    )
    # Persist summary in metrics_json
    metrics.raw_metrics["crack_summary"] = crack_summary.model_dump()
    analysis_record.metrics_json = metrics.raw_metrics

    db.add(analysis_record)

    # Link with Finding table for unified disposition & inspection workflow
    image_serving_url = f"/api/v4/evidence/images/{image_id}"
    mask_serving_url = f"/api/v4/evidence/images/{image_id}/mask" if mask_storage_key else None

    finding_record = Finding(
        id=finding_id,
        project_id=prj_id,
        title=f"Field Upload — {elem}",
        location_desc=elem,
        chainage_formatted="Ch. Field Upload / Uncalibrated Survey",
        thumbnail_url=image_serving_url,
        provenance="AI_INFERRED",
        direct_impact=(
            "Preliminary defect candidate detected via 2D morphological filtering. Human engineering review required."
            if metrics.has_candidate
            else "No prominent crack features detected above morphological noise floor."
        ),
        cascade_financial_exposure_inr="Assessment Pending" if metrics.has_candidate else "₹0.00 Lakhs",
        critical_path_slip_days=0,
        suggested_action=(
            "Resident engineering review and direct physical crack gauge verification"
            if metrics.has_candidate
            else "Visual inspection archive — no immediate structural remediation indicated"
        ),
        structure_element=elem,
        flight_id="Field Upload",
        lens=f"{info.width}x{info.height}px ({info.color_mode})",
        gsd_mm_per_px=metrics.user_gsd_mm_per_px,
        captured_at=now_iso,
        coord_x=0.0,
        coord_y=0.0,
        coord_z=0.0,
        image_url=image_serving_url,
        calibrated_aperture_mm=metrics.calibrated_aperture_mm,
        aperture_tolerance_margin_mm=0.05 if metrics.calibrated_aperture_mm else None,
        permissible_threshold_mm=0.20 if metrics.calibrated_aperture_mm else None,
        governing_code=(
            "IRC:112 (Indicative Threshold: 0.20mm)"
            if metrics.calibrated_aperture_mm
            else "Uncalibrated — Pixel Space Only"
        ),
        exceedance_percent=(
            round((metrics.calibrated_aperture_mm - 0.20) / 0.20 * 100, 1)
            if (metrics.calibrated_aperture_mm and metrics.calibrated_aperture_mm > 0.20)
            else 0.0
        ),
        linear_trace_length_mm=metrics.linear_trace_length_mm,
        shear_vector_angle_degrees=0.0,
        inferred_depth_mm=round(metrics.calibrated_aperture_mm * 100, 1) if metrics.calibrated_aperture_mm else None,
        inferred_root_mechanism=(
            "Image-processing candidate (morphological black-hat segmentation). "
            "Preliminary candidate only — human verification required."
            if metrics.has_candidate
            else "No detectable defect candidate."
        ),
        ndt_corroboration=[],
        disposition_status="AWAITING_REVIEW",
        pki_certificate_valid=False,
        category="structural",
        image_id=image_id,
        analysis_id=analysis_id,
    )
    db.add(finding_record)

    await db.commit()

    return FindingUploadResponse(
        findingId=finding_id,
        imageId=image_id,
        analysisId=analysis_id,
        originalFilename=os.path.basename(file.filename or "uploaded_image"),
        fileSizeBytes=info.file_size_bytes,
        sha256=info.sha256_hash,
        dimensions=ImageDimensions(
            width=info.width,
            height=info.height,
            channels=info.channels,
            colorMode=info.color_mode,
        ),
        status="COMPLETED" if metrics.has_candidate else "NO_CANDIDATE_DETECTED",
        hasCandidate=metrics.has_candidate,
        pixelMetrics=PixelMetrics(
            areaPx=metrics.candidate_pixel_area,
            traceLengthPx=metrics.candidate_trace_length_px,
            meanAperturePx=metrics.candidate_mean_aperture_px,
            maxAperturePx=metrics.candidate_max_aperture_px,
        ),
        physicalMetrics=PhysicalMetrics(
            calibratedApertureMm=metrics.calibrated_aperture_mm,
            linearTraceLengthMm=metrics.linear_trace_length_mm,
        ),
        calibration=CalibrationInfo(
            gsdMmPerPx=metrics.user_gsd_mm_per_px,
            provenance="USER_PROVIDED_UNVERIFIED" if metrics.is_calibrated else "UNAVAILABLE",
            isCalibrated=metrics.is_calibrated,
            note=metrics.calibration_note,
        ),
        crackSummary=crack_summary,
        imageUrl=image_serving_url,
        maskUrl=mask_serving_url,
        analysisUrl=f"/api/v4/findings/{finding_id}/analysis",
        disclaimer=metrics.disclaimer,
        limitations=metrics.limitations,
        uploadedAt=now_iso,
    )


@router.get("/{finding_id}/analysis", response_model=FindingAnalysisResponse)
async def get_finding_analysis(finding_id: str, db: AsyncSession = Depends(get_db)):
    """
    Retrieve persisted image analysis details for a finding.
    Returns pixel-space metrics, calibration provenance, algorithm metadata, and limitations.
    """
    result = await db.execute(select(Finding).where(Finding.id == finding_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail=f"Finding '{finding_id}' not found")

    # If it's an uploaded finding, find the associated analysis record
    analysis = None
    uploaded_img = None
    if f.analysis_id:
        res_ana = await db.execute(select(ImageAnalysis).where(ImageAnalysis.id == f.analysis_id))
        analysis = res_ana.scalar_one_or_none()
    elif f.image_id:
        res_ana = await db.execute(select(ImageAnalysis).where(ImageAnalysis.image_id == f.image_id))
        analysis = res_ana.scalar_one_or_none()

    if f.image_id:
        res_img = await db.execute(select(UploadedImage).where(UploadedImage.id == f.image_id))
        uploaded_img = res_img.scalar_one_or_none()

    if not analysis or not uploaded_img:
        # Fallback for seeded finding FND-104
        seeded_candidates = [
            CandidateRegion(
                id="Candidate 1",
                areaPx=3360,
                traceLengthPx=525.0,
                meanWidthPx=0.44,
                maxWidthPx=0.55,
                calibratedWidthMm=f.calibrated_aperture_mm,
                calibratedLengthMm=f.linear_trace_length_mm,
                boundingBox=[330, 180, 150, 165],
                centroid=[405.0, 262.5],
            )
        ]
        seeded_crack_summary = CrackDetectionSummary(
            status="Potential crack-like regions detected",
            candidateCount=1,
            candidateCountLabel="1 potential crack-like region detected",
            imageResolution="800 × 500 px",
            calibrationStatusText="calibrated with user-supplied unverified calibration (0.8 mm/px)",
            explanation=(
                "We found 1 candidate image region that looks like a possible crack. "
                "Candidate regions can be shadows, joints, stains, or surface texture and require qualified human engineering review before confirming any physical crack."
            ),
            preliminaryReviewNotice=(
                "Candidate regions are not confirmed physical cracks. Automated image processing can detect shadows, "
                "joints, stains, or surface texture and requires qualified human engineering review."
            ),
            candidates=seeded_candidates,
            isCalibrated=bool(f.gsd_mm_per_px),
            calibrationProvenance="USER_PROVIDED_UNVERIFIED" if f.gsd_mm_per_px else "UNAVAILABLE",
            calibrationNote="Demo synthetic baseline calibration (0.8mm/px GSD).",
            algorithmVersion="4.2.0",
        )
        return FindingAnalysisResponse(
            findingId=f.id,
            imageId=f.image_id or "IMG-SEEDED-DEMO",
            analysisId=f.analysis_id or "ANA-SEEDED-DEMO",
            sha256="seeded_demo_hash",
            algorithm=AlgorithmInfo(name="DEMO-SEEDED-SYNTHETIC", version="4.2.0"),
            status="COMPLETED",
            hasCandidate=True,
            pixelMetrics=PixelMetrics(
                areaPx=3360,
                traceLengthPx=525.0,
                meanAperturePx=0.44,
                maxAperturePx=0.55,
            ),
            physicalMetrics=PhysicalMetrics(
                calibratedApertureMm=f.calibrated_aperture_mm,
                linearTraceLengthMm=f.linear_trace_length_mm,
            ),
            calibration=CalibrationInfo(
                gsdMmPerPx=f.gsd_mm_per_px,
                provenance="USER_PROVIDED_UNVERIFIED",
                isCalibrated=bool(f.gsd_mm_per_px),
                note="Demo synthetic baseline calibration (0.8mm/px GSD).",
            ),
            crackSummary=seeded_crack_summary,
            imageMetadata=UploadedImageMetadata(
                width=800,
                height=500,
                channels=3,
                colorMode="RGB",
                fileSizeBytes=0,
                sha256="seeded_demo_hash",
                mimeType="image/jpeg",
                originalFilename="fnd104_ortho.jpg",
            ),
            imageUrl=f.image_url or "",
            maskUrl=None,
            disclaimer=(
                "IMAGE-PROCESSING CANDIDATE — HUMAN REVIEW REQUIRED. "
                "Preliminary image processing is not validated structural crack diagnosis or a substitute for qualified inspection."
            ),
            limitations="Seeded demo finding with predefined baseline measurements.",
            createdAt=f.captured_at or datetime.datetime.utcnow().isoformat() + "Z",
        )

    mask_url = f"/api/v4/evidence/images/{uploaded_img.id}/mask" if uploaded_img.mask_storage_key else None

    # Safe parsing in case of SQLite raw byte persistence
    area_val = analysis.candidate_pixel_area
    if isinstance(area_val, bytes):
        area_px = int.from_bytes(area_val, "little")
    else:
        area_px = int(area_val or 0)

    trace_val = analysis.candidate_trace_length_px
    trace_px = float(trace_val) if trace_val is not None and not isinstance(trace_val, bytes) else None
    mean_val = analysis.candidate_mean_aperture_px
    mean_px = float(mean_val) if mean_val is not None and not isinstance(mean_val, bytes) else None
    max_val = analysis.candidate_max_aperture_px
    max_px = float(max_val) if max_val is not None and not isinstance(max_val, bytes) else None

    # Reconstruct or parse crackSummary
    res_str = f"{uploaded_img.width} × {uploaded_img.height} px"
    cal_status = (
        f"calibrated with user-supplied unverified calibration ({analysis.user_gsd_mm_per_px} mm/px)"
        if analysis.user_gsd_mm_per_px
        else "uncalibrated pixel-space only"
    )

    crack_summary_data = None
    if analysis.metrics_json and isinstance(analysis.metrics_json, dict):
        crack_summary_data = analysis.metrics_json.get("crack_summary")

    if crack_summary_data:
        if not crack_summary_data.get("imageResolution"):
            crack_summary_data["imageResolution"] = res_str
        if not crack_summary_data.get("calibrationStatusText"):
            crack_summary_data["calibrationStatusText"] = cal_status
        crack_summary = CrackDetectionSummary(**crack_summary_data)
    else:
        candidates_list = []
        if analysis.has_candidate and area_px > 0:
            candidates_list.append(
                CandidateRegion(
                    id="Candidate 1",
                    areaPx=area_px,
                    traceLengthPx=trace_px,
                    meanWidthPx=mean_px,
                    maxWidthPx=max_px,
                    calibratedWidthMm=analysis.calibrated_aperture_mm,
                    calibratedLengthMm=analysis.linear_trace_length_mm,
                    boundingBox=[0, 0, uploaded_img.width, uploaded_img.height],
                    centroid=[uploaded_img.width / 2.0, uploaded_img.height / 2.0],
                )
            )
        cand_count = len(candidates_list)
        crack_summary = CrackDetectionSummary(
            status="Potential crack-like regions detected" if cand_count > 0 else "No candidates detected",
            candidateCount=cand_count,
            candidateCountLabel=(
                f"{cand_count} potential crack-like region{'s' if cand_count != 1 else ''} detected"
                if cand_count > 0
                else "No candidates detected"
            ),
            imageResolution=res_str,
            calibrationStatusText=cal_status,
            explanation=(
                f"We found {cand_count} candidate image region{'s' if cand_count != 1 else ''} that look{'s' if cand_count == 1 else ''} like possible cracks. "
                "Candidate regions can be shadows, joints, stains, or surface texture and require qualified human engineering review before confirming any physical crack."
                if cand_count > 0
                else "No potential crack-like regions were detected by this image-processing method. This preliminary result does not prove the concrete surface is crack-free."
            ),
            preliminaryReviewNotice=(
                "Candidate regions are not confirmed physical cracks. Automated image processing can detect shadows, "
                "joints, stains, or surface texture and requires qualified human engineering review."
            ),
            candidates=candidates_list,
            isCalibrated=bool(analysis.user_gsd_mm_per_px),
            calibrationProvenance="USER_PROVIDED_UNVERIFIED" if analysis.user_gsd_mm_per_px else "UNAVAILABLE",
            calibrationNote=(
                f"User-supplied calibration applied ({analysis.user_gsd_mm_per_px} mm/px). NOT independently verified."
                if analysis.user_gsd_mm_per_px
                else "Physical dimensions unavailable without calibrated GSD. Reporting pixel-space measurements only."
            ),
            algorithmVersion=analysis.algorithm_version or "2.1.0",
        )

    return FindingAnalysisResponse(
        findingId=f.id,
        imageId=uploaded_img.id,
        analysisId=analysis.id,
        sha256=uploaded_img.sha256_hash,
        algorithm=AlgorithmInfo(
            name=analysis.algorithm_name,
            version=analysis.algorithm_version,
        ),
        status="COMPLETED" if analysis.has_candidate else "NO_CANDIDATE_DETECTED",
        hasCandidate=analysis.has_candidate,
        pixelMetrics=PixelMetrics(
            areaPx=area_px,
            traceLengthPx=trace_px,
            meanAperturePx=mean_px,
            maxAperturePx=max_px,
        ),
        physicalMetrics=PhysicalMetrics(
            calibratedApertureMm=analysis.calibrated_aperture_mm,
            linearTraceLengthMm=analysis.linear_trace_length_mm,
        ),

        calibration=CalibrationInfo(
            gsdMmPerPx=analysis.user_gsd_mm_per_px,
            provenance="USER_PROVIDED_UNVERIFIED" if analysis.user_gsd_mm_per_px else "UNAVAILABLE",
            isCalibrated=bool(analysis.user_gsd_mm_per_px),
            note=(
                f"User-supplied calibration applied ({analysis.user_gsd_mm_per_px} mm/px). NOT independently verified."
                if analysis.user_gsd_mm_per_px
                else "Physical dimensions unavailable without calibrated GSD. Reporting pixel-space measurements only."
            ),
        ),
        crackSummary=crack_summary,
        imageMetadata=UploadedImageMetadata(
            width=uploaded_img.width,
            height=uploaded_img.height,
            channels=uploaded_img.channels,
            colorMode=uploaded_img.color_mode,
            fileSizeBytes=uploaded_img.file_size_bytes,
            sha256=uploaded_img.sha256_hash,
            mimeType=uploaded_img.mime_type,
            originalFilename=uploaded_img.original_filename,
        ),
        imageUrl=f"/api/v4/evidence/images/{uploaded_img.id}",
        maskUrl=mask_url,
        disclaimer=analysis.disclaimer,
        limitations=analysis.limitations,
        createdAt=analysis.created_at,
    )


@router.get("/{finding_id}/telemetry", response_model=InspectionTelemetryResponse)
async def get_finding_telemetry(finding_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Finding).where(Finding.id == finding_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")

    return InspectionTelemetryResponse(
        findingId=f.id,
        assetChainage=f.chainage_formatted or "",
        structureElement=f.structure_element or f.location_desc or "",
        captureSource=CaptureSource(
            flightId=f.flight_id or "N/A",
            lens=f.lens or "N/A",
            gsdMmPerPx=f.gsd_mm_per_px or 0.0,
            capturedAt=f.captured_at or "",
            coordinates={"x": f.coord_x or 0.0, "y": f.coord_y or 0.0, "z": f.coord_z or 0.0},
        ),
        photogrammetricMetrology=PhotogrammetricMetrology(
            imageUrl=f.image_url or "",
            calibratedApertureMm=f.calibrated_aperture_mm or 0.0,
            apertureToleranceMarginMm=f.aperture_tolerance_margin_mm or 0.0,
            permissibleThresholdMm=f.permissible_threshold_mm or 0.0,
            governingCode=f.governing_code or "",
            exceedancePercent=f.exceedance_percent or 0.0,
            linearTraceLengthMm=f.linear_trace_length_mm or 0.0,
            shearVectorAngleDegrees=f.shear_vector_angle_degrees or 0.0,
            inferredDepthMm=f.inferred_depth_mm or 0.0,
            inferredRootMechanism=f.inferred_root_mechanism or "",
        ),
        ndtCorroboration=[
            NdtCorroborationItem(**item) for item in (f.ndt_corroboration or [])
        ],
        reviewerDispositionState=ReviewerDispositionState(
            currentStatus=f.disposition_status or "AWAITING_REVIEW",
            dispositionedBy=f.dispositioned_by,
            dispositionNotes=f.disposition_notes,
            pkiCertificateValid=f.pki_certificate_valid or False,
        ),
    )


@router.post("/{finding_id}/disposition", response_model=DispositionUpdateResponse)
async def update_disposition(
    finding_id: str,
    req: DispositionUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Finding).where(Finding.id == finding_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")

    status_map = {
        "CONFIRM_NCR": "CONFIRMED_NCR",
        "DOWNGRADE_SHRINKAGE": "DOWNGRADED",
        "REJECT_ARTIFACT": "REJECTED",
    }
    f.disposition_status = status_map[req.disposition]
    f.dispositioned_by = f"{req.signerName} ({req.signerLicenseId})"
    f.disposition_notes = req.engineerNotes

    await db.commit()

    # Generate deterministic audit hash from finding + timestamp
    ts = datetime.datetime.utcnow().isoformat()
    hash_input = f"{finding_id}:{req.disposition}:{ts}"
    audit_hash = hashlib.sha256(hash_input.encode()).hexdigest()

    clean_id = finding_id.replace("FND-", "")
    protocol_id = f"NCR-{clean_id}" if req.disposition == "CONFIRM_NCR" else f"DSP-{clean_id}"

    return DispositionUpdateResponse(
        findingId=finding_id,
        newStatus=f.disposition_status,
        protocolId=protocol_id,
        auditHash=audit_hash,
        message=f"Protocol {protocol_id} generated with SHA-256 audit hash #{audit_hash[:8]}...{audit_hash[-4:]}",
    )


# ---------------------------------------------------------------------------
# Finding-Evidence Links API (Milestone 3 Traceability)
# ---------------------------------------------------------------------------

@router.post("/{finding_id}/evidence-links", response_model=FindingEvidenceLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_finding_evidence_link(
    finding_id: str,
    req: FindingEvidenceLinkCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Link an existing document passage to an inspection finding.
    Enforces project isolation, citation grounding, duplicate prevention,
    and strict provenance rules (AI inference cannot be auto-promoted to SOURCE_VERIFIED).
    """
    # 1. Verify finding exists
    f_res = await db.execute(select(Finding).where(Finding.id == finding_id))
    finding = f_res.scalar_one_or_none()
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding '{finding_id}' not found."
        )

    # 2. Verify document exists
    doc_res = await db.execute(select(Document).where(Document.id == req.documentId))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{req.documentId}' not found."
        )

    # 3. Enforce project boundary
    if finding.project_id != doc.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cross-project linking is not permitted. Finding belongs to '{finding.project_id}', but document belongs to '{doc.project_id}'."
        )

    # 4. Verify passage exists and belongs to document
    pas_res = await db.execute(
        select(DocumentPassage).where(
            DocumentPassage.id == req.passageId,
            DocumentPassage.document_id == req.documentId,
        )
    )
    passage = pas_res.scalar_one_or_none()
    if not passage:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Passage '{req.passageId}' not found in document '{req.documentId}'."
        )

    # 5. Check duplicate relationship
    dup_res = await db.execute(
        select(FindingEvidenceLink).where(
            FindingEvidenceLink.finding_id == finding_id,
            FindingEvidenceLink.passage_id == req.passageId,
        )
    )
    if dup_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Evidence link between finding '{finding_id}' and passage '{req.passageId}' already exists."
        )

    # 6. Provenance validation
    if req.provenance == "SOURCE_VERIFIED" and req.isAiInferred:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AI-inferred relationships cannot be automatically marked as SOURCE_VERIFIED. A human review is required."
        )

    if req.provenance == "SOURCE_VERIFIED" and req.citationText:
        if req.citationText.strip() not in passage.content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot mark as SOURCE_VERIFIED: citation text does not match source passage content."
            )

    # 7. Create link
    link_id = f"LNK-{uuid.uuid4().hex[:10].upper()}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    citation = req.citationText or passage.content[:300]

    link = FindingEvidenceLink(
        id=link_id,
        project_id=finding.project_id,
        finding_id=finding_id,
        document_id=req.documentId,
        passage_id=req.passageId,
        page_number=passage.page_number,
        citation_text=citation,
        relevance_note=req.relevanceNote,
        provenance=req.provenance,
        confidence=req.confidence if req.confidence is not None else 1.0,
        created_at=now_iso,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    download_url = f"/api/v4/projects/{doc.project_id}/documents/{doc.id}/file"

    return FindingEvidenceLinkResponse(
        id=link.id,
        projectId=link.project_id,
        findingId=link.finding_id,
        documentId=link.document_id,
        passageId=link.passage_id,
        pageNumber=link.page_number,
        citationText=link.citation_text,
        relevanceNote=link.relevance_note,
        provenance=link.provenance,
        confidence=link.confidence,
        createdAt=link.created_at,
        documentTitle=doc.title,
        documentFilename=doc.original_filename,
        passageContent=passage.content,
        downloadUrl=download_url,
        isMissingSource=False,
    )


@router.get("/{finding_id}/evidence-links", response_model=FindingEvidenceLinksListResponse)
async def list_finding_evidence_links(
    finding_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    List all traceable evidence links for an inspection finding.
    Gracefully handles missing or deleted documents and passages.
    """
    f_res = await db.execute(select(Finding).where(Finding.id == finding_id))
    finding = f_res.scalar_one_or_none()
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding '{finding_id}' not found."
        )

    links_res = await db.execute(
        select(FindingEvidenceLink)
        .where(FindingEvidenceLink.finding_id == finding_id)
        .order_by(FindingEvidenceLink.created_at.desc())
    )
    raw_links = links_res.scalars().all()

    items = []
    for lnk in raw_links:
        doc_res = await db.execute(select(Document).where(Document.id == lnk.document_id))
        doc = doc_res.scalar_one_or_none()

        pas_res = await db.execute(select(DocumentPassage).where(DocumentPassage.id == lnk.passage_id))
        pas = pas_res.scalar_one_or_none()

        is_missing = (doc is None or pas is None)
        doc_title = doc.title if doc else "[Source Document Unavailable / Deleted]"
        doc_fn = doc.original_filename if doc else None
        pas_content = pas.content if pas else "[Passage Unavailable / Deleted]"
        dl_url = f"/api/v4/projects/{doc.project_id}/documents/{doc.id}/file" if doc else None

        items.append(
            FindingEvidenceLinkResponse(
                id=lnk.id,
                projectId=lnk.project_id,
                findingId=lnk.finding_id,
                documentId=lnk.document_id,
                passageId=lnk.passage_id,
                pageNumber=lnk.page_number,
                citationText=lnk.citation_text,
                relevanceNote=lnk.relevance_note,
                provenance=lnk.provenance,
                confidence=lnk.confidence,
                createdAt=lnk.created_at,
                documentTitle=doc_title,
                documentFilename=doc_fn,
                passageContent=pas_content,
                downloadUrl=dl_url,
                isMissingSource=is_missing,
            )
        )

    return FindingEvidenceLinksListResponse(
        findingId=finding_id,
        projectId=finding.project_id,
        totalLinks=len(items),
        links=items,
    )


@router.get("/{finding_id}/evidence-links/{link_id}", response_model=FindingEvidenceLinkResponse)
async def get_finding_evidence_link(
    finding_id: str,
    link_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve source passage and page information for a specific evidence link.
    Gracefully handles missing or deleted sources.
    """
    link_res = await db.execute(
        select(FindingEvidenceLink).where(
            FindingEvidenceLink.id == link_id,
            FindingEvidenceLink.finding_id == finding_id,
        )
    )
    lnk = link_res.scalar_one_or_none()
    if not lnk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence link '{link_id}' not found for finding '{finding_id}'."
        )

    doc_res = await db.execute(select(Document).where(Document.id == lnk.document_id))
    doc = doc_res.scalar_one_or_none()

    pas_res = await db.execute(select(DocumentPassage).where(DocumentPassage.id == lnk.passage_id))
    pas = pas_res.scalar_one_or_none()

    is_missing = (doc is None or pas is None)
    doc_title = doc.title if doc else "[Source Document Unavailable / Deleted]"
    doc_fn = doc.original_filename if doc else None
    pas_content = pas.content if pas else "[Passage Unavailable / Deleted]"
    dl_url = f"/api/v4/projects/{doc.project_id}/documents/{doc.id}/file" if doc else None

    return FindingEvidenceLinkResponse(
        id=lnk.id,
        projectId=lnk.project_id,
        findingId=lnk.finding_id,
        documentId=lnk.document_id,
        passageId=lnk.passage_id,
        pageNumber=lnk.page_number,
        citationText=lnk.citation_text,
        relevanceNote=lnk.relevance_note,
        provenance=lnk.provenance,
        confidence=lnk.confidence,
        createdAt=lnk.created_at,
        documentTitle=doc_title,
        documentFilename=doc_fn,
        passageContent=pas_content,
        downloadUrl=dl_url,
        isMissingSource=is_missing,
    )


@router.delete("/{finding_id}/evidence-links/{link_id}", status_code=status.HTTP_200_OK)
async def delete_finding_evidence_link(
    finding_id: str,
    link_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete an evidence link."""
    link_res = await db.execute(
        select(FindingEvidenceLink).where(
            FindingEvidenceLink.id == link_id,
            FindingEvidenceLink.finding_id == finding_id,
        )
    )
    lnk = link_res.scalar_one_or_none()
    if not lnk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence link '{link_id}' not found for finding '{finding_id}'."
        )

    await db.delete(lnk)
    await db.commit()

    return {"status": "ok", "deletedLinkId": link_id}
