import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Building2,
  IndianRupee,
  ShieldCheck,
  Sparkles,
  Calendar,
  Percent,
  CheckCircle2,
  ArrowUpRight,
  Info,
  Clock,
  Layers,
  MapPin,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { DataProvenanceBadge } from './DataProvenanceBadge';

interface ValueRangeINR {
  minimum_value_inr: number;
  estimated_value_inr: number;
  maximum_value_inr: number;
  minimum_value_inr_lakhs: number;
  estimated_value_inr_lakhs: number;
  maximum_value_inr_lakhs: number;
  estimated_value_inr_crores: number;
}

interface RentalYieldAnalysis {
  estimated_monthly_rent_inr: number;
  estimated_annual_rent_inr: number;
  gross_rental_yield_percent: number;
  market_rental_band: string;
}

interface AppreciationProjection {
  forecast_horizon_years: number;
  projected_cagr_percent: number;
  projected_value_inr: number;
  projected_value_inr_lakhs: number;
  projected_value_inr_crores: number;
  net_capital_gain_inr_lakhs: number;
  drivers: string[];
}

interface ValuationResponse {
  project_id: string;
  valuation_id: string;
  timestamp_iso: string;
  property_summary: any;
  market_value_range: ValueRangeINR;
  rate_per_sqft_inr: number;
  rate_per_sqft_range: {
    min_rate_sqft: number;
    estimated_rate_sqft: number;
    max_rate_sqft: number;
  };
  rental_analysis: RentalYieldAnalysis;
  appreciation_outlook: AppreciationProjection;
  evaluated_amenities_premium_percent: number;
  age_depreciation_factor: number;
  assumptions_and_sources: string[];
  provenance: string;
  disclaimer: string;
}

const PRESET_MARKETS = [
  'Gurugram (Golf Course Extension)',
  'Gurugram (Cyber City / Phase 2)',
  'Gurugram (Sohna Road)',
  'Gurugram (New Gurgaon / Sector 82-95)',
  'Delhi NCR (South Delhi)',
  'Delhi NCR (Noida Expressway)',
  'Mumbai (BKC / Bandra)',
  'Bengaluru (Whitefield)',
  'Hyderabad (HITEC City / Gachibowli)',
  'Pune (Hinjawadi IT Corridor)',
];

const AMENITY_OPTIONS = [
  'Gated Security',
  'Power Backup',
  'Covered Parking',
  'Lift',
  'Clubhouse',
  'Swimming Pool',
  'Gymnasium',
  'EV Charging',
];

export function RealEstateValuationCard({ projectId = 'PRJ-NH48-PKG3' }: { projectId?: string }) {
  const [location, setLocation] = useState<string>('Gurugram (Golf Course Extension)');
  const [areaSqft, setAreaSqft] = useState<number>(1850);
  const [ageYears, setAgeYears] = useState<number>(3);
  const [propertyType, setPropertyType] = useState<string>('APARTMENT_HIGH_RISE');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'Gated Security',
    'Power Backup',
    'Covered Parking',
    'Lift',
    'Clubhouse',
  ]);
  const [isMetroAdjacent, setIsMetroAdjacent] = useState<boolean>(true);

  const [valuation, setValuation] = useState<ValuationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAmenity = (name: string) => {
    setSelectedAmenities(prev =>
      prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
    );
  };

  const calculateValuation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v4/valuation/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_location: location,
          area_sqft: Number(areaSqft),
          building_age_years: Number(ageYears),
          property_type: propertyType,
          amenities: selectedAmenities,
          is_metro_adjacent: isMetroAdjacent,
          project_id: projectId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Valuation calculation failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      setValuation(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to valuation engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateValuation();
  }, [projectId]);

  return (
    <div className="space-y-6">
      {/* Parameter Inputs Card */}
      <div
        className="rounded-lg p-5"
        style={{
          background: 'var(--color-surface-container-low)',
          border: '1px solid var(--color-surface-border-subtle)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-surface-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md" style={{ background: 'rgba(56,189,248,0.15)', color: '#38BDF8' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  Real Estate Valuation & Investment Yield Engine
                </h2>
                <DataProvenanceBadge type="AI_INFERRED" label="INDIAN MARKET COMPS" />
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                AI-driven property valuation, price per sq.ft, rental yields, and 5-year capital appreciation outlook.
              </p>
            </div>
          </div>

          <button
            onClick={calculateValuation}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors self-start md:self-auto disabled:opacity-60"
            style={{
              background: 'var(--color-brand-yellow)',
              color: 'var(--color-surface-base)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Calculating Valuation...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Calculate Property Valuation</span>
              </>
            )}
          </button>
        </div>

        {/* Inputs Form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-400 block">Property Location / Micro-Market</label>
            <select
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-3 py-2 rounded text-xs cursor-pointer"
              style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border)', color: 'var(--color-text-primary)' }}
            >
              {PRESET_MARKETS.map((m, idx) => (
                <option key={idx} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-400 block">Area (sq.ft)</label>
            <input
              type="number"
              min="100"
              max="50000"
              value={areaSqft}
              onChange={e => setAreaSqft(Number(e.target.value))}
              className="w-full px-3 py-2 rounded text-xs font-mono font-bold"
              style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border)', color: 'var(--color-text-primary)' }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-400 block">Property Type</label>
            <select
              value={propertyType}
              onChange={e => setPropertyType(e.target.value)}
              className="w-full px-3 py-2 rounded text-xs cursor-pointer"
              style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border)', color: 'var(--color-text-primary)' }}
            >
              <option value="APARTMENT_HIGH_RISE">High-Rise Apartment</option>
              <option value="INDEPENDENT_VILLA">Independent Villa / Gated Plot</option>
              <option value="BUILDER_FLOOR">Independent Builder Floor</option>
              <option value="COMMERCIAL_OFFICE">Commercial Grade-A Office</option>
              <option value="COMMERCIAL_RETAIL">Commercial High-Street Retail</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-semibold text-gray-400">Building Structure Age</label>
              <span className="text-xs font-mono font-bold text-brand-yellow">{ageYears} Years Old</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={ageYears}
              onChange={e => setAgeYears(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-3 pt-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer text-gray-200">
              <input
                type="checkbox"
                checked={isMetroAdjacent}
                onChange={e => setIsMetroAdjacent(e.target.checked)}
                className="rounded accent-amber-500 cursor-pointer"
              />
              <span>Metro / NH-48 Express Corridor Proximity (&lt;1 km) (+8% Premium)</span>
            </label>
          </div>

          {/* Amenities Selector */}
          <div className="md:col-span-4 space-y-1.5 pt-2">
            <label className="text-[11px] font-semibold text-gray-400 block">Amenities Included</label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((a, i) => {
                const active = selectedAmenities.includes(a);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className="text-xs px-2.5 py-1 rounded cursor-pointer transition-colors"
                    style={{
                      background: active ? 'rgba(56,189,248,0.2)' : 'var(--color-surface-container-med)',
                      color: active ? '#38BDF8' : 'var(--color-text-secondary)',
                      border: active ? '1px solid rgba(56,189,248,0.4)' : '1px solid var(--color-surface-border-subtle)',
                    }}
                  >
                    {active ? '✓ ' : '+ '}{a}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert Display */}
      {error && (
        <div
          className="rounded-lg p-4 border flex items-start gap-3"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: '#FCA5A5',
          }}
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-400" />
          <div className="space-y-1">
            <div className="font-semibold text-xs text-rose-300">Valuation Engine Notice</div>
            <div className="text-xs opacity-90">{error}</div>
            <button
              onClick={calculateValuation}
              className="mt-2 px-2.5 py-1 rounded text-[11px] font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-colors cursor-pointer border border-rose-500/40"
            >
              Retry Calculation
            </button>
          </div>
        </div>
      )}

      {/* Loading Placeholder */}
      {loading && !valuation && (
        <div
          className="rounded-lg p-8 border text-center space-y-3"
          style={{
            background: 'var(--color-surface-container-low)',
            borderColor: 'var(--color-surface-border-subtle)',
          }}
        >
          <Loader2 size={32} className="animate-spin mx-auto text-amber-400" />
          <div className="text-sm font-semibold text-gray-200">Processing Micro-Market Valuation Comps...</div>
          <div className="text-xs text-gray-400 max-w-sm mx-auto">
            Evaluating area metrics, age depreciation schedules, amenity scoring, and 5-year capital appreciation curves.
          </div>
        </div>
      )}

      {/* Valuation Results Display */}
      {valuation && (
        <div className="space-y-6 animate-fade-in">
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <span className="text-[11px] font-semibold text-gray-400 uppercase">Indicative Market Value</span>
              <div className="text-2xl font-bold font-mono mt-1 text-emerald-400">
                ₹{valuation.market_value_range.estimated_value_inr_crores.toFixed(2)} <span className="text-xs font-normal text-gray-400">Cr</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">₹{valuation.market_value_range.estimated_value_inr_lakhs} Lakhs central</p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <span className="text-[11px] font-semibold text-gray-400 uppercase">Price Per Square Foot</span>
              <div className="text-2xl font-bold font-mono mt-1 text-brand-yellow">
                ₹{valuation.rate_per_sqft_inr.toLocaleString()} <span className="text-xs font-normal text-gray-400">/ sq.ft</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Range: ₹{valuation.rate_per_sqft_range.min_rate_sqft} – ₹{valuation.rate_per_sqft_range.max_rate_sqft}</p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <span className="text-[11px] font-semibold text-gray-400 uppercase">Monthly Rental Yield</span>
              <div className="text-2xl font-bold font-mono mt-1 text-cyan-400">
                ₹{Math.round(valuation.rental_analysis.estimated_monthly_rent_inr).toLocaleString()} <span className="text-xs font-normal text-gray-400">/ mo</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Gross Yield: {valuation.rental_analysis.gross_rental_yield_percent}% p.a.</p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <span className="text-[11px] font-semibold text-gray-400 uppercase">5-Yr Projected Value</span>
              <div className="text-2xl font-bold font-mono mt-1 text-purple-400">
                ₹{valuation.appreciation_outlook.projected_value_inr_crores.toFixed(2)} <span className="text-xs font-normal text-gray-400">Cr</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Projected CAGR: +{valuation.appreciation_outlook.projected_cagr_percent}%</p>
            </div>
          </div>

          {/* Value Range Banner */}
          <div className="p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ background: 'var(--color-surface-container-high)', border: '1px solid var(--color-surface-border-subtle)' }}>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Estimated Market Range (90% Confidence Band)</span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm font-mono text-gray-300">Min: ₹{valuation.market_value_range.minimum_value_inr_lakhs} L</span>
                <span className="text-gray-500">→</span>
                <span className="text-base font-mono font-bold text-emerald-400">₹{valuation.market_value_range.estimated_value_inr_lakhs} Lakhs</span>
                <span className="text-gray-500">→</span>
                <span className="text-sm font-mono text-gray-300">Max: ₹{valuation.market_value_range.maximum_value_inr_lakhs} L</span>
              </div>
            </div>
            <div className="text-right text-xs">
              <span className="text-gray-400">Rental Comp Band: </span>
              <span className="font-mono text-brand-yellow font-semibold">{valuation.rental_analysis.market_rental_band}</span>
            </div>
          </div>

          {/* Drivers & Parametric Factors Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Value Drivers */}
            <div className="rounded-lg p-5 space-y-3" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <CheckCircle2 size={14} style={{ color: '#4ADE80' }} />
                Valuation Drivers & Micro-Market Comps
              </h3>
              <ul className="space-y-2 text-xs">
                {valuation.appreciation_outlook.drivers.map((d, i) => (
                  <li key={i} className="p-2.5 rounded flex items-start gap-2" style={{ background: 'var(--color-surface-container-med)' }}>
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span className="text-gray-200 leading-relaxed">{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 5-Year Capital Gain Outlook */}
            <div className="rounded-lg p-5 space-y-3" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <ArrowUpRight size={14} style={{ color: '#C084FC' }} />
                5-Year Capital Appreciation & Net ROI
              </h3>
              <div className="p-3.5 rounded space-y-2 text-xs" style={{ background: 'var(--color-surface-container-med)' }}>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Forecast Horizon:</span>
                  <span className="font-mono font-bold text-gray-200">5 Years (2024–2029)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Projected Capital CAGR:</span>
                  <span className="font-mono font-bold text-purple-400">+{valuation.appreciation_outlook.projected_cagr_percent}% per annum</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Net Estimated Capital Gain:</span>
                  <span className="font-mono font-bold text-emerald-400">+₹{valuation.appreciation_outlook.net_capital_gain_inr_lakhs} Lakhs</span>
                </div>
                <div className="flex justify-between items-center border-t border-surface-border-subtle pt-2">
                  <span className="text-gray-300 font-semibold">Projected 2029 Value:</span>
                  <span className="font-mono font-bold text-purple-300 text-sm">₹{valuation.appreciation_outlook.projected_value_inr_crores.toFixed(2)} Crores</span>
                </div>
              </div>
            </div>
          </div>

          {/* Disclaimer & Provenance Notice */}
          <div className="rounded-lg p-4 text-xs space-y-2" style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border-subtle)' }}>
            <span className="font-semibold text-brand-yellow block">Indicative Valuation Basis:</span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-300">
              {valuation.assumptions_and_sources.map((ass, i) => (
                <li key={i}>{ass}</li>
              ))}
            </ul>
            <p className="text-[10px] italic text-gray-400 pt-2 border-t border-surface-border-subtle">
              {valuation.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
