import { AlertTriangle } from 'lucide-react';

export function SyntheticDemoBanner() {
  return (
    <div
      className="flex items-center justify-center gap-2 shrink-0 text-[11px] font-semibold tracking-wide"
      style={{
        height: '28px',
        background: 'rgba(245,197,66,0.08)',
        color: 'var(--color-brand-yellow)',
        borderBottom: '1px solid rgba(245,197,66,0.15)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <AlertTriangle size={13} />
      SYNTHETIC DEMO WORKSPACE — ALL DATA IS ILLUSTRATIVE AND NOT CERTIFIED FOR ENGINEERING USE
    </div>
  );
}
