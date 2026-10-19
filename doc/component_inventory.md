# COMPONENT_INVENTORY.md — SITEWISE Component Specifications (React + TypeScript)

This inventory defines the concrete React component signatures, props interfaces, and state contracts required for Google Antigravity.

---

## 1. Application Shell & Global Navigation

### 1.1 `AppShell`
- **Component:** `<AppShell activeRoute={route} onNavigate={(r) => ...}>{children}</AppShell>`
- **Structure:**
  - Sticky Top Bar (`GlobalHeader`): 56px height. Contains project brand logo mark, active project dropdown, calibration lock indicator, notification bell (with unread count badge), export briefing memo CTA, and current authenticated user badge.
  - Persistent Left Sidebar (`NavigationRail`): 220px width (`w-[220px]`). Contains main operational modules:
    - `Overview` (`/overview`)
    - `Evidence Centre` (`/evidence`)
    - `Inspections` (`/inspections`)
    - `Evidence Graph` (`/evidence-graph`)
    - `Planning & Cost` (`/planning`)
    - `What-if Simulator` (`/simulator`)
    - `Site Assistant` (`/assistant`)
    - `Calibration & Settings` (`/settings`)
  - Sub-header context strip: Displays chainage location, demo dataset indicator, and RTK-GPS drift status.

### 1.2 `ProjectSelector`
```typescript
interface ProjectSelectorProps {
  currentProject: {
    id: string;
    name: string;
    packageId: string;
    chainageRange: string;
  };
  onSelectProject: (projectId: string) => void;
  isDemoMode: boolean;
}
```
- **States:** Default (closed), Hover (`bg-surface-container-high`), Open (select list overlay), Read-only.
- **Safety Indicator:** Always appends an explicit yellow badge: `[DEMO WORKSPACE — SYNTHETIC DATA (NOT CERTIFIED CALIBRATION)]`.

---

## 2. Provenance Badges & Trust Labels

### 2.1 `DataProvenanceBadge`
```typescript
type ProvenanceType = 
  | 'SOURCE_VERIFIED' 
  | 'AI_INFERRED' 
  | 'HUMAN_REVIEWED' 
  | 'CALCULATED_RISK' 
  | 'PROPOSED_ACTION' 
  | 'DEMO_SYNTHETIC';

interface DataProvenanceBadgeProps {
  type: ProvenanceType;
  label?: string;
  sublabel?: string;
  tooltipText?: string;
  size?: 'sm' | 'md';
}
```
- **Render Specifications:**
  - `SOURCE_VERIFIED`: Green badge (`bg-emerald-950/40 text-emerald-400 border border-emerald-500/30`), e.g., `[SOURCE VERIFIED • GEOTAGGED]`.
  - `AI_INFERRED`: Yellow/Amber badge (`bg-amber-950/40 text-amber-400 border border-amber-500/30`), e.g., `[AI INFERRED • ESTIMATED APERTURE]`.
  - `HUMAN_REVIEWED`: Sky blue badge (`bg-sky-950/40 text-sky-400 border border-sky-500/30`), e.g., `[HUMAN REVIEWED FINDING]`.
  - `CALCULATED_RISK`: Red badge (`bg-red-950/40 text-red-400 border border-red-500/30`), e.g., `[CALCULATED PROJECT RISK]`.
  - `PROPOSED_ACTION`: Gold badge (`bg-yellow-950/40 text-yellow-400 border border-yellow-500/30`), e.g., `[PROPOSED MITIGATION]`.

---

## 3. KPI & Decision Summary Cards

### 3.1 `EngineeringKpiCard`
```typescript
interface EngineeringKpiCardProps {
  title: string;
  provenance: ProvenanceType;
  primaryValue: string | number;
  unit?: string;
  statusType: 'normal' | 'warning' | 'critical' | 'positive';
  subDescription: string;
  targetBaselineLabel?: string;
  targetBaselineValue?: string;
  sparklineData?: number[];
  progressPercent?: number;
}
```
- **Example Usage in Overview:**
  - Critical Path Variance: `-4 Days` (`[CALCULATED]`, Status: `critical`, Sub: "Span 18-19 Precast Launch Blocked").
  - Material Reconciled: `94.2%` (`[SOURCE VERIFIED]`, Status: `positive`, Sub: "Within ±6% band, 3,410 MT / 3,620 MT").
  - Budget Variance: `-₹4.85 L` (`[CALCULATED]`, Status: `normal`, Sub: "Under Tender Baseline Margin").
  - Open Priority Findings: `7 Active` (`[AWAITING REVIEW]`, Status: `warning`, Sub: "2 Structural, 3 Safety, 2 QA Hold").

---

## 4. Evidence Graph Components

### 4.1 `CausalTopologyGraph`
```typescript
interface GraphNode {
  id: string;
  tier: 1 | 2 | 3 | 4 | 5; // 1: Source, 2: AI Finding, 3: Risk, 4: CPM Impact, 5: Mitigation
  provenance: ProvenanceType;
  title: string;
  codeReference?: string;
  metrics: Record<string, string>;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  isSelected?: boolean;
}

interface GraphEdge {
  fromNodeId: string;
  toNodeId: string;
  label: string; // e.g., "Extracted via Optical CV Pipeline", "Triggers Contractual Non-Conformance"
  isCriticalPath: boolean;
}

interface CausalTopologyGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  filterMode: 'ALL' | 'CRITICAL_PATH_ONLY' | 'SOURCE_EVIDENCE' | 'MITIGATIONS';
  onSelectNode: (nodeId: string) => void;
  onFilterChange: (mode: string) => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
}
```

### 4.2 `GraphInspectorDrawer`
```typescript
interface GraphInspectorDrawerProps {
  node: GraphNode | null;
  onClose: () => void;
  onLaunchSimulator: (findingId: string) => void;
  onOpenWorkbench: (findingId: string) => void;
}
```
- **Tabs:** `Details`, `Provenance (3 Citations)`, `Code Limits (IRC:112 / IS:456)`.
- **Action Buttons:** Yellow primary button `Launch What-If Scenario with FND-104`, secondary `Open in Inspection Workbench`.

---

## 5. Inspection Metrology & Triage Components

### 5.1 `PhotogrammetricMetrologyViewport`
```typescript
interface InspectionOverlayProps {
  imageUrl: string;
  coordinates: { x: number; y: number; z: number };
  fovAngle: number;
  gsdMmPerPx: number;
  reticleBounds: { top: number; left: number; width: number; height: number };
  detectedAnomaly: {
    id: string;
    estimatedApertureMm: number;
    uncertaintyMm: number;
    angleDegrees: number;
    confidencePercent: number;
  };
  filterMode: 'NORMAL' | 'EDGE_CONTRAST' | 'INVERT' | 'BIM_GRID';
  onFilterToggle: (mode: string) => void;
}
```
- **Telemetry HUD Overlays:** Calibrated reticle box with `ZONE A-01 [ESTIMATED APERTURE: 0.35mm ±0.05mm]`, inclination vector `42°`, and 1:10 scale bar (`0 to 100mm`).

### 5.2 `ResidentReviewerDispositionForm`
```typescript
interface ReviewerDispositionFormProps {
  findingId: string;
  activeDisposition: 'CONFIRM_NCR' | 'DOWNGRADE_SHRINKAGE' | 'REJECT_ARTIFACT';
  onChangeDisposition: (val: 'CONFIRM_NCR' | 'DOWNGRADE_SHRINKAGE' | 'REJECT_ARTIFACT') => void;
  engineerNotes: string;
  onChangeNotes: (notes: string) => void;
  signerCredentials: {
    name: string;
    licenseId: string;
    timestamp: string;
  };
  onSubmitProtocol: () => void;
  isSubmitting: boolean;
}
```

---

## 6. What-If Simulator & Decision Matrix Components

### 6.1 `ScenarioComparisonMatrix`
- Compares **Baseline (Full Recast / Idling)** vs **Scenario B (CFRP Fast-Track Wrap)**.
- **Metrics Displayed:**
  - Schedule Recovery: `+18 Days` vs `+3 Days` (`+15 Days Recovered`, 83.3% window compression).
  - Financial Delta: `₹20,30,000` gross exposure vs `₹5,50,000` scenario cost (`₹14.80 Lakhs Net Calculated Avoidance`).
  - Structural Feasibility: Shear retention `94.2%`, Client Risk `LOW`, Design Life `50+ Years`.

### 6.2 `ParametricInputControls`
- `Gantry Idling Rate`: `₹1,50,000 / Calendar Day` (Editable numeric stepper).
- `CFRP Curing Period`: Radio pill group `[36 Hours]` | `[48 Hours (Spec)]` | `[72 Hours (Conserv.)]`.
- `Independent Engineer Review SLA`: `24 Hours`.
- Recalculate CTA: `Recalculate Dynamic Trajectory` with live loading spinner state.

### 6.3 `BaselineCommitmentModal`
```typescript
interface BaselineCommitmentModalProps {
  isOpen: boolean;
  scenarioName: string;
  netScheduleVarianceDays: number;
  netCostSavingsInr: number;
  onConfirmCommit: () => void;
  onCancel: () => void;
}
```
- **Explicit Safety Safeguard:** Requires two-step confirmation before writing back to the master working baseline, with disclaimer: *"Committing this scenario updates downstream working buffers. Does not overwrite certified master P6 baseline without Project Director approval."*
