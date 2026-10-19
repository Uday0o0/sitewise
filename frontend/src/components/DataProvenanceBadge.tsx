import type { ProvenanceType } from '../types/api';

interface DataProvenanceBadgeProps {
  type: ProvenanceType;
  label?: string;
  sublabel?: string;
  tooltipText?: string;
  size?: 'sm' | 'md';
}

const BADGE_STYLES: Record<ProvenanceType, { bg: string; text: string; border: string; defaultLabel: string }> = {
  SOURCE_VERIFIED: {
    bg: 'rgba(46,125,79,0.14)',
    text: '#4ADE80',
    border: 'rgba(34,197,94,0.30)',
    defaultLabel: 'SOURCE VERIFIED',
  },
  AI_INFERRED: {
    bg: 'rgba(217,154,53,0.14)',
    text: '#FBBF24',
    border: 'rgba(217,119,6,0.30)',
    defaultLabel: 'AI INFERRED',
  },
  HUMAN_REVIEWED: {
    bg: 'rgba(56,189,248,0.14)',
    text: '#38BDF8',
    border: 'rgba(2,132,199,0.30)',
    defaultLabel: 'HUMAN REVIEWED',
  },
  CALCULATED_RISK: {
    bg: 'rgba(239,68,68,0.14)',
    text: '#F87171',
    border: 'rgba(239,68,68,0.30)',
    defaultLabel: 'CALCULATED RISK',
  },
  PROPOSED_ACTION: {
    bg: 'rgba(245,197,66,0.14)',
    text: '#F5C542',
    border: 'rgba(202,138,4,0.30)',
    defaultLabel: 'PROPOSED ACTION',
  },
  DEMO_SYNTHETIC: {
    bg: 'rgba(245,197,66,0.10)',
    text: '#F5C542',
    border: 'rgba(133,77,14,0.30)',
    defaultLabel: 'SYNTHETIC DEMO',
  },
  SYNTHETIC_DEMO: {
    bg: 'rgba(245,197,66,0.10)',
    text: '#F5C542',
    border: 'rgba(133,77,14,0.30)',
    defaultLabel: 'SYNTHETIC DEMO',
  },
  CALCULATED: {
    bg: 'rgba(239,68,68,0.14)',
    text: '#F87171',
    border: 'rgba(239,68,68,0.30)',
    defaultLabel: 'CALCULATED',
  },
};

export function DataProvenanceBadge({ type, label, sublabel, tooltipText, size = 'sm' }: DataProvenanceBadgeProps) {
  const style = BADGE_STYLES[type] || BADGE_STYLES['AI_INFERRED'];
  const fontSize = size === 'sm' ? '10px' : '11px';
  const padding = size === 'sm' ? '2px 6px' : '3px 8px';

  return (
    <span
      className="inline-flex items-center gap-1 rounded font-semibold tracking-wider whitespace-nowrap"
      style={{
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        fontSize,
        padding,
        fontFamily: 'var(--font-mono)',
        lineHeight: '14px',
      }}
      title={tooltipText}
    >
      {label || style.defaultLabel}
      {sublabel && (
        <span style={{ opacity: 0.7, fontWeight: 400 }}> • {sublabel}</span>
      )}
    </span>
  );
}
