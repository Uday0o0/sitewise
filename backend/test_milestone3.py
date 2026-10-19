"""SITEWISE V4.2 — Milestone 3 Automated Test Suite
Traceable Construction Intelligence: Evidence-to-Risk Graph & Document Citation

Validates all Milestone 3 acceptance criteria:
1. Schema validation for graph nodes, edges, provenance, and finding-evidence links.
2. Graph topology retrieval with enriched node and edge metadata.
3. Graph node source details retrieval with inspector data and code limits.
4. Passage-to-finding evidence linking with full traceability.
5. Strict project boundary isolation preventing cross-project links or queries.
6. Explicit provenance enforcement (AI inference cannot be auto-promoted to SOURCE_VERIFIED).
7. Duplicate relationship prevention (409 Conflict).
8. Graceful handling of missing or deleted source documents and passages.
9. Dynamic graph node and edge creation with validation.
10. Proper rejection of non-existent findings, documents, or passage references.
"""

import io
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from pydantic import ValidationError
from sqlalchemy import select

from main import app
from database import engine, async_session, Base
from seed import seed
from models import Project, Finding, Document, DocumentPassage, GraphNode, GraphEdge, FindingEvidenceLink
from schemas import (
    GraphNodeSchema,
    GraphConnectionSchema,
    FindingEvidenceLinkCreate,
    GraphNodeCreate,
    GraphEdgeCreate,
)


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Seed test database before each test."""
    await seed()
    yield


# ---------------------------------------------------------------------------
# Test 1: Schema Validation (Provenance, Nodes, Edges, Links)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_01_schema_validation_provenance_and_nodes():
    """Verify that validated schemas enforce allowed provenance and reject invalid types."""
    # Valid provenances
    for prov in ["SOURCE_VERIFIED", "HUMAN_REVIEWED", "AI_INFERRED", "SYNTHETIC_DEMO", "CALCULATED"]:
        link_req = FindingEvidenceLinkCreate(
            documentId="DOC-TEST",
            passageId=1,
            provenance=prov,
        )
        assert link_req.provenance == prov

    # Invalid provenance must raise ValidationError
    with pytest.raises(ValidationError):
        FindingEvidenceLinkCreate(
            documentId="DOC-TEST",
            passageId=1,
            provenance="INVALID_PROVENANCE_VALUE",
        )

    # Valid GraphNodeCreate
    node_create = GraphNodeCreate(
        tier=1,
        nodeType="EVIDENCE",
        provenance="SOURCE_VERIFIED",
        title="Test Orthomosaic",
    )
    assert node_create.nodeType == "EVIDENCE"

    # Invalid nodeType must raise ValidationError
    with pytest.raises(ValidationError):
        GraphNodeCreate(
            tier=1,
            nodeType="UNSUPPORTED_TYPE",
            title="Invalid",
        )


# ---------------------------------------------------------------------------
# Test 2: Graph Topology Retrieval and Metadata
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_02_graph_topology_retrieval_and_metadata():
    """Verify GET /api/v4/graphs/{graph_id}/topology returns enriched nodes and edges."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v4/graphs/GR-FND104/topology")
        assert res.status_code == 200
        data = res.json()

        assert data["graphId"] == "GR-FND104"
        assert data["activeRootFindingId"] == "N-SRC-001"
        assert len(data["nodes"]) == 5
        assert len(data["connections"]) == 4

        # Verify node enriched attributes
        node_map = {n["id"]: n for n in data["nodes"]}
        assert "N-SRC-001" in node_map
        assert node_map["N-SRC-001"]["nodeType"] == "EVIDENCE"
        assert node_map["N-SRC-001"]["provenance"] == "SOURCE_VERIFIED"
        assert node_map["N-SRC-001"]["projectId"] == "PRJ-NH48-PKG3"

        assert node_map["N-AI-001"]["nodeType"] == "FINDING"
        assert node_map["N-AI-001"]["findingId"] == "FND-104"
        assert node_map["N-AI-001"]["provenance"] == "AI_INFERRED"

        assert node_map["N-RSK-042"]["nodeType"] == "RISK"
        assert node_map["N-CPM-001"]["nodeType"] == "IMPACT"
        assert node_map["N-MIT-001"]["nodeType"] == "ACTION"

        # Verify edge enriched attributes
        for conn in data["connections"]:
            assert conn["projectId"] == "PRJ-NH48-PKG3"
            assert conn["provenance"] == "SYNTHETIC_DEMO"
            assert conn["relationshipType"] in ["EVIDENCES", "TRIGGERS", "CAUSES_IMPACT", "MITIGATES"]

        # Backward compatibility with existing UI
        assert "inspectorDrawer" in data
        assert data["inspectorDrawer"]["nodeId"] == "N-AI-001"
        assert len(data["inspectorDrawer"]["governingCodeLimits"]) >= 1


# ---------------------------------------------------------------------------
# Test 3: Node Source Details Retrieval
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_03_node_source_details_retrieval():
    """Verify GET /api/v4/graphs/{graph_id}/nodes/{node_id} returns source & inspector details."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Retrieve N-AI-001
        res = await ac.get("/api/v4/graphs/GR-FND104/nodes/N-AI-001")
        assert res.status_code == 200
        data = res.json()

        assert data["nodeId"] == "N-AI-001"
        assert data["findingId"] == "FND-104"
        assert data["nodeType"] == "FINDING"
        assert len(data["governingCodeLimits"]) >= 2
        assert len(data["provenanceTrail"]) >= 1

        # Non-existent node
        res_404 = await ac.get("/api/v4/graphs/GR-FND104/nodes/NON_EXISTENT_NODE")
        assert res_404.status_code == 404


# ---------------------------------------------------------------------------
# Test 4: Passage-to-Finding Evidence Linking & Retrieval
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_04_create_finding_evidence_link_and_retrieve():
    """Verify linking an uploaded document passage to an inspection finding."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Upload a real document
        doc_content = b"Pier 18 Cantilever QA Log: Ultrasonic pulse velocity measured 3850 m/s across transverse shear plane. Verified compliant with IRC:112 Clause 12.3 crack aperture limit 0.20mm."
        files = {"file": ("pier18_qa_report.txt", io.BytesIO(doc_content), "text/plain")}
        up_res = await ac.post("/api/v4/projects/PRJ-NH48-PKG3/documents/upload", files=files)
        assert up_res.status_code == 201
        doc_id = up_res.json()["documentId"]

        # 2. Get the passage ID from DB
        async with async_session() as s:
            pas_res = await s.execute(select(DocumentPassage).where(DocumentPassage.document_id == doc_id))
            passage = pas_res.scalar_one()
            passage_id = passage.id

        # 3. Create finding-evidence link
        link_payload = {
            "documentId": doc_id,
            "passageId": passage_id,
            "citationText": "Ultrasonic pulse velocity measured 3850 m/s",
            "relevanceNote": "Corroborates shear capacity deficit on cantilever face.",
            "provenance": "HUMAN_REVIEWED",
            "confidence": 0.95,
        }
        link_res = await ac.post("/api/v4/findings/FND-104/evidence-links", json=link_payload)
        assert link_res.status_code == 201
        link_data = link_res.json()

        assert link_data["findingId"] == "FND-104"
        assert link_data["documentId"] == doc_id
        assert link_data["passageId"] == passage_id
        assert link_data["provenance"] == "HUMAN_REVIEWED"
        assert link_data["documentTitle"] == "pier18_qa_report"
        assert "Ultrasonic pulse velocity" in link_data["passageContent"]
        assert link_data["downloadUrl"] is not None
        assert link_data["isMissingSource"] is False
        link_id = link_data["id"]

        # 4. List evidence links for finding
        list_res = await ac.get("/api/v4/findings/FND-104/evidence-links")
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert list_data["totalLinks"] >= 1
        assert any(lnk["id"] == link_id for lnk in list_data["links"])

        # 5. Retrieve specific link
        single_res = await ac.get(f"/api/v4/findings/FND-104/evidence-links/{link_id}")
        assert single_res.status_code == 200
        assert single_res.json()["id"] == link_id

        # 6. Verify link is visible when querying node source details for N-AI-001
        node_res = await ac.get("/api/v4/graphs/GR-FND104/nodes/N-AI-001")
        assert node_res.status_code == 200
        node_data = node_res.json()
        assert len(node_data["evidenceLinks"]) >= 1
        assert any(lnk["id"] == link_id for lnk in node_data["evidenceLinks"])


# ---------------------------------------------------------------------------
# Test 5: Strict Project Boundary Isolation
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_05_project_boundary_isolation():
    """Verify cross-project references between documents and findings are rejected."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create a second project
        async with async_session() as s:
            proj2 = Project(
                id="PRJ-OTHER-PKG9",
                name="NH-66 Coastal Highway",
                package_id="PKG-9",
                chainage_start_meters=5000,
                chainage_end_meters=9000,
                is_demo_dataset=False,
                data_sync_timestamp="2024-11-14T06:30:00Z",
            )
            s.add(proj2)
            await s.commit()

        # Upload document to PRJ-OTHER-PKG9
        doc_content = b"NH-66 Coastal Project Soil Report: Foundation pile test PASS."
        files = {"file": ("nh66_report.txt", io.BytesIO(doc_content), "text/plain")}
        up_res = await ac.post("/api/v4/projects/PRJ-OTHER-PKG9/documents/upload", files=files)
        assert up_res.status_code == 201
        doc_id_pkg9 = up_res.json()["documentId"]

        # Get passage ID
        async with async_session() as s:
            pas_res = await s.execute(select(DocumentPassage).where(DocumentPassage.document_id == doc_id_pkg9))
            passage_id_pkg9 = pas_res.scalar_one().id

        # Attempt to link document from PRJ-OTHER-PKG9 to finding FND-104 (belongs to PRJ-NH48-PKG3)
        cross_link_payload = {
            "documentId": doc_id_pkg9,
            "passageId": passage_id_pkg9,
            "provenance": "HUMAN_REVIEWED",
        }
        res_cross = await ac.post("/api/v4/findings/FND-104/evidence-links", json=cross_link_payload)
        assert res_cross.status_code == 400
        assert "Cross-project" in res_cross.json()["detail"]


# ---------------------------------------------------------------------------
# Test 6: Provenance Rules & AI Inference Guardrail
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_06_provenance_rules_and_ai_inference_guardrail():
    """Verify AI inferences cannot be auto-promoted to SOURCE_VERIFIED without human review."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Upload valid document
        doc_content = b"IRC:112 Code Section 12: Permissible crack aperture is 0.20mm under serviceability limit state."
        files = {"file": ("irc_spec.txt", io.BytesIO(doc_content), "text/plain")}
        up_res = await ac.post("/api/v4/projects/PRJ-NH48-PKG3/documents/upload", files=files)
        doc_id = up_res.json()["documentId"]

        async with async_session() as s:
            pas_res = await s.execute(select(DocumentPassage).where(DocumentPassage.document_id == doc_id))
            passage_id = pas_res.scalar_one().id

        # 1. Attempt to auto-promote AI inference to SOURCE_VERIFIED with isAiInferred=True -> MUST REJECT
        ai_auto_verified = {
            "documentId": doc_id,
            "passageId": passage_id,
            "provenance": "SOURCE_VERIFIED",
            "isAiInferred": True,
        }
        res_fail = await ac.post("/api/v4/findings/FND-104/evidence-links", json=ai_auto_verified)
        assert res_fail.status_code == 400
        assert "AI-inferred relationships cannot be automatically marked as SOURCE_VERIFIED" in res_fail.json()["detail"]

        # 2. Attempt SOURCE_VERIFIED with citation text that is NOT in the document passage -> MUST REJECT
        fabricated_citation = {
            "documentId": doc_id,
            "passageId": passage_id,
            "citationText": "Completely fabricated text not in IRC 112 spec",
            "provenance": "SOURCE_VERIFIED",
            "isAiInferred": False,
        }
        res_mismatch = await ac.post("/api/v4/findings/FND-104/evidence-links", json=fabricated_citation)
        assert res_mismatch.status_code == 400
        assert "citation text does not match" in res_mismatch.json()["detail"]

        # 3. Create genuine AI_INFERRED relationship -> MUST SUCCEED as AI_INFERRED
        ai_inferred = {
            "documentId": doc_id,
            "passageId": passage_id,
            "citationText": "Permissible crack aperture is 0.20mm",
            "provenance": "AI_INFERRED",
            "isAiInferred": True,
        }
        res_ai = await ac.post("/api/v4/findings/FND-104/evidence-links", json=ai_inferred)
        assert res_ai.status_code == 201
        assert res_ai.json()["provenance"] == "AI_INFERRED"


# ---------------------------------------------------------------------------
# Test 7: Duplicate Relationship Prevention
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_07_prevent_duplicate_evidence_links():
    """Verify attempting to create a duplicate link returns 409 Conflict."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        doc_content = b"Test doc for duplicate link test."
        files = {"file": ("dup_test.txt", io.BytesIO(doc_content), "text/plain")}
        up_res = await ac.post("/api/v4/projects/PRJ-NH48-PKG3/documents/upload", files=files)
        doc_id = up_res.json()["documentId"]

        async with async_session() as s:
            pas = (await s.execute(select(DocumentPassage).where(DocumentPassage.document_id == doc_id))).scalar_one()
            passage_id = pas.id

        link_payload = {
            "documentId": doc_id,
            "passageId": passage_id,
            "provenance": "HUMAN_REVIEWED",
        }

        # First link -> 201 Created
        res1 = await ac.post("/api/v4/findings/FND-104/evidence-links", json=link_payload)
        assert res1.status_code == 201

        # Duplicate link -> 409 Conflict
        res2 = await ac.post("/api/v4/findings/FND-104/evidence-links", json=link_payload)
        assert res2.status_code == 409
        assert "already exists" in res2.json()["detail"]


# ---------------------------------------------------------------------------
# Test 8: Graceful Handling of Missing or Deleted Sources
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_08_missing_and_deleted_source_handling():
    """Verify that deleting a source document is handled gracefully without 500 errors."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Upload doc and create link
        doc_content = b"Temporary document to be deleted."
        files = {"file": ("temp_del.txt", io.BytesIO(doc_content), "text/plain")}
        up_res = await ac.post("/api/v4/projects/PRJ-NH48-PKG3/documents/upload", files=files)
        doc_id = up_res.json()["documentId"]

        async with async_session() as s:
            pas = (await s.execute(select(DocumentPassage).where(DocumentPassage.document_id == doc_id))).scalar_one()
            passage_id = pas.id

        link_res = await ac.post(
            "/api/v4/findings/FND-104/evidence-links",
            json={"documentId": doc_id, "passageId": passage_id, "provenance": "HUMAN_REVIEWED"},
        )
        assert link_res.status_code == 201
        link_id = link_res.json()["id"]

        # 2. Delete the document
        del_res = await ac.delete(f"/api/v4/projects/PRJ-NH48-PKG3/documents/{doc_id}")
        assert del_res.status_code == 200

        # 3. Retrieve the link -> must return 200 with isMissingSource=True
        link_after_del = await ac.get(f"/api/v4/findings/FND-104/evidence-links/{link_id}")
        assert link_after_del.status_code == 200
        data = link_after_del.json()
        assert data["isMissingSource"] is True
        assert "Unavailable" in data["documentTitle"]

        # 4. Create a graph node pointing to deleted document -> query source details
        node_res = await ac.post(
            "/api/v4/graphs/GR-FND104/nodes",
            json={
                "id": "N-ORPHAN-001",
                "tier": 1,
                "nodeType": "EVIDENCE",
                "provenance": "HUMAN_REVIEWED",
                "title": "Orphan Evidence Node",
                "documentId": "DOC-NON-EXISTENT-999",
            },
        )
        assert node_res.status_code == 404  # Rejects non-existent document at creation time


# ---------------------------------------------------------------------------
# Test 9: Graph Node & Edge Creation Operations
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_09_graph_node_and_edge_operations():
    """Verify dynamically adding nodes and edges to the Evidence Graph."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Add new node
        new_node_payload = {
            "id": "N-EVD-999",
            "tier": 1,
            "nodeType": "EVIDENCE",
            "provenance": "HUMAN_REVIEWED",
            "title": "Ultrasonic Pulse Velocity Field Log",
            "primarySubtitle": "Measured 3850 m/s on Pier 18 face",
            "metrics": {"upvVelocity": "3850 m/s"},
            "badgeText": "FIELD VERIFIED",
        }
        create_node_res = await ac.post("/api/v4/graphs/GR-FND104/nodes", json=new_node_payload)
        assert create_node_res.status_code == 201
        assert create_node_res.json()["id"] == "N-EVD-999"

        # 2. Add new edge connecting N-EVD-999 to N-AI-001
        new_edge_payload = {
            "sourceNodeId": "N-EVD-999",
            "targetNodeId": "N-AI-001",
            "connectorLabel": "Corroborates Acoustic Soundness",
            "relationshipType": "EVIDENCES",
            "provenance": "HUMAN_REVIEWED",
            "isCriticalPath": False,
        }
        create_edge_res = await ac.post("/api/v4/graphs/GR-FND104/edges", json=new_edge_payload)
        assert create_edge_res.status_code == 201
        edge_data = create_edge_res.json()
        assert edge_data["sourceNodeId"] == "N-EVD-999"
        edge_id = edge_data["id"]

        # 3. Verify updated topology has 6 nodes and 5 edges
        topo_res = await ac.get("/api/v4/graphs/GR-FND104/topology")
        assert topo_res.status_code == 200
        topo_data = topo_res.json()
        assert len(topo_data["nodes"]) == 6
        assert len(topo_data["connections"]) == 5

        # 4. Delete the newly created edge
        del_edge_res = await ac.delete(f"/api/v4/graphs/GR-FND104/edges/{edge_id}")
        assert del_edge_res.status_code == 200

        # 5. Delete the newly created node
        del_node_res = await ac.delete(f"/api/v4/graphs/GR-FND104/nodes/N-EVD-999")
        assert del_node_res.status_code == 200

        # Verify back to 5 nodes and 4 edges
        topo_final = (await ac.get("/api/v4/graphs/GR-FND104/topology")).json()
        assert len(topo_final["nodes"]) == 5
        assert len(topo_final["connections"]) == 4


# ---------------------------------------------------------------------------
# Test 10: Non-Existent References Validation
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_10_non_existent_references_validation():
    """Verify proper 404/400 errors when referencing non-existent findings or documents."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Non-existent finding
        res1 = await ac.post(
            "/api/v4/findings/FND-DOES-NOT-EXIST/evidence-links",
            json={"documentId": "DOC-ANY", "passageId": 1, "provenance": "HUMAN_REVIEWED"},
        )
        assert res1.status_code == 404
        assert "Finding 'FND-DOES-NOT-EXIST' not found" in res1.json()["detail"]

        # Non-existent document
        res2 = await ac.post(
            "/api/v4/findings/FND-104/evidence-links",
            json={"documentId": "DOC-NON-EXISTENT", "passageId": 1, "provenance": "HUMAN_REVIEWED"},
        )
        assert res2.status_code == 404
        assert "Document 'DOC-NON-EXISTENT' not found" in res2.json()["detail"]
