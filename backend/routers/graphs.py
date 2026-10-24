"""Evidence Graph topology and traceability API routes."""

from __future__ import annotations
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database import get_db
from models import (
    GraphNode,
    GraphEdge,
    GraphInspectorData,
    Document,
    DocumentPassage,
    Finding,
    FindingEvidenceLink,
    Project,
)
from schemas import (
    EvidenceGraphResponse,
    GraphNodeSchema,
    GraphConnectionSchema,
    InspectorDrawerData,
    ProvenanceTrailItem,
    GoverningCodeLimit,
    NodeSourceDetailsResponse,
    GraphNodeCreate,
    GraphEdgeCreate,
    FindingEvidenceLinkResponse,
)

router = APIRouter(prefix="/api/v4/graphs", tags=["graphs"])


@router.get("/by-finding/{finding_id}", response_model=EvidenceGraphResponse)
async def get_graph_by_finding(
    finding_id: str,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve or automatically generate Evidence Graph for a specific finding.
    Enforces project isolation.
    """
    stmt = select(Finding).where(Finding.id == finding_id)
    if project_id:
        stmt = stmt.where(Finding.project_id == project_id)
    fnd = (await db.execute(stmt)).scalar_one_or_none()
    if not fnd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding '{finding_id}' not found.",
        )

    from services.graph_generator import generate_or_get_evidence_graph
    graph_id = await generate_or_get_evidence_graph(fnd, db)
    await db.commit()

    return await get_graph_topology(graph_id=graph_id, project_id=project_id, db=db)


@router.get("/{graph_id}/topology", response_model=EvidenceGraphResponse)
@router.get("/{graph_id}", response_model=EvidenceGraphResponse)
async def get_graph_topology(
    graph_id: str,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve full Evidence Graph topology with enriched node and edge metadata.
    Enforces project boundaries when project_id is provided.
    """
    if project_id:
        prj_res = await db.execute(
            select(Project).where((Project.id == project_id) | (Project.package_id == project_id))
        )
        prj = prj_res.scalar_one_or_none()
        if not prj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )
        project_id = prj.id

    # Nodes query
    stmt_nodes = select(GraphNode).where(GraphNode.graph_id == graph_id)
    if project_id:
        stmt_nodes = stmt_nodes.where(GraphNode.project_id == project_id)
    nodes_result = await db.execute(stmt_nodes)
    nodes = nodes_result.scalars().all()

    # If graph not found directly, check if graph_id corresponds to a finding
    if not nodes:
        clean_finding_id = graph_id[3:] if graph_id.startswith("GR-") else graph_id
        fnd_stmt = select(Finding).where(
            (Finding.id == graph_id)
            | (Finding.id == clean_finding_id)
            | (Finding.id == f"FND-{clean_finding_id}")
        )
        if project_id:
            fnd_stmt = fnd_stmt.where(Finding.project_id == project_id)
        fnd_res = await db.execute(fnd_stmt)
        finding = fnd_res.scalar_one_or_none()
        if finding:
            from services.graph_generator import generate_or_get_evidence_graph
            resolved_graph_id = await generate_or_get_evidence_graph(finding, db)
            await db.commit()
            stmt_nodes = select(GraphNode).where(GraphNode.graph_id == resolved_graph_id)
            if project_id:
                stmt_nodes = stmt_nodes.where(GraphNode.project_id == project_id)
            nodes_result = await db.execute(stmt_nodes)
            nodes = nodes_result.scalars().all()
            graph_id = resolved_graph_id

    # Fallback to default graph if not found and no specific project requested
    if not nodes and not project_id:
        if graph_id in ["default", "GR-FND104"]:
            nodes_result = await db.execute(select(GraphNode))
            nodes = nodes_result.scalars().all()
            if nodes:
                graph_id = nodes[0].graph_id

    if not nodes:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Graph '{graph_id}' not found.")

    # Edges query
    stmt_edges = select(GraphEdge).where(GraphEdge.graph_id == graph_id)
    if project_id:
        stmt_edges = stmt_edges.where(GraphEdge.project_id == project_id)
    edges_result = await db.execute(stmt_edges)
    edges = edges_result.scalars().all()

    # Inspector — default to first tier-2 node
    tier2_nodes = [n for n in nodes if n.tier == 2]
    default_inspector_node_id = tier2_nodes[0].id if tier2_nodes else (nodes[0].id if nodes else "")

    inspector = None
    if default_inspector_node_id:
        inspector_result = await db.execute(
            select(GraphInspectorData).where(
                GraphInspectorData.graph_id == graph_id,
                GraphInspectorData.node_id == default_inspector_node_id,
            )
        )
        inspector = inspector_result.scalar_one_or_none()

    inspector_data = InspectorDrawerData(
        nodeId=default_inspector_node_id,
        title=inspector.title if inspector else "",
        provenanceTrail=[
            ProvenanceTrailItem(**item)
            for item in (inspector.provenance_trail if inspector else [])
        ],
        governingCodeLimits=[
            GoverningCodeLimit(**item)
            for item in (inspector.governing_code_limits if inspector else [])
        ],
    )

    # Determine root finding
    root_nodes = [n for n in nodes if n.tier == 1]
    active_root = root_nodes[0].id if root_nodes else (nodes[0].id if nodes else "")

    return EvidenceGraphResponse(
        graphId=graph_id,
        activeRootFindingId=active_root,
        cpmGraphSyncedAgo="12 minutes ago (Synthetic P6 Sync)",
        nodes=[
            GraphNodeSchema(
                id=n.id,
                tier=n.tier,
                provenance=n.provenance,
                title=n.title,
                primarySubtitle=n.primary_subtitle or "",
                metrics=n.metrics or {},
                badgeText=n.badge_text or "",
                isSelected=(n.id == default_inspector_node_id),
                projectId=n.project_id or "PRJ-NH48-PKG3",
                nodeType=n.node_type or "FINDING",
                codeReference=n.code_reference,
                severity=n.severity,
                documentId=n.document_id,
                passageId=n.passage_id,
                pageNumber=n.page_number,
                citationText=n.citation_text,
                findingId=n.finding_id,
                rationale=n.rationale,
                confidence=n.confidence,
                metadataJson=n.metadata_json or {},
            )
            for n in nodes
        ],
        connections=[
            GraphConnectionSchema(
                sourceNodeId=e.source_node_id,
                targetNodeId=e.target_node_id,
                connectorLabel=e.connector_label or "",
                isCriticalPath=e.is_critical_path,
                id=e.id,
                projectId=e.project_id or "PRJ-NH48-PKG3",
                relationshipType=e.relationship_type or "TRIGGERS",
                provenance=e.provenance or "SYNTHETIC_DEMO",
                rationale=e.rationale,
                confidence=e.confidence,
            )
            for e in edges
        ],
        inspectorDrawer=inspector_data,
    )


@router.get("/{graph_id}/nodes/{node_id}", response_model=NodeSourceDetailsResponse)
async def get_node_source_details(
    graph_id: str,
    node_id: str,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve specific graph node along with its source passage and citation details.
    Handles missing or deleted sources gracefully without failing.
    """
    stmt = select(GraphNode).where(GraphNode.graph_id == graph_id, GraphNode.id == node_id)
    if project_id:
        stmt = stmt.where(GraphNode.project_id == project_id)
    result = await db.execute(stmt)
    node = result.scalar_one_or_none()

    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{node_id}' not found in graph '{graph_id}'."
        )

    # Document & passage resolution
    has_source = False
    doc_title = None
    doc_filename = None
    download_url = None
    passage_content = None
    page_num = node.page_number
    source_status = "NO_SOURCE_ATTACHED"

    if node.document_id:
        doc_res = await db.execute(select(Document).where(Document.id == node.document_id))
        doc = doc_res.scalar_one_or_none()
        if doc:
            has_source = True
            doc_title = doc.title
            doc_filename = doc.original_filename
            download_url = f"/api/v4/projects/{doc.project_id}/documents/{doc.id}/file"

            if node.passage_id is not None:
                pas_res = await db.execute(
                    select(DocumentPassage).where(
                        DocumentPassage.id == node.passage_id,
                        DocumentPassage.document_id == node.document_id,
                    )
                )
                pas = pas_res.scalar_one_or_none()
                if pas:
                    passage_content = pas.content
                    page_num = pas.page_number or page_num
                    source_status = "AVAILABLE"
                else:
                    passage_content = "[Passage deleted or unavailable]"
                    source_status = "MISSING_PASSAGE"
            else:
                source_status = "AVAILABLE"
        else:
            has_source = False
            source_status = "MISSING_DOCUMENT"
            passage_content = "[Source document deleted or unavailable]"

    # Inspector data (code limits & provenance trail)
    insp_res = await db.execute(
        select(GraphInspectorData).where(
            GraphInspectorData.graph_id == graph_id,
            GraphInspectorData.node_id == node_id,
        )
    )
    inspector = insp_res.scalar_one_or_none()

    # Finding evidence links if linked to a finding
    evidence_links = []
    if node.finding_id:
        links_res = await db.execute(
            select(FindingEvidenceLink).where(FindingEvidenceLink.finding_id == node.finding_id)
        )
        raw_links = links_res.scalars().all()
        for lnk in raw_links:
            # Safely resolve document info
            l_doc_res = await db.execute(select(Document).where(Document.id == lnk.document_id))
            l_doc = l_doc_res.scalar_one_or_none()

            l_pas_res = await db.execute(select(DocumentPassage).where(DocumentPassage.id == lnk.passage_id))
            l_pas = l_pas_res.scalar_one_or_none()

            is_missing = (l_doc is None or l_pas is None)
            l_download = f"/api/v4/projects/{l_doc.project_id}/documents/{l_doc.id}/file" if l_doc else None

            evidence_links.append(
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
                    documentTitle=l_doc.title if l_doc else "[Source Document Unavailable]",
                    documentFilename=l_doc.original_filename if l_doc else None,
                    passageContent=l_pas.content if l_pas else "[Passage Unavailable]",
                    downloadUrl=l_download,
                    isMissingSource=is_missing,
                )
            )

    return NodeSourceDetailsResponse(
        nodeId=node.id,
        graphId=node.graph_id,
        projectId=node.project_id or "PRJ-NH48-PKG3",
        tier=node.tier,
        nodeType=node.node_type or "FINDING",
        provenance=node.provenance,
        title=node.title,
        primarySubtitle=node.primary_subtitle or "",
        metrics=node.metrics or {},
        badgeText=node.badge_text or "",
        codeReference=node.code_reference,
        severity=node.severity,
        findingId=node.finding_id,
        rationale=node.rationale,
        confidence=node.confidence,
        metadataJson=node.metadata_json or {},
        hasSourceDocument=has_source,
        documentId=node.document_id,
        documentTitle=doc_title,
        documentFilename=doc_filename,
        passageId=node.passage_id,
        pageNumber=page_num,
        citationText=node.citation_text,
        passageContent=passage_content,
        downloadUrl=download_url,
        sourceStatus=source_status,
        provenanceTrail=[
            ProvenanceTrailItem(**item)
            for item in (inspector.provenance_trail if inspector else [])
        ],
        governingCodeLimits=[
            GoverningCodeLimit(**item)
            for item in (inspector.governing_code_limits if inspector else [])
        ],
        evidenceLinks=evidence_links,
    )


@router.post("/{graph_id}/nodes", response_model=GraphNodeSchema, status_code=status.HTTP_201_CREATED)
async def create_graph_node(
    graph_id: str,
    req: GraphNodeCreate,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new node in the graph with provenance and project isolation validation.
    Enforces that AI inferences cannot be promoted to source-verified automatically.
    """
    target_project = project_id or "PRJ-NH48-PKG3"

    # AI inference guardrail
    if req.provenance == "SOURCE_VERIFIED" and req.isAiInferred:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AI-inferred relationships cannot be automatically marked as SOURCE_VERIFIED. A human review is required."
        )

    # Validate document & passage references if supplied
    if req.documentId:
        doc_res = await db.execute(select(Document).where(Document.id == req.documentId))
        doc = doc_res.scalar_one_or_none()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Referenced document '{req.documentId}' not found."
            )
        if doc.project_id != target_project:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cross-project referencing is not permitted. Document belongs to '{doc.project_id}', but target project is '{target_project}'."
            )
        if req.passageId is not None:
            pas_res = await db.execute(
                select(DocumentPassage).where(
                    DocumentPassage.id == req.passageId,
                    DocumentPassage.document_id == req.documentId,
                )
            )
            pas = pas_res.scalar_one_or_none()
            if not pas:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Passage '{req.passageId}' not found in document '{req.documentId}'."
                )

    # Validate finding reference if supplied
    if req.findingId:
        fnd_res = await db.execute(select(Finding).where(Finding.id == req.findingId))
        fnd = fnd_res.scalar_one_or_none()
        if not fnd:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Referenced finding '{req.findingId}' not found."
            )
        if fnd.project_id != target_project:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cross-project referencing is not permitted. Finding belongs to '{fnd.project_id}', but target project is '{target_project}'."
            )

    node_id = req.id or f"N-{req.nodeType[:3]}-{uuid.uuid4().hex[:6].upper()}"

    # Check if ID exists
    existing = await db.execute(select(GraphNode).where(GraphNode.id == node_id))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Graph node with ID '{node_id}' already exists."
        )

    new_node = GraphNode(
        id=node_id,
        graph_id=graph_id,
        project_id=target_project,
        tier=req.tier,
        node_type=req.nodeType,
        provenance=req.provenance,
        title=req.title,
        primary_subtitle=req.primarySubtitle or "",
        metrics=req.metrics or {},
        badge_text=req.badgeText or "",
        code_reference=req.codeReference,
        severity=req.severity,
        document_id=req.documentId,
        passage_id=req.passageId,
        page_number=req.pageNumber,
        citation_text=req.citationText,
        finding_id=req.findingId,
        rationale=req.rationale,
        confidence=req.confidence,
        metadata_json=req.metadataJson or {},
    )
    db.add(new_node)
    await db.commit()
    await db.refresh(new_node)

    return GraphNodeSchema(
        id=new_node.id,
        tier=new_node.tier,
        provenance=new_node.provenance,
        title=new_node.title,
        primarySubtitle=new_node.primary_subtitle or "",
        metrics=new_node.metrics or {},
        badgeText=new_node.badge_text or "",
        isSelected=False,
        projectId=new_node.project_id,
        nodeType=new_node.node_type,
        codeReference=new_node.code_reference,
        severity=new_node.severity,
        documentId=new_node.document_id,
        passageId=new_node.passage_id,
        pageNumber=new_node.page_number,
        citationText=new_node.citation_text,
        findingId=new_node.finding_id,
        rationale=new_node.rationale,
        confidence=new_node.confidence,
        metadataJson=new_node.metadata_json or {},
    )


@router.post("/{graph_id}/edges", response_model=GraphConnectionSchema, status_code=status.HTTP_201_CREATED)
async def create_graph_edge(
    graph_id: str,
    req: GraphEdgeCreate,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Connect two nodes with a typed causal relationship.
    Validates node existence, provenance, and project boundaries.
    """
    target_project = project_id or "PRJ-NH48-PKG3"

    # AI inference guardrail
    if req.provenance == "SOURCE_VERIFIED" and req.isAiInferred:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AI-inferred relationships cannot be automatically marked as SOURCE_VERIFIED. A human review is required."
        )

    # Validate source and target nodes exist in graph
    src_res = await db.execute(
        select(GraphNode).where(GraphNode.graph_id == graph_id, GraphNode.id == req.sourceNodeId)
    )
    src_node = src_res.scalar_one_or_none()
    if not src_node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source node '{req.sourceNodeId}' not found in graph '{graph_id}'."
        )

    tgt_res = await db.execute(
        select(GraphNode).where(GraphNode.graph_id == graph_id, GraphNode.id == req.targetNodeId)
    )
    tgt_node = tgt_res.scalar_one_or_none()
    if not tgt_node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target node '{req.targetNodeId}' not found in graph '{graph_id}'."
        )

    if src_node.project_id != tgt_node.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cross-project edges are not permitted. Source belongs to '{src_node.project_id}', target belongs to '{tgt_node.project_id}'."
        )

    new_edge = GraphEdge(
        graph_id=graph_id,
        project_id=src_node.project_id or target_project,
        source_node_id=req.sourceNodeId,
        target_node_id=req.targetNodeId,
        connector_label=req.connectorLabel or "",
        is_critical_path=bool(req.isCriticalPath),
        relationship_type=req.relationshipType,
        provenance=req.provenance,
        rationale=req.rationale,
        confidence=req.confidence,
    )
    db.add(new_edge)
    await db.commit()
    await db.refresh(new_edge)

    return GraphConnectionSchema(
        sourceNodeId=new_edge.source_node_id,
        targetNodeId=new_edge.target_node_id,
        connectorLabel=new_edge.connector_label or "",
        isCriticalPath=new_edge.is_critical_path,
        id=new_edge.id,
        projectId=new_edge.project_id,
        relationshipType=new_edge.relationship_type,
        provenance=new_edge.provenance,
        rationale=new_edge.rationale,
        confidence=new_edge.confidence,
    )


@router.delete("/{graph_id}/nodes/{node_id}", status_code=status.HTTP_200_OK)
async def delete_graph_node(
    graph_id: str,
    node_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a node and any connected edges from the graph."""
    node_res = await db.execute(
        select(GraphNode).where(GraphNode.graph_id == graph_id, GraphNode.id == node_id)
    )
    node = node_res.scalar_one_or_none()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{node_id}' not found in graph '{graph_id}'."
        )

    # Delete connected edges
    await db.execute(
        delete(GraphEdge).where(
            GraphEdge.graph_id == graph_id,
            (GraphEdge.source_node_id == node_id) | (GraphEdge.target_node_id == node_id),
        )
    )
    await db.delete(node)
    await db.commit()

    return {"status": "ok", "deletedNodeId": node_id}


@router.delete("/{graph_id}/edges/{edge_id}", status_code=status.HTTP_200_OK)
async def delete_graph_edge(
    graph_id: str,
    edge_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete an edge from the graph."""
    edge_res = await db.execute(
        select(GraphEdge).where(GraphEdge.graph_id == graph_id, GraphEdge.id == edge_id)
    )
    edge = edge_res.scalar_one_or_none()
    if not edge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Edge '{edge_id}' not found in graph '{graph_id}'."
        )

    await db.delete(edge)
    await db.commit()

    return {"status": "ok", "deletedEdgeId": edge_id}
