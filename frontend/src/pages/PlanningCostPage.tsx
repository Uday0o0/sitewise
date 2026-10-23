import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { DataProvenanceBadge } from '../components/DataProvenanceBadge';
import {
  Calendar,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Filter,
  BarChart3,
  Scale,
  RefreshCw,
} from 'lucide-react';
import type { MaterialReconciliationItem, ContractorClaimItem } from '../types/api';

export function PlanningCostPage() {
  const navigate = useNavigate();
  const { data: overviewData } = useApi(() => api.getOverview('PRJ-NH48-PKG3'));
  const {
    data: materialsData,
    loading: materialsLoading,
    error: materialsError,
    refetch: refetchMaterials,
  } = useApi(() => api.getMaterialReconciliation('PRJ-NH48-PKG3'));
  const {
    data: claimsData,
    loading: claimsLoading,
    error: claimsError,
    refetch: refetchClaims,
  } = useApi(() => api.getContractorClaims('PRJ-NH48-PKG3'));

  const [activeTab, setActiveTab] = useState<'SCHEDULE' | 'MATERIALS' | 'CLAIMS'>('SCHEDULE');
  const [milestoneFilter, setMilestoneFilter] = useState<'ALL' | 'BLOCKED' | 'HOLD_RETEST' | 'ON_SCHEDULE'>('ALL');

  const cpmMilestones = overviewData?.cpmMilestones || [];

  const filteredMilestones = cpmMilestones.filter(m => {
    if (milestoneFilter === 'ALL') return true;
    return m.status === milestoneFilter;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-border-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Planning & Cost Reconciliation
            </h1>
            <DataProvenanceBadge type="CALCULATED_RISK" label="PARAMETRIC CPM MODEL" />
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Primavera P6 Critical Path CPM synchronization, BBS material reconciliation, and contractor claims exposure ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded text-xs" style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border-subtle)' }}>
            <Clock size={13} style={{ color: 'var(--color-brand-yellow)' }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>P6 Baseline:</span>
            <span className="font-mono font-semibold" style={{ color: 'var(--color-text-code)' }}>BL-2024-Q3-REV4 (14m ago)</span>
          </div>
          <button
            onClick={() => navigate('/simulator')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors"
            style={{
              background: 'var(--color-brand-yellow)',
              color: 'var(--color-surface-base)',
              fontFamily: 'var(--font-display)',
            }}
          >
            <span>Run What-If</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Critical Path Slip
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(239,68,68,0.18)', color: '#F87171' }}>
              CRITICAL DRIFT
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold font-mono text-red-400" style={{ fontFamily: 'var(--font-display)' }}>
              -4 Days
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              vs P6 Master Target
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Span 18-19 Precast Launch Blocked at Pier 18. Liquidated damage exposure: <strong className="text-gray-200">₹6.0 Lakhs</strong>.
          </p>
        </div>

        <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              BBS Steel Reconciled
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(46,125,79,0.18)', color: '#4ADE80' }}>
              WITHIN ±6% BAND
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold font-mono text-emerald-400" style={{ fontFamily: 'var(--font-display)' }}>
              94.2%
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              3,410 MT / 3,620 MT
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Rebar consumption within certified tender tolerance limits. Negative variance indicates -210 MT saving.
          </p>
        </div>

        <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Claims Exposure Under Review
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(217,154,53,0.18)', color: '#FBBF24' }}>
              3 CLAIMS FILED
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold font-mono text-yellow-400" style={{ fontFamily: 'var(--font-display)' }}>
              ₹12.4 L
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              assessed at ₹4.85 L
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Active dispute over Pier 18 gantry idling. What-if CFRP option recovers ₹14.80 L net avoidance.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-surface-border-subtle pb-2">
        <button
          onClick={() => setActiveTab('SCHEDULE')}
          className="flex items-center gap-2 px-3 py-2 rounded-t text-xs font-semibold transition-colors"
          style={{
            background: activeTab === 'SCHEDULE' ? 'var(--color-surface-container-high)' : 'transparent',
            color: activeTab === 'SCHEDULE' ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'SCHEDULE' ? '2px solid var(--color-brand-yellow)' : 'none',
          }}
        >
          <Calendar size={14} />
          <span>CPM Schedule & Critical Path Milestones</span>
        </button>
        <button
          onClick={() => setActiveTab('MATERIALS')}
          className="flex items-center gap-2 px-3 py-2 rounded-t text-xs font-semibold transition-colors"
          style={{
            background: activeTab === 'MATERIALS' ? 'var(--color-surface-container-high)' : 'transparent',
            color: activeTab === 'MATERIALS' ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'MATERIALS' ? '2px solid var(--color-brand-yellow)' : 'none',
          }}
        >
          <Scale size={14} />
          <span>BBS Material Consumption Reconciliation</span>
        </button>
        <button
          onClick={() => setActiveTab('CLAIMS')}
          className="flex items-center gap-2 px-3 py-2 rounded-t text-xs font-semibold transition-colors"
          style={{
            background: activeTab === 'CLAIMS' ? 'var(--color-surface-container-high)' : 'transparent',
            color: activeTab === 'CLAIMS' ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'CLAIMS' ? '2px solid var(--color-brand-yellow)' : 'none',
          }}
        >
          <DollarSign size={14} />
          <span>Contractor Claims & Liquidated Damages</span>
        </button>
      </div>

      {/* Tab 1: CPM Schedule Milestones */}
      {activeTab === 'SCHEDULE' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span style={{ color: 'var(--color-text-tertiary)' }}>Filter Status:</span>
              {(['ALL', 'BLOCKED', 'HOLD_RETEST', 'ON_SCHEDULE'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setMilestoneFilter(status)}
                  className="px-2 py-1 rounded text-xs font-mono transition-colors"
                  style={{
                    background: milestoneFilter === status ? 'var(--color-surface-container-high)' : 'transparent',
                    color: milestoneFilter === status ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
                    border: `1px solid ${milestoneFilter === status ? 'var(--color-brand-yellow)' : 'var(--color-surface-border-subtle)'}`,
                  }}
                >
                  {status}
                </button>
              ))}
            </div>

            <p className="text-[11px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
              Showing {filteredMilestones.length} of {cpmMilestones.length} tracked WBS activities
            </p>
          </div>

          <div
            className="rounded-lg overflow-hidden"
            style={{
              background: 'var(--color-surface-container-low)',
              border: '1px solid var(--color-surface-border-subtle)',
            }}
          >
            <table className="w-full text-left text-xs">
              <thead>
                <tr
                  className="uppercase tracking-wider font-semibold border-b"
                  style={{
                    background: 'var(--color-surface-container-med)',
                    borderColor: 'var(--color-surface-border-subtle)',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  <th className="px-4 py-3">WBS Code</th>
                  <th className="px-4 py-3">Activity Description</th>
                  <th className="px-3 py-3">P6 Baseline Date</th>
                  <th className="px-3 py-3">Projected Date</th>
                  <th className="px-3 py-3">Slack / Drift</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border-subtle font-mono">
                {filteredMilestones.map((m, i) => (
                  <tr key={i} className="hover:bg-surface-container-med/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-200">{m.wbsCode}</td>
                    <td className="px-4 py-3 font-sans text-gray-300">
                      <div className="flex items-center gap-2">
                        <span>{m.activityDesc}</span>
                        {m.slackDriftDays < 0 && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded font-bold" style={{ background: 'rgba(239,68,68,0.18)', color: '#F87171' }}>
                            CRITICAL PATH
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-400">{m.baselineDate}</td>
                    <td className="px-3 py-3 text-gray-200">{m.projectedDate}</td>
                    <td className="px-3 py-3">
                      <span
                        className="font-bold font-mono"
                        style={{
                          color: m.slackDriftDays < 0 ? '#F87171' : m.slackDriftDays > 0 ? '#4ADE80' : 'var(--color-text-secondary)',
                        }}
                      >
                        {m.slackDriftDays > 0 ? `+${m.slackDriftDays}` : m.slackDriftDays} Days
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MilestoneStatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Materials Reconciliation */}
      {activeTab === 'MATERIALS' && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
            <div>
              <p className="text-xs font-semibold text-gray-200" style={{ fontFamily: 'var(--font-display)' }}>
                Certified Bar Bending Schedule (BBS) Rebar Reconciliation
              </p>
              <p className="text-[11px] text-gray-400">
                Monthly contractual audit under CPWD Clause 42 & IRC:112 material consumption tolerances.
              </p>
            </div>
            <DataProvenanceBadge type="SYNTHETIC_DEMO" label="ILLUSTRATIVE BASELINE" tooltipText="Representative reconciliation values calibrated for NH-48 package 3 baseline. Not verified physical mill test certificates." />
          </div>

          {materialsLoading && (
            <div className="flex flex-col items-center justify-center p-12 space-y-3 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--color-brand-yellow)' }} />
              <p className="text-xs text-gray-400 font-mono">Loading certified material reconciliation records...</p>
            </div>
          )}

          {materialsError && (
            <div className="p-4 rounded-lg flex items-center justify-between" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)' }}>
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className="text-red-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-300">Failed to load material reconciliation data</p>
                  <p className="text-[11px] text-red-400/80 mt-0.5">{materialsError}</p>
                </div>
              </div>
              <button
                onClick={refetchMaterials}
                className="px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171', border: '1px solid rgba(239,68,68,0.4)' }}
              >
                <RefreshCw size={12} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {!materialsLoading && !materialsError && materialsData && materialsData.items.length === 0 && (
            <div className="text-center p-12 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <p className="text-xs text-gray-400 font-mono">No material reconciliation records found for this project package.</p>
            </div>
          )}

          {!materialsLoading && !materialsError && materialsData && materialsData.items.length > 0 && (
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: 'var(--color-surface-container-low)',
                border: '1px solid var(--color-surface-border-subtle)',
              }}
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className="uppercase tracking-wider font-semibold border-b"
                    style={{
                      background: 'var(--color-surface-container-med)',
                      borderColor: 'var(--color-surface-border-subtle)',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    <th className="px-4 py-3">Material & Specification</th>
                    <th className="px-3 py-3 text-right">Design Qty</th>
                    <th className="px-3 py-3 text-right">Actual Issued</th>
                    <th className="px-3 py-3 text-right">Variance</th>
                    <th className="px-4 py-3">Tender Band</th>
                    <th className="px-4 py-3 text-right">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border-subtle font-mono">
                  {materialsData.items.map((row: MaterialReconciliationItem) => (
                    <tr key={row.id} className="hover:bg-surface-container-med/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-sans font-semibold text-gray-200">{row.materialName}</p>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded font-bold" style={{ background: 'rgba(245,197,66,0.12)', color: '#F5C542' }}>
                            DEMO
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400">{row.specCode}</p>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-300">
                        {row.theoreticalQuantity.toLocaleString()} {row.unit}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-gray-100">
                        {row.actualIssuedQuantity.toLocaleString()} {row.unit}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className="font-bold"
                          style={{
                            color: row.variancePercent < 0 ? '#4ADE80' : row.variancePercent > 5 ? '#F87171' : '#FBBF24',
                          }}
                        >
                          {row.variancePercent > 0 ? `+${row.variancePercent}` : row.variancePercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-xs text-gray-400">
                        {row.contractualBand}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="text-[9px] font-mono px-2 py-0.5 rounded font-bold"
                          style={{
                            background: row.status === 'COMPLIANT' ? 'rgba(46,125,79,0.18)' : 'rgba(239,68,68,0.18)',
                            color: row.status === 'COMPLIANT' ? '#4ADE80' : '#F87171',
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Contractor Claims */}
      {activeTab === 'CLAIMS' && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
            <div>
              <p className="text-xs font-semibold text-gray-200" style={{ fontFamily: 'var(--font-display)' }}>
                Contractor Claims & Commercial Exposure Register
              </p>
              <p className="text-[11px] text-gray-400">
                Dispute and extension-of-time ledger under FIDIC / EPC Clause 8.4, 8.9, and 13.3.
              </p>
            </div>
            <DataProvenanceBadge type="SYNTHETIC_DEMO" label="ILLUSTRATIVE BASELINE" tooltipText="Representative claims ledger. Values and contractual clauses are calibrated illustrative examples." />
          </div>

          {claimsLoading && (
            <div className="flex flex-col items-center justify-center p-12 space-y-3 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--color-brand-yellow)' }} />
              <p className="text-xs text-gray-400 font-mono">Loading contractor commercial and delay claims...</p>
            </div>
          )}

          {claimsError && (
            <div className="p-4 rounded-lg flex items-center justify-between" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)' }}>
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className="text-red-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-300">Failed to load contractor claims data</p>
                  <p className="text-[11px] text-red-400/80 mt-0.5">{claimsError}</p>
                </div>
              </div>
              <button
                onClick={refetchClaims}
                className="px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171', border: '1px solid rgba(239,68,68,0.4)' }}
              >
                <RefreshCw size={12} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {!claimsLoading && !claimsError && claimsData && claimsData.claims.length === 0 && (
            <div className="text-center p-12 rounded-lg" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}>
              <p className="text-xs text-gray-400 font-mono">No contractor claims recorded for this project package.</p>
            </div>
          )}

          {!claimsLoading && !claimsError && claimsData && claimsData.claims.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {claimsData.claims.map((claim: ContractorClaimItem) => (
                <div
                  key={claim.id}
                  className="p-4 rounded-lg flex flex-col justify-between"
                  style={{
                    background: 'var(--color-surface-container-low)',
                    border: '1px solid var(--color-surface-border-subtle)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gray-200">{claim.id}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded font-bold" style={{ background: 'rgba(245,197,66,0.12)', color: '#F5C542' }}>
                          DEMO
                        </span>
                      </div>
                      <span
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: claim.status === 'UNDER_TECHNICAL_EVALUATION' ? 'rgba(217,154,53,0.18)' : 'rgba(56,189,248,0.18)',
                          color: claim.status === 'UNDER_TECHNICAL_EVALUATION' ? '#FBBF24' : '#38BDF8',
                        }}
                      >
                        {claim.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>
                      {claim.contractorName}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">{claim.clauseReference}</p>
                    <p className="text-xs text-gray-300 mt-2 leading-relaxed">{claim.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-surface-border-subtle">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Claimed:</span>
                      <span className="font-mono font-bold text-red-400">₹{claim.claimedAmountInrLakhs} Lakhs</span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-1">
                      <span className="text-gray-400">Consultant Exposure:</span>
                      <span className="font-mono font-bold text-yellow-400">₹{claim.assessedExposureInrLakhs} Lakhs</span>
                    </div>

                    {claim.linkedFindingId && (
                      <div className="mt-3">
                        <button
                          onClick={() => navigate(`/inspections/${claim.linkedFindingId}`)}
                          className="w-full py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          style={{
                            background: 'rgba(245, 197, 66, 0.12)',
                            color: 'var(--color-brand-yellow)',
                            border: '1px solid rgba(245, 197, 66, 0.25)',
                          }}
                        >
                          <span>Cross-Check Evidence {claim.linkedFindingId}</span>
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MilestoneStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    BLOCKED: { bg: 'rgba(239,68,68,0.18)', color: '#F87171', label: 'BLOCKED' },
    HOLD_RETEST: { bg: 'rgba(217,154,53,0.18)', color: '#FBBF24', label: 'HOLD FOR RETEST' },
    PENDING_SPAN: { bg: 'rgba(56,189,248,0.18)', color: '#38BDF8', label: 'PENDING SPAN' },
    ON_SCHEDULE: { bg: 'rgba(46,125,79,0.18)', color: '#4ADE80', label: 'ON SCHEDULE' },
  };
  const s = styles[status] || styles.ON_SCHEDULE;
  return (
    <span className="text-[9px] font-mono px-2 py-0.5 rounded font-bold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}
