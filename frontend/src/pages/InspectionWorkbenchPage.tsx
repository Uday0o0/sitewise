import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { DataProvenanceBadge } from '../components/DataProvenanceBadge';
import {
  Loader2, AlertTriangle, Camera, Crosshair, Eye,
  CheckCircle2, Clock, AlertCircle, Send, Upload, Layers,
  FileImage, Hash, Info, ShieldAlert, Sliders, RefreshCw,
  FlaskConical, ExternalLink, Bot, FileText, GitFork
} from 'lucide-react';
import type {
  FindingListItem,
  FindingAnalysisResponse,
  FindingEvidenceLinkItem,
} from '../types/api';

type DispositionType = 'CONFIRM_NCR' | 'DOWNGRADE_SHRINKAGE' | 'REJECT_ARTIFACT';
type FilterMode = 'NORMAL' | 'EDGE_CONTRAST' | 'INVERT' | 'BIM_GRID';

export function InspectionWorkbenchPage() {
  const { findingId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeFindingId = findingId || searchParams.get('findingId') || 'FND-104';

  const [filterMode, setFilterMode] = useState<FilterMode>('NORMAL');
  const [showMaskOverlay, setShowMaskOverlay] = useState<boolean>(true);
  const [showReticle, setShowReticle] = useState<boolean>(true);
  const [disposition, setDisposition] = useState<DispositionType>('CONFIRM_NCR');
  const [engineerNotes, setEngineerNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [structureElementInput, setStructureElementInput] = useState('Pier Cap 18 Cantilever Downstream Face');
  const [gsdInput, setGsdInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Findings list for dropdown
  const [findingsList, setFindingsList] = useState<FindingListItem[]>([]);
  const [analysisData, setAnalysisData] = useState<FindingAnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // Grounded document evidence links
  const [evidenceLinks, setEvidenceLinks] = useState<FindingEvidenceLinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState<boolean>(false);

  // Load telemetry data for active finding
  const { data: telemetryData, loading: telemetryLoading, error: telemetryError, refetch: reloadTelemetry } = useApi(
    () => api.getFindingTelemetry(activeFindingId),
    [activeFindingId]
  );

  // Load findings list
  const loadFindingsList = async () => {
    try {
      const list = await api.listFindings();
      setFindingsList(list);
    } catch {
      // Fallback if list endpoint has temporary issue
      setFindingsList([
        {
          id: 'FND-104',
          title: 'Pier Cap 18 Crack — Transverse Propagation',
          structureElement: 'Pier Cap 18 Cantilever Downstream Face',
          chainageFormatted: 'Ch. 14+320',
          provenance: 'AI_INFERRED',
          category: 'structural',
          dispositionStatus: 'AWAITING_REVIEW',
          isUploaded: false,
        },
      ]);
    }
  };

  useEffect(() => {
    loadFindingsList();
  }, []);

  // Load analysis details whenever activeFindingId changes
  useEffect(() => {
    let isCancelled = false;
    setAnalysisLoading(true);
    setAnalysisData(null); // CRITICAL: Reset immediately so no stale count from previously selected image is shown
    setAnalysisError(null);
    setSelectedCandidateId(null);

    api.getFindingAnalysis(activeFindingId)
      .then(res => {
        if (!isCancelled) {
          setAnalysisData(res);
          setAnalysisLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setAnalysisData(null);
          setAnalysisLoading(false);
          setAnalysisError(err instanceof Error ? err.message : 'Image analysis unavailable.');
        }
      });

    // Also load grounded document evidence links for active finding
    setLoadingLinks(true);
    api.getFindingEvidenceLinks(activeFindingId)
      .then(res => {
        if (!isCancelled) {
          setEvidenceLinks(res.links || []);
          setLoadingLinks(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setEvidenceLinks([]);
          setLoadingLinks(false);
        }
      });

    return () => { isCancelled = true; };
  }, [activeFindingId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 25 * 1024 * 1024) {
        setUploadError('File exceeds maximum allowable size of 25 MB.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
        setUploadError('Unsupported file type. Please drop a JPEG or PNG image.');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setUploadError('File exceeds maximum allowable size of 25 MB.');
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a valid JPEG or PNG image to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('structureElement', structureElementInput.trim() || 'Inspected Structural Target');
      if (gsdInput.trim()) {
        const parsedGsd = parseFloat(gsdInput);
        if (isNaN(parsedGsd) || parsedGsd <= 0) {
          setUploadError('Calibration GSD must be a valid positive number in mm/px.');
          setIsUploading(false);
          return;
        }
        formData.append('gsdMmPerPx', gsdInput.trim());
      }

      const res = await api.uploadFindingImage(formData);
      setIsUploading(false);
      setIsUploadOpen(false);
      setSelectedFile(null);
      setGsdInput('');

      // Refresh findings list & switch to newly uploaded finding
      await loadFindingsList();
      navigate(`/inspections/${res.findingId}`);
    } catch (err: unknown) {
      setIsUploading(false);
      if (err instanceof Error) {
        setUploadError(err.message || 'Image upload failed.');
      } else {
        setUploadError('An unexpected upload error occurred. Please check backend connection.');
      }
    }
  };

  const handleSubmit = async () => {
    if (!engineerNotes.trim()) {
      setNotesError('Mandatory engineering justification required');
      return;
    }
    setNotesError('');
    setIsSubmitting(true);

    try {
      const result = await api.updateDisposition(activeFindingId, {
        disposition,
        engineerNotes,
        signerName: 'Demo Resident Engineer',
        signerLicenseId: 'RE-2024-DEMO',
      });
      setSubmitResult(result.message);
      reloadTelemetry();
    } catch {
      setSubmitResult('Failed to submit disposition');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (telemetryLoading && !telemetryData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-brand-yellow)' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading inspection telemetry...</span>
      </div>
    );
  }

  if (telemetryError || !telemetryData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle size={32} style={{ color: 'var(--color-prov-risk)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Failed to load inspection telemetry</p>
        <p className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{telemetryError}</p>
        <button
          onClick={() => navigate('/inspections/FND-104')}
          className="mt-2 px-3 py-1.5 rounded text-xs cursor-pointer font-semibold"
          style={{ background: 'var(--color-surface-container-med)', color: 'var(--color-brand-yellow)' }}
        >
          Return to Seeded Baseline (FND-104)
        </button>
      </div>
    );
  }

  const metro = telemetryData.photogrammetricMetrology;
  const isUploadedFinding = activeFindingId.startsWith('FND-UPL') || (analysisData && analysisData.algorithm.name.includes('BLACKHAT'));
  const hasRealImage = Boolean(isUploadedFinding && metro.imageUrl && metro.imageUrl.startsWith('/api/v4/evidence/'));
  const hasMask = Boolean(analysisData?.hasCandidate && analysisData?.maskUrl);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Controls & Finding Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--color-surface-border-subtle)]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-mono px-2 py-0.5 rounded font-bold"
              style={{
                background: 'rgba(245,197,66,0.15)',
                color: 'var(--color-brand-yellow)',
                border: '1px solid rgba(245,197,66,0.4)',
              }}
            >
              {telemetryData.findingId}
            </span>
            {isUploadedFinding ? (
              <DataProvenanceBadge type="HUMAN_REVIEWED" label="REAL EVIDENCE" sublabel="IMAGE-PROCESSING CANDIDATE" />
            ) : (
              <DataProvenanceBadge type="DEMO_SYNTHETIC" label="DEMO SYNTHETIC" sublabel="SVG BENCHMARK" />
            )}
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold"
              style={{
                background: isUploadedFinding ? 'rgba(56,189,248,0.15)' : 'rgba(245,197,66,0.15)',
                color: isUploadedFinding ? '#38BDF8' : 'var(--color-brand-yellow)',
                border: `1px solid ${isUploadedFinding ? 'rgba(56,189,248,0.35)' : 'rgba(245,197,66,0.35)'}`
              }}
            >
              {isUploadedFinding ? 'Real Image Ingest Pipeline' : 'Fixed Synthetic Calibration'}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.015em' }}>
              Inspection Workbench
            </h1>
            {/* Primary Action Button: Always Visible in Header */}
            <button
              id="workbench-header-upload-btn"
              data-testid="workbench-header-upload-btn"
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold shadow-md cursor-pointer transition-all hover:brightness-110 active:scale-95"
              style={{
                background: 'var(--color-brand-yellow)',
                color: '#000000',
                border: '1px solid #E5B338',
                fontFamily: 'var(--font-display)',
              }}
            >
              <Upload size={15} strokeWidth={2.5} />
              <span>UPLOAD IMAGE</span>
            </button>

            {/* Workflow Quick Links: Evidence Graph & Simulator */}
            <div className="flex items-center gap-2">
              <button
                id="trace-risk-cascade-btn"
                onClick={() => navigate(`/evidence-graph?findingId=${activeFindingId}&nodeId=N-AI-001`)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold cursor-pointer transition-colors"
                style={{
                  background: 'var(--color-surface-container-high)',
                  color: '#38BDF8',
                  border: '1px solid rgba(56,189,248,0.4)',
                  fontFamily: 'var(--font-display)',
                }}
                title="Trace finding through causal risk cascade to CPM delay and mitigation"
              >
                <Layers size={14} />
                <span>Trace Risk Cascade</span>
              </button>
              <button
                id="launch-simulator-btn"
                onClick={() => navigate(`/simulator?findingId=${activeFindingId}&nodeId=N-AI-001`)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold cursor-pointer transition-colors"
                style={{
                  background: 'var(--color-surface-container-high)',
                  color: 'var(--color-brand-yellow)',
                  border: '1px solid rgba(245,197,66,0.4)',
                  fontFamily: 'var(--font-display)',
                }}
                title="Launch What-If Remediation Simulator for this finding"
              >
                <FlaskConical size={14} />
                <span>What-If Simulator</span>
              </button>
              <button
                id="consult-assistant-btn"
                onClick={() => navigate(`/assistant?prompt=${encodeURIComponent(`Evaluate ${activeFindingId} Pier 18 cantilever crack aperture (0.35mm) against IRC:112 Clause 12.3 criteria.`)}`)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold cursor-pointer transition-colors"
                style={{
                  background: 'var(--color-surface-container-high)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-surface-border-default)',
                  fontFamily: 'var(--font-display)',
                }}
                title="Consult Site Assistant about this finding"
              >
                <Bot size={14} />
                <span>Site Assistant</span>
              </button>
            </div>
          </div>

          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {telemetryData.structureElement} • {telemetryData.assetChainage}
          </p>
        </div>

        {/* Action Bar: Target Selector Dropdown */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <label className="text-[10px] block text-[var(--color-text-tertiary)] uppercase font-mono mb-1 font-semibold">
              Inspection Target
            </label>
            <select
              id="finding-selector-dropdown"
              data-testid="finding-selector-dropdown"
              value={activeFindingId}
              onChange={(e) => navigate(`/inspections/${e.target.value}`)}
              className="px-3 py-2 text-xs rounded font-mono cursor-pointer outline-none transition-colors"
              style={{
                background: 'var(--color-surface-container-med)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-surface-border-strong)',
                minWidth: '260px',
              }}
            >
              {findingsList.map(item => (
                <option key={item.id} value={item.id}>
                  {item.id} — {item.structureElement} {item.isUploaded ? '[UPLOADED]' : '[DEMO]'}
                </option>
              ))}
            </select>
          </div>

          <div className="self-end">
            <button
              id="open-upload-modal-btn"
              data-testid="open-upload-modal-btn"
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer transition-colors"
              style={{
                background: 'var(--color-surface-container-high)',
                color: 'var(--color-brand-yellow)',
                border: '1px solid var(--color-brand-yellow)',
                fontFamily: 'var(--font-display)',
              }}
            >
              <Upload size={14} />
              + New Upload
            </button>
          </div>
        </div>
      </div>

      {/* CRACK DETECTION SUMMARY CARD — PROMINENT NEAR HEADING, ABOVE VIEWPORT */}
      <div
        id="crack-detection-summary-card"
        data-testid="crack-detection-summary-card"
        className="rounded-xl border p-4 mb-4 transition-all duration-200"
        style={{
          background: 'var(--color-surface-container-med)',
          borderColor: analysisLoading
            ? 'var(--color-surface-border-subtle)'
            : analysisError
            ? 'rgba(239, 68, 68, 0.45)'
            : (analysisData?.crackSummary?.candidateCount || 0) > 0
            ? 'rgba(245, 197, 66, 0.5)'
            : 'rgba(56, 189, 248, 0.4)',
          boxShadow: (analysisData?.crackSummary?.candidateCount || 0) > 0
            ? '0 4px 20px rgba(245, 197, 66, 0.08)'
            : '0 2px 10px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Top Bar: Icon + Title + Status Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {analysisLoading ? (
              <Loader2 size={18} className="animate-spin text-yellow-400" />
            ) : analysisError ? (
              <AlertCircle size={18} className="text-red-400" />
            ) : (analysisData?.crackSummary?.candidateCount || 0) > 0 ? (
              <AlertTriangle size={18} className="text-yellow-400" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-400" />
            )}
            <span
              className="text-xs font-mono tracking-wider font-bold"
              style={{ color: 'var(--color-text-primary)', textTransform: 'uppercase' }}
            >
              Crack Detection Summary
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-800/80 border border-neutral-700/60">
              PRELIMINARY IMAGE PROCESSING • HUMAN REVIEW REQUIRED
            </span>
            {!isUploadedFinding && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                FND-104 BENCHMARK
              </span>
            )}
          </div>

          {/* Detection Status Badge */}
          <div>
            {analysisLoading ? (
              <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                ANALYZING IMAGE...
              </span>
            ) : analysisError ? (
              <span
                id="crack-status-badge"
                data-testid="crack-status-badge"
                className="text-[11px] font-mono font-bold px-3 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/40"
              >
                Analysis failed
              </span>
            ) : (analysisData?.crackSummary?.candidateCount || 0) > 0 ? (
              <span
                id="crack-status-badge"
                data-testid="crack-status-badge"
                className="text-[11px] font-mono font-bold px-3 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
              >
                Potential crack-like regions detected
              </span>
            ) : (
              <span
                id="crack-status-badge"
                data-testid="crack-status-badge"
                className="text-[11px] font-mono font-bold px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              >
                No candidates detected
              </span>
            )}
          </div>
        </div>

        {/* Content Area */}
        {analysisLoading ? (
          <div className="py-4 flex items-center gap-3 text-xs text-neutral-400 font-mono">
            <Loader2 size={16} className="animate-spin text-yellow-400" />
            <span>Running connected-component analysis on segmented image mask...</span>
          </div>
        ) : analysisError ? (
          <div className="mt-3 p-3 rounded bg-red-950/30 border border-red-900/50 text-xs text-red-300">
            <p className="font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="text-red-400" />
              <span>Analysis failed</span>
            </p>
            <p className="text-[11px] text-red-400/80 mt-1 font-mono">{analysisError}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {/* Large Readable Count & Details Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-[var(--color-surface-border-subtle)]">
              <div>
                <div
                  id="crack-candidate-count"
                  data-testid="crack-candidate-count"
                  className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight"
                >
                  {(analysisData?.crackSummary?.candidateCount || 0) > 0
                    ? `${analysisData?.crackSummary?.candidateCount} potential crack-like region${(analysisData?.crackSummary?.candidateCount || 0) !== 1 ? 's' : ''} detected`
                    : 'No candidates detected'}
                </div>
              </div>

              {/* Resolution & Calibration State */}
              <div className="text-xs font-mono flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-neutral-300">
                  <span className="text-neutral-500 uppercase">Resolution:</span>
                  <span className="font-semibold text-white px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[11px]">
                    {analysisData?.crackSummary?.imageResolution ||
                      (analysisData?.imageMetadata
                        ? `${analysisData.imageMetadata.width} × ${analysisData.imageMetadata.height} px`
                        : telemetryData.captureSource.lens)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500 uppercase">Calibration:</span>
                  {analysisData?.crackSummary?.isCalibrated ? (
                    <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[11px] font-semibold">
                      calibrated with user-supplied unverified calibration ({analysisData.calibration.gsdMmPerPx} mm/px)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 text-[11px]">
                      uncalibrated pixel-space only
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Plain-Language Explanation */}
            <div className="p-2.5 rounded bg-[var(--color-surface-container-high)] border border-[var(--color-surface-border-subtle)] text-xs text-neutral-200 leading-relaxed">
              <p id="crack-plain-explanation" data-testid="crack-plain-explanation">
                {analysisData?.crackSummary?.explanation || (
                  (analysisData?.crackSummary?.candidateCount || 0) > 0
                    ? `We found ${analysisData?.crackSummary?.candidateCount} candidate image region(s) that look like possible cracks. Candidate regions can be shadows, joints, stains, or surface texture and require qualified human engineering review before confirming any physical crack.`
                    : 'No potential crack-like regions were detected by this image-processing method. This preliminary result does not prove the concrete surface is crack-free.'
                )}
              </p>
            </div>

            {/* Candidate List (Compact Row Format) */}
            {analysisData?.crackSummary?.candidates && analysisData.crackSummary.candidates.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-[var(--color-surface-border-subtle)]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Grouped Candidates ({analysisData.crackSummary.candidates.length}) — Click row to highlight in viewport:</span>
                  {selectedCandidateId && (
                    <button
                      id="clear-candidate-selection-btn"
                      onClick={() => setSelectedCandidateId(null)}
                      className="text-[10px] text-yellow-400 hover:underline cursor-pointer"
                    >
                      Clear Selection (Show None)
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {analysisData.crackSummary.candidates.map((cand, idx) => {
                    const isSelected = selectedCandidateId === cand.id;
                    const hasCal = cand.calibratedWidthMm !== null && cand.calibratedWidthMm !== undefined;
                    const candNum = cand.id.replace(/[^0-9]/g, '') || String(idx + 1);

                    return (
                      <div
                        key={cand.id}
                        id={`candidate-row-${cand.id.replace(/\s+/g, '-').toLowerCase()}`}
                        data-testid={`candidate-row-${cand.id.replace(/\s+/g, '-').toLowerCase()}`}
                        onClick={() => setSelectedCandidateId(isSelected ? null : cand.id)}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded text-xs transition-all cursor-pointer font-mono select-none"
                        style={{
                          background: isSelected
                            ? 'rgba(245, 197, 66, 0.18)'
                            : 'var(--color-surface-container-high)',
                          border: isSelected
                            ? '1px solid var(--color-brand-yellow)'
                            : '1px solid var(--color-surface-border-subtle)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="px-1.5 py-0.5 rounded text-[11px] font-bold"
                            style={{
                              background: isSelected ? 'var(--color-brand-yellow)' : 'rgba(255,255,255,0.08)',
                              color: isSelected ? '#000000' : 'var(--color-brand-yellow)',
                            }}
                          >
                            #{candNum}
                          </span>
                          <span className="font-semibold text-white">{cand.id}</span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-neutral-300 flex-wrap">
                          <span>Area: <strong className="text-white">{cand.areaPx.toLocaleString()}</strong> px²</span>
                          <span>Trace: <strong className="text-white">~{cand.traceLengthPx ?? '?'}</strong> px</span>
                          <span>Mean Width: <strong className="text-white">~{cand.meanWidthPx ?? '?'}</strong> px</span>
                          <span>Max Width: <strong className="text-white">~{cand.maxWidthPx ?? '?'}</strong> px</span>
                          {hasCal ? (
                            <span className="text-yellow-300 font-semibold px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30">
                              ~{cand.calibratedWidthMm} mm (Unverified)
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-[10px]">Pixel-space only</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reassuring Footnote / Human Review Disclaimer */}
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-surface-border-subtle)] text-[10px] text-neutral-400 leading-normal">
              <ShieldAlert size={14} className="text-yellow-400 shrink-0" />
              <span>
                Candidate regions are not confirmed physical cracks. Automated image processing can detect shadows,
                joints, stains, or surface texture and requires qualified human engineering review.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Viewport + Telemetry */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Photogrammetric Viewport — 3 columns */}
        <div className="xl:col-span-3 space-y-4">
          {/* Viewport Frame */}
          <div
            className="rounded-lg overflow-hidden relative flex items-center justify-center select-none"
            style={{
              background: 'var(--color-surface-container-low)',
              border: '1px solid var(--color-surface-border-subtle)',
              aspectRatio: '16/10',
              minHeight: '360px',
            }}
          >
            {hasRealImage ? (
              /* REAL UPLOADED IMAGE RENDERING */
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
                {/* Real Uploaded Image */}
                <img
                  src={metro.imageUrl}
                  alt="Real Structural Inspection Target"
                  className="w-full h-full object-contain transition-all duration-200"
                  style={{
                    filter:
                      filterMode === 'EDGE_CONTRAST'
                        ? 'contrast(200%) brightness(110%) saturate(150%)'
                        : filterMode === 'INVERT'
                        ? 'invert(1) hue-rotate(180deg)'
                        : undefined,
                  }}
                />

                {/* Candidate Mask Overlay (Toggled) — Shows subtle candidate pixels */}
                {hasMask && showMaskOverlay && (
                  <img
                    src={`/api/v4/evidence/images/${analysisData?.imageId}/mask`}
                    alt="Crack Candidate Overlay Mask"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-200"
                    style={{
                      mixBlendMode: filterMode === 'INVERT' ? 'difference' : 'screen',
                    }}
                  />
                )}

                {/* Selected Candidate Focus Marker — ONLY for the single selected candidate */}
                {selectedCandidateId && analysisData?.crackSummary?.candidates && (() => {
                  const selectedCand = analysisData.crackSummary.candidates.find(c => c.id === selectedCandidateId);
                  if (!selectedCand) return null;
                  const imgW = analysisData.imageMetadata?.width || 1;
                  const imgH = analysisData.imageMetadata?.height || 1;
                  const bbox = selectedCand.boundingBox;
                  if (!bbox || bbox.length < 4) return null;
                  const candNum = selectedCand.id.replace(/[^0-9]/g, '') || selectedCand.id;

                  return (
                    <div
                      id="selected-candidate-marker"
                      data-testid="selected-candidate-marker"
                      className="absolute rounded pointer-events-none transition-all duration-200"
                      style={{
                        left: `${Math.max(0, (bbox[0] / imgW) * 100)}%`,
                        top: `${Math.max(0, (bbox[1] / imgH) * 100)}%`,
                        width: `${Math.min(100, (bbox[2] / imgW) * 100)}%`,
                        height: `${Math.min(100, (bbox[3] / imgH) * 100)}%`,
                        border: '2px solid var(--color-brand-yellow)',
                        boxShadow: '0 0 16px rgba(245, 197, 66, 0.7), inset 0 0 6px rgba(245, 197, 66, 0.2)',
                        backgroundColor: 'rgba(245, 197, 66, 0.08)',
                      }}
                    >
                      <div
                        className="absolute -top-3.5 -left-1 flex items-center justify-center text-[10px] px-1.5 py-0.5 rounded shadow font-mono font-bold"
                        style={{
                          background: 'var(--color-brand-yellow)',
                          color: '#000000',
                          border: '1px solid #000000',
                          lineHeight: 1,
                        }}
                      >
                        #{candNum}
                      </div>
                    </div>
                  );
                })()}

                {/* BIM Rebar Synthetic Grid Overlay Mode */}
                {filterMode === 'BIM_GRID' && (
                  <div className="absolute inset-0 pointer-events-none opacity-40">
                    <svg className="w-full h-full">
                      <defs>
                        <pattern id="bim-grid-pattern" width="50" height="50" patternUnits="userSpaceOnUse">
                          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#bim-grid-pattern)" />
                    </svg>
                  </div>
                )}

                {/* Bottom Right Provenance Badge (No overlap) */}
                <div
                  className="absolute bottom-3 right-3 px-2 py-1 rounded text-[10px] font-mono pointer-events-none flex items-center gap-1.5"
                  style={{
                    background: 'rgba(0,0,0,0.85)',
                    color: analysisData?.hasCandidate ? 'var(--color-brand-yellow)' : '#38BDF8',
                    border: `1px solid ${analysisData?.hasCandidate ? 'rgba(245,197,66,0.4)' : 'rgba(56,189,248,0.4)'}`,
                  }}
                >
                  <Camera size={12} />
                  <span>
                    REAL INGEST • {analysisData?.imageMetadata.width}×{analysisData?.imageMetadata.height}px
                    {analysisData?.hasCandidate ? ' [CANDIDATE DETECTED]' : ' [NO DEFECT CANDIDATE]'}
                  </span>
                </div>
              </div>
            ) : (
              /* SEEDED BENCHMARK SVG RENDERING (FND-104) */
              <div className="absolute inset-0 overflow-hidden" style={{ background: filterMode === 'INVERT' ? '#e2e8f0' : 'var(--color-surface-canvas)' }}>
                <svg className="w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="none">
                  <defs>
                    <pattern id="concrete-grain" width="40" height="40" patternUnits="userSpaceOnUse">
                      <rect width="40" height="40" fill={filterMode === 'INVERT' ? '#e2e8f0' : '#14171a'} />
                      <circle cx="10" cy="12" r="1" fill={filterMode === 'INVERT' ? '#cbd5e1' : '#23272b'} />
                      <circle cx="28" cy="30" r="1.5" fill={filterMode === 'INVERT' ? '#cbd5e1' : '#1c2024'} />
                      <circle cx="34" cy="8" r="0.8" fill={filterMode === 'INVERT' ? '#94a3b8' : '#2a2f34'} />
                    </pattern>
                    <pattern id="bim-rebar-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(56,189,248,0.35)" strokeWidth="1" strokeDasharray="4 2" />
                      <circle cx="0" cy="0" r="2.5" fill="#0284c7" />
                    </pattern>
                  </defs>

                  <rect width="800" height="500" fill="url(#concrete-grain)" />
                  <line x1="80" y1="0" x2="80" y2="500" stroke={filterMode === 'INVERT' ? '#94a3b8' : '#282d32'} strokeWidth="2" />
                  <line x1="720" y1="0" x2="720" y2="500" stroke={filterMode === 'INVERT' ? '#94a3b8' : '#282d32'} strokeWidth="2" />
                  <line x1="0" y1="420" x2="800" y2="420" stroke={filterMode === 'INVERT' ? '#94a3b8' : '#282d32'} strokeWidth="1.5" strokeDasharray="8 4" />
                  <text x="90" y="440" fill={filterMode === 'INVERT' ? '#64748b' : '#4b5563'} fontSize="9" fontFamily="monospace">PIER 18 SOFFIT DATUM +12.40m</text>

                  {filterMode === 'BIM_GRID' && (
                    <rect width="800" height="500" fill="url(#bim-rebar-grid)" />
                  )}

                  {/* Seeded Crack Vector */}
                  <g>
                    <path
                      d="M 330 180 Q 365 210 395 245 T 450 310 T 480 345"
                      fill="none"
                      stroke={filterMode === 'EDGE_CONTRAST' ? '#4ade80' : filterMode === 'INVERT' ? '#000000' : 'rgba(239,68,68,0.4)'}
                      strokeWidth={filterMode === 'EDGE_CONTRAST' ? '6' : '4'}
                      strokeLinecap="round"
                    />
                    <path
                      d="M 330 180 Q 365 210 395 245 T 450 310 T 480 345"
                      fill="none"
                      stroke={filterMode === 'EDGE_CONTRAST' ? '#fbbf24' : filterMode === 'INVERT' ? '#dc2626' : '#f5c542'}
                      strokeWidth={filterMode === 'EDGE_CONTRAST' ? '3' : '2'}
                      strokeLinecap="round"
                    />
                  </g>

                  <line x1="320" y1="170" x2="490" y2="355" stroke="rgba(245,197,66,0.3)" strokeDasharray="3 3" />
                  <text x="500" y="360" fill="var(--color-brand-yellow)" fontSize="10" fontFamily="monospace">
                    L = 420mm (Vector: 42°)
                  </text>
                </svg>

                {/* Seeded Reticle */}
                {showReticle && (
                  <div
                    className="absolute rounded transition-all duration-200"
                    style={{
                      top: '32%', left: '38%', width: '25%', height: '38%',
                      border: selectedCandidateId === 'Candidate 1'
                        ? '2.5px solid var(--color-brand-yellow)'
                        : '1.5px dashed var(--color-brand-yellow)',
                      boxShadow: selectedCandidateId === 'Candidate 1'
                        ? '0 0 20px rgba(245,197,66,0.6)'
                        : '0 0 10px rgba(245,197,66,0.2)',
                      backgroundColor: selectedCandidateId === 'Candidate 1'
                        ? 'rgba(245, 197, 66, 0.1)'
                        : 'transparent',
                    }}
                  >
                    <div
                      className="absolute -top-6 left-0 text-[10px] px-2 py-0.5 rounded whitespace-nowrap"
                      style={{
                        background: selectedCandidateId === 'Candidate 1' ? 'var(--color-brand-yellow)' : 'rgba(0,0,0,0.85)',
                        color: selectedCandidateId === 'Candidate 1' ? '#000000' : 'var(--color-brand-yellow)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: selectedCandidateId === 'Candidate 1' ? 'bold' : 'normal',
                        border: selectedCandidateId === 'Candidate 1' ? 'none' : '1px solid rgba(245,197,66,0.4)',
                      }}
                    >
                      Candidate 1 [3,360 px² • Seeded Aperture: {metro.calibratedApertureMm}mm]
                    </div>
                  </div>
                )}

                {/* Bottom Right Benchmark Badge (No overlap) */}
                <div
                  className="absolute bottom-3 right-3 px-2 py-1 rounded text-[10px] font-mono pointer-events-none"
                  style={{
                    background: 'rgba(0,0,0,0.85)',
                    color: 'var(--color-brand-yellow)',
                    border: '1px solid rgba(245,197,66,0.3)',
                  }}
                >
                  SYNTHETIC ORTHOMOSAIC SIMULATION (0.8mm/px GSD BENCHMARK)
                </div>
              </div>
            )}

            {/* Viewport Control Bar (Top Right) */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 flex-wrap">
              {/* Mask overlay toggle (for uploaded images) */}
              {isUploadedFinding && (
                <button
                  id="toggle-mask-btn"
                  data-testid="toggle-mask-btn"
                  onClick={() => setShowMaskOverlay(!showMaskOverlay)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded font-mono cursor-pointer transition-colors"
                  style={{
                    background: showMaskOverlay ? 'rgba(245,197,66,0.25)' : 'rgba(0,0,0,0.75)',
                    color: showMaskOverlay ? 'var(--color-brand-yellow)' : 'var(--color-text-tertiary)',
                    border: `1px solid ${showMaskOverlay ? 'rgba(245,197,66,0.5)' : 'rgba(255,255,255,0.15)'}`,
                  }}
                  title="Toggle candidate mask overlay to view original image or candidate highlight"
                >
                  <Layers size={11} />
                  <span>OVERLAY: {showMaskOverlay ? 'ON' : 'OFF'}</span>
                </button>
              )}

              {/* Reticle toggle */}
              <button
                id="toggle-reticle-btn"
                onClick={() => setShowReticle(!showReticle)}
                className="px-2 py-1 text-[9px] rounded font-mono cursor-pointer transition-colors"
                style={{
                  background: showReticle ? 'rgba(56,189,248,0.2)' : 'rgba(0,0,0,0.7)',
                  color: showReticle ? '#38BDF8' : 'var(--color-text-tertiary)',
                  border: `1px solid ${showReticle ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                RETICLE
              </button>

              {/* Filter mode toggles */}
              {(['NORMAL', 'EDGE_CONTRAST', 'INVERT', 'BIM_GRID'] as FilterMode[]).map(mode => (
                <button
                  key={mode}
                  id={`filter-${mode.toLowerCase()}-btn`}
                  onClick={() => setFilterMode(mode)}
                  className="px-2 py-1 text-[9px] rounded cursor-pointer transition-colors font-mono"
                  style={{
                    background: filterMode === mode ? 'rgba(245,197,66,0.2)' : 'rgba(0,0,0,0.7)',
                    color: filterMode === mode ? 'var(--color-brand-yellow)' : 'var(--color-text-tertiary)',
                    border: filterMode === mode ? '1px solid rgba(245,197,66,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {mode.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Bottom Left Scale Bar */}
            <div className="absolute bottom-3 left-4 flex items-end gap-1 pointer-events-none">
              <div className="flex flex-col items-start bg-black/75 px-2 py-1 rounded border border-white/10">
                <span className="text-[8px] font-mono text-[var(--color-text-tertiary)]">
                  {telemetryData.captureSource.gsdMmPerPx ? (
                    `CALIBRATED: 1:10 @ ${telemetryData.captureSource.gsdMmPerPx} mm/px GSD (User-Supplied)`
                  ) : (
                    'UNCALIBRATED: PIXEL-SPACE ONLY (No physical scale)'
                  )}
                </span>
                <div className="w-24 h-1 mt-1 bg-gradient-to-r from-yellow-500 to-neutral-700" />
              </div>
            </div>
          </div>

          {/* Telemetry Summary Strip */}
          <div
            className="rounded-lg p-4 grid grid-cols-2 lg:grid-cols-4 gap-4"
            style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
          >
            <TelemetryValue
              icon={<Camera size={14} />}
              label="Source / Flight"
              value={telemetryData.captureSource.flightId}
            />
            <TelemetryValue
              icon={<FileImage size={14} />}
              label="Resolution"
              value={analysisData ? `${analysisData.imageMetadata.width} × ${analysisData.imageMetadata.height} px` : telemetryData.captureSource.lens}
            />
            <TelemetryValue
              icon={<Hash size={14} />}
              label="Digest (SHA-256)"
              value={analysisData?.sha256 ? `#${analysisData.sha256.slice(0, 10)}...` : 'SEEDED-DEMO'}
            />
            <TelemetryValue
              icon={<Clock size={14} />}
              label="Ingest Timestamp"
              value={new Date(telemetryData.captureSource.capturedAt || Date.now()).toLocaleDateString()}
            />
          </div>

          {/* Detailed Image Metrology & Provenance Section */}
          <div
            className="rounded-lg p-4 space-y-4"
            style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                <Sliders size={16} className="text-yellow-500" />
                Image-Derived Metrology & Crack Quantification
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                Algorithm: {analysisData?.algorithm.name || 'DEMO-SEEDED'} ({analysisData?.algorithm.version || 'v1.0'})
              </span>
            </div>

            {/* Status / Disclaimer Box */}
            <div
              className="p-3 rounded text-xs flex items-start gap-2.5"
              style={{
                background: analysisData?.hasCandidate ? 'rgba(245,197,66,0.08)' : 'rgba(56,189,248,0.08)',
                border: `1px solid ${analysisData?.hasCandidate ? 'rgba(245,197,66,0.25)' : 'rgba(56,189,248,0.25)'}`,
              }}
            >
              <ShieldAlert size={16} className={analysisData?.hasCandidate ? 'text-yellow-500 shrink-0 mt-0.5' : 'text-blue-400 shrink-0 mt-0.5'} />
              <div className="space-y-1">
                <p className="font-semibold" style={{ color: analysisData?.hasCandidate ? 'var(--color-brand-yellow)' : '#38BDF8' }}>
                  {analysisData?.disclaimer || 'IMAGE-PROCESSING CANDIDATE — HUMAN REVIEW REQUIRED'}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {analysisData?.limitations || 'Preliminary morphological segmentation cannot distinguish structural fissures from surface joints, shadows, formwork lines, or deep stains. Certified engineering conclusion requires direct physical tactile gauge.'}
                </p>
              </div>
            </div>

            {/* Split Metrics: Pixel-Space vs Calibrated Physical */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Pixel-Space Measurements */}
              <div className="p-3 rounded bg-[var(--color-surface-container-med)] border border-[var(--color-surface-border-subtle)] space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-surface-border-subtle)]">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">
                    Pixel-Space Metrics (Direct Array)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">UNBIASED ARRAY</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">Candidate Area</p>
                    <p className="text-sm font-mono font-bold text-neutral-100">
                      {analysisData?.pixelMetrics.areaPx !== undefined
                        ? `${analysisData.pixelMetrics.areaPx.toLocaleString()} px`
                        : `${metro.calibratedApertureMm ? '3,360 px' : '0 px'}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">Trace Length</p>
                    <p className="text-sm font-mono font-bold text-neutral-100">
                      {analysisData?.pixelMetrics.traceLengthPx !== undefined && analysisData.pixelMetrics.traceLengthPx !== null
                        ? `${analysisData.pixelMetrics.traceLengthPx.toFixed(1)} px`
                        : '525.0 px'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">Mean Aperture</p>
                    <p className="text-sm font-mono font-bold text-neutral-100">
                      {analysisData?.pixelMetrics.meanAperturePx !== undefined && analysisData.pixelMetrics.meanAperturePx !== null
                        ? `${analysisData.pixelMetrics.meanAperturePx.toFixed(2)} px`
                        : '0.44 px'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">Max Aperture</p>
                    <p className="text-sm font-mono font-bold text-neutral-100">
                      {analysisData?.pixelMetrics.maxAperturePx !== undefined && analysisData.pixelMetrics.maxAperturePx !== null
                        ? `${analysisData.pixelMetrics.maxAperturePx.toFixed(2)} px`
                        : '0.55 px'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Physical Metrology Estimates */}
              <div className="p-3 rounded bg-[var(--color-surface-container-med)] border border-[var(--color-surface-border-subtle)] space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-surface-border-subtle)]">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">
                    Calibrated Estimates (Physical mm)
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${analysisData?.calibration.isCalibrated ? 'bg-amber-900/40 text-amber-300' : 'bg-neutral-800 text-neutral-400'}`}>
                    {analysisData?.calibration.provenance || (telemetryData.captureSource.gsdMmPerPx ? 'USER_PROVIDED_UNVERIFIED' : 'UNAVAILABLE')}
                  </span>
                </div>

                {analysisData?.calibration.isCalibrated || (!isUploadedFinding && metro.calibratedApertureMm > 0) ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">Aperture (mm)</p>
                      <p className="text-sm font-mono font-bold text-yellow-400">
                        {metro.calibratedApertureMm ? `${metro.calibratedApertureMm.toFixed(2)} mm` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">Trace Length (mm)</p>
                      <p className="text-sm font-mono font-bold text-neutral-100">
                        {metro.linearTraceLengthMm ? `${metro.linearTraceLengthMm.toFixed(1)} mm` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">Threshold Limit</p>
                      <p className="text-sm font-mono font-bold text-neutral-100">
                        {metro.permissibleThresholdMm ? `${metro.permissibleThresholdMm.toFixed(2)} mm` : '0.20 mm'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">Exceedance</p>
                      <p className={`text-sm font-mono font-bold ${metro.exceedancePercent > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {metro.exceedancePercent > 0 ? `+${metro.exceedancePercent}%` : 'PASS'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center space-y-1">
                    <p className="text-xs font-semibold text-neutral-400">Physical Dimensions Unavailable</p>
                    <p className="text-[11px] text-neutral-500">
                      No GSD calibration was supplied. Pixel dimensions cannot be converted to physical units without certified reference target.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--color-surface-border-subtle)] text-[11px] text-[var(--color-text-tertiary)] flex items-center justify-between">
              <span>Governing Code: <span className="font-mono text-neutral-300">{metro.governingCode || 'IRC:112'}</span></span>
              <span>Root Mechanism: <span className="text-neutral-300">{metro.inferredRootMechanism || 'Analysis pending'}</span></span>
            </div>
          </div>
        </div>

        {/* Right Panel — NDT Protocols + Grounded Evidence + Resident Disposition */}
        <div className="xl:col-span-2 space-y-4">
          {/* Grounded Document Evidence & Citations */}
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                <FileText size={16} style={{ color: 'var(--color-brand-yellow)' }} />
                <span>Grounded Evidence &amp; Source Citations</span>
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {loadingLinks ? 'FETCHING...' : `${evidenceLinks.length} VERIFIED CITATIONS`}
              </span>
            </div>

            {loadingLinks ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="animate-spin text-amber-400" size={18} />
                <span className="ml-2 text-xs text-gray-400 font-mono">Loading document citations...</span>
              </div>
            ) : evidenceLinks.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {evidenceLinks.map(lnk => (
                  <div
                    key={lnk.id}
                    className="p-3 rounded space-y-1.5"
                    style={{
                      background: 'var(--color-surface-container-med)',
                      border: '1px solid var(--color-surface-border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-200 truncate pr-2">
                        {lnk.documentTitle || 'Project Specification Document'}
                      </span>
                      {lnk.pageNumber && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-gray-300 shrink-0">
                          p. {lnk.pageNumber}
                        </span>
                      )}
                    </div>
                    {lnk.citationText && (
                      <p className="text-[11px] font-mono italic pl-2 border-l-2 text-amber-300" style={{ borderColor: 'var(--color-brand-yellow)' }}>
                        &ldquo;{lnk.citationText}&rdquo;
                      </p>
                    )}
                    {lnk.relevanceNote && (
                      <p className="text-[10px] text-gray-400">
                        {lnk.relevanceNote}
                      </p>
                    )}
                    {lnk.downloadUrl && (
                      <div className="flex justify-end pt-1">
                        <a
                          href={lnk.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 hover:underline"
                        >
                          <ExternalLink size={10} />
                          <span>View Source Document</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-neutral-400 bg-neutral-900/50 rounded space-y-1">
                <p>No verified document passages linked yet to {activeFindingId}.</p>
                <p className="text-[10px] text-neutral-500">
                  Upload project specifications in Evidence Centre to attach verifiable citations.
                </p>
              </div>
            )}
          </div>

          {/* NDT Corroboration */}
          <div
            className="rounded-lg p-4"
            style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              NDT Corroboration Protocols
            </h3>
            <div className="space-y-2">
              {telemetryData.ndtCorroboration && telemetryData.ndtCorroboration.length > 0 ? (
                telemetryData.ndtCorroboration.map((ndt, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded"
                    style={{ background: 'var(--color-surface-container-med)' }}
                  >
                    <NdtStatusIcon status={ndt.status} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{ndt.protocolName}</p>
                        {ndt.provenance && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                              ndt.provenance === 'SOURCE_VERIFIED'
                                ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                                : ndt.provenance === 'HUMAN_REVIEWED'
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {ndt.provenance.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{ndt.details}</p>
                      {ndt.sourceDocumentId && (
                        <p className="text-[10px] mt-0.5 font-mono text-emerald-400">
                          Source Document: {ndt.sourceDocumentId}
                        </p>
                      )}
                      {ndt.scheduledTime && (
                        <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          Scheduled: {new Date(ndt.scheduledTime).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <NdtStatusBadge status={ndt.status} />
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-neutral-400 bg-neutral-900/50 rounded">
                  No corroborating NDT tests logged for this uploaded finding.
                </div>
              )}
            </div>
          </div>

          {/* Disposition Form */}
          <div
            className="rounded-lg p-4"
            style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-surface-border-subtle)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Resident Reviewer Disposition
            </h3>

            {/* Current Status Indicator */}
            <div className="mb-3 p-2 rounded bg-neutral-900 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Current Status:</span>
              <span className="font-mono font-semibold px-2 py-0.5 rounded bg-yellow-950/60 text-yellow-400 border border-yellow-800/50">
                {telemetryData.reviewerDispositionState.currentStatus.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              {([
                { value: 'CONFIRM_NCR', label: 'Confirm as Non-Conformance Finding [Escalate to NCR]' },
                { value: 'DOWNGRADE_SHRINKAGE', label: 'Downgrade to Shrinkage Crack [Cosmetic Only]' },
                { value: 'REJECT_ARTIFACT', label: 'Reject as Imaging Artifact [No Action Required]' },
              ] as { value: DispositionType; label: string }[]).map(opt => (
                <label
                  key={opt.value}
                  className="flex items-start gap-2 p-2.5 rounded cursor-pointer transition-colors"
                  style={{
                    background: disposition === opt.value ? 'var(--color-surface-container-med)' : 'transparent',
                    border: `1px solid ${disposition === opt.value ? 'var(--color-surface-border-strong)' : 'var(--color-surface-border-subtle)'}`,
                  }}
                >
                  <input
                    type="radio"
                    name="disposition"
                    value={opt.value}
                    checked={disposition === opt.value}
                    onChange={() => setDisposition(opt.value)}
                    className="mt-0.5 accent-yellow-500"
                  />
                  <span className="text-xs" style={{ color: 'var(--color-text-primary)' }}>{opt.label}</span>
                </label>
              ))}
            </div>

            {/* Engineer notes */}
            <div className="mb-4">
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>
                Engineering Justification Notes *
              </label>
              <textarea
                value={engineerNotes}
                onChange={e => { setEngineerNotes(e.target.value); setNotesError(''); }}
                rows={4}
                className="w-full rounded-md px-3 py-2 text-xs resize-none outline-none transition-colors"
                style={{
                  background: 'var(--color-surface-container-med)',
                  color: 'var(--color-text-primary)',
                  border: notesError ? '1px solid #EF4444' : '1px solid var(--color-surface-border-default)',
                  fontFamily: 'var(--font-body)',
                }}
                placeholder="Enter technical justification based on image array evidence..."
              />
              {notesError && (
                <p className="text-[10px] mt-1" style={{ color: '#EF4444' }}>{notesError}</p>
              )}
            </div>

            {/* Signer Info */}
            <div className="mb-4 p-2 rounded" style={{ background: 'var(--color-surface-container-med)' }}>
              <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Resident Signer</p>
              <p className="text-xs font-mono" style={{ color: 'var(--color-text-code)', fontFamily: 'var(--font-mono)' }}>
                Demo Resident Engineer (RE-2024-DEMO)
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                PKI Audit Ledger: Active Local Session
              </p>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              style={{
                background: 'var(--color-brand-yellow)',
                color: 'var(--color-surface-base)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Signing & Generating Audit Hash...
                </>
              ) : (
                <>
                  <Send size={14} />
                  SIGN & ISSUE {disposition === 'CONFIRM_NCR' ? 'NCR PROTOCOL' : 'DISPOSITION'}
                </>
              )}
            </button>

            {/* Result toast */}
            {submitResult && (
              <div
                className="mt-3 p-3 rounded text-xs animate-fade-in"
                style={{
                  background: 'rgba(46,125,79,0.14)',
                  color: 'var(--color-prov-verified)',
                  border: '1px solid rgba(34,197,94,0.30)',
                }}
              >
                {submitResult}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal Drawer */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div
            className="w-full max-w-lg rounded-lg p-6 space-y-4"
            style={{
              background: 'var(--color-surface-container-low)',
              border: '1px solid var(--color-surface-border-strong)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-border-subtle)]">
              <h2 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                <Upload size={18} className="text-yellow-500" />
                Upload Real Inspection Image
              </h2>
              <button
                id="close-upload-modal-btn"
                onClick={() => { setIsUploadOpen(false); setUploadError(null); }}
                className="text-neutral-400 hover:text-white text-xs px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File Dropzone */}
              <div
                id="upload-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors hover:border-yellow-500"
                style={{
                  borderColor: selectedFile ? 'var(--color-brand-yellow)' : 'var(--color-surface-border-default)',
                  background: selectedFile ? 'rgba(245,197,66,0.06)' : 'var(--color-surface-container-med)',
                }}
              >
                <input
                  id="image-file-input"
                  data-testid="image-file-input"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png"
                  className="hidden"
                />
                <FileImage size={36} className={selectedFile ? 'text-yellow-500 mb-2' : 'text-neutral-400 mb-2'} />
                {selectedFile ? (
                  <div className="text-center">
                    <p className="text-xs font-semibold text-yellow-400 font-mono">{selectedFile.name}</p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'image'}
                    </p>
                    <p className="text-[10px] text-emerald-400 mt-1">✓ Ready for analysis</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-xs font-semibold text-neutral-200">
                      Drag & drop inspection photo here, or click to browse
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Accepts JPEG and PNG images up to 25 MB
                    </p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="mt-3 px-3 py-1.5 rounded text-xs font-semibold bg-neutral-800 text-yellow-400 border border-yellow-500/40 hover:bg-neutral-700 cursor-pointer"
                    >
                      Browse Device Files
                    </button>
                  </div>
                )}
              </div>

              {/* Form Input: Structure Element */}
              <div>
                <label className="text-xs font-semibold block text-[var(--color-text-secondary)] mb-1">
                  Structure Element / Location Name *
                </label>
                <input
                  id="upload-element-input"
                  data-testid="upload-element-input"
                  type="text"
                  value={structureElementInput}
                  onChange={(e) => setStructureElementInput(e.target.value)}
                  placeholder="e.g. Pier Cap 18 Cantilever Downstream Face"
                  className="w-full px-3 py-2 text-xs rounded outline-none font-mono"
                  style={{
                    background: 'var(--color-surface-container-med)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-surface-border-default)',
                  }}
                  required
                />
              </div>

              {/* Form Input: Calibration GSD */}
              <div>
                <label className="text-xs font-semibold block text-[var(--color-text-secondary)] mb-1">
                  Calibration GSD (mm per pixel) — Optional
                </label>
                <input
                  id="upload-gsd-input"
                  data-testid="upload-gsd-input"
                  type="number"
                  step="0.01"
                  min="0.001"
                  value={gsdInput}
                  onChange={(e) => setGsdInput(e.target.value)}
                  placeholder="e.g. 0.8 (Leave blank for pixel-space analysis only)"
                  className="w-full px-3 py-2 text-xs rounded outline-none font-mono"
                  style={{
                    background: 'var(--color-surface-container-med)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-surface-border-default)',
                  }}
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  Note: If provided, calibration is labeled <span className="font-mono text-yellow-400">USER_PROVIDED_UNVERIFIED</span>. If omitted, physical dimensions are marked unavailable.
                </p>
              </div>

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="p-3 rounded text-xs bg-red-950/70 text-red-300 border border-red-800 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-400" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  id="cancel-upload-btn"
                  onClick={() => { setIsUploadOpen(false); setUploadError(null); }}
                  className="px-4 py-2 text-xs rounded text-neutral-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="submit-upload-btn"
                  data-testid="submit-upload-btn"
                  disabled={isUploading || !selectedFile}
                  className="flex items-center gap-2 px-5 py-2 rounded text-xs font-bold cursor-pointer disabled:opacity-50 transition-all hover:brightness-110"
                  style={{
                    background: 'var(--color-brand-yellow)',
                    color: '#000000',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      Processing Image Array...
                    </>
                  ) : (
                    <>
                      <Upload size={14} strokeWidth={2.5} />
                      Process & Inspect Image
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TelemetryValue({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span style={{ color: 'var(--color-text-tertiary)', marginTop: '1px' }}>{icon}</span>
      <div>
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
        <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-code)', fontFamily: 'var(--font-mono)' }}>{value}</p>
      </div>
    </div>
  );
}

function NdtStatusIcon({ status }: { status: string }) {
  if (status === 'PASS') return <CheckCircle2 size={16} style={{ color: '#4ADE80', flexShrink: 0, marginTop: '1px' }} />;
  if (status === 'SCHEDULED') return <Clock size={16} style={{ color: '#FBBF24', flexShrink: 0, marginTop: '1px' }} />;
  return <AlertCircle size={16} style={{ color: '#38BDF8', flexShrink: 0, marginTop: '1px' }} />;
}

function NdtStatusBadge({ status }: { status: string }) {
  const s: Record<string, { bg: string; color: string }> = {
    PASS: { bg: 'rgba(46,125,79,0.14)', color: '#4ADE80' },
    SCHEDULED: { bg: 'rgba(217,154,53,0.14)', color: '#FBBF24' },
    AWAITING_DISPOSITION: { bg: 'rgba(56,189,248,0.14)', color: '#38BDF8' },
  };
  const style = s[status] || s.PASS;
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0" style={{ background: style.bg, color: style.color, fontFamily: 'var(--font-mono)' }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
