import { useState, useEffect } from 'react';
import {
  Compass,
  Layers,
  Building,
  Calendar,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  HelpCircle,
  FileSpreadsheet,
  Package,
  Loader2,
} from 'lucide-react';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { getApiUrl } from '../api/client';

interface MaterialItem {
  material_code: string;
  material_name: string;
  quantity: number;
  unit: string;
  consumption_ratio_description: string;
  estimated_rate_inr: number;
  estimated_cost_inr: number;
  standard_reference: string;
  provenance: string;
}

interface CostHeadItem {
  category: string;
  description: string;
  cost_inr: number;
  cost_inr_lakhs: number;
  percentage_of_total: number;
  cost_per_sqft_inr: number;
}

interface SchedulePhase {
  phase_number: number;
  phase_name: string;
  start_week: number;
  end_week: number;
  duration_weeks: number;
  key_milestones: string[];
  critical_trade: string;
  deliverables: string;
}

interface ProjectPlanningResponse {
  project_id: string;
  generated_at_iso: string;
  input_parameters: any;
  built_up_area_sqft: number;
  carpet_area_approx_sqft: number;
  materials_takeoff: MaterialItem[];
  cost_breakdown: CostHeadItem[];
  total_estimated_cost_inr: number;
  total_estimated_cost_inr_lakhs: number;
  total_estimated_cost_inr_crores: number;
  average_rate_per_sqft_inr: number;
  phase_schedule: SchedulePhase[];
  total_project_duration_weeks: number;
  total_project_duration_months: number;
  assumptions_and_sources: string[];
  provenance: string;
  disclaimer: string;
}

const PRESET_PLOTS = [
  { label: '30x50 Villa Plot (1,500 sq.ft)', length: 50, width: 30, floors: 2 },
  { label: '40x60 Independent House (2,400 sq.ft)', length: 60, width: 40, floors: 3 },
  { label: '60x80 Commercial Office (4,800 sq.ft)', length: 80, width: 60, floors: 4 },
  { label: 'Elevated Corridor Pier Bay (3,200 sq.ft)', length: 80, width: 40, floors: 1 },
];

export function ProjectPlanningCalculator({ projectId = 'PRJ-NH48-PKG3' }: { projectId?: string }) {
  const [plotLength, setPlotLength] = useState<number>(50);
  const [plotWidth, setPlotWidth] = useState<number>(30);
  const [floors, setFloors] = useState<number>(2);
  const [groundCoverage, setGroundCoverage] = useState<number>(70);
  const [constructionType, setConstructionType] = useState<string>('RESIDENTIAL_STANDARD');
  const [locationCity, setLocationCity] = useState<string>('Gurugram');

  const [plan, setPlan] = useState<ProjectPlanningResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generatePlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/api/v4/planning/generate-plan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plot_length_ft: Number(plotLength),
          plot_width_ft: Number(plotWidth),
          floors: Number(floors),
          ground_coverage_percent: Number(groundCoverage),
          construction_type: constructionType,
          location_city: locationCity,
          project_id: projectId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Planning calculation failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      setPlan(data);
    } catch (err: any) {
      setError(err?.message || 'Error communicating with planning calculation engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generatePlan();
  }, [projectId]);

  const applyPreset = (p: typeof PRESET_PLOTS[0]) => {
    setPlotLength(p.length);
    setPlotWidth(p.width);
    setFloors(p.floors);
  };

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
            <div className="p-2 rounded-md" style={{ background: 'rgba(217,154,53,0.15)', color: 'var(--color-brand-yellow)' }}>
              <Compass size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  Construction Project Planning & Material Takeoff
                </h2>
                <DataProvenanceBadge type="CALCULATED" label="CPWD DSR FORMULAS" />
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Generates material consumption takeoff, itemized INR costs, and phase schedules from plot dimensions and building typology.
              </p>
            </div>
          </div>

          <button
            onClick={generatePlan}
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
                <span>Calculating Takeoff & Schedule...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Calculate Project Plan</span>
              </>
            )}
          </button>
        </div>

        {/* Preset quick buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-2">
          <span className="text-[11px] font-semibold text-gray-400">Presets:</span>
          {PRESET_PLOTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(p)}
              className="text-[10px] px-2.5 py-1 rounded cursor-pointer transition-colors"
              style={{
                background: plotLength === p.length && plotWidth === p.width ? 'rgba(217,154,53,0.25)' : 'var(--color-surface-container-med)',
                color: plotLength === p.length && plotWidth === p.width ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
                border: '1px solid var(--color-surface-border-subtle)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5 mt-4">
          <div>
            <label className="text-[11px] font-semibold text-gray-400 block mb-1">Plot Length (ft)</label>
            <input
              type="number"
              min="10"
              max="1000"
              value={plotLength}
              onChange={e => setPlotLength(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded text-xs font-mono font-bold"
              style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border)', color: 'var(--color-text-primary)' }}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-400 block mb-1">Plot Width (ft)</label>
            <input
              type="number"
              min="10"
              max="1000"
              value={plotWidth}
              onChange={e => setPlotWidth(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded text-xs font-mono font-bold"
              style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border)', color: 'var(--color-text-primary)' }}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-400 block mb-1">Floors (Stories)</label>
            <input
              type="number"
              min="1"
              max="50"
              value={floors}
              onChange={e => setFloors(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded text-xs font-mono font-bold"
              style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border)', color: 'var(--color-text-primary)' }}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-400 block mb-1">Coverage (%)</label>
            <input
              type="number"
              min="30"
              max="100"
              value={groundCoverage}
              onChange={e => setGroundCoverage(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded text-xs font-mono font-bold"
              style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border)', color: 'var(--color-text-primary)' }}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-400 block mb-1">Building Typology</label>
            <select
              value={constructionType}
              onChange={e => setConstructionType(e.target.value)}
              className="w-full px-2 py-1.5 rounded text-xs cursor-pointer"
              style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border)', color: 'var(--color-text-primary)' }}
            >
              <option value="RESIDENTIAL_STANDARD">Residential (Standard)</option>
              <option value="RESIDENTIAL_PREMIUM">Residential (Premium)</option>
              <option value="COMMERCIAL_OFFICE">Commercial Office</option>
              <option value="INFRASTRUCTURE_BRIDGE">Infrastructure / Elevated</option>
              <option value="INDUSTRIAL_WAREHOUSE">Industrial Warehouse</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-400 block mb-1">Location City</label>
            <select
              value={locationCity}
              onChange={e => setLocationCity(e.target.value)}
              className="w-full px-2 py-1.5 rounded text-xs cursor-pointer"
              style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border)', color: 'var(--color-text-primary)' }}
            >
              <option value="Gurugram">Gurugram (1.15x)</option>
              <option value="Delhi NCR">Delhi NCR (1.15x)</option>
              <option value="Mumbai">Mumbai (1.25x)</option>
              <option value="Bengaluru">Bengaluru (1.12x)</option>
              <option value="Pune">Pune (1.10x)</option>
              <option value="Hyderabad">Hyderabad (1.08x)</option>
              <option value="Tier-2 City">Tier-2 City (1.00x)</option>
            </select>
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
            <div className="font-semibold text-xs text-rose-300">Project Planning Engine Notice</div>
            <div className="text-xs opacity-90">{error}</div>
            <button
              onClick={generatePlan}
              className="mt-2 px-2.5 py-1 rounded text-[11px] font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-colors cursor-pointer border border-rose-500/40"
            >
              Retry Planning Calculation
            </button>
          </div>
        </div>
      )}

      {/* Loading Placeholder */}
      {loading && !plan && (
        <div
          className="rounded-lg p-8 border text-center space-y-3"
          style={{
            background: 'var(--color-surface-container-low)',
            borderColor: 'var(--color-surface-border-subtle)',
          }}
        >
          <Loader2 size={32} className="animate-spin mx-auto text-amber-400" />
          <div className="text-sm font-semibold text-gray-200">Calculating Civil Takeoffs & Schedule...</div>
          <div className="text-xs text-gray-400 max-w-sm mx-auto">
            Computing built-up areas, CPWD DSR material takeoff quantities, regional cost index scaling, and 5-phase schedule.
          </div>
        </div>
      )}

      {/* Plan Results Display */}
      {plan && (
        <div className="space-y-6 animate-fade-in">
          {/* Top KPI Metrics Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <span className="text-[11px] font-semibold text-gray-400 uppercase">Total Built-Up Area</span>
              <div className="text-2xl font-bold font-mono mt-1 text-brand-yellow">
                {plan.built_up_area_sqft.toLocaleString()} <span className="text-xs font-normal text-gray-400">sq.ft</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Carpet Area: ~{plan.carpet_area_approx_sqft.toLocaleString()} sq.ft</p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <span className="text-[11px] font-semibold text-gray-400 uppercase">Estimated Total Cost</span>
              <div className="text-2xl font-bold font-mono mt-1 text-emerald-400">
                ₹{plan.total_estimated_cost_inr_lakhs.toLocaleString()} <span className="text-xs font-normal text-gray-400">Lakhs</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">₹{plan.total_estimated_cost_inr_crores.toFixed(2)} Crores total</p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <span className="text-[11px] font-semibold text-gray-400 uppercase">Average Unit Rate</span>
              <div className="text-2xl font-bold font-mono mt-1 text-cyan-400">
                ₹{plan.average_rate_per_sqft_inr.toLocaleString()} <span className="text-xs font-normal text-gray-400">/ sq.ft</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Indexed to {locationCity} CPWD DSR</p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <span className="text-[11px] font-semibold text-gray-400 uppercase">Execution Duration</span>
              <div className="text-2xl font-bold font-mono mt-1 text-amber-400">
                {plan.total_project_duration_weeks} <span className="text-xs font-normal text-gray-400">Weeks</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">~{plan.total_project_duration_months} Months (5 Phases)</p>
            </div>
          </div>

          {/* Material Takeoff Table */}
          <div className="rounded-lg p-5 space-y-3" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Package size={14} style={{ color: 'var(--color-brand-yellow)' }} />
                Civil Material Consumption Takeoff (Cement, Sand, Aggregate, Steel)
              </h3>
              <span className="text-[11px] font-mono text-gray-400">CPWD DSR Itemized Takeoff</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-surface-border-subtle text-[10px] uppercase text-gray-400">
                    <th className="pb-2 font-medium">Material Code & Name</th>
                    <th className="pb-2 font-medium">Estimated Quantity</th>
                    <th className="pb-2 font-medium">Unit Rate (₹)</th>
                    <th className="pb-2 font-medium">Total Cost (INR)</th>
                    <th className="pb-2 font-medium">Thumb Rule & Code Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border-subtle">
                  {plan.materials_takeoff.map((m, i) => (
                    <tr key={i} className="hover:bg-surface-container-high/40">
                      <td className="py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        <div>{m.material_name}</div>
                        <span className="text-[10px] font-mono text-gray-400">{m.material_code}</span>
                      </td>
                      <td className="py-2.5 font-mono font-bold text-brand-yellow">
                        {m.quantity.toLocaleString()} {m.unit}
                      </td>
                      <td className="py-2.5 font-mono text-gray-300">
                        ₹{m.estimated_rate_inr.toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono font-semibold text-emerald-400">
                        ₹{m.estimated_cost_inr.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-[11px] text-gray-400">
                        <div>{m.consumption_ratio_description}</div>
                        <span className="text-[9px] font-mono text-cyan-400">{m.standard_reference}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cost Breakdown & Phase Schedule Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Cost Breakdown */}
            <div className="rounded-lg p-5 space-y-3" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <IndianRupee size={14} style={{ color: '#4ADE80' }} />
                Itemized Cost Breakdown in Indian Rupees (₹)
              </h3>

              <div className="space-y-2.5">
                {plan.cost_breakdown.map((head, i) => (
                  <div key={i} className="p-3 rounded space-y-1.5" style={{ background: 'var(--color-surface-container-med)' }}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-200">{head.category}</span>
                      <span className="font-mono font-bold text-emerald-400">₹{head.cost_inr_lakhs} Lakhs ({head.percentage_of_total}%)</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${head.percentage_of_total}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>{head.description}</span>
                      <span className="font-mono">₹{head.cost_per_sqft_inr}/sq.ft</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Phase-Wise Schedule */}
            <div className="rounded-lg p-5 space-y-3" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Clock size={14} style={{ color: '#38BDF8' }} />
                Phase-Wise Construction Execution Schedule
              </h3>

              <div className="space-y-2.5">
                {plan.phase_schedule.map((phase, i) => (
                  <div key={i} className="p-3 rounded space-y-1" style={{ background: 'var(--color-surface-container-med)' }}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-brand-yellow">
                        Phase {phase.phase_number}: {phase.phase_name}
                      </span>
                      <span className="font-mono text-cyan-400 text-[11px]">
                        Weeks {phase.start_week}–{phase.end_week} ({phase.duration_weeks} wks)
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-300 leading-relaxed">
                      {phase.deliverables}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      Critical Gang: {phase.critical_trade}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Transparent Assumptions & Disclaimer */}
          <div className="rounded-lg p-4 text-xs space-y-2" style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border-subtle)' }}>
            <span className="font-semibold text-brand-yellow block">Transparent Formulas & Source References:</span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-300">
              {plan.assumptions_and_sources.map((ass, i) => (
                <li key={i}>{ass}</li>
              ))}
            </ul>
            <p className="text-[10px] italic text-gray-400 pt-2 border-t border-surface-border-subtle">
              {plan.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
