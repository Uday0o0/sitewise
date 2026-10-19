"""Evidence image retrieval API routes with safe path traversal protection."""

from __future__ import annotations
import os
import re
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import UploadedImage, ImageAnalysis

router = APIRouter(prefix="/api/v4/evidence", tags=["evidence"])

UPLOAD_DIR = os.getenv(
    "SITEWISE_UPLOAD_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
)
SAFE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def _resolve_safe_path(base_dir: str, relative_path: str) -> str:
    """Safely resolve path and prevent directory traversal."""
    resolved_path = os.path.abspath(os.path.join(base_dir, relative_path))
    # Ensure resolved path is strictly within base_dir
    common = os.path.commonpath([base_dir, resolved_path])
    if common != base_dir:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage path detected."
        )
    return resolved_path


@router.get("/images/{image_id}")
async def get_uploaded_image(image_id: str, db: AsyncSession = Depends(get_db)):
    """
    Safely retrieve an uploaded inspection image.
    Prevents path traversal and validates image ID.
    NOTE: Multi-tenant tenant-level authorization is not implemented in this development version.
    """
    if not SAFE_ID_PATTERN.match(image_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image identifier format."
        )

    result = await db.execute(select(UploadedImage).where(UploadedImage.id == image_id))
    img_record = result.scalar_one_or_none()
    if not img_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image with id '{image_id}' not found."
        )

    file_path = _resolve_safe_path(UPLOAD_DIR, img_record.storage_key)
    if not os.path.isfile(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image file not found on disk."
        )

    return FileResponse(
        file_path,
        media_type=img_record.mime_type,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/images/{image_id}/mask")
async def get_candidate_mask(image_id: str, db: AsyncSession = Depends(get_db)):
    """
    Safely retrieve the candidate mask overlay PNG for an inspection image.
    """
    if not SAFE_ID_PATTERN.match(image_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image identifier format."
        )

    result = await db.execute(select(UploadedImage).where(UploadedImage.id == image_id))
    img_record = result.scalar_one_or_none()
    if not img_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image with id '{image_id}' not found."
        )

    if not img_record.mask_storage_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No candidate mask generated for this image (no candidate detected)."
        )

    mask_path = _resolve_safe_path(UPLOAD_DIR, img_record.mask_storage_key)
    if not os.path.isfile(mask_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mask file not found on disk."
        )

    return FileResponse(
        mask_path,
        media_type="image/png",
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=3600",
        },
    )
