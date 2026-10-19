import {
  LayoutDashboard, FileSearch, ClipboardCheck, GitBranch,
  CalendarClock, FlaskConical, MessageSquare, Settings, PanelLeftClose, PanelLeft
} from 'lucide-react';

interface NavigationRailProps {
  activeRoute: string;
  onNavigate: (path: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const NAV_ITEMS = [
  { path: '/overview', label: 'Overview', icon: LayoutDashboard },
  { path: '/evidence', label: 'Evidence Centre', icon: FileSearch },
  { path: '/inspections', label: 'Inspections', icon: ClipboardCheck },
  { path: '/evidence-graph', label: 'Evidence Graph', icon: GitBranch },
  { path: '/planning', label: 'Planning & Cost', icon: CalendarClock },
  { path: '/simulator', label: 'What-if Simulator', icon: FlaskConical },
  { path: '/assistant', label: 'Site Assistant', icon: MessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function NavigationRail({ activeRoute, onNavigate, collapsed, onToggleCollapse }: NavigationRailProps) {
  const width = collapsed ? '64px' : '220px';

  return (
    <nav
      className="flex flex-col shrink-0 border-r transition-all duration-200 overflow-hidden"
      style={{
        width,
        minWidth: width,
        background: 'var(--color-surface-container-low)',
        borderColor: 'var(--color-surface-border-subtle)',
      }}
    >
      {/* Nav items */}
      <div className="flex-1 py-2 flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeRoute === item.path || activeRoute.startsWith(item.path + '/');
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all duration-150 cursor-pointer group"
              style={{
                background: isActive ? 'var(--color-surface-container-high)' : 'transparent',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'var(--color-surface-container-med)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
              title={collapsed ? item.label : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                  style={{
                    height: '20px',
                    background: 'var(--color-brand-yellow)',
                  }}
                />
              )}
              <Icon size={18} style={{ flexShrink: 0, color: isActive ? 'var(--color-brand-yellow)' : undefined }} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t" style={{ borderColor: 'var(--color-surface-border-subtle)' }}>
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-3 px-3 py-2 rounded-md w-full transition-colors cursor-pointer"
          style={{ color: 'var(--color-text-tertiary)', fontSize: '12px' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-container-med)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
