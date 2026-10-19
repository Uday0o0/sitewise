import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GlobalHeader } from './GlobalHeader';
import { NavigationRail } from './NavigationRail';
import { SyntheticDemoBanner } from './SyntheticDemoBanner';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [navCollapsed, setNavCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'var(--color-surface-canvas)' }}>
      {/* Synthetic Demo Banner */}
      <SyntheticDemoBanner />

      {/* Global Header — 56px */}
      <GlobalHeader />

      {/* Sub-header context strip — 44px */}
      <div
        className="flex items-center px-4 gap-3 shrink-0 border-b"
        style={{
          height: '44px',
          background: 'var(--color-surface-base)',
          borderColor: 'var(--color-surface-border-subtle)',
        }}
      >
        <span className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          Ch. 14+200 → Ch. 18+600
        </span>
        <span className="w-px h-4" style={{ background: 'var(--color-surface-border-default)' }} />
        <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-brand-yellow)' }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-brand-yellow)' }} />
          SYNTHETIC DEMO DATASET
        </span>
        <span className="w-px h-4" style={{ background: 'var(--color-surface-border-default)' }} />
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          RTK-GPS: Not Connected
        </span>
      </div>

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Rail */}
        <NavigationRail
          activeRoute={location.pathname}
          onNavigate={(path) => navigate(path)}
          collapsed={navCollapsed}
          onToggleCollapse={() => setNavCollapsed(!navCollapsed)}
        />

        {/* Content area */}
        <main className="flex-1 overflow-auto p-6" style={{ background: 'var(--color-surface-base)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
