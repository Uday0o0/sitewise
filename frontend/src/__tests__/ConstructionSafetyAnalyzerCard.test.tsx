import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConstructionSafetyAnalyzerCard } from '../components/ConstructionSafetyAnalyzerCard';

const mockSafetyResult = {
  project_id: 'PRJ-NH48-PKG3',
  status: 'COMPLETED',
  provenance: 'AI_INFERRED',
  image_metadata: {
    width: 1920,
    height: 1080,
    channels: 3,
    format: 'JPEG',
    file_size_bytes: 2048500,
    mean_luminance: 142.5,
    is_poor_lighting: false,
    highvis_pixel_ratio: 0.045,
    edge_clutter_density: 0.18,
  },
  overall_risk_level: 'HIGH' as const,
  ppe_compliance: {
    helmets_compliant: false,
    vests_compliant: true,
    violations: ['Worker without hard hat on elevated platform'],
    observations: 'Worker observed near pier edge without chin strap fastened on helmet.',
  },
  worker_hazards: [
    {
      hazard_type: 'CRANE_RADIUS',
      description: 'Worker standing within 3m swing radius of crawler crane counterweight.',
      severity: 'HIGH',
    },
  ],
  scaffolding_fall_risks: [
    {
      hazard_type: 'MISSING_TOEBOARD',
      description: 'Scaffolding bay 3 missing standard 150mm toeboard and mid-rail.',
      severity: 'CRITICAL',
    },
  ],
  environmental_risks: [],
  corrective_actions: [
    'Enforce 100% hard hat compliance before lifting operations resume.',
    'Install missing toeboard and mid-rail on Scaffolding Bay 3 immediately.',
    'Demarcate crawler crane swing perimeter with high-vis warning tape.',
  ],
  applicable_standards: [
    { code: 'IS 2925', clause: 'Industrial Safety Helmets specifications' },
    { code: 'OSHA 1926.451', clause: 'Scaffold fall protection requirements' },
    { code: 'BOCW Act 1996', clause: 'Section 40 safety officer directives' },
  ],
  processing_time_ms: 384,
  uncertainty_disclaimer: 'AI hazard screening is not certified proof of site safety. Mandatory safety officer sign-off required under BOCW Act 1996.',
};

describe('ConstructionSafetyAnalyzerCard (Activity 2.1)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-image-url');
    } else {
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-image-url');
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders initial idle state before any photo is uploaded', () => {
    render(<ConstructionSafetyAnalyzerCard projectId="PRJ-NH48-PKG3" />);

    expect(screen.getByText(/Construction Safety & PPE Inspection/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready for Safety Inspection/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload construction site inspection photo/i)).toBeInTheDocument();

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Construction Safety/i });
    expect(analyzeBtn).toBeDisabled();
  });

  it('enables analyze button when file is selected and renders safety results on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSafetyResult,
    } as unknown as Response);

    const { container } = render(<ConstructionSafetyAnalyzerCard projectId="PRJ-NH48-PKG3" />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const mockFile = new File(['dummy-image-binary'], 'pier_cap_scaffold.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // File name is displayed
    expect(screen.getByText('pier_cap_scaffold.jpg')).toBeInTheDocument();

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Construction Safety/i });
    expect(analyzeBtn).not.toBeDisabled();

    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
      expect(screen.getByText(/HIGH RISK/i)).toBeInTheDocument();
      expect(screen.getByText(/PPE Compliance Audit/i)).toBeInTheDocument();
      expect(screen.getByText(/Worker standing within 3m swing radius/i)).toBeInTheDocument();
      expect(screen.getByText(/Scaffolding bay 3 missing standard 150mm toeboard/i)).toBeInTheDocument();
      expect(screen.getByText(/Mandatory Corrective Action Checklist/i)).toBeInTheDocument();
      expect(screen.getByText(/Enforce 100% hard hat compliance/i)).toBeInTheDocument();
    });

    // Check standards benchmark rendered
    expect(screen.getByText(/IS 2925:/i)).toBeInTheDocument();
  });

  it('handles API error response properly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Uploaded image too blurry for CV analysis.' }),
    } as unknown as Response);

    const { container } = render(<ConstructionSafetyAnalyzerCard projectId="PRJ-NH48-PKG3" />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const mockFile = new File(['blurry'], 'blurry.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Construction Safety/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Uploaded image too blurry for CV analysis/i)).toBeInTheDocument();
    });
  });

  it('handles unexpected network failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network connection dropped'));

    const { container } = render(<ConstructionSafetyAnalyzerCard projectId="PRJ-NH48-PKG3" />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const mockFile = new File(['data'], 'site.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Construction Safety/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Network connection dropped/i)).toBeInTheDocument();
    });
  });

  it('handles result with empty hazard lists without crashing', async () => {
    const cleanSiteResult = {
      ...mockSafetyResult,
      overall_risk_level: 'LOW' as const,
      worker_hazards: [],
      scaffolding_fall_risks: [],
      ppe_compliance: {
        helmets_compliant: true,
        vests_compliant: true,
        violations: [],
        observations: 'All workers observed in complete PPE compliance.',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => cleanSiteResult,
    } as unknown as Response);

    const { container } = render(<ConstructionSafetyAnalyzerCard projectId="PRJ-CLEAN" />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const mockFile = new File(['data'], 'clean.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Construction Safety/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/LOW RISK/i)).toBeInTheDocument();
      expect(screen.getByText(/No direct worker proximity conflicts detected in frame/i)).toBeInTheDocument();
      expect(screen.getByText(/No unprotected edge or scaffolding failures detected in frame/i)).toBeInTheDocument();
    });
  });
});
