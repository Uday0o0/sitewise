import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DailySiteBriefingCard } from '../components/DailySiteBriefingCard';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockBriefingResponse = {
  project_id: 'PRJ-NH48-PKG3',
  project_name: 'NH-48 Elevated Expressway Package 3',
  chainage_range: 'Ch. 14+000 to Ch. 22+500',
  generated_at_iso: '2026-10-24T03:00:00Z',
  shift: 'DAY_SHIFT',
  daily_activity: 'Pier 18 Cap Concreting & Prestressing Duct Inspection',
  workforce_count: 24,
  site_conditions: 'Elevated staging on Pier 18, highway traffic flowing beneath on NH-48',
  weather_advisory: {
    status: 'High Wind Warning (>35 km/h gusts)',
    risk_factor: 'HIGH',
  },
  daily_task_breakdown: [
    {
      sequence: 1,
      task_name: 'Pier 18 Prestressing Duct Alignment Audit',
      trade: 'Quality Surveyors & PT Specialists',
      duration_hours: 2.5,
      safety_criticality: 'CRITICAL',
      instructions: 'Laser check duct profiling against approved shop drawing Rev-04 before closing side shutter.',
    },
    {
      sequence: 2,
      task_name: 'High-Strength Concrete Pour (M-60 Self-Compacting)',
      trade: 'Concreting Gang & Transit Mixer Operators',
      duration_hours: 4.0,
      safety_criticality: 'HIGH',
      instructions: 'Maintain pour rate at max 1.2m/hr to prevent bursting pressure on formwork.',
    },
  ],
  required_materials_and_equipment: [
    {
      item_name: 'M-60 Grade SCC Concrete',
      category: 'MATERIAL',
      quantity_estimate: '48 cu.m (6 Transit Mixers)',
      specification_code: 'IRC 112 / IS 456 Table 2',
      provenance: 'PROJECT_SPEC',
    },
    {
      item_name: 'Boom Placer 36m & Concrete Pump',
      category: 'EQUIPMENT',
      quantity_estimate: '1 Unit on Pier 18 Access Bay',
      specification_code: 'IS 4926-2003',
      provenance: 'PLANT_REGISTRY',
    },
  ],
  safety_precautions_and_checklist: [
    {
      check_id: 'CHK-01',
      category: 'Fall Protection',
      checkpoint_description: 'Double lanyard full body harness anchor points verified on Pier 18 staging.',
      standard_reference: 'IS 3521 / OSHA 1926.502',
      is_mandatory: true,
    },
  ],
  risk_alerts: [
    {
      alert_id: 'ALT-FND-104',
      severity: 'HIGH',
      title: 'Active Finding FND-104 on Pier 18 Pier Cap',
      description: 'Prestressing duct alignment displaced by 12mm beyond tolerance limit.',
      source_record_type: 'FINDING',
      source_record_id: 'FND-104',
      deep_link_url: '/inspections/FND-104',
      provenance: 'FINDING_TELEMETRY',
    },
  ],
  source_citations: [],
  provenance: 'PROJECT_GROUNDED',
  is_empty_project: false,
  summary: 'Day shift briefing focusing on Pier 18 concrete pour with active quality hold on tendon duct alignment.',
  disclaimer: 'Generated from live telemetry and engineering records. Field supervisor sign-off mandatory.',
};

describe('DailySiteBriefingCard (Activity 4.1 / Assistant)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders briefing configuration and loads daily action plan on mount', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockBriefingResponse,
    } as unknown as Response);

    render(
      <MemoryRouter>
        <DailySiteBriefingCard projectId="PRJ-NH48-PKG3" />
      </MemoryRouter>
    );

    // Initial loading indicator
    expect(screen.getByText(/Compiling project records and safety rules/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
      expect(screen.getByText('NH-48 Elevated Expressway Package 3')).toBeInTheDocument();
      expect(screen.getByText(/Ch. 14\+000 to Ch. 22\+500/i)).toBeInTheDocument();
    });

    // Verify task breakdown rendered
    expect(screen.getByText(/Pier 18 Prestressing Duct Alignment Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/High-Strength Concrete Pour/i)).toBeInTheDocument();

    // Verify materials and checklist rendered
    expect(screen.getByText(/M-60 Grade SCC Concrete/i)).toBeInTheDocument();
    expect(screen.getByText(/Double lanyard full body harness anchor points/i)).toBeInTheDocument();

    // Verify risk alert rendered
    expect(screen.getByText(/Active Finding FND-104 on Pier 18 Pier Cap/i)).toBeInTheDocument();
  });

  it('navigates to finding workbench when clicking inspect record button', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockBriefingResponse,
    } as unknown as Response);

    render(
      <MemoryRouter>
        <DailySiteBriefingCard projectId="PRJ-NH48-PKG3" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Active Finding FND-104/i)).toBeInTheDocument();
    });

    const inspectBtn = screen.getByRole('button', { name: /Inspect Record/i });
    fireEvent.click(inspectBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/inspections/FND-104');
  });

  it('updates form controls and triggers refreshed briefing request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockBriefingResponse,
    } as unknown as Response);

    render(
      <MemoryRouter>
        <DailySiteBriefingCard projectId="PRJ-NH48-PKG3" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('NH-48 Elevated Expressway Package 3')).toBeInTheDocument();
    });

    // Select Night Shift
    const shiftSelect = screen.getByDisplayValue(/Day Shift/i);
    fireEvent.change(shiftSelect, { target: { value: 'NIGHT_SHIFT' } });

    // Click quick preset button
    const presetBtn = screen.getByText(/Span 18-19 Segment Launching & Gantry Erection/i);
    fireEvent.click(presetBtn);

    // Click Generate Daily Briefing
    const generateBtn = screen.getByRole('button', { name: /Generate Daily Briefing/i });
    fireEvent.click(generateBtn);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v4/projects/PRJ-NH48-PKG3/assistant/daily-briefing',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('NIGHT_SHIFT'),
      })
    );
  });

  it('handles server failure with informative error alert', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ detail: 'LLM Assistant Gateway Unreachable' }),
    } as unknown as Response);

    render(
      <MemoryRouter>
        <DailySiteBriefingCard projectId="PRJ-NH48-PKG3" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Briefing Compilation Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to generate briefing \(HTTP 503\)/i)).toBeInTheDocument();
    });
  });

  it('renders safely when risk alerts and weather advisory are absent', async () => {
    const minimalBriefing = {
      ...mockBriefingResponse,
      weather_advisory: undefined,
      risk_alerts: [],
      daily_task_breakdown: [],
      required_materials_and_equipment: [],
      safety_precautions_and_checklist: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => minimalBriefing,
    } as unknown as Response);

    render(
      <MemoryRouter>
        <DailySiteBriefingCard projectId="PRJ-EMPTY" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('NH-48 Elevated Expressway Package 3')).toBeInTheDocument();
    });

    // Ensure no crash and alerts section is omitted
    expect(screen.queryByText(/Active Project Record Alerts/i)).not.toBeInTheDocument();
  });
});
