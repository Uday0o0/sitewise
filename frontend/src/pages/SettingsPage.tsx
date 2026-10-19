import { useState } from 'react';
import { DataProvenanceBadge } from '../components/DataProvenanceBadge';
import {
  Settings,
  ShieldCheck,
  Cpu,
  Radio,
  Layers,
  Database,
  Sliders,
  FileDown,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  ExternalLink,
  Save,
} from 'lucide-react';

export function SettingsPage() {
  const [isDemoLocked, setIsDemoLocked] = useState(true);
  const [crackLimit, setCrackLimit] = useState('0.20');
  const [upvThreshold, setUpvThreshold] = useState('3850');
  const [gantryRate, setGantryRate] = useState('150000');
  const [slaHours, setSlaHours] = useState('24');
  const [saveToast, setSaveToast] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Unconfigured sensor modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [gatewayIp, setGatewayIp] = useState('192.168.1.120');
  const [gatewayPort, setGatewayPort] = useState('502');
  const [gatewayStatus, setGatewayStatus] = useState<'UNLINKED' | 'TESTING' | 'LINKED'>('UNLINKED');

  const handleSaveSettings = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const handleExportBriefingMemo = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      const memo = `# SITEWISE V4.2 — EXECUTIVE BRIEFING MEMO
Generated: ${new Date().toISOString()}
Project: Package C-3 Elevated Viaduct (Ch. 14+200 → 18+600)
Status: SYNTHETIC DEMO DATASET

## 1. KEY PERFORMANCE INDICATORS
- Critical Path Schedule Variance: -4 Days (CRITICAL_DRIFT)
- Blocked Activity: Span 18-19 Precast Girder Launch at Pier 18
- Rebar Material Reconciled: 94.2% (Within ±6% contractual band)
- Active Non-Conformance Finding: FND-104 (Pier 18 Cantilever Shear Crack 0.35mm)
- Governing Code: IRC:112:2020 Clause 12.3 (Limit 0.20mm exceeded by +75%)

## 2. WHAT-IF MITIGATION TRAJECTORY
- Proposed Intervention: CFRP Pressure Injection Retrofit
- Curing Window: 48 Hours
- Schedule Days Recovered: 15 Days
- Financial Exposure Net Avoidance: ₹14.80 Lakhs
- Feasibility Resilience: 94.2% Shear Capacity Retention

## 3. AUDIT SIGNATURE
- Certified by: Resident Engineer (RE-2024-DEMO)
- Ledger Hash: SHA256: 9a8e4f1c7d2b3e8a5f0c1d2e3b4a5f6c7d8e9a0b1c2d3e4f5a6b7c8d9e0f1a2b
`;
      const blob = new Blob([memo], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SITEWISE_Briefing_Memo_${Date.now()}.md`;
      a.click();
    }, 800);
  };

  const handleTestGateway = () => {
    setGatewayStatus('TESTING');
    setTimeout(() => {
      setGatewayStatus('LINKED');
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-border-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Calibration & System Configuration
            </h1>
            <DataProvenanceBadge type="DEMO_SYNTHETIC" label="CALIBRATION LOCK ACTIVE" />
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Dataset calibration controls, sensor gateway bridges, governing engineering codes, and audit exports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportBriefingMemo}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors"
            style={{
              background: 'var(--color-surface-container-med)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-surface-border-default)',
            }}
          >
            <FileDown size={13} />
            <span>{isExporting ? 'Generating Memo...' : 'Export Briefing Memo'}</span>
          </button>

          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors"
            style={{
              background: 'var(--color-brand-yellow)',
              color: 'var(--color-surface-base)',
              fontFamily: 'var(--font-display)',
            }}
          >
            <Save size={13} />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {saveToast && (
        <div
          className="p-3 rounded-lg text-xs flex items-center gap-2 animate-fade-in"
          style={{
            background: 'rgba(46,125,79,0.18)',
            color: '#4ADE80',
            border: '1px solid rgba(74,222,128,0.35)',
          }}
        >
          <CheckCircle2 size={14} />
          <span>Configuration parameters updated and stored in local working session.</span>
        </div>
      )}

      {/* Section 1: Workspace Dataset State & Calibration Lock */}
      <div
        className="rounded-lg p-5 space-y-4"
        style={{
          background: 'var(--color-surface-container-low)',
          border: '1px solid var(--color-surface-border-subtle)',
        }}
      >
        <div className="flex items-center justify-between border-b border-surface-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Database size={16} style={{ color: 'var(--color-brand-yellow)' }} />
            <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Active Workspace Dataset & Calibration Lock
            </h2>
          </div>
          <button
            onClick={() => setIsDemoLocked(!isDemoLocked)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-colors"
            style={{
              background: isDemoLocked ? 'rgba(245, 197, 66, 0.15)' : 'var(--color-surface-container-med)',
              color: isDemoLocked ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
              border: `1px solid ${isDemoLocked ? 'rgba(245, 197, 66, 0.3)' : 'var(--color-surface-border-subtle)'}`,
            }}
          >
            {isDemoLocked ? <Lock size={12} /> : <Unlock size={12} />}
            <span>{isDemoLocked ? 'CERTIFIED MASTER P6 LOCKED' : 'UNLOCKED (DEV MODE)'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded" style={{ background: 'var(--color-surface-container-med)' }}>
            <span className="text-[10px] uppercase font-semibold text-gray-400">Project / Package</span>
            <p className="font-semibold text-gray-200 mt-1">Package C-3 Elevated Viaduct</p>
            <p className="text-[10px] font-mono text-gray-400 mt-0.5">ID: PKG-C3-VIADUCT</p>
          </div>
          <div className="p-3 rounded" style={{ background: 'var(--color-surface-container-med)' }}>
            <span className="text-[10px] uppercase font-semibold text-gray-400">Chainage Extent</span>
            <p className="font-semibold text-gray-200 mt-1 font-mono">Ch. 14+200 → Ch. 18+600</p>
            <p className="text-[10px] text-gray-400 mt-0.5">4,400 Linear Meters (44 Piers)</p>
          </div>
          <div className="p-3 rounded" style={{ background: 'var(--color-surface-container-med)' }}>
            <span className="text-[10px] uppercase font-semibold text-gray-400">Dataset Mode</span>
            <p className="font-semibold text-yellow-400 mt-1">Synthetic Demo Baseline</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Calibrated per spec §3 for evaluation</p>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 italic">
          * Master P6 Schedule lock prevents accidental overwriting of certified EPC baseline dates during what-if parametric experimentation.
        </p>
      </div>

      {/* Section 2: Integration & Sensor Gateway Telemetry */}
      <div
        className="rounded-lg p-5 space-y-4"
        style={{
          background: 'var(--color-surface-container-low)',
          border: '1px solid var(--color-surface-border-subtle)',
        }}
      >
        <div className="flex items-center justify-between border-b border-surface-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Radio size={16} style={{ color: 'var(--color-brand-yellow)' }} />
            <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Telemetry Bridges & Sensor Gateways
            </h2>
          </div>
          <span className="text-[11px] font-mono text-gray-400">4 Active Bridges</span>
        </div>

        <div className="space-y-3">
          {/* Bridge 1: UAV Drone */}
          <div className="p-3 rounded flex items-center justify-between flex-wrap gap-2" style={{ background: 'var(--color-surface-container-med)' }}>
            <div className="flex items-center gap-3">
              <Cpu size={16} style={{ color: '#4ADE80' }} />
              <div>
                <p className="text-xs font-semibold text-gray-200">DJI Matrice 300 RTK — Flighthub Ingest</p>
                <p className="text-[11px] text-gray-400 font-mono">0.8mm/px GSD • Multi-spectral orthomosaic</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(46,125,79,0.18)', color: '#4ADE80' }}>
                ONLINE / STREAMING
              </span>
            </div>
          </div>

          {/* Bridge 2: Batch Plant */}
          <div className="p-3 rounded flex items-center justify-between flex-wrap gap-2" style={{ background: 'var(--color-surface-container-med)' }}>
            <div className="flex items-center gap-3">
              <Layers size={16} style={{ color: '#FBBF24' }} />
              <div>
                <p className="text-xs font-semibold text-gray-200">Command Alkon RMC SCADA Ingest</p>
                <p className="text-[11px] text-gray-400 font-mono">Batch slip telemetry & moisture compensation logs</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(217,154,53,0.18)', color: '#FBBF24' }}>
                SIMULATED DATASET
              </span>
            </div>
          </div>

          {/* Bridge 3: Inclinometer Gateway (UNCONFIGURED per spec §3) */}
          <div className="p-3 rounded flex items-center justify-between flex-wrap gap-2" style={{ background: 'var(--color-surface-container-med)' }}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={16} style={{ color: '#F87171' }} />
              <div>
                <p className="text-xs font-semibold text-gray-200">Encardio-Rite Modbus Borehole Inclinometer</p>
                <p className="text-[11px] text-gray-400 font-mono">Pier 18 Foundation Borehole Tilt Sensor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
                style={{
                  background: gatewayStatus === 'LINKED' ? 'rgba(46,125,79,0.18)' : 'rgba(239,68,68,0.18)',
                  color: gatewayStatus === 'LINKED' ? '#4ADE80' : '#F87171',
                }}
              >
                {gatewayStatus === 'LINKED' ? 'GATEWAY CONNECTED' : 'UNCONFIGURED (NO GATEWAY)'}
              </span>
              <button
                onClick={() => setShowConfigModal(true)}
                className="px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer"
                style={{
                  background: 'var(--color-surface-container-high)',
                  color: 'var(--color-brand-yellow)',
                  border: '1px solid var(--color-surface-border-strong)',
                }}
              >
                Configure
              </button>
            </div>
          </div>

          {/* Bridge 4: P6 EPPM */}
          <div className="p-3 rounded flex items-center justify-between flex-wrap gap-2" style={{ background: 'var(--color-surface-container-med)' }}>
            <div className="flex items-center gap-3">
              <Database size={16} style={{ color: '#38BDF8' }} />
              <div>
                <p className="text-xs font-semibold text-gray-200">Oracle Primavera P6 EPPM Sync</p>
                <p className="text-[11px] text-gray-400 font-mono">XML/REST bridge • CPM network recalculations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(56,189,248,0.18)', color: '#38BDF8' }}>
                SYNTHETIC P6 SYNC
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Governing Engineering Codes & Parameters */}
      <div
        className="rounded-lg p-5 space-y-4"
        style={{
          background: 'var(--color-surface-container-low)',
          border: '1px solid var(--color-surface-border-subtle)',
        }}
      >
        <div className="flex items-center gap-2 border-b border-surface-border-subtle pb-3">
          <Sliders size={16} style={{ color: 'var(--color-brand-yellow)' }} />
          <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            Governing Codes & Threshold Parameters
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-300 block">
              IRC:112 Permissible Surface Crack Width (w_max)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={crackLimit}
                onChange={e => setCrackLimit(e.target.value)}
                className="w-full px-3 py-2 rounded text-xs font-mono outline-none"
                style={{
                  background: 'var(--color-surface-container-med)',
                  color: 'var(--color-text-code)',
                  border: '1px solid var(--color-surface-border-default)',
                }}
              />
              <span className="text-xs font-mono text-gray-400">mm</span>
            </div>
            <p className="text-[10px] text-gray-400">IRC:112 Clause 12.3 Table 12.1 (Severe exposure limit)</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-300 block">
              UPV Ultrasonic Pulse Velocity Pass Threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={upvThreshold}
                onChange={e => setUpvThreshold(e.target.value)}
                className="w-full px-3 py-2 rounded text-xs font-mono outline-none"
                style={{
                  background: 'var(--color-surface-container-med)',
                  color: 'var(--color-text-code)',
                  border: '1px solid var(--color-surface-border-default)',
                }}
              />
              <span className="text-xs font-mono text-gray-400">m/s</span>
            </div>
            <p className="text-[10px] text-gray-400">IS:13311 Part 1 (Good to Excellent concrete grade)</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-300 block">
              Launching Gantry Contractual Daily Idling Rate
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={gantryRate}
                onChange={e => setGantryRate(e.target.value)}
                className="w-full px-3 py-2 rounded text-xs font-mono outline-none"
                style={{
                  background: 'var(--color-surface-container-med)',
                  color: 'var(--color-text-code)',
                  border: '1px solid var(--color-surface-border-default)',
                }}
              />
              <span className="text-xs font-mono text-gray-400">₹/Day</span>
            </div>
            <p className="text-[10px] text-gray-400">Contractor plant demurrage schedule</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-300 block">
              Independent Engineer Disposition SLA Window
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={slaHours}
                onChange={e => setSlaHours(e.target.value)}
                className="w-full px-3 py-2 rounded text-xs font-mono outline-none"
                style={{
                  background: 'var(--color-surface-container-med)',
                  color: 'var(--color-text-code)',
                  border: '1px solid var(--color-surface-border-default)',
                }}
              />
              <span className="text-xs font-mono text-gray-400">Hours</span>
            </div>
            <p className="text-[10px] text-gray-400">Turnaround time for sign-off on non-conformance</p>
          </div>
        </div>
      </div>

      {/* Sensor Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-lg p-5 space-y-4 animate-scale-up"
            style={{
              background: 'var(--color-surface-container-med)',
              border: '1px solid var(--color-surface-border-strong)',
            }}
          >
            <div className="flex items-center justify-between border-b border-surface-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Radio size={16} style={{ color: 'var(--color-brand-yellow)' }} />
                <h3 className="text-sm font-bold text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>
                  Configure Encardio-Rite Modbus Gateway
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-gray-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Link the digital RS-485 Modbus RTU gateway to start continuous borehole inclinometer telemetry for Pier 18 foundation stability.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-semibold text-gray-400 block mb-1">
                  Gateway IP Address / Host
                </label>
                <input
                  type="text"
                  value={gatewayIp}
                  onChange={e => setGatewayIp(e.target.value)}
                  className="w-full px-3 py-2 rounded font-mono outline-none"
                  style={{
                    background: 'var(--color-surface-container-high)',
                    color: 'var(--color-text-code)',
                    border: '1px solid var(--color-surface-border-default)',
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-gray-400 block mb-1">
                  Modbus Port
                </label>
                <input
                  type="text"
                  value={gatewayPort}
                  onChange={e => setGatewayPort(e.target.value)}
                  className="w-full px-3 py-2 rounded font-mono outline-none"
                  style={{
                    background: 'var(--color-surface-container-high)',
                    color: 'var(--color-text-code)',
                    border: '1px solid var(--color-surface-border-default)',
                  }}
                />
              </div>

              {gatewayStatus === 'LINKED' && (
                <div className="p-3 rounded text-xs flex items-center gap-2 bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 size={14} />
                  <span>Modbus handshake successful! 24 tilt channels active.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border-subtle">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-gray-200"
              >
                Close
              </button>
              <button
                onClick={handleTestGateway}
                disabled={gatewayStatus === 'TESTING'}
                className="px-4 py-1.5 rounded text-xs font-semibold cursor-pointer"
                style={{
                  background: 'var(--color-brand-yellow)',
                  color: 'var(--color-surface-base)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {gatewayStatus === 'TESTING' ? 'Handshaking...' : gatewayStatus === 'LINKED' ? 'Save & Close' : 'Test Connection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
