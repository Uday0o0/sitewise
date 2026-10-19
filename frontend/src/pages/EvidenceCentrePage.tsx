import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { DataProvenanceBadge } from '../components/DataProvenanceBadge';
import {
  FileText,
  Search,
  Filter,
  Download,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Layers,
  Clock,
  ArrowRight,
  Database,
  Radio,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Upload,
  Trash2,
  X,
  FileCheck,
  BookOpen,
  Info,
  ChevronRight,
  FolderOpen,
  Bot,
  Eye,
} from 'lucide-react';
import type { EvidenceIngestItem, DocumentListItem, DocumentMetadata, ProjectListItem, SearchPassageResult } from '../types/api';

interface ExtendedEvidenceItem extends EvidenceIngestItem {
  chainage: string;
  fileSize: string;
  sha256Hash: string;
  sourceDevice: string;
  certifiedBy?: string;
  description: string;
}

const STATIC_EVIDENCE_ITEMS: ExtendedEvidenceItem[] = [
  {
    assetId: 'EV-2024-8841',
    title: 'DJI-RTK-0841_Pier18_Downstream_Orthophoto.tif',
    dataType: 'GEOTIFF',
    ingestTimeAgo: '14m ago',
    provenanceStatus: 'SOURCE_VERIFIED',
    linkedFindingId: 'FND-104',
    chainage: 'Ch. 14+320',
    fileSize: '142.8 MB',
    sha256Hash: '9a8e4f1c7d2b3e8a5f0c1d2e3b4a5f6c7d8e9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    sourceDevice: 'DJI Matrice 300 RTK (45mm F2.8)',
    certifiedBy: 'Surveyor R. Sharma (RTK-ID: 882)',
    description: 'Calibrated photogrammetric orthomosaic capturing Pier 18 downstream cantilever crack cluster.',
  },
  {
    assetId: 'EV-2024-8839',
    title: 'Span18-19_Precast_Girder_CastLog_B24.pdf',
    dataType: 'PDF_CERT',
    ingestTimeAgo: '2h ago',
    provenanceStatus: 'SOURCE_VERIFIED',
    chainage: 'Ch. 14+380',
    fileSize: '4.2 MB',
    sha256Hash: '3c7d1e9f0a2b4c6e8d0f1a3b5c7e9f0a2b4c6e8d0f1a3b5c7e9f0a2b4c6e8d0f',
    sourceDevice: 'Batching Plant SCADA Dispatch (RMC-04)',
    certifiedBy: 'QA Inspector V. Patil',
    description: 'Batch ticket and cylinder compression test records for M-50 grade precast girder segment #B24.',
  },
  {
    assetId: 'EV-2024-8835',
    title: 'UPV_Sonic_Tomography_Scan_Pier18.json',
    dataType: 'JSON_LOG',
    ingestTimeAgo: '4h ago',
    provenanceStatus: 'QA_HOLD',
    linkedFindingId: 'FND-104',
    chainage: 'Ch. 14+320',
    fileSize: '890 KB',
    sha256Hash: '7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
    sourceDevice: 'Proceq Pundit PL-200 Sonic Array',
    certifiedBy: 'NDT Tech K. Menon (Awaiting Disposition)',
    description: 'Raw velocity array across 24 transceivers. Velocity dip detected at 35mm depth (3,420 m/s).',
  },
  {
    assetId: 'EV-2024-8828',
    title: 'Gantry_Load_Telemetry_Span17-18.csv',
    dataType: 'CSV_TELEMETRY',
    ingestTimeAgo: '6h ago',
    provenanceStatus: 'CALCULATED',
    chainage: 'Ch. 14+290',
    fileSize: '18.4 MB',
    sha256Hash: '1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
    sourceDevice: 'Launching Gantry LG-160 PLC Ingest',
    certifiedBy: 'System Ingest Pipeline',
    description: 'Continuous hydraulic pressure logs during segment erection cycle. Idling flag recorded at 11:42 IST.',
  },
  {
    assetId: 'EV-2024-8812',
    title: 'Mill_Test_Cert_Fe550D_TMT_Heat8492.pdf',
    dataType: 'PDF_CERT',
    ingestTimeAgo: '1d ago',
    provenanceStatus: 'SOURCE_VERIFIED',
    chainage: 'Yard Ch. 0+150',
    fileSize: '2.8 MB',
    sha256Hash: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6',
    sourceDevice: 'Tata Steel Mill Laboratory',
    certifiedBy: 'Metallurgical Lab Lead A. Rao',
    description: 'Certified material test report for 32mm Fe550D high-ductility rebar consignment.',
  },
];

export function EvidenceCentrePage() {
  const navigate = useNavigate();

  // Active top-level tab
  const [activeTab, setActiveTab] = useState<'DOCUMENTS' | 'SYNTHETIC'>('DOCUMENTS');

  // Project selection
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('PRJ-NH48-PKG3');

  // Real Uploaded Documents State
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentMetadata | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // In-document passage search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchPassageResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Synthetic Ledger State
  const [staticSearchQuery, setStaticSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedStaticItem, setSelectedStaticItem] = useState<ExtendedEvidenceItem | null>(STATIC_EVIDENCE_ITEMS[0]);
  const [isCopied, setIsCopied] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    api.listProjects()
      .then(prjs => {
        setProjects(prjs);
        if (prjs.length > 0 && !prjs.some(p => p.id === selectedProjectId)) {
          setSelectedProjectId(prjs[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch real documents whenever selectedProjectId changes
  const loadDocuments = async () => {
    if (!selectedProjectId) return;
    setIsLoadingDocs(true);
    try {
      const docs = await api.listDocuments(selectedProjectId);
      setDocuments(docs);
      if (docs.length > 0 && !selectedDoc) {
        // Fetch metadata for first document
        const meta = await api.getDocument(selectedProjectId, docs[0].documentId);
        setSelectedDoc(meta);
      } else if (docs.length === 0) {
        setSelectedDoc(null);
      }
    } catch (e) {
      console.error('Failed to load documents:', e);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [selectedProjectId]);

  const handleSelectDoc = async (docId: string) => {
    try {
      const meta = await api.getDocument(selectedProjectId, docId);
      setSelectedDoc(meta);
    } catch (e) {
      console.error('Failed to fetch doc metadata:', e);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a document file (.pdf, .txt, .md, .csv).');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadTitle.trim()) {
      formData.append('title', uploadTitle.trim());
    }

    try {
      const uploaded = await api.uploadDocument(selectedProjectId, formData);
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      await loadDocuments();
      await handleSelectDoc(uploaded.documentId);
    } catch (err: any) {
      setUploadError(err.message || 'Document upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReprocess = async (docId: string) => {
    try {
      const updated = await api.reprocessDocument(selectedProjectId, docId);
      setSelectedDoc(updated);
      await loadDocuments();
    } catch (err: any) {
      alert(`Reprocessing failed: ${err.message}`);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document and remove its indexed passages?')) return;
    try {
      await api.deleteDocument(selectedProjectId, docId);
      if (selectedDoc?.documentId === docId) {
        setSelectedDoc(null);
      }
      await loadDocuments();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSearchPassages = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await api.searchDocuments(selectedProjectId, searchQuery, 6);
      setSearchResults(res.passages);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredDocs = documents.filter(doc =>
    doc.title.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
    doc.originalFilename.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
    doc.documentId.toLowerCase().includes(docSearchQuery.toLowerCase())
  );

  const filteredStaticItems = STATIC_EVIDENCE_ITEMS.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(staticSearchQuery.toLowerCase()) ||
      item.assetId.toLowerCase().includes(staticSearchQuery.toLowerCase()) ||
      item.chainage.toLowerCase().includes(staticSearchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(staticSearchQuery.toLowerCase());
    const matchesType = selectedType === 'ALL' || item.dataType === selectedType;
    const matchesStatus = selectedStatus === 'ALL' || item.provenanceStatus === selectedStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setIsCopied(hash);
    setTimeout(() => setIsCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Context Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-border-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Evidence Centre & Document Intelligence
            </h1>
            <DataProvenanceBadge
              type={activeTab === 'DOCUMENTS' ? 'SOURCE_VERIFIED' : 'DEMO_SYNTHETIC'}
              label={activeTab === 'DOCUMENTS' ? 'REAL DOCUMENT PIPELINE' : 'SYNTHETIC DEMO ASSETS'}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {activeTab === 'DOCUMENTS'
              ? 'Multi-format construction document repository with automatic text extraction, page parsing, and TF-IDF passage indexing.'
              : 'Cryptographically signed multi-modal telemetry repository, photogrammetry logs, and material mill test certificates (Milestone 1).'}
          </p>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="flex items-center gap-3">
          <div
            className="flex p-1 rounded-lg border"
            style={{
              background: 'var(--color-surface-container-low)',
              borderColor: 'var(--color-surface-border-subtle)',
            }}
          >
            <button
              onClick={() => setActiveTab('DOCUMENTS')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
              style={{
                background: activeTab === 'DOCUMENTS' ? 'var(--color-brand-yellow)' : 'transparent',
                color: activeTab === 'DOCUMENTS' ? '#000' : 'var(--color-text-secondary)',
              }}
            >
              <BookOpen size={14} />
              <span>Project Documents</span>
              <span
                className="px-1.5 py-0.2 rounded-full text-[10px] font-mono"
                style={{
                  background: activeTab === 'DOCUMENTS' ? 'rgba(0,0,0,0.15)' : 'var(--color-surface-container-high)',
                }}
              >
                {documents.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('SYNTHETIC')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
              style={{
                background: activeTab === 'SYNTHETIC' ? 'var(--color-brand-yellow)' : 'transparent',
                color: activeTab === 'SYNTHETIC' ? '#000' : 'var(--color-text-secondary)',
              }}
            >
              <Database size={14} />
              <span>Synthetic Evidence Ledger</span>
            </button>
          </div>

          {activeTab === 'DOCUMENTS' && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-all shadow-sm cursor-pointer"
              style={{
                background: 'var(--color-brand-yellow)',
                color: '#000',
              }}
            >
              <Upload size={14} />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: REAL PROJECT DOCUMENTS & INTELLIGENCE PIPELINE
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'DOCUMENTS' && (
        <div className="space-y-5">
          {/* Controls Bar: Project Selector, Search, Filter */}
          <div
            className="p-3.5 rounded-lg flex flex-col md:flex-row gap-3 items-center justify-between"
            style={{
              background: 'var(--color-surface-container-low)',
              border: '1px solid var(--color-surface-border-subtle)',
            }}
          >
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <FolderOpen size={15} style={{ color: 'var(--color-brand-yellow)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Project:
                </span>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="px-2.5 py-1 rounded text-xs font-mono font-semibold outline-none"
                  style={{
                    background: 'var(--color-surface-container-high)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-surface-border-default)',
                  }}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.id} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <span className="w-px h-4 hidden md:block" style={{ background: 'var(--color-surface-border-subtle)' }} />

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md w-full sm:w-64" style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border-default)' }}>
                <Search size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                <input
                  type="text"
                  placeholder="Filter uploaded documents..."
                  value={docSearchQuery}
                  onChange={e => setDocSearchQuery(e.target.value)}
                  className="bg-transparent text-xs w-full outline-none"
                  style={{ color: 'var(--color-text-primary)' }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              <span>Supported:</span>
              <span className="font-mono text-gray-300">.pdf, .txt, .md, .csv</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-container-high)' }}>
                Max 25MB
              </span>
            </div>
          </div>

          {/* Main Grid: Document List + Inspector Drawer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Document Table */}
            <div className={selectedDoc ? 'lg:col-span-8 space-y-3' : 'lg:col-span-12 space-y-3'}>
              <div
                className="rounded-lg overflow-hidden"
                style={{
                  background: 'var(--color-surface-container-low)',
                  border: '1px solid var(--color-surface-border-subtle)',
                }}
              >
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr
                      className="uppercase tracking-wider font-semibold border-b"
                      style={{
                        background: 'var(--color-surface-container-med)',
                        borderColor: 'var(--color-surface-border-subtle)',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      <th className="px-4 py-3">Document Title</th>
                      <th className="px-3 py-3">Format</th>
                      <th className="px-3 py-3">Indexed Words</th>
                      <th className="px-3 py-3">Uploaded</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border-subtle font-mono">
                    {filteredDocs.map(doc => {
                      const isSelected = selectedDoc?.documentId === doc.documentId;
                      return (
                        <tr
                          key={doc.documentId}
                          onClick={() => handleSelectDoc(doc.documentId)}
                          className="cursor-pointer transition-colors"
                          style={{
                            background: isSelected ? 'rgba(245, 197, 66, 0.08)' : 'transparent',
                          }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <FileText
                                size={16}
                                style={{
                                  color: doc.processingStatus === 'READY'
                                    ? '#4ADE80'
                                    : doc.processingStatus === 'REQUIRES_OCR'
                                    ? '#FBBF24'
                                    : '#9CA3AF'
                                }}
                              />
                              <div>
                                <p className="font-semibold text-gray-200">{doc.title}</p>
                                <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                                  {doc.documentId} • {doc.originalFilename} • {(doc.fileSizeBytes / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-brand-yellow)' }}>
                              {doc.fileType.replace('.', '')}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-300">
                            {doc.wordCount > 0 ? doc.wordCount.toLocaleString() : '—'}
                          </td>
                          <td className="px-3 py-3 text-gray-400">
                            {new Date(doc.uploadedAt).toLocaleDateString()} {new Date(doc.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-3">
                            <DocumentStatusBadge status={doc.processingStatus} requiresOcr={doc.requiresOcr} />
                          </td>
                          <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={api.getDocumentFileUrl(selectedProjectId, doc.documentId)}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded text-gray-400 hover:text-gray-100 transition-colors"
                                title="Open / Download Source File"
                              >
                                <Download size={14} />
                              </a>
                              <button
                                onClick={() => handleReprocess(doc.documentId)}
                                className="p-1 rounded text-gray-400 hover:text-amber-300 transition-colors"
                                title="Reprocess Document"
                              >
                                <RefreshCw size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteDoc(doc.documentId)}
                                className="p-1 rounded text-gray-400 hover:text-rose-400 transition-colors"
                                title="Delete Document"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredDocs.length === 0 && (
                  <div className="p-12 text-center space-y-3">
                    <FileText size={32} className="mx-auto text-gray-600" />
                    <p className="text-xs text-gray-400">
                      {isLoadingDocs
                        ? 'Loading project documents...'
                        : 'No documents uploaded for this project yet.'}
                    </p>
                    <button
                      onClick={() => setIsUploadModalOpen(true)}
                      className="px-3 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1.5"
                      style={{
                        background: 'var(--color-brand-yellow)',
                        color: '#000',
                      }}
                    >
                      <Upload size={13} />
                      <span>Upload First Document</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Passage Quick Search Bar */}
              <div
                className="p-4 rounded-lg space-y-3"
                style={{
                  background: 'var(--color-surface-container-low)',
                  border: '1px solid var(--color-surface-border-subtle)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search size={14} style={{ color: 'var(--color-brand-yellow)' }} />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-200">
                      Lexical Passage Retrieval Search
                    </h3>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    TF-IDF Cosine Matcher (Local)
                  </span>
                </div>

                <form onSubmit={handleSearchPassages} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search engineering clauses, crack aperture criteria, IRC specifications, segment IDs..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 rounded text-xs outline-none"
                    style={{
                      background: 'var(--color-surface-container-med)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-surface-border-default)',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-4 py-2 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    style={{
                      background: 'var(--color-brand-yellow)',
                      color: '#000',
                    }}
                  >
                    {isSearching ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
                    <span>Search</span>
                  </button>
                </form>

                {searchResults.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-surface-border-subtle">
                    <p className="text-[11px] font-mono text-gray-400">
                      Found {searchResults.length} matching passages in project documents:
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {searchResults.map((p, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded text-xs space-y-1 font-mono"
                          style={{
                            background: 'var(--color-surface-container-med)',
                            border: '1px solid var(--color-surface-border-subtle)',
                          }}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-amber-400">
                              {p.documentTitle} {p.pageNumber ? `(Page ${p.pageNumber})` : ''}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-800 text-gray-300">
                              Score: {p.score} • {p.wordCount} words
                            </span>
                          </div>
                          <p className="text-gray-300 text-[11px] font-sans leading-relaxed whitespace-pre-wrap">
                            {p.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Document Metadata Inspector Panel */}
            {selectedDoc && (
              <div
                className="lg:col-span-4 rounded-lg p-4 space-y-4 self-start"
                style={{
                  background: 'var(--color-surface-container-low)',
                  border: '1px solid var(--color-surface-border-subtle)',
                }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-surface-border-subtle">
                  <div className="flex items-center gap-2">
                    <FileCheck size={16} style={{ color: 'var(--color-brand-yellow)' }} />
                    <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                      Document Metadata
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="p-1 rounded text-gray-400 hover:text-gray-200"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Scanned PDF Alert Banner */}
                {selectedDoc.requiresOcr && (
                  <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle size={14} />
                      <span>OCR Required for Scanned PDF</span>
                    </div>
                    <p className="text-[11px] text-amber-200/80 leading-normal">
                      This document contains scanned image pages without embedded digital text. Please configure an OCR service to extract text.
                    </p>
                  </div>
                )}

                {/* Processing Error Banner */}
                {selectedDoc.processingError && !selectedDoc.requiresOcr && (
                  <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle size={14} />
                      <span>Processing Error</span>
                    </div>
                    <p className="text-[11px] text-rose-200/80 font-mono">
                      {selectedDoc.processingError}
                    </p>
                  </div>
                )}

                <div className="space-y-3 text-xs font-mono">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Document Title</label>
                    <p className="text-gray-100 font-semibold">{selectedDoc.title}</p>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Document Identifier</label>
                    <p className="text-amber-400">{selectedDoc.documentId}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Format</label>
                      <p className="text-gray-200">{selectedDoc.fileType} ({selectedDoc.mimeType})</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">File Size</label>
                      <p className="text-gray-200">{(selectedDoc.fileSizeBytes / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Indexed Words</label>
                      <p className="text-emerald-400 font-bold">{selectedDoc.wordCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Pages</label>
                      <p className="text-gray-200">{selectedDoc.pageCount || 1}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Extractor</label>
                      <p className="text-gray-400">v{selectedDoc.extractorVersion}</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Indexer</label>
                      <p className="text-gray-400">v{selectedDoc.indexingVersion}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block">SHA-256 Digest</label>
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-black/40 border border-neutral-800">
                      <span className="text-[10px] text-gray-300 truncate">{selectedDoc.sha256}</span>
                      <button
                        onClick={() => handleCopyHash(selectedDoc.sha256)}
                        className="text-[10px] text-amber-400 hover:underline shrink-0"
                      >
                        {isCopied === selectedDoc.sha256 ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-surface-border-subtle flex flex-col gap-2">
                  <a
                    href={api.getDocumentFileUrl(selectedProjectId, selectedDoc.documentId)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                    style={{
                      background: 'rgba(245, 197, 66, 0.15)',
                      color: 'var(--color-brand-yellow)',
                      border: '1px solid rgba(245, 197, 66, 0.3)',
                    }}
                  >
                    <ExternalLink size={13} />
                    <span>Open Original Document File</span>
                  </a>

                  <button
                    onClick={() => navigate(`/assistant?projectId=${selectedProjectId}&docId=${selectedDoc.documentId}&prompt=${encodeURIComponent(`Summarize the key engineering criteria and specifications in ${selectedDoc.title}.`)}`)}
                    className="w-full py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    style={{
                      background: 'var(--color-surface-container-high)',
                      color: '#38BDF8',
                      border: '1px solid rgba(56,189,248,0.35)',
                    }}
                  >
                    <Bot size={13} />
                    <span>Query in Site Assistant</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReprocess(selectedDoc.documentId)}
                      className="flex-1 py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 bg-neutral-800 text-gray-200 hover:bg-neutral-700 transition-colors"
                    >
                      <RefreshCw size={12} />
                      <span>Reprocess</span>
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(selectedDoc.documentId)}
                      className="py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SYNTHETIC EVIDENCE LEDGER (MILESTONE 1 DEMO)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'SYNTHETIC' && (
        <div className="space-y-6">
          {/* Pipeline Status HUD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <PipelineCard
              icon={<Cpu size={16} />}
              label="UAV Orthophoto Feed"
              source="DJI M300 RTK / Flighthub"
              status="ONLINE"
              metrics="0.8mm/px GSD • 14m ago"
              statusColor="#4ADE80"
            />
            <PipelineCard
              icon={<Layers size={16} />}
              label="Batch Plant SCADA"
              source="Command Alkon (RMC-04)"
              status="SIMULATED"
              metrics="M-50 Cast Logs • 2h ago"
              statusColor="#FBBF24"
            />
            <PipelineCard
              icon={<Radio size={16} />}
              label="Borehole Telemetry"
              source="Encardio-Rite Modbus"
              status="UNCONFIGURED"
              metrics="No Gateway Linked"
              statusColor="#9CA3AF"
            />
            <PipelineCard
              icon={<ShieldCheck size={16} />}
              label="PKI Audit Hash Registry"
              source="SHA-256 Ledger Node"
              status="VERIFIED"
              metrics="100% Immutability Pass"
              statusColor="#4ADE80"
            />
          </div>

          {/* Filter and Search Bar */}
          <div
            className="p-3 rounded-lg flex flex-col md:flex-row gap-3 items-center justify-between"
            style={{
              background: 'var(--color-surface-container-low)',
              border: '1px solid var(--color-surface-border-subtle)',
            }}
          >
            <div className="flex items-center gap-2 w-full md:w-80 px-3 py-1.5 rounded-md" style={{ background: 'var(--color-surface-container-med)', border: '1px solid var(--color-surface-border-default)' }}>
              <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search by ID, title, chainage, hash..."
                value={staticSearchQuery}
                onChange={e => setStaticSearchQuery(e.target.value)}
                className="bg-transparent text-xs w-full outline-none"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                <Filter size={13} />
                <span>Format:</span>
              </div>
              {['ALL', 'GEOTIFF', 'PDF_CERT', 'JSON_LOG', 'CSV_TELEMETRY'].map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className="px-2 py-1 rounded text-xs font-mono transition-colors"
                  style={{
                    background: selectedType === type ? 'var(--color-surface-container-high)' : 'transparent',
                    color: selectedType === type ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
                    border: `1px solid ${selectedType === type ? 'var(--color-brand-yellow)' : 'var(--color-surface-border-subtle)'}`,
                  }}
                >
                  {type}
                </button>
              ))}

              <span className="w-px h-4 mx-1" style={{ background: 'var(--color-surface-border-subtle)' }} />

              {['ALL', 'SOURCE_VERIFIED', 'QA_HOLD', 'CALCULATED'].map(status => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className="px-2 py-1 rounded text-xs font-mono transition-colors"
                  style={{
                    background: selectedStatus === status ? 'var(--color-surface-container-high)' : 'transparent',
                    color: selectedStatus === status ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
                    border: `1px solid ${selectedStatus === status ? 'var(--color-brand-yellow)' : 'var(--color-surface-border-subtle)'}`,
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Evidence Assets Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className={`space-y-3 ${selectedStaticItem ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
              <div
                className="rounded-lg overflow-hidden"
                style={{
                  background: 'var(--color-surface-container-low)',
                  border: '1px solid var(--color-surface-border-subtle)',
                }}
              >
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr
                      className="uppercase tracking-wider font-semibold border-b"
                      style={{
                        background: 'var(--color-surface-container-med)',
                        borderColor: 'var(--color-surface-border-subtle)',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      <th className="px-4 py-3">Asset & Title</th>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3">Chainage</th>
                      <th className="px-3 py-3">Ingested</th>
                      <th className="px-3 py-3">Provenance</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border-subtle font-mono">
                    {filteredStaticItems.map(item => {
                      const isSelected = selectedStaticItem?.assetId === item.assetId;
                      return (
                        <tr
                          key={item.assetId}
                          onClick={() => setSelectedStaticItem(item)}
                          className="cursor-pointer transition-colors"
                          style={{
                            background: isSelected ? 'rgba(245, 197, 66, 0.08)' : 'transparent',
                          }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileTypeIcon type={item.dataType} />
                              <div>
                                <p className="font-semibold text-gray-200">{item.title}</p>
                                <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{item.assetId} • {item.fileSize}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-text-secondary)' }}>
                              {item.dataType}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-300">{item.chainage}</td>
                          <td className="px-3 py-3 text-gray-400">{item.ingestTimeAgo}</td>
                          <td className="px-3 py-3">
                            <ProvenanceBadge status={item.provenanceStatus} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              {item.linkedFindingId && (
                                <button
                                  onClick={() => navigate(`/inspections/${item.linkedFindingId}`)}
                                  className="px-2 py-1 rounded text-[10px] font-sans font-semibold flex items-center gap-1 transition-colors"
                                  style={{
                                    background: 'rgba(245, 197, 66, 0.15)',
                                    color: 'var(--color-brand-yellow)',
                                    border: '1px solid rgba(245, 197, 66, 0.3)',
                                  }}
                                  title={`Inspect ${item.linkedFindingId}`}
                                >
                                  <span>{item.linkedFindingId}</span>
                                  <ArrowRight size={10} />
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedStaticItem(item)}
                                className="p-1 rounded text-gray-400 hover:text-gray-200"
                                title="Inspect Details"
                              >
                                <ExternalLink size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Static Item Details */}
            {selectedStaticItem && (
              <div
                className="lg:col-span-4 rounded-lg p-4 space-y-4 self-start"
                style={{
                  background: 'var(--color-surface-container-low)',
                  border: '1px solid var(--color-surface-border-subtle)',
                }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-surface-border-subtle">
                  <div className="flex items-center gap-2">
                    <FileTypeIcon type={selectedStaticItem.dataType} />
                    <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                      Asset Metadata
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    SYNTHETIC DEMO
                  </span>
                </div>

                <div className="space-y-3 text-xs font-mono">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Title</label>
                    <p className="text-gray-100 font-semibold">{selectedStaticItem.title}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Asset ID</label>
                    <p className="text-amber-400">{selectedStaticItem.assetId}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Description</label>
                    <p className="text-gray-300 font-sans leading-relaxed">{selectedStaticItem.description}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Device / Sensor</label>
                    <p className="text-gray-200">{selectedStaticItem.sourceDevice}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block">SHA-256 Digest</label>
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-black/40 border border-neutral-800">
                      <span className="text-[10px] text-gray-300 truncate">{selectedStaticItem.sha256Hash}</span>
                      <button
                        onClick={() => handleCopyHash(selectedStaticItem.sha256Hash)}
                        className="text-[10px] text-amber-400 hover:underline shrink-0"
                      >
                        {isCopied === selectedStaticItem.sha256Hash ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {selectedStaticItem.linkedFindingId && (
                    <div className="pt-2 border-t border-surface-border-subtle space-y-2">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Linked Inspection Finding</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/inspections/${selectedStaticItem.linkedFindingId}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-semibold cursor-pointer transition-colors"
                          style={{
                            background: 'var(--color-brand-yellow)',
                            color: '#000',
                          }}
                        >
                          <Eye size={13} />
                          <span>Inspect {selectedStaticItem.linkedFindingId}</span>
                        </button>
                        <button
                          onClick={() => navigate(`/evidence-graph?findingId=${selectedStaticItem.linkedFindingId}&nodeId=N-AI-001`)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-semibold cursor-pointer transition-colors"
                          style={{
                            background: 'var(--color-surface-container-high)',
                            color: '#38BDF8',
                            border: '1px solid rgba(56,189,248,0.3)',
                          }}
                        >
                          <Layers size={13} />
                          <span>Evidence Graph</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          UPLOAD DOCUMENT MODAL
          ───────────────────────────────────────────────────────────── */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div
            className="w-full max-w-lg rounded-xl p-6 space-y-5 shadow-2xl"
            style={{
              background: 'var(--color-surface-container-high)',
              border: '1px solid var(--color-surface-border-default)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-surface-border-subtle">
              <div className="flex items-center gap-2">
                <Upload size={18} style={{ color: 'var(--color-brand-yellow)' }} />
                <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  Upload Construction Document
                </h2>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-200"
              >
                <X size={16} />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. IRC:112 Limit State Guidelines or Pier 18 Pour Log"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded text-xs outline-none"
                  style={{
                    background: 'var(--color-surface-container-med)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-surface-border-default)',
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Select File (.pdf, .txt, .md, .csv)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
                  style={{
                    borderColor: uploadFile ? 'var(--color-brand-yellow)' : 'var(--color-surface-border-default)',
                    background: 'var(--color-surface-container-med)',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.csv,text/plain,text/markdown,text/csv,application/pdf"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0]);
                        setUploadError(null);
                      }
                    }}
                  />
                  {uploadFile ? (
                    <div className="space-y-1">
                      <FileCheck size={28} className="mx-auto text-emerald-400" />
                      <p className="text-xs font-semibold text-gray-200">{uploadFile.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        {(uploadFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload size={24} className="mx-auto text-amber-400" />
                      <p className="text-xs text-gray-300">
                        Click to select document or drag & drop here
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono">
                        Supported: PDF, TXT, Markdown, CSV (up to 25 MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Info size={13} />
                  <span>Document Intelligence Pipeline</span>
                </div>
                <p className="text-gray-400 leading-normal">
                  Text is extracted with page preservation, chunked into passages, and indexed using local TF-IDF cosine ranking. Scanned PDFs without text layers will be flagged as requiring OCR.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded text-xs font-semibold text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="px-5 py-2 rounded text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{
                    background: 'var(--color-brand-yellow)',
                    color: '#000',
                  }}
                >
                  {isUploading ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Extracting & Indexing...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={13} />
                      <span>Upload & Index</span>
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

// ─────────────────────────────────────────────────────────────
// Subcomponents & Helpers
// ─────────────────────────────────────────────────────────────

function DocumentStatusBadge({ status, requiresOcr }: { status: string; requiresOcr?: boolean }) {
  if (requiresOcr || status === 'REQUIRES_OCR') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <AlertTriangle size={10} />
        REQUIRES OCR
      </span>
    );
  }

  switch (status) {
    case 'READY':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 size={10} />
          INDEXED
        </span>
      );
    case 'PROCESSING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">
          <RefreshCw size={10} className="animate-spin" />
          INDEXING
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <AlertTriangle size={10} />
          FAILED
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-gray-400">
          {status}
        </span>
      );
  }
}

function PipelineCard({
  icon,
  label,
  source,
  status,
  metrics,
  statusColor,
}: {
  icon: React.ReactNode;
  label: string;
  source: string;
  status: string;
  metrics: string;
  statusColor: string;
}) {
  return (
    <div
      className="p-3.5 rounded-lg flex flex-col justify-between"
      style={{
        background: 'var(--color-surface-container-low)',
        border: '1px solid var(--color-surface-border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          {icon}
          <span className="text-xs font-semibold">{label}</span>
        </div>
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider"
          style={{
            background: `${statusColor}18`,
            color: statusColor,
            border: `1px solid ${statusColor}40`,
          }}
        >
          {status}
        </span>
      </div>
      <div>
        <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
          {source}
        </p>
        <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          {metrics}
        </p>
      </div>
    </div>
  );
}

function FileTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'GEOTIFF':
      return <Layers size={14} style={{ color: '#60A5FA' }} />;
    case 'PDF_CERT':
      return <FileText size={14} style={{ color: '#F87171' }} />;
    case 'JSON_LOG':
      return <FileCode size={14} style={{ color: '#FBBF24' }} />;
    case 'CSV_TELEMETRY':
      return <Database size={14} style={{ color: '#34D399' }} />;
    default:
      return <FileText size={14} style={{ color: 'var(--color-text-secondary)' }} />;
  }
}

function ProvenanceBadge({ status }: { status: string }) {
  switch (status) {
    case 'SOURCE_VERIFIED':
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
          style={{
            background: 'rgba(74, 222, 128, 0.1)',
            color: '#4ADE80',
            border: '1px solid rgba(74, 222, 128, 0.3)',
          }}
        >
          <CheckCircle2 size={9} />
          VERIFIED
        </span>
      );
    case 'QA_HOLD':
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
          style={{
            background: 'rgba(251, 191, 36, 0.1)',
            color: '#FBBF24',
            border: '1px solid rgba(251, 191, 36, 0.3)',
          }}
        >
          <AlertTriangle size={9} />
          QA HOLD
        </span>
      );
    case 'CALCULATED':
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
          style={{
            background: 'rgba(96, 165, 250, 0.1)',
            color: '#60A5FA',
            border: '1px solid rgba(96, 165, 250, 0.3)',
          }}
        >
          <Cpu size={9} />
          CALCULATED
        </span>
      );
    default:
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] text-gray-400 bg-neutral-800">
          {status}
        </span>
      );
  }
}
