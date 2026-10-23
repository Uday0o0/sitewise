import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RealEstateValuationCard } from '../components/RealEstateValuationCard';

const mockValuationResponse = {
  project_id: 'PRJ-NH48-PKG3',
  valuation_id: 'VAL-20261024-GURUGRAM',
  timestamp_iso: '2026-10-24T03:00:00Z',
  property_summary: {
    location: 'Gurugram (Golf Course Extension)',
    area_sqft: 1850,
    building_age_years: 3,
    property_type: 'APARTMENT_HIGH_RISE',
  },
  market_value_range: {
    minimum_value_inr: 21500000.0,
    estimated_value_inr: 24500000.0,
    maximum_value_inr: 27500000.0,
    minimum_value_inr_lakhs: 215.0,
    estimated_value_inr_lakhs: 245.0,
    maximum_value_inr_lakhs: 275.0,
    estimated_value_inr_crores: 2.45,
  },
  rate_per_sqft_inr: 13243,
  rate_per_sqft_range: {
    min_rate_sqft: 11621,
    estimated_rate_sqft: 13243,
    max_rate_sqft: 14864,
  },
  rental_analysis: {
    estimated_monthly_rent_inr: 72000.0,
    estimated_annual_rent_inr: 864000.0,
    gross_rental_yield_percent: 3.53,
    market_rental_band: '₹68,000 – ₹76,000 / month',
  },
  appreciation_outlook: {
    forecast_horizon_years: 5,
    projected_cagr_percent: 7.2,
    projected_value_inr: 34685000.0,
    projected_value_inr_lakhs: 346.85,
    projected_value_inr_crores: 3.47,
    net_capital_gain_inr_lakhs: 101.85,
    drivers: [
      'Proximity to Southern Peripheral Road (SPR) cloverleaf junction',
      'Rapid metro extension feasibility study approved',
      'Strong commercial IT corridor absorption in Sector 58-62',
    ],
  },
  evaluated_amenities_premium_percent: 6.5,
  age_depreciation_factor: 0.94,
  assumptions_and_sources: [
    'Sub-registrar circle rates for Badshahpur/Wazirabad tehsil (2025-26)',
    'MagicBricks / 99acres transaction comps for Golf Course Ext. Rd',
  ],
  provenance: 'AI_INFERRED',
  disclaimer: 'Algorithmic valuation based on verified sub-registrar circles and peer comparables.',
};

describe('RealEstateValuationCard (Activity 3.2)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders initial form controls and loads valuation results on mount', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockValuationResponse,
    } as unknown as Response);

    render(<RealEstateValuationCard projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
      expect(screen.getByText(/Indicative Market Value/i)).toBeInTheDocument();
      expect(screen.getByText(/Price Per Square Foot/i)).toBeInTheDocument();
      expect(screen.getByText(/Monthly Rental Yield/i)).toBeInTheDocument();
      expect(screen.getByText(/5-Yr Projected Value/i)).toBeInTheDocument();
    });

    // Verify key fields rendered
    expect(screen.getByText(/245 Lakhs central/i)).toBeInTheDocument();
    expect(screen.getByText(/Gross Yield: 3.53% p.a./i)).toBeInTheDocument();
    expect(screen.getByText(/Proximity to Southern Peripheral Road/i)).toBeInTheDocument();
    expect(screen.getByText(/Sub-registrar circle rates/i)).toBeInTheDocument();

    // Verify form controls exist
    expect(screen.getByText(/Property Location \/ Micro-Market/i)).toBeInTheDocument();
    expect(screen.getByText(/Building Structure Age/i)).toBeInTheDocument();
    expect(screen.getByText(/Amenities Included/i)).toBeInTheDocument();
  });

  it('toggles amenities and submits updated calculation request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockValuationResponse,
    } as unknown as Response);

    render(<RealEstateValuationCard projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(screen.getByText(/Indicative Market Value/i)).toBeInTheDocument();
    });

    // Toggle Swimming Pool amenity
    const poolButton = screen.getByText(/\+ Swimming Pool/i);
    fireEvent.click(poolButton);

    // Verify button label changed to active checkmark
    expect(screen.getByText(/✓ Swimming Pool/i)).toBeInTheDocument();

    // Click recalculate button
    const calcButton = screen.getByRole('button', { name: /Calculate Property Valuation/i });
    fireEvent.click(calcButton);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v4/valuation/estimate',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Swimming Pool'),
      })
    );
  });

  it('handles API error with status 500 and presents retry action', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Comp database timeout' }),
    } as unknown as Response);

    render(<RealEstateValuationCard projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(screen.getByText(/Valuation Engine Notice/i)).toBeInTheDocument();
      expect(screen.getByText(/Valuation calculation failed \(HTTP 500\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Retry Calculation/i)).toBeInTheDocument();
    });
  });

  it('handles network failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch valuation'));

    render(<RealEstateValuationCard projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch valuation/i)).toBeInTheDocument();
    });
  });

  it('renders safely when optional arrays (drivers, sources) are empty', async () => {
    const emptyResponse = {
      ...mockValuationResponse,
      appreciation_outlook: {
        ...mockValuationResponse.appreciation_outlook,
        drivers: [],
      },
      assumptions_and_sources: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => emptyResponse,
    } as unknown as Response);

    render(<RealEstateValuationCard projectId="PRJ-EMPTY" />);

    await waitFor(() => {
      expect(screen.getByText(/Indicative Market Value/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Proximity to Southern Peripheral Road/i)).not.toBeInTheDocument();
  });
});
