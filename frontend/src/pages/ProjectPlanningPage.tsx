import { useState } from 'react';
import { ProjectPlanningCalculator } from '../components/ProjectPlanningCalculator';
import { ArchitecturalVisualizerCard } from '../components/ArchitecturalVisualizerCard';
import { Compass, Sparkles } from 'lucide-react';

export function ProjectPlanningPage() {
  const [activeTab, setActiveTab] = useState<'planning' | 'visualisation'>('planning');

  return (
    <div className="space-y-6">
      {/* Top Tab Switcher */}
      <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--color-surface-border-subtle)' }}>
        <button
          onClick={() => setActiveTab('planning')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'planning'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Compass size={16} />
          Civil Material & Schedule Planning (Activity 3.1)
        </button>

        <button
          onClick={() => setActiveTab('visualisation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'visualisation'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sparkles size={16} />
          AI Architectural Visualisation (Activity 3.3)
        </button>
      </div>

      {activeTab === 'planning' ? (
        <ProjectPlanningCalculator projectId="PRJ-NH48-PKG3" />
      ) : (
        <ArchitecturalVisualizerCard projectId="PRJ-NH48-PKG3" />
      )}
    </div>
  );
}
