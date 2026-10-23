import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WeatherAdvisoryCard, type WeatherAdvisoryResponse } from '../components/WeatherAdvisoryCard';

const mockAdvisoryResponse: WeatherAdvisoryResponse = {
  project_id: 'PRJ-NH48-PKG3',
  activity: 'CONCRETE_POURING',
  activity_name: 'Structural Concrete Pouring (IS:456)',
  status: 'GO',
  summary: 'Favorable atmospheric conditions for structural concrete pour.',
  rationale: 'Ambient temperature 28°C and wind speed 14 km/h are within IS 456 Table 2 limits.',
  factors_considered: [
    {
      factor_name: 'Ambient Temperature',
      measured_value: '28.4 °C',
      threshold_rule: '5°C <= Temp <= 38°C (IS:456 Cl. 14.1)',
      impact: 'NORMAL',
      source_status: 'AUTHORITATIVE_CODE',
      source_reference: 'IS 456-2000 Clause 14.1',
    },
    {
      factor_name: 'Wind Speed',
      measured_value: '14.2 km/h',
      threshold_rule: 'Wind <= 25 km/h for uncontrolled plastic shrinkage',
      impact: 'LOW_RISK',
      source_status: 'AUTHORITATIVE_CODE',
      source_reference: 'IRC:112 Clause 13.4',
    },
  ],
  identified_risks: [
    'Moderate solar heat index expected after 13:00 hrs',
  ],
  precautions_and_mitigations: [
    'Apply wet hessian curing mats within 30 minutes of final trowel finish',
    'Ensure continuous water mist spray on pier cap',
  ],
  weather_metrics: {
    temperature_c: 28.4,
    relative_humidity_pct: 62.0,
    wind_speed_kmh: 14.2,
    wind_gusts_kmh: 18.5,
    precipitation_mm: 0.0,
    precipitation_probability_pct: 5,
    weather_condition: 'Partly Cloudy',
    is_forecast: false,
  },
  source_provider: 'Open-Meteo Weather API',
  retrieved_at_iso: '2026-10-24T03:30:00Z',
  freshness: 'LIVE_FEED',
  provenance: 'LIVE_TELEMETRY',
  missing_inputs: [],
  disclaimer: 'Advisory decisions are guidelines based on published codes. Field supervisor has final authority.',
};

const mockCautionResponse: WeatherAdvisoryResponse = {
  ...mockAdvisoryResponse,
  activity: 'CRANE_GANTRY_LAUNCHING',
  activity_name: 'Segment Launching Gantry (Wind Cutoff)',
  status: 'NO_GO',
  summary: 'CRITICAL WIND WARNING: Launching gantry operations suspended.',
  rationale: 'Wind gusts exceeding 35 km/h structural stability limit for elevated segment launching.',
  factors_considered: [
    {
      factor_name: 'Peak Wind Gusts',
      measured_value: '42.0 km/h',
      threshold_rule: 'Gusts <= 32 km/h for segment erection (MORTH §1500)',
      impact: 'CRITICAL',
      source_status: 'AUTHORITATIVE_CODE',
      source_reference: 'MORTH Section 1500',
    },
  ],
};

describe('WeatherAdvisoryCard (Activity 5.3 / Weather-Aware Advisory)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders initial weather advisory and telemetry on mount', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockAdvisoryResponse,
    } as unknown as Response);

    render(<WeatherAdvisoryCard projectId="PRJ-NH48-PKG3" />);

    // Initial loading indicator
    expect(screen.getByText(/Evaluating meteorological safety thresholds/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
      expect(screen.getByText(/GO — FAVORABLE CONDITIONS/i)).toBeInTheDocument();
      expect(screen.getByText(/Favorable atmospheric conditions for structural concrete pour/i)).toBeInTheDocument();
    });

    // Check weather metrics rendered
    expect(screen.getByText(/28.4°C/i)).toBeInTheDocument();
    expect(screen.getAllByText(/14.2 km\/h/i).length).toBeGreaterThanOrEqual(1);

    // Check factors and mitigations rendered
    expect(screen.getAllByText(/Ambient Temperature/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Apply wet hessian curing mats within 30 minutes/i)).toBeInTheDocument();
  });

  it('switches activity and triggers updated advisory evaluation', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAdvisoryResponse,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCautionResponse,
      } as unknown as Response);

    render(<WeatherAdvisoryCard projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(screen.getByText(/GO — FAVORABLE CONDITIONS/i)).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'CRANE_GANTRY_LAUNCHING' } });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/NO-GO — ADVERSE WEATHER/i)).toBeInTheDocument();
      expect(screen.getByText(/CRITICAL WIND WARNING: Launching gantry operations suspended/i)).toBeInTheDocument();
    });
  });

  it('opens What-If Simulator and executes custom scenario evaluation', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAdvisoryResponse,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ...mockAdvisoryResponse,
          status: 'PROCEED_WITH_CAUTION',
          summary: 'High temperature scenario requires cold water batching and night pour.',
          freshness: 'SIMULATED_SCENARIO',
        }),
      } as unknown as Response);

    render(<WeatherAdvisoryCard projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(screen.getByText(/GO — FAVORABLE CONDITIONS/i)).toBeInTheDocument();
    });

    // Toggle simulator
    const simToggleBtn = screen.getByRole('button', { name: /What-If Simulator/i });
    fireEvent.click(simToggleBtn);

    expect(screen.getByText(/Simulate Meteorological Scenarios/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /What-If Active/i })).toBeInTheDocument();

    const whatIfBtn = screen.getByRole('button', { name: /What-If Active/i });
    fireEvent.click(whatIfBtn);

    await waitFor(() => {
      expect(screen.getByText(/PROCEED WITH CAUTION/i)).toBeInTheDocument();
      expect(screen.getByText(/High temperature scenario requires cold water batching/i)).toBeInTheDocument();
    });
  });

  it('renders clear error message when weather telemetry endpoint fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ detail: 'Open-Meteo upstream service unavailable' }),
    } as unknown as Response);

    render(<WeatherAdvisoryCard projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(screen.getByText(/Weather evaluation failed \(HTTP 503\)/i)).toBeInTheDocument();
    });
  });
});
