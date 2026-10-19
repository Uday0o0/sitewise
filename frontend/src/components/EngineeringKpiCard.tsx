import type { ProvenanceType } from '../types/api';
import { DataProvenanceBadge } from './DataProvenanceBadge';

interface EngineeringKpiCardProps {
  title: string;
  provenance: ProvenanceType;
  primaryValue: string | number;
  unit?: string;
  statusType: 'normal' | 'warning' | 'critical' | 'positive';
  subDescription: string;
  targetBaselineLabel?: string;
  targetBaselineValue?: string;
  sparklineData?: number[];
  progressPercent?: number;
}

const STATUS_COLORS: Record<string, string> = {
  normal: 'var(--color-text-primary)',
  warning: '#FBBF24',
  critical: '#F87171',
  positive: '#4ADE80',
};

export function EngineeringKpiCard({
  title,
  provenance,
  primaryValue,
  unit,
  statusType,
  subDescription,
  targetBaselineLabel,
  targetBaselineValue,
  progressPercent,
}: EngineeringKpiCardProps) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3 transition-all duration-200 animate-fade-in"
      style={{
        background: 'var(--color-surface-container-low)',
        border: '1px solid var(--color-surface-border-subtle)',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-surface-border-default)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-surface-border-subtle)')}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}
        >
          {title}
        </span>
        <DataProvenanceBadge type={provenance} size="sm" />
      </div>

      {/* Primary value */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="font-bold"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            lineHeight: '32px',
            letterSpacing: '-0.03em',
            color: STATUS_COLORS[statusType],
          }}
        >
          {primaryValue}
        </span>
        {unit && (
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {unit}
          </span>
        )}
      </div>

      {/* Sub description */}
      <p className="text-xs leading-4" style={{ color: 'var(--color-text-tertiary)' }}>
        {subDescription}
      </p>

      {/* Progress bar */}
      {progressPercent !== undefined && (
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-med)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, progressPercent)}%`,
              background: STATUS_COLORS[statusType],
            }}
          />
        </div>
      )}

      {/* Baseline target */}
      {targetBaselineLabel && (
        <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
          <span>{targetBaselineLabel}</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{targetBaselineValue}</span>
        </div>
      )}
    </div>
  );
}
