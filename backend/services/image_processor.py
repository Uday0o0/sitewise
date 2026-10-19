"""
SITEWISE V4.2 — Image Processing Service
Deterministic concrete crack candidate analysis using Pillow and OpenCV.

Requirements addressed:
1. Validates image by decoding byte array, verifying format and integrity.
2. Extracts actual image dimensions and channel information.
3. Suppresses speckle noise, aggregate pits, and texture variations via Gaussian pre-filtering.
4. Generates transparent, deterministic candidate mask via morphological black-hat segmentation.
5. Bridges micro-disconnections (<= 4px) via morphological closing.
6. Merges nearby fragments (gap <= 10px) using documented grouping dilation rules.
7. Evaluates elongation, aspect ratio, and continuity to reject non-elongated texture and stains.
8. Computes pixel-space metrics (pixel area, trace length, mean aperture, max aperture).
9. Computes physical metrics ONLY when a valid user GSD calibration is supplied.
10. Labels all physical metrics as USER_PROVIDED_UNVERIFIED — never certified engineering diagnosis.
11. Refuses to fabricate defects when no candidate exceeds detection floor.
12. Records processing configuration and algorithm version for reproducibility.
"""

from __future__ import annotations
import io
import time
import hashlib
from typing import Optional, Tuple, Dict, Any
from dataclasses import dataclass, field
import cv2
import numpy as np
from PIL import Image

# Max upload limit: 25 MB
MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024

ALGORITHM_NAME = "SITEWISE-MORPH-BLACKHAT"
ALGORITHM_VERSION = "2.1.0"

DEFAULT_PROCESSING_CONFIG: Dict[str, Any] = {
    "gaussian_blur_ksize": 3,
    "gaussian_blur_sigma": 0.8,
    "blackhat_kernel_size": 15,
    "base_threshold": 35.0,
    "morph_close_ksize": 5,
    "grouping_gap_px": 10,
    "min_component_area_px": 40,
    "min_feature_length_px": 16,
    "min_elongation_ratio": 1.7,
}

DISCLAIMER_TEXT = (
    "IMAGE-PROCESSING CANDIDATE — HUMAN REVIEW REQUIRED. "
    "Preliminary image processing is not validated structural crack diagnosis or a substitute for qualified inspection. "
    "Measurements derived from 2D pixel projection require direct physical tactile crack gauge verification."
)

LIMITATION_TEXT = (
    "Deterministic morphological black-hat segmentation cannot distinguish genuine structural fissures from "
    "construction joints, formwork seams, deep shadows, cable runs, or surface staining."
)


class ImageValidationError(Exception):
    """Raised when an uploaded file fails validation."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class DecodedImageInfo:
    width: int
    height: int
    channels: int
    color_mode: str
    format: str
    file_size_bytes: int
    sha256_hash: str
    mime_type: str


@dataclass
class ProcessingMetrics:
    has_candidate: bool
    status: str  # COMPLETED | NO_CANDIDATE_DETECTED
    candidate_pixel_area: int
    candidate_trace_length_px: Optional[float]
    candidate_mean_aperture_px: Optional[float]
    candidate_max_aperture_px: Optional[float]
    calibrated_aperture_mm: Optional[float]
    linear_trace_length_mm: Optional[float]
    user_gsd_mm_per_px: Optional[float]
    calibration_provenance: str  # USER_PROVIDED_UNVERIFIED | UNAVAILABLE
    is_calibrated: bool
    calibration_note: str
    calibration_status_text: str
    image_resolution: str
    processing_time_ms: float
    algorithm_name: str = ALGORITHM_NAME
    algorithm_version: str = ALGORITHM_VERSION
    algorithm_config: dict = field(default_factory=dict)
    disclaimer: str = DISCLAIMER_TEXT
    limitations: str = LIMITATION_TEXT
    mask_rgba_png_bytes: Optional[bytes] = None
    mask_binary_png_bytes: Optional[bytes] = None
    candidate_count: int = 0
    candidates: list = field(default_factory=list)
    summary_status: str = "No candidates detected"  # Potential crack-like regions detected | No candidates detected | Analysis failed
    plain_explanation: str = ""
    preliminary_notice: str = (
        "Candidate regions are not confirmed physical cracks. Automated image processing can detect shadows, "
        "joints, stains, or surface texture and requires qualified human engineering review."
    )
    raw_metrics: dict = field(default_factory=dict)


def validate_and_decode(image_bytes: bytes) -> Tuple[Image.Image, DecodedImageInfo]:
    """
    Validate image bytes using Pillow:
    - Rejects empty bytes.
    - Rejects files exceeding 25MB.
    - Rejects corrupt or invalid byte sequences (e.g. renamed executables).
    - Rejects formats other than JPEG and PNG.
    - Computes SHA-256 digest.
    """
    if not image_bytes or len(image_bytes) == 0:
        raise ImageValidationError("Empty file uploaded. Please select a valid JPEG or PNG image.", status_code=400)

    if len(image_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise ImageValidationError(
            f"Upload exceeds maximum allowable size of 25 MB (Received {len(image_bytes)} bytes).",
            status_code=413,
        )

    # Decode and verify header / structure
    try:
        buf = io.BytesIO(image_bytes)
        img = Image.open(buf)
        img.verify()
    except Exception as exc:
        raise ImageValidationError(
            f"Malformed or unreadable image data: {str(exc)}",
            status_code=400,
        )

    # Re-open after verify() to load actual pixels
    try:
        buf.seek(0)
        img = Image.open(buf)
        img.load()
    except Exception as exc:
        raise ImageValidationError(
            f"Unable to decode image pixel data: {str(exc)}",
            status_code=400,
        )

    detected_format = (img.format or "").upper()
    if detected_format not in ("JPEG", "JPG", "PNG"):
        raise ImageValidationError(
            f"Unsupported image format '{detected_format}'. Only standard JPEG and PNG files are accepted.",
            status_code=415,
        )

    mime_type = "image/jpeg" if detected_format in ("JPEG", "JPG") else "image/png"
    sha256_hash = hashlib.sha256(image_bytes).hexdigest()

    channels = len(img.getbands())
    width, height = img.size

    info = DecodedImageInfo(
        width=width,
        height=height,
        channels=channels,
        color_mode=img.mode,
        format=detected_format,
        file_size_bytes=len(image_bytes),
        sha256_hash=sha256_hash,
        mime_type=mime_type,
    )

    return img, info


def process_image(
    image_bytes: bytes,
    user_gsd_mm_per_px: Optional[float] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Tuple[DecodedImageInfo, ProcessingMetrics]:
    """
    Performs deterministic image-processing candidate segmentation.
    1. Validates and decodes image.
    2. Converts to grayscale and applies Gaussian pre-blur.
    3. Evaluates morphological black-hat response with dynamic noise-floor estimation.
    4. Performs morphological closing to bridge micro-gaps (<= 4px).
    5. Merges nearby fragments (gap <= 10px) using grouping dilation.
    6. Filters components by area, elongation, aspect ratio, and width.
    7. Computes pixel-space and optional calibrated physical properties.
    8. Returns metrics, candidate list, and transparent overlay PNG mask.
    """
    start_time = time.perf_counter()

    # Merge configuration
    active_config = dict(DEFAULT_PROCESSING_CONFIG)
    if config:
        active_config.update(config)

    # Step 1: Validate and decode
    pil_img, info = validate_and_decode(image_bytes)
    res_str = f"{info.width} × {info.height} px"

    # Calibration validation
    has_valid_calibration = False
    valid_gsd: Optional[float] = None
    if user_gsd_mm_per_px is not None:
        try:
            val = float(user_gsd_mm_per_px)
            if val > 0.0 and np.isfinite(val):
                valid_gsd = val
                has_valid_calibration = True
        except (ValueError, TypeError):
            valid_gsd = None
            has_valid_calibration = False

    cal_prov = "USER_PROVIDED_UNVERIFIED" if has_valid_calibration else "UNAVAILABLE"
    cal_status_text = (
        f"calibrated with user-supplied unverified calibration ({valid_gsd} mm/px)"
        if has_valid_calibration
        else "uncalibrated pixel-space only"
    )

    # Step 2: Convert to OpenCV grayscale array & Gaussian pre-filter
    rgb_array = np.array(pil_img.convert("RGB"))
    gray = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2GRAY)

    k_blur = int(active_config["gaussian_blur_ksize"])
    sigma_blur = float(active_config["gaussian_blur_sigma"])
    blurred = cv2.GaussianBlur(gray, (k_blur, k_blur), sigma_blur)

    # Step 3: Morphological Black-Hat filter
    k_blackhat = int(active_config["blackhat_kernel_size"])
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_blackhat, k_blackhat))
    blackhat = cv2.morphologyEx(blurred, cv2.MORPH_BLACKHAT, kernel)

    max_signal = float(np.max(blackhat))
    mean_signal = float(np.mean(blackhat))
    std_signal = float(np.std(blackhat))

    # Dynamic threshold: base threshold or mean + 2.5 * std
    dynamic_thresh = mean_signal + 2.5 * std_signal
    threshold_val = max(float(active_config["base_threshold"]), min(dynamic_thresh, 65.0))

    # Step 4: Evaluate candidate presence
    if max_signal < threshold_val:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        cal_note = (
            "User-supplied GSD recorded, but no candidate defect detected to calibrate."
            if has_valid_calibration
            else "Physical dimensions unavailable without calibration. No candidate defect detected."
        )

        metrics = ProcessingMetrics(
            has_candidate=False,
            status="NO_CANDIDATE_DETECTED",
            candidate_pixel_area=0,
            candidate_trace_length_px=None,
            candidate_mean_aperture_px=None,
            candidate_max_aperture_px=None,
            calibrated_aperture_mm=None,
            linear_trace_length_mm=None,
            user_gsd_mm_per_px=valid_gsd,
            calibration_provenance=cal_prov,
            is_calibrated=has_valid_calibration,
            calibration_note=cal_note,
            calibration_status_text=cal_status_text,
            image_resolution=res_str,
            processing_time_ms=round(elapsed_ms, 2),
            algorithm_version=ALGORITHM_VERSION,
            algorithm_config=active_config,
            mask_rgba_png_bytes=None,
            mask_binary_png_bytes=None,
            candidate_count=0,
            candidates=[],
            summary_status="No candidates detected",
            plain_explanation="No potential crack-like regions were detected by this image-processing method. This preliminary result does not prove the concrete surface is crack-free.",
            raw_metrics={
                "max_blackhat_signal": max_signal,
                "mean_signal": round(mean_signal, 2),
                "std_signal": round(std_signal, 2),
                "threshold": round(threshold_val, 2),
                "algorithm_config": active_config,
                "algorithm_version": ALGORITHM_VERSION,
            },
        )
        return info, metrics

    # Threshold signal above noise floor
    _, raw_thresh = cv2.threshold(blackhat, int(threshold_val), 255, cv2.THRESH_BINARY)

    # Step 5: Morphological closing to bridge micro-disconnections (<= 4px) along continuous fissures
    k_close = int(active_config["morph_close_ksize"])
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_close, k_close))
    closed_mask = cv2.morphologyEx(raw_thresh, cv2.MORPH_CLOSE, close_kernel)

    # Step 6: Fragment Grouping Rule (Documented & Testable)
    # Fissure fragments separated by <= grouping_gap_px (10 px) belong to the same crack feature.
    gap = int(active_config["grouping_gap_px"])
    group_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * gap + 1, 2 * gap + 1))
    dilated_groups = cv2.dilate(closed_mask, group_kernel)

    num_groups, group_labels, group_stats, _ = cv2.connectedComponentsWithStats(dilated_groups, connectivity=8)

    # Step 7: Shape, Elongation, and Area Filtering on Grouped Candidates
    min_area = int(active_config["min_component_area_px"])
    min_length = float(active_config["min_feature_length_px"])
    min_elongation = float(active_config["min_elongation_ratio"])

    qualifying_groups = []

    for g in range(1, num_groups):
        cand_pixels = (group_labels == g) & (closed_mask > 0)
        area = int(np.count_nonzero(cand_pixels))
        if area < min_area:
            continue

        cand_u8 = np.uint8(cand_pixels) * 255
        contours, _ = cv2.findContours(cand_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue

        all_pts = np.vstack(contours)
        x, y, w, h = cv2.boundingRect(all_pts)
        rect = cv2.minAreaRect(all_pts)
        rw, rh = rect[1]
        length = max(rw, rh)
        width = max(1.0, min(rw, rh))
        elongation = length / width
        aspect_ratio = max(w, h) / max(1.0, min(w, h))

        # Trace length via contour perimeter / 2
        comp_arc = float(sum(cv2.arcLength(c, False) for c in contours if cv2.arcLength(c, False) > 4))
        trace_len = float(max(length, comp_arc / 2.0)) if comp_arc > 0 else float(length)
        mean_width = float(round(area / max(1.0, trace_len), 2))
        shape_ratio = trace_len / max(1.0, mean_width)

        # Max width via Euclidean distance transform
        comp_dist = cv2.distanceTransform(cand_u8, cv2.DIST_L2, 5)
        max_width = float(round(float(np.max(comp_dist) * 2.0), 2))

        # Filtering rules to reject surface texture, aggregate pits, and broad stains:
        # 1. Trace length must reach minimum feature extent (>= min_length)
        # 2. Must be elongated (elongation >= min_elongation OR aspect_ratio >= min_elongation OR shape_ratio >= min_elongation)
        # 3. Chunky non-fissure stains (mean_width > 12px with low elongation < 2.0 and aspect_ratio < 2.0) are rejected
        if trace_len < min_length:
            continue
        if mean_width > 12.0 and elongation < 2.0 and aspect_ratio < 2.0:
            continue
        if elongation < min_elongation and aspect_ratio < min_elongation and shape_ratio < min_elongation:
            continue

        qualifying_groups.append({
            "group_id": g,
            "cand_pixels": cand_pixels,
            "area": area,
            "bbox": [int(x), int(y), int(w), int(h)],
            "centroid": [float(x + w / 2.0), float(y + h / 2.0)],
            "trace_len": round(trace_len, 1),
            "mean_width": mean_width,
            "max_width": max_width,
            "elongation": round(elongation, 2),
            "aspect_ratio": round(aspect_ratio, 2),
        })

    if not qualifying_groups:
        elapsed_ms = float((time.perf_counter() - start_time) * 1000.0)
        metrics = ProcessingMetrics(
            has_candidate=False,
            status="NO_CANDIDATE_DETECTED",
            candidate_pixel_area=0,
            candidate_trace_length_px=None,
            candidate_mean_aperture_px=None,
            candidate_max_aperture_px=None,
            calibrated_aperture_mm=None,
            linear_trace_length_mm=None,
            user_gsd_mm_per_px=valid_gsd,
            calibration_provenance=cal_prov,
            is_calibrated=has_valid_calibration,
            calibration_note="Features below structural noise threshold or rejected by shape/elongation filters. No candidate detected.",
            calibration_status_text=cal_status_text,
            image_resolution=res_str,
            processing_time_ms=round(elapsed_ms, 2),
            algorithm_version=ALGORITHM_VERSION,
            algorithm_config=active_config,
            mask_rgba_png_bytes=None,
            mask_binary_png_bytes=None,
            candidate_count=0,
            candidates=[],
            summary_status="No candidates detected",
            plain_explanation="No potential crack-like regions were detected by this image-processing method. This preliminary result does not prove the concrete surface is crack-free.",
            raw_metrics={
                "total_candidate_pixels": 0,
                "algorithm_config": active_config,
                "algorithm_version": ALGORITHM_VERSION,
            },
        )
        return info, metrics

    # Sort qualifying groups by area descending (Candidate 1 is the most prominent)
    qualifying_groups.sort(key=lambda c: c["area"], reverse=True)

    filtered_mask = np.zeros_like(closed_mask)
    candidates_list = []

    for idx, grp in enumerate(qualifying_groups, start=1):
        filtered_mask[grp["cand_pixels"]] = 255

        c_trace_len = grp["trace_len"]
        c_mean_width = grp["mean_width"]
        c_max_width = grp["max_width"]

        cal_width = round(c_mean_width * valid_gsd, 3) if (has_valid_calibration and valid_gsd) else None
        cal_len = round(c_trace_len * valid_gsd, 1) if (has_valid_calibration and valid_gsd) else None

        candidates_list.append({
            "id": f"Candidate {idx}",
            "areaPx": grp["area"],
            "traceLengthPx": c_trace_len,
            "meanWidthPx": c_mean_width,
            "maxWidthPx": c_max_width,
            "calibratedWidthMm": cal_width,
            "calibratedLengthMm": cal_len,
            "boundingBox": grp["bbox"],
            "centroid": [round(grp["centroid"][0], 1), round(grp["centroid"][1], 1)],
            "elongation": grp["elongation"],
            "aspectRatio": grp["aspect_ratio"],
        })

    candidate_count = len(candidates_list)
    total_candidate_pixels = int(sum(c["areaPx"] for c in candidates_list))
    total_trace_length_px = float(round(sum(c["traceLengthPx"] for c in candidates_list), 1))
    mean_aperture_px = float(round(total_candidate_pixels / total_trace_length_px, 2)) if total_trace_length_px > 0 else 0.0
    max_aperture_px = float(max(c["maxWidthPx"] for c in candidates_list))

    # Overall physical measurements
    calibrated_aperture_mm: Optional[float] = None
    linear_trace_length_mm: Optional[float] = None

    if has_valid_calibration and valid_gsd is not None:
        calibrated_aperture_mm = round(mean_aperture_px * valid_gsd, 3)
        linear_trace_length_mm = round(total_trace_length_px * valid_gsd, 1)
        cal_note = (
            f"User-supplied calibration applied ({valid_gsd} mm/px). "
            "CAUTION: Calibration is unverified by certified target scale."
        )
    else:
        cal_note = "Physical dimensions unavailable without calibration. Reporting pixel-space measurements only."

    # Plain explanation wording
    if candidate_count == 1:
        plain_exp = (
            "We found 1 candidate image region that looks like a possible crack. "
            "Candidate regions can be shadows, joints, stains, or surface texture and require qualified human engineering review before confirming any physical crack."
        )
    else:
        plain_exp = (
            f"We found {candidate_count} candidate image regions that look like possible cracks. "
            "Candidate regions can be shadows, joints, stains, or surface texture and require qualified human engineering review before confirming any physical crack."
        )

    # Step 8: Generate subtle RGBA overlay mask
    # Transparent background, Safety Yellow candidate pixels (#F5C542) with 85% alpha (217)
    # Subtle 1px red boundary for clean contrast without viewport clutter
    h, w = filtered_mask.shape
    rgba_overlay = np.zeros((h, w, 4), dtype=np.uint8)
    rgba_overlay[filtered_mask > 0] = [245, 197, 66, 217]

    # Subtle boundary
    dilated = cv2.dilate(filtered_mask, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    edge = cv2.subtract(dilated, filtered_mask)
    rgba_overlay[edge > 0] = [239, 68, 68, 180]

    _, rgba_bytes = cv2.imencode(".png", rgba_overlay)
    _, binary_bytes = cv2.imencode(".png", filtered_mask)

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    metrics = ProcessingMetrics(
        has_candidate=True,
        status="COMPLETED",
        candidate_pixel_area=total_candidate_pixels,
        candidate_trace_length_px=total_trace_length_px,
        candidate_mean_aperture_px=mean_aperture_px,
        candidate_max_aperture_px=max_aperture_px,
        calibrated_aperture_mm=calibrated_aperture_mm,
        linear_trace_length_mm=linear_trace_length_mm,
        user_gsd_mm_per_px=valid_gsd,
        calibration_provenance=cal_prov,
        is_calibrated=has_valid_calibration,
        calibration_note=cal_note,
        calibration_status_text=cal_status_text,
        image_resolution=res_str,
        processing_time_ms=round(elapsed_ms, 2),
        algorithm_version=ALGORITHM_VERSION,
        algorithm_config=active_config,
        mask_rgba_png_bytes=rgba_bytes.tobytes(),
        mask_binary_png_bytes=binary_bytes.tobytes(),
        candidate_count=candidate_count,
        candidates=candidates_list,
        summary_status="Potential crack-like regions detected",
        plain_explanation=plain_exp,
        raw_metrics={
            "max_signal": max_signal,
            "candidate_count": candidate_count,
            "total_candidate_pixels": total_candidate_pixels,
            "total_trace_length_px": total_trace_length_px,
            "mean_aperture_px": mean_aperture_px,
            "max_aperture_px": max_aperture_px,
            "candidates": candidates_list,
            "algorithm_config": active_config,
            "algorithm_version": ALGORITHM_VERSION,
        },
    )

    return info, metrics
