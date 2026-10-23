import { ChevronDown } from 'lucide-react';

interface ProjectSelectorProps {
  currentProject: {
    id: string;
    name: string;
    packageId: string;
    chainageRange: string;
  };
  onSelectProject: (projectId: string) => void;
  isDemoMode: boolean;
}

export function ProjectSelector({ currentProject, isDemoMode }: ProjectSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer"
        style={{ color: 'var(--color-text-primary)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-container-high)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="text-left">
          <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            {currentProject.name}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {currentProject.packageId} • {currentProject.chainageRange}
          </div>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} />
      </button>

      {isDemoMode && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide text-slate-400 bg-slate-800/80 border border-slate-700/60"
        >
          BASELINE PROJECT
        </span>
      )}
    </div>
  );
}
