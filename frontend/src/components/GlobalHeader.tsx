import { useState } from 'react';
import { Bell, Download, HardHat, Lock } from 'lucide-react';
import { ProjectSelector } from './ProjectSelector';

export function GlobalHeader() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLockInfo, setShowLockInfo] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

  const handleExportMemo = () => {
    const memo = `# SITEWISE V4.2 — EXECUTIVE BRIEFING MEMO
Generated: ${new Date().toISOString()}
Project: Package C-3 Elevated Viaduct (Ch. 14+200 → 18+600)
Status: PROJECT INTEGRATION BASELINE

## 1. CRITICAL PATH & SCHEDULE
- Critical Path Schedule Slip: -4 Days (CRITICAL_DRIFT)
- Blocked Activity: Span 18-19 Precast Segment Launch at Pier 18
- Rebar Material Reconciled: 94.2% (Within ±6% contractual band)
- Active Non-Conformance Finding: FND-104 (Pier 18 Cantilever Shear Crack 0.35mm)
- Governing Code: IRC:112:2020 Clause 12.3 (Limit 0.20mm exceeded by +75%)

## 2. MITIGATION SCENARIO
- Proposed Fast-Track Action: CFRP Pressure Injection Retrofit
- Curing Window: 48 Hours
- Schedule Days Recovered: +15 Days (vs. 18-day recast demolition baseline)
- Financial Exposure Net Avoidance: ₹14.80 Lakhs (vs. ₹20.30L recast exposure)

* Disclaimer: Parametric engineering decision-support estimate. Not a certified structural engineering submission.
`;
    const blob = new Blob([memo], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SITEWISE_Briefing_Memo_${Date.now()}.md`;
    a.click();
  };
  return (
    <header
      className="flex items-center justify-between px-4 shrink-0 border-b"
      style={{
        height: '56px',
        background: 'var(--color-surface-container-low)',
        borderColor: 'var(--color-surface-border-subtle)',
      }}
    >
      {/* Left: Logo + Project Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ background: 'var(--color-brand-yellow)' }}
          >
            <HardHat size={18} style={{ color: 'var(--color-surface-base)' }} />
          </div>
          <span
            className="text-base font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            SITEWISE
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: 'var(--color-surface-container-med)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
            }}
          >
            V4.2
          </span>
        </div>

        <span className="w-px h-6" style={{ background: 'var(--color-surface-border-default)' }} />

        <ProjectSelector
          currentProject={{
            id: 'PRJ-NH48-PKG3',
            name: 'NH-48 Elevated Corridor — Package 3',
            packageId: 'PKG-3',
            chainageRange: 'Ch. 14+200 to Ch. 18+600',
          }}
          onSelectProject={() => {}}
          isDemoMode={true}
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 relative">
        <div className="relative">
          <HeaderButton
            icon={<Lock size={15} />}
            label="Schedule Baseline Lock: Certified Master P6 Protected"
            onClick={() => {
              setShowLockInfo(!showLockInfo);
              setShowNotifications(false);
            }}
          />

          {showLockInfo && (
            <div
              className="absolute right-0 top-10 w-72 rounded-lg p-3 shadow-xl z-50 text-xs space-y-2 border"
              style={{
                background: 'var(--color-surface-container-high)',
                borderColor: 'var(--color-surface-border-strong)',
              }}
            >
              <div className="flex items-center justify-between border-b border-surface-border-subtle pb-1.5">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Lock size={13} className="text-amber-400" />
                  Certified Baseline Lock
                </span>
                <button
                  onClick={() => setShowLockInfo(false)}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Master Primavera P6 EPC baseline schedule dates are protected. Working session modifications and what-if adjustments evaluate downstream delay without altering certified contractual milestones.
              </p>
              <div className="pt-1 border-t border-surface-border-subtle flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Baseline: BL-2024-Q3-REV4</span>
                <span className="text-emerald-400">VERIFIED</span>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <HeaderButton
            icon={<Bell size={15} />}
            label="Notifications"
            badge={unreadCount}
            onClick={() => setShowNotifications(!showNotifications)}
          />

          {showNotifications && (
            <div
              className="absolute right-0 top-10 w-80 rounded-lg p-3 shadow-xl z-50 animate-scale-up text-xs space-y-2"
              style={{
                background: 'var(--color-surface-container-high)',
                border: '1px solid var(--color-surface-border-strong)',
              }}
            >
              <div className="flex items-center justify-between border-b border-surface-border-subtle pb-2">
                <span className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
                  Active Project Notifications
                </span>
                <button
                  onClick={() => { setUnreadCount(0); setShowNotifications(false); }}
                  className="text-[10px] text-gray-400 hover:text-yellow-400"
                >
                  Dismiss all
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="p-2 rounded bg-surface-container-med/60 border border-red-500/20">
                  <p className="font-bold text-red-400 text-[11px]">CRITICAL PATH ALERT</p>
                  <p className="text-gray-300 text-[11px] mt-0.5">Pier 18 defect (FND-104) blocks Span 18-19 launch. Slack: -4 Days.</p>
                </div>
                <div className="p-2 rounded bg-surface-container-med/60 border border-yellow-500/20">
                  <p className="font-bold text-yellow-400 text-[11px]">CONTRACTOR CLAIM</p>
                  <p className="text-gray-300 text-[11px] mt-0.5">Claim #CLM-019 filed by HCC-NCC JV for ₹12.4L gantry idling.</p>
                </div>
                <div className="p-2 rounded bg-surface-container-med/60 border border-sky-500/20">
                  <p className="font-bold text-sky-400 text-[11px]">SENSOR INTEGRATION</p>
                  <p className="text-gray-300 text-[11px] mt-0.5">Pier 18 borehole inclinometer unconfigured (no gateway linked).</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleExportMemo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer"
          style={{
            background: 'var(--color-brand-yellow)',
            color: 'var(--color-surface-base)',
            fontFamily: 'var(--font-display)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-brand-yellow-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-brand-yellow)')}
          title="Export Project Briefing Memo (.md)"
        >
          <Download size={13} />
          Export Memo
        </button>

        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            background: 'var(--color-surface-container-high)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-surface-border-default)',
          }}
          title="Resident Engineer (RE-PKG3)"
        >
          RE
        </div>
      </div>
    </header>
  );
}

function HeaderButton({ icon, label, badge, onClick }: { icon: React.ReactNode; label: string; badge?: number; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-md transition-colors cursor-pointer"
      style={{ color: 'var(--color-text-secondary)' }}
      title={label}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-container-med)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
          style={{
            background: 'var(--color-prov-risk)',
            color: '#fff',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
