import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArchitecturalVisualizerCard } from '../components/ArchitecturalVisualizerCard';

const mockOptions = {
  building_types: {
    commercial_office: 'Commercial Office Tower (IT / BFSI Grade-A)',
    residential_highrise: 'Residential High-Rise Apartment Complex',
    infrastructure_viaduct: 'Elevated Expressway Viaduct & Pier Structure',
  },
  architectural_styles: {
    modern_sustainable: 'Modern Sustainable (IGBC / LEED Platinum)',
    brutalist_concrete: 'Brutalist Cast-in-Situ Structural Expression',
    contemporary_glass: 'Contemporary Double-Glazed Curtain Wall',
  },
  context_environments: {
    urban_highway: 'Urban Expressway Corridor & Transit Flyover',
    suburban_arterial: 'Suburban Arterial Roadway with Mixed Density',
  },
  features: [
    'Solar PV rooftop array',
    'Green rooftop terrace garden',
    'Rainwater harvesting balancing tanks',
    'Deep architectural louvers & sunshades',
  ],
  disclaimer: 'AI-generated massing visualization for conceptual massing studies only. Non-certified architectural rendering.',
};

const mockGenerationResult = {
  project_id: 'PRJ-NH48-PKG3',
  status: 'SUCCESS',
  provenance: 'AI_INFERRED',
  image_url: 'https://image.pollinations.ai/prompt/commercial_office_tower_render',
  image_base64: null,
  prompt_used: 'Photorealistic architectural rendering of a Commercial Office Tower, 8 floors, Modern Sustainable style.',
  provider_name: 'Pollinations.AI / FLUX-Schnell',
  generation_time_ms: 3200,
  specifications_summary: {
    building_type: 'Commercial Office Tower (IT / BFSI Grade-A)',
    floors: 8,
    style: 'Modern Sustainable (IGBC / LEED Platinum)',
    context_environment: 'Urban Expressway Corridor & Transit Flyover',
    features_count: 2,
  },
  disclaimer: 'Concept preview only. Structural engineering approval mandatory prior to site staging.',
  limitations: [
    'Does not represent sanctioned municipal building plans',
    'Non-binding aesthetic massing preview',
  ],
};

describe('ArchitecturalVisualizerCard (Activity 3.3 / Architectural Preview)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads options and renders form controls on mount', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockOptions,
    } as unknown as Response);

    render(<ArchitecturalVisualizerCard projectId="PRJ-NH48-PKG3" />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v4/architectural-preview/options');
      expect(screen.getByText(/AI Conceptual Architectural Visualisation/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Generate Conceptual Visualisation/i })).toBeEnabled();
    });

    // Check presence of form controls
    expect(screen.getByText(/Building Typology/i)).toBeInTheDocument();
    expect(screen.getByText(/Architectural Style/i)).toBeInTheDocument();
    expect(screen.getByText(/Storeys \/ Floors/i)).toBeInTheDocument();
    expect(screen.getByText(/Surrounding Context/i)).toBeInTheDocument();
    expect(screen.getByText(/Architectural & Sustainable Features/i)).toBeInTheDocument();
  });

  it('submits generation request and displays generated conceptual preview', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/options')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockOptions,
        } as unknown as Response;
      }
      if (url.includes('/architectural-preview')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockGenerationResult,
        } as unknown as Response;
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    render(<ArchitecturalVisualizerCard projectId="PRJ-NH48-PKG3" />);

    // Wait until options load and button is enabled
    const generateBtn = await screen.findByRole('button', { name: /Generate Conceptual Visualisation/i });
    await waitFor(() => {
      expect(generateBtn).toBeEnabled();
    });

    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/v4/projects/PRJ-NH48-PKG3/architectural-preview',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(screen.getByText(/Photorealistic architectural rendering of a Commercial Office Tower/i)).toBeInTheDocument();
    });

    // Check prompt and specs rendered
    expect(screen.getByText(/Pollinations.AI \/ FLUX-Schnell/i)).toBeInTheDocument();
  });

  it('renders inline error banner when concept generation fails', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/options')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockOptions,
        } as unknown as Response;
      }
      if (url.includes('/architectural-preview')) {
        return {
          ok: false,
          status: 504,
          json: async () => ({ detail: 'Visualizer model gateway timeout' }),
        } as unknown as Response;
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    render(<ArchitecturalVisualizerCard projectId="PRJ-NH48-PKG3" />);

    const generateBtn = await screen.findByRole('button', { name: /Generate Conceptual Visualisation/i });
    await waitFor(() => {
      expect(generateBtn).toBeEnabled();
    });

    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText(/Generation failed with HTTP status 504/i)).toBeInTheDocument();
    });
  });
});
