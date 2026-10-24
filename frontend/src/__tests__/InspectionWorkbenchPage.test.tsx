import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InspectionWorkbenchPage } from '../pages/InspectionWorkbenchPage';
import { api } from '../api/client';
import type {
  InspectionTelemetryResponse,
  FindingListItem,
  FindingAnalysisResponse,
  FindingEvidenceLinksListResponse,
  DispositionUpdateResponse,
} from '../types/api';

const mockTelemetryData: InspectionTelemetryResponse = {
  findingId: 'FND-104',
  graphId: 'GR-FND104',
  assetChainage: 'Ch. 14+320',
  structureElement: 'Pier Cap 18 Cantilever Downstream Face',
  captureSource: {
    flightId: 'UAV-NH48-FL-088',
    lens: '45mm f/2.8 Prime',
    gsdMmPerPx: 0.8,
    capturedAt: '2026-10-20T09:30:00Z',
    coordinates: { x: 28.4595, y: 77.0266, z: 242.5 },
  },
  photogrammetricMetrology: {
    imageUrl: '',
    calibratedApertureMm: 0.35,
    apertureToleranceMarginMm: 0.05,
    permissibleThresholdMm: 0.2,
    governingCode: 'IRC:112-2020 Clause 12.3',
    exceedancePercent: 75.0,
    linearTraceLengthMm: 420.0,
    shearVectorAngleDegrees: 42.0,
    inferredDepthMm: 18.5,
    inferredRootMechanism: 'Diagonal shear propagation from pier cap cantilever hogging moment',
  },
  ndtCorroboration: [
    {
      protocolName: 'Ultrasonic Pulse Velocity (UPV)',
      status: 'PASS',
      details: 'Direct transmission across Pier Cap 18 recorded pulse velocity 4,250 m/s (Grade M-50 compliant).',
      provenance: 'SOURCE_VERIFIED',
      sourceDocumentId: 'DOC-NDT-UPV-042',
    },
  ],
  reviewerDispositionState: {
    currentStatus: 'AWAITING_REVIEW',
    pkiCertificateValid: true,
  },
};

const mockFindingsList: FindingListItem[] = [
  {
    id: 'FND-104',
    title: 'Pier Cap 18 Crack — Transverse Propagation',
    structureElement: 'Pier Cap 18 Cantilever Downstream Face',
    chainageFormatted: 'Ch. 14+320',
    provenance: 'AI_INFERRED',
    category: 'structural',
    dispositionStatus: 'AWAITING_REVIEW',
    isUploaded: false,
  },
];

const mockAnalysisData: FindingAnalysisResponse = {
  findingId: 'FND-104',
  imageId: 'IMG-104-SYN',
  analysisId: 'ANL-FND-104',
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  algorithm: {
    name: 'SYNTHETIC_SVG_CALIBRATION',
    version: '2.0.0',
  },
  status: 'COMPLETED',
  hasCandidate: true,
  pixelMetrics: {
    areaPx: 3360,
    traceLengthPx: 525.0,
    meanAperturePx: 0.44,
    maxAperturePx: 0.55,
  },
  physicalMetrics: {
    calibratedApertureMm: 0.35,
    linearTraceLengthMm: 420.0,
  },
  calibration: {
    isCalibrated: true,
    gsdMmPerPx: 0.8,
    provenance: 'USER_PROVIDED_UNVERIFIED',
    note: 'Synthetic orthomosaic benchmark',
  },
  crackSummary: {
    status: 'Potential crack-like regions detected',
    candidateCount: 1,
    candidateCountLabel: '1 candidate region',
    imageResolution: '1920 × 1080 px',
    isCalibrated: true,
    explanation: 'Detected 1 primary crack candidate spanning 420mm along Pier 18 cantilever face.',
    preliminaryReviewNotice: 'Human review required',
    calibrationProvenance: 'USER_PROVIDED_UNVERIFIED',
    calibrationNote: 'Benchmark calibration',
    candidates: [],
  },
  imageMetadata: {
    width: 1920,
    height: 1080,
    channels: 3,
    colorMode: 'RGB',
    fileSizeBytes: 1048576,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    mimeType: 'image/svg+xml',
    originalFilename: 'synthetic_pier18.svg',
  },
  imageUrl: '',
  disclaimer: 'IMAGE-PROCESSING CANDIDATE — HUMAN REVIEW REQUIRED',
  limitations: 'Physical confirmation required.',
  createdAt: '2026-10-24T03:00:00Z',
};

const mockEvidenceLinks: FindingEvidenceLinksListResponse = {
  findingId: 'FND-104',
  projectId: 'PRJ-NH48-PKG3',
  totalLinks: 1,
  links: [
    {
      id: 'EV-LINK-001',
      projectId: 'PRJ-NH48-PKG3',
      findingId: 'FND-104',
      documentId: 'DOC-NDT-UPV-042',
      documentTitle: 'Ultrasonic Pulse Velocity Test Calibration Report',
      passageId: 1,
      pageNumber: 14,
      citationText: 'Direct UPV reading of 4250 m/s confirms concrete matrix homogeneity.',
      relevanceNote: 'Corroborates sound concrete matrix behind surface crack.',
      provenance: 'PROJECT_SPEC',
      confidence: 0.94,
      createdAt: '2026-10-24T03:00:00Z',
    },
  ],
};

const mockDispositionSuccess: DispositionUpdateResponse = {
  findingId: 'FND-104',
  newStatus: 'CONFIRMED_NCR',
  protocolId: 'NCR-NH48-042',
  auditHash: '0xabc123456789deadbeef',
  message: 'Finding FND-104 escalated to Non-Conformance Report (NCR-NH48-042).',
};

describe('InspectionWorkbenchPage (Activity 1.2 / Inspection Workbench)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders inspection telemetry, metrology metrics, and crack candidate analysis', async () => {
    vi.spyOn(api, 'getFindingTelemetry').mockResolvedValue(mockTelemetryData);
    vi.spyOn(api, 'listFindings').mockResolvedValue(mockFindingsList);
    vi.spyOn(api, 'getFindingAnalysis').mockResolvedValue(mockAnalysisData);
    vi.spyOn(api, 'getFindingEvidenceLinks').mockResolvedValue(mockEvidenceLinks);

    render(
      <MemoryRouter initialEntries={['/inspections/FND-104']}>
        <InspectionWorkbenchPage />
      </MemoryRouter>
    );

    // Initial loading indicator
    expect(screen.getByText(/Loading inspection telemetry/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Inspection Workbench')).toBeInTheDocument();
      expect(screen.getAllByText('FND-104').length).toBeGreaterThan(0);
      expect(screen.getByTestId('crack-candidate-count')).toHaveTextContent(/1 potential crack-like region/i);
    });

    // Verify metrology aperture & exceedance
    expect(screen.getByText(/0.35 mm/i)).toBeInTheDocument();
    expect(screen.getByText(/\+75%/i)).toBeInTheDocument();

    // Verify evidence links and NDT corroboration
    expect(screen.getByText(/Ultrasonic Pulse Velocity \(UPV\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Ultrasonic Pulse Velocity Test Calibration Report/i)).toBeInTheDocument();
  });

  it('validates mandatory engineering notes before submitting reviewer disposition', async () => {
    vi.spyOn(api, 'getFindingTelemetry').mockResolvedValue(mockTelemetryData);
    vi.spyOn(api, 'listFindings').mockResolvedValue(mockFindingsList);
    vi.spyOn(api, 'getFindingAnalysis').mockResolvedValue(mockAnalysisData);
    vi.spyOn(api, 'getFindingEvidenceLinks').mockResolvedValue(mockEvidenceLinks);
    const updateSpy = vi.spyOn(api, 'updateDisposition').mockResolvedValue(mockDispositionSuccess);

    render(
      <MemoryRouter initialEntries={['/inspections/FND-104']}>
        <InspectionWorkbenchPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Inspection Workbench')).toBeInTheDocument();
    });

    // Attempt to submit with empty notes
    const submitBtn = screen.getByRole('button', { name: /SIGN & ISSUE/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Mandatory engineering justification required/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    // Fill in justification notes
    const textarea = screen.getByPlaceholderText(/Enter technical justification based on image array evidence/i);
    fireEvent.change(textarea, {
      target: { value: 'Crack aperture of 0.35mm exceeds IRC 112 0.20mm limit. Verified via UPV.' },
    });

    // Select Downgrade disposition option
    const downgradeRadio = screen.getByLabelText(/Downgrade to Shrinkage Crack/i);
    fireEvent.click(downgradeRadio);

    // Submit disposition
    const updatedSubmitBtn = screen.getByRole('button', { name: /SIGN & ISSUE/i });
    fireEvent.click(updatedSubmitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('FND-104', {
        disposition: 'DOWNGRADE_SHRINKAGE',
        engineerNotes: 'Crack aperture of 0.35mm exceeds IRC 112 0.20mm limit. Verified via UPV.',
        signerName: 'Demo Resident Engineer',
        signerLicenseId: 'RE-2024-DEMO',
      });
      expect(screen.getByText(/Finding FND-104 escalated to Non-Conformance Report/i)).toBeInTheDocument();
    });
  });

  it('toggles reticle visibility and filter modes without crashing', async () => {
    vi.spyOn(api, 'getFindingTelemetry').mockResolvedValue(mockTelemetryData);
    vi.spyOn(api, 'listFindings').mockResolvedValue(mockFindingsList);
    vi.spyOn(api, 'getFindingAnalysis').mockResolvedValue(mockAnalysisData);
    vi.spyOn(api, 'getFindingEvidenceLinks').mockResolvedValue(mockEvidenceLinks);

    render(
      <MemoryRouter initialEntries={['/inspections/FND-104']}>
        <InspectionWorkbenchPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Inspection Workbench')).toBeInTheDocument();
    });

    // Toggle reticle button
    const reticleBtn = screen.getByRole('button', { name: /RETICLE/i });
    fireEvent.click(reticleBtn);

    // Toggle filter modes
    const edgeBtn = screen.getByRole('button', { name: /EDGE/i });
    fireEvent.click(edgeBtn);

    const invertBtn = screen.getByRole('button', { name: /INVERT/i });
    fireEvent.click(invertBtn);

    const normalBtn = screen.getByRole('button', { name: /NORMAL/i });
    fireEvent.click(normalBtn);
  });

  it('handles telemetry loading error and provides recovery button', async () => {
    vi.spyOn(api, 'getFindingTelemetry').mockRejectedValue(new Error('Telemetry server unavailable'));
    vi.spyOn(api, 'listFindings').mockResolvedValue(mockFindingsList);

    render(
      <MemoryRouter initialEntries={['/inspections/FND-999']}>
        <InspectionWorkbenchPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to load inspection telemetry/i)).toBeInTheDocument();
      expect(screen.getByText(/Telemetry server unavailable/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Return to Seeded Baseline \(FND-104\)/i })).toBeInTheDocument();
    });
  });

  it('renders safely when finding has no corroborating NDT tests or evidence links', async () => {
    const minimalTelemetry: InspectionTelemetryResponse = {
      ...mockTelemetryData,
      ndtCorroboration: [],
    };

    vi.spyOn(api, 'getFindingTelemetry').mockResolvedValue(minimalTelemetry);
    vi.spyOn(api, 'listFindings').mockResolvedValue(mockFindingsList);
    vi.spyOn(api, 'getFindingAnalysis').mockResolvedValue({
      ...mockAnalysisData,
      hasCandidate: false,
      crackSummary: {
        ...mockAnalysisData.crackSummary!,
        status: 'No candidates detected',
        candidateCount: 0,
        candidateCountLabel: '0 candidate regions',
        isCalibrated: false,
        explanation: 'No candidates detected',
        candidates: [],
      },
    });
    vi.spyOn(api, 'getFindingEvidenceLinks').mockResolvedValue({ findingId: 'FND-104', projectId: 'PRJ-NH48-PKG3', totalLinks: 0, links: [] });

    render(
      <MemoryRouter initialEntries={['/inspections/FND-104']}>
        <InspectionWorkbenchPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No corroborating NDT tests logged for this uploaded finding/i)).toBeInTheDocument();
      expect(screen.getByTestId('crack-candidate-count')).toHaveTextContent(/No candidates detected/i);
    });
  });

  it('handles uncalibrated state by displaying warning and suspending physical exceedance evaluation', async () => {
    const uncalibratedTelemetry: InspectionTelemetryResponse = {
      ...mockTelemetryData,
      findingId: 'FND-UPL-001',
      photogrammetricMetrology: {
        ...mockTelemetryData.photogrammetricMetrology,
        calibratedApertureMm: 0,
        linearTraceLengthMm: 0,
        governingCode: 'Uncalibrated — Pixel Space Only (Evaluation Suspended)',
        exceedancePercent: 0.0,
      },
    };

    const uncalibratedAnalysis: FindingAnalysisResponse = {
      ...mockAnalysisData,
      findingId: 'FND-UPL-001',
      algorithm: {
        name: 'OPENCV_BLACKHAT_CRACK_CANDIDATE',
        version: '1.2.0',
      },
      calibration: {
        isCalibrated: false,
        gsdMmPerPx: undefined,
        provenance: 'USER_PROVIDED_UNVERIFIED',
        note: 'Uncalibrated field upload',
      },
      crackSummary: {
        ...mockAnalysisData.crackSummary!,
        isCalibrated: false,
        explanation: 'Image processing candidate detected in uncalibrated field image.',
      },
    };

    const uncalFindingsList: FindingListItem[] = [
      {
        id: 'FND-UPL-001',
        title: 'Pier 18 Field Upload',
        structureElement: 'Pier Cap 18 Cantilever Downstream Face',
        chainageFormatted: 'Ch. 14+320',
        provenance: 'AI_INFERRED',
        category: 'structural',
        dispositionStatus: 'AWAITING_REVIEW',
        isUploaded: true,
      },
    ];

    vi.spyOn(api, 'getFindingTelemetry').mockResolvedValue(uncalibratedTelemetry);
    vi.spyOn(api, 'listFindings').mockResolvedValue(uncalFindingsList);
    vi.spyOn(api, 'getFindingAnalysis').mockResolvedValue(uncalibratedAnalysis);
    vi.spyOn(api, 'getFindingEvidenceLinks').mockResolvedValue(mockEvidenceLinks);

    render(
      <MemoryRouter initialEntries={['/inspections/FND-UPL-001']}>
        <InspectionWorkbenchPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Physical Dimensions Unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/Pixel dimensions cannot be converted to physical units/i)).toBeInTheDocument();
      expect(screen.getByText(/Code limit & exceedance evaluation suspended/i)).toBeInTheDocument();
      expect(screen.getByText('0.44 px')).toBeInTheDocument();
      expect(screen.getByText('0.55 px')).toBeInTheDocument();
    });
  });

  it('attaches specification citation when clicking ATTACH SPEC CITATION', async () => {
    vi.spyOn(api, 'getFindingTelemetry').mockResolvedValue(mockTelemetryData);
    vi.spyOn(api, 'listFindings').mockResolvedValue(mockFindingsList);
    vi.spyOn(api, 'getFindingAnalysis').mockResolvedValue(mockAnalysisData);
    vi.spyOn(api, 'getFindingEvidenceLinks').mockResolvedValue({ findingId: 'FND-104', projectId: 'PRJ-NH48-PKG3', totalLinks: 0, links: [] });
    const attachSpy = vi.spyOn(api, 'createFindingEvidenceLink').mockResolvedValue({
      id: 'EV-LINK-NEW',
      projectId: 'PRJ-NH48-PKG3',
      findingId: 'FND-104',
      documentId: 'DOC-57F675F71F',
      passageId: 1,
      pageNumber: 1,
      citationText: 'IRC:112-2020 Clause 12.3: Limit State of Cracking.',
      relevanceNote: 'Governing bridge design code permissible crack aperture limit (0.20mm).',
      provenance: 'HUMAN_REVIEWED',
      confidence: 0.98,
      createdAt: '2026-10-24T18:00:00Z',
    });

    render(
      <MemoryRouter initialEntries={['/inspections/FND-104']}>
        <InspectionWorkbenchPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('attach-spec-citation-btn')).toBeInTheDocument();
    });

    const attachBtn = screen.getByTestId('attach-spec-citation-btn');
    fireEvent.click(attachBtn);

    await waitFor(() => {
      expect(attachSpy).toHaveBeenCalledWith('FND-104', expect.objectContaining({
        documentId: 'DOC-57F675F71F',
        provenance: 'HUMAN_REVIEWED',
      }));
    });
  });

  it('opens NDT modal and logs new NDT corroboration protocol', async () => {
    vi.spyOn(api, 'getFindingTelemetry').mockResolvedValue(mockTelemetryData);
    vi.spyOn(api, 'listFindings').mockResolvedValue(mockFindingsList);
    vi.spyOn(api, 'getFindingAnalysis').mockResolvedValue(mockAnalysisData);
    vi.spyOn(api, 'getFindingEvidenceLinks').mockResolvedValue(mockEvidenceLinks);
    const addNdtSpy = vi.spyOn(api, 'addNdtCorroboration').mockResolvedValue({
      ...mockTelemetryData,
      ndtCorroboration: [
        ...(mockTelemetryData.ndtCorroboration || []),
        {
          protocolName: 'Rebound Hammer Test (IS:13311)',
          status: 'PASS',
          details: 'Rebound index of 38 measured across pier cap cantilever face.',
          provenance: 'HUMAN_REVIEWED',
          sourceDocumentId: 'DOC-NDT-RH-001',
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/inspections/FND-104']}>
        <InspectionWorkbenchPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-ndt-protocol-btn')).toBeInTheDocument();
    });

    // Click button to open modal
    fireEvent.click(screen.getByTestId('add-ndt-protocol-btn'));

    // Modal drawer should be open
    expect(screen.getByText('Log Corroborating NDT Protocol')).toBeInTheDocument();

    // Fill in observations textarea
    const textarea = screen.getByPlaceholderText(/Ultrasonic pulse velocity measured 3,850 m\/s/i);
    fireEvent.change(textarea, { target: { value: 'Rebound index of 38 measured across pier cap cantilever face.' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save NDT Protocol/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(addNdtSpy).toHaveBeenCalledWith('FND-104', expect.objectContaining({
        status: 'PASS',
        details: 'Rebound index of 38 measured across pier cap cantilever face.',
        provenance: 'HUMAN_REVIEWED',
      }));
    });
  });
});
