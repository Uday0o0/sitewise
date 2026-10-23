"""
SITEWISE V4.2 — Automated Evidence Graph Generator.
Constructs navigable, project-isolated Evidence Graphs for newly created findings.
Integrates real verified document citations when available without fabricating sources.
"""

from __future__ import annotations
import re
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import (
    Finding,
    GraphNode,
    GraphEdge,
    GraphInspectorData,
    FindingEvidenceLink,
    Document,
    DocumentPassage,
)


def get_default_graph_id_for_finding(finding_id: str) -> str:
    """Return standard deterministic graph ID format for a finding."""
    if finding_id == "FND-104":
        return "GR-FND104"
    clean_id = re.sub(r"[^A-Za-z0-9]", "", finding_id)
    return f"GR-{clean_id}"


async def generate_or_get_evidence_graph(
    finding: Finding,
    db: AsyncSession,
) -> str:
    """
    Generate or retrieve the Evidence Graph for a finding.
    Idempotent: Reuses existing graph if already created.
    Preserves GR-FND104 demo graph completely.
    Enforces project isolation and strict provenance rules.
    """
    target_graph_id = get_default_graph_id_for_finding(finding.id)

    # 1. Idempotency check: see if nodes already exist for this finding or graph ID
    stmt_existing = select(GraphNode).where(
        (GraphNode.finding_id == finding.id) | (GraphNode.graph_id == target_graph_id)
    )
    existing_nodes = (await db.execute(stmt_existing)).scalars().all()
    if existing_nodes:
        return existing_nodes[0].graph_id

    # 2. Check if real evidence links exist for this finding in the SAME project
    # Enforce project isolation: link.project_id MUST match finding.project_id
    stmt_links = select(FindingEvidenceLink).where(
        FindingEvidenceLink.finding_id == finding.id,
        FindingEvidenceLink.project_id == finding.project_id,
    ).order_by(FindingEvidenceLink.created_at.asc())
    links_res = await db.execute(stmt_links)
    evidence_links = links_res.scalars().all()

    clean_id = re.sub(r"[^A-Za-z0-9]", "", finding.id)
    nodes_to_add: list[GraphNode] = []
    edges_to_add: list[GraphEdge] = []
    inspector_provenance_trail: list[dict] = []
    inspector_code_limits: list[dict] = []

    # 3. Create EVIDENCE node(s) ONLY if real evidence links exist
    evidence_nodes: list[GraphNode] = []
    for idx, lnk in enumerate(evidence_links, start=1):
        doc_res = await db.execute(select(Document).where(Document.id == lnk.document_id))
        doc = doc_res.scalar_one_or_none()
        # Verify cross-project safety: reject document from another project
        if not doc or doc.project_id != finding.project_id:
            continue

        pas_res = await db.execute(
            select(DocumentPassage).where(
                DocumentPassage.id == lnk.passage_id,
                DocumentPassage.document_id == lnk.document_id,
            )
        )
        pas = pas_res.scalar_one_or_none()

        ev_node_id = f"N-EVD-{clean_id}-{idx:02d}"
        ev_node = GraphNode(
            id=ev_node_id,
            graph_id=target_graph_id,
            project_id=finding.project_id,
            tier=1,
            node_type="EVIDENCE",
            provenance=lnk.provenance,  # SOURCE_VERIFIED or HUMAN_REVIEWED
            title=doc.title or "Verified Source Evidence",
            primary_subtitle=(
                f"Document #{doc.id}" + (f" • Page {lnk.page_number}" if lnk.page_number else "")
            ),
            metrics={
                "documentId": doc.id,
                "fileType": doc.file_type,
                "confidence": f"{int((lnk.confidence or 1.0) * 100)}%",
            },
            badge_text=f"{lnk.provenance.replace('_', ' ')} • CITATION",
            code_reference=lnk.citation_text[:60] if lnk.citation_text else None,
            document_id=doc.id,
            passage_id=lnk.passage_id,
            page_number=lnk.page_number,
            citation_text=lnk.citation_text,
            rationale=lnk.relevance_note or "Corroborating document passage attached as physical or contractual evidence.",
            confidence=lnk.confidence or 0.95,
        )
        nodes_to_add.append(ev_node)
        evidence_nodes.append(ev_node)

        inspector_provenance_trail.append({
            "documentId": doc.id,
            "title": doc.title,
            "spec": lnk.citation_text[:80] if lnk.citation_text else "Attached Document Citation",
            "downloadUrl": f"/api/v4/projects/{finding.project_id}/documents/{doc.id}/file",
        })

    # 4. Create FINDING node
    fnd_node_id = f"N-FND-{clean_id}"
    aperture_str = f"{finding.calibrated_aperture_mm}mm" if finding.calibrated_aperture_mm else "Uncalibrated"
    fnd_node = GraphNode(
        id=fnd_node_id,
        graph_id=target_graph_id,
        project_id=finding.project_id,
        tier=2,
        node_type="FINDING",
        finding_id=finding.id,
        provenance=finding.provenance or "AI_INFERRED",
        title=finding.title or f"{finding.id}: Defect Detection",
        primary_subtitle=(
            f"Aperture {aperture_str} • {finding.structure_element or 'Structural Element'}"
        ),
        metrics={
            "aperture": aperture_str,
            "trace": f"{finding.linear_trace_length_mm}mm" if finding.linear_trace_length_mm else "N/A",
            "element": finding.structure_element or "N/A",
        },
        badge_text=f"{(finding.provenance or 'AI_INFERRED').replace('_', ' ')} • {finding.disposition_status or 'AWAITING REVIEW'}",
        code_reference=finding.governing_code or "IRC:112 Indicative Threshold",
        severity="critical" if (finding.calibrated_aperture_mm and finding.calibrated_aperture_mm > 0.20) else "medium",
        rationale=finding.inferred_root_mechanism or finding.direct_impact or "Automated morphological segmentation detection.",
        confidence=0.90 if finding.provenance == "AI_INFERRED" else 1.0,
    )
    nodes_to_add.append(fnd_node)

    # 5. Create RISK node (Tier 3)
    # Strictly label inferred risk as AI_INFERRED or CALCULATED_RISK - never SOURCE_VERIFIED
    rsk_node_id = f"N-RSK-{clean_id}"
    exceedance_str = f"{finding.exceedance_percent}%" if finding.exceedance_percent else "N/A"
    rsk_node = GraphNode(
        id=rsk_node_id,
        graph_id=target_graph_id,
        project_id=finding.project_id,
        tier=3,
        node_type="RISK",
        finding_id=finding.id,
        provenance="AI_INFERRED",
        title=f"RSK: {finding.structure_element or 'Structural Element'} Structural Exposure",
        primary_subtitle=(
            f"Exceedance: {exceedance_str} of permissible limit"
            if (finding.exceedance_percent and finding.exceedance_percent > 0)
            else "Potential serviceability / durability risk under cyclic load"
        ),
        metrics={
            "exposure": finding.cascade_financial_exposure_inr or "Assessment Pending",
            "exceedance": exceedance_str,
        },
        badge_text="INFERRED RISK • ENGINEERING EVALUATION PENDING",
        code_reference=finding.governing_code or "IRC:112 Cl.12.3",
        severity="high" if (finding.exceedance_percent and finding.exceedance_percent > 0) else "medium",
        rationale="Inferred downstream risk to durability, shear transfer capacity, and structural serviceability.",
        confidence=0.85,
    )
    nodes_to_add.append(rsk_node)

    # 6. Create Edges
    # Edge(s) from EVIDENCE to FINDING (if evidence exists)
    for ev_node in evidence_nodes:
        edges_to_add.append(
            GraphEdge(
                graph_id=target_graph_id,
                project_id=finding.project_id,
                source_node_id=ev_node.id,
                target_node_id=fnd_node.id,
                connector_label="Evidences Defect Finding",
                is_critical_path=True,
                relationship_type="EVIDENCES",
                provenance=ev_node.provenance,
                rationale="Traceable project record supports finding observation.",
                confidence=ev_node.confidence or 0.95,
            )
        )

    # Edge from FINDING to RISK
    edges_to_add.append(
        GraphEdge(
            graph_id=target_graph_id,
            project_id=finding.project_id,
            source_node_id=fnd_node.id,
            target_node_id=rsk_node.id,
            connector_label="Triggers Engineering Risk Assessment",
            is_critical_path=bool(finding.critical_path_slip_days and finding.critical_path_slip_days > 0),
            relationship_type="TRIGGERS",
            provenance="AI_INFERRED",
            rationale="Defect detection directly triggers structural engineering evaluation.",
            confidence=0.88,
        )
    )

    # 7. Create Inspector Drawer data for the Finding Node
    inspector_code_limits.append({
        "code": finding.governing_code or "IRC:112 Cl.12.3",
        "limit": f"{finding.permissible_threshold_mm or 0.20}mm",
        "measured": aperture_str,
        "status": "EXCEEDED" if (finding.calibrated_aperture_mm and finding.calibrated_aperture_mm > (finding.permissible_threshold_mm or 0.20)) else "AWAITING_CALIBRATION",
        "verificationStatus": finding.provenance or "AI_INFERRED",
        "sourceDocument": evidence_nodes[0].document_id if evidence_nodes else "Inspection Metrology",
    })

    inspector = GraphInspectorData(
        node_id=fnd_node.id,
        graph_id=target_graph_id,
        title=finding.title or f"{finding.id}: Defect Detection",
        provenance_trail=inspector_provenance_trail,
        governing_code_limits=inspector_code_limits,
    )

    # Add all entities to session
    db.add_all(nodes_to_add)
    db.add_all(edges_to_add)
    db.add(inspector)

    return target_graph_id


async def link_evidence_to_graph(
    finding_id: str,
    link: FindingEvidenceLink,
    db: AsyncSession,
) -> Optional[str]:
    """
    When a new FindingEvidenceLink is created, attach an EVIDENCE node and
    EVIDENCES edge to the finding's graph if not already present.
    Enforces strict project isolation.
    """
    fnd_stmt = select(GraphNode).where(
        GraphNode.finding_id == finding_id,
        GraphNode.node_type == "FINDING",
    )
    fnd_node = (await db.execute(fnd_stmt)).scalars().first()
    if not fnd_node:
        return None

    # Project isolation guard
    if link.project_id != fnd_node.project_id:
        return None

    # Check if this document passage already has an EVIDENCE node in this graph
    ev_stmt = select(GraphNode).where(
        GraphNode.graph_id == fnd_node.graph_id,
        GraphNode.node_type == "EVIDENCE",
        GraphNode.document_id == link.document_id,
        GraphNode.passage_id == link.passage_id,
    )
    existing_ev = (await db.execute(ev_stmt)).scalar_one_or_none()
    if existing_ev:
        return fnd_node.graph_id

    # Retrieve document
    doc_res = await db.execute(select(Document).where(Document.id == link.document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc or doc.project_id != fnd_node.project_id:
        return None

    clean_id = re.sub(r"[^A-Za-z0-9]", "", finding_id)
    ev_node_id = f"N-EVD-{clean_id}-{uuid.uuid4().hex[:4].upper()}"

    new_ev_node = GraphNode(
        id=ev_node_id,
        graph_id=fnd_node.graph_id,
        project_id=fnd_node.project_id,
        tier=1,
        node_type="EVIDENCE",
        provenance=link.provenance,
        title=doc.title or "Verified Source Evidence",
        primary_subtitle=f"Document #{doc.id}" + (f" • Page {link.page_number}" if link.page_number else ""),
        metrics={
            "documentId": doc.id,
            "fileType": doc.file_type,
            "confidence": f"{int((link.confidence or 1.0) * 100)}%",
        },
        badge_text=f"{link.provenance.replace('_', ' ')} • CITATION",
        code_reference=link.citation_text[:60] if link.citation_text else None,
        document_id=doc.id,
        passage_id=link.passage_id,
        page_number=link.page_number,
        citation_text=link.citation_text,
        rationale=link.relevance_note or "Traceable document passage attached as physical or contractual evidence.",
        confidence=link.confidence or 0.95,
    )
    new_edge = GraphEdge(
        graph_id=fnd_node.graph_id,
        project_id=fnd_node.project_id,
        source_node_id=new_ev_node.id,
        target_node_id=fnd_node.id,
        connector_label="Evidences Defect Finding",
        is_critical_path=True,
        relationship_type="EVIDENCES",
        provenance=link.provenance,
        rationale="Traceable project record supports finding observation.",
        confidence=link.confidence or 0.95,
    )
    db.add(new_ev_node)
    db.add(new_edge)
    return fnd_node.graph_id

