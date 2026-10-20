import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Users,
  HardHat,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ArrowRight,
  ExternalLink,
  ClipboardList,
  Wrench,
  CheckCircle2,
  FileText,
  CloudSun,
  Loader2,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { DataProvenanceBadge } from './DataProvenanceBadge';

interface DailyTaskItem {
  sequence: number;
  task_name: string;
  trade: string;
  duration_hours: number;
  safety_criticality: 'STANDARD' | 'HIGH' | 'CRITICAL';
  instructions: string;
}

interface MaterialEquipmentNeed {
  item_name: string;
  category: 'MATERIAL' | 'EQUIPMENT' | 'SAFETY_GEAR' | 'TESTING_TOOL';
  quantity_estimate: string;
  specification_code: string;
  provenance: string;
}

interface SafetyCheckItem {
  check_id: string;
  category: string;
  checkpoint_description: string;
  standard_reference: string;
  is_mandatory: boolean;
}

interface ProjectRiskAlert {
  alert_id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  source_record_type: string;
  source_record_id?: string;
  deep_link_url?: string;
  provenance: string;
}

interface DailyBriefingResponse {
  project_id: string;
  project_name: string;
  chainage_range: string;
  generated_at_iso: string;
  shift: string;
  daily_activity: string;
  workforce_count: number;
  site_conditions: string;
  weather_advisory?: any;
  daily_task_breakdown: DailyTaskItem[];
  required_materials_and_equipment: MaterialEquipmentNeed[];
  safety_precautions_and_checklist: SafetyCheckItem[];
  risk_alerts: ProjectRiskAlert[];
  source_citations: any[];
  provenance: string;
  is_empty_project: boolean;
  summary: string;
  disclaimer: string;
}

const PRESET_ACTIVITIES = [
  { label: 'Pier 18 Cap Concreting & Prestressing Duct Inspection', code: 'Pier 18 Cap Concreting & Prestressing Duct Inspection' },
  { label: 'Span 18-19 Segment Launching & Gantry Erection', code: 'Launching Gantry Segment Erection Span 18-19' },
  { label: 'Pier 18 Scaffolding & Falsework Staging Sign-Off', code: 'Pier 18 Elevated Scaffolding Staging & Inspection' },
  { label: 'Subgrade Compaction & Bulk Earthwork (Ch. 18+200)', code: 'Bulk Earthwork & Subgrade Compaction' },
];

export function DailySiteBriefingCard({ projectId = 'PRJ-NH48-PKG3' }: { projectId?: string }) {
  const navigate = useNavigate();
  const [activity, setActivity] = useState<string>('Pier 18 Cap Concreting & Prestressing Duct Inspection');
  const [workforceCount, setWorkforceCount] = useState<number>(24);
  const [siteConditions, setSiteConditions] = useState<string>('Elevated staging on Pier 18, highway traffic flowing beneath on NH-48');
  const [shift, setShift] = useState<'DAY_SHIFT' | 'NIGHT_SHIFT'>('DAY_SHIFT');

  const [briefing, setBriefing] = useState<DailyBriefingResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v4/projects/${projectId}/assistant/daily-briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_activity: activity,
          workforce_count: Number(workforceCount),
          site_conditions: siteConditions,
          shift,
        }),
      });
      if (!res.ok) {
        throw new Error(`Failed to generate briefing (HTTP ${res.status})`);
      }
      const data = await res.json();
      setBriefing(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to briefing service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, [projectId]);

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171' }}>CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(234,179,8,0.2)', color: '#FACC15' }}>HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(56,189,248,0.2)', color: '#38BDF8' }}>MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(148,163,184,0.2)', color: '#94A3B8' }}>LOW</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header Card */}
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
              <CalendarDays size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  Daily Site Assistant — Morning Briefing & Action Plan
                </h2>
                <DataProvenanceBadge type="SOURCE_VERIFIED" label="PROJECT GROUNDED" />
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Synthesizes open findings, critical path slips, contractor claims, and meteorological rules into daily task execution.
              </p>
            </div>
          </div>

          <button
            onClick={fetchBriefing}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors self-start md:self-auto"
            style={{
              background: 'var(--color-brand-yellow)',
              color: 'var(--color-surface-base)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            <span>Generate Daily Briefing</span>
          </button>
        </div>

        {/* Input Form Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Planned Construction Operation
            </label>
            <input
              type="text"
              value={activity}
              onChange={e => setActivity(e.target.value)}
              className="w-full px-3 py-2 rounded text-xs"
              style={{
                background: 'var(--color-surface-container-med)',
                border: '1px solid var(--color-surface-border)',
                color: 'var(--color-text-primary)',
              }}
              placeholder="e.g. Pier Cap Concreting"
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {PRESET_ACTIVITIES.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActivity(p.code)}
                  className="text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors"
                  style={{
                    background: activity === p.code ? 'rgba(217,154,53,0.25)' : 'var(--color-surface-container-high)',
                    color: activity === p.code ? 'var(--color-brand-yellow)' : 'var(--color-text-tertiary)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                Workforce Count
              </label>
              <span className="text-xs font-mono font-bold text-brand-yellow">{workforceCount} Workers</span>
            </div>
            <input
              type="number"
              min="1"
              max="200"
              value={workforceCount}
              onChange={e => setWorkforceCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded text-xs font-mono"
              style={{
                background: 'var(--color-surface-container-med)',
                border: '1px solid var(--color-surface-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Work Shift
            </label>
            <select
              value={shift}
              onChange={e => setShift(e.target.value as any)}
              className="w-full px-3 py-2 rounded text-xs cursor-pointer"
              style={{
                background: 'var(--color-surface-container-med)',
                border: '1px solid var(--color-surface-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="DAY_SHIFT">Day Shift (08:00 - 17:00)</option>
              <option value="NIGHT_SHIFT">Night Shift (20:00 - 05:00)</option>
            </select>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Site & Environmental Conditions
            </label>
            <input
              type="text"
              value={siteConditions}
              onChange={e => setSiteConditions(e.target.value)}
              className="w-full px-3 py-2 rounded text-xs"
              style={{
                background: 'var(--color-surface-container-med)',
                border: '1px solid var(--color-surface-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 rounded-lg" style={{ background: 'var(--color-surface-container-low)' }}>
          <Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-brand-yellow)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Compiling project records and safety rules...</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={20} style={{ color: '#F87171' }} />
          <div>
            <div className="text-xs font-semibold text-red-400">Briefing Compilation Error</div>
            <div className="text-xs text-gray-300">{error}</div>
          </div>
        </div>
      )}

      {/* Briefing Results */}
      {briefing && !loading && (
        <div className="space-y-5 animate-fade-in">
          {/* Executive Summary Banner */}
          <div className="p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ background: 'var(--color-surface-container-high)', borderLeft: '4px solid var(--color-brand-yellow)' }}>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-yellow">
                  {briefing.project_name}
                </span>
                <span className="text-xs font-mono text-gray-400">({briefing.chainage_range})</span>
              </div>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                {briefing.summary}
              </p>
            </div>
            {briefing.weather_advisory && (
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border-subtle)' }}>
                <CloudSun size={14} style={{ color: 'var(--color-brand-yellow)' }} />
                <span>Weather: {briefing.weather_advisory.status}</span>
              </div>
            )}
          </div>

          {/* Active Risk Alerts */}
          {briefing.risk_alerts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  <AlertTriangle size={13} style={{ color: '#F87171' }} />
                  Active Project Record Alerts & Quality Holds ({briefing.risk_alerts.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {briefing.risk_alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg flex flex-col justify-between"
                    style={{
                      background: 'var(--color-surface-container-low)',
                      border: '1px solid var(--color-surface-border-subtle)',
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {alert.title}
                        </span>
                        {getSeverityBadge(alert.severity)}
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                        {alert.description}
                      </p>
                    </div>

                    {alert.deep_link_url && (
                      <div className="mt-2.5 pt-2 border-t border-surface-border-subtle flex justify-end">
                        <button
                          onClick={() => navigate(alert.deep_link_url!)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-brand-yellow hover:underline cursor-pointer"
                        >
                          <span>Inspect Record</span>
                          <ExternalLink size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Task Breakdown */}
          <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              <ClipboardList size={13} style={{ color: 'var(--color-brand-yellow)' }} />
              Structured Daily Task Breakdown & Execution Sequence
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-surface-border-subtle text-[10px] uppercase text-gray-400">
                    <th className="pb-2 w-12 font-medium">Seq</th>
                    <th className="pb-2 font-medium">Task & Work Breakdown</th>
                    <th className="pb-2 font-medium">Assigned Trade / Gang</th>
                    <th className="pb-2 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Criticality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border-subtle">
                  {briefing.daily_task_breakdown.map((task, i) => (
                    <tr key={i} className="hover:bg-surface-container-high/40">
                      <td className="py-2.5 font-mono font-bold text-brand-yellow">#{task.sequence}</td>
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{task.task_name}</div>
                        <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{task.instructions}</div>
                      </td>
                      <td className="py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{task.trade}</td>
                      <td className="py-2.5 font-mono whitespace-nowrap" style={{ color: 'var(--color-text-code)' }}>{task.duration_hours} hrs</td>
                      <td className="py-2.5 whitespace-nowrap">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            background: task.safety_criticality === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : task.safety_criticality === 'HIGH' ? 'rgba(234,179,8,0.2)' : 'rgba(148,163,184,0.2)',
                            color: task.safety_criticality === 'CRITICAL' ? '#F87171' : task.safety_criticality === 'HIGH' ? '#FACC15' : '#94A3B8',
                          }}
                        >
                          {task.safety_criticality}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Required Materials & Safety Checklist Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Materials and Equipment */}
            <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Wrench size={13} style={{ color: '#38BDF8' }} />
                Required Materials & Equipment Takeoff
              </h3>
              <div className="space-y-2">
                {briefing.required_materials_and_equipment.map((mat, i) => (
                  <div key={i} className="p-2.5 rounded text-xs flex items-center justify-between" style={{ background: 'var(--color-surface-container-med)' }}>
                    <div>
                      <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{mat.item_name}</div>
                      <div className="text-[10px] mt-0.5 text-gray-400 font-mono">Spec: {mat.specification_code}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-brand-yellow text-xs">{mat.quantity_estimate}</div>
                      <span className="text-[9px] uppercase px-1 rounded text-gray-400">{mat.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mandatory Safety Checklist */}
            <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <ShieldCheck size={13} style={{ color: '#4ADE80' }} />
                Mandatory Safety Checklist & Code Compliance
              </h3>
              <div className="space-y-2">
                {briefing.safety_precautions_and_checklist.map((chk, i) => (
                  <div key={i} className="p-2.5 rounded text-xs space-y-1" style={{ background: 'var(--color-surface-container-med)' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-400">{chk.category}</span>
                      <span className="text-[10px] font-mono text-cyan-400">{chk.standard_reference}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      {chk.checkpoint_description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Metadata & Disclaimer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-surface-border-subtle text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            <div className="flex items-center gap-2">
              <Clock size={11} />
              <span>Generated at {new Date(briefing.generated_at_iso).toLocaleString()}</span>
              <span>•</span>
              <span>Provenance: {briefing.provenance}</span>
            </div>
            <div className="italic text-right max-w-md truncate" title={briefing.disclaimer}>
              {briefing.disclaimer}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
