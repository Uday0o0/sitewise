"""Pydantic models for SITEWISE V4.2 API request/response validation."""

from __future__ import annotations
from typing import Optional, Literal, Any
from pydantic import BaseModel, Field


# ─── Overview ─────────────────────────────────────────────────────────

class ProjectMetadata(BaseModel):
    projectId: str
    projectName: str
    packageId: str
    chainageStartMeters: int
    chainageEndMeters: int
    isDemoDataset: bool
    dataSyncTimestamp: str


class FindingsBreakdown(BaseModel):
    structural: int
    safety: int
    qaHold: int


class KpiSummaries(BaseModel):
    criticalPathVarianceDays: int
    criticalPathStatus: Literal["CRITICAL_DRIFT", "ON_TRACK"]
    criticalPathBlockerDesc: str
    materialReconciledPercent: float
    materialReconciledBand: str
    reconciledMassMt: float
    totalBbsMassMt: float
    tenderCostVarianceInrLakhs: float
    contractorClaimsUnderReviewInrLakhs: float
    activePriorityFindingsCount: int
    findingsBreakdown: FindingsBreakdown


class PriorityDecision(BaseModel):
    findingId: str
    title: str
    locationDesc: str
    chainageFormatted: str
    thumbnailUrl: str
    provenance: Literal["AI_INFERRED", "SOURCE_VERIFIED"]
    directImpact: str
    cascadeFinancialExposureInr: str
    criticalPathSlipDays: int
    suggestedAction: str


class CpmMilestoneItem(BaseModel):
    wbsCode: str
    activityDesc: str
    baselineDate: str
    projectedDate: str
    slackDriftDays: int
    status: Literal["HOLD_RETEST", "BLOCKED", "PENDING_SPAN", "ON_SCHEDULE"]


class EvidenceIngestItem(BaseModel):
    assetId: str
    title: str
    dataType: Literal["GEOTIFF", "PDF_CERT", "JSON_LOG", "CSV_TELEMETRY"]
    ingestTimeAgo: str
    provenanceStatus: Literal["SOURCE_VERIFIED", "QA_HOLD", "CALCULATED"]
    linkedFindingId: Optional[str] = None


class UnconfiguredSensorItem(BaseModel):
    sensorType: str
    location: str
    status: Literal["NO_GATEWAY_LINKED"]
    configActionUrl: str


class OverviewResponse(BaseModel):
    projectMetadata: ProjectMetadata
    kpiSummaries: KpiSummaries
    priorityDecisions: list[PriorityDecision]
    cpmMilestones: list[CpmMilestoneItem]
    evidenceIngestStream: list[EvidenceIngestItem]
    unconfiguredSensors: list[UnconfiguredSensorItem]


# ─── Project list ─────────────────────────────────────────────────────

class ProjectListItem(BaseModel):
    id: str
    name: str
    packageId: str
    chainageRange: str
    isDemoMode: bool


# ─── Inspection Workbench ─────────────────────────────────────────────

class CaptureSource(BaseModel):
    flightId: str
    lens: str
    gsdMmPerPx: float
    capturedAt: str
    coordinates: dict


class PhotogrammetricMetrology(BaseModel):
    imageUrl: str
    calibratedApertureMm: float
    apertureToleranceMarginMm: float
    permissibleThresholdMm: float
    governingCode: str
    exceedancePercent: float
    linearTraceLengthMm: float
    shearVectorAngleDegrees: float
    inferredDepthMm: float
    inferredRootMechanism: str


class NdtCorroborationItem(BaseModel):
    protocolName: str
    status: Literal["PASS", "SCHEDULED", "AWAITING_DISPOSITION"]
    details: str
    scheduledTime: Optional[str] = None
    provenance: Optional[str] = "UNVERIFIED"
    sourceDocumentId: Optional[str] = None


class ReviewerDispositionState(BaseModel):
    currentStatus: Literal["AWAITING_REVIEW", "CONFIRMED_NCR", "DOWNGRADED", "REJECTED"]
    dispositionedBy: Optional[str] = None
    dispositionNotes: Optional[str] = None
    pkiCertificateValid: bool


class InspectionTelemetryResponse(BaseModel):
    findingId: str
    graphId: Optional[str] = None
    assetChainage: str
    structureElement: str
    captureSource: CaptureSource
    photogrammetricMetrology: PhotogrammetricMetrology
    ndtCorroboration: list[NdtCorroborationItem]
    reviewerDispositionState: ReviewerDispositionState


# ─── Evidence Graph ───────────────────────────────────────────────────

ProvenanceType = Literal[
    "SOURCE_VERIFIED",
    "HUMAN_REVIEWED",
    "AI_INFERRED",
    "SYNTHETIC_DEMO",
    "CALCULATED",
]

NodeType = Literal["EVIDENCE", "FINDING", "RISK", "IMPACT", "ACTION"]

RelationshipType = Literal[
    "SUPPORTS",
    "EVIDENCES",
    "TRIGGERS",
    "CAUSES_IMPACT",
    "MITIGATES",
]


class GraphNodeSchema(BaseModel):
    id: str
    tier: int
    provenance: str
    title: str
    primarySubtitle: str = ""
    metrics: dict = {}
    badgeText: str = ""
    isSelected: bool = False
    projectId: str = "PRJ-NH48-PKG3"
    nodeType: str = "FINDING"
    codeReference: Optional[str] = None
    severity: Optional[str] = None
    documentId: Optional[str] = None
    passageId: Optional[int] = None
    pageNumber: Optional[int] = None
    citationText: Optional[str] = None
    findingId: Optional[str] = None
    rationale: Optional[str] = None
    confidence: Optional[float] = None
    metadataJson: Optional[dict] = None


class GraphConnectionSchema(BaseModel):
    sourceNodeId: str
    targetNodeId: str
    connectorLabel: str
    isCriticalPath: bool
    id: Optional[int] = None
    projectId: str = "PRJ-NH48-PKG3"
    relationshipType: str = "TRIGGERS"
    provenance: str = "SYNTHETIC_DEMO"
    rationale: Optional[str] = None
    confidence: Optional[float] = None


class ProvenanceTrailItem(BaseModel):
    documentId: str
    title: str
    spec: str
    downloadUrl: str


class GoverningCodeLimit(BaseModel):
    code: str
    limit: str
    measured: str
    status: Literal["EXCEEDED", "CRITICAL_ZONE", "COMPLIANT"]


class InspectorDrawerData(BaseModel):
    nodeId: str
    title: str
    provenanceTrail: list[ProvenanceTrailItem]
    governingCodeLimits: list[GoverningCodeLimit]


class EvidenceGraphResponse(BaseModel):
    graphId: str
    activeRootFindingId: str
    cpmGraphSyncedAgo: str
    nodes: list[GraphNodeSchema]
    connections: list[GraphConnectionSchema]
    inspectorDrawer: InspectorDrawerData


class FindingEvidenceLinkCreate(BaseModel):
    findingId: Optional[str] = None
    documentId: str
    passageId: int
    citationText: Optional[str] = None
    relevanceNote: Optional[str] = None
    provenance: ProvenanceType = "HUMAN_REVIEWED"
    confidence: Optional[float] = Field(default=1.0, ge=0.0, le=1.0)
    isAiInferred: Optional[bool] = False


class FindingEvidenceLinkResponse(BaseModel):
    id: str
    projectId: str
    findingId: str
    documentId: str
    passageId: int
    pageNumber: Optional[int] = None
    citationText: Optional[str] = None
    relevanceNote: Optional[str] = None
    provenance: str
    confidence: float
    createdAt: str
    documentTitle: Optional[str] = None
    documentFilename: Optional[str] = None
    passageContent: Optional[str] = None
    downloadUrl: Optional[str] = None
    isMissingSource: bool = False


class FindingEvidenceLinksListResponse(BaseModel):
    findingId: str
    projectId: str
    totalLinks: int
    links: list[FindingEvidenceLinkResponse]


class NodeSourceDetailsResponse(BaseModel):
    nodeId: str
    graphId: str
    projectId: str
    tier: int
    nodeType: str
    provenance: str
    title: str
    primarySubtitle: Optional[str] = ""
    metrics: dict = {}
    badgeText: Optional[str] = ""
    codeReference: Optional[str] = None
    severity: Optional[str] = None
    findingId: Optional[str] = None
    rationale: Optional[str] = None
    confidence: Optional[float] = None
    metadataJson: Optional[dict] = None
    hasSourceDocument: bool = False
    documentId: Optional[str] = None
    documentTitle: Optional[str] = None
    documentFilename: Optional[str] = None
    passageId: Optional[int] = None
    pageNumber: Optional[int] = None
    citationText: Optional[str] = None
    passageContent: Optional[str] = None
    downloadUrl: Optional[str] = None
    sourceStatus: Literal["AVAILABLE", "MISSING_DOCUMENT", "MISSING_PASSAGE", "NO_SOURCE_ATTACHED"] = "NO_SOURCE_ATTACHED"
    provenanceTrail: list[ProvenanceTrailItem] = []
    governingCodeLimits: list[GoverningCodeLimit] = []
    evidenceLinks: list[FindingEvidenceLinkResponse] = []


class GraphNodeCreate(BaseModel):
    id: Optional[str] = None
    tier: int = Field(ge=1, le=5)
    nodeType: NodeType = "FINDING"
    provenance: ProvenanceType = "HUMAN_REVIEWED"
    title: str
    primarySubtitle: Optional[str] = ""
    metrics: Optional[dict] = None
    badgeText: Optional[str] = ""
    codeReference: Optional[str] = None
    severity: Optional[str] = None
    documentId: Optional[str] = None
    passageId: Optional[int] = None
    pageNumber: Optional[int] = None
    citationText: Optional[str] = None
    findingId: Optional[str] = None
    rationale: Optional[str] = None
    confidence: Optional[float] = None
    metadataJson: Optional[dict] = None
    isAiInferred: Optional[bool] = False


class GraphEdgeCreate(BaseModel):
    sourceNodeId: str
    targetNodeId: str
    connectorLabel: Optional[str] = ""
    isCriticalPath: Optional[bool] = False
    relationshipType: RelationshipType = "TRIGGERS"
    provenance: ProvenanceType = "HUMAN_REVIEWED"
    rationale: Optional[str] = None
    confidence: Optional[float] = None
    isAiInferred: Optional[bool] = False


# ─── Simulator ────────────────────────────────────────────────────────

class SimulatorParameters(BaseModel):
    gantryIdlingDailyRateInr: int = Field(ge=0)
    cfrpCuringWindowHours: Literal[36, 48, 72]
    independentEngineerSlaHours: int = Field(ge=0)
    upvTargetThresholdMps: int = Field(ge=0)
    # Optional customizable baseline & mitigation assumptions (with backwards-compatible defaults)
    baselineScheduleSlipDays: Optional[int] = Field(default=18, ge=0)
    baselineDemolitionDirectCostInr: Optional[int] = Field(default=530000, ge=0)
    baselineGantryIdlingDays: Optional[int] = Field(default=10, ge=0)
    cfrpBaseMaterialCostInr: Optional[int] = Field(default=350000, ge=0)
    cfrpDailyLaborRateInr: Optional[int] = Field(default=100000, ge=0)


class SimulatorEvaluateRequest(BaseModel):
    findingId: str
    baselineType: Literal["FULL_RECAST_DEMOLITION"]
    scenarioType: Literal["CFRP_PRESSURE_INJECTION"]
    parameters: SimulatorParameters
    projectId: Optional[str] = "PRJ-NH48-PKG3"
    graphNodeId: Optional[str] = None
    scenarioName: Optional[str] = None


class MilestoneDelta(BaseModel):
    wbsCode: str
    description: str
    p6BaseDate: str
    scenarioDate: str
    netDriftDays: int
    pathStatus: str


class FeasibilityAssessment(BaseModel):
    structuralResiliencePercent: float
    authorityAcceptanceRisk: Literal["LOW", "MEDIUM", "HIGH"]
    designLifeYears: int


class SimulatorEvaluateResponse(BaseModel):
    simulationRunId: str
    baselineScheduleSlipDays: int
    scenarioScheduleSlipDays: int
    daysRecovered: int
    windowCompressionPercent: float
    baselineFinancialExposureInr: int
    scenarioProposedCostInr: int
    netCalculatedAvoidanceInr: int
    milestonesDelta: list[MilestoneDelta]
    feasibilityAssessment: FeasibilityAssessment
    modelBoundaries: list[str]
    # Transparent calculation additions
    costReductionPercent: Optional[float] = None
    scheduleReductionPercent: Optional[float] = None
    drivingFactors: Optional[list[str]] = None
    comparisonSummary: Optional[str] = None
    formulaBreakdown: Optional[dict[str, Any]] = None
    inputClassification: Optional[dict[str, Any]] = None
    disclaimer: Optional[str] = "Outputs are estimates based on stated assumptions. Synthetic demo values are illustrative and results are not certified engineering or construction advice."


class SimulatorCommitRequest(BaseModel):
    simulationRunId: str
    findingId: str
    acknowledgement: bool = Field(
        description="User must explicitly acknowledge that committing does not overwrite certified P6 baseline"
    )


class SimulatorCommitResponse(BaseModel):
    commitId: str
    status: str
    message: str


class ScenarioSaveRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    projectId: str = "PRJ-NH48-PKG3"
    findingId: str = "FND-104"
    baselineType: Literal["FULL_RECAST_DEMOLITION"] = "FULL_RECAST_DEMOLITION"
    scenarioType: Literal["CFRP_PRESSURE_INJECTION"] = "CFRP_PRESSURE_INJECTION"
    parameters: SimulatorParameters


class ScenarioItemResponse(BaseModel):
    id: str
    projectId: str
    findingId: str
    name: str
    description: Optional[str] = None
    baselineType: str
    scenarioType: str
    parameters: dict[str, Any]
    result: dict[str, Any]
    createdAt: str
    updatedAt: str


class ScenarioListResponse(BaseModel):
    scenarios: list[ScenarioItemResponse]
    total: int



# ─── Disposition ──────────────────────────────────────────────────────

class DispositionUpdateRequest(BaseModel):
    disposition: Literal["CONFIRM_NCR", "DOWNGRADE_SHRINKAGE", "REJECT_ARTIFACT"]
    engineerNotes: str = Field(min_length=1)
    signerName: str
    signerLicenseId: str


class DispositionUpdateResponse(BaseModel):
    findingId: str
    newStatus: str
    protocolId: str
    auditHash: str
    message: str


# ─── Milestone 1: Image Upload and Analysis Schemas ───────────────────

class ImageDimensions(BaseModel):
    width: int
    height: int
    channels: int
    colorMode: str


class PixelMetrics(BaseModel):
    areaPx: int
    traceLengthPx: Optional[float] = None
    meanAperturePx: Optional[float] = None
    maxAperturePx: Optional[float] = None


class PhysicalMetrics(BaseModel):
    calibratedApertureMm: Optional[float] = None
    linearTraceLengthMm: Optional[float] = None


class CalibrationInfo(BaseModel):
    gsdMmPerPx: Optional[float] = None
    provenance: Literal["USER_PROVIDED_UNVERIFIED", "UNAVAILABLE"]
    isCalibrated: bool
    note: str


class AlgorithmInfo(BaseModel):
    name: str
    version: str


class UploadedImageMetadata(BaseModel):
    width: int
    height: int
    channels: int
    colorMode: str
    fileSizeBytes: int
    sha256: str
    mimeType: str
    originalFilename: str


class CandidateRegion(BaseModel):
    id: str
    areaPx: int
    traceLengthPx: Optional[float] = None
    meanWidthPx: Optional[float] = None
    maxWidthPx: Optional[float] = None
    calibratedWidthMm: Optional[float] = None
    calibratedLengthMm: Optional[float] = None
    boundingBox: list[int]
    centroid: list[float]
    elongation: Optional[float] = None
    aspectRatio: Optional[float] = None


class CrackDetectionSummary(BaseModel):
    status: Literal[
        "Potential crack-like regions detected",
        "No candidates detected",
        "Analysis failed",
        "Potential cracks detected",
        "No potential cracks detected",
        "Image could not be analyzed",
    ]
    candidateCount: int
    candidateCountLabel: str
    imageResolution: str = ""
    calibrationStatusText: str = ""
    explanation: str
    preliminaryReviewNotice: str
    candidates: list[CandidateRegion] = []
    isCalibrated: bool
    calibrationProvenance: str
    calibrationNote: str
    algorithmVersion: str = "2.1.0"
    algorithmConfig: dict = {}


class FindingUploadResponse(BaseModel):
    findingId: str
    imageId: str
    analysisId: str
    graphId: Optional[str] = None
    originalFilename: str
    fileSizeBytes: int
    sha256: str
    dimensions: ImageDimensions
    status: Literal["COMPLETED", "NO_CANDIDATE_DETECTED"]
    hasCandidate: bool
    pixelMetrics: PixelMetrics
    physicalMetrics: PhysicalMetrics
    calibration: CalibrationInfo
    crackSummary: CrackDetectionSummary
    imageUrl: str
    maskUrl: Optional[str] = None
    analysisUrl: str
    disclaimer: str
    limitations: str
    uploadedAt: str


class FindingAnalysisResponse(BaseModel):
    findingId: str
    imageId: str
    analysisId: str
    sha256: str
    algorithm: AlgorithmInfo
    status: Literal["COMPLETED", "NO_CANDIDATE_DETECTED"]
    hasCandidate: bool
    pixelMetrics: PixelMetrics
    physicalMetrics: PhysicalMetrics
    calibration: CalibrationInfo
    crackSummary: CrackDetectionSummary
    imageMetadata: UploadedImageMetadata
    imageUrl: str
    maskUrl: Optional[str] = None
    disclaimer: str
    limitations: str
    createdAt: str



class FindingListItem(BaseModel):
    id: str
    title: str
    structureElement: str
    chainageFormatted: str
    provenance: str
    category: str
    dispositionStatus: str
    isUploaded: bool
    imageUrl: Optional[str] = None
    maskUrl: Optional[str] = None
    calibratedApertureMm: Optional[float] = None
    linearTraceLengthMm: Optional[float] = None


# ─── Milestone 2: Document Intelligence Schemas ──────────────────

class DocumentUploadResponse(BaseModel):
    documentId: str
    projectId: str
    title: str
    originalFilename: str
    fileType: str
    mimeType: str
    fileSizeBytes: int
    sha256: str
    processingStatus: str
    uploadedAt: str


class DocumentMetadata(BaseModel):
    documentId: str
    projectId: str
    title: str
    originalFilename: str
    fileType: str
    mimeType: str
    fileSizeBytes: int
    sha256: str
    processingStatus: str
    processingError: Optional[str] = None
    wordCount: int = 0
    pageCount: int = 0
    extractorVersion: str = "1.0.0"
    indexingVersion: str = "1.0.0"
    requiresOcr: bool = False
    uploadedAt: str
    processedAt: Optional[str] = None


class DocumentListItem(BaseModel):
    documentId: str
    projectId: str
    title: str
    originalFilename: str
    fileType: str
    fileSizeBytes: int
    processingStatus: str
    processingError: Optional[str] = None
    wordCount: int = 0
    requiresOcr: bool = False
    uploadedAt: str


class SearchPassageResult(BaseModel):
    documentId: str
    documentTitle: str
    chunkIndex: int
    content: str
    score: float
    wordCount: int = 0
    pageNumber: Optional[int] = None


class SearchResponse(BaseModel):
    query: str
    projectId: str
    totalResults: int
    passages: list[SearchPassageResult]


class CitationItem(BaseModel):
    documentId: str
    documentTitle: str
    pageNumber: Optional[int] = None
    passageIndex: int
    excerpt: str
    downloadUrl: str


class AssistantAnswer(BaseModel):
    answer: str
    citations: list[CitationItem] = []
    isGrounded: bool = False
    insufficientEvidence: bool = False
    provider: str = "none"
    model: str = ""
    providerAvailable: bool = False
    error: Optional[str] = None
    retrievalInfo: Optional[SearchResponse] = None


class SearchRequest(BaseModel):
    query: str
    topK: Optional[int] = 5


class AssistantQueryRequest(BaseModel):
    question: str
    documentId: Optional[str] = None


class AssistantStatusResponse(BaseModel):
    provider: str
    model: str
    providerAvailable: bool
    isConfigured: bool
    supportedTypes: list[str]


# ─── Planning & Valuation (Materials Reconciliation & Claims) ────────

class MaterialReconciliationItem(BaseModel):
    id: int
    projectId: str
    materialCode: str
    materialName: str
    specCode: str
    unit: str
    theoreticalQuantity: float
    actualIssuedQuantity: float
    varianceQuantity: float
    variancePercent: float
    contractualBand: str
    status: Literal["COMPLIANT", "OVERCONSUMED", "SAVING"]
    provenance: str = "SYNTHETIC_DEMO"
    sourceReference: Optional[str] = None


class MaterialReconciliationResponse(BaseModel):
    projectId: str
    totalItems: int
    compliantCount: int
    overconsumedCount: int
    savingCount: int
    items: list[MaterialReconciliationItem]


class ContractorClaimItem(BaseModel):
    id: str  # Claim reference e.g. CLM-2024-019
    projectId: str
    contractorName: str
    clauseReference: str
    claimedAmountInr: float
    claimedAmountInrLakhs: float
    assessedExposureInr: float
    assessedExposureInrLakhs: float
    status: Literal["UNDER_TECHNICAL_EVALUATION", "PROPOSED_REJECTION", "NEGOTIATION"]
    linkedFindingId: Optional[str] = None
    description: str
    provenance: str = "SYNTHETIC_DEMO"
    sourceReference: Optional[str] = None


class ContractorClaimsResponse(BaseModel):
    projectId: str
    totalClaims: int
    totalClaimedAmountInrLakhs: float
    totalAssessedExposureInrLakhs: float
    claims: list[ContractorClaimItem]



