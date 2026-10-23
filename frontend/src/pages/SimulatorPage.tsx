import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { DataProvenanceBadge } from '../components/DataProvenanceBadge';
import { ConfirmationModal } from '../components/ConfirmationModal';
import type {
  SimulatorEvaluateResponse,
  ScenarioItemResponse,
  NodeSourceDetailsResponse,
} from '../types/api';
import {
  Loader2, AlertTriangle, RefreshCw, ArrowRight, Shield,
  Calendar, IndianRupee, CheckCircle2, Bookmark, FolderPlus,
  Trash2, ExternalLink, Calculator, Layers, FileText, ChevronDown,
  ChevronUp, Sparkles, Scale, Info, Bot, ClipboardCheck
} from 'lucide-react';

export function SimulatorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL parameters for Evidence Graph integration
  const urlFindingId = searchParams.get('findingId') || 'FND-104';
  const urlNodeId = searchParams.get('nodeId');
  const urlGraphId = searchParams.get('graphId') || 'GR-FND104';

  // Evidence context from graph
  const [evidenceNode, setEvidenceNode] = useState<NodeSourceDetailsResponse | null>(null);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);

  // Baseline Parametric inputs
  const [baselineSlipDays, setBaselineSlipDays] = useState(18);
  const [baselineDemoCost, setBaselineDemoCost] = useState(530000);
  const [baselineGantryDays, setBaselineGantryDays] = useState(10);
  const [gantryRate, setGantryRate] = useState(150000);

  // Proposed Mitigation Parametric inputs
  const [curingHours, setCuringHours] = useState<36 | 48 | 72>(48);
  const [engineerSla, setEngineerSla] = useState(24);
  const [upvThreshold, setUpvThreshold] = useState(3850);
  const [cfrpBaseCost, setCfrpBaseCost] = useState(350000);
  const [cfrpLaborRate, setCfrpLaborRate] = useState(100000);

  // State
  const [result, setResult] = useState<SimulatorEvaluateResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);

  // Saved scenarios state
  const [savedScenarios, setSavedScenarios] = useState<ScenarioItemResponse[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('custom');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newScenarioDesc, setNewScenarioDesc] = useState('');
  const [isSavingScenario, setIsSavingScenario] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'matrix' | 'formulas' | 'provenance'>('matrix');
  const [showBaselineInputs, setShowBaselineInputs] = useState(true);

  // Load evidence node context if nodeId is in query params
  useEffect(() => {
    if (urlNodeId) {
      setIsLoadingEvidence(true);
      api.getNodeSourceDetails(urlGraphId, urlNodeId)
        .then(data => setEvidenceNode(data))
        .catch(() => setEvidenceNode(null))
        .finally(() => setIsLoadingEvidence(false));
    }
  }, [urlGraphId, urlNodeId]);

  // Load saved scenarios on mount
  useEffect(() => {
    loadSavedScenarios();
  }, [urlFindingId]);

  // Live sensitivity recalculation: changes to any input automatically recalculate
  // all dependent financial exposure, schedule impact, savings, and formulas in real-time.
  useEffect(() => {
    const timer = setTimeout(() => {
      handleRecalculate();
    }, 180);
    return () => clearTimeout(timer);
  }, [
    baselineSlipDays,
    baselineDemoCost,
    baselineGantryDays,
    gantryRate,
    curingHours,
    engineerSla,
    upvThreshold,
    cfrpBaseCost,
    cfrpLaborRate,
    urlFindingId,
    urlNodeId,
  ]);

  const loadSavedScenarios = async () => {
    try {
      const res = await api.listScenarios('PRJ-NH48-PKG3', urlFindingId);
      setSavedScenarios(res.scenarios);
    } catch {
      // Graceful fallback if no saved scenarios
    }
  };

  const validateInputs = (): string | null => {
    if (gantryRate < 0) return 'Gantry rate cannot be negative';
    if (baselineSlipDays < 0) return 'Baseline schedule slip cannot be negative';
    if (baselineDemoCost < 0) return 'Direct demolition cost cannot be negative';
    if (baselineGantryDays < 0) return 'Gantry idling days cannot be negative';
    if (engineerSla < 0) return 'Engineer SLA cannot be negative';
    if (upvThreshold < 0) return 'UPV threshold cannot be negative';
    if (cfrpBaseCost < 0) return 'CFRP material cost cannot be negative';
    if (cfrpLaborRate < 0) return 'CFRP labor rate cannot be negative';
    return null;
  };

  const handleRecalculate = async () => {
    const err = validateInputs();
    if (err) {
      setCalcError(err);
      return;
    }

    setIsCalculating(true);
    setCalcError(null);
    try {
      const res = await api.evaluateScenario({
        projectId: 'PRJ-NH48-PKG3',
        findingId: urlFindingId,
        graphNodeId: urlNodeId || undefined,
        baselineType: 'FULL_RECAST_DEMOLITION',
        scenarioType: 'CFRP_PRESSURE_INJECTION',
        parameters: {
          gantryIdlingDailyRateInr: gantryRate,
          cfrpCuringWindowHours: curingHours,
          independentEngineerSlaHours: engineerSla,
          upvTargetThresholdMps: upvThreshold,
          baselineScheduleSlipDays: baselineSlipDays,
          baselineDemolitionDirectCostInr: baselineDemoCost,
          baselineGantryIdlingDays: baselineGantryDays,
          cfrpBaseMaterialCostInr: cfrpBaseCost,
          cfrpDailyLaborRateInr: cfrpLaborRate,
        },
      });
      setResult(res);
      setIsDirty(false);
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    if (scenarioId === 'custom') {
      return;
    }
    const found = savedScenarios.find(s => s.id === scenarioId);
    if (found && found.parameters) {
      const p = found.parameters;
      if (p.gantryIdlingDailyRateInr !== undefined) setGantryRate(p.gantryIdlingDailyRateInr);
      if (p.cfrpCuringWindowHours) setCuringHours(p.cfrpCuringWindowHours);
      if (p.independentEngineerSlaHours !== undefined) setEngineerSla(p.independentEngineerSlaHours);
      if (p.upvTargetThresholdMps !== undefined) setUpvThreshold(p.upvTargetThresholdMps);
      if (p.baselineScheduleSlipDays !== undefined) setBaselineSlipDays(p.baselineScheduleSlipDays);
      if (p.baselineDemolitionDirectCostInr !== undefined) setBaselineDemoCost(p.baselineDemolitionDirectCostInr);
      if (p.baselineGantryIdlingDays !== undefined) setBaselineGantryDays(p.baselineGantryIdlingDays);
      if (p.cfrpBaseMaterialCostInr !== undefined) setCfrpBaseCost(p.cfrpBaseMaterialCostInr);
      if (p.cfrpDailyLaborRateInr !== undefined) setCfrpLaborRate(p.cfrpDailyLaborRateInr);
      setIsDirty(true);
    }
  };

  const handleSaveScenario = async () => {
    if (!newScenarioName.trim()) return;
    setIsSavingScenario(true);
    try {
      const saved = await api.saveScenario({
        name: newScenarioName.trim(),
        description: newScenarioDesc.trim() || undefined,
        projectId: 'PRJ-NH48-PKG3',
        findingId: urlFindingId,
        baselineType: 'FULL_RECAST_DEMOLITION',
        scenarioType: 'CFRP_PRESSURE_INJECTION',
        parameters: {
          gantryIdlingDailyRateInr: gantryRate,
          cfrpCuringWindowHours: curingHours,
          independentEngineerSlaHours: engineerSla,
          upvTargetThresholdMps: upvThreshold,
          baselineScheduleSlipDays: baselineSlipDays,
          baselineDemolitionDirectCostInr: baselineDemoCost,
          baselineGantryIdlingDays: baselineGantryDays,
          cfrpBaseMaterialCostInr: cfrpBaseCost,
          cfrpDailyLaborRateInr: cfrpLaborRate,
        },
      });
      setSavedScenarios(prev => [saved, ...prev]);
      setSelectedScenarioId(saved.id);
      setShowSaveModal(false);
      setNewScenarioName('');
      setNewScenarioDesc('');
      setSaveSuccessMsg(`Scenario "${saved.name}" saved successfully`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch {
      setCalcError('Failed to save scenario');
    } finally {
      setIsSavingScenario(false);
    }
  };

  const handleDeleteScenario = async (scenarioId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saved scenario?')) return;
    try {
      await api.deleteScenario(scenarioId);
      setSavedScenarios(prev => prev.filter(s => s.id !== scenarioId));
      if (selectedScenarioId === scenarioId) {
        setSelectedScenarioId('custom');
      }
    } catch {
      alert('Failed to delete scenario');
    }
  };

  const handleCommit = async () => {
    if (!result) return;
    setIsCommitting(true);
    try {
      const res = await api.commitScenario({
        simulationRunId: result.simulationRunId,
        findingId: urlFindingId,
        acknowledgement: true,
      });
      setCommitResult(res.message);
      setShowCommitModal(false);
      setTimeout(() => navigate('/overview'), 2000);
    } catch {
      setCommitResult('Failed to commit scenario');
    } finally {
      setIsCommitting(false);
    }
  };

  const markDirty = () => setIsDirty(true);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.015em' }}>
              What-if Risk Simulator
            </h1>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
              style={{
                background: 'rgba(56,189,248,0.15)',
                color: '#38BDF8',
                border: '1px solid rgba(56,189,248,0.3)',
              }}
            >
              PARAMETRIC WHAT-IF ENGINE
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Comparing Baseline Recast & Demolition vs Proposed CFRP Intervention for {urlFindingId}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DataProvenanceBadge type="CALCULATED" label="DETERMINISTIC MODEL" sublabel="UNITS & FORMULAS AUDITABLE" />
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors"
            style={{
              background: 'var(--color-surface-container-med)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-surface-border-default)',
            }}
          >
            <Bookmark size={13} style={{ color: 'var(--color-brand-yellow)' }} />
            <span>Save Current Scenario</span>
          </button>
        </div>
      </div>

      {/* Contextual Advisory Disclaimer Banner */}
      <div
        className="rounded-lg p-3.5 flex items-start gap-3 animate-fade-in"
        style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.28)',
        }}
      >
        <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
        <div className="space-y-0.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[11px]" style={{ color: '#F59E0B', fontFamily: 'var(--font-display)' }}>
              Contextual Engineering Disclaimer — Stated Project Assumptions
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
              ADVISORY ONLY
            </span>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
            Outputs are parametric estimates based on stated project inputs and equipment rates. Calculated values (such as gantry crane idling demurrage rates, specialized applicator rates, and curing intervals) are parametric and results do not constitute certified structural engineering, contractual claims advice, or binding construction forecasts.
          </p>
        </div>
      </div>

      {/* Evidence Graph Context Banner (if navigated from Evidence Graph) */}
      {urlNodeId && (
        <div
          className="rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in"
          style={{
            background: 'rgba(56,189,248,0.06)',
            border: '1px solid rgba(56,189,248,0.25)',
          }}
        >
          <div className="flex items-start gap-3">
            <Layers className="mt-0.5 shrink-0" size={18} style={{ color: '#38BDF8' }} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-bold" style={{ background: 'rgba(56,189,248,0.15)', color: '#38BDF8' }}>
                  Linked Evidence Node: {urlNodeId}
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {isLoadingEvidence ? 'Loading evidence details...' : (evidenceNode?.title || 'Intervention Node')}
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                {evidenceNode?.rationale || 'Parametric assumptions aligned with structural defect remediation specifications.'}
              </p>
              {evidenceNode?.documentTitle && (
                <div className="flex items-center gap-2 mt-1.5 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  <FileText size={11} />
                  <span>Source: {evidenceNode.documentTitle} (Page {evidenceNode.pageNumber || 1})</span>
                  {evidenceNode.passageContent && (
                    <span className="font-mono text-gray-400">"{evidenceNode.passageContent.slice(0, 80)}..."</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => navigate(`/evidence-graph?findingId=${urlFindingId}&nodeId=${urlNodeId}`)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors hover:bg-surface-container-high"
              style={{
                background: 'var(--color-surface-container-high)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-surface-border-default)',
              }}
            >
              <ExternalLink size={11} />
              View in Evidence Graph
            </button>
            <button
              onClick={() => navigate(`/inspections/${urlFindingId}`)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors"
              style={{
                background: 'rgba(245, 197, 66, 0.15)',
                color: 'var(--color-brand-yellow)',
                border: '1px solid rgba(245, 197, 66, 0.3)',
              }}
            >
              <ClipboardCheck size={11} />
              Inspect {urlFindingId}
            </button>
            <button
              onClick={() => navigate(`/assistant?prompt=${encodeURIComponent(`What is the schedule and financial risk of ${urlFindingId} if remediation is delayed?`)}`)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors"
              style={{
                background: 'var(--color-surface-container-high)',
                color: '#38BDF8',
                border: '1px solid rgba(56,189,248,0.3)',
              }}
            >
              <Bot size={11} />
              Site Assistant
            </button>
          </div>
        </div>
      )}

      {/* Scenario Selector & Preset Bar */}
      <div
        className="rounded-lg p-3 flex flex-wrap items-center justify-between gap-3"
        style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <FolderPlus size={15} style={{ color: 'var(--color-brand-yellow)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            Active Scenario:
          </span>
          <select
            value={selectedScenarioId}
            onChange={e => handleSelectScenario(e.target.value)}
            className="rounded px-2.5 py-1 text-xs outline-none cursor-pointer"
            style={{
              background: 'var(--color-surface-container-med)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-surface-border-default)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <option value="custom">Scratchpad / Dynamic Custom</option>
            {savedScenarios.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide mr-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Presets:
          </span>
          <button
            onClick={() => {
              setCuringHours(48);
              setEngineerSla(24);
              setGantryRate(150000);
              markDirty();
            }}
            className="px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition-colors"
            style={{
              background: curingHours === 48 && engineerSla === 24 ? 'rgba(245,197,66,0.15)' : 'var(--color-surface-container-med)',
              color: curingHours === 48 && engineerSla === 24 ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-surface-border-subtle)',
            }}
          >
            Standard Spec (48h/24h)
          </button>
          <button
            onClick={() => {
              setCuringHours(72);
              setEngineerSla(48);
              setGantryRate(200000);
              markDirty();
            }}
            className="px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition-colors"
            style={{
              background: curingHours === 72 && engineerSla === 48 ? 'rgba(245,197,66,0.15)' : 'var(--color-surface-container-med)',
              color: curingHours === 72 && engineerSla === 48 ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-surface-border-subtle)',
            }}
          >
            Conservative (72h/48h)
          </button>
          <button
            onClick={() => {
              setCuringHours(36);
              setEngineerSla(12);
              setGantryRate(150000);
              markDirty();
            }}
            className="px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition-colors"
            style={{
              background: curingHours === 36 && engineerSla === 12 ? 'rgba(245,197,66,0.15)' : 'var(--color-surface-container-med)',
              color: curingHours === 36 && engineerSla === 12 ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-surface-border-subtle)',
            }}
          >
            Fast-Track (36h/12h)
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div
          className="p-3 rounded text-xs animate-fade-in flex items-center gap-2"
          style={{
            background: 'rgba(46,125,79,0.14)',
            color: 'var(--color-prov-verified)',
            border: '1px solid rgba(34,197,94,0.30)',
          }}
        >
          <CheckCircle2 size={14} />
          {saveSuccessMsg}
        </div>
      )}

      {/* Main Grid: Inputs (1 col) and Comparison (2 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Parametric Inputs */}
        <div className="space-y-4">
          {/* Baseline Recast Assumptions Box */}
          <div
            className="rounded-lg p-4"
            style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
          >
            <div
              className="flex items-center justify-between cursor-pointer mb-3"
              onClick={() => setShowBaselineInputs(!showBaselineInputs)}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-prov-risk)' }} />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-prov-risk)' }}>
                  1. Baseline Assumptions (Recast)
                </h3>
              </div>
              {showBaselineInputs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>

            {showBaselineInputs && (
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                      Baseline Recast Delay (Days)
                    </label>
                    <span className="text-[9px] font-mono text-gray-400">{baselineSlipDays} Days Demolition Window</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="45"
                      value={baselineSlipDays}
                      onChange={e => { setBaselineSlipDays(Math.max(0, Number(e.target.value))); markDirty(); }}
                      className="flex-1 accent-amber-400 cursor-pointer h-1.5 rounded bg-gray-700"
                    />
                    <input
                      type="number"
                      min="0"
                      value={baselineSlipDays}
                      onChange={e => { setBaselineSlipDays(Math.max(0, Number(e.target.value))); markDirty(); }}
                      className="w-16 rounded px-2 py-1 text-xs font-mono outline-none text-right"
                      style={{
                        background: 'var(--color-surface-container-med)',
                        color: 'var(--color-text-code)',
                        border: '1px solid var(--color-surface-border-default)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                      Direct Demolition & Civil Cost (₹)
                    </label>
                    <span className="text-[9px] font-mono text-gray-400">₹{(baselineDemoCost / 100000).toFixed(2)}L</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="50000"
                      max="1500000"
                      step="10000"
                      value={baselineDemoCost}
                      onChange={e => { setBaselineDemoCost(Math.max(0, Number(e.target.value))); markDirty(); }}
                      className="flex-1 accent-amber-400 cursor-pointer h-1.5 rounded bg-gray-700"
                    />
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      value={baselineDemoCost}
                      onChange={e => { setBaselineDemoCost(Math.max(0, Number(e.target.value))); markDirty(); }}
                      className="w-24 rounded px-2 py-1 text-xs font-mono outline-none text-right"
                      style={{
                        background: 'var(--color-surface-container-med)',
                        color: 'var(--color-text-code)',
                        border: '1px solid var(--color-surface-border-default)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                      Gantry Demurrage Rate (₹/Day)
                    </label>
                    <span className="text-[9px] font-mono text-gray-400">₹{(gantryRate / 1000).toFixed(0)}k/day</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="25000"
                      max="350000"
                      step="5000"
                      value={gantryRate}
                      onChange={e => { setGantryRate(Math.max(0, Number(e.target.value))); markDirty(); }}
                      className="flex-1 accent-amber-400 cursor-pointer h-1.5 rounded bg-gray-700"
                    />
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      value={gantryRate}
                      onChange={e => { setGantryRate(Math.max(0, Number(e.target.value))); markDirty(); }}
                      className="w-24 rounded px-2 py-1 text-xs font-mono outline-none text-right"
                      style={{
                        background: 'var(--color-surface-container-med)',
                        color: 'var(--color-text-code)',
                        border: '1px solid var(--color-surface-border-default)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                      Gantry Idling Days
                    </label>
                    <span className="text-[9px] font-mono text-gray-400">{baselineGantryDays} Days Demurrage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="1"
                      value={baselineGantryDays}
                      onChange={e => { setBaselineGantryDays(Math.max(0, Number(e.target.value))); markDirty(); }}
                      className="flex-1 accent-amber-400 cursor-pointer h-1.5 rounded bg-gray-700"
                    />
                    <input
                      type="number"
                      min="0"
                      value={baselineGantryDays}
                      onChange={e => { setBaselineGantryDays(Math.max(0, Number(e.target.value))); markDirty(); }}
                      className="w-16 rounded px-2 py-1 text-xs font-mono outline-none text-right"
                      style={{
                        background: 'var(--color-surface-container-med)',
                        color: 'var(--color-text-code)',
                        border: '1px solid var(--color-surface-border-default)',
                      }}
                    />
                  </div>
                </div>

                <div className="pt-1.5 text-[10px] text-gray-400 font-mono bg-black/20 p-2 rounded border border-white/5">
                  <span className="text-gray-500 uppercase text-[9px] block mb-0.5">Live Baseline Formula:</span>
                  (₹{gantryRate.toLocaleString()} × {baselineGantryDays}d) + ₹{baselineDemoCost.toLocaleString()} = <span className="font-bold text-amber-300">₹{((gantryRate * baselineGantryDays) + baselineDemoCost).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Proposed Mitigation Assumptions Box */}
          <div
            className="rounded-lg p-4"
            style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-prov-verified)' }} />
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-prov-verified)' }}>
                2. Proposed Mitigation (CFRP Injection)
              </h3>
            </div>

            {/* CFRP Curing Period */}
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--color-text-tertiary)' }}>
                CFRP Resin Curing Window
              </label>
              <div className="flex gap-2">
                {([36, 48, 72] as const).map(hours => (
                  <button
                    key={hours}
                    onClick={() => { setCuringHours(hours); markDirty(); }}
                    className="flex-1 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
                    style={{
                      background: curingHours === hours ? 'rgba(245,197,66,0.15)' : 'var(--color-surface-container-med)',
                      color: curingHours === hours ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
                      border: curingHours === hours ? '1px solid rgba(245,197,66,0.4)' : '1px solid var(--color-surface-border-default)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {hours}h
                    {hours === 48 && <span className="block text-[8px] opacity-70 font-normal">Spec</span>}
                    {hours === 72 && <span className="block text-[8px] opacity-70 font-normal">Conserv.</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Engineer SLA */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                  Independent Engineer Review (Hours)
                </label>
                <span className="text-[9px] font-mono text-gray-400">{(engineerSla / 24).toFixed(1)} Days</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="6"
                  max="72"
                  step="6"
                  value={engineerSla}
                  onChange={e => { setEngineerSla(Math.max(0, Number(e.target.value))); markDirty(); }}
                  className="flex-1 accent-amber-400 cursor-pointer h-1.5 rounded bg-gray-700"
                />
                <input
                  type="number"
                  min="0"
                  value={engineerSla}
                  onChange={e => { setEngineerSla(Math.max(0, Number(e.target.value))); markDirty(); }}
                  className="w-16 rounded px-2 py-1 text-xs font-mono outline-none text-right"
                  style={{
                    background: 'var(--color-surface-container-med)',
                    color: 'var(--color-text-code)',
                    border: '1px solid var(--color-surface-border-default)',
                  }}
                />
              </div>
            </div>

            {/* UPV Threshold */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                  UPV Target Threshold (m/s)
                </label>
                <span className="text-[9px] font-mono text-amber-400/90 font-medium bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                  Observed: 3,850 m/s (DOC-5442BA12E9) • Target &gt;4,000 m/s
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="3000"
                  max="4400"
                  step="25"
                  value={upvThreshold}
                  onChange={e => { setUpvThreshold(Math.max(0, Number(e.target.value))); markDirty(); }}
                  className="flex-1 accent-amber-400 cursor-pointer h-1.5 rounded bg-gray-700"
                />
                <input
                  type="number"
                  min="0"
                  value={upvThreshold}
                  onChange={e => { setUpvThreshold(Math.max(0, Number(e.target.value))); markDirty(); }}
                  className="w-20 rounded px-2 py-1 text-xs font-mono outline-none text-right"
                  style={{
                    background: 'var(--color-surface-container-med)',
                    color: 'var(--color-text-code)',
                    border: '1px solid var(--color-surface-border-default)',
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Field log DOC-5442BA12E9 measured 3,850 m/s (IS:13311 Part 1 &quot;Good&quot; grade: 3,500–4,000 m/s). Full remediation acceptance target is typically &gt;4,000 m/s (&quot;Excellent&quot;). IRC:SP:40 is unverified.
              </p>
            </div>

            {/* Cost inputs */}
            <div className="space-y-2 mb-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                    CFRP Materials (₹)
                  </label>
                  <span className="text-[9px] font-mono text-gray-400">₹{(cfrpBaseCost / 100000).toFixed(2)}L</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="50000"
                    max="1000000"
                    step="10000"
                    value={cfrpBaseCost}
                    onChange={e => { setCfrpBaseCost(Math.max(0, Number(e.target.value))); markDirty(); }}
                    className="flex-1 accent-amber-400 cursor-pointer h-1.5 rounded bg-gray-700"
                  />
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={cfrpBaseCost}
                    onChange={e => { setCfrpBaseCost(Math.max(0, Number(e.target.value))); markDirty(); }}
                    className="w-24 rounded px-2 py-1 text-xs font-mono outline-none text-right"
                    style={{
                      background: 'var(--color-surface-container-med)',
                      color: 'var(--color-text-code)',
                      border: '1px solid var(--color-surface-border-default)',
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                    Tech Labor (₹/Day)
                  </label>
                  <span className="text-[9px] font-mono text-gray-400">₹{(cfrpLaborRate / 1000).toFixed(0)}k/day</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="25000"
                    max="250000"
                    step="5000"
                    value={cfrpLaborRate}
                    onChange={e => { setCfrpLaborRate(Math.max(0, Number(e.target.value))); markDirty(); }}
                    className="flex-1 accent-amber-400 cursor-pointer h-1.5 rounded bg-gray-700"
                  />
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={cfrpLaborRate}
                    onChange={e => { setCfrpLaborRate(Math.max(0, Number(e.target.value))); markDirty(); }}
                    className="w-24 rounded px-2 py-1 text-xs font-mono outline-none text-right"
                    style={{
                      background: 'var(--color-surface-container-med)',
                      color: 'var(--color-text-code)',
                      border: '1px solid var(--color-surface-border-default)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-1.5 text-[10px] text-gray-400 font-mono bg-black/20 p-2 rounded border border-white/5 mb-3">
              <span className="text-gray-500 uppercase text-[9px] block mb-0.5">Live Mitigation Formula:</span>
              ₹{cfrpBaseCost.toLocaleString()} + ({(curingHours / 24).toFixed(2)}d × ₹{cfrpLaborRate.toLocaleString()}/d) = <span className="font-bold text-green-300">₹{(cfrpBaseCost + Math.floor((curingHours / 24) * cfrpLaborRate)).toLocaleString()}</span>
            </div>

            {/* Recalculate button */}
            <button
              onClick={handleRecalculate}
              disabled={isCalculating}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${isDirty ? 'animate-pulse-amber' : ''}`}
              style={{
                background: 'var(--color-brand-yellow)',
                color: 'var(--color-surface-base)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {isCalculating ? (
                <><Loader2 className="animate-spin" size={13} /> Calculating...</>
              ) : (
                <><RefreshCw size={13} /> Recalculate Dynamic Trajectory</>
              )}
            </button>

            {calcError && (
              <p className="mt-2 text-xs" style={{ color: 'var(--color-prov-risk)' }}>{calcError}</p>
            )}
          </div>
        </div>

        {/* Right Columns: Comparison, Calculations, and Provenance */}
        <div className="xl:col-span-2 space-y-4">
          {/* Navigation tabs */}
          <div
            className="flex items-center gap-2 border-b pb-2"
            style={{ borderColor: 'var(--color-surface-border-subtle)' }}
          >
            <button
              onClick={() => setActiveTab('matrix')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
              style={{
                background: activeTab === 'matrix' ? 'var(--color-surface-container-high)' : 'transparent',
                color: activeTab === 'matrix' ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
                border: activeTab === 'matrix' ? '1px solid rgba(245,197,66,0.3)' : '1px solid transparent',
              }}
            >
              <Scale size={13} />
              Scenario Comparison Matrix
            </button>
            <button
              onClick={() => setActiveTab('formulas')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
              style={{
                background: activeTab === 'formulas' ? 'var(--color-surface-container-high)' : 'transparent',
                color: activeTab === 'formulas' ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
                border: activeTab === 'formulas' ? '1px solid rgba(245,197,66,0.3)' : '1px solid transparent',
              }}
            >
              <Calculator size={13} />
              Transparent Formula Breakdown
            </button>
            <button
              onClick={() => setActiveTab('provenance')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
              style={{
                background: activeTab === 'provenance' ? 'var(--color-surface-container-high)' : 'transparent',
                color: activeTab === 'provenance' ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
                border: activeTab === 'provenance' ? '1px solid rgba(245,197,66,0.3)' : '1px solid transparent',
              }}
            >
              <Layers size={13} />
              Input Classification & Boundaries
            </button>
          </div>

          {!result && !isCalculating && (
            <div
              className="rounded-lg p-8 flex flex-col items-center justify-center h-64"
              style={{ background: 'var(--color-surface-container-low)', border: '1px dashed var(--color-surface-border-default)' }}
            >
              <RefreshCw size={32} style={{ color: 'var(--color-text-tertiary)' }} />
              <p className="text-sm mt-3" style={{ color: 'var(--color-text-secondary)' }}>
                Configure parameters and click Recalculate to run scenario analysis
              </p>
            </div>
          )}

          {result && activeTab === 'matrix' && (
            <>
              {/* Comparison Matrix Card */}
              <div
                className="rounded-lg p-4 animate-fade-in"
                style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                    Baseline vs Proposed Intervention Matrix
                  </h3>
                  <span className="text-[10px] font-mono text-gray-400">Run ID: {result.simulationRunId}</span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div />
                  <div className="text-center p-2 rounded" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-prov-risk)' }}>
                      Baseline (Full Recast)
                    </span>
                    <span className="text-[9px] text-gray-400">Demolition & Recast</span>
                  </div>
                  <div className="text-center p-2 rounded" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-prov-verified)' }}>
                      Proposed Mitigation
                    </span>
                    <span className="text-[9px] text-gray-400">CFRP Pressure Injection</span>
                  </div>

                  {/* Schedule */}
                  <div className="flex items-center gap-2">
                    <Calendar size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Schedule Slip</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xl font-bold" style={{ color: 'var(--color-prov-risk)', fontFamily: 'var(--font-display)' }}>
                      +{result.baselineScheduleSlipDays}
                    </span>
                    <span className="text-xs ml-1" style={{ color: 'var(--color-text-tertiary)' }}>Days</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xl font-bold" style={{ color: 'var(--color-prov-verified)', fontFamily: 'var(--font-display)' }}>
                      +{result.scenarioScheduleSlipDays}
                    </span>
                    <span className="text-xs ml-1" style={{ color: 'var(--color-text-tertiary)' }}>Days</span>
                  </div>

                  {/* Financial */}
                  <div className="flex items-center gap-2">
                    <IndianRupee size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Financial Exposure</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xl font-bold" style={{ color: 'var(--color-prov-risk)', fontFamily: 'var(--font-display)' }}>
                      ₹{(result.baselineFinancialExposureInr / 100000).toFixed(2)}L
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-xl font-bold" style={{ color: 'var(--color-prov-verified)', fontFamily: 'var(--font-display)' }}>
                      ₹{(result.scenarioProposedCostInr / 100000).toFixed(2)}L
                    </span>
                  </div>
                </div>

                {/* Net Delta Summary Box */}
                <div
                  className="rounded-md p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                  style={{
                    background: result.netCalculatedAvoidanceInr >= 0 ? 'rgba(46,125,79,0.10)' : 'rgba(239,68,68,0.10)',
                    border: result.netCalculatedAvoidanceInr >= 0 ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles size={18} style={{ color: result.daysRecovered >= 0 ? 'var(--color-prov-verified)' : 'var(--color-prov-risk)' }} />
                    <div>
                      <span className="text-sm font-bold" style={{ color: result.daysRecovered >= 0 ? 'var(--color-prov-verified)' : 'var(--color-prov-risk)' }}>
                        {result.daysRecovered >= 0 ? `+${result.daysRecovered} Days Recovered` : `${Math.abs(result.daysRecovered)} Days Additional Delay`}
                      </span>
                      <span className="text-xs ml-2 font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                        ({result.windowCompressionPercent}% schedule {result.windowCompressionPercent >= 0 ? 'compression' : 'expansion'})
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-base font-bold mr-1.5" style={{ color: result.netCalculatedAvoidanceInr >= 0 ? 'var(--color-prov-verified)' : 'var(--color-prov-risk)', fontFamily: 'var(--font-display)' }}>
                      {result.netCalculatedAvoidanceInr >= 0
                        ? `₹${(result.netCalculatedAvoidanceInr / 100000).toFixed(2)}L`
                        : `-₹${(Math.abs(result.netCalculatedAvoidanceInr) / 100000).toFixed(2)}L`}
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      {result.netCalculatedAvoidanceInr >= 0
                        ? `Net Avoidance (${result.costReductionPercent || 0}% cost reduction)`
                        : `Net Cost Increase (${Math.abs(result.costReductionPercent || 0)}% cost increase)`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparative Driver Explanation Box */}
              {result.comparisonSummary && (
                <div
                  className="rounded-lg p-4 animate-fade-in"
                  style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={14} style={{ color: 'var(--color-brand-yellow)' }} />
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand-yellow)' }}>
                      What Drives This Result?
                    </h3>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {result.comparisonSummary}
                  </p>

                  {result.drivingFactors && result.drivingFactors.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-surface-border-subtle)' }}>
                      {result.drivingFactors.map((df, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded text-[11px] font-mono"
                          style={{ background: 'var(--color-surface-container-med)', color: 'var(--color-text-primary)' }}
                        >
                          • {df}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Milestones Delta Table */}
              <div
                className="rounded-lg p-4 animate-fade-in"
                style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                    CPM Critical Path Milestones (P6 Alignment)
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-amber-400 bg-amber-500/10 border border-amber-500/20">
                    Rev 4.1 Alignment (Unverified Target Dates)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--color-surface-container-med)' }}>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>WBS Code</th>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>Description</th>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>P6 Base Target</th>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>Projected Date</th>
                        <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>Drift</th>
                        <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.milestonesDelta.map(m => (
                        <tr key={m.wbsCode} className="border-t" style={{ borderColor: 'var(--color-surface-border-subtle)' }}>
                          <td className="px-3 py-2 font-mono font-bold" style={{ color: 'var(--color-text-code)' }}>{m.wbsCode}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{m.description}</td>
                          <td className="px-3 py-2 font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{m.p6BaseDate}</td>
                          <td className="px-3 py-2 font-mono font-medium" style={{ color: 'var(--color-text-secondary)' }}>{m.scenarioDate}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: 'var(--color-prov-risk)' }}>
                            {m.netDriftDays > 0 ? `+${m.netDriftDays}d` : `${m.netDriftDays}d`}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{
                              background: m.pathStatus.includes('ON_SCHEDULE') || m.pathStatus.includes('ACCELERATED') ? 'rgba(46,125,79,0.14)' : 'rgba(245,197,66,0.14)',
                              color: m.pathStatus.includes('ON_SCHEDULE') || m.pathStatus.includes('ACCELERATED') ? '#4ADE80' : '#FBBF24',
                              fontFamily: 'var(--font-mono)',
                            }}>
                              {m.pathStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Structural Feasibility Assessment */}
              <div
                className="rounded-lg p-4 animate-fade-in"
                style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
              >
                <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                  Feasibility & Compliance Assessment
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded" style={{ background: 'var(--color-surface-container-med)' }}>
                    <Shield size={20} style={{ color: 'var(--color-prov-verified)', margin: '0 auto 4px' }} />
                    <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-prov-verified)' }}>
                      {result.feasibilityAssessment.structuralResiliencePercent}%
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Shear Capacity Retention</p>
                  </div>
                  <div className="text-center p-3 rounded" style={{ background: 'var(--color-surface-container-med)' }}>
                    <CheckCircle2 size={20} style={{ color: result.feasibilityAssessment.authorityAcceptanceRisk === 'LOW' ? '#4ADE80' : '#FBBF24', margin: '0 auto 4px' }} />
                    <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: result.feasibilityAssessment.authorityAcceptanceRisk === 'LOW' ? '#4ADE80' : '#FBBF24' }}>
                      {result.feasibilityAssessment.authorityAcceptanceRisk}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Authority Acceptance Risk</p>
                  </div>
                  <div className="text-center p-3 rounded" style={{ background: 'var(--color-surface-container-med)' }}>
                    <Calendar size={20} style={{ color: 'var(--color-text-secondary)', margin: '0 auto 4px' }} />
                    <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
                      {result.feasibilityAssessment.designLifeYears}+
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Design Life (Years)</p>
                  </div>
                </div>
              </div>

              {/* Commit Action Button */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCommitModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-semibold transition-colors cursor-pointer"
                  style={{
                    background: 'var(--color-brand-yellow)',
                    color: 'var(--color-surface-base)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  <ArrowRight size={16} />
                  COMMIT SCENARIO TO WORKING BASELINE
                </button>
              </div>

              {commitResult && (
                <div
                  className="p-3 rounded text-xs animate-fade-in"
                  style={{
                    background: 'rgba(46,125,79,0.14)',
                    color: 'var(--color-prov-verified)',
                    border: '1px solid rgba(34,197,94,0.30)',
                  }}
                >
                  {commitResult}
                </div>
              )}
            </>
          )}

          {/* Transparent Formulas Tab */}
          {result && activeTab === 'formulas' && (
            <div className="space-y-4 animate-fade-in">
              <div
                className="rounded-lg p-4"
                style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Calculator size={16} style={{ color: 'var(--color-brand-yellow)' }} />
                  <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                    Auditable Deterministic Equations & Calculations
                  </h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                  All outputs are computed deterministically without black-box or non-deterministic AI generation. The calculations below can be directly audited and traced back to contractual rate schedules.
                </p>

                {result.formulaBreakdown && (
                  <div className="space-y-3">
                    {Object.entries(result.formulaBreakdown).map(([key, item]) => (
                      <div
                        key={key}
                        className="p-3 rounded-md border"
                        style={{ background: 'var(--color-surface-container-med)', borderColor: 'var(--color-surface-border-subtle)' }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-brand-yellow)' }}>
                            {key}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-text-secondary)' }}>
                            Unit: {item.units}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="text-[11px] font-mono text-gray-400">
                            <span className="text-[10px] uppercase font-bold text-gray-500 mr-2">Formula:</span>
                            {item.formula}
                          </div>
                          <div className="text-[11px] font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                            <span className="text-[10px] uppercase font-bold text-gray-500 mr-2">Substituted:</span>
                            {item.arithmetic}
                          </div>
                          <div className="text-xs font-mono font-bold pt-1" style={{ color: 'var(--color-prov-verified)' }}>
                            <span className="text-[10px] uppercase font-bold text-gray-500 mr-2">Result:</span>
                            {item.result}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Input Provenance & Boundaries Tab */}
          {result && activeTab === 'provenance' && (
            <div className="space-y-4 animate-fade-in">
              <div
                className="rounded-lg p-4"
                style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={16} style={{ color: 'var(--color-brand-yellow)' }} />
                  <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                    Input Provenance Classification
                  </h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                  Inputs and parameters are strictly separated into user-entered assumptions, source-backed facts, synthetic demonstration values, and calculated results.
                </p>

                {result.inputClassification && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User Entered */}
                    <div className="p-3 rounded border" style={{ background: 'var(--color-surface-container-med)', borderColor: 'var(--color-surface-border-subtle)' }}>
                      <span className="text-xs font-bold uppercase tracking-wide block mb-2" style={{ color: '#60A5FA' }}>
                        1. User-Entered Assumptions ({result.inputClassification.userEntered.length})
                      </span>
                      <ul className="space-y-1.5 text-xs">
                        {result.inputClassification.userEntered.map((item, i) => (
                          <li key={i} className="flex justify-between items-center text-[11px]">
                            <span className="font-mono text-gray-300">{item.param}</span>
                            <span className="font-mono font-bold text-blue-300">{item.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Source References & Verification Status */}
                    <div className="p-3 rounded border" style={{ background: 'var(--color-surface-container-med)', borderColor: 'var(--color-surface-border-subtle)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wide block" style={{ color: '#FBBF24' }}>
                          2. External References & Claims ({result.inputClassification.sourceBacked.length})
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold">
                          AUDIT STATUS
                        </span>
                      </div>
                      <ul className="space-y-2 text-xs">
                        {result.inputClassification.sourceBacked.map((item, i) => (
                          <li key={i} className="text-[11px] p-2 rounded bg-black/25 border border-white/5 space-y-1">
                            <div className="flex justify-between items-center font-mono">
                              <span className="text-gray-300 font-semibold">{item.param}</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-bold ${item.isVerified ? 'text-green-300' : 'text-amber-300'}`}>{item.value}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                  item.isVerified
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {item.verificationStatus || (item.isVerified ? 'VERIFIED' : 'UNVERIFIED')}
                                </span>
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-400">
                              <span className="text-gray-500">Claimed Standard:</span> {item.source}
                            </div>
                            {item.verificationNote && (
                              <div className="text-[10px] text-amber-400/90 italic bg-amber-500/10 p-1.5 rounded border border-amber-500/20 leading-relaxed">
                                ⚠ {item.verificationNote}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Synthetic Demo */}
                    <div className="p-3 rounded border" style={{ background: 'var(--color-surface-container-med)', borderColor: 'var(--color-surface-border-subtle)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wide block" style={{ color: '#FBBF24' }}>
                          3. Synthetic Demo Inputs ({result.inputClassification.syntheticDemo.length})
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold">
                          ESTIMATES ONLY
                        </span>
                      </div>
                      <ul className="space-y-1.5 text-xs">
                        {result.inputClassification.syntheticDemo.map((item, i) => (
                          <li key={i} className="text-[11px] p-1.5 rounded bg-black/15">
                            <div className="flex justify-between font-mono">
                              <span className="text-gray-300">{item.param}</span>
                              <span className="font-bold text-amber-300">{item.value}</span>
                            </div>
                            <span className="text-[10px] text-gray-500 block mt-0.5">Note: {item.source}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Calculated */}
                    <div className="p-3 rounded border" style={{ background: 'var(--color-surface-container-med)', borderColor: 'var(--color-surface-border-subtle)' }}>
                      <span className="text-xs font-bold uppercase tracking-wide block mb-2" style={{ color: '#C084FC' }}>
                        4. Calculated Metrics ({result.inputClassification.calculated.length})
                      </span>
                      <ul className="space-y-1.5 text-xs">
                        {result.inputClassification.calculated.map((item, i) => (
                          <li key={i} className="flex justify-between items-center text-[11px]">
                            <span className="font-mono text-gray-300">{item.metric}</span>
                            <span className="font-mono font-bold text-purple-300">{item.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Model Boundaries & Engineering Disclaimer */}
              <div
                className="rounded-lg p-4 animate-fade-in space-y-2.5"
                style={{ background: 'rgba(245,197,66,0.05)', border: '1px solid rgba(245,197,66,0.15)' }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-brand-yellow)', fontFamily: 'var(--font-display)' }}>
                    <AlertTriangle size={13} /> Model Boundaries & Certified Engineering Disclaimers
                  </h3>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                    NON-CERTIFIED ESTIMATES
                  </span>
                </div>
                {result.disclaimer && (
                  <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/25 text-xs font-medium text-amber-300 leading-relaxed">
                    {result.disclaimer}
                  </div>
                )}
                <ul className="space-y-1.5">
                  {result.modelBoundaries.map((b, i) => (
                    <li key={i} className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                      • {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Scenario Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-md rounded-lg p-5 space-y-4"
            style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-default)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                Save Named Scenario
              </h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Save current parameters, evaluated costs, and schedule slips under a named scenario for easy comparison.
            </p>

            <div>
              <label className="text-[10px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
                Scenario Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Fast-Track CFRP 48h Spec Rev B"
                value={newScenarioName}
                onChange={e => setNewScenarioName(e.target.value)}
                className="w-full rounded px-3 py-2 text-xs outline-none"
                style={{
                  background: 'var(--color-surface-container-med)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-surface-border-default)',
                }}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
                Description (Optional)
              </label>
              <textarea
                placeholder="Key assumptions, resin grade, or authority review SLA..."
                rows={2}
                value={newScenarioDesc}
                onChange={e => setNewScenarioDesc(e.target.value)}
                className="w-full rounded px-3 py-2 text-xs outline-none resize-none"
                style={{
                  background: 'var(--color-surface-container-med)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-surface-border-default)',
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1.5 rounded text-xs cursor-pointer"
                style={{
                  background: 'var(--color-surface-container-med)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScenario}
                disabled={isSavingScenario || !newScenarioName.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold cursor-pointer disabled:opacity-50"
                style={{
                  background: 'var(--color-brand-yellow)',
                  color: 'var(--color-surface-base)',
                }}
              >
                {isSavingScenario ? <Loader2 className="animate-spin" size={12} /> : <Bookmark size={12} />}
                Save Scenario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commit Modal */}
      <ConfirmationModal
        isOpen={showCommitModal}
        title="Commit Scenario to Working Baseline"
        description="Committing this scenario updates downstream working buffer dates. Does not overwrite certified master P6 baseline without Project Director approval."
        checkboxLabel="I acknowledge that this action adjusts working buffer dates and does not overwrite certified master P6 baseline without Project Director approval."
        confirmLabel="Confirm Commit"
        onConfirm={handleCommit}
        onCancel={() => setShowCommitModal(false)}
        isLoading={isCommitting}
      />
    </div>
  );
}
