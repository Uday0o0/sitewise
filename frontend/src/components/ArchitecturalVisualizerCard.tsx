import { useState, useEffect } from 'react';
import {
  Sparkles, Layers, Building, Eye, AlertTriangle, RefreshCw,
  CheckCircle2, Info, Maximize2, ShieldAlert
} from 'lucide-react';

interface OptionsData {
  building_types: Record<string, string>;
  architectural_styles: Record<string, string>;
  context_environments: Record<string, string>;
  features: string[];
  disclaimer: string;
}

interface VisualizationResult {
  project_id: string;
  status: 'SUCCESS' | 'PROVIDER_UNAVAILABLE' | 'FALLBACK_SCHEMATIC';
  provenance: string;
  image_url: string | null;
  image_base64: string | null;
  prompt_used: string;
  provider_name: string;
  generation_time_ms: number;
  specifications_summary: {
    building_type: string;
    floors: number;
    style: string;
    context_environment: string;
    features_count: number;
  };
  disclaimer: string;
  limitations: string[];
}

export function ArchitecturalVisualizerCard({ projectId }: { projectId: string }) {
  const [options, setOptions] = useState<OptionsData | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  
  // Form state
  const [buildingType, setBuildingType] = useState('commercial_office');
  const [style, setStyle] = useState('modern_sustainable');
  const [floors, setFloors] = useState<number>(6);
  const [contextEnv, setContextEnv] = useState('urban_highway');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    'Solar PV rooftop array',
    'Green rooftop terrace garden'
  ]);
  const [customNotes, setCustomNotes] = useState('');

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<VisualizationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState(false);

  useEffect(() => {
    fetch('http://localhost:8000/api/v4/architectural-preview/options')
      .then(res => res.json())
      .then(data => {
        setOptions(data);
        setLoadingOptions(false);
      })
      .catch(err => {
        console.error('Failed to load visualizer options:', err);
        setLoadingOptions(false);
      });
  }, []);

  const handleToggleFeature = (feat: string) => {
    if (selectedFeatures.includes(feat)) {
      setSelectedFeatures(selectedFeatures.filter(f => f !== feat));
    } else {
      setSelectedFeatures([...selectedFeatures, feat]);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const payload = {
        building_type: buildingType,
        style,
        floors: Number(floors),
        context_environment: contextEnv,
        features: selectedFeatures,
        custom_notes: customNotes.trim() || undefined
      };

      const res = await fetch(`http://localhost:8000/api/v4/projects/${projectId}/architectural-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Generation failed with HTTP status ${res.status}`);
      }

      const data: VisualizationResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to communicate with architectural visualizer service.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      className="rounded-xl border p-6 shadow-sm transition-all duration-200"
      style={{
        background: 'var(--color-surface-container-lowest)',
        borderColor: 'var(--color-surface-border-subtle)',
      }}
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 mb-6"
           style={{ borderColor: 'var(--color-surface-border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles size={20} />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              AI Conceptual Architectural Visualisation
              <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Activity 3.3 / Concept Preview
              </span>
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            Generate conceptual 3D project previews from project design parameters, massing rules, and sustainable features.
          </p>
        </div>

        {/* Mandatory Provenance & Disclaimer Callout */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <ShieldAlert size={16} className="shrink-0" />
          <span>
            <strong>Mandatory Disclosure:</strong> Conceptual render only. Not an architectural blueprint, structural calculation, or NBC 2016 code-compliant plan.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Parameters Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-lg border bg-slate-900/40 border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Building size={16} className="text-cyan-400" />
              Design Specifications
            </h3>

            {/* Building Type */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Building Typology</label>
              <select
                value={buildingType}
                onChange={e => setBuildingType(e.target.value)}
                disabled={generating}
                className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                {options ? Object.entries(options.building_types).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                )) : (
                  <option value="commercial_office">Commercial Corporate Office</option>
                )}
              </select>
            </div>

            {/* Architectural Style */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Architectural Style & Language</label>
              <select
                value={style}
                onChange={e => setStyle(e.target.value)}
                disabled={generating}
                className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                {options ? Object.entries(options.architectural_styles).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                )) : (
                  <option value="modern_sustainable">Modern Sustainable Architecture</option>
                )}
              </select>
            </div>

            {/* Storey Count & Context Environment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Storeys / Floors (1–50)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={floors}
                  onChange={e => setFloors(Number(e.target.value))}
                  disabled={generating}
                  className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Surrounding Context</label>
                <select
                  value={contextEnv}
                  onChange={e => setContextEnv(e.target.value)}
                  disabled={generating}
                  className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  {options ? Object.entries(options.context_environments).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  )) : (
                    <option value="urban_highway">Urban Highway Corridor</option>
                  )}
                </select>
              </div>
            </div>

            {/* Sustainable & Architectural Features */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center justify-between">
                <span>Architectural & Sustainable Features</span>
                <span className="text-[10px] text-cyan-400">{selectedFeatures.length} selected</span>
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {(options?.features || [
                  'Solar PV rooftop array',
                  'Cantilevered balconies',
                  'Perforated solar jaali facade',
                  'Green rooftop terrace garden',
                  'Rainwater harvesting collection swales',
                  'High-clearance entrance atrium',
                  'EV charging shaded parking bays'
                ]).map((feat) => {
                  const isChecked = selectedFeatures.includes(feat);
                  return (
                    <button
                      type="button"
                      key={feat}
                      onClick={() => handleToggleFeature(feat)}
                      disabled={generating}
                      className={`w-full text-left text-xs px-2.5 py-1.5 rounded flex items-center justify-between transition-colors ${
                        isChecked
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 border border-transparent'
                      }`}
                    >
                      <span>{feat}</span>
                      {isChecked && <CheckCircle2 size={12} className="text-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Custom Architectural Instructions</label>
              <textarea
                rows={2}
                value={customNotes}
                onChange={e => setCustomNotes(e.target.value)}
                placeholder="e.g. Double-height lobby, terracotta cladding, recessed entrance plaza..."
                disabled={generating}
                className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Generate Action Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || loadingOptions}
              className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Generating Architectural Concept...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Conceptual Visualisation
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Visualizer & Disclosures (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          <div className="h-full rounded-lg border bg-slate-950/70 border-slate-800 p-5 flex flex-col justify-between">
            {/* Top State Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-300">Preview Viewport</span>
                {result && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                    result.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {result.provenance}
                  </span>
                )}
              </div>
              {result && (
                <div className="text-[11px] text-slate-500 font-mono">
                  {result.provider_name} ({result.generation_time_ms}ms)
                </div>
              )}
            </div>

            {/* Main Visual Display */}
            <div className="flex-1 my-4 flex items-center justify-center min-h-[340px] relative rounded-lg overflow-hidden bg-slate-900 border border-slate-800/80">
              {generating ? (
                <div className="text-center p-6 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
                  <p className="text-sm font-medium text-slate-200">Synthesizing Architectural Geometry...</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Compiling massing rules, daylight lighting conditions, and sustainable cladding specifications.
                  </p>
                </div>
              ) : errorMsg ? (
                <div className="text-center p-6 space-y-2 max-w-md">
                  <AlertTriangle size={32} className="mx-auto text-rose-400" />
                  <p className="text-sm font-semibold text-rose-300">Generation Error</p>
                  <p className="text-xs text-slate-400">{errorMsg}</p>
                  <button
                    onClick={handleGenerate}
                    className="mt-2 px-3 py-1.5 rounded text-xs bg-slate-800 hover:bg-slate-700 text-white"
                  >
                    Retry Generation
                  </button>
                </div>
              ) : result ? (
                result.status === 'SUCCESS' && (result.image_base64 || result.image_url) ? (
                  <div className="relative w-full h-full group">
                    <img
                      src={result.image_base64 || result.image_url!}
                      alt="Conceptual Architectural Visualisation"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                      <p className="text-xs text-slate-200 line-clamp-2">{result.prompt_used}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 space-y-3 max-w-md">
                    <AlertTriangle size={36} className="mx-auto text-amber-400" />
                    <p className="text-sm font-semibold text-amber-300">Provider Unavailable</p>
                    <p className="text-xs text-slate-400">
                      Live image generation provider is unreachable or network connectivity is offline.
                    </p>
                    <div className="p-3 rounded bg-slate-800/60 border border-slate-700 text-left text-[11px] text-slate-300 space-y-1 font-mono">
                      <div>Status: {result.status}</div>
                      <div>Provenance: {result.provenance}</div>
                      <div>Prompt compiled: {result.prompt_used.slice(0, 100)}...</div>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center p-8 space-y-3 max-w-sm">
                  <Layers size={40} className="mx-auto text-slate-600" />
                  <p className="text-sm font-medium text-slate-300">Ready for Visualisation</p>
                  <p className="text-xs text-slate-500">
                    Select your architectural parameters on the left and click "Generate Conceptual Visualisation" to produce an indicative 3D massing render.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Disclaimers & Limitations */}
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/25 flex items-start gap-2">
                <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/90 leading-relaxed">
                  <strong>DISCLAIMER:</strong> {result?.disclaimer || options?.disclaimer || 'CONCEPTUAL VISUALISATION ONLY — Not an architectural drawing, structural design, or buildable plan. Not validated for NBC 2016 code compliance.'}
                </p>
              </div>

              {result?.limitations && (
                <div className="text-[10px] text-slate-500 space-y-0.5">
                  <span className="font-semibold text-slate-400">Engineering Limitations:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {result.limitations.map((lim, i) => (
                      <li key={i}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
