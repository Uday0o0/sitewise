import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert, HardHat, AlertTriangle, CheckCircle2, Upload,
  Camera, RefreshCw, Eye, Info, FileText, Activity, ShieldCheck, Flame
} from 'lucide-react';

interface SafetyResult {
  project_id: string;
  status: string;
  provenance: string;
  image_metadata: {
    width: number;
    height: number;
    channels: number;
    format: string;
    file_size_bytes: number;
    mean_luminance?: number;
    is_poor_lighting?: boolean;
    highvis_pixel_ratio?: number;
    edge_clutter_density?: number;
  };
  overall_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ppe_compliance: {
    helmets_compliant: boolean;
    vests_compliant: boolean;
    violations: string[];
    observations: string;
  };
  worker_hazards: Array<{
    hazard_type?: string;
    description: string;
    severity?: string;
  }>;
  scaffolding_fall_risks: Array<{
    hazard_type?: string;
    description: string;
    severity?: string;
  }>;
  environmental_risks: Array<{
    hazard_type?: string;
    description: string;
    severity?: string;
    provenance?: string;
  }>;
  corrective_actions: string[];
  applicable_standards: Array<{
    code: string;
    clause: string;
  }>;
  processing_time_ms: number;
  uncertainty_disclaimer: string;
}

export function ConstructionSafetyAnalyzerCard({ projectId = "PRJ-NH48-PKG3" }: { projectId?: string }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [siteLocation, setSiteLocation] = useState('Chainage 42+150 Pier Cap Zone');
  const [activityType, setActivityType] = useState('Structural Gantry Launching & Rebar Tying');
  const [notes, setNotes] = useState('');
  
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<SafetyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setErrorMsg(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select or upload a construction worksite photo first.');
      return;
    }

    setAnalyzing(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('project_id', projectId);
      formData.append('site_location', siteLocation);
      formData.append('activity_type', activityType);
      if (notes.trim()) formData.append('notes', notes.trim());
      formData.append('image', selectedFile);

      const res = await fetch('/api/v4/safety-inspection/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Safety inspection failed with status ${res.status}`);
      }

      const data: SafetyResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Communication error during safety image analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'MEDIUM': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
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
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <HardHat size={22} />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Construction Safety & PPE Inspection
              <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                VISION-LANGUAGE SAFETY MODEL
              </span>
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            Automated worksite hazard detection: worker positioning, PPE compliance (IS 2925/15809), scaffolding stability, and OSHA 1926 standards.
          </p>
        </div>

        {/* Safety Disclaimer Header */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs max-w-md">
          <ShieldAlert size={18} className="shrink-0" />
          <span>
            <strong>Decision-Support Guardrail:</strong> AI hazard screening is not certified proof of site safety. Mandatory safety officer sign-off required under BOCW Act 1996.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Upload and Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-lg border bg-slate-900/40 border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Camera size={16} className="text-amber-400" />
              Inspection Imagery
            </h3>

            {/* Upload Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-lg p-5 text-center cursor-pointer transition-colors bg-slate-950/40"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />
              {previewUrl ? (
                <div className="space-y-2">
                  <img src={previewUrl} alt="Inspection Preview" className="max-h-48 mx-auto rounded object-contain border border-slate-800" />
                  <p className="text-xs text-slate-400 truncate">{selectedFile?.name}</p>
                  <span className="text-[11px] text-amber-400 underline">Click to choose a different photo</span>
                </div>
              ) : (
                <div className="space-y-2 py-4">
                  <Upload size={32} className="mx-auto text-slate-500" />
                  <p className="text-xs font-medium text-slate-300">Upload construction site inspection photo</p>
                  <p className="text-[11px] text-slate-500">Supports JPEG, PNG, WEBP (up to 25 MB)</p>
                </div>
              )}
            </div>

            {/* Context Inputs */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Site Location / Chainage</label>
              <input
                type="text"
                value={siteLocation}
                onChange={e => setSiteLocation(e.target.value)}
                disabled={analyzing}
                className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Planned / Active Operation</label>
              <select
                value={activityType}
                onChange={e => setActivityType(e.target.value)}
                disabled={analyzing}
                className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="Structural Gantry Launching & Rebar Tying">Structural Gantry Launching & Rebar Tying</option>
                <option value="Concrete Pouring Pier Cap Formwork">Concrete Pouring Pier Cap Formwork</option>
                <option value="Working at Elevated Scaffolding">Working at Elevated Scaffolding</option>
                <option value="Deep Trench Earthwork & Shoring">Deep Trench Earthwork & Shoring</option>
                <option value="Structural Steel Arc Welding">Structural Steel Arc Welding</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Supervisor Observations (Optional)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Scaffolding erection completed at 08:30, high wind gusts reported..."
                disabled={analyzing}
                className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Analyze Action Button */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !selectedFile}
              className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Running Computer Vision & Safety Audit...
                </>
              ) : (
                <>
                  <Activity size={16} />
                  Analyze Construction Safety
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results and Diagnostics (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {errorMsg && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              {/* Overall Risk Header */}
              <div className="p-4 rounded-lg border bg-slate-900/50 border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-mono text-slate-400">Composite Risk Assessment</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${getRiskColor(result.overall_risk_level)}`}>
                      {result.overall_risk_level} RISK
                    </span>
                    <span className="text-xs text-slate-400">
                      Processed in {result.processing_time_ms}ms ({result.provenance})
                    </span>
                  </div>
                </div>
                
                {/* CV Telemetry Box */}
                <div className="text-right text-[11px] font-mono text-slate-400 space-y-0.5">
                  <div>Res: {result.image_metadata.width}x{result.image_metadata.height}px</div>
                  <div>Luminance: {result.image_metadata.mean_luminance ?? 'N/A'}/255</div>
                  <div>High-vis color ratio: {result.image_metadata.highvis_pixel_ratio ?? 'N/A'}</div>
                </div>
              </div>

              {/* PPE Compliance Matrix */}
              <div className="p-4 rounded-lg border bg-slate-900/40 border-slate-800 space-y-3">
                <h4 className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  PPE Compliance Audit (IS 2925 / IS 15809)
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded border text-xs ${
                    result.ppe_compliance.helmets_compliant
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    <div className="font-semibold flex items-center gap-1.5">
                      {result.ppe_compliance.helmets_compliant ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      Hard Hats (IS 2925)
                    </div>
                    <div className="mt-1 text-[11px] opacity-90">
                      {result.ppe_compliance.helmets_compliant ? 'All visible workers equipped' : 'Potential helmet violation detected'}
                    </div>
                  </div>

                  <div className={`p-3 rounded border text-xs ${
                    result.ppe_compliance.vests_compliant
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}>
                    <div className="font-semibold flex items-center gap-1.5">
                      {result.ppe_compliance.vests_compliant ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      High-Vis Vests (IS 15809)
                    </div>
                    <div className="mt-1 text-[11px] opacity-90">
                      {result.ppe_compliance.vests_compliant ? 'Fluorescent retroreflective visible' : 'Low vest contrast or missing'}
                    </div>
                  </div>
                </div>

                {result.ppe_compliance.observations && (
                  <p className="text-xs text-slate-300 bg-slate-800/40 p-2.5 rounded border border-slate-800">
                    {result.ppe_compliance.observations}
                  </p>
                )}
              </div>

              {/* Worker Hazards & Fall Risks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Worker Proximity */}
                <div className="p-4 rounded-lg border bg-slate-900/40 border-slate-800 space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-400" />
                    Worker Proximity Hazards
                  </h4>
                  {result.worker_hazards.length > 0 ? (
                    <ul className="space-y-1.5">
                      {result.worker_hazards.map((h, i) => (
                        <li key={i} className="text-xs p-2 rounded bg-slate-800/60 border border-slate-700/60 text-slate-300">
                          <span className="font-semibold text-amber-300">{h.hazard_type || 'PROXIMITY'}: </span>
                          {h.description}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No direct worker proximity conflicts detected in frame.</p>
                  )}
                </div>

                {/* Scaffolding & Fall Risks */}
                <div className="p-4 rounded-lg border bg-slate-900/40 border-slate-800 space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                    <Activity size={14} className="text-cyan-400" />
                    Scaffolding & Edge Safety
                  </h4>
                  {result.scaffolding_fall_risks.length > 0 ? (
                    <ul className="space-y-1.5">
                      {result.scaffolding_fall_risks.map((s, i) => (
                        <li key={i} className="text-xs p-2 rounded bg-slate-800/60 border border-slate-700/60 text-slate-300">
                          <span className="font-semibold text-cyan-300">{s.hazard_type || 'ELEVATION'}: </span>
                          {s.description}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No unprotected edge or scaffolding failures detected in frame.</p>
                  )}
                </div>
              </div>

              {/* Environmental Risks & Corrective Actions */}
              <div className="p-4 rounded-lg border bg-slate-900/40 border-slate-800 space-y-3">
                <h4 className="text-xs font-semibold uppercase text-slate-300 flex items-center gap-1.5">
                  <FileText size={14} className="text-indigo-400" />
                  Mandatory Corrective Action Checklist
                </h4>
                <div className="space-y-1.5">
                  {result.corrective_actions.map((act, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-200">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legal Standards Reference */}
              <div className="p-3 rounded bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
                <span className="font-semibold text-slate-300">Statutory Standards Benchmarks:</span>
                <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                  {result.applicable_standards.slice(0, 3).map((std, i) => (
                    <li key={i}><strong className="text-slate-300">{std.code}:</strong> {std.clause}</li>
                  ))}
                </ul>
              </div>

              {/* Legal Uncertainty Disclaimer */}
              <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-2">
                <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <span>{result.uncertainty_disclaimer}</span>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] rounded-lg border bg-slate-950/40 border-slate-800 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <Camera size={44} className="text-slate-600" />
              <p className="text-sm font-medium text-slate-300">Ready for Safety Inspection</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Upload a worksite photo on the left and click "Analyze Construction Safety" to run automated PPE, worker proximity, and scaffolding hazard screening.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
