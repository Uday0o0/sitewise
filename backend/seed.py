import os
import asyncio
from database import engine, async_session, Base
from models import (
    Project, Finding, CpmMilestone, EvidenceAsset,
    UnconfiguredSensor, GraphNode, GraphEdge, GraphInspectorData,
    Document, DocumentPassage, FindingEvidenceLink,
)


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Ensure document uploads directory and seed files exist
    doc_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads", "documents"))
    os.makedirs(doc_dir, exist_ok=True)

    irc_path = os.path.join(doc_dir, "DOC-57F675F71F_IRC_112_Crack_Spec.txt")
    if not os.path.isfile(irc_path):
        with open(irc_path, "w", encoding="utf-8") as f:
            f.write("IRC:112-2020 Clause 12.3: Limit State of Cracking. For reinforced concrete members in severe environmental exposure, the design crack width limit shall not exceed 0.20 mm under quasi-permanent load combinations.\n")

    qa_path = os.path.join(doc_dir, "DOC-5442BA12E9_pier18_qa_report.txt")
    if not os.path.isfile(qa_path):
        with open(qa_path, "w", encoding="utf-8") as f:
            f.write("Pier 18 Cantilever QA Log: Ultrasonic pulse velocity measured 3850 m/s across transverse shear plane. Verified compliant with IRC:112 Clause 12.3 crack aperture limit 0.20mm.\n")

    async with async_session() as s:
        # ── Project ────────────────────────────────────────────
        project = Project(
            id="PRJ-NH48-PKG3",
            name="NH-48 Elevated Corridor - Package 3",
            package_id="PKG-3",
            chainage_start_meters=14200,
            chainage_end_meters=18600,
            is_demo_dataset=True,
            data_sync_timestamp="2024-11-14T06:30:00Z",
        )
        s.add(project)

        # ── Real Ingested Documents ────────────────────────────
        docs = [
            Document(
                id="DOC-57F675F71F",
                project_id="PRJ-NH48-PKG3",
                title="IRC:112-2020 Bridge Design Code (Clause 12.3)",
                original_filename="IRC_112_Crack_Spec.txt",
                file_type=".txt",
                mime_type="text/plain",
                file_size_bytes=211,
                sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                storage_key="DOC-57F675F71F_IRC_112_Crack_Spec.txt",
                processing_status="READY",
                word_count=28,
                page_count=1,
                uploaded_at="2024-11-12T08:00:00Z",
                processed_at="2024-11-12T08:01:00Z",
            ),
            Document(
                id="DOC-5442BA12E9",
                project_id="PRJ-NH48-PKG3",
                title="Pier 18 QA Inspection & Non-Destructive Test Report",
                original_filename="pier18_qa_report.txt",
                file_type=".txt",
                mime_type="text/plain",
                file_size_bytes=174,
                sha256_hash="a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
                storage_key="DOC-5442BA12E9_pier18_qa_report.txt",
                processing_status="READY",
                word_count=23,
                page_count=1,
                uploaded_at="2024-11-12T08:30:00Z",
                processed_at="2024-11-12T08:31:00Z",
            ),
        ]
        s.add_all(docs)

        passages = [
            DocumentPassage(
                id=1,
                document_id="DOC-57F675F71F",
                passage_index=0,
                page_number=1,
                word_count=28,
                content="IRC:112-2020 Clause 12.3: Limit State of Cracking. For reinforced concrete members in severe environmental exposure, the design crack width limit shall not exceed 0.20 mm under quasi-permanent load combinations.",
            ),
            DocumentPassage(
                id=2,
                document_id="DOC-5442BA12E9",
                passage_index=0,
                page_number=1,
                word_count=23,
                content="Pier 18 Cantilever QA Log: Ultrasonic pulse velocity measured 3850 m/s across transverse shear plane. Verified compliant with IRC:112 Clause 12.3 crack aperture limit 0.20mm.",
            ),
        ]
        s.add_all(passages)

        evidence_links = [
            FindingEvidenceLink(
                id="LNK-FND104-IRC112",
                project_id="PRJ-NH48-PKG3",
                finding_id="FND-104",
                document_id="DOC-57F675F71F",
                passage_id=1,
                page_number=1,
                citation_text="IRC:112-2020 Clause 12.3: Limit State of Cracking. For reinforced concrete members in severe environmental exposure, the design crack width limit shall not exceed 0.20 mm under quasi-permanent load combinations.",
                relevance_note="Governing code crack width limit (0.20mm) for severe environmental exposure on Pier 18 cantilever face.",
                provenance="SOURCE_VERIFIED",
                confidence=0.98,
                created_at="2024-11-12T08:45:00Z",
            ),
            FindingEvidenceLink(
                id="LNK-FND104-QA18",
                project_id="PRJ-NH48-PKG3",
                finding_id="FND-104",
                document_id="DOC-5442BA12E9",
                passage_id=2,
                page_number=1,
                citation_text="Pier 18 Cantilever QA Log: Ultrasonic pulse velocity measured 3850 m/s across transverse shear plane.",
                relevance_note="In-situ non-destructive UPV velocity profiling across transverse crack defect zone.",
                provenance="SOURCE_VERIFIED",
                confidence=0.95,
                created_at="2024-11-12T08:50:00Z",
            ),
        ]
        s.add_all(evidence_links)

        # ── Findings ──────────────────────────────────────────
        findings = [
            Finding(
                id="FND-104",
                project_id="PRJ-NH48-PKG3",
                title="Pier Cap 18 Crack — Transverse Propagation",
                location_desc="Pier Cap 18 Cantilever Downstream Face",
                chainage_formatted="Ch. 14+320",
                thumbnail_url="/api/v4/static/fnd104_thumb.jpg",
                provenance="AI_INFERRED",
                direct_impact="Structural capacity reduction — shear transfer zone compromised",
                cascade_financial_exposure_inr="₹20.30 Lakhs",
                critical_path_slip_days=4,
                suggested_action="CFRP wrap + pressure injection per IRC:SP:40",
                structure_element="Pier Cap 18 Cantilever Downstream Face",
                flight_id="DJI Matrice 300 RTK",
                lens="45mm F2.8",
                gsd_mm_per_px=0.8,
                captured_at="2024-11-12T08:45:00Z",
                coord_x=73.8567,
                coord_y=18.5204,
                coord_z=12.4,
                image_url="/api/v4/static/fnd104_ortho.jpg",
                calibrated_aperture_mm=0.35,
                aperture_tolerance_margin_mm=0.05,
                permissible_threshold_mm=0.20,
                governing_code="IRC:112 Clause 12.3",
                exceedance_percent=75,
                linear_trace_length_mm=420,
                shear_vector_angle_degrees=42,
                inferred_depth_mm=35,
                inferred_root_mechanism="Early thermal shrinkage with secondary flexural propagation under cantilever dead load redistribution during staged post-tensioning",
                ndt_corroboration=[
                    {"protocolName": "Rebound Hammer (IS:13311)", "status": "PASS", "details": "Surface hardness index 38 — within acceptable range"},
                    {"protocolName": "UPV Cross-Hole (IS:13311 Part 1)", "status": "SCHEDULED", "details": "Scheduled for velocity profiling", "scheduledTime": "2024-11-15T10:00:00Z"},
                    {"protocolName": "Core Extraction (IS:516)", "status": "AWAITING_DISPOSITION", "details": "Awaiting Resident Engineer approval for core sampling location"},
                ],
                disposition_status="AWAITING_REVIEW",
                pki_certificate_valid=False,
                category="structural",
            ),
            Finding(
                id="FND-105",
                project_id="PRJ-NH48-PKG3",
                title="Bearing Pad Misalignment — Pier 19",
                location_desc="Pier 19 Bearing Shelf",
                chainage_formatted="Ch. 14+680",
                thumbnail_url="/api/v4/static/fnd105_thumb.jpg",
                provenance="SOURCE_VERIFIED",
                direct_impact="Lateral load path eccentric by 15mm",
                cascade_financial_exposure_inr="₹6.20 Lakhs",
                critical_path_slip_days=2,
                suggested_action="Shimming and realignment before girder launch",
                category="structural",
                disposition_status="AWAITING_REVIEW",
            ),
            Finding(
                id="FND-106",
                project_id="PRJ-NH48-PKG3",
                title="Missing Fall Arrest Anchorage — Span 17",
                location_desc="Span 17 Deck Edge",
                chainage_formatted="Ch. 14+100",
                thumbnail_url="/api/v4/static/fnd106_thumb.jpg",
                provenance="SOURCE_VERIFIED",
                direct_impact="OSHA Category IV fall hazard exposure",
                cascade_financial_exposure_inr="₹1.10 Lakhs",
                critical_path_slip_days=0,
                suggested_action="Install temporary cable guardrail system",
                category="safety",
            ),
            Finding(
                id="FND-107",
                project_id="PRJ-NH48-PKG3",
                title="Scaffold Platform Gap > 25mm — Pier 20",
                location_desc="Pier 20 Formwork Level",
                chainage_formatted="Ch. 15+040",
                thumbnail_url="/api/v4/static/fnd107_thumb.jpg",
                provenance="AI_INFERRED",
                direct_impact="Personnel fall-through risk per IS:3696",
                cascade_financial_exposure_inr="₹0.45 Lakhs",
                critical_path_slip_days=0,
                suggested_action="Close gap with toe-board and secure planking",
                category="safety",
            ),
            Finding(
                id="FND-108",
                project_id="PRJ-NH48-PKG3",
                title="Crane Outrigger on Uncompacted Fill — Pier 21",
                location_desc="Pier 21 Crane Pad",
                chainage_formatted="Ch. 15+400",
                thumbnail_url="/api/v4/static/fnd108_thumb.jpg",
                provenance="SOURCE_VERIFIED",
                direct_impact="Ground bearing capacity below crane chart requirement",
                cascade_financial_exposure_inr="₹2.80 Lakhs",
                critical_path_slip_days=1,
                suggested_action="Relocate outrigger to compacted pad or install steel mats",
                category="safety",
            ),
            Finding(
                id="FND-109",
                project_id="PRJ-NH48-PKG3",
                title="Concrete Cube Strength Below 28-Day Target — Batch 2024-B42",
                location_desc="Batch Plant Lab",
                chainage_formatted="Ch. 14+320",
                thumbnail_url="/api/v4/static/fnd109_thumb.jpg",
                provenance="SOURCE_VERIFIED",
                direct_impact="M45 cube achieved 38.2 MPa vs 45 MPa target",
                cascade_financial_exposure_inr="₹3.50 Lakhs",
                critical_path_slip_days=0,
                suggested_action="Hold pour, request supplementary core tests",
                category="qa_hold",
            ),
            Finding(
                id="FND-110",
                project_id="PRJ-NH48-PKG3",
                title="Rebar Mill Certificate Mismatch — Heat #7721",
                location_desc="Fabrication Yard",
                chainage_formatted="Ch. 14+200",
                thumbnail_url="/api/v4/static/fnd110_thumb.jpg",
                provenance="AI_INFERRED",
                direct_impact="Mill TC Fe500D certificate references different heat number",
                cascade_financial_exposure_inr="₹1.20 Lakhs",
                critical_path_slip_days=0,
                suggested_action="Cross-reference with supplier dispatch log; re-test if unresolved",
                category="qa_hold",
            ),
        ]
        s.add_all(findings)

        # ── CPM Milestones ────────────────────────────────────
        milestones = [
            CpmMilestone(project_id="PRJ-NH48-PKG3", wbs_code="WBS-3.2.1", activity_desc="Pier 18 Defect Resolution", baseline_date="2024-11-20", projected_date="2024-11-28", slack_drift_days=-8, status="HOLD_RETEST"),
            CpmMilestone(project_id="PRJ-NH48-PKG3", wbs_code="WBS-3.3.1", activity_desc="Span 18-19 Precast Segment Launch", baseline_date="2024-12-01", projected_date="2024-12-05", slack_drift_days=-4, status="BLOCKED"),
            CpmMilestone(project_id="PRJ-NH48-PKG3", wbs_code="WBS-3.4.1", activity_desc="Span 19-20 Girder Erection", baseline_date="2024-12-15", projected_date="2024-12-18", slack_drift_days=-3, status="PENDING_SPAN"),
            CpmMilestone(project_id="PRJ-NH48-PKG3", wbs_code="WBS-3.5.1", activity_desc="Pier 20-21 Pile Cap Pour", baseline_date="2024-12-22", projected_date="2024-12-22", slack_drift_days=0, status="ON_SCHEDULE"),
        ]
        s.add_all(milestones)

        # ── Evidence Assets ───────────────────────────────────
        assets = [
            EvidenceAsset(id="AST-001", project_id="PRJ-NH48-PKG3", title="Pier 18 Orthomosaic Survey — Flight 14-Nov", data_type="GEOTIFF", ingest_time_ago="2 hours ago", provenance_status="SOURCE_VERIFIED", linked_finding_id="FND-104"),
            EvidenceAsset(id="AST-002", project_id="PRJ-NH48-PKG3", title="Mill Test Certificate — TMT Fe500D Heat #7721", data_type="PDF_CERT", ingest_time_ago="5 hours ago", provenance_status="QA_HOLD", linked_finding_id="FND-110"),
            EvidenceAsset(id="AST-003", project_id="PRJ-NH48-PKG3", title="Rebound Hammer Test Log — Pier 18", data_type="JSON_LOG", ingest_time_ago="1 day ago", provenance_status="SOURCE_VERIFIED", linked_finding_id="FND-104"),
            EvidenceAsset(id="AST-004", project_id="PRJ-NH48-PKG3", title="Batch Plant Slump & Temperature — Nov Week 2", data_type="CSV_TELEMETRY", ingest_time_ago="3 days ago", provenance_status="CALCULATED"),
        ]
        s.add_all(assets)

        # ── Unconfigured Sensors ──────────────────────────────
        sensors = [
            UnconfiguredSensor(project_id="PRJ-NH48-PKG3", sensor_type="Biaxial Inclinometer", location="Pier 18 Pile Cap", status="NO_GATEWAY_LINKED", config_action_url="/settings/sensors/inclinometer-p18"),
            UnconfiguredSensor(project_id="PRJ-NH48-PKG3", sensor_type="Strain Gauge Cluster", location="Span 18-19 Soffit", status="NO_GATEWAY_LINKED", config_action_url="/settings/sensors/strain-s18"),
        ]
        s.add_all(sensors)

        # ── Evidence Graph: Nodes ─────────────────────────────
        graph_nodes = [
            GraphNode(
                id="N-SRC-001",
                graph_id="GR-FND104",
                project_id="PRJ-NH48-PKG3",
                node_type="EVIDENCE",
                tier=1,
                provenance="SOURCE_VERIFIED",
                title="Pier 18 Orthomosaic & QA Log",
                primary_subtitle="DJI M300 RTK • GSD 0.8mm/px",
                metrics={"captureDate": "12 Nov 2024", "gsd": "0.8mm/px", "upvReading": "3,850 m/s"},
                badge_text="SOURCE VERIFIED • GEOTAGGED",
                code_reference="Flight Log #FL-2024-1112",
                document_id="DOC-5442BA12E9",
                passage_id=2,
                page_number=1,
                citation_text="Pier 18 Cantilever QA Log: Ultrasonic pulse velocity measured 3850 m/s across transverse shear plane.",
            ),
            GraphNode(
                id="N-AI-001",
                graph_id="GR-FND104",
                project_id="PRJ-NH48-PKG3",
                node_type="FINDING",
                finding_id="FND-104",
                tier=2,
                provenance="AI_INFERRED",
                title="FND-104: Transverse Crack Detection",
                primary_subtitle="Aperture 0.35mm ±0.05mm • 42° vector",
                metrics={"aperture": "0.35mm", "confidence": "92%", "trace": "420mm"},
                badge_text="AI INFERRED • ESTIMATED APERTURE",
                code_reference="IRC:112 Cl.12.3",
                severity="critical",
                document_id="DOC-57F675F71F",
                passage_id=1,
                page_number=1,
                citation_text="IRC:112-2020 Clause 12.3: Limit State of Cracking. For reinforced concrete members in severe environmental exposure, the design crack width limit shall not exceed 0.20 mm under quasi-permanent load combinations.",
            ),
            GraphNode(id="N-RSK-042", graph_id="GR-FND104", project_id="PRJ-NH48-PKG3", node_type="RISK", tier=3, provenance="CALCULATED_RISK", title="RSK-042: Shear Capacity Deficit", primary_subtitle="75% exceedance of permissible limit", metrics={"exceedance": "75%", "exposure": "₹20.3L"}, badge_text="CALCULATED PROJECT RISK", code_reference="IS:456 Cl.40.1", severity="critical"),
            GraphNode(id="N-CPM-001", graph_id="GR-FND104", project_id="PRJ-NH48-PKG3", node_type="IMPACT", tier=4, provenance="CALCULATED_RISK", title="CPM Impact: -4 Day Slip", primary_subtitle="Span 18-19 precast launch blocked", metrics={"slipDays": "-4", "wbs": "WBS-3.3.1"}, badge_text="CRITICAL PATH DRIFT", severity="high"),
            GraphNode(id="N-MIT-001", graph_id="GR-FND104", project_id="PRJ-NH48-PKG3", node_type="ACTION", tier=5, provenance="PROPOSED_ACTION", title="CFRP Wrap + Pressure Injection", primary_subtitle="IRC:SP:40 compliant remediation", metrics={"recoveryDays": "+15", "cost": "₹5.5L", "shearRetention": "94.2%"}, badge_text="PROPOSED MITIGATION", code_reference="IRC:SP:40"),
        ]
        s.add_all(graph_nodes)

        # ── Evidence Graph: Edges ─────────────────────────────
        graph_edges = [
            GraphEdge(graph_id="GR-FND104", project_id="PRJ-NH48-PKG3", source_node_id="N-SRC-001", target_node_id="N-AI-001", connector_label="Extracted via Optical CV Pipeline", is_critical_path=True, relationship_type="EVIDENCES", provenance="SYNTHETIC_DEMO"),
            GraphEdge(graph_id="GR-FND104", project_id="PRJ-NH48-PKG3", source_node_id="N-AI-001", target_node_id="N-RSK-042", connector_label="Triggers Contractual Non-Conformance", is_critical_path=True, relationship_type="TRIGGERS", provenance="SYNTHETIC_DEMO"),
            GraphEdge(graph_id="GR-FND104", project_id="PRJ-NH48-PKG3", source_node_id="N-RSK-042", target_node_id="N-CPM-001", connector_label="Delays Critical Path Milestone", is_critical_path=True, relationship_type="CAUSES_IMPACT", provenance="SYNTHETIC_DEMO"),
            GraphEdge(graph_id="GR-FND104", project_id="PRJ-NH48-PKG3", source_node_id="N-RSK-042", target_node_id="N-MIT-001", connector_label="Prescriptive Remediation Pathway", is_critical_path=False, relationship_type="MITIGATES", provenance="SYNTHETIC_DEMO"),
        ]
        s.add_all(graph_edges)

        # ── Graph Inspector Data ──────────────────────────────
        inspector_data = [
            GraphInspectorData(
                node_id="N-AI-001",
                graph_id="GR-FND104",
                title="FND-104: Transverse Crack Detection",
                provenance_trail=[
                    {"documentId": "DOC-57F675F71F", "title": "IRC:112-2020 Bridge Design Code (Clause 12.3)", "spec": "Clause 12.3 Permissible Limit 0.20mm", "downloadUrl": "/api/v4/projects/PRJ-NH48-PKG3/documents/DOC-57F675F71F/file"},
                    {"documentId": "DOC-5442BA12E9", "title": "Pier 18 QA Inspection & NDT Report", "spec": "Transverse Shear Plane UPV 3,850 m/s", "downloadUrl": "/api/v4/projects/PRJ-NH48-PKG3/documents/DOC-5442BA12E9/file"},
                    {"documentId": "DOC-ORTHO", "title": "Pier 18 Calibrated Orthomosaic", "spec": "GSD 0.8mm/px GeoTIFF (Synthetic)", "downloadUrl": "#"},
                ],
                governing_code_limits=[
                    {"code": "IRC:112 Cl.12.3", "limit": "0.20mm", "measured": "0.35mm", "status": "EXCEEDED"},
                    {"code": "IS:456 Cl.35.3.2", "limit": "0.30mm (severe)", "measured": "0.35mm", "status": "EXCEEDED"},
                    {"code": "IS:456 Cl.40.1", "limit": "τ_c = 0.62 MPa", "measured": "Est. 0.48 MPa", "status": "CRITICAL_ZONE"},
                ],
            ),
            GraphInspectorData(
                node_id="N-RSK-042",
                graph_id="GR-FND104",
                title="RSK-042: Shear Capacity Deficit",
                provenance_trail=[
                    {"documentId": "DOC-57F675F71F", "title": "IRC:112-2020 Bridge Design Code", "spec": "Clause 12.3 Crack Aperture Threshold", "downloadUrl": "/api/v4/projects/PRJ-NH48-PKG3/documents/DOC-57F675F71F/file"},
                ],
                governing_code_limits=[
                    {"code": "IS:456 Cl.40.1", "limit": "τ_c = 0.62 MPa", "measured": "Est. deficit 75%", "status": "EXCEEDED"},
                ],
            ),
        ]
        s.add_all(inspector_data)

        await s.commit()

    # Sync retrieval index with seeded documents
    try:
        from services import retrieval
        idx = retrieval.get_index()
        idx.clear()
        async with async_session() as s_sync:
            await idx.sync_from_db(s_sync, project_id="PRJ-NH48-PKG3")
    except Exception as exc:
        print(f"[WARN] Failed to sync retrieval index during seed: {exc}")

    print("[OK] Database seeded with synthetic demo data and verified project documents")


if __name__ == "__main__":
    asyncio.run(seed())
