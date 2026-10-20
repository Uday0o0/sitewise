import { useState, useEffect } from 'react';
import {
  CloudSun,
  Wind,
  Droplets,
  Thermometer,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  SlidersHorizontal,
  Info,
  Clock,
  Layers,
} from 'lucide-react';
import { DataProvenanceBadge } from './DataProvenanceBadge';

export interface WeatherMetrics {
  temperature_c?: number | null;
  relative_humidity_pct?: number | null;
  wind_speed_kmh?: number | null;
  wind_gusts_kmh?: number | null;
  precipitation_mm?: number | null;
  precipitation_probability_pct?: number | null;
  weather_condition?: string;
  is_forecast?: boolean;
}

export interface AdvisoryFactor {
  factor_name: string;
  measured_value: string;
  threshold_rule: string;
  impact: string;
  source_status: 'AUTHORITATIVE_CODE' | 'UNVERIFIED_CONFIGURABLE' | 'INSUFFICIENT_DATA';
  source_reference: string;
}

export interface WeatherAdvisoryResponse {
  project_id: string;
  activity: string;
  activity_name: string;
  status: 'GO' | 'PROCEED_WITH_CAUTION' | 'NO_GO' | 'INSUFFICIENT_DATA';
  summary: string;
  rationale: string;
  factors_considered: AdvisoryFactor[];
  identified_risks: string[];
  precautions_and_mitigations: string[];
  weather_metrics?: WeatherMetrics | null;
  source_provider: string;
  retrieved_at_iso: string;
  freshness: string;
  provenance: string;
  missing_inputs: string[];
  disclaimer: string;
}

const ACTIVITIES = [
  { code: 'CONCRETE_POURING', label: 'Structural Concrete Pouring (IS:456)' },
  { code: 'CRANE_GANTRY_LAUNCHING', label: 'Segment Launching Gantry (Wind Cutoff)' },
  { code: 'WORKING_AT_HEIGHTS', label: 'Elevated Scaffolding & Pier Stem (IS:3696)' },
  { code: 'EARTHWORK_EXCAVATION', label: 'Earthwork & Foundation Excavation (CPWD §2)' },
  { code: 'STRUCTURAL_STEEL_WELDING', label: 'Field Welding & Hot Works (AWS D1.1)' },
  { code: 'GENERAL_SITE_ACTIVITY', label: 'General Site Operations & Logistics' },
];

export function WeatherAdvisoryCard({ projectId = 'PRJ-NH48-PKG3' }: { projectId?: string }) {
  const [selectedActivity, setSelectedActivity] = useState<string>('CONCRETE_POURING');
  const [advisory, setAdvisory] = useState<WeatherAdvisoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // What-If Simulation Controls
  const [simulationOpen, setSimulationOpen] = useState<boolean>(false);
  const [simTemp, setSimTemp] = useState<number>(32);
  const [simWind, setSimWind] = useState<number>(18);
  const [simPrecip, setSimPrecip] = useState<number>(0);
  const [isScenarioMode, setIsScenarioMode] = useState<boolean>(false);

  const fetchAdvisory = async (activity: string, customScenario?: WeatherMetrics) => {
    setLoading(true);
    setError(null);
    try {
      let res: Response;
      if (customScenario) {
        res = await fetch(`/api/v4/projects/${projectId}/weather/advisory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activity,
            is_scenario: true,
            custom_weather: customScenario,
          }),
        });
      } else {
        res = await fetch(`/api/v4/projects/${projectId}/weather/advisory?activity=${activity}&scenario=true`);
      }

      if (!res.ok) {
        throw new Error(`Weather evaluation failed (HTTP ${res.status})`);
      }
      const data: WeatherAdvisoryResponse = await res.json();
      setAdvisory(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to weather advisory service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isScenarioMode) {
      fetchAdvisory(selectedActivity);
    } else {
      fetchAdvisory(selectedActivity, {
        temperature_c: simTemp,
        wind_speed_kmh: simWind,
        precipitation_mm: simPrecip,
        relative_humidity_pct: 60,
        weather_condition: simPrecip > 2 ? 'Rain Scenario' : simWind > 35 ? 'High Wind Scenario' : 'Simulated Weather',
      });
    }
  }, [selectedActivity, isScenarioMode, simTemp, simWind, simPrecip]);

  const metrics = advisory?.weather_metrics;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'GO':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded font-bold text-xs" style={{ background: 'rgba(34,197,94,0.18)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.3)' }}>
            <ShieldCheck size={14} />
            <span>GO — FAVORABLE CONDITIONS</span>
          </div>
        );
      case 'PROCEED_WITH_CAUTION':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded font-bold text-xs" style={{ background: 'rgba(234,179,8,0.18)', color: '#FACC15', border: '1px solid rgba(250,204,21,0.3)' }}>
            <AlertTriangle size={14} />
            <span>PROCEED WITH CAUTION</span>
          </div>
        );
      case 'NO_GO':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded font-bold text-xs" style={{ background: 'rgba(239,68,68,0.22)', color: '#F87171', border: '1px solid rgba(248,113,113,0.35)' }}>
            <ShieldAlert size={14} />
            <span>NO-GO — ADVERSE WEATHER</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded font-bold text-xs" style={{ background: 'rgba(148,163,184,0.18)', color: '#94A3B8' }}>
            <HelpCircle size={14} />
            <span>INSUFFICIENT DATA</span>
          </div>
        );
    }
  };

  return (
    <div
      className="rounded-lg p-5 transition-all"
      style={{
        background: 'var(--color-surface-container-low)',
        border: '1px solid var(--color-surface-border-subtle)',
      }}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-surface-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md" style={{ background: 'rgba(217,154,53,0.15)', color: 'var(--color-brand-yellow)' }}>
            <CloudSun size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                Weather-Aware Construction Advisory
              </h2>
              {advisory && (
                <DataProvenanceBadge
                  type={advisory.provenance as any}
                  label={advisory.freshness === 'LIVE_FRESH' ? 'OPEN-METEO LIVE' : advisory.freshness === 'USER_SCENARIO' ? 'USER WHAT-IF' : 'SYNTHETIC FALLBACK'}
                />
              )}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              Meteorological safety thresholds grounded in IS:456, IRC:112, and site crane limits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSimulationOpen(!simulationOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer"
            style={{
              background: simulationOpen ? 'var(--color-surface-container-high)' : 'var(--color-surface-container-med)',
              border: '1px solid var(--color-surface-border-subtle)',
              color: 'var(--color-text-primary)',
            }}
          >
            <SlidersHorizontal size={12} />
            <span>What-If Simulator</span>
          </button>

          <button
            onClick={() => {
              setIsScenarioMode(false);
              fetchAdvisory(selectedActivity);
            }}
            disabled={loading}
            className="p-1.5 rounded transition-colors cursor-pointer"
            style={{ background: 'var(--color-surface-container-med)', color: 'var(--color-text-secondary)' }}
            title="Refresh Live Weather"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* What-If Simulator Panel */}
      {simulationOpen && (
        <div className="my-3 p-3.5 rounded-md text-xs space-y-3" style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-brand-yellow flex items-center gap-1.5">
              <SlidersHorizontal size={13} />
              Simulate Meteorological Scenarios
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsScenarioMode(false);
                  fetchAdvisory(selectedActivity);
                }}
                className="px-2 py-0.5 rounded text-[11px] font-medium"
                style={{ background: !isScenarioMode ? 'var(--color-brand-yellow)' : 'transparent', color: !isScenarioMode ? '#000' : 'var(--color-text-secondary)' }}
              >
                Live Feed
              </button>
              <button
                onClick={() => setIsScenarioMode(true)}
                className="px-2 py-0.5 rounded text-[11px] font-medium"
                style={{ background: isScenarioMode ? 'var(--color-brand-yellow)' : 'transparent', color: isScenarioMode ? '#000' : 'var(--color-text-secondary)' }}
              >
                What-If Active
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span>Air Temp (°C):</span>
                <span className="font-mono font-bold">{simTemp}°C</span>
              </div>
              <input
                type="range"
                min="0"
                max="48"
                value={simTemp}
                onChange={e => {
                  setSimTemp(Number(e.target.value));
                  setIsScenarioMode(true);
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span>Wind Speed (km/h):</span>
                <span className="font-mono font-bold">{simWind} km/h</span>
              </div>
              <input
                type="range"
                min="0"
                max="65"
                value={simWind}
                onChange={e => {
                  setSimWind(Number(e.target.value));
                  setIsScenarioMode(true);
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span>Rainfall (mm/hr):</span>
                <span className="font-mono font-bold">{simPrecip} mm/hr</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={simPrecip}
                onChange={e => {
                  setSimPrecip(Number(e.target.value));
                  setIsScenarioMode(true);
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Activity Selector & Live Atmospheric Ribbon */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 my-4">
        {/* Activity Selector */}
        <div className="lg:col-span-5 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            Evaluated Construction Operation
          </label>
          <select
            value={selectedActivity}
            onChange={e => setSelectedActivity(e.target.value)}
            className="w-full px-3 py-2 rounded text-xs font-medium cursor-pointer"
            style={{
              background: 'var(--color-surface-container-med)',
              border: '1px solid var(--color-surface-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            {ACTIVITIES.map(a => (
              <option key={a.code} value={a.code}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* Live Weather Metrics Ribbon */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 rounded text-center" style={{ background: 'var(--color-surface-container-med)' }}>
            <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
              <Thermometer size={12} style={{ color: '#F87171' }} />
              <span>Temp</span>
            </div>
            <div className="text-sm font-bold font-mono mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
              {metrics?.temperature_c !== undefined && metrics?.temperature_c !== null ? `${metrics.temperature_c.toFixed(1)}°C` : '—'}
            </div>
          </div>

          <div className="p-2.5 rounded text-center" style={{ background: 'var(--color-surface-container-med)' }}>
            <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
              <Wind size={12} style={{ color: '#38BDF8' }} />
              <span>Wind</span>
            </div>
            <div className="text-sm font-bold font-mono mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
              {metrics?.wind_speed_kmh !== undefined && metrics?.wind_speed_kmh !== null ? `${metrics.wind_speed_kmh.toFixed(1)} km/h` : '—'}
            </div>
          </div>

          <div className="p-2.5 rounded text-center" style={{ background: 'var(--color-surface-container-med)' }}>
            <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
              <Droplets size={12} style={{ color: '#60A5FA' }} />
              <span>Rainfall</span>
            </div>
            <div className="text-sm font-bold font-mono mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
              {metrics?.precipitation_mm !== undefined && metrics?.precipitation_mm !== null ? `${metrics.precipitation_mm.toFixed(1)} mm` : '0.0 mm'}
            </div>
          </div>

          <div className="p-2.5 rounded text-center" style={{ background: 'var(--color-surface-container-med)' }}>
            <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
              <CloudSun size={12} style={{ color: 'var(--color-brand-yellow)' }} />
              <span>Condition</span>
            </div>
            <div className="text-xs font-semibold truncate mt-0.5" style={{ color: 'var(--color-text-primary)' }} title={metrics?.weather_condition}>
              {metrics?.weather_condition || 'Clear'}
            </div>
          </div>
        </div>
      </div>

      {/* Advisory Status & Rationale Card */}
      {advisory && (
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded" style={{ background: 'var(--color-surface-container-high)', border: '1px solid var(--color-surface-border-subtle)' }}>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                Engineering Recommendation
              </div>
              <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                {advisory.summary}
              </div>
            </div>
            <div className="self-start sm:self-center">
              {getStatusBadge(advisory.status)}
            </div>
          </div>

          {/* Rationale Text */}
          <div className="text-xs leading-relaxed p-3 rounded" style={{ background: 'var(--color-surface-container-med)', borderLeft: '3px solid var(--color-brand-yellow)' }}>
            <span className="font-semibold text-brand-yellow">Operational Analysis: </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{advisory.rationale}</span>
          </div>

          {/* Evaluated Factors Breakdown */}
          {advisory.factors_considered.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Evaluated Safety Rules & Engineering Codes
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-surface-border-subtle text-[10px] uppercase text-gray-400">
                      <th className="pb-1.5 font-medium">Parameter</th>
                      <th className="pb-1.5 font-medium">Measured Value</th>
                      <th className="pb-1.5 font-medium">Operational Threshold</th>
                      <th className="pb-1.5 font-medium">Standard / Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border-subtle">
                    {advisory.factors_considered.map((f, i) => (
                      <tr key={i} className="hover:bg-surface-container-high/40">
                        <td className="py-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {f.factor_name}
                        </td>
                        <td className="py-2 font-mono font-semibold" style={{ color: 'var(--color-text-code)' }}>
                          {f.measured_value}
                        </td>
                        <td className="py-2" style={{ color: 'var(--color-text-secondary)' }}>
                          {f.threshold_rule}
                        </td>
                        <td className="py-2">
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                            style={{
                              background: f.source_status === 'AUTHORITATIVE_CODE' ? 'rgba(56,189,248,0.15)' : 'rgba(217,154,53,0.15)',
                              color: f.source_status === 'AUTHORITATIVE_CODE' ? '#38BDF8' : '#FBBF24',
                            }}
                          >
                            {f.source_reference}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Precautions and Mitigations List */}
          {advisory.precautions_and_mitigations.length > 0 && (
            <div className="p-3 rounded space-y-1.5" style={{ background: 'var(--color-surface-container-med)' }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <ShieldCheck size={13} />
                Mandatory Precautions & Mitigation Actions
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {advisory.precautions_and_mitigations.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer Metadata & Disclaimer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-surface-border-subtle text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            <div className="flex items-center gap-2">
              <Clock size={11} />
              <span>Provider: {advisory.source_provider}</span>
              <span>•</span>
              <span>As of {new Date(advisory.retrieved_at_iso).toLocaleTimeString()}</span>
            </div>
            <div className="italic text-right max-w-md truncate" title={advisory.disclaimer}>
              {advisory.disclaimer}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
