import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SiteAssistantPage } from '../pages/SiteAssistantPage';
import { api } from '../api/client';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../api/client', () => ({
  api: {
    listProjects: vi.fn(),
    getAssistantStatus: vi.fn(),
    listDocuments: vi.fn(),
    queryAssistant: vi.fn(),
  },
}));

const mockProjects = [
  {
    id: 'PRJ-NH48-PKG3',
    name: 'NH-48 Elevated Expressway Package 3',
    packageId: 'PKG-03',
    chainageRange: 'KM 102+000 to KM 118+500',
    isDemoMode: false,
  },
];

const mockDocuments = [
  {
    documentId: 'DOC-57F675F71F',
    projectId: 'PRJ-NH48-PKG3',
    title: 'IRC:112-2020 Crack Limits',
    originalFilename: 'IRC_112_Crack_Standards.pdf',
    fileType: 'pdf',
    fileSizeBytes: 1048576,
    wordCount: 12000,
    processingStatus: 'INDEXED',
    requiresOcr: false,
    uploadedAt: '2026-10-21T00:00:00Z',
  },
];

const mockStatusResponse = {
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  providerAvailable: true,
  isConfigured: true,
  supportedTypes: ['pdf', 'txt', 'md', 'csv'],
};

const mockAssistantAnswer = {
  answer: 'Per IRC:112 Clause 12.3, the maximum allowable design crack width is 0.20 mm for severe environmental exposure.',
  citations: [
    {
      documentId: 'DOC-57F675F71F',
      documentTitle: 'IRC:112-2020 Crack Limits',
      pageNumber: 14,
      passageIndex: 2,
      excerpt: '[Page 14] Maximum crack width limit shall not exceed 0.20 mm under quasi-permanent load combinations.',
      downloadUrl: '/api/v4/projects/PRJ-NH48-PKG3/documents/DOC-57F675F71F/file',
    },
  ],
  isGrounded: true,
  insufficientEvidence: false,
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  providerAvailable: true,
  error: null,
  retrievalInfo: {
    query: 'What is the crack width limit?',
    projectId: 'PRJ-NH48-PKG3',
    totalResults: 1,
    passages: [
      {
        documentId: 'DOC-57F675F71F',
        documentTitle: 'IRC:112-2020 Crack Limits',
        chunkIndex: 2,
        content: 'Maximum crack width limit shall not exceed 0.20 mm...',
        score: 0.94,
        wordCount: 45,
        pageNumber: 14,
      },
    ],
  },
};

describe('SiteAssistantPage (Activity 5.1 / Grounded RAG Chatbot)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    vi.mocked(api.listProjects).mockResolvedValue(mockProjects);
    vi.mocked(api.getAssistantStatus).mockResolvedValue(mockStatusResponse);
    vi.mocked(api.listDocuments).mockResolvedValue(mockDocuments);
    vi.mocked(api.queryAssistant).mockResolvedValue(mockAssistantAnswer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial grounded assistant page with status badge and welcome message', async () => {
    render(
      <MemoryRouter>
        <SiteAssistantPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Site Intelligence Assistant')).toBeInTheDocument();
    expect(screen.getByText(/SITEWISE Grounded Document Intelligence Assistant online/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(api.listProjects).toHaveBeenCalled();
      expect(api.getAssistantStatus).toHaveBeenCalledWith('PRJ-NH48-PKG3');
      expect(api.listDocuments).toHaveBeenCalledWith('PRJ-NH48-PKG3');
    });

    // Check presence of Technical Q&A Assistant and Daily Site Briefing tabs
    expect(screen.getByRole('button', { name: /Technical Q&A Assistant/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Site Briefing/i })).toBeInTheDocument();

    // Verify dynamic model status badge displays configured Groq model
    expect(await screen.findByText(/GROQ \(openai\/gpt-oss-120b\) • Live RAG Active/i)).toBeInTheDocument();
  });

  it('submits a grounded question and renders answer with verifiable citations', async () => {
    render(
      <MemoryRouter>
        <SiteAssistantPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.listDocuments).toHaveBeenCalled());

    // Use suggested prompt chip to test grounded question submission
    const chipBtn = screen.getByRole('button', { name: /IRC:112 Pier 18 Compliance/i });
    fireEvent.click(chipBtn);

    await waitFor(() => {
      expect(api.queryAssistant).toHaveBeenCalledWith(
        'PRJ-NH48-PKG3',
        'Evaluate Pier 18 cantilever crack aperture (0.35mm) against IRC:112 Clause 12.3 crack width criteria.',
        undefined
      );
    });

    // Verify answer rendered
    expect(await screen.findByText(/Per IRC:112 Clause 12.3, the maximum allowable design crack width is 0.20 mm/i)).toBeInTheDocument();

    // Verify citation rendered (multiple elements may exist in select option + citation card)
    expect(screen.getAllByText(/IRC:112-2020 Crack Limits/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Page 14/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Verified Source Citations/i)).toBeInTheDocument();
  });

  it('handles insufficient evidence responses gracefully without crashing', async () => {
    vi.mocked(api.queryAssistant).mockResolvedValueOnce({
      answer: 'The uploaded documents do not contain sufficient evidence to answer this question.',
      citations: [],
      isGrounded: false,
      insufficientEvidence: true,
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      providerAvailable: true,
      error: null,
      retrievalInfo: {
        query: 'What is the tensile strength of titanium bolts?',
        projectId: 'PRJ-NH48-PKG3',
        totalResults: 0,
        passages: [],
      },
    });

    render(
      <MemoryRouter>
        <SiteAssistantPage />
      </MemoryRouter>
    );

    const chipBtn = screen.getByRole('button', { name: /Liquidated Damages at 14 Days/i });
    fireEvent.click(chipBtn);

    const found = await screen.findAllByText(/The uploaded documents do not contain sufficient evidence/i);
    expect(found.length).toBeGreaterThanOrEqual(1);
  });

  it('renders inline error message when API call fails', async () => {
    vi.mocked(api.queryAssistant).mockRejectedValueOnce(new Error('Network error: Gateway timeout 504'));

    render(
      <MemoryRouter>
        <SiteAssistantPage />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Ask an engineering question about uploaded documents/i);
    const sendBtn = screen.getByRole('button', { name: /Send/i });

    fireEvent.change(input, { target: { value: 'Will this trigger an error?' } });
    fireEvent.click(sendBtn);

    expect(await screen.findByText(/An error occurred while evaluating your question: Network error: Gateway timeout 504/i)).toBeInTheDocument();
  });

  it('does not send query when input is empty or whitespace only', () => {
    render(
      <MemoryRouter>
        <SiteAssistantPage />
      </MemoryRouter>
    );

    const sendBtn = screen.getByRole('button', { name: /Send/i });
    fireEvent.click(sendBtn);

    expect(api.queryAssistant).not.toHaveBeenCalled();
  });

  it('switches to Daily Site Briefing tab smoothly', async () => {
    render(
      <MemoryRouter>
        <SiteAssistantPage />
      </MemoryRouter>
    );

    const briefingTabBtn = screen.getByRole('button', { name: /Daily Site Briefing/i });
    fireEvent.click(briefingTabBtn);

    // Header badge updates to DAILY BRIEFING ENGINE
    expect(screen.getByText(/DAILY BRIEFING ENGINE/i)).toBeInTheDocument();
  });
});
