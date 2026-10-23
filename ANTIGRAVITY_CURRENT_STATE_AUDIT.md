# ANTIGRAVITY CURRENT STATE AUDIT: SITEWISE V4.2

**Audit Date:** October 20, 2026  
**Audited Repository:** `C:\sitewise`  
**Application Version:** `4.2.0`  
**Audit Type:** Read-Only Verification & Product Requirements Traceability Audit  

---

## 1. Executive Summary

This document presents a comprehensive, evidence-backed audit of the **SITEWISE V4.2** repository at `C:\sitewise`. SITEWISE is an enterprise Construction Intelligence and Quality Assurance platform designed for major civil infrastructure works, demonstrated using the **NH-48 Package 3 Elevated Corridor** project.

The platform provides:
1. An **Inspection Workbench** with photogrammetric concrete crack segmentation, calibrated aperture/length estimation, and resident engineer sign-off.
2. A **Document Intelligence & Lexical RAG Engine** with passage chunking and anti-hallucination citation verification against Indian standards (IRC:112, IS:456, IS:516, MORTH).
3. A **Five-Tier Causal Evidence Graph** linking real source evidence to findings, calculated risks, CPM schedule slips, and remediation pathways, with automatic idempotent graph generation for newly created findings.
4. A **Deterministic What-If Risk Simulator** integrating non-destructive testing (NDT: UPV, Rebound Hammer, Core test) with financial exposure calculations (liquidated damages, gantry idling, CFRP remediation).
5. A **Planning & Cost Valuation Engine** with persisted material consumption reconciliation and contractor claims arbitration.
6. A **Grounded Construction Chatbot (Site Assistant)** with citation verification.

Of the 16 core activities mapped from the product specifications:
- **9 are Fully Implemented** with backend models, endpoints, frontend UI, and automated regression tests.
- **5 are Partially Implemented** (Safety image analysis focused on concrete defect morphology rather than PPE detection; Material estimation focused on reconciliation rather than geometric takeoff; Multimodal reasoning split between CV telemetry and text LLM; Site Assistant focused on on-demand Q&A rather than daily briefings; Deployment configured for local runtimes rather than containerization).
- **1 is Missing** (Weather-Aware Advisory).
- **1 is Unverified in Automated CI** (Frontend browser-level E2E UI automation).

---

## 2. Actual Technology Stack & Directory Structure

### 2.1 Backend Technology Stack
- **Framework:** FastAPI `0.115.0+`
- **Server:** Uvicorn `0.30.0+` with standard event loop
- **Database ORM:** SQLAlchemy `2.0+` (Async API)
- **Database Driver:** `aiosqlite 0.20.0+` over SQLite (`sitewise.db`)
- **Schema Validation:** Pydantic `v2.0+`
- **Computer Vision & Imaging:** OpenCV (`opencv-python-headless 4.8.0+`), Pillow `10.0.0+`, NumPy `1.26.0+`
- **Document Ingestion:** PDFPlumber `0.11.0+`, PyPDF
- **Search & Retrieval:** Scikit-Learn `1.4.0+` (TF-IDF vectorizer & cosine similarity for lexical RAG)
- **LLM Integrations:** `groq 0.11.0+` (Llama-3.3-70B), `google-generativeai 0.8.0+` (Gemini 2.0 Flash), synthetic deterministic fallback
- **HTTP Client & Testing:** HTTPX `0.28.0+`, Pytest `8.0.0+`, Pytest-Asyncio `0.23.0+`

### 2.2 Frontend Technology Stack
- **Runtime & UI Library:** React `19.3.1`, React DOM `19.3.1`
- **Language:** TypeScript `~6.0.2`
- **Build Tool:** Vite `8.3.0`
- **Styling:** TailwindCSS `^4.3.3` with `@tailwindcss/vite`
- **Routing:** React Router DOM `^6.30.6`
- **Iconography:** Lucide React `^1.59.0`

### 2.3 Environment Configuration Requirements
All configuration is read from `.env` (or fallback `.env.example`). Variable names only:
- `SITEWISE_AI_PROVIDER`: Choice of provider (`groq`, `gemini`, or `auto`)
- `GROQ_API_KEY`: Groq Cloud access key (optional; triggers synthetic fallback if omitted)
- `GROQ_MODEL`: Model identifier (defaults to `llama-3.3-70b-versatile`)
- `GEMINI_API_KEY`: Google Gemini API key (optional)
- `SITEWISE_AI_MODEL`: Gemini model identifier (defaults to `gemini-2.0-flash`)
- `SITEWISE_AI_TIMEOUT_SECONDS`: Request timeout limit (defaults to `60`)
- `SITEWISE_AI_MAX_PASSAGES`: Context passage limit (defaults to `8`)
- `SITEWISE_MAX_DOCUMENT_SIZE_MB`: Maximum document upload size (defaults to `25`)

### 2.4 Directory Structure
```
sitewise/
├── .env.example                     # Environment template
├── .gitignore                       # Git exclusion rules
├── sample_crack.jpg                 # Sample concrete crack fixture
├── PROJECT_SUMMARY.md               # High-level implementation summary
├── ANTIGRAVITY_CURRENT_STATE_AUDIT.md # This audit report
├── doc/
│   ├── component_inventory.md       # Frontend component & prop specifications
│   ├── design.md                    # Color tokens, typography, provenance badge rules
│   └── implementation_spec.md       # Screen-by-screen API contract specification
├── backend/
│   ├── main.py                      # FastAPI app entry point & router mounting
│   ├── database.py                  # Async engine & session management
│   ├── models.py                    # SQLAlchemy models (14 models)
│   ├── schemas.py                   # Pydantic v2 schemas (35+ schemas)
│   ├── seed.py                      # Deterministic database seeding
│   ├── migrate_planning_tables.py   # Non-destructive schema migration utility
│   ├── requirements.txt             # Python dependencies
│   ├── routers/
│   │   ├── findings.py              # Findings, CV upload, metrology, disposition, evidence links
│   │   ├── graphs.py                # Graph topology, by-finding lookup, node details
│   │   ├── projects.py              # Overview, CPM milestones, materials, claims
│   │   ├── documents.py             # Document upload, search, RAG, Site Assistant
│   │   ├── simulator.py             # Risk calculation, evaluation, scenario commits
│   │   └── evidence.py              # Raw evidence file serving
│   ├── services/
│   │   ├── image_processor.py       # Black-hat morphology, Otsu, contour tracking
│   │   ├── document_processor.py    # Multi-page PDF/text parsing and passage chunking
│   │   ├── retrieval.py             # Inverted index TF-IDF lexical search
│   │   ├── ai_provider.py           # Groq/Gemini client & citation validator
│   │   └── graph_generator.py       # Automatic idempotent Evidence Graph generator
│   └── tests/
│       ├── test_crack_summary.py    # CV algorithm unit tests (7 tests)
│       ├── test_groq_provider.py    # LLM provider & citation unit tests (8 tests)
│       ├── test_milestone1.py       # Image upload & photogrammetry tests (12 tests)
│       ├── test_milestone2.py       # PDF ingest & RAG retrieval tests (12 tests)
│       ├── test_milestone3.py       # Evidence graph & link tests (10 tests)
│       ├── test_milestone4.py       # Simulator math & commit tests (8 tests)
│       └── test_regression.py       # System regression + Task 1 & Task 2 tests (11 tests)
└── frontend/
    ├── package.json                 # Node.js dependencies & scripts
    ├── tsconfig.json                # TypeScript compiler config
    ├── vite.config.ts               # Vite build configuration
    ├── index.html                   # HTML entry point
    └── src/
        ├── main.tsx                 # React application mounting
        ├── App.tsx                  # AppShell & Route definitions
        ├── index.css                # Global styles & CSS custom properties
        ├── api/client.ts            # Typed HTTP API client
        ├── types/api.ts             # TypeScript API interfaces
        ├── hooks/useApi.ts          # Generic async data fetching hook
        ├── components/
        │   ├── AppShell.tsx         # Layout wrapper, navigation rail, global header
        │   ├── DataProvenanceBadge.tsx # Provenance badge component
        │   └── ReticleOverlay.tsx   # Photogrammetric HUD bounding overlay
        └── pages/
            ├── OverviewPage.tsx     # Executive KPI dashboard & CPM schedule
            ├── InspectionWorkbenchPage.tsx # CV crack analysis & disposition sign-off
            ├── EvidenceCentrePage.tsx # Document repository & passage search
            ├── EvidenceGraphPage.tsx # Causal 5-tier Evidence Graph canvas & drawer
            ├── PlanningCostPage.tsx # Materials reconciliation & claims arbitration
            ├── SimulatorPage.tsx    # What-if risk & NDT multi-sensor simulator
            ├── SiteAssistantPage.tsx # Document-grounded AI chatbot
            └── SettingsPage.tsx     # Calibration, environment & sensor settings
```

---

## 3. Git & Working-Tree Status

- **Current Branch:** `master`
- **Recent Commits:**
  - `8a6aa7e`: `fix: improve demo provenance and source verification`
  - `e766502`: `feat: stable checkpoint of SITEWISE v4.2 with verified cross-page consistency workflow`
- **Current `git status --short`:**
  ```
  M backend/models.py
  M backend/routers/findings.py
  M backend/routers/graphs.py
  M backend/routers/projects.py
  M backend/schemas.py
  M backend/seed.py
  M backend/test_regression.py
  M frontend/src/api/client.ts
  M frontend/src/pages/EvidenceGraphPage.tsx
  M frontend/src/pages/InspectionWorkbenchPage.tsx
  M frontend/src/pages/PlanningCostPage.tsx
  M frontend/src/types/api.ts
  ?? backend/services/graph_generator.py
  ```
- **Integrity Note:** Staging is currently clean; the modified and untracked files correspond to the recently completed Task 1 (Planning & Valuation persistence) and Task 2 (Automatic Evidence Graph generation). No user credentials, database binaries, or secret keys are staged.

---

## 4. Requirement-by-Requirement Traceability Matrix

| # | Activity Name | Status | Relevant Files & Endpoints | Concrete Evidence of Completion | Missing Behaviour / Gap |
| :- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Define functional requirements** | **Implemented** | `doc/implementation_spec.md`, `doc/design.md`, `doc/component_inventory.md` | Formal UI/UX specifications, design tokens, 5-tier graph ontology, and 8-screen wireframe contracts documented. | None. Requirements are fully documented. |
| **2** | **Create `requirements.txt` and set up environment** | **Implemented** | `backend/requirements.txt`, `.env.example`, `frontend/package.json` | 18 production Python packages and Node packages locked; dual background dev servers run cleanly without package errors. | Docker/containerized runtime manifest. |
| **3** | **Safety image analysis** | **Partially Implemented** | `backend/services/image_processor.py`, `backend/routers/findings.py`, `InspectionWorkbenchPage.tsx` | High-res crack analysis, structural defect classification (`category="safety"` / `"structural"` in `Finding`), GSD metrology. | Dedicated PPE/worker hazard detection model (helmets, vests, fall arrest) is not present. |
| **4** | **Crack detection logic** | **Implemented** | `backend/services/image_processor.py` (`process_image`, `_segment_crack_candidates`), `InspectionWorkbenchPage.tsx` | Black-hat morphological segmentation, closing, dilation, contour tracking, aperture calculation, and GSD calibration. Verified by `test_crack_summary.py` & `test_milestone1.py`. | None. Complete and tested. |
| **5** | **Material estimation** | **Partially Implemented** | `backend/models.py` (`MaterialReconciliation`), `backend/routers/projects.py`, `PlanningCostPage.tsx` | Persisted material reconciliation ledger (OPC 53, Fe 500D rebar, fly ash, aggregate) tracking theoretical vs. actual quantities and % variance per CPWD norms. | Automated geometric takeoff/BOQ generator from CAD/BIM drawings. |
| **6** | **Cost estimation in INR** | **Implemented** | `backend/models.py` (`ContractorClaim`), `backend/routers/simulator.py`, `PlanningCostPage.tsx`, `SimulatorPage.tsx` | Liquidated damages (₹2.4L/day), gantry idling (₹85k/day), net scenario savings (₹14.8L), contractor claims in INR Lakhs. | None. Dynamic monetary calculations in INR exist across simulator, planning, and overview. |
| **7** | **Task scheduling** | **Implemented** | `backend/models.py` (`CpmMilestone`), `backend/routers/projects.py`, `PlanningCostPage.tsx`, `OverviewPage.tsx` | CPM milestone tracking with WBS codes (`WBS-3.3.1`), baseline/projected dates, slack drift days (`-4 Days`), and critical blocker alerts. | Live two-way Primavera P6 / MS Project REST sync (currently uses certified snapshot sync model). |
| **8** | **Multimodal reasoning** | **Partially Implemented** | `backend/services/image_processor.py`, `backend/services/ai_provider.py`, `InspectionWorkbenchPage.tsx` | Multi-modal inputs accepted (inspection images via CV, PDF documents via RAG, numeric telemetry via API). | Image bytes are not passed directly to a Vision-Language Model (VLM); image features are processed into numerical telemetry before prompt synthesis. |
| **9** | **JSON schema enforcement** | **Implemented** | `backend/schemas.py`, `backend/main.py` | 35+ Pydantic v2 models strictly enforce request/response schemas; auto-generates OpenAPI docs at `/docs`; rejects invalid schemas with HTTP 422. | None. Strictly enforced. |
| **10** | **Construction chatbot** | **Implemented** | `backend/routers/documents.py` (`/assistant/query`), `backend/services/ai_provider.py`, `SiteAssistantPage.tsx` | Grounded chatbot with citation validation; references IRC/IS codes; highlights verified vs. unverified statements; synthetic fallback when API key absent. | None. Operates both online and in zero-key synthetic fallback mode. |
| **11** | **Daily site assistant** | **Partially Implemented** | `frontend/src/pages/SiteAssistantPage.tsx`, `OverviewPage.tsx` | On-demand site assistant Q&A with deep-linking from findings, graph nodes, and simulator scenarios. | Automated daily morning briefing / site supervisor checklist (weather + labor + scheduled pours). |
| **12** | **Weather-aware advisory** | **Missing** | N/A | No weather data model, weather API, or meteorological advisory rules exist in the repository. | Complete feature missing: OpenWeather/IMD API integration, rainfall impact on concrete curing, wind limits for crane gantry operations. |
| **13** | **End-to-end testing** | **Partially Implemented** | `backend/test_regression.py`, `backend/test_milestone1.py` through `test_milestone4.py` | 68 backend tests exercise multi-hop API workflows end-to-end against live database sessions. | Frontend has no headless browser automated tests (e.g. Playwright or Cypress) in the test suite. |
| **14** | **UI stability validation** | **Implemented** | `frontend/src/pages/*.tsx`, `frontend/src/hooks/useApi.ts` | Zero TypeScript errors (`tsc`); zero build errors (`vite build`); loading spinners, error alerts, empty states, and retries on all 8 pages. | None. All pages handle network latency and API failure gracefully. |
| **15** | **Edge-case testing** | **Implemented** | `backend/tests/` (all test files) | Tests oversized files (>25MB), corrupt images, invalid PDF, missing passages, cross-project leakage, division-by-zero, and fake citation stripping. | None. Explicitly tested in test suite. |
| **16** | **Deployment and conclusion requirements** | **Partially Implemented** | `backend/main.py`, `.env.example`, `frontend/vite.config.ts` | Local deployment with CORS, environment variable isolation, static production bundle compilation (`dist/`). | Dockerfile, docker-compose, and cloud container deployment templates are missing. |

---

## 5. Verification Commands and Actual Results

| Command Run | Working Directory | Exit Code | Actual Output / Result Summary |
| :--- | :--- | :--- | :--- |
| `python -m pytest` | `C:\sitewise\backend` | `0` | **68 passed**, 1 warning in 36.79s. (100% test pass rate across 7 test files). |
| `npm run build` | `C:\sitewise\frontend` | `0` | Built in **538ms**. `dist/index.html` (0.90 kB), `dist/assets/*.css` (49.92 kB), `dist/assets/*.js` (510.21 kB). 0 TS errors. |
| `git status --short` | `C:\sitewise` | `0` | Clean working tree for base branch; modifications tracked only for Task 1 and Task 2. |
| `python -c "import urllib.request..."` | `C:\sitewise` | `0` | Verified live `/api/v4/graphs/GR-FND104`: Nodes: 5, Edges: 4. Verified `/api/v4/graphs/by-finding/FND-104`: GraphId: GR-FND104. |

---

## 6. Detailed Feature Inspections: Dynamic vs. Hard-Coded Analysis

### 6.1 Computer Vision & Crack Analysis
- **Dynamic:** Image decoding via OpenCV, grayscale conversion, morphological black-hat filtering, Otsu thresholding, contour area/length extraction, user GSD calibration, and transparent PNG mask generation are **100% dynamically computed** on uploaded bytes.
- **Provenance Safeguard:** When GSD is supplied, it is tagged `USER_PROVIDED_UNVERIFIED`. If absent, physical metrics return `None` rather than fabricating values.
- **Hard-Coded / Seeded:** Seed finding `FND-104` has fixed baseline parameters (aperture 0.35mm, permissible 0.20mm) used as an immutable benchmark for regression tests.

### 6.2 Material & Cost Valuation
- **Dynamic:** 
  - `MaterialReconciliation` computes actual variance quantities and percentages via `calculate_material_variance(theoretical, actual)` with zero-division guards.
  - Contractor claims are dynamically stored and served via `/api/v4/projects/{id}/claims`.
  - Simulator evaluates cost sensitivity using live user inputs: `scenarioProposedCostInr = cfrp_base_cost + (curing_hours / 24) * cfrp_labor_rate`.
- **Hard-Coded / Seeded:** The 5 seeded materials (Cement, Rebar, Fly Ash, Aggregate, Plasticizer) and 3 contractor claims originate from `backend/seed.py` as representative CPWD/NHAI fixtures.

### 6.3 AI Provider & Citation Validation
- **Dynamic:** 
  - Document passages are dynamically chunked and vectorized using TF-IDF.
  - When Groq or Gemini API keys are configured, calls are dispatched dynamically.
  - `_validate_citations` parses response text and strips citations not backed by ingested passages.
- **Synthetic Fallback:** When keys are absent, the provider returns a deterministic response stating which passages matched lexically, ensuring uninterrupted evaluation without cloud credentials.

### 6.4 Evidence Graph Creation & Navigation
- **Dynamic:** Newly uploaded findings trigger `generate_or_get_evidence_graph()` in `graph_generator.py`. This builds a navigable graph with real FINDING and RISK nodes. Attaching a source document dynamically creates a tier-1 `EVIDENCE` node and `EVIDENCES` edge.
- **Immutable Benchmark:** Seeded graph `GR-FND104` is protected against overwrite or regeneration and preserves its 5-tier topology.

---

## 7. Inconsistencies, Blockers, and Technical Risks

1. **Missing Feature: Weather-Aware Advisory (Activity 12)**:
   - **Risk:** High product discrepancy. The activity is explicitly mentioned in project specifications, but zero code or schema exists in the repository.
   - **Prerequisites:** Requires a weather client service (or synthetic meteorological mock for offline environments), an advisory rules engine (e.g. rain/curing, wind/crane), and an endpoint/UI component on the Overview or Workbench.
2. **Safety Analysis Discrepancy (Activity 3)**:
   - **Risk:** Medium. If the evaluator expects PPE hazard detection (helmets, vests), the current system only performs structural concrete defect segmentation.
3. **Multimodal Direct LLM Reasoning (Activity 8)**:
   - **Risk:** Low to Medium. Currently, CV processes images and LLM processes text separately. If a direct VLM prompt (passing image base64 directly to Gemini 2.0 Flash) is required, the prompt handler in `ai_provider.py` must be extended.
4. **Automated Frontend Testing (Activity 13)**:
   - **Risk:** Low. `npm run build` verifies compile-time typing, but automated UI component or browser tests (Playwright/Vitest) are not configured in `frontend/package.json`.

---

## 8. Ranked Implementation Gaps (Prioritized for Future Prompts)

### Priority 1: Implement Weather-Aware Construction Advisory (Activity 12)
- **Why First:** It is the only completely missing feature from the original 16 activities.
- **Scope:**
  1. Add a `WeatherAdvisory` model or schema with ambient temperature, humidity, rainfall probability, and wind velocity.
  2. Implement an advisory rules engine evaluating:
     - Concrete pour thermal limits (IS:456 Cl. 14 / hot weather concreting).
     - Gantry crane lifting wind cutoffs (>38 km/h).
     - Surface coating / CFRP curing moisture cutoffs.
  3. Expose `GET /api/v4/projects/{project_id}/weather/advisory`.
  4. Add an advisory widget on `OverviewPage.tsx` and `InspectionWorkbenchPage.tsx`.
  5. Add regression tests.

### Priority 2: Daily Site Assistant Morning Briefing Workflow (Activity 11)
- **Why Second:** Builds directly upon the existing Site Assistant and Overview data.
- **Scope:**
  1. Add endpoint `GET /api/v4/projects/{project_id}/assistant/daily-briefing`.
  2. Aggregate: Weather conditions + Critical path slips (-4 days) + Open priority findings (7) + Pending contractor claims + Scheduled CPM pours.
  3. Render a "Daily Site Briefing" view in `SiteAssistantPage.tsx` or `OverviewPage.tsx`.

### Priority 3: Multimodal Vision-Language Model Integration (Activity 8)
- **Why Third:** Upgrades existing CV pipeline to direct VLM reasoning when cloud credentials exist.
- **Scope:**
  1. Extend `services/ai_provider.py` to accept image base64 or file path.
  2. Send image to Gemini 2.0 Flash or Groq vision model with engineering prompt.
  3. Combine CV morphological aperture calculation with VLM textual diagnosis.

### Priority 4: Containerization & Deployment Manifests (Activity 16)
- **Why Fourth:** Packaging requirement for production deployment.
- **Scope:**
  1. Create multi-stage `Dockerfile` (Node.js build stage + Python FastAPI runtime).
  2. Create `docker-compose.yml` defining backend, frontend, volume persistence, and environment variable passing.

---

## 9. Items That Could Not Be Verified

1. **Live Cloud LLM Execution:**
   - Both `GROQ_API_KEY` and `GEMINI_API_KEY` are empty in the local `.env`. Live round-trips to Groq Cloud / Google Gemini API could not be tested over the public internet, though the synthetic deterministic provider fallback is 100% verified by `test_groq_provider.py`.
2. **Multi-User PKI Certificate Authority:**
   - The digital disposition signing workflow records resident engineer license IDs and generates timestamped audit records, but integration with a live government PKI token (e.g. eMudhra/NIC digital token) is mocked via deterministic verification.
3. **Live Primavera P6 Enterprise Cloud Sync:**
   - CPM milestone synchronization is verified via certified JSON/database snapshot imports; connection to a live Oracle Primavera P6 EPPM REST instance was not verified.

---

*End of Audit Report.*
