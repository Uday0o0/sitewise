"""Document Intelligence and Grounded Assistant API routes.

Provides document upload, extraction, indexing, search, and grounded Q&A
with citations to original sources.
"""

from __future__ import annotations
import os
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database import get_db
from models import Project, Document, DocumentPassage, Finding, FindingEvidenceLink
from schemas import (
    DocumentUploadResponse,
    DocumentMetadata,
    DocumentListItem,
    SearchRequest,
    SearchResponse,
    SearchPassageResult,
    AssistantQueryRequest,
    AssistantAnswer,
    CitationItem,
    AssistantStatusResponse,
    FindingEvidenceLinkCreate,
    FindingEvidenceLinkResponse,
    FindingEvidenceLinksListResponse,
)
from services import document_processor, retrieval, ai_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v4/projects/{project_id}", tags=["documents", "assistant"])

# Storage configuration
DOCUMENT_UPLOAD_DIR = os.getenv(
    "SITEWISE_DOCUMENT_UPLOAD_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "documents"))
)
MAX_DOCUMENT_SIZE_MB = int(os.getenv("SITEWISE_MAX_DOCUMENT_SIZE_MB", "25"))
MAX_DOCUMENT_SIZE_BYTES = MAX_DOCUMENT_SIZE_MB * 1024 * 1024

SAFE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def _ensure_upload_dir() -> str:
    """Ensure upload directory exists and return absolute path."""
    os.makedirs(DOCUMENT_UPLOAD_DIR, exist_ok=True)
    return DOCUMENT_UPLOAD_DIR


def _resolve_safe_path(base_dir: str, relative_path: str) -> str:
    """Safely resolve path within base_dir and prevent directory traversal."""
    resolved_path = os.path.abspath(os.path.join(base_dir, relative_path))
    common = os.path.commonpath([base_dir, resolved_path])
    if common != base_dir:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document storage path detected."
        )
    return resolved_path


async def _verify_project(project_id: str, db: AsyncSession) -> Project:
    """Verify that project exists, else raise 404."""
    result = await db.execute(
        select(Project).where((Project.id == project_id) | (Project.package_id == project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found."
        )
    return project


# ---------------------------------------------------------------------------
# Document Upload and Management Endpoints
# ---------------------------------------------------------------------------

@router.post("/documents/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    project_id: str,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Upload and index a construction document (PDF, TXT, MD, CSV)."""
    await _verify_project(project_id, db)

    original_filename = file.filename or "untitled"
    ext = document_processor.get_file_type(original_filename)
    if not ext:
        supported = ", ".join(document_processor.SUPPORTED_TYPES.keys())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported document format. Supported formats: {supported}"
        )

    content = await file.read()
    if len(content) > MAX_DOCUMENT_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {MAX_DOCUMENT_SIZE_MB} MB."
        )

    doc_id = f"DOC-{uuid.uuid4().hex[:10].upper()}"
    clean_name = re.sub(r"[^A-Za-z0-9_.-]", "_", original_filename)
    storage_filename = f"{doc_id}_{clean_name}"

    upload_dir = _ensure_upload_dir()
    file_path = _resolve_safe_path(upload_dir, storage_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    doc_title = title.strip() if title and title.strip() else os.path.splitext(original_filename)[0]
    now_iso = datetime.now(timezone.utc).isoformat()
    mime = document_processor.SUPPORTED_TYPES[ext]

    # Process and extract text
    processing_status = "READY"
    processing_error = None
    chunks = []
    word_count = 0
    page_count = 1
    requires_ocr = False

    try:
        proc_result = document_processor.process_document(original_filename, content)
        chunks = proc_result["chunks"]
        word_count = proc_result["word_count"]
        page_count = proc_result.get("page_count", 1)
        requires_ocr = proc_result.get("requires_ocr", False)

        if requires_ocr:
            processing_status = "REQUIRES_OCR"
            processing_error = "Scanned document detected. No digital text found; OCR is required."
        elif not chunks and word_count == 0:
            processing_status = "FAILED"
            processing_error = "No extractable text content found in document."

    except Exception as e:
        logger.error(f"Extraction failed for {original_filename}: {e}", exc_info=True)
        processing_status = "FAILED"
        processing_error = f"Extraction error: {type(e).__name__}: {str(e)}"

    doc_record = Document(
        id=doc_id,
        project_id=project_id,
        title=doc_title,
        original_filename=original_filename,
        file_type=ext,
        mime_type=mime,
        file_size_bytes=len(content),
        sha256_hash=document_processor.compute_sha256(content),
        storage_key=storage_filename,
        processing_status=processing_status,
        processing_error=processing_error,
        word_count=word_count,
        page_count=page_count,
        extractor_version="1.0.0",
        indexing_version="1.0.0",
        requires_ocr=requires_ocr,
        uploaded_at=now_iso,
        processed_at=now_iso if processing_status in ("READY", "REQUIRES_OCR") else None,
    )
    db.add(doc_record)

    # Save passages and index only if successfully parsed
    if processing_status == "READY" and chunks:
        passages_to_add = []
        for ch in chunks:
            p = DocumentPassage(
                document_id=doc_id,
                passage_index=ch["index"],
                content=ch["content"],
                page_number=ch.get("page_number"),
                word_count=ch.get("word_count", 0),
                extractor_version="1.0.0",
            )
            db.add(p)
            passages_to_add.append(ch)

        retrieval.get_index().add_chunks(
            document_id=doc_id,
            document_title=doc_title,
            project_id=project_id,
            chunks=passages_to_add,
        )

    await db.commit()

    return DocumentUploadResponse(
        documentId=doc_id,
        projectId=project_id,
        title=doc_title,
        originalFilename=original_filename,
        fileType=ext,
        mimeType=mime,
        fileSizeBytes=len(content),
        sha256=doc_record.sha256_hash,
        processingStatus=processing_status,
        uploadedAt=now_iso,
    )


@router.get("/documents", response_model=list[DocumentListItem])
async def list_documents(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded documents for the specified project."""
    await _verify_project(project_id, db)

    result = await db.execute(
        select(Document)
        .where(Document.project_id == project_id)
        .order_by(Document.uploaded_at.desc())
    )
    docs = result.scalars().all()

    return [
        DocumentListItem(
            documentId=d.id,
            projectId=d.project_id,
            title=d.title,
            originalFilename=d.original_filename,
            fileType=d.file_type,
            fileSizeBytes=d.file_size_bytes,
            processingStatus=d.processing_status,
            processingError=d.processing_error,
            wordCount=d.word_count,
            requiresOcr=d.requires_ocr,
            uploadedAt=d.uploaded_at,
        )
        for d in docs
    ]


@router.get("/documents/{document_id}", response_model=DocumentMetadata)
async def get_document_metadata(
    project_id: str,
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve metadata and indexing details for a specific document."""
    await _verify_project(project_id, db)

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.project_id == project_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found in project '{project_id}'."
        )

    return DocumentMetadata(
        documentId=doc.id,
        projectId=doc.project_id,
        title=doc.title,
        originalFilename=doc.original_filename,
        fileType=doc.file_type,
        mimeType=doc.mime_type,
        fileSizeBytes=doc.file_size_bytes,
        sha256=doc.sha256_hash,
        processingStatus=doc.processing_status,
        processingError=doc.processing_error,
        wordCount=doc.word_count,
        pageCount=doc.page_count,
        extractorVersion=doc.extractor_version,
        indexingVersion=doc.indexing_version,
        requiresOcr=doc.requires_ocr,
        uploadedAt=doc.uploaded_at,
        processedAt=doc.processed_at,
    )


@router.get("/documents/{document_id}/file")
async def download_document_file(
    project_id: str,
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Safely download or view original uploaded document file."""
    if not SAFE_ID_PATTERN.match(document_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document ID format.")

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.project_id == project_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found in project '{project_id}'."
        )

    file_path = _resolve_safe_path(DOCUMENT_UPLOAD_DIR, doc.storage_key)
    if not os.path.isfile(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on disk."
        )

    safe_name = re.sub(r'["\r\n]', '', doc.original_filename)
    return FileResponse(
        file_path,
        media_type=doc.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/documents/{document_id}/reprocess", response_model=DocumentMetadata)
async def reprocess_document(
    project_id: str,
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Reprocess a document from original file. Guarantees no duplicate passages."""
    await _verify_project(project_id, db)

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.project_id == project_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found in project '{project_id}'."
        )

    file_path = _resolve_safe_path(DOCUMENT_UPLOAD_DIR, doc.storage_key)
    if not os.path.isfile(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original document file not found on disk."
        )

    with open(file_path, "rb") as f:
        content = f.read()

    # Reprocessing: delete old passages first to prevent duplicate passages
    await db.execute(
        delete(DocumentPassage).where(DocumentPassage.document_id == document_id)
    )
    retrieval.get_index().remove_document(document_id)

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        proc_result = document_processor.process_document(doc.original_filename, content)
        chunks = proc_result["chunks"]
        word_count = proc_result["word_count"]
        page_count = proc_result.get("page_count", 1)
        requires_ocr = proc_result.get("requires_ocr", False)

        doc.word_count = word_count
        doc.page_count = page_count
        doc.requires_ocr = requires_ocr
        doc.processed_at = now_iso

        if requires_ocr:
            doc.processing_status = "REQUIRES_OCR"
            doc.processing_error = "Scanned document detected. OCR is required."
        elif not chunks and word_count == 0:
            doc.processing_status = "FAILED"
            doc.processing_error = "No extractable text content found in document."
        else:
            doc.processing_status = "READY"
            doc.processing_error = None

            passages_to_add = []
            for ch in chunks:
                p = DocumentPassage(
                    document_id=doc.id,
                    passage_index=ch["index"],
                    content=ch["content"],
                    page_number=ch.get("page_number"),
                    word_count=ch.get("word_count", 0),
                    extractor_version="1.0.0",
                )
                db.add(p)
                passages_to_add.append(ch)

            retrieval.get_index().add_chunks(
                document_id=doc.id,
                document_title=doc.title,
                project_id=project_id,
                chunks=passages_to_add,
            )

    except Exception as e:
        logger.error(f"Reprocessing error for {document_id}: {e}", exc_info=True)
        doc.processing_status = "FAILED"
        doc.processing_error = f"Reprocessing error: {type(e).__name__}: {str(e)}"

    await db.commit()
    await db.refresh(doc)

    return DocumentMetadata(
        documentId=doc.id,
        projectId=doc.project_id,
        title=doc.title,
        originalFilename=doc.original_filename,
        fileType=doc.file_type,
        mimeType=doc.mime_type,
        fileSizeBytes=doc.file_size_bytes,
        sha256=doc.sha256_hash,
        processingStatus=doc.processing_status,
        processingError=doc.processing_error,
        wordCount=doc.word_count,
        pageCount=doc.page_count,
        extractorVersion=doc.extractor_version,
        indexingVersion=doc.indexing_version,
        requiresOcr=doc.requires_ocr,
        uploadedAt=doc.uploaded_at,
        processedAt=doc.processed_at,
    )


@router.delete("/documents/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    project_id: str,
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a document, its indexed passages, and its physical file."""
    await _verify_project(project_id, db)

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.project_id == project_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found in project '{project_id}'."
        )

    # Remove physical file if present
    file_path = _resolve_safe_path(DOCUMENT_UPLOAD_DIR, doc.storage_key)
    if os.path.isfile(file_path):
        try:
            os.remove(file_path)
        except OSError:
            pass

    retrieval.get_index().remove_document(document_id)
    await db.delete(doc)
    await db.commit()

    return {"status": "ok", "deletedDocumentId": document_id}


# ---------------------------------------------------------------------------
# Document Search Endpoint
# ---------------------------------------------------------------------------

@router.post("/documents/search", response_model=SearchResponse)
async def search_documents(
    project_id: str,
    req: SearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Search indexed passages within the specified project."""
    await _verify_project(project_id, db)

    # Ensure retrieval index is populated from DB if empty
    idx = retrieval.get_index()
    if idx.chunk_count == 0:
        await idx.sync_from_db(db, project_id=project_id)

    top_k = req.topK if req.topK and 1 <= req.topK <= 20 else 5
    results = idx.search(query=req.query, project_id=project_id, top_k=top_k)

    # If results are empty but index has not synced all project chunks, sync and retry
    if not results:
        await idx.sync_from_db(db, project_id=project_id)
        results = idx.search(query=req.query, project_id=project_id, top_k=top_k)

    passages = [
        SearchPassageResult(
            documentId=r.document_id,
            documentTitle=r.document_title,
            chunkIndex=r.chunk_index,
            content=r.content,
            score=r.score,
            wordCount=r.word_count,
            pageNumber=r.page_number,
        )
        for r in results
    ]

    return SearchResponse(
        query=req.query,
        projectId=project_id,
        totalResults=len(passages),
        passages=passages,
    )


# ---------------------------------------------------------------------------
# Grounded Site Assistant Endpoints
# ---------------------------------------------------------------------------

@router.get("/assistant/status", response_model=AssistantStatusResponse)
async def get_assistant_status(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Check AI provider availability, configured model, and supported types."""
    await _verify_project(project_id, db)

    info = ai_provider.get_provider_info()

    return AssistantStatusResponse(
        provider=info["provider"],
        model=info["model"],
        providerAvailable=info["provider_available"],
        isConfigured=info["is_configured"],
        supportedTypes=list(document_processor.SUPPORTED_TYPES.keys()),
    )



@router.post("/assistant/query", response_model=AssistantAnswer)
async def ask_assistant(
    project_id: str,
    req: AssistantQueryRequest,
    db: AsyncSession = Depends(get_db),
):
    """Ask a question grounded in the project's uploaded documents."""
    await _verify_project(project_id, db)

    if not req.question or not req.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question query text cannot be empty."
        )

    # If scoped to a specific document, verify document status
    if req.documentId:
        doc_res = await db.execute(
            select(Document).where(Document.id == req.documentId, Document.project_id == project_id)
        )
        target_doc = doc_res.scalar_one_or_none()
        if target_doc:
            if target_doc.processing_status == "REQUIRES_OCR":
                return AssistantAnswer(
                    answer=f"Document '{target_doc.title}' ({target_doc.original_filename}) is a scanned document with no extractable text. Optical Character Recognition (OCR) is required before this document can be queried.",
                    citations=[],
                    isGrounded=False,
                    insufficientEvidence=False,
                    provider=ai_provider.get_active_provider_name(),
                    model=ai_provider.get_active_model_name(),
                    providerAvailable=ai_provider.is_provider_available(),
                    error=f"Document requires OCR: {target_doc.processing_error or 'No text layer found.'}",
                    retrievalInfo=SearchResponse(query=req.question, projectId=project_id, totalResults=0, passages=[]),
                )
            elif target_doc.processing_status == "FAILED":
                return AssistantAnswer(
                    answer=f"Document '{target_doc.title}' ({target_doc.original_filename}) failed text extraction: {target_doc.processing_error or 'Processing error'}. Please reprocess or re-upload the document.",
                    citations=[],
                    isGrounded=False,
                    insufficientEvidence=False,
                    provider=ai_provider.get_active_provider_name(),
                    model=ai_provider.get_active_model_name(),
                    providerAvailable=ai_provider.is_provider_available(),
                    error=f"Document processing failed: {target_doc.processing_error}",
                    retrievalInfo=SearchResponse(query=req.question, projectId=project_id, totalResults=0, passages=[]),
                )

    # Ensure retrieval index is synced for this project
    idx = retrieval.get_index()
    await idx.sync_from_db(db, project_id=project_id)

    # Retrieve relevant passages scoped strictly to project and optional document filter
    raw_results = idx.search(
        query=req.question,
        project_id=project_id,
        document_id=req.documentId,
        top_k=6,
    )

    search_passages = [
        SearchPassageResult(
            documentId=r.document_id,
            documentTitle=r.document_title,
            chunkIndex=r.chunk_index,
            content=r.content,
            score=r.score,
            wordCount=r.word_count,
            pageNumber=r.page_number,
        )
        for r in raw_results
    ]
    retrieval_info = SearchResponse(
        query=req.question,
        projectId=project_id,
        totalResults=len(search_passages),
        passages=search_passages,
    )

    # Convert to format expected by AI provider
    passage_dicts = [
        {
            "document_id": r.document_id,
            "document_title": r.document_title,
            "chunk_index": r.chunk_index,
            "content": r.content,
            "score": r.score,
            "page_number": r.page_number,
        }
        for r in raw_results
    ]

    # Call AI provider
    ai_resp = await ai_provider.ask_question(req.question, passage_dicts)

    # Build validated citations
    citations = []
    for cit in ai_resp.citations:
        download_url = f"/api/v4/projects/{project_id}/documents/{cit.document_id}/file"
        citations.append(
            CitationItem(
                documentId=cit.document_id,
                documentTitle=cit.document_title,
                pageNumber=cit.page_number,
                passageIndex=cit.passage_index,
                excerpt=cit.excerpt,
                downloadUrl=download_url,
            )
        )

    return AssistantAnswer(
        answer=ai_resp.answer,
        citations=citations,
        isGrounded=ai_resp.is_grounded,
        insufficientEvidence=ai_resp.insufficient_evidence,
        provider=ai_resp.provider,
        model=ai_resp.model,
        providerAvailable=ai_resp.provider_available,
        error=ai_resp.error,
        retrievalInfo=retrieval_info,
    )


# ---------------------------------------------------------------------------
# Project-scoped Finding-Evidence Links Endpoints
# ---------------------------------------------------------------------------

@router.post("/findings/{finding_id}/evidence-links", response_model=FindingEvidenceLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_project_finding_evidence_link(
    project_id: str,
    finding_id: str,
    req: FindingEvidenceLinkCreate,
    db: AsyncSession = Depends(get_db),
):
    """Link a document passage to a finding within the project boundary."""
    await _verify_project(project_id, db)
    f_res = await db.execute(
        select(Finding).where(Finding.id == finding_id, Finding.project_id == project_id)
    )
    if not f_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding '{finding_id}' not found in project '{project_id}'."
        )

    from routers.findings import create_finding_evidence_link
    return await create_finding_evidence_link(finding_id=finding_id, req=req, db=db)


@router.get("/findings/{finding_id}/evidence-links", response_model=FindingEvidenceLinksListResponse)
async def list_project_finding_evidence_links(
    project_id: str,
    finding_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all evidence links for a finding within the project boundary."""
    await _verify_project(project_id, db)
    f_res = await db.execute(
        select(Finding).where(Finding.id == finding_id, Finding.project_id == project_id)
    )
    if not f_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding '{finding_id}' not found in project '{project_id}'."
        )

    from routers.findings import list_finding_evidence_links
    return await list_finding_evidence_links(finding_id=finding_id, db=db)

