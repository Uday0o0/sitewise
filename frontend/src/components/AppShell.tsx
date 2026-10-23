import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GlobalHeader } from './GlobalHeader';
import { NavigationRail } from './NavigationRail';


interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [navCollapsed, setNavCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'var(--color-surface-canvas)' }}>
      {/* Global Header — 56px */}
      <GlobalHeader />

      {/* Sub-header context strip — 38px */}
      <div
        className="flex items-center px-4 gap-3 shrink-0 border-b text-xs"
        style={{
          height: '38px',
          background: 'var(--color-surface-base)',
          borderColor: 'var(--color-surface-border-subtle)',
        }}
      >
        <span className="font-mono text-slate-300" style={{ fontFamily: 'var(--font-mono)' }}>
          Chainage: Ch. 14+200 → Ch. 18+600
        </span>
        <span className="w-px h-3.5 bg-slate-800" />
        <span className="text-slate-400">
          Package: <strong className="text-slate-200 font-medium">PKG-3 Elevated Viaduct</strong>
        </span>
        <span className="w-px h-3.5 bg-slate-800" />
        <span className="text-slate-400 hidden sm:inline">
          Governing Code: <span className="font-mono text-cyan-300">IRC:112-2020</span>
        </span>
        <span className="w-px h-3.5 bg-slate-800 hidden sm:inline" />
        <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Telemetry Pipeline: Active
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
