import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { DataProvenanceBadge } from '../components/DataProvenanceBadge';
import {
  Send,
  Bot,
  User,
  Sparkles,
  BookOpen,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Code2,
  Copy,
  Check,
  RotateCcw,
  FolderOpen,
  FileText,
  Search,
  CheckCircle2,
  Info,
  Clock,
  RefreshCw,
  Cpu,
  FlaskConical,
  Layers,
  Eye,
} from 'lucide-react';
import type {
  ProjectListItem,
  DocumentListItem,
  CitationItem,
  AssistantStatusResponse,
  AssistantAnswer,
  SearchPassageResult,
} from '../types/api';

interface GroundedChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  content: string;
  citations?: CitationItem[];
  isGrounded?: boolean;
  insufficientEvidence?: boolean;
  provider?: string;
  model?: string;
  providerAvailable?: boolean;
  error?: string | null;
  retrievedPassages?: SearchPassageResult[];
}

const SUGGESTED_INQUIRIES = [
  {
    label: 'IRC:112 Pier 18 Compliance',
    prompt: 'Evaluate Pier 18 cantilever crack aperture (0.35mm) against IRC:112 Clause 12.3 crack width criteria.',
  },
  {
    label: 'Liquidated Damages at 14 Days',
    prompt: 'Calculate contractual liquidated damages and gantry idling exposure if Span 18-19 slip reaches 14 days.',
  },
  {
    label: 'CFRP Retrofit Feasibility',
    prompt: 'Compare CFRP pressure injection retrofit vs full pier cap recast under IRC:SP:40 guidelines.',
  },
  {
    label: 'Draft NCR-084 Notice',
    prompt: 'Draft an engineering Non-Conformance Report (NCR-084) to Contractor HCC-NCC JV for Pier 18.',
  },
];

import { DailySiteBriefingCard } from '../components/DailySiteBriefingCard';
import { CalendarDays, MessageSquare } from 'lucide-react';

export function SiteAssistantPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlPrompt = searchParams.get('prompt');
  const urlProjectId = searchParams.get('projectId');
  const urlDocId = searchParams.get('docId');

  // Primary Tab: Chatbot vs Daily Morning Briefing
  const [primaryTab, setPrimaryTab] = useState<'CHAT' | 'BRIEFING'>('CHAT');

  // Project & Document Scope
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(urlProjectId || 'PRJ-NH48-PKG3');
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [selectedDocScope, setSelectedDocScope] = useState<string>(urlDocId || 'ALL');

  // Provider Status
  const [providerStatus, setProviderStatus] = useState<AssistantStatusResponse | null>(null);

  // Chat conversation
  const [messages, setMessages] = useState<GroundedChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: `**SITEWISE Grounded Document Intelligence Assistant online.**

I answer questions strictly grounded in your project's uploaded documents (.pdf, .txt, .md, .csv). Every statement is backed by verifiable citations to source passages.

Upload construction documents in the **Evidence Centre** or select a document scope below to begin.`,
      isGrounded: true,
      provider: 'document-rag',
      providerAvailable: true,
    },
  ]);

  const [inputValue, setInputValue] = useState(urlPrompt || '');
  const [isQuerying, setIsQuerying] = useState(false);
  const [expandedPassagesId, setExpandedPassagesId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isQuerying]);

  // Synchronize urlPrompt if query parameter changes
  useEffect(() => {
    if (urlPrompt && !inputValue) {
      setInputValue(urlPrompt);
    }
  }, [urlPrompt]);

  // Load projects and provider status on mount
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

  // Refresh documents and provider status when project changes
  useEffect(() => {
    if (!selectedProjectId) return;

    api.listDocuments(selectedProjectId)
      .then(docs => setDocuments(docs))
      .catch(() => setDocuments([]));

    api.getAssistantStatus(selectedProjectId)
      .then(status => setProviderStatus(status))
      .catch(() => setProviderStatus(null));
  }, [selectedProjectId]);

  const handleSend = async (customPrompt?: string) => {
    const question = (customPrompt || inputValue).trim();
    if (!question || isQuerying) return;

    const userMsg: GroundedChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: question,
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInputValue('');
    setIsQuerying(true);

    try {
      const docId = selectedDocScope === 'ALL' ? undefined : selectedDocScope;
      const answerResp = await api.queryAssistant(selectedProjectId, question, docId);

      const botMsg: GroundedChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: answerResp.answer,
        citations: answerResp.citations,
        isGrounded: answerResp.isGrounded,
        insufficientEvidence: answerResp.insufficientEvidence,
        provider: answerResp.provider,
        model: answerResp.model,
        providerAvailable: answerResp.providerAvailable,
        error: answerResp.error,
        retrievedPassages: answerResp.retrievalInfo?.passages || [],
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: GroundedChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: `An error occurred while evaluating your question: ${err.message || 'Unknown network error'}.`,
        error: err.message,
        providerAvailable: false,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-surface-border-subtle shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Site Intelligence Assistant
            </h1>
            <DataProvenanceBadge
              type="SOURCE_VERIFIED"
              label={primaryTab === 'BRIEFING' ? 'DAILY BRIEFING ENGINE' : 'GROUNDED DOCUMENT RAG'}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {primaryTab === 'BRIEFING'
              ? 'Automated morning site supervisor briefing synthesizing active findings, CPM schedule slips, and meteorological rules.'
              : 'Answers engineering questions strictly grounded in uploaded project documents with verifiable source citations and page references.'}
          </p>
        </div>

        {/* Primary Tab Selector: Technical Chat vs Daily Briefing */}
        <div
          className="flex p-1 rounded-lg border shrink-0"
          style={{
            background: 'var(--color-surface-container-low)',
            borderColor: 'var(--color-surface-border-subtle)',
          }}
        >
          <button
            onClick={() => setPrimaryTab('CHAT')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: primaryTab === 'CHAT' ? 'var(--color-brand-yellow)' : 'transparent',
              color: primaryTab === 'CHAT' ? '#000' : 'var(--color-text-secondary)',
            }}
          >
            <MessageSquare size={13} />
            <span>Technical Q&A Assistant</span>
          </button>
          <button
            onClick={() => setPrimaryTab('BRIEFING')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: primaryTab === 'BRIEFING' ? 'var(--color-brand-yellow)' : 'transparent',
              color: primaryTab === 'BRIEFING' ? '#000' : 'var(--color-text-secondary)',
            }}
          >
            <CalendarDays size={13} />
            <span>Daily Site Briefing</span>
          </button>
        </div>
      </div>

      {primaryTab === 'BRIEFING' ? (
        <DailySiteBriefingCard projectId={selectedProjectId} />
      ) : (
        <>

      {/* Scope Controls Bar (Project, Document Scope, Provider Status) */}
      <div
        className="p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 shrink-0"
        style={{
          background: 'var(--color-surface-container-low)',
          border: '1px solid var(--color-surface-border-subtle)',
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Project Selector */}
          <div className="flex items-center gap-2">
            <FolderOpen size={14} style={{ color: 'var(--color-brand-yellow)' }} />
            <span className="text-xs font-semibold text-gray-300">Project:</span>
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

          <span className="w-px h-4 hidden sm:block" style={{ background: 'var(--color-surface-border-subtle)' }} />

          {/* Document Scope Filter */}
          <div className="flex items-center gap-2">
            <FileText size={14} style={{ color: 'var(--color-text-secondary)' }} />
            <span className="text-xs font-semibold text-gray-300">Scope:</span>
            <select
              value={selectedDocScope}
              onChange={e => setSelectedDocScope(e.target.value)}
              className="px-2.5 py-1 rounded text-xs font-mono outline-none max-w-xs truncate"
              style={{
                background: 'var(--color-surface-container-high)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-surface-border-default)',
              }}
            >
              <option value="ALL">All Project Documents ({documents.length} Available)</option>
              {documents.map(d => (
                <option key={d.documentId} value={d.documentId}>
                  {d.title} ({d.fileType})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* AI Provider Status Badge */}
        <div className="flex items-center gap-2">
          {providerStatus?.providerAvailable ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {providerStatus.provider.toUpperCase()} ({providerStatus.model}) • Live RAG Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <AlertTriangle size={12} />
              No Live AI Key ({providerStatus?.provider === 'groq' ? 'GROQ_API_KEY' : 'GEMINI_API_KEY'}) • Lexical Retrieval Active
            </span>
          )}
        </div>
      </div>

      {/* Warning Alert if AI key not configured */}
      {providerStatus && !providerStatus.providerAvailable && (
        <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Info size={15} className="shrink-0 text-amber-400" />
            <span>
              <strong>AI Provider Not Configured:</strong> Set <code>{providerStatus.provider === 'groq' ? 'GROQ_API_KEY' : 'GEMINI_API_KEY'}</code> environment variable to activate generative synthesis for <strong>{providerStatus.provider.toUpperCase()}</strong>. Document chunking, indexing, and lexical retrieval search remain fully operational.
            </span>
          </div>
          <button
            onClick={() => navigate('/evidence')}
            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 shrink-0 cursor-pointer"
          >
            Manage Documents
          </button>
        </div>
      )}

      {/* Chat Messages Log */}
      <div
        className="flex-1 overflow-y-auto p-4 rounded-lg space-y-4"
        style={{
          background: 'var(--color-surface-container-low)',
          border: '1px solid var(--color-surface-border-subtle)',
        }}
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-1 px-1">
              {msg.sender === 'assistant' ? (
                <>
                  <Bot size={13} style={{ color: 'var(--color-brand-yellow)' }} />
                  <span className="text-[11px] font-semibold text-gray-300">SITEWISE Grounded AI</span>
                </>
              ) : (
                <>
                  <User size={13} className="text-gray-400" />
                  <span className="text-[11px] font-semibold text-gray-400">Resident Engineer</span>
                </>
              )}
              <span className="text-[10px] text-gray-500 font-mono">{msg.timestamp}</span>
              {msg.isGrounded && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  SOURCE GROUNDED
                </span>
              )}
            </div>

            <div
              className={`max-w-2xl p-4 rounded-xl text-xs leading-relaxed space-y-3 ${
                msg.sender === 'user'
                  ? 'bg-amber-400/15 text-amber-100 border border-amber-400/30'
                  : 'bg-neutral-900/90 text-gray-200 border border-neutral-800 shadow-md'
              }`}
            >
              {/* Insufficient Evidence Warning Banner */}
              {msg.insufficientEvidence && (
                <div className="p-2.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>The uploaded documents do not contain sufficient evidence to answer this question.</span>
                </div>
              )}

              {/* Provider Error Banner */}
              {msg.error && (
                <div className="p-2.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{msg.error}</span>
                </div>
              )}

              {/* Message Content */}
              <div className="font-sans whitespace-pre-wrap leading-relaxed space-y-2">
                {msg.content}
              </div>

              {/* Citations Section */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="pt-3 border-t border-neutral-800 space-y-2 font-mono">
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                    <ShieldCheck size={12} />
                    <span>Verified Source Citations ({msg.citations.length})</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {msg.citations.map((cit, cIdx) => (
                      <div
                        key={cIdx}
                        className="p-2.5 rounded bg-black/50 border border-neutral-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-gray-200">
                            {cit.documentTitle} {cit.pageNumber ? `(Page ${cit.pageNumber})` : ''}
                          </span>
                          <a
                            href={cit.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 transition-colors"
                          >
                            <span>Open Source</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                        <p className="text-[11px] font-sans text-gray-400 leading-normal italic">
                          "{cit.excerpt}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contextual Workflow Action Chips when FND-104 or Pier 18 is referenced */}
              {msg.sender === 'assistant' && (msg.content.includes('FND-104') || msg.content.includes('Pier 18') || msg.content.includes('0.35')) && (
                <div className="pt-2.5 border-t border-neutral-800 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-gray-400 font-mono">Related Workflow:</span>
                  <button
                    onClick={() => navigate('/inspections/FND-104')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 transition-colors cursor-pointer"
                  >
                    <Eye size={10} />
                    <span>Inspect FND-104</span>
                  </button>
                  <button
                    onClick={() => navigate('/evidence-graph?findingId=FND-104&nodeId=N-AI-001')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 border border-sky-500/30 transition-colors cursor-pointer"
                  >
                    <Layers size={10} />
                    <span>Trace Risk Cascade</span>
                  </button>
                  <button
                    onClick={() => navigate('/simulator?findingId=FND-104&nodeId=N-AI-001')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors cursor-pointer"
                  >
                    <FlaskConical size={10} />
                    <span>What-If Simulator</span>
                  </button>
                </div>
              )}

              {/* Retrieved Passages Collapsible Toggle */}
              {msg.retrievedPassages && msg.retrievedPassages.length > 0 && (
                <div className="pt-2 border-t border-neutral-800 font-mono">
                  <button
                    onClick={() =>
                      setExpandedPassagesId(expandedPassagesId === msg.id ? null : msg.id)
                    }
                    className="text-[10px] text-gray-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                  >
                    <Search size={10} />
                    <span>
                      {expandedPassagesId === msg.id ? 'Hide' : 'Inspect'}{' '}
                      {msg.retrievedPassages.length} Retrieved Passages
                    </span>
                  </button>

                  {expandedPassagesId === msg.id && (
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                      {msg.retrievedPassages.map((rp, rIdx) => (
                        <div
                          key={rIdx}
                          className="p-2 rounded bg-black/40 border border-neutral-800 text-[10px] space-y-1"
                        >
                          <div className="flex items-center justify-between text-amber-300">
                            <span>{rp.documentTitle} {rp.pageNumber ? `(P.${rp.pageNumber})` : ''}</span>
                            <span className="text-gray-400">Score: {rp.score}</span>
                          </div>
                          <p className="text-gray-400 font-sans line-clamp-3">{rp.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isQuerying && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs text-gray-400 animate-pulse">
            <RefreshCw size={14} className="animate-spin text-amber-400" />
            <span>Retrieving project document passages & evaluating grounded response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <span className="text-[11px] font-semibold text-slate-400">Sample Technical Inquiries:</span>
        {SUGGESTED_INQUIRIES.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(preset.prompt)}
            disabled={isQuerying}
            className="px-2.5 py-1 rounded text-[11px] font-sans font-semibold transition-all border cursor-pointer disabled:opacity-50"
            style={{
              background: 'var(--color-surface-container-high)',
              borderColor: 'var(--color-surface-border-subtle)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2 shrink-0"
      >
        <input
          type="text"
          placeholder="Ask an engineering question about uploaded documents..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          disabled={isQuerying}
          className="flex-1 px-4 py-3 rounded-lg text-xs outline-none shadow-sm"
          style={{
            background: 'var(--color-surface-container-med)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-surface-border-default)',
          }}
        />
        <button
          type="submit"
          disabled={isQuerying || !inputValue.trim()}
          className="px-5 py-3 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          style={{
            background: 'var(--color-brand-yellow)',
            color: '#000',
          }}
        >
          {isQuerying ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
          <span>Send</span>
        </button>
      </form>
        </>
      )}
    </div>
  );
}
