/**
 * SITEWISE V4.2 — TypeScript API interfaces
 * Matches the Pydantic schemas from implementation_spec.md
 */

// ─── Provenance ─────────────────────────────────────────────────

export type ProvenanceType =
  | 'SOURCE_VERIFIED'
  | 'AI_INFERRED'
  | 'HUMAN_REVIEWED'
  | 'CALCULATED_RISK'
  | 'PROPOSED_ACTION'
  | 'DEMO_SYNTHETIC'
  | 'SYNTHETIC_DEMO'
  | 'CALCULATED';

// ─── Project ────────────────────────────────────────────────────

export interface ProjectListItem {
  id: string;
  name: string;
  packageId: string;
  chainageRange: string;
  isDemoMode: boolean;
}

// ─── Overview ───────────────────────────────────────────────────

export interface ProjectMetadata {
  projectId: string;
  projectName: string;
  packageId: string;
  chainageStartMeters: number;
  chainageEndMeters: number;
  isDemoDataset: boolean;
  dataSyncTimestamp: string;
}

export interface FindingsBreakdown {
  structural: number;
  safety: number;
  qaHold: number;
}

export interface KpiSummaries {
  criticalPathVarianceDays: number;
  criticalPathStatus: 'CRITICAL_DRIFT' | 'ON_TRACK';
  criticalPathBlockerDesc: string;
  materialReconciledPercent: number;
  materialReconciledBand: string;
  reconciledMassMt: number;
  totalBbsMassMt: number;
  tenderCostVarianceInrLakhs: number;
  contractorClaimsUnderReviewInrLakhs: number;
  activePriorityFindingsCount: number;
  findingsBreakdown: FindingsBreakdown;
}

export interface PriorityDecision {
  findingId: string;
  title: string;
  locationDesc: string;
  chainageFormatted: string;
  thumbnailUrl: string;
  provenance: 'AI_INFERRED' | 'SOURCE_VERIFIED';
  directImpact: string;
  cascadeFinancialExposureInr: string;
  criticalPathSlipDays: number;
  suggestedAction: string;
}

export interface CpmMilestoneItem {
  wbsCode: string;
  activityDesc: string;
  baselineDate: string;
  projectedDate: string;
  slackDriftDays: number;
  status: 'HOLD_RETEST' | 'BLOCKED' | 'PENDING_SPAN' | 'ON_SCHEDULE';
}

export interface EvidenceIngestItem {
  assetId: string;
  title: string;
  dataType: 'GEOTIFF' | 'PDF_CERT' | 'JSON_LOG' | 'CSV_TELEMETRY';
  ingestTimeAgo: string;
  provenanceStatus: 'SOURCE_VERIFIED' | 'QA_HOLD' | 'CALCULATED';
  linkedFindingId?: string;
}

export interface UnconfiguredSensorItem {
  sensorType: string;
  location: string;
  status: 'NO_GATEWAY_LINKED';
  configActionUrl: string;
}

export interface OverviewResponse {
  projectMetadata: ProjectMetadata;
  kpiSummaries: KpiSummaries;
  priorityDecisions: PriorityDecision[];
  cpmMilestones: CpmMilestoneItem[];
  evidenceIngestStream: EvidenceIngestItem[];
  unconfiguredSensors: UnconfiguredSensorItem[];
}

// ─── Inspection Workbench ───────────────────────────────────────

export interface CaptureSource {
  flightId: string;
  lens: string;
  gsdMmPerPx: number;
  capturedAt: string;
  coordinates: { x: number; y: number; z: number };
}

export interface PhotogrammetricMetrology {
  imageUrl: string;
  calibratedApertureMm: number;
  apertureToleranceMarginMm: number;
  permissibleThresholdMm: number;
  governingCode: string;
  exceedancePercent: number;
  linearTraceLengthMm: number;
  shearVectorAngleDegrees: number;
  inferredDepthMm: number;
  inferredRootMechanism: string;
}

export interface NdtCorroborationItem {
  protocolName: string;
  status: 'PASS' | 'SCHEDULED' | 'AWAITING_DISPOSITION';
  details: string;
  scheduledTime?: string;
  provenance?: string;
  sourceDocumentId?: string;
}

export interface ReviewerDispositionState {
  currentStatus: 'AWAITING_REVIEW' | 'CONFIRMED_NCR' | 'DOWNGRADED' | 'REJECTED';
  dispositionedBy?: string;
  dispositionNotes?: string;
  pkiCertificateValid: boolean;
}

export interface InspectionTelemetryResponse {
  findingId: string;
  assetChainage: string;
  structureElement: string;
  captureSource: CaptureSource;
  photogrammetricMetrology: PhotogrammetricMetrology;
  ndtCorroboration: NdtCorroborationItem[];
  reviewerDispositionState: ReviewerDispositionState;
}

// ─── Evidence Graph ─────────────────────────────────────────────

export interface GraphNode {
  id: string;
  tier: number;
  provenance: string;
  title: string;
  primarySubtitle: string;
  metrics: Record<string, string | number>;
  badgeText: string;
  isSelected: boolean;
  projectId?: string;
  nodeType?: 'EVIDENCE' | 'FINDING' | 'RISK' | 'IMPACT' | 'ACTION' | string;
  codeReference?: string;
  severity?: string;
  documentId?: string;
  passageId?: number;
  pageNumber?: number;
  citationText?: string;
  findingId?: string;
  rationale?: string;
  confidence?: number;
  metadataJson?: Record<string, any>;
}

export interface GraphConnection {
  sourceNodeId: string;
  targetNodeId: string;
  connectorLabel: string;
  isCriticalPath: boolean;
  id?: number;
  projectId?: string;
  relationshipType?: 'SUPPORTS' | 'EVIDENCES' | 'TRIGGERS' | 'CAUSES_IMPACT' | 'MITIGATES' | string;
  provenance?: string;
  rationale?: string;
  confidence?: number;
}

export interface ProvenanceTrailItem {
  documentId: string;
  title: string;
  spec: string;
  downloadUrl: string;
}

export interface GoverningCodeLimit {
  code: string;
  limit: string;
  measured: string;
  status: 'EXCEEDED' | 'CRITICAL_ZONE' | 'COMPLIANT';
}

export interface InspectorDrawerData {
  nodeId: string;
  title: string;
  provenanceTrail: ProvenanceTrailItem[];
  governingCodeLimits: GoverningCodeLimit[];
}

export interface EvidenceGraphResponse {
  graphId: string;
  activeRootFindingId: string;
  cpmGraphSyncedAgo: string;
  nodes: GraphNode[];
  connections: GraphConnection[];
  inspectorDrawer: InspectorDrawerData;
}

export interface FindingEvidenceLinkItem {
  id: string;
  projectId: string;
  findingId: string;
  documentId: string;
  passageId: number;
  pageNumber?: number;
  citationText?: string;
  relevanceNote?: string;
  provenance: string;
  confidence: number;
  createdAt: string;
  documentTitle?: string;
  documentFilename?: string;
  passageContent?: string;
  downloadUrl?: string;
  isMissingSource?: boolean;
}

export interface FindingEvidenceLinksListResponse {
  findingId: string;
  projectId: string;
  totalLinks: number;
  links: FindingEvidenceLinkItem[];
}

export interface NodeSourceDetailsResponse {
  nodeId: string;
  graphId: string;
  projectId: string;
  tier: number;
  nodeType: string;
  provenance: string;
  title: string;
  primarySubtitle: string;
  metrics: Record<string, string | number>;
  badgeText: string;
  codeReference?: string;
  severity?: string;
  findingId?: string;
  rationale?: string;
  confidence?: number;
  metadataJson?: Record<string, any>;
  hasSourceDocument: boolean;
  documentId?: string;
  documentTitle?: string;
  documentFilename?: string;
  passageId?: number;
  pageNumber?: number;
  citationText?: string;
  passageContent?: string;
  downloadUrl?: string;
  sourceStatus: 'AVAILABLE' | 'MISSING_DOCUMENT' | 'MISSING_PASSAGE' | 'NO_SOURCE_ATTACHED' | string;
  provenanceTrail: ProvenanceTrailItem[];
  governingCodeLimits: GoverningCodeLimit[];
  evidenceLinks: FindingEvidenceLinkItem[];
}

// ─── Simulator ──────────────────────────────────────────────────

export interface SimulatorParameters {
  gantryIdlingDailyRateInr: number;
  cfrpCuringWindowHours: 36 | 48 | 72;
  independentEngineerSlaHours: number;
  upvTargetThresholdMps: number;
  baselineScheduleSlipDays?: number;
  baselineDemolitionDirectCostInr?: number;
  baselineGantryIdlingDays?: number;
  cfrpBaseMaterialCostInr?: number;
  cfrpDailyLaborRateInr?: number;
}

export interface SimulatorEvaluateRequest {
  findingId: string;
  baselineType: 'FULL_RECAST_DEMOLITION';
  scenarioType: 'CFRP_PRESSURE_INJECTION';
  parameters: SimulatorParameters;
  projectId?: string;
  graphNodeId?: string;
  scenarioName?: string;
}

export interface MilestoneDelta {
  wbsCode: string;
  description: string;
  p6BaseDate: string;
  scenarioDate: string;
  netDriftDays: number;
  pathStatus: string;
}

export interface FeasibilityAssessment {
  structuralResiliencePercent: number;
  authorityAcceptanceRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  designLifeYears: number;
}

export interface FormulaStep {
  formula: string;
  arithmetic: string;
  result: string;
  units: string;
}

export interface InputClassificationItem {
  param?: string;
  metric?: string;
  value: string;
  description?: string;
  source?: string;
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED' | 'NEEDS_REVIEW' | 'SYNTHETIC_DEMO';
  verificationNote?: string;
  isVerified?: boolean;
  isSynthetic?: boolean;
  underlyingAssumptions?: string;
}


export interface InputClassification {
  userEntered: InputClassificationItem[];
  sourceBacked: InputClassificationItem[];
  syntheticDemo: InputClassificationItem[];
  calculated: InputClassificationItem[];
}

export interface SimulatorEvaluateResponse {
  simulationRunId: string;
  baselineScheduleSlipDays: number;
  scenarioScheduleSlipDays: number;
  daysRecovered: number;
  windowCompressionPercent: number;
  baselineFinancialExposureInr: number;
  scenarioProposedCostInr: number;
  netCalculatedAvoidanceInr: number;
  costReductionPercent?: number;
  scheduleReductionPercent?: number;
  milestonesDelta: MilestoneDelta[];
  feasibilityAssessment: FeasibilityAssessment;
  modelBoundaries: string[];
  drivingFactors?: string[];
  comparisonSummary?: string;
  formulaBreakdown?: Record<string, FormulaStep>;
  inputClassification?: InputClassification;
  disclaimer?: string;
}

export interface SimulatorCommitResponse {
  commitId: string;
  status: string;
  message: string;
}

export interface ScenarioSaveRequest {
  name: string;
  description?: string;
  projectId?: string;
  findingId?: string;
  baselineType?: 'FULL_RECAST_DEMOLITION';
  scenarioType?: 'CFRP_PRESSURE_INJECTION';
  parameters: SimulatorParameters;
}

export interface ScenarioItemResponse {
  id: string;
  projectId: string;
  findingId: string;
  name: string;
  description?: string;
  baselineType: string;
  scenarioType: string;
  parameters: SimulatorParameters;
  result: SimulatorEvaluateResponse;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioListResponse {
  scenarios: ScenarioItemResponse[];
  total: number;
}


// ─── Disposition ────────────────────────────────────────────────

export interface DispositionUpdateResponse {
  findingId: string;
  newStatus: string;
  protocolId: string;
  auditHash: string;
  message: string;
}

// ─── Milestone 1: Image Upload & Inspection Types ───────────────

export interface ImageDimensions {
  width: number;
  height: number;
  channels: number;
  colorMode: string;
}

export interface PixelMetrics {
  areaPx: number;
  traceLengthPx?: number | null;
  meanAperturePx?: number | null;
  maxAperturePx?: number | null;
}

export interface PhysicalMetrics {
  calibratedApertureMm?: number | null;
  linearTraceLengthMm?: number | null;
}

export interface CalibrationInfo {
  gsdMmPerPx?: number | null;
  provenance: 'USER_PROVIDED_UNVERIFIED' | 'UNAVAILABLE';
  isCalibrated: boolean;
  note: string;
}

export interface AlgorithmInfo {
  name: string;
  version: string;
}

export interface UploadedImageMetadata {
  width: number;
  height: number;
  channels: number;
  colorMode: string;
  fileSizeBytes: number;
  sha256: string;
  mimeType: string;
  originalFilename: string;
}

export interface CandidateRegion {
  id: string;
  areaPx: number;
  traceLengthPx?: number | null;
  meanWidthPx?: number | null;
  maxWidthPx?: number | null;
  calibratedWidthMm?: number | null;
  calibratedLengthMm?: number | null;
  boundingBox: [number, number, number, number];
  centroid: [number, number];
  elongation?: number | null;
  aspectRatio?: number | null;
}

export interface CrackDetectionSummary {
  status:
    | 'Potential crack-like regions detected'
    | 'No candidates detected'
    | 'Analysis failed'
    | 'Potential cracks detected'
    | 'No potential cracks detected'
    | 'Image could not be analyzed';
  candidateCount: number;
  candidateCountLabel: string;
  imageResolution?: string;
  calibrationStatusText?: string;
  explanation: string;
  preliminaryReviewNotice: string;
  candidates: CandidateRegion[];
  isCalibrated: boolean;
  calibrationProvenance: string;
  calibrationNote: string;
  algorithmVersion?: string;
  algorithmConfig?: Record<string, unknown>;
}

export interface FindingUploadResponse {
  findingId: string;
  imageId: string;
  analysisId: string;
  originalFilename: string;
  fileSizeBytes: number;
  sha256: string;
  dimensions: ImageDimensions;
  status: 'COMPLETED' | 'NO_CANDIDATE_DETECTED';
  hasCandidate: boolean;
  pixelMetrics: PixelMetrics;
  physicalMetrics: PhysicalMetrics;
  calibration: CalibrationInfo;
  crackSummary?: CrackDetectionSummary;
  imageUrl: string;
  maskUrl?: string | null;
  analysisUrl: string;
  disclaimer: string;
  limitations: string;
  uploadedAt: string;
}

export interface FindingAnalysisResponse {
  findingId: string;
  imageId: string;
  analysisId: string;
  sha256: string;
  algorithm: AlgorithmInfo;
  status: 'COMPLETED' | 'NO_CANDIDATE_DETECTED';
  hasCandidate: boolean;
  pixelMetrics: PixelMetrics;
  physicalMetrics: PhysicalMetrics;
  calibration: CalibrationInfo;
  crackSummary?: CrackDetectionSummary;
  imageMetadata: UploadedImageMetadata;
  imageUrl: string;
  maskUrl?: string | null;
  disclaimer: string;
  limitations: string;
  createdAt: string;
}

export interface FindingListItem {
  id: string;
  title: string;
  structureElement: string;
  chainageFormatted: string;
  provenance: string;
  category: string;
  dispositionStatus: string;
  isUploaded: boolean;
  imageUrl?: string | null;
  maskUrl?: string | null;
  calibratedApertureMm?: number | null;
  linearTraceLengthMm?: number | null;
}

// ─── Milestone 2: Document Intelligence & Grounded Assistant ───

export interface DocumentUploadResponse {
  documentId: string;
  projectId: string;
  title: string;
  originalFilename: string;
  fileType: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256: string;
  processingStatus: string;
  uploadedAt: string;
}

export interface DocumentMetadata {
  documentId: string;
  projectId: string;
  title: string;
  originalFilename: string;
  fileType: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256: string;
  processingStatus: string;
  processingError?: string | null;
  wordCount: number;
  pageCount: number;
  extractorVersion: string;
  indexingVersion: string;
  requiresOcr: boolean;
  uploadedAt: string;
  processedAt?: string | null;
}

export interface DocumentListItem {
  documentId: string;
  projectId: string;
  title: string;
  originalFilename: string;
  fileType: string;
  fileSizeBytes: number;
  processingStatus: string;
  processingError?: string | null;
  wordCount: number;
  requiresOcr: boolean;
  uploadedAt: string;
}

export interface SearchPassageResult {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
  wordCount: number;
  pageNumber?: number | null;
}

export interface SearchResponse {
  query: string;
  projectId: string;
  totalResults: number;
  passages: SearchPassageResult[];
}

export interface CitationItem {
  documentId: string;
  documentTitle: string;
  pageNumber?: number | null;
  passageIndex: number;
  excerpt: string;
  downloadUrl: string;
}

export interface AssistantAnswer {
  answer: string;
  citations: CitationItem[];
  isGrounded: boolean;
  insufficientEvidence: boolean;
  provider: string;
  model: string;
  providerAvailable: boolean;
  error?: string | null;
  retrievalInfo?: SearchResponse | null;
}

export interface AssistantStatusResponse {
  provider: string;
  model: string;
  providerAvailable: boolean;
  isConfigured: boolean;
  supportedTypes: string[];
}


