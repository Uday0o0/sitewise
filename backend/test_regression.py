"""
SITEWISE V4.2 — Automated Regression Test Suite
Covers core workflows, API contracts, deterministic simulator evaluation,
validation guardrails, and SQLite persistence.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from database import engine, async_session, Base
from seed import seed
from models import Finding, SimulatorCommit
from sqlalchemy import select


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


