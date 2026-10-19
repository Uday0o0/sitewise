import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { DataProvenanceBadge } from '../components/DataProvenanceBadge';
import type {
  GraphNode,
  EvidenceGraphResponse,
  GoverningCodeLimit,
  ProvenanceType,
  NodeSourceDetailsResponse,
  FindingEvidenceLinkItem,
} from '../types/api';
import {
  Loader2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  FlaskConical,
  ClipboardCheck,
  FileText,
  ShieldAlert,
  Clock,
  Wrench,
  CheckCircle2,
  Info,
  Layers,
  ArrowDown,
  Quote,
  RefreshCw,
  Bot,
} from 'lucide-react';

type FilterMode = 'ALL' | 'CRITICAL_PATH_ONLY' | 'SOURCE_EVIDENCE' | 'MITIGATIONS';

export function EvidenceGraphPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlGraphId = searchParams.get('graphId') || 'GR-FND104';
  const urlNodeId = searchParams.get('nodeId');
  const urlFindingId = searchParams.get('findingId');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // Dynamic node source details state
  const [nodeDetails, setNodeDetails] = useState<NodeSourceDetailsResponse | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Main topology fetch
  const { data, loading, error, refetch: reloadTopology } = useApi(
    () => api.getGraphTopology(urlGraphId),
    [urlGraphId]
  );

  // Selected node initialization and synchronization with URL query parameters
  useEffect(() => {
    if (!data) return;

    // 1. If nodeId is specified in URL and exists in graph, select it
    if (urlNodeId && data.nodes.some(n => n.id === urlNodeId)) {
      setSelectedNodeId(urlNodeId);
      setIsInspectorOpen(true);
      return;
    }

    // 2. If findingId is specified in URL, find the matching node
    if (urlFindingId) {
      const matchNode = data.nodes.find(
        n => n.findingId === urlFindingId || (n.nodeType === 'FINDING' && n.id.includes(urlFindingId))
      );
      if (matchNode) {
        setSelectedNodeId(matchNode.id);
        setIsInspectorOpen(true);
        return;
      }
    }

    // 3. Otherwise fall back to drawer default or first node
    if (!selectedNodeId) {
      const defaultId = data.inspectorDrawer?.nodeId || (data.nodes[0] ? data.nodes[0].id : null);
      if (defaultId) {
        setSelectedNodeId(defaultId);
      }
    }
  }, [data, urlNodeId, urlFindingId]);

  // Fetch node source details when selectedNodeId changes
  useEffect(() => {
    if (!data || !selectedNodeId) {
      setNodeDetails(null);
      return;
    }

    let isMounted = true;
    setLoadingDetails(true);
    setDetailsError(null);

    api
      .getNodeSourceDetails(data.graphId, selectedNodeId)
      .then(res => {
        if (isMounted) {
          setNodeDetails(res);
          setLoadingDetails(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          // Graceful fallback to topology node if detail endpoint fails
          setDetailsError(err.message || 'Failed to load extended node details');
          setLoadingDetails(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [data, selectedNodeId]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(prev => (prev === nodeId ? null : nodeId));
    setIsInspectorOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <Loader2 className="animate-spin" size={28} style={{ color: 'var(--color-brand-yellow)' }} />
        <span className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
          Retrieving Evidence-to-Risk causal graph...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3 text-center">
        <AlertTriangle size={36} style={{ color: 'var(--color-prov-risk)' }} />
        <h2 className="text-sm font-semibold text-gray-200">Failed to load evidence graph</h2>
        <p className="text-xs max-w-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          {error || 'Unable to connect to graph topology service.'}
        </p>
        <button
          onClick={() => reloadTopology()}
          className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors"
          style={{
            background: 'var(--color-surface-container-high)',
            color: 'var(--color-brand-yellow)',
            border: '1px solid var(--color-surface-border-default)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <RefreshCw size={13} />
          Retry Connection
        </button>
      </div>
    );
  }

  const selectedNode = data.nodes.find(n => n.id === (selectedNodeId || data.inspectorDrawer?.nodeId));
  const filteredNodes = filterNodes(data, filterMode);
  const filteredEdges = data.connections.filter(e => {
    const nodeIds = filteredNodes.map(n => n.id);
    return nodeIds.includes(e.sourceNodeId) && nodeIds.includes(e.targetNodeId);
  });

  return (
    <div className="flex gap-0 h-full -m-6 animate-fade-in overflow-hidden">
      {/* Main Graph Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b shrink-0 flex-wrap gap-2"
          style={{
            background: 'var(--color-surface-container-low)',
            borderColor: 'var(--color-surface-border-subtle)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Evidence Graph — Causal Matrix
            </h1>
            <span
              className="text-[10px] px-2 py-0.5 rounded font-mono"
              style={{
                color: 'var(--color-text-tertiary)',
                background: 'var(--color-surface-container-high)',
                border: '1px solid var(--color-surface-border-subtle)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {data.cpmGraphSyncedAgo}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div
              className="flex items-center rounded-md overflow-hidden"
              style={{ border: '1px solid var(--color-surface-border-default)' }}
            >
              {(['ALL', 'CRITICAL_PATH_ONLY', 'SOURCE_EVIDENCE', 'MITIGATIONS'] as FilterMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className="px-2.5 py-1 text-[10px] font-semibold transition-colors cursor-pointer"
                  style={{
                    background: filterMode === mode ? 'var(--color-surface-container-high)' : 'transparent',
                    color: filterMode === mode ? 'var(--color-brand-yellow)' : 'var(--color-text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {mode.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <span className="w-px h-5" style={{ background: 'var(--color-surface-border-default)' }} />

            {/* Zoom Controls */}
            <button
              onClick={() => setZoomLevel(z => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
              className="p-1 rounded cursor-pointer hover:bg-surface-container-high transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span
              className="text-[10px] font-mono w-9 text-center select-none"
              style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}
            >
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(z => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}
              className="p-1 rounded cursor-pointer hover:bg-surface-container-high transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1 rounded cursor-pointer hover:bg-surface-container-high transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Reset Zoom"
            >
              <Maximize2 size={14} />
            </button>

            <span className="w-px h-5" style={{ background: 'var(--color-surface-border-default)' }} />

            {/* Toggle Drawer */}
            <button
              onClick={() => setIsInspectorOpen(!isInspectorOpen)}
              className="px-2.5 py-1 text-[10px] rounded flex items-center gap-1.5 transition-colors cursor-pointer"
              style={{
                background: isInspectorOpen ? 'var(--color-surface-container-high)' : 'transparent',
                color: isInspectorOpen ? 'var(--color-brand-yellow)' : 'var(--color-text-tertiary)',
                border: '1px solid var(--color-surface-border-default)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>{isInspectorOpen ? 'Hide Drawer' : 'Show Drawer'}</span>
            </button>
          </div>
        </div>

        {/* Graph Canvas */}
        <div
          className="flex-1 overflow-auto p-8 relative select-none"
          style={{ background: 'var(--color-surface-base)' }}
        >
          {filteredNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
              <Layers size={28} style={{ color: 'var(--color-text-tertiary)' }} />
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                No nodes match the active filter mode.
              </p>
              <button
                onClick={() => setFilterMode('ALL')}
                className="text-[11px] font-mono underline cursor-pointer"
                style={{ color: 'var(--color-brand-yellow)' }}
              >
                Reset filter to ALL
              </button>
            </div>
          ) : (
            <div
              className="transition-transform duration-200 origin-top-center flex flex-col items-center min-w-max pb-12"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              {/* Tier Hierarchy */}
              {[1, 2, 3, 4, 5].map(tier => {
                const tierNodes = filteredNodes.filter(n => n.tier === tier);
                if (tierNodes.length === 0) return null;

                const outgoingEdges = filteredEdges.filter(e => {
                  const src = filteredNodes.find(n => n.id === e.sourceNodeId);
                  return src && src.tier === tier;
                });

                return (
                  <div key={tier} className="flex flex-col items-center w-full">
                    {/* Tier Header Tag */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-px" style={{ background: 'var(--color-surface-border-subtle)' }} />
                      <span
                        className="text-[9px] uppercase tracking-wider font-mono font-bold px-2 py-0.5 rounded"
                        style={{
                          background: 'var(--color-surface-container-high)',
                          color: 'var(--color-text-tertiary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        Tier {tier} — {getTierLabel(tier)}
                      </span>
                      <span className="w-6 h-px" style={{ background: 'var(--color-surface-border-subtle)' }} />
                    </div>

                    {/* Nodes in this tier */}
                    <div className="flex flex-wrap justify-center gap-4 max-w-4xl">
                      {tierNodes.map(node => (
                        <GraphNodeCard
                          key={node.id}
                          node={node}
                          isSelected={node.id === selectedNode?.id}
                          isConnected={isConnectedToSelected(
                            node.id,
                            selectedNode?.id || '',
                            data.connections
                          )}
                          onClick={() => handleNodeSelect(node.id)}
                        />
                      ))}
                    </div>

                    {/* Typed Edge Connectors between tiers */}
                    {tier < 5 && outgoingEdges.length > 0 && (
                      <div className="flex flex-col items-center gap-1.5 my-3">
                        {outgoingEdges.map((e, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <div
                              className="w-px h-3"
                              style={{
                                background: e.isCriticalPath
                                  ? 'var(--color-brand-yellow)'
                                  : 'var(--color-surface-border-default)',
                              }}
                            />
                            <div
                              className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono transition-all"
                              style={{
                                background: e.isCriticalPath
                                  ? 'rgba(245, 197, 66, 0.12)'
                                  : 'var(--color-surface-container-low)',
                                color: e.isCriticalPath
                                  ? 'var(--color-brand-yellow)'
                                  : 'var(--color-text-tertiary)',
                                border: e.isCriticalPath
                                  ? '1px solid rgba(245, 197, 66, 0.35)'
                                  : '1px solid var(--color-surface-border-subtle)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {e.relationshipType && (
                                <span
                                  className="font-bold text-[8px] uppercase tracking-wider px-1 py-0.2 rounded"
                                  style={{
                                    background: 'var(--color-surface-container-high)',
                                    color: e.isCriticalPath ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
                                  }}
                                >
                                  {e.relationshipType}
                                </span>
                              )}
                              <span>{e.connectorLabel}</span>
                              <ArrowDown size={10} />
                            </div>
                            <div
                              className="w-px h-3"
                              style={{
                                background: e.isCriticalPath
                                  ? 'var(--color-brand-yellow)'
                                  : 'var(--color-surface-border-default)',
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Inspector Drawer */}
      {selectedNode && isInspectorOpen && (
        <div
          className="shrink-0 border-l overflow-auto animate-slide-in-right z-10"
          style={{
            width: '390px',
            background: 'var(--color-surface-container-low)',
            borderColor: 'var(--color-surface-border-subtle)',
          }}
        >
          <InspectorPanel
            node={selectedNode}
            details={nodeDetails}
            loadingDetails={loadingDetails}
            detailsError={detailsError}
            data={data}
            navigate={navigate}
            onClose={() => setIsInspectorOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Node Card Component ───────────────────────────────────────────────────

function GraphNodeCard({
  node,
  isSelected,
  isConnected,
  onClick,
}: {
  node: GraphNode;
  isSelected: boolean;
  isConnected: boolean;
  onClick: () => void;
}) {
  const nodeType = (node.nodeType || inferNodeTypeFromTier(node.tier)).toUpperCase();
  const typeStyle = getNodeTypeAccent(nodeType);
  const dimmed = !isSelected && !isConnected;

  return (
    <div
      className="rounded-lg p-3.5 w-[290px] cursor-pointer transition-all duration-200 relative group"
      style={{
        background: 'var(--color-surface-container-low)',
        border: isSelected
          ? '2px solid var(--color-brand-yellow)'
          : `1px solid ${dimmed ? 'var(--color-surface-border-subtle)' : typeStyle.border}`,
        boxShadow: isSelected
          ? '0 0 18px rgba(245,197,66,0.22)'
          : '0 2px 8px rgba(0,0,0,0.25)',
        opacity: dimmed ? 0.4 : 1,
      }}
      onClick={onClick}
    >
      {/* Card Header: Node Type Pill + Provenance Badge */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <span
          className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1"
          style={{
            background: typeStyle.bg,
            color: typeStyle.color,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {typeStyle.icon}
          {nodeType}
        </span>
        <DataProvenanceBadge
          type={(node.provenance as ProvenanceType) || 'AI_INFERRED'}
          label={node.badgeText || undefined}
        />
      </div>

      {/* Title */}
      <h3
        className="text-xs font-bold leading-tight mb-1 group-hover:text-brand-yellow transition-colors"
        style={{
          fontFamily: 'var(--font-display)',
          color: isSelected ? 'var(--color-brand-yellow)' : 'var(--color-text-primary)',
        }}
      >
        {node.title}
      </h3>

      {/* Subtitle */}
      {node.primarySubtitle && (
        <p className="text-[11px] mb-2.5 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
          {node.primarySubtitle}
        </p>
      )}

      {/* Code reference / severity tags if present */}
      {(node.codeReference || node.severity || node.confidence) && (
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {node.codeReference && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--color-surface-container-high)',
                color: 'var(--color-text-code)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {node.codeReference}
            </span>
          )}
          {node.severity && (
            <span
              className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold"
              style={{
                background: node.severity === 'critical' ? 'rgba(239,68,68,0.18)' : 'rgba(245,197,66,0.18)',
                color: node.severity === 'critical' ? '#F87171' : 'var(--color-brand-yellow)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {node.severity}
            </span>
          )}
          {node.confidence !== undefined && node.confidence !== null && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(56,189,248,0.12)',
                color: '#38BDF8',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {Math.round(node.confidence * 100)}% conf
            </span>
          )}
        </div>
      )}

      {/* Metrics chips */}
      {node.metrics && Object.entries(node.metrics).length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t" style={{ borderColor: 'var(--color-surface-border-subtle)' }}>
          {Object.entries(node.metrics).map(([key, val]) => (
            <span
              key={key}
              className="text-[9px] px-1.5 py-0.5 rounded font-mono"
              style={{
                background: 'var(--color-surface-container-med)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {key}: <span style={{ color: 'var(--color-text-code)' }}>{String(val)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inspector Panel Component ─────────────────────────────────────────────

function InspectorPanel({
  node,
  details,
  loadingDetails,
  detailsError,
  data,
  navigate,
  onClose,
}: {
  node: GraphNode;
  details: NodeSourceDetailsResponse | null;
  loadingDetails: boolean;
  detailsError: string | null;
  data: EvidenceGraphResponse;
  navigate: (path: string) => void;
  onClose: () => void;
}) {
  const nodeType = (details?.nodeType || node.nodeType || inferNodeTypeFromTier(node.tier)).toUpperCase();
  const typeStyle = getNodeTypeAccent(nodeType);

  // Inspector fallback provenance items
  const inspector = data.inspectorDrawer;
  const isMatchingInspectorNode = inspector && inspector.nodeId === node.id;
  const provenanceTrail = details?.provenanceTrail || (isMatchingInspectorNode ? inspector.provenanceTrail : []);
  const governingCodeLimits = details?.governingCodeLimits || (isMatchingInspectorNode ? inspector.governingCodeLimits : []);

  // Citation text & document info
  const hasSource = details?.hasSourceDocument || Boolean(details?.documentId);
  const citationText = details?.citationText || node.citationText;
  const passageContent = details?.passageContent;
  const downloadUrl = details?.downloadUrl;
  const sourceStatus = details?.sourceStatus || (hasSource ? 'AVAILABLE' : 'NO_SOURCE_ATTACHED');
  const evidenceLinks = details?.evidenceLinks || [];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{
                background: typeStyle.bg,
                color: typeStyle.color,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {typeStyle.icon}
              {nodeType}
            </span>
            <DataProvenanceBadge type={(node.provenance as ProvenanceType) || 'AI_INFERRED'} />
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-xs px-2 py-1 rounded hover:bg-surface-container-med cursor-pointer transition-colors"
            title="Close Inspector"
          >
            ✕ Close
          </button>
        </div>

        <h2 className="text-sm font-bold leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
          {details?.title || node.title}
        </h2>
        {(details?.primarySubtitle || node.primarySubtitle) && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {details?.primarySubtitle || node.primarySubtitle}
          </p>
        )}
      </div>

      {loadingDetails && (
        <div className="flex items-center gap-2 px-3 py-2 rounded text-[11px] font-mono" style={{ background: 'var(--color-surface-container-med)', color: 'var(--color-brand-yellow)' }}>
          <Loader2 className="animate-spin" size={13} />
          <span>Synchronizing grounded node details...</span>
        </div>
      )}

      {detailsError && (
        <div className="px-3 py-2 rounded text-[11px] font-mono" style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171' }}>
          <span>Notice: {detailsError}</span>
        </div>
      )}

      {/* Rationale callout */}
      {(details?.rationale || node.rationale) && (
        <div
          className="p-3 rounded-md space-y-1"
          style={{
            background: 'rgba(245, 197, 66, 0.08)',
            border: '1px solid rgba(245, 197, 66, 0.25)',
          }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-brand-yellow)' }}>
            <Info size={13} />
            <span>Engineering Rationale</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {details?.rationale || node.rationale}
          </p>
        </div>
      )}

      {/* Source Passage & Document Citation */}
      {hasSource && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}
            >
              Source Evidence Citation
            </h3>
            {details?.pageNumber && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold"
                style={{
                  background: 'var(--color-surface-container-high)',
                  color: 'var(--color-brand-yellow)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Page {details.pageNumber}
              </span>
            )}
          </div>

          <div
            className="p-3 rounded-md space-y-2.5"
            style={{
              background: 'var(--color-surface-container-med)',
              border: '1px solid var(--color-surface-border-default)',
            }}
          >
            {/* Document Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={15} style={{ color: 'var(--color-brand-yellow)', flexShrink: 0 }} />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {details?.documentTitle || 'Attached Source Document'}
                  </p>
                  {details?.documentFilename && (
                    <p className="text-[10px] truncate font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                      {details.documentFilename}
                    </p>
                  )}
                </div>
              </div>

              {downloadUrl && (
                <button
                  onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer shrink-0"
                  style={{
                    background: 'var(--color-surface-container-high)',
                    color: 'var(--color-brand-yellow)',
                    border: '1px solid var(--color-surface-border-subtle)',
                    fontFamily: 'var(--font-mono)',
                  }}
                  title="Open original uploaded file in new tab"
                >
                  <ExternalLink size={11} />
                  <span>Open File</span>
                </button>
              )}
            </div>

            {/* Citation quote */}
            {citationText && (
              <div
                className="p-2 rounded text-xs italic relative pl-6"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  borderLeft: '2px solid var(--color-brand-yellow)',
                  color: 'var(--color-text-code)',
                }}
              >
                <Quote size={12} className="absolute left-1.5 top-2 opacity-50" />
                <span>&ldquo;{citationText}&rdquo;</span>
              </div>
            )}

            {/* Passage content preview if different from citation */}
            {passageContent && passageContent !== citationText && (
              <div className="text-[11px] leading-relaxed pt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                <p className="line-clamp-4">{passageContent}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Missing or deleted source reference warning */}
      {(sourceStatus === 'MISSING_DOCUMENT' || sourceStatus === 'MISSING_PASSAGE') && (
        <div
          className="p-3 rounded-md space-y-1"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
          }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#F87171' }}>
            <AlertTriangle size={13} />
            <span>Referenced Source Unavailable</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            The document passage originally cited by this node has been removed or is no longer accessible on disk.
          </p>
        </div>
      )}

      {/* Grounded Finding-Evidence Links (if finding has real linked documents) */}
      {evidenceLinks.length > 0 && (
        <div className="space-y-2">
          <h3
            className="text-xs font-semibold uppercase tracking-wide flex items-center justify-between"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}
          >
            <span>Linked Documents ({evidenceLinks.length})</span>
            <span className="text-[10px] font-mono lowercase" style={{ color: 'var(--color-prov-verified)' }}>
              source verified
            </span>
          </h3>

          <div className="space-y-2">
            {evidenceLinks.map((lnk: FindingEvidenceLinkItem) => (
              <div
                key={lnk.id}
                className="p-2.5 rounded-md space-y-1.5"
                style={{
                  background: 'var(--color-surface-container-med)',
                  border: '1px solid var(--color-surface-border-subtle)',
                }}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText size={13} style={{ color: 'var(--color-brand-yellow)', flexShrink: 0 }} />
                    <span className="text-xs font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {lnk.documentTitle || 'Cited Document'}
                    </span>
                  </div>
                  {lnk.pageNumber && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-text-tertiary)' }}>
                      p.{lnk.pageNumber}
                    </span>
                  )}
                </div>

                {lnk.citationText && (
                  <p className="text-[11px] italic pl-2 border-l-2" style={{ borderColor: 'var(--color-brand-yellow)', color: 'var(--color-text-secondary)' }}>
                    &ldquo;{lnk.citationText}&rdquo;
                  </p>
                )}

                {lnk.downloadUrl && (
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => window.open(lnk.downloadUrl, '_blank', 'noopener,noreferrer')}
                      className="flex items-center gap-1 text-[10px] font-mono text-brand-yellow hover:underline cursor-pointer"
                    >
                      <ExternalLink size={10} />
                      <span>View Source Passage</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provenance Trail (Synthetic demo citations if no live source attached) */}
      {!hasSource && provenanceTrail.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}
            >
              Provenance Trail ({provenanceTrail.length})
            </h3>
            <span className="text-[9px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
              SYNTHETIC DEMO
            </span>
          </div>

          <div className="space-y-1.5">
            {provenanceTrail.map(doc => (
              <div
                key={doc.documentId}
                className="flex items-center gap-2 px-2.5 py-2 rounded"
                style={{ background: 'var(--color-surface-container-med)' }}
              >
                <FileText size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {doc.title}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {doc.spec}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Governing Code Limits */}
      {governingCodeLimits.length > 0 && (
        <div className="space-y-2">
          <h3
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}
          >
            Governing Code Limits
          </h3>
          <div className="space-y-1.5">
            {governingCodeLimits.map((cl: GoverningCodeLimit, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between px-2.5 py-2 rounded text-xs"
                style={{ background: 'var(--color-surface-container-med)' }}
              >
                <div>
                  <p className="font-mono text-[11px] font-bold" style={{ color: 'var(--color-text-code)', fontFamily: 'var(--font-mono)' }}>
                    {cl.code}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    Limit: {cl.limit} &bull; Measured: {cl.measured}
                  </p>
                </div>
                <CodeLimitStatusBadge status={cl.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details & Metrics Key-Value Grid */}
      {node.metrics && Object.entries(node.metrics).length > 0 && (
        <div className="space-y-2">
          <h3
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}
          >
            Metrics &amp; Parameters
          </h3>
          <div className="space-y-1">
            {Object.entries(node.metrics).map(([key, val]) => (
              <div
                key={key}
                className="flex justify-between text-xs py-1"
                style={{ borderBottom: '1px solid var(--color-surface-border-subtle)' }}
              >
                <span style={{ color: 'var(--color-text-tertiary)' }}>{key}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-code)' }}>{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--color-surface-border-subtle)' }}>
        <button
          onClick={() => {
            const fId = node.findingId || (node.nodeType === 'FINDING' ? node.id : 'FND-104');
            navigate(`/simulator?findingId=${encodeURIComponent(fId)}&nodeId=${encodeURIComponent(node.id)}&graphId=${encodeURIComponent(data.graphId)}`);
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-xs font-bold transition-colors cursor-pointer"
          style={{
            background: 'var(--color-brand-yellow)',
            color: 'var(--color-surface-base)',
            fontFamily: 'var(--font-display)',
          }}
        >
          <FlaskConical size={14} />
          Launch What-If Remediation Simulation
        </button>



        {(node.findingId || node.nodeType === 'FINDING' || node.tier === 2) && (
          <button
            onClick={() => navigate(`/inspections/${node.findingId || 'FND-104'}`)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs transition-colors cursor-pointer hover:bg-surface-container-high"
            style={{
              background: 'var(--color-surface-container-med)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-surface-border-default)',
            }}
          >
            <ClipboardCheck size={14} />
            Inspect in Review Workbench
          </button>
        )}

        <button
          onClick={() => {
            const fId = node.findingId || (node.nodeType === 'FINDING' ? node.id : 'FND-104');
            const promptText = `Evaluate ${fId} (${node.title}) against governing specifications and code limits.`;
            navigate(`/assistant?prompt=${encodeURIComponent(promptText)}&projectId=${encodeURIComponent(node.projectId || 'PRJ-NH48-PKG3')}`);
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs transition-colors cursor-pointer hover:bg-surface-container-high"
          style={{
            background: 'var(--color-surface-container-med)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-surface-border-default)',
          }}
        >
          <Bot size={14} />
          Consult Site Assistant
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function CodeLimitStatusBadge({ status }: { status: string }) {
  const s: Record<string, { bg: string; color: string }> = {
    EXCEEDED: { bg: 'rgba(239,68,68,0.16)', color: '#F87171' },
    CRITICAL_ZONE: { bg: 'rgba(245,197,66,0.16)', color: '#FBBF24' },
    COMPLIANT: { bg: 'rgba(46,125,79,0.16)', color: '#4ADE80' },
  };
  const style = s[status] || s.COMPLIANT;
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
      style={{ background: style.bg, color: style.color, fontFamily: 'var(--font-mono)' }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function getTierLabel(tier: number): string {
  const labels: Record<number, string> = {
    1: 'SOURCE EVIDENCE',
    2: 'INSPECTION FINDING',
    3: 'PROJECT RISK',
    4: 'SCHEDULE/COST IMPACT',
    5: 'PROPOSED MITIGATION',
  };
  return labels[tier] || 'LAYER';
}

function inferNodeTypeFromTier(tier: number): string {
  switch (tier) {
    case 1:
      return 'EVIDENCE';
    case 2:
      return 'FINDING';
    case 3:
      return 'RISK';
    case 4:
      return 'IMPACT';
    case 5:
      return 'ACTION';
    default:
      return 'FINDING';
  }
}

function getNodeTypeAccent(type: string): { bg: string; color: string; border: string; icon: React.ReactNode } {
  switch (type) {
    case 'EVIDENCE':
      return {
        bg: 'rgba(56, 189, 248, 0.12)',
        color: '#38BDF8',
        border: 'rgba(56, 189, 248, 0.28)',
        icon: <FileText size={10} />,
      };
    case 'FINDING':
      return {
        bg: 'rgba(245, 197, 66, 0.12)',
        color: '#F5C542',
        border: 'rgba(245, 197, 66, 0.28)',
        icon: <AlertTriangle size={10} />,
      };
    case 'RISK':
      return {
        bg: 'rgba(239, 68, 68, 0.14)',
        color: '#F87171',
        border: 'rgba(239, 68, 68, 0.28)',
        icon: <ShieldAlert size={10} />,
      };
    case 'IMPACT':
      return {
        bg: 'rgba(192, 132, 252, 0.14)',
        color: '#C084FC',
        border: 'rgba(192, 132, 252, 0.28)',
        icon: <Clock size={10} />,
      };
    case 'ACTION':
      return {
        bg: 'rgba(74, 222, 128, 0.14)',
        color: '#4ADE80',
        border: 'rgba(74, 222, 128, 0.28)',
        icon: <Wrench size={10} />,
      };
    default:
      return {
        bg: 'var(--color-surface-container-high)',
        color: 'var(--color-text-secondary)',
        border: 'var(--color-surface-border-default)',
        icon: <CheckCircle2 size={10} />,
      };
  }
}

function filterNodes(data: EvidenceGraphResponse, mode: FilterMode): GraphNode[] {
  if (mode === 'ALL') return data.nodes;
  if (mode === 'CRITICAL_PATH_ONLY') {
    const critEdges = data.connections.filter(e => e.isCriticalPath);
    const critNodeIds = new Set(critEdges.flatMap(e => [e.sourceNodeId, e.targetNodeId]));
    return data.nodes.filter(n => critNodeIds.has(n.id));
  }
  if (mode === 'SOURCE_EVIDENCE') return data.nodes.filter(n => n.tier <= 2);
  if (mode === 'MITIGATIONS') return data.nodes.filter(n => n.tier >= 4);
  return data.nodes;
}

function isConnectedToSelected(
  nodeId: string,
  selectedId: string,
  connections: EvidenceGraphResponse['connections']
): boolean {
  if (!selectedId || nodeId === selectedId) return true;
  return connections.some(
    e =>
      (e.sourceNodeId === selectedId && e.targetNodeId === nodeId) ||
      (e.targetNodeId === selectedId && e.sourceNodeId === nodeId)
  );
}
