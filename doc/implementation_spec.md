# IMPLEMENTATION_SPEC.md — Screen & Data Mapping Specification

This document details the screen-by-screen layout, backend API contracts, external integration boundaries, and interaction flows for SITEWISE V4.2.

---

## 1. Backend Data Schema & Contract Mapping

### 1.1 Overview Screen (`GET /api/v4/projects/{projectId}/overview`)
```typescript
export interface OverviewResponse {
  projectMetadata: {
    projectId: string;
    projectName: string;
    packageId: string;
    chainageStartMeters: number; // 14200
    chainageEndMeters: number;   // 18600
    isDemoDataset: boolean;      // true
    dataSyncTimestamp: string;   // ISO-8601
  };
  kpiSummaries: {
    criticalPathVarianceDays: number;     // -4
    criticalPathStatus: 'CRITICAL_DRIFT' | 'ON_TRACK';
    criticalPathBlockerDesc: string;      // "Span 18-19 Precast Launch Blocked"
    materialReconciledPercent: number;    // 94.2
    materialReconciledBand: string;       // "Within ±6% band"
    reconciledMassMt: number;             // 3410
    totalBbsMassMt: number;               // 3620
    tenderCostVarianceInrLakhs: number;   // -4.85
    contractorClaimsUnderReviewInrLakhs: number; // 12.4
    activePriorityFindingsCount: number;  // 7
    findingsBreakdown: {
      structural: number; // 2
      safety: number;     // 3
      qaHold: number;     // 2
    };
  };
  priorityDecisions: Array<{
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
  }>;
  cpmMilestones: Array<{
    wbsCode: string;
    activityDesc: string;
    baselineDate: string;
    projectedDate: string;
    slackDriftDays: number;
    status: 'HOLD_RETEST' | 'BLOCKED' | 'PENDING_SPAN' | 'ON_SCHEDULE';
  }>;
  evidenceIngestStream: Array<{
    assetId: string;
    title: string;
    dataType: 'GEOTIFF' | 'PDF_CERT' | 'JSON_LOG' | 'CSV_TELEMETRY';
    ingestTimeAgo: string;
    provenanceStatus: 'SOURCE_VERIFIED' | 'QA_HOLD' | 'CALCULATED';
    linkedFindingId?: string;
  }>;
  unconfiguredSensors: Array<{
    sensorType: string;
    location: string;
    status: 'NO_GATEWAY_LINKED';
    configActionUrl: string;
  }>;
}
```

### 1.2 Inspection Workbench (`GET /api/v4/findings/{findingId}/telemetry`)
```typescript
export interface InspectionTelemetryResponse {
  findingId: string; // "FND-104"
  assetChainage: string; // "Ch. 14+320"
  structureElement: string; // "Pier Cap 18 Cantilever Downstream Face"
  captureSource: {
    flightId: string; // "DJI Matrice 300 RTK"
    lens: string; // "45mm F2.8"
    gsdMmPerPx: number; // 0.8
    capturedAt: string; // "2024-11-12T08:45:00Z"
    coordinates: { x: number; y: number; z: number };
  };
  photogrammetricMetrology: {
    imageUrl: string;
    calibratedApertureMm: number; // 0.35
    apertureToleranceMarginMm: number; // 0.05
    permissibleThresholdMm: number; // 0.20
    governingCode: string; // "IRC:112 Clause 12.3"
    exceedancePercent: number; // 75
    linearTraceLengthMm: number; // 420
    shearVectorAngleDegrees: number; // 42
    inferredDepthMm: number; // 35
    inferredRootMechanism: string;
  };
  ndtCorroboration: Array<{
    protocolName: string;
    status: 'PASS' | 'SCHEDULED' | 'AWAITING_DISPOSITION';
    details: string;
    scheduledTime?: string;
  }>;
  reviewerDispositionState: {
    currentStatus: 'AWAITING_REVIEW' | 'CONFIRMED_NCR' | 'DOWNGRADED' | 'REJECTED';
    dispositionedBy?: string;
    dispositionNotes?: string;
    pkiCertificateValid: boolean;
  };
}
```

### 1.3 Evidence Graph Causal Matrix (`GET /api/v4/graphs/{graphId}/topology`)
```typescript
export interface EvidenceGraphResponse {
  graphId: string;
  activeRootFindingId: string;
  cpmGraphSyncedAgo: string;
  nodes: Array<{
    id: string;
    tier: number;
    provenance: 'SOURCE_VERIFIED' | 'AI_INFERRED' | 'CALCULATED_RISK' | 'PROPOSED_ACTION';
    title: string;
    primarySubtitle: string;
    metrics: Record<string, string | number>;
    badgeText: string;
    isSelected: boolean;
  }>;
  connections: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    connectorLabel: string;
    isCriticalPath: boolean;
  }>;
  inspectorDrawer: {
    nodeId: string;
    title: string;
    provenanceTrail: Array<{
      documentId: string;
      title: string;
      spec: string;
      downloadUrl: string;
    }>;
    governingCodeLimits: Array<{
      code: string;
      limit: string;
      measured: string;
      status: 'EXCEEDED' | 'CRITICAL_ZONE' | 'COMPLIANT';
    }>;
  };
}
```

### 1.4 What-If Simulator Matrix (`POST /api/v4/simulator/evaluate`)
```typescript
// Request Payload:
export interface SimulatorEvaluateRequest {
  findingId: string;
  baselineType: 'FULL_RECAST_DEMOLITION';
  scenarioType: 'CFRP_PRESSURE_INJECTION';
  parameters: {
    gantryIdlingDailyRateInr: number; // 150000
    cfrpCuringWindowHours: 36 | 48 | 72; // 48
    independentEngineerSlaHours: number; // 24
    upvTargetThresholdMps: number; // 3850
  };
}

// Response Payload:
export interface SimulatorEvaluateResponse {
  simulationRunId: string;
  baselineScheduleSlipDays: number; // 18
  scenarioScheduleSlipDays: number; // 3
  daysRecovered: number;            // 15
  windowCompressionPercent: number; // 83.3
  baselineFinancialExposureInr: number; // 2030000
  scenarioProposedCostInr: number;      // 550000
  netCalculatedAvoidanceInr: number;    // 1480000
  milestonesDelta: Array<{
    wbsCode: string;
    description: string;
    p6BaseDate: string;
    scenarioDate: string;
    netDriftDays: number;
    pathStatus: string;
  }>;
  feasibilityAssessment: {
    structuralResiliencePercent: number; // 94.2
    authorityAcceptanceRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    designLifeYears: number; // 50
  };
  modelBoundaries: string[];
}
```

---

## 2. Interaction & State Transition Specifications

### 2.1 Graph Filtering & Node Selection
1. **User Action:** User clicks on any topological node card in the Causal Graph canvas.
2. **State Updates:**
   - Active node receives Safety Yellow focus border (`border-2 border-[#F5C542]`) and subtle yellow drop-glow.
   - Connected parent and child edges highlight with pulsing amber trajectory lines.
   - Unconnected nodes dim to 35% opacity (`opacity-35 transition-opacity duration-200`).
   - Sticky Inspector Panel on right updates data context via `selectedNodeId` without page reload.
3. **Filter Mode Switch:**
   - Clicking `[Critical Impact Path Only]` filters the canvas to only nodes on the CPM delay vector (Pier 18 Defect -> Risk #RSK-042 -> Girder Delay -> CFRP Wrap).

### 2.2 Inspection Review & Protocol Sign-off
1. **Selection:** User selects Radio Option 1 (`Confirm as Non-Conformance Finding [Escalate to NCR]`).
2. **Validation:** System checks `engineerNotes` field. If empty, field highlights with red warning border `border-red-500` ("Mandatory engineering justification required").
3. **Execution:** On clicking `[SIGN & ISSUE NCR-084 PROTOCOL]`:
   - Button enters loading state with animated spinner (`Signing via PKI Ledger...`).
   - On response, a success toast appears: *"Protocol NCR-084 generated with SHA-256 audit hash #9a8e...4f1c"*.
   - Overview KPI counter updates `Awaiting Review` -> `Active Structural NCR`.

### 2.3 Scenario Recalculation & Baseline Commitment
1. **Recalculation:**
   - Changing `Gantry Idling Rate` or `Curing Hours` illuminates the `[Recalculate Dynamic Trajectory]` button with amber pulse indicator.
   - User triggers recalculation: updates the `Net Calculated Avoidance` and CPM milestone variance column in < 250ms via client-side reactive equation.
2. **Commitment Guardrail:**
   - Clicking `[COMMIT SCENARIO TO WORKING BASELINE]` opens modal confirmation dialog.
   - Requires clicking an explicit checkbox: *"I acknowledge that this action adjusts working buffer dates and does not overwrite certified master P6 baseline without Project Director approval."*
   - On final confirmation, sends `POST /api/v4/simulator/commit` and routes user back to Overview with updated buffer markers.

---

## 3. External Integration & Future Implementation Flags

| Module | Feature | Implementation Status | Future External Dependency / Boundary |
| :--- | :--- | :--- | :--- |
| **Overview** | Inclinometer Sensor Telemetry | **UNCONFIGURED (Empty State)** | Requires IoT Gateway integration (SoilInstruments / Encardio-Rite Modbus API) |
| **Overview** | Batch Plant Ingest Stream | **SIMULATED** | Requires RMC SCADA connection (Command Alkon or batch slip OCR pipeline) |
| **Inspections**| 2D Orthophoto Metrology Scale | **CALIBRATED ESTIMATE** | 2D pixel estimation based on 0.8mm/px GSD. Requires direct tactile crack gauge for certified legal closure |
| **Evidence Graph** | Primavera P6 CPM Sync | **SYNTHETIC P6 SYNC** | Requires Oracle Primavera P6 EPPM XML/REST bridge for automated critical path recalculations |
| **Simulator** | Monte Carlo Cost Engine | **DEMO ALGORITHMIC** | Monte Carlo v2.8 calibrated for demo. Requires full risk register statistical distributions in production |
