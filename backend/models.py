"""SQLAlchemy ORM models for SITEWISE V4.2."""

# pyrefly: ignore[missing-import]
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    package_id = Column(String, nullable=False)
    chainage_start_meters = Column(Integer, nullable=False)
    chainage_end_meters = Column(Integer, nullable=False)
    is_demo_dataset = Column(Boolean, default=True)
    data_sync_timestamp = Column(String, nullable=False)

    findings = relationship("Finding", back_populates="project")
    milestones = relationship("CpmMilestone", back_populates="project")
    evidence_assets = relationship("EvidenceAsset", back_populates="project")
    sensors = relationship("UnconfiguredSensor", back_populates="project")
    documents = relationship("Document", back_populates="project")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    location_desc = Column(String)
    chainage_formatted = Column(String)
    thumbnail_url = Column(String)
    provenance = Column(String, nullable=False)  # AI_INFERRED | SOURCE_VERIFIED
    direct_impact = Column(Text)
    cascade_financial_exposure_inr = Column(String)
    critical_path_slip_days = Column(Integer, default=0)
    suggested_action = Column(Text)

    # Inspection telemetry fields
    structure_element = Column(String)
    flight_id = Column(String)
    lens = Column(String)
    gsd_mm_per_px = Column(Float)
    captured_at = Column(String)
    coord_x = Column(Float)
    coord_y = Column(Float)
    coord_z = Column(Float)

    # Photogrammetric metrology
    image_url = Column(String)
    calibrated_aperture_mm = Column(Float)
    aperture_tolerance_margin_mm = Column(Float)
    permissible_threshold_mm = Column(Float)
    governing_code = Column(String)
    exceedance_percent = Column(Float)
    linear_trace_length_mm = Column(Float)
    shear_vector_angle_degrees = Column(Float)
    inferred_depth_mm = Column(Float)
    inferred_root_mechanism = Column(Text)

    # NDT data (stored as JSON array)
    ndt_corroboration = Column(JSON, default=list)

    # Disposition
    disposition_status = Column(String, default="AWAITING_REVIEW")
    dispositioned_by = Column(String)
    disposition_notes = Column(Text)
    pki_certificate_valid = Column(Boolean, default=False)

    # KPI summary fields
    category = Column(String)  # structural | safety | qa_hold

    # Real image upload references (Milestone 1)
    image_id = Column(String, nullable=True)
    analysis_id = Column(String, nullable=True)

    project = relationship("Project", back_populates="findings")
    evidence_links = relationship("FindingEvidenceLink", back_populates="finding", cascade="all, delete-orphan")


class CpmMilestone(Base):
    __tablename__ = "cpm_milestones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    wbs_code = Column(String, nullable=False)
    activity_desc = Column(String, nullable=False)
    baseline_date = Column(String, nullable=False)
    projected_date = Column(String, nullable=False)
    slack_drift_days = Column(Integer, default=0)
    status = Column(String, nullable=False)  # HOLD_RETEST | BLOCKED | PENDING_SPAN | ON_SCHEDULE

    project = relationship("Project", back_populates="milestones")


class EvidenceAsset(Base):
    __tablename__ = "evidence_assets"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    data_type = Column(String, nullable=False)
    ingest_time_ago = Column(String, nullable=False)
    provenance_status = Column(String, nullable=False)
    linked_finding_id = Column(String, nullable=True)

    project = relationship("Project", back_populates="evidence_assets")


class UnconfiguredSensor(Base):
    __tablename__ = "unconfigured_sensors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    sensor_type = Column(String, nullable=False)
    location = Column(String, nullable=False)
    status = Column(String, default="NO_GATEWAY_LINKED")
    config_action_url = Column(String)

    project = relationship("Project", back_populates="sensors")


class GraphNode(Base):
    __tablename__ = "graph_nodes"

    id = Column(String, primary_key=True)
    graph_id = Column(String, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, default="PRJ-NH48-PKG3")
    tier = Column(Integer, nullable=False)
    node_type = Column(String, nullable=False, default="FINDING")  # EVIDENCE | FINDING | RISK | IMPACT | ACTION
    provenance = Column(String, nullable=False)  # SOURCE_VERIFIED | HUMAN_REVIEWED | AI_INFERRED | SYNTHETIC_DEMO | CALCULATED
    title = Column(String, nullable=False)
    primary_subtitle = Column(String)
    metrics = Column(JSON, default=dict)
    badge_text = Column(String)
    code_reference = Column(String)
    severity = Column(String)

    # Document citation integration
    document_id = Column(String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    passage_id = Column(Integer, ForeignKey("document_passages.id", ondelete="SET NULL"), nullable=True)
    page_number = Column(Integer, nullable=True)
    citation_text = Column(Text, nullable=True)

    # Finding & Causal cascade
    finding_id = Column(String, ForeignKey("findings.id", ondelete="SET NULL"), nullable=True)
    rationale = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    metadata_json = Column(JSON, default=dict)


class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    graph_id = Column(String, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, default="PRJ-NH48-PKG3")
    source_node_id = Column(String, nullable=False)
    target_node_id = Column(String, nullable=False)
    connector_label = Column(String)
    is_critical_path = Column(Boolean, default=False)
    relationship_type = Column(String, nullable=False, default="TRIGGERS")  # SUPPORTS | EVIDENCES | TRIGGERS | CAUSES_IMPACT | MITIGATES
    provenance = Column(String, nullable=False, default="SYNTHETIC_DEMO")  # SOURCE_VERIFIED | HUMAN_REVIEWED | AI_INFERRED | SYNTHETIC_DEMO | CALCULATED
    rationale = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)


class FindingEvidenceLink(Base):
    """Explicit traceable link connecting an uploaded document passage to an inspection finding."""
    __tablename__ = "finding_evidence_links"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    finding_id = Column(String, ForeignKey("findings.id"), nullable=False)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    passage_id = Column(Integer, ForeignKey("document_passages.id", ondelete="CASCADE"), nullable=False)
    page_number = Column(Integer, nullable=True)
    citation_text = Column(Text, nullable=True)
    relevance_note = Column(Text, nullable=True)
    provenance = Column(String, nullable=False, default="HUMAN_REVIEWED")  # SOURCE_VERIFIED | HUMAN_REVIEWED | AI_INFERRED
    confidence = Column(Float, default=1.0)
    created_at = Column(String, nullable=False)

    finding = relationship("Finding", back_populates="evidence_links")
    document = relationship("Document")
    passage = relationship("DocumentPassage")


class GraphInspectorData(Base):
    __tablename__ = "graph_inspector_data"

    node_id = Column(String, primary_key=True)
    graph_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    provenance_trail = Column(JSON, default=list)
    governing_code_limits = Column(JSON, default=list)


class SimulatorCommit(Base):
    __tablename__ = "simulator_commits"

    id = Column(String, primary_key=True)
    finding_id = Column(String, nullable=False)
    scenario_type = Column(String, nullable=False)
    parameters = Column(JSON, nullable=False)
    result = Column(JSON, nullable=False)
    committed_at = Column(String, nullable=False)


class SimulatorScenario(Base):
    """Saved what-if comparison scenarios."""
    __tablename__ = "simulator_scenarios"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    finding_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    baseline_type = Column(String, nullable=False, default="FULL_RECAST_DEMOLITION")
    scenario_type = Column(String, nullable=False, default="CFRP_PRESSURE_INJECTION")
    parameters = Column(JSON, nullable=False)
    result = Column(JSON, nullable=False)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)



class UploadedImage(Base):
    __tablename__ = "uploaded_images"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    finding_id = Column(String, nullable=True)
    original_filename = Column(String, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=False)
    sha256_hash = Column(String, nullable=False)
    storage_key = Column(String, nullable=False)
    mask_storage_key = Column(String, nullable=True)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    channels = Column(Integer, nullable=False)
    color_mode = Column(String, nullable=False)
    structure_element = Column(String, nullable=True)
    user_gsd_mm_per_px = Column(Float, nullable=True)
    calibration_provenance = Column(String, default="UNAVAILABLE")
    uploaded_at = Column(String, nullable=False)


class ImageAnalysis(Base):
    __tablename__ = "image_analyses"

    id = Column(String, primary_key=True)
    image_id = Column(String, ForeignKey("uploaded_images.id"), nullable=False)
    finding_id = Column(String, nullable=True)
    algorithm_name = Column(String, nullable=False)
    algorithm_version = Column(String, nullable=False)
    status = Column(String, nullable=False)
    has_candidate = Column(Boolean, nullable=False)
    candidate_pixel_area = Column(Integer, default=0)
    candidate_trace_length_px = Column(Float, nullable=True)
    candidate_mean_aperture_px = Column(Float, nullable=True)
    candidate_max_aperture_px = Column(Float, nullable=True)
    calibrated_aperture_mm = Column(Float, nullable=True)
    linear_trace_length_mm = Column(Float, nullable=True)
    calibration_provenance = Column(String, default="UNAVAILABLE")
    user_gsd_mm_per_px = Column(Float, nullable=True)
    processing_time_ms = Column(Float, default=0.0)
    disclaimer = Column(Text, nullable=False)
    limitations = Column(Text, nullable=False)
    metrics_json = Column(JSON, default=dict)
    created_at = Column(String, nullable=False)


class Document(Base):
    """Uploaded construction document with processing metadata."""
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # .pdf, .txt, .md, .csv
    mime_type = Column(String, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    sha256_hash = Column(String, nullable=False)
    storage_key = Column(String, nullable=False)  # relative path in uploads/
    processing_status = Column(String, nullable=False, default="UPLOADED")  # UPLOADED|PROCESSING|READY|FAILED
    processing_error = Column(Text, nullable=True)
    word_count = Column(Integer, default=0)
    page_count = Column(Integer, default=0)
    extractor_version = Column(String, default="1.0.0")
    indexing_version = Column(String, default="1.0.0")
    requires_ocr = Column(Boolean, default=False)
    uploaded_at = Column(String, nullable=False)
    processed_at = Column(String, nullable=True)

    project = relationship("Project", back_populates="documents")
    passages = relationship("DocumentPassage", back_populates="document", cascade="all, delete-orphan")


class DocumentPassage(Base):
    """Indexed text passage from a document for retrieval."""
    __tablename__ = "document_passages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    passage_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    word_count = Column(Integer, default=0)
    extractor_version = Column(String, default="1.0.0")

    document = relationship("Document", back_populates="passages")


