/**
 * SITEWISE V4.2 — Typed API client
 */

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const BASE_URL = `${API_BASE}/api/v4`;

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }

  return res.json();
}

import type {
  ProjectListItem,
  OverviewResponse,
  InspectionTelemetryResponse,
  EvidenceGraphResponse,
  SimulatorEvaluateRequest,
  SimulatorEvaluateResponse,
  SimulatorCommitResponse,
  DispositionUpdateResponse,
  FindingUploadResponse,
  FindingAnalysisResponse,
  FindingListItem,
  DocumentListItem,
  DocumentMetadata,
  DocumentUploadResponse,
  SearchResponse,
  AssistantAnswer,
  AssistantStatusResponse,
  NodeSourceDetailsResponse,
  FindingEvidenceLinksListResponse,
  ScenarioSaveRequest,
  ScenarioItemResponse,
  ScenarioListResponse,
  MaterialReconciliationResponse,
  ContractorClaimsResponse,
} from '../types/api';



export const api = {
  // Projects
  listProjects: () =>
    request<ProjectListItem[]>('/projects'),

  getOverview: (projectId: string) =>
    request<OverviewResponse>(`/projects/${projectId}/overview`),

  // Findings / Inspection
  listFindings: () =>
    request<FindingListItem[]>('/findings'),

  getFindingTelemetry: (findingId: string) =>
    request<InspectionTelemetryResponse>(`/findings/${findingId}/telemetry`),

  getFindingAnalysis: (findingId: string) =>
    request<FindingAnalysisResponse>(`/findings/${findingId}/analysis`),

  uploadFindingImage: async (formData: FormData): Promise<FindingUploadResponse> => {
    const res = await fetch(`${BASE_URL}/findings/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const errJson = await res.json();
        message = errJson.detail || message;
      } catch {
        const text = await res.text();
        if (text) message = text;
      }
      throw new ApiError(res.status, message);
    }
    return res.json();
  },

  updateDisposition: (findingId: string, data: {
    disposition: string;
    engineerNotes: string;
    signerName: string;
    signerLicenseId: string;
  }) =>
    request<DispositionUpdateResponse>(`/findings/${findingId}/disposition`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Evidence Graph
  getGraphTopology: (graphId: string) =>
    request<EvidenceGraphResponse>(`/graphs/${graphId}/topology`),

  getNodeSourceDetails: (graphId: string, nodeId: string) =>
    request<NodeSourceDetailsResponse>(`/graphs/${graphId}/nodes/${nodeId}`),

  getFindingEvidenceLinks: (findingId: string) =>
    request<FindingEvidenceLinksListResponse>(`/findings/${findingId}/evidence-links`),

  // Simulator
  evaluateScenario: (data: SimulatorEvaluateRequest) =>
    request<SimulatorEvaluateResponse>('/simulator/evaluate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  commitScenario: (data: {
    simulationRunId: string;
    findingId: string;
    acknowledgement: boolean;
  }) =>
    request<SimulatorCommitResponse>('/simulator/commit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  saveScenario: (data: ScenarioSaveRequest) =>
    request<ScenarioItemResponse>('/simulator/scenarios', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listScenarios: (projectId?: string, findingId?: string) => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (findingId) params.set('findingId', findingId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<ScenarioListResponse>(`/simulator/scenarios${qs}`);
  },

  getScenario: (scenarioId: string) =>
    request<ScenarioItemResponse>(`/simulator/scenarios/${scenarioId}`),

  deleteScenario: (scenarioId: string) =>
    request<{ status: string; scenarioId: string }>(`/simulator/scenarios/${scenarioId}`, {
      method: 'DELETE',
    }),


  // Documents & Grounded Intelligence
  listDocuments: (projectId: string) =>
    request<DocumentListItem[]>(`/projects/${projectId}/documents`),

  getDocument: (projectId: string, documentId: string) =>
    request<DocumentMetadata>(`/projects/${projectId}/documents/${documentId}`),

  uploadDocument: async (projectId: string, formData: FormData): Promise<DocumentUploadResponse> => {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const errJson = await res.json();
        message = errJson.detail || message;
      } catch {
        const text = await res.text();
        if (text) message = text;
      }
      throw new ApiError(res.status, message);
    }
    return res.json();
  },

  reprocessDocument: (projectId: string, documentId: string) =>
    request<DocumentMetadata>(`/projects/${projectId}/documents/${documentId}/reprocess`, {
      method: 'POST',
    }),

  deleteDocument: (projectId: string, documentId: string) =>
    request<{ status: string; deletedDocumentId: string }>(`/projects/${projectId}/documents/${documentId}`, {
      method: 'DELETE',
    }),

  searchDocuments: (projectId: string, query: string, topK?: number) =>
    request<SearchResponse>(`/projects/${projectId}/documents/search`, {
      method: 'POST',
      body: JSON.stringify({ query, topK: topK || 5 }),
    }),

  getAssistantStatus: (projectId: string) =>
    request<AssistantStatusResponse>(`/projects/${projectId}/assistant/status`),

  queryAssistant: (projectId: string, question: string, documentId?: string) =>
    request<AssistantAnswer>(`/projects/${projectId}/assistant/query`, {
      method: 'POST',
      body: JSON.stringify({ question, documentId: documentId || null }),
    }),

  getDocumentFileUrl: (projectId: string, documentId: string) =>
    `${BASE_URL}/projects/${projectId}/documents/${documentId}/file`,

  // Planning & Valuation (Materials Reconciliation & Claims)
  getMaterialReconciliation: (projectId: string) =>
    request<MaterialReconciliationResponse>(`/projects/${projectId}/materials/reconciliation`),

  getContractorClaims: (projectId: string) =>
    request<ContractorClaimsResponse>(`/projects/${projectId}/claims`),
};


