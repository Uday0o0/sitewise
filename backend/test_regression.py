"""
SITEWISE V4.2 — Automated Regression Test Suite
Covers core workflows, API contracts, deterministic simulator evaluation,
validation guardrails, and SQLite persistence.
"""

import pytest
import io
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from database import engine, async_session, Base
from seed import seed, calculate_material_variance, seed_planning_demo_records
from models import (
    Finding,
    SimulatorCommit,
    Project,
    MaterialReconciliation,
    ContractorClaim,
    GraphNode,
    GraphEdge,
    FindingEvidenceLink,
    DocumentPassage,
)
from sqlalchemy import select
from test_milestone1 import generate_synthetic_image


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Ensure database is seeded before test runs."""
    await seed()
    yield


@pytest.mark.asyncio
async def test_01_health_check():
    """Verify system health endpoint and synthetic demo marker."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v4/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["version"] == "4.2.0"
        assert data["demo"] is True


@pytest.mark.asyncio
async def test_02_projects_list_and_overview():
    """Verify projects list and complete Overview response structure."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Projects list
        res = await ac.get("/api/v4/projects")
        assert res.status_code == 200
        projects = res.json()
        assert len(projects) >= 1
        prj = projects[0]
        assert prj["id"] == "PRJ-NH48-PKG3"
        assert prj["isDemoMode"] is True

        # Project overview
        res_ov = await ac.get(f"/api/v4/projects/{prj['id']}/overview")
        assert res_ov.status_code == 200
        ov = res_ov.json()
        assert "projectMetadata" in ov
        assert ov["projectMetadata"]["chainageStartMeters"] == 14200
        assert ov["projectMetadata"]["chainageEndMeters"] == 18600
        assert ov["projectMetadata"]["isDemoDataset"] is True

        # KPIs
        kpis = ov["kpiSummaries"]
        assert kpis["criticalPathVarianceDays"] == -4
        assert kpis["criticalPathStatus"] == "CRITICAL_DRIFT"
        assert kpis["materialReconciledPercent"] == 94.2
        assert kpis["tenderCostVarianceInrLakhs"] == -4.85

        # Priority decisions and milestones
        assert len(ov["priorityDecisions"]) >= 1
        assert len(ov["cpmMilestones"]) >= 1
        assert len(ov["evidenceIngestStream"]) >= 1
        assert len(ov["unconfiguredSensors"]) >= 1


@pytest.mark.asyncio
async def test_03_inspection_telemetry_and_disposition():
    """Verify inspection finding telemetry and disposition validation/submission."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Finding telemetry
        res = await ac.get("/api/v4/findings/FND-104/telemetry")
        assert res.status_code == 200
        tel = res.json()
        assert tel["findingId"] == "FND-104"
        assert tel["assetChainage"] == "Ch. 14+320"
        assert tel["structureElement"] == "Pier Cap 18 Cantilever Downstream Face"
        assert tel["photogrammetricMetrology"]["calibratedApertureMm"] == 0.35
        assert tel["photogrammetricMetrology"]["governingCode"] == "IRC:112 Clause 12.3"
        assert tel["photogrammetricMetrology"]["exceedancePercent"] == 75

        # Disposition validation: empty notes should be rejected or handled properly
        # Submit valid disposition
        disp_payload = {
            "disposition": "CONFIRM_NCR",
            "engineerNotes": "Confirmed transverse shear crack aperture of 0.35mm exceeds IRC:112 0.20mm limit.",
            "signerName": "Lead Resident Engineer",
            "signerLicenseId": "RE-2024-DEMO",
        }
        res_disp = await ac.post("/api/v4/findings/FND-104/disposition", json=disp_payload)
        assert res_disp.status_code == 200
        disp_data = res_disp.json()
        assert disp_data["newStatus"] == "CONFIRMED_NCR"
        assert disp_data["protocolId"] == "NCR-104"
        assert len(disp_data["auditHash"]) == 64  # SHA-256


@pytest.mark.asyncio
async def test_04_evidence_graph_topology():
    """Verify Evidence Graph causal nodes, critical path connections, and inspector drawer."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v4/graphs/GR-FND104/topology")
        assert res.status_code == 200
        graph = res.json()
        assert graph["graphId"] == "GR-FND104"
        assert len(graph["nodes"]) == 5
        assert len(graph["connections"]) == 4

        # Verify tiers
        tiers = {n["tier"] for n in graph["nodes"]}
        assert tiers == {1, 2, 3, 4, 5}

        # Verify inspector drawer
        inspector = graph["inspectorDrawer"]
        assert len(inspector["provenanceTrail"]) >= 1
        assert len(inspector["governingCodeLimits"]) >= 1


@pytest.mark.asyncio
async def test_05_simulator_parametric_evaluation():
    """Verify simulator outputs are mathematically derived from parameters, not hardcoded."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Run 1: Standard inputs
        res1 = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 150000,
                "cfrpCuringWindowHours": 48,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
            },
        })
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["baselineFinancialExposureInr"] == (150000 * 10) + 530000  # 20,30,000 (cross-screen aligned)
        assert data1["scenarioProposedCostInr"] == 350000 + (2 * 100000)  # 5,50,000
        assert data1["netCalculatedAvoidanceInr"] == 2030000 - 550000  # 14,80,000 (14.80L Net Avoidance)
        assert data1["scenarioScheduleSlipDays"] == 3  # (48/24) + (24/24) = 3
        assert data1["daysRecovered"] == 15  # 18 - 3
        assert data1["feasibilityAssessment"]["authorityAcceptanceRisk"] == "LOW"
        assert data1["milestonesDelta"][0]["scenarioDate"] == "2024-11-23"

        # Run 2: Double gantry rate, conservative 72h curing
        res2 = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 300000,
                "cfrpCuringWindowHours": 72,
                "independentEngineerSlaHours": 48,
                "upvTargetThresholdMps": 4000,
            },
        })
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["baselineFinancialExposureInr"] == (300000 * 10) + 530000  # 35,30,000
        assert data2["scenarioProposedCostInr"] == 350000 + (3 * 100000)  # 6,50,000
        assert data2["scenarioScheduleSlipDays"] == 5  # (72/24) + (48/24) = 5
        assert data2["daysRecovered"] == 13  # 18 - 5
        assert data2["milestonesDelta"][0]["scenarioDate"] == "2024-11-25"
        # Proves outputs are dynamically computed from inputs
        assert data2["baselineFinancialExposureInr"] != data1["baselineFinancialExposureInr"]
        assert data2["scenarioScheduleSlipDays"] != data1["scenarioScheduleSlipDays"]


@pytest.mark.asyncio
async def test_06_simulator_commitment_guardrail():
    """Verify commit guardrail requires explicit acknowledgement, and records commit."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Missing acknowledgement -> must fail with 400
        fail_res = await ac.post("/api/v4/simulator/commit", json={
            "simulationRunId": "SIM-TEST-FAIL",
            "findingId": "FND-104",
            "acknowledgement": False,
        })
        assert fail_res.status_code == 400
        assert "acknowledgement required" in fail_res.json()["detail"].lower()

        # Valid acknowledgement -> succeeds with 200 and commitId
        ok_res = await ac.post("/api/v4/simulator/commit", json={
            "simulationRunId": "SIM-TEST-OK",
            "findingId": "FND-104",
            "acknowledgement": True,
        })
        assert ok_res.status_code == 200
        commit_data = ok_res.json()
        assert commit_data["status"] == "COMMITTED"
        assert commit_data["commitId"].startswith("CMT-")

        # Verify record exists in database
        async with async_session() as s:
            result = await s.execute(select(SimulatorCommit).where(SimulatorCommit.id == commit_data["commitId"]))
            commit_record = result.scalar_one_or_none()
            assert commit_record is not None
            assert commit_record.finding_id == "FND-104"


@pytest.mark.asyncio
async def test_07_database_persistence_across_restart():
    """Verify committed findings and simulator records persist across database engine disposal/restart."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Submit a disposition
        disp_res = await ac.post("/api/v4/findings/FND-104/disposition", json={
            "disposition": "CONFIRM_NCR",
            "engineerNotes": "Persistent audit test across server restart",
            "signerName": "Audit Engineer",
            "signerLicenseId": "RE-AUDIT-001",
        })
        assert disp_res.status_code == 200

        # Submit a commit
        cmt_res = await ac.post("/api/v4/simulator/commit", json={
            "simulationRunId": "SIM-PERSIST-001",
            "findingId": "FND-104",
            "acknowledgement": True,
        })
        assert cmt_res.status_code == 200
        saved_commit_id = cmt_res.json()["commitId"]

    # Simulate server shutdown / restart: dispose engine and open fresh connection
    await engine.dispose()
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    fresh_engine = create_async_engine("sqlite+aiosqlite:///./sitewise.db", echo=False)
    fresh_session = async_sessionmaker(fresh_engine, expire_on_commit=False)

    async with fresh_session() as s:
        # Verify finding disposition status persisted
        f_res = await s.execute(select(Finding).where(Finding.id == "FND-104"))
        finding = f_res.scalar_one_or_none()
        assert finding is not None
        assert finding.disposition_status == "CONFIRMED_NCR"
        assert finding.disposition_notes == "Persistent audit test across server restart"

        # Verify simulator commit persisted
        c_res = await s.execute(select(SimulatorCommit).where(SimulatorCommit.id == saved_commit_id))
        commit = c_res.scalar_one_or_none()
        assert commit is not None
        assert commit.finding_id == "FND-104"

    await fresh_engine.dispose()


@pytest.mark.asyncio
async def test_08_cross_page_consistency_and_citations():
    """Verify cross-page consistency of Finding FND-104, Project PRJ-NH48-PKG3, Risk RSK-042,
    and verified source document citations across Evidence Centre, Graph, and Assistant.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Evidence Centre / Documents API returns real seeded project documents
        res_docs = await ac.get("/api/v4/projects/PRJ-NH48-PKG3/documents")
        assert res_docs.status_code == 200
        docs = res_docs.json()
        doc_ids = {d["documentId"] for d in docs}
        assert "DOC-57F675F71F" in doc_ids
        assert "DOC-5442BA12E9" in doc_ids

        # 2. Finding Evidence Links for FND-104 point to actual documents and passages
        res_links = await ac.get("/api/v4/findings/FND-104/evidence-links")
        assert res_links.status_code == 200
        links_data = res_links.json()
        assert links_data["findingId"] == "FND-104"
        assert links_data["projectId"] == "PRJ-NH48-PKG3"
        assert len(links_data["links"]) >= 2

        # Verify each link has valid downloadUrl and existing file
        for lnk in links_data["links"]:
            assert lnk["isMissingSource"] is False
            assert lnk["downloadUrl"] is not None
            # Fetch document file
            res_file = await ac.get(lnk["downloadUrl"])
            assert res_file.status_code == 200
            assert len(res_file.content) > 0

        # 3. Evidence Graph Topology preserves FND-104, PRJ-NH48-PKG3, RSK-042
        res_graph = await ac.get("/api/v4/graphs/GR-FND104/topology")
        assert res_graph.status_code == 200
        g_data = res_graph.json()
        node_map = {n["id"]: n for n in g_data["nodes"]}
        assert "N-AI-001" in node_map
        assert node_map["N-AI-001"]["findingId"] == "FND-104"
        assert node_map["N-AI-001"]["documentId"] == "DOC-57F675F71F"
        assert "N-RSK-042" in node_map
        assert "RSK-042" in node_map["N-RSK-042"]["title"]

        # 4. Node Source Details for N-AI-001 returns source passages and provenance trail
        res_node = await ac.get("/api/v4/graphs/GR-FND104/nodes/N-AI-001")
        assert res_node.status_code == 200
        n_data = res_node.json()
        assert n_data["findingId"] == "FND-104"
        assert n_data["documentId"] == "DOC-57F675F71F"
        assert n_data["hasSourceDocument"] is True
        assert n_data["sourceStatus"] == "AVAILABLE"
        assert len(n_data["evidenceLinks"]) >= 2

        # 5. Simulator evaluates FND-104 and preserves unverified claim markers
        res_sim = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "graphNodeId": "N-AI-001",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 150000,
                "cfrpCuringWindowHours": 48,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
            },
        })
        assert res_sim.status_code == 200
        sim_data = res_sim.json()
        assert sim_data["simulationRunId"] is not None
        assert sim_data["disclaimer"] is not None
        # Unverified parameters explicitly flagged
        source_backed = sim_data["inputClassification"]["sourceBacked"]
        upv_param = next(p for p in source_backed if p["param"] == "upvTargetThresholdMps")
        assert upv_param["isVerified"] is False
        assert upv_param["verificationStatus"] == "UNVERIFIED"
        assert "IRC:SP:40 is not present in the project corpus" in upv_param["verificationNote"]

        # 6. Lexical retrieval in Assistant finds seeded passages for IRC:112 and Pier 18
        res_search = await ac.post("/api/v4/projects/PRJ-NH48-PKG3/documents/search", json={
            "query": "crack aperture 0.20mm IRC:112",
            "topK": 3,
        })
        assert res_search.status_code == 200
        s_data = res_search.json()
        assert len(s_data["passages"]) >= 1
        assert "0.20" in s_data["passages"][0]["content"]


@pytest.mark.asyncio
async def test_09_demo_data_integrity_and_provenance_audit():
    """Verify demo data integrity, provenance classification, and source verification rules.

    Audits:
    1. Source claims unsupported by their cited passages.
    2. Missing source documents and missing passages handling.
    3. Observations incorrectly presented as standards or acceptance thresholds (3,850 m/s UPV).
    4. Synthetic demo data is never presented as verified project evidence.
    5. AI answers whose citations do not support the associated claims (out-of-bounds rejection).
    6. Consistency of provenance labels across API responses.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Re-seed to ensure clean baseline
        from seed import seed
        await seed()

        # -------------------------------------------------------------------
        # 1. Missing source documents return 404
        # -------------------------------------------------------------------
        res_missing_doc = await ac.get("/api/v4/projects/PRJ-NH48-PKG3/documents/DOC-NONEXISTENT/file")
        assert res_missing_doc.status_code == 404

        res_missing_meta = await ac.get("/api/v4/projects/PRJ-NH48-PKG3/documents/DOC-NONEXISTENT")
        assert res_missing_meta.status_code == 404

        # -------------------------------------------------------------------
        # 2. Source claims verified against actual passage text
        # -------------------------------------------------------------------
        res_links = await ac.get("/api/v4/projects/PRJ-NH48-PKG3/findings/FND-104/evidence-links")
        assert res_links.status_code == 200
        links = res_links.json()["links"]
        assert len(links) >= 2

        irc_link = next(l for l in links if l["documentId"] == "DOC-57F675F71F")
        assert irc_link["provenance"] == "SOURCE_VERIFIED"
        assert "0.20 mm" in irc_link["citationText"]

        qa_link = next(l for l in links if l["documentId"] == "DOC-5442BA12E9")
        assert qa_link["provenance"] == "SOURCE_VERIFIED"
        assert "3850 m/s" in qa_link["citationText"]

        # Verify that actual passage text from search strictly supports the crack aperture claim
        res_search_irc = await ac.post("/api/v4/projects/PRJ-NH48-PKG3/documents/search", json={
            "query": "Clause 12.3 Limit State of Cracking",
            "topK": 2,
        })
        assert res_search_irc.status_code == 200
        p1_data = res_search_irc.json()["passages"][0]
        assert "0.20 mm" in p1_data["content"]
        assert "Clause 12.3" in p1_data["content"]

        # -------------------------------------------------------------------
        # 3. Observation (3,850 m/s) distinguished from acceptance threshold
        # -------------------------------------------------------------------
        res_sim = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "graphNodeId": "N-AI-001",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 150000,
                "cfrpCuringWindowHours": 48,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
            },
        })
        assert res_sim.status_code == 200
        sim_data = res_sim.json()

        # The 3850 m/s input must be explicitly UNVERIFIED as a standard threshold
        source_backed = sim_data["inputClassification"]["sourceBacked"]
        upv_param = next(p for p in source_backed if p["param"] == "upvTargetThresholdMps")
        assert upv_param["isVerified"] is False
        assert upv_param["verificationStatus"] == "UNVERIFIED"
        assert "IRC:SP:40 is not present in the project corpus" in upv_param["verificationNote"]
        assert "3,850 m/s is the in-situ field measurement" in upv_param["verificationNote"]

        # Model boundaries must distinguish field observation and state no certified advice
        boundaries = sim_data["modelBoundaries"]
        assert any("Field observation distinction: 3,850 m/s is an empirical in-situ reading" in b for b in boundaries)
        assert any("not certified engineering" in b.lower() for b in boundaries)

        # -------------------------------------------------------------------
        # 4. Synthetic data is never presented as verified evidence
        # -------------------------------------------------------------------
        res_telemetry = await ac.get("/api/v4/findings/FND-104/telemetry")
        assert res_telemetry.status_code == 200
        ndt_list = res_telemetry.json()["ndtCorroboration"]
        assert len(ndt_list) >= 3

        rebound = next(n for n in ndt_list if "Rebound Hammer" in n["protocolName"])
        assert rebound["provenance"] == "SYNTHETIC_DEMO"

        upv_ndt = next(n for n in ndt_list if "UPV" in n["protocolName"])
        assert upv_ndt["provenance"] == "SOURCE_VERIFIED"
        assert upv_ndt["sourceDocumentId"] == "DOC-5442BA12E9"

        core = next(n for n in ndt_list if "Core" in n["protocolName"])
        assert core["provenance"] == "HUMAN_REVIEWED"

        # Verify simulator synthetic inputs are flagged isSynthetic
        synthetic_inputs = sim_data["inputClassification"]["syntheticDemo"]
        for s_in in synthetic_inputs:
            assert s_in["isSynthetic"] is True
            assert s_in["verificationStatus"] == "SYNTHETIC_DEMO"

        # -------------------------------------------------------------------
        # 5. AI answers: reject fabricated citations
        # -------------------------------------------------------------------
        from services.ai_provider import _validate_citations
        sample_passages = [
            {"document_id": "DOC-1", "document_title": "Doc 1", "content": "Sample content 1", "chunk_index": 0},
            {"document_id": "DOC-2", "document_title": "Doc 2", "content": "Sample content 2", "chunk_index": 1},
        ]
        # Valid citation [DOC-1] kept, fabricated citation [DOC-99] stripped
        raw_answer_with_hallucination = "Per [DOC-1], crack limit is 0.20mm. Per [DOC-99], gantry rate is ₹10L."
        validated = _validate_citations(raw_answer_with_hallucination, sample_passages)
        assert len(validated) == 1
        assert validated[0].document_id == "DOC-1"
        assert not any(c.document_id == "DOC-99" for c in validated)

        # -------------------------------------------------------------------
        # 6. Provenance label consistency across graph nodes
        # -------------------------------------------------------------------
        res_graph = await ac.get("/api/v4/graphs/GR-FND104/topology")
        assert res_graph.status_code == 200
        nodes = res_graph.json()["nodes"]
        node_map = {n["id"]: n for n in nodes}

        # N-SRC-001 is SOURCE_VERIFIED
        assert node_map["N-SRC-001"]["provenance"] == "SOURCE_VERIFIED"
        # N-AI-001 is AI_INFERRED
        assert node_map["N-AI-001"]["provenance"] == "AI_INFERRED"
        # N-MIT-001 is PROPOSED_ACTION (unverified spec)
        assert node_map["N-MIT-001"]["provenance"] == "PROPOSED_ACTION"
        assert "UNVERIFIED" in node_map["N-MIT-001"]["codeReference"]


@pytest.mark.asyncio
async def test_10_planning_materials_and_claims_api():
    """
    Test Planning & Valuation API endpoints:
    1. Both endpoints return expected seeded records for NH-48 project.
    2. Empty results for an existing project with no records.
    3. 404 for unknown/nonexistent project IDs.
    4. Project isolation (no data leakage across projects).
    5. Variance calculation formula and zero theoretical quantity handling.
    6. Synthetic provenance flags and idempotent seeding.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # ── 1. Both endpoints return expected records for PRJ-NH48-PKG3 ──
        res_mat = await ac.get("/api/v4/projects/PRJ-NH48-PKG3/materials/reconciliation")
        assert res_mat.status_code == 200
        mat_data = res_mat.json()
        assert mat_data["projectId"] == "PRJ-NH48-PKG3"
        assert mat_data["totalItems"] == 5
        assert mat_data["compliantCount"] == 4
        assert mat_data["overconsumedCount"] == 1
        assert mat_data["savingCount"] == 0

        # Verify specific items
        tmt = next(m for m in mat_data["items"] if m["materialCode"] == "TMT-FE550D")
        assert tmt["materialName"] == "Thermo-Mechanically Treated Rebar (Fe 550D)"
        assert tmt["unit"] == "MT"
        assert tmt["theoreticalQuantity"] == 3620.0
        assert tmt["actualIssuedQuantity"] == 3410.0
        assert tmt["varianceQuantity"] == -210.0
        assert tmt["variancePercent"] == -5.8
        assert tmt["status"] == "COMPLIANT"
        assert tmt["provenance"] == "SYNTHETIC_DEMO"

        lrpc = next(m for m in mat_data["items"] if m["materialCode"] == "LRPC-15.2MM")
        assert lrpc["theoreticalQuantity"] == 420.0
        assert lrpc["actualIssuedQuantity"] == 448.0
        assert lrpc["variancePercent"] == 6.7
        assert lrpc["status"] == "OVERCONSUMED"
        assert lrpc["provenance"] == "SYNTHETIC_DEMO"

        # Verify all material items have SYNTHETIC_DEMO provenance
        for item in mat_data["items"]:
            assert item["provenance"] == "SYNTHETIC_DEMO"

        # Verify claims endpoint
        res_claims = await ac.get("/api/v4/projects/PRJ-NH48-PKG3/claims")
        assert res_claims.status_code == 200
        claims_data = res_claims.json()
        assert claims_data["projectId"] == "PRJ-NH48-PKG3"
        assert claims_data["totalClaims"] == 3
        assert claims_data["totalClaimedAmountInrLakhs"] == 26.8
        assert claims_data["totalAssessedExposureInrLakhs"] == 11.55

        # Check CLM-2024-019 linked to FND-104
        clm19 = next(c for c in claims_data["claims"] if c["id"] == "CLM-2024-019")
        assert clm19["contractorName"] == "HCC-NCC JV"
        assert "FIDIC" in clm19["clauseReference"]
        assert clm19["claimedAmountInrLakhs"] == 12.4
        assert clm19["assessedExposureInrLakhs"] == 4.85
        assert clm19["status"] == "UNDER_TECHNICAL_EVALUATION"
        assert clm19["linkedFindingId"] == "FND-104"
        assert clm19["provenance"] == "SYNTHETIC_DEMO"

        # All claims must be marked SYNTHETIC_DEMO
        for claim in claims_data["claims"]:
            assert claim["provenance"] == "SYNTHETIC_DEMO"

        # ── 2. Unknown project IDs return 404 ──
        res_unknown_mat = await ac.get("/api/v4/projects/PRJ-DOES-NOT-EXIST/materials/reconciliation")
        assert res_unknown_mat.status_code == 404
        res_unknown_clm = await ac.get("/api/v4/projects/PRJ-DOES-NOT-EXIST/claims")
        assert res_unknown_clm.status_code == 404

        # ── 3. Empty results for an existing project with no records ──
        async with async_session() as s:
            empty_prj = Project(
                id="PRJ-EMPTY-RECORD",
                name="Empty Test Project",
                package_id="PKG-EMPTY",
                chainage_start_meters=0,
                chainage_end_meters=1000,
                is_demo_dataset=True,
                data_sync_timestamp="2024-11-14T06:30:00Z",
            )
            s.add(empty_prj)
            await s.commit()

        res_empty_mat = await ac.get("/api/v4/projects/PRJ-EMPTY-RECORD/materials/reconciliation")
        assert res_empty_mat.status_code == 200
        assert res_empty_mat.json()["totalItems"] == 0
        assert res_empty_mat.json()["items"] == []

        res_empty_clm = await ac.get("/api/v4/projects/PRJ-EMPTY-RECORD/claims")
        assert res_empty_clm.status_code == 200
        assert res_empty_clm.json()["totalClaims"] == 0
        assert res_empty_clm.json()["claims"] == []

        # ── 4. Project isolation (no data leakage across projects) ──
        async with async_session() as s:
            prj_b = Project(
                id="PRJ-CORRIDOR-B",
                name="Corridor B Package",
                package_id="PKG-B",
                chainage_start_meters=5000,
                chainage_end_meters=10000,
                is_demo_dataset=True,
                data_sync_timestamp="2024-11-14T06:30:00Z",
            )
            s.add(prj_b)
            # Add 1 distinct material and 1 distinct claim for Corridor B
            mat_b = MaterialReconciliation(
                project_id="PRJ-CORRIDOR-B",
                material_code="FLYASH-GR1",
                material_name="Pulverized Fuel Ash (Grade 1)",
                spec_code="IS:3812 Part 1",
                unit="MT",
                theoretical_quantity=500.0,
                actual_issued_quantity=490.0,
                variance_quantity=-10.0,
                variance_percent=-2.0,
                contractual_band="Within ±5.0% band",
                status="COMPLIANT",
                provenance="SYNTHETIC_DEMO",
            )
            clm_b = ContractorClaim(
                id="CLM-PKGB-001",
                project_id="PRJ-CORRIDOR-B",
                contractor_name="L&T Construction",
                clause_reference="EPC Clause 10.1",
                claimed_amount_inr=300000.0,
                claimed_amount_inr_lakhs=3.0,
                assessed_exposure_inr=150000.0,
                assessed_exposure_inr_lakhs=1.5,
                status="UNDER_TECHNICAL_EVALUATION",
                linked_finding_id=None,
                description="Borehole utility delay claim.",
                provenance="SYNTHETIC_DEMO",
            )
            s.add_all([mat_b, clm_b])
            await s.commit()

        # Query PRJ-CORRIDOR-B
        res_b_mat = await ac.get("/api/v4/projects/PRJ-CORRIDOR-B/materials/reconciliation")
        assert res_b_mat.status_code == 200
        b_mat_items = res_b_mat.json()["items"]
        assert len(b_mat_items) == 1
        assert b_mat_items[0]["materialCode"] == "FLYASH-GR1"
        # None of NH-48 materials should appear in Corridor B
        assert not any(m["materialCode"] == "TMT-FE550D" for m in b_mat_items)

        res_b_clm = await ac.get("/api/v4/projects/PRJ-CORRIDOR-B/claims")
        assert res_b_clm.status_code == 200
        b_clm_items = res_b_clm.json()["claims"]
        assert len(b_clm_items) == 1
        assert b_clm_items[0]["id"] == "CLM-PKGB-001"
        # None of NH-48 claims should appear in Corridor B
        assert not any(c["id"] == "CLM-2024-019" for c in b_clm_items)

        # ── 5. Variance calculations and zero-theoretical-quantity handling ──
        # Standard positive variance
        v_qty, v_pct = calculate_material_variance(100.0, 105.0)
        assert v_qty == 5.0
        assert v_pct == 5.0

        # Standard negative variance
        v_qty, v_pct = calculate_material_variance(200.0, 180.0)
        assert v_qty == -20.0
        assert v_pct == -10.0

        # Zero theoretical quantity (safeguard against division by zero)
        v_qty, v_pct = calculate_material_variance(0.0, 50.0)
        assert v_qty == 50.0
        assert v_pct == 0.0

        # None theoretical quantity
        v_qty, v_pct = calculate_material_variance(None, 50.0)
        assert v_qty == 50.0
        assert v_pct == 0.0

        # ── 6. Repeatable / idempotent seeding ──
        async with async_session() as s:
            # Call seed_planning_demo_records again on NH-48
            await seed_planning_demo_records(s, "PRJ-NH48-PKG3")
            await s.commit()

            # Verify count has not multiplied
            res_mat_check = await s.execute(
                select(MaterialReconciliation).where(MaterialReconciliation.project_id == "PRJ-NH48-PKG3")
            )
            assert len(res_mat_check.scalars().all()) == 5

            res_clm_check = await s.execute(
                select(ContractorClaim).where(ContractorClaim.project_id == "PRJ-NH48-PKG3")
            )
            assert len(res_clm_check.scalars().all()) == 3


@pytest.mark.asyncio
async def test_11_automatic_evidence_graph_generation():
    """
    Test Automatic Evidence Graph Generation for newly created findings:
    1. Automatic graph creation on finding upload (evidence-absent baseline).
    2. Strict provenance guardrail: FINDING + RISK created, NEVER fabricate source EVIDENCE node.
    3. Graph topology retrieval by graph_id and by finding_id.
    4. Evidence-present graph update: attaching real source evidence creates EVIDENCE node & EVIDENCES edge.
    5. Idempotency: repeated generation calls produce zero duplicate nodes or edges.
    6. Project isolation: cross-project queries reject mismatched graphs.
    7. Regression protection: GR-FND104 5-tier topology remains pristine.
    """
    from services.graph_generator import generate_or_get_evidence_graph

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # ── 1. Create Finding via Upload & verify Automatic Graph Generation ──
        jpeg_bytes = generate_synthetic_image("JPEG", line_thickness=3)
        res_upload = await ac.post(
            "/api/v4/findings/upload",
            files={"file": ("auto_graph_test.jpg", jpeg_bytes, "image/jpeg")},
            data={"structureElement": "Pier 26 Crossbeam Shear Zone", "gsdMmPerPx": "0.65"},
        )
        assert res_upload.status_code == 200
        upload_data = res_upload.json()
        fnd_id = upload_data["findingId"]
        graph_id = upload_data.get("graphId")

        assert graph_id is not None
        assert graph_id.startswith("GR-")

        # Verify telemetry returns the associated graphId
        res_telemetry = await ac.get(f"/api/v4/findings/{fnd_id}/telemetry")
        assert res_telemetry.status_code == 200
        telemetry_data = res_telemetry.json()
        assert telemetry_data["graphId"] == graph_id

        # ── 2. Evidence-Absent Graph Structure ──
        res_graph = await ac.get(f"/api/v4/graphs/{graph_id}")
        assert res_graph.status_code == 200
        graph_data = res_graph.json()
        assert graph_data["graphId"] == graph_id

        nodes = graph_data["nodes"]
        edges = graph_data["connections"]

        # Exactly 2 nodes: FINDING and RISK. NO FABRICATED EVIDENCE NODE.
        assert len(nodes) == 2, f"Expected exactly 2 nodes for evidence-absent graph, got {len(nodes)}"
        node_types = {n["nodeType"] for n in nodes}
        assert "FINDING" in node_types
        assert "RISK" in node_types
        assert "EVIDENCE" not in node_types, "Fabricated EVIDENCE node found without real source documents!"

        finding_node = next(n for n in nodes if n["nodeType"] == "FINDING")
        risk_node = next(n for n in nodes if n["nodeType"] == "RISK")

        assert finding_node["tier"] == 2
        assert finding_node["findingId"] == fnd_id
        assert finding_node["provenance"] in ["HUMAN_REVIEWED", "AI_INFERRED"]

        # Provenance rule: Inferred risk must NOT be marked SOURCE_VERIFIED
        assert risk_node["tier"] == 3
        assert risk_node["provenance"] in ["AI_INFERRED", "CALCULATED"]
        assert risk_node["provenance"] != "SOURCE_VERIFIED", "Inferred risk cannot be marked SOURCE_VERIFIED"

        # Exactly 1 edge: TRIGGERS from FINDING to RISK
        assert len(edges) == 1
        edge = edges[0]
        assert edge["sourceNodeId"] == finding_node["id"]
        assert edge["targetNodeId"] == risk_node["id"]
        assert edge["relationshipType"] == "TRIGGERS"
        assert edge["provenance"] == "AI_INFERRED"

        # ── 3. Graph Retrieval by Finding ID Route ──
        res_by_fnd = await ac.get(f"/api/v4/graphs/by-finding/{fnd_id}")
        assert res_by_fnd.status_code == 200
        assert res_by_fnd.json()["graphId"] == graph_id

        # ── 4. Evidence-Present Case: Link Real Ingested Document ──
        doc_content = b"Pier 26 Crossbeam Field Report: Core compressive strength tested at 34.2 MPa. Ultrasonic pulse velocity measured 3920 m/s."
        up_doc = await ac.post(
            "/api/v4/projects/PRJ-NH48-PKG3/documents/upload",
            files={"file": ("pier26_field_report.txt", io.BytesIO(doc_content), "text/plain")},
        )
        assert up_doc.status_code == 201
        doc_id = up_doc.json()["documentId"]

        # Resolve passage ID
        async with async_session() as s:
            pas_res = await s.execute(select(DocumentPassage).where(DocumentPassage.document_id == doc_id))
            passage = pas_res.scalar_one()
            passage_id = passage.id

        # Attach real evidence link to finding
        link_payload = {
            "documentId": doc_id,
            "passageId": passage_id,
            "citationText": "Core compressive strength tested at 34.2 MPa",
            "relevanceNote": "Direct structural core sampling",
            "provenance": "SOURCE_VERIFIED",
            "confidence": 0.98,
        }
        res_link = await ac.post(f"/api/v4/findings/{fnd_id}/evidence-links", json=link_payload)
        assert res_link.status_code == 201

        # Fetch graph again — EVIDENCE node must now be dynamically linked
        res_g_updated = await ac.get(f"/api/v4/graphs/{graph_id}")
        assert res_g_updated.status_code == 200
        updated_data = res_g_updated.json()
        u_nodes = updated_data["nodes"]
        u_edges = updated_data["connections"]

        assert len(u_nodes) == 3, f"Expected 3 nodes (EVIDENCE, FINDING, RISK), got {len(u_nodes)}"
        evidence_node = next(n for n in u_nodes if n["nodeType"] == "EVIDENCE")
        assert evidence_node["tier"] == 1
        assert evidence_node["provenance"] == "SOURCE_VERIFIED"
        assert evidence_node["documentId"] == doc_id
        assert evidence_node["passageId"] == passage_id

        # Connections: 2 edges (EVIDENCES + TRIGGERS)
        assert len(u_edges) == 2
        ev_edge = next(e for e in u_edges if e["relationshipType"] == "EVIDENCES")
        assert ev_edge["sourceNodeId"] == evidence_node["id"]
        assert ev_edge["targetNodeId"] == finding_node["id"]
        assert ev_edge["provenance"] == "SOURCE_VERIFIED"

        # ── 5. Idempotency: Duplicate calls produce zero duplicate nodes/edges ──
        async with async_session() as s:
            fnd_record = (await s.execute(select(Finding).where(Finding.id == fnd_id))).scalar_one()
            # Call generator again
            regen_graph_id = await generate_or_get_evidence_graph(fnd_record, s)
            await s.commit()
            assert regen_graph_id == graph_id

            # Verify node and edge counts in DB remain unchanged
            db_nodes = (await s.execute(select(GraphNode).where(GraphNode.graph_id == graph_id))).scalars().all()
            db_edges = (await s.execute(select(GraphEdge).where(GraphEdge.graph_id == graph_id))).scalars().all()
            assert len(db_nodes) == 3
            assert len(db_edges) == 2

        # ── 6. Project Isolation Guardrails ──
        # Graph query with mismatched project must return 404
        res_mismatch = await ac.get(f"/api/v4/graphs/{graph_id}?project_id=PRJ-OTHER-NONEXISTENT")
        assert res_mismatch.status_code == 404

        # ── 7. Regression Protection for Seeded Baseline GR-FND104 ──
        res_104 = await ac.get("/api/v4/graphs/GR-FND104")
        assert res_104.status_code == 200
        g104 = res_104.json()

        assert len(g104["nodes"]) == 5, f"GR-FND104 must maintain 5 tiers, got {len(g104['nodes'])}"
        assert len(g104["connections"]) == 4, f"GR-FND104 must maintain 4 connections, got {len(g104['connections'])}"

        node_map = {n["id"]: n for n in g104["nodes"]}
        assert set(node_map.keys()) == {"N-SRC-001", "N-AI-001", "N-RSK-042", "N-CPM-001", "N-MIT-001"}

        assert node_map["N-SRC-001"]["tier"] == 1
        assert node_map["N-SRC-001"]["provenance"] == "SOURCE_VERIFIED"
        assert node_map["N-SRC-001"]["nodeType"] == "EVIDENCE"

        assert node_map["N-AI-001"]["tier"] == 2
        assert node_map["N-AI-001"]["provenance"] == "AI_INFERRED"
        assert node_map["N-AI-001"]["nodeType"] == "FINDING"

        assert node_map["N-RSK-042"]["tier"] == 3
        assert node_map["N-RSK-042"]["provenance"] == "CALCULATED_RISK"
        assert node_map["N-RSK-042"]["nodeType"] == "RISK"

        assert node_map["N-CPM-001"]["tier"] == 4
        assert node_map["N-CPM-001"]["provenance"] == "CALCULATED_RISK"
        assert node_map["N-CPM-001"]["nodeType"] in ["IMPACT", "CPM_IMPACT"]

        assert node_map["N-MIT-001"]["tier"] == 5
        assert node_map["N-MIT-001"]["provenance"] == "PROPOSED_ACTION"
        assert node_map["N-MIT-001"]["nodeType"] in ["ACTION", "MITIGATION"]
