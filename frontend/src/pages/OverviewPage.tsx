import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { EngineeringKpiCard } from '../components/EngineeringKpiCard';
import { DataProvenanceBadge } from '../components/DataProvenanceBadge';
import {
  AlertTriangle, ArrowRight, Clock, FileText, Radio, Loader2,
  TrendingDown, Package, IndianRupee, ClipboardList
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function OverviewPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useApi(() => api.getOverview('PRJ-NH48-PKG3'));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-brand-yellow)' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading overview...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle size={32} style={{ color: 'var(--color-prov-risk)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Failed to load overview data</p>
        <p className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { kpiSummaries, priorityDecisions, cpmMilestones, evidenceIngestStream, unconfiguredSensors } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.015em' }}>
            Project Overview
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {data.projectMetadata.projectName} • Last sync {new Date(data.projectMetadata.dataSyncTimestamp).toLocaleString()}
          </p>
        </div>
        <DataProvenanceBadge type="DEMO_SYNTHETIC" label="SYNTHETIC DEMO" sublabel="NOT CERTIFIED" />
      </div>

      {/* KPI Cards — 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <EngineeringKpiCard
          title="Critical Path Variance"
          provenance="CALCULATED_RISK"
          primaryValue={`${kpiSummaries.criticalPathVarianceDays}`}
          unit="Days"
          statusType="critical"
          subDescription={kpiSummaries.criticalPathBlockerDesc}
          targetBaselineLabel="Status"
          targetBaselineValue={kpiSummaries.criticalPathStatus.replace('_', ' ')}
        />
        <EngineeringKpiCard
          title="Material Reconciled"
          provenance="SOURCE_VERIFIED"
          primaryValue={`${kpiSummaries.materialReconciledPercent}%`}
          statusType="positive"
          subDescription={`${kpiSummaries.materialReconciledBand}, ${kpiSummaries.reconciledMassMt.toLocaleString()} MT / ${kpiSummaries.totalBbsMassMt.toLocaleString()} MT`}
          progressPercent={kpiSummaries.materialReconciledPercent}
        />
        <EngineeringKpiCard
          title="Budget Variance"
          provenance="CALCULATED_RISK"
          primaryValue={`₹${kpiSummaries.tenderCostVarianceInrLakhs} L`}
          statusType="normal"
          subDescription="Under Tender Baseline Margin"
          targetBaselineLabel="Claims Under Review"
          targetBaselineValue={`₹${kpiSummaries.contractorClaimsUnderReviewInrLakhs} L`}
        />
        <EngineeringKpiCard
          title="Priority Findings"
          provenance="HUMAN_REVIEWED"
          primaryValue={`${kpiSummaries.activePriorityFindingsCount}`}
          unit="Active"
          statusType="warning"
          subDescription={`${kpiSummaries.findingsBreakdown.structural} Structural, ${kpiSummaries.findingsBreakdown.safety} Safety, ${kpiSummaries.findingsBreakdown.qaHold} QA Hold`}
        />
      </div>

      {/* Priority Decisions */}
      {priorityDecisions.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            Priority Decisions Awaiting Action
          </h2>
          <div className="space-y-3">
            {priorityDecisions.map(d => (
              <div
                key={d.findingId}
                className="rounded-lg p-4 flex items-start gap-4 cursor-pointer transition-all duration-200"
                style={{
                  background: 'var(--color-surface-container-low)',
                  border: '1px solid var(--color-surface-border-subtle)',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-brand-yellow)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-surface-border-subtle)')}
                onClick={() => navigate(`/inspections/${d.findingId}`)}
              >
                {/* Thumbnail placeholder */}
                <div
                  className="w-16 h-16 rounded-md shrink-0 flex items-center justify-center"
                  style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border-default)' }}
                >
                  <ClipboardList size={20} style={{ color: 'var(--color-text-tertiary)' }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono" style={{ color: 'var(--color-brand-yellow)', fontFamily: 'var(--font-mono)' }}>
                      {d.findingId}
                    </span>
                    <DataProvenanceBadge type={d.provenance === 'AI_INFERRED' ? 'AI_INFERRED' : 'SOURCE_VERIFIED'} />
                  </div>
                  <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                    {d.title}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {d.locationDesc} • {d.chainageFormatted}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {d.directImpact}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold" style={{ color: 'var(--color-prov-risk)', fontFamily: 'var(--font-display)' }}>
                    {d.criticalPathSlipDays > 0 ? `-${d.criticalPathSlipDays} Days` : 'No Slip'}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {d.cascadeFinancialExposureInr}
                  </div>
                </div>

                <ArrowRight size={16} className="mt-2 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPM Milestones */}
        <section>
          <h2 className="text-base font-semibold mb-3" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            CPM Schedule Status
          </h2>
          <div
            className="rounded-lg overflow-hidden"
            style={{
              background: 'var(--color-surface-container-low)',
              border: '1px solid var(--color-surface-border-subtle)',
            }}
          >
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--color-surface-container-med)' }}>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>WBS</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>Activity</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>Baseline</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>Projected</th>
                  <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>Drift</th>
                  <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {cpmMilestones.map(m => (
                  <tr key={m.wbsCode} className="border-t" style={{ borderColor: 'var(--color-surface-border-subtle)' }}>
                    <td className="px-3 py-2.5 font-mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-code)' }}>{m.wbsCode}</td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--color-text-primary)' }}>{m.activityDesc}</td>
                    <td className="px-3 py-2.5 font-mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>{m.baselineDate}</td>
                    <td className="px-3 py-2.5 font-mono" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{m.projectedDate}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold" style={{
                      fontFamily: 'var(--font-mono)',
                      color: m.slackDriftDays < 0 ? 'var(--color-prov-risk)' : 'var(--color-prov-verified)',
                    }}>
                      {m.slackDriftDays > 0 ? `+${m.slackDriftDays}` : m.slackDriftDays}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <MilestoneStatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] mt-2 italic" style={{ color: 'var(--color-text-tertiary)' }}>
            Synthetic P6 Sync — Not connected to Oracle Primavera P6 EPPM
          </p>
        </section>

        {/* Evidence Ingest Stream + Unconfigured Sensors */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-3" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
              Evidence Ingest Stream
            </h2>
            <div className="space-y-2">
              {evidenceIngestStream.map(a => (
                <div
                  key={a.assetId}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md"
                  style={{
                    background: 'var(--color-surface-container-low)',
                    border: '1px solid var(--color-surface-border-subtle)',
                  }}
                >
                  <AssetTypeIcon dataType={a.dataType} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{a.title}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      {a.dataType} • {a.ingestTimeAgo}
                    </p>
                  </div>
                  <DataProvenanceBadge
                    type={a.provenanceStatus === 'SOURCE_VERIFIED' ? 'SOURCE_VERIFIED' : a.provenanceStatus === 'QA_HOLD' ? 'HUMAN_REVIEWED' : 'CALCULATED_RISK'}
                    label={a.provenanceStatus.replace('_', ' ')}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Unconfigured Sensors */}
          {unconfiguredSensors.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                Unconfigured Sensors
              </h2>
              <div className="space-y-2">
                {unconfiguredSensors.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md"
                    style={{
                      background: 'var(--color-surface-container-low)',
                      border: '1px dashed var(--color-surface-border-default)',
                    }}
                  >
                    <Radio size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                    <div className="flex-1">
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{s.sensorType}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{s.location}</p>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-mono"
                      style={{
                        background: 'var(--color-surface-container-med)',
                        color: 'var(--color-text-tertiary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      NO GATEWAY LINKED
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-2 italic" style={{ color: 'var(--color-text-tertiary)' }}>
                Requires IoT Gateway integration — SoilInstruments / Encardio-Rite Modbus API
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MilestoneStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    HOLD_RETEST: { bg: 'rgba(239,68,68,0.14)', color: '#F87171' },
    BLOCKED: { bg: 'rgba(239,68,68,0.14)', color: '#F87171' },
    PENDING_SPAN: { bg: 'rgba(245,197,66,0.14)', color: '#FBBF24' },
    ON_SCHEDULE: { bg: 'rgba(46,125,79,0.14)', color: '#4ADE80' },
  };
  const s = styles[status] || styles.ON_SCHEDULE;

  return (
    <span
      className="inline-block text-[10px] px-2 py-0.5 rounded font-semibold tracking-wide"
      style={{
        background: s.bg,
        color: s.color,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function AssetTypeIcon({ dataType }: { dataType: string }) {
  const icons: Record<string, typeof FileText> = {
    GEOTIFF: TrendingDown,
    PDF_CERT: FileText,
    JSON_LOG: Package,
    CSV_TELEMETRY: Clock,
  };
  const Icon = icons[dataType] || FileText;
  return <Icon size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />;
}
