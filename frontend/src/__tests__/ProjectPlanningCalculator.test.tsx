import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectPlanningCalculator } from '../components/ProjectPlanningCalculator';

const mockValidPlanResponse = {
  project_id: 'PRJ-NH48-PKG3',
  generated_at_iso: '2026-10-24T03:00:00Z',
  input_parameters: { plot_area_sqft: 1500, floors: 2 },
  built_up_area_sqft: 2100.0,
  carpet_area_approx_sqft: 1680.0,
  materials_takeoff: [
    {
      material_code: 'CEMENT-OPC53',
      material_name: 'Ordinary Portland Cement Grade 53',
      quantity: 840,
      unit: 'Bags',
      consumption_ratio_description: '0.4 bags per sq.ft built-up area',
      estimated_rate_inr: 420.0,
      estimated_cost_inr: 352800.0,
      standard_reference: 'IS 456 / CPWD DSR 2023 Cl. 4.1',
      provenance: 'CALCULATED',
    },
    {
      material_code: 'STEEL-FE550D',
      material_name: 'High-Yield Thermo-Mechanically Treated Steel Rebar',
      quantity: 8.4,
      unit: 'MT',
      consumption_ratio_description: '4.0 kg per sq.ft built-up area',
      estimated_rate_inr: 68000.0,
      estimated_cost_inr: 571200.0,
      standard_reference: 'IS 1786 / IRC 112 Cl. 6.2',
      provenance: 'CALCULATED',
    },
  ],
  cost_breakdown: [
    {
      category: 'Substructure & Foundations',
      description: 'Excavation, PCC, RCC footings and plinth beams',
      cost_inr: 735000.0,
      cost_inr_lakhs: 7.35,
      percentage_of_total: 21.0,
      cost_per_sqft_inr: 350.0,
    },
    {
      category: 'RCC Superstructure Frame',
      description: 'Columns, shear walls, deck slabs, and pier caps',
      cost_inr: 1470000.0,
      cost_inr_lakhs: 14.7,
      percentage_of_total: 42.0,
      cost_per_sqft_inr: 700.0,
    },
  ],
  total_estimated_cost_inr: 3500000.0,
  total_estimated_cost_inr_lakhs: 35.0,
  total_estimated_cost_inr_crores: 0.35,
  average_rate_per_sqft_inr: 1666.67,
  phase_schedule: [
    {
      phase_number: 1,
      phase_name: 'Site Prep & Substructure',
      start_week: 1,
      end_week: 6,
      duration_weeks: 6,
      key_milestones: ['Layout demarcation', 'Footing concreting'],
      critical_trade: 'Civil Earthwork & Bar Bending',
      deliverables: 'Plinth level completion',
    },
    {
      phase_number: 2,
      phase_name: 'RCC Superstructure Frame',
      start_week: 7,
      end_week: 16,
      duration_weeks: 10,
      key_milestones: ['Pier casting', 'Gantry setup'],
      critical_trade: 'Formwork & Prestressing',
      deliverables: 'Top deck casting',
    },
  ],
  total_project_duration_weeks: 24,
  total_project_duration_months: 6.0,
  assumptions_and_sources: [
    'CPWD Delhi Schedule of Rates (DSR) 2023 benchmark rates',
    'IS:456 minimum reinforcement and grade M-25 concrete norms',
  ],
  provenance: 'CALCULATED',
  disclaimer: 'Indicative civil engineering estimate. Tactile structural drawings required.',
};

describe('ProjectPlanningCalculator (Activity 3.1)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders initial form inputs, presets, and loads calculated plan automatically', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockValidPlanResponse,
    } as unknown as Response);

    render(<ProjectPlanningCalculator projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
      expect(screen.getByText(/Total Built-Up Area/i)).toBeInTheDocument();
      expect(screen.getByText(/Estimated Total Cost/i)).toBeInTheDocument();
      expect(screen.getAllByText(/35/i).length).toBeGreaterThan(0);
    });

    // Verify initial inputs exist by label text
    expect(screen.getByText(/Plot Length \(ft\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Plot Width \(ft\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Floors \(Stories\)/i)).toBeInTheDocument();

    // Check material items rendered
    expect(screen.getByText(/Ordinary Portland Cement Grade 53/i)).toBeInTheDocument();
    expect(screen.getByText(/High-Yield Thermo-Mechanically Treated Steel Rebar/i)).toBeInTheDocument();

    // Check cost heads
    expect(screen.getByText(/Substructure & Foundations/i)).toBeInTheDocument();
    expect(screen.getAllByText(/RCC Superstructure Frame/i).length).toBeGreaterThan(0);

    // Check phase schedule
    expect(screen.getByText(/Site Prep & Substructure/i)).toBeInTheDocument();
    expect(screen.getByText(/Plinth level completion/i)).toBeInTheDocument();
  });

  it('applies quick plot presets and recalculates plan upon button click', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockValidPlanResponse,
    } as unknown as Response);

    render(<ProjectPlanningCalculator projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(screen.getByText(/Total Built-Up Area/i)).toBeInTheDocument();
    });

    // Click on commercial preset
    const commercialPresetBtn = screen.getByText(/60x80 Commercial Office/i);
    fireEvent.click(commercialPresetBtn);

    // Click recalculate button
    const calcBtn = screen.getByRole('button', { name: /Calculate Project Plan/i });
    fireEvent.click(calcBtn);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v4/planning/generate-plan',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('handles API error response gracefully without crashing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Calculation engine temporarily unavailable' }),
    } as unknown as Response);

    render(<ProjectPlanningCalculator projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(screen.getByText(/Planning calculation failed \(HTTP 500\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Retry Planning Calculation/i)).toBeInTheDocument();
    });
  });

  it('handles unexpected network failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    render(<ProjectPlanningCalculator projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(screen.getByText(/Network connection timeout/i)).toBeInTheDocument();
    });
  });

  it('handles response with empty material or cost lists without crashing', async () => {
    const emptyPlanResponse = {
      ...mockValidPlanResponse,
      materials_takeoff: [],
      cost_breakdown: [],
      phase_schedule: [],
      assumptions_and_sources: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => emptyPlanResponse,
    } as unknown as Response);

    render(<ProjectPlanningCalculator projectId="PRJ-EMPTY" />);

    await waitFor(() => {
      expect(screen.getByText(/Total Built-Up Area/i)).toBeInTheDocument();
      expect(screen.getByText(/₹35/i)).toBeInTheDocument();
    });

    // Verify it doesn't crash on empty tables
    expect(screen.queryByText(/Ordinary Portland Cement/i)).not.toBeInTheDocument();
  });
});
