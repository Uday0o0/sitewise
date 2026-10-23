# SITEWISE V4.2 — Final Submission & Evaluation Guide

**Project Title:** SITEWISE V4.2 — AI-Powered Multimodal Construction Intelligence Platform  
**Target Repository:** `C:\sitewise`  
**Evaluation Baseline:** Git Commit `5be917b` | Branch: `master`  
**Current Date:** October 24, 2026  
**Document Classification:** Official Academic & Technical Evaluation Guide  

---

## Table of Contents

1. [Section A: Project Overview](#section-a-project-overview)
2. [Section B: System Architecture](#section-b-system-architecture)
3. [Section C: Feature-to-Requirement Traceability Matrix](#section-c-feature-to-requirement-traceability-matrix)
4. [Section D: Prerequisites and Installation (Windows 10/11)](#section-d-prerequisites-and-installation-windows-1011)
5. [Section E: Running the Application](#section-e-running-the-application)
6. [Section F: Evaluator Demonstration Script (8–12 Minutes)](#section-f-evaluator-demonstration-script-812-minutes)
7. [Section G: Data Authenticity, Provenance, and Limitations](#section-g-data-authenticity-provenance-and-limitations)
8. [Section H: Automated Testing and Verification](#section-h-automated-testing-and-verification)
9. [Section I: Troubleshooting and Edge Cases](#section-i-troubleshooting-and-edge-cases)
10. [Section J: Submission Verification Checklist](#section-j-submission-verification-checklist)

---

## Section A: Project Overview

### 1. Title and Purpose
**SITEWISE V4.2** is a multimodal construction intelligence and engineering decision-support platform designed for civil infrastructure projects, highway corridors, elevated viaducts, and commercial construction. It combines computer vision metrology, grounded document retrieval (RAG), meteorological constraints evaluation, CPWD-standard parametric quantity takeoffs, and Indian micro-market real estate valuation into a unified, auditable engineering workstation.

### 2. Problem Addressed
Construction and civil engineering supervision in India frequently suffers from:
- **Fragmented Field Evidence:** Structural inspection photos and non-destructive testing (NDT) logs are decoupled from governing design codes (IRC:112, IS:456) and master critical path schedules (Primavera P6).
- **Subjective Defect Severity:** Crack observations are recorded with qualitative descriptions rather than calibrated millimeter metrology, leading to contractual disputes and delayed remediation.
- **Uncoordinated Weather Risks:** Concreting pours and crane gantry launches proceed without systematic evaluation against meteorological thresholds (wind shear, rain probability, heat index).
- **Opaque Material and Cost Estimates:** Traditional estimation relies on unstated thumb rules rather than auditable CPWD Delhi Schedule of Rates (DSR) formulas.
- **Unverified AI Hallucinations:** Generic generative AI tools invent non-existent Indian standards, fabricated citations, or unrealized market comps without auditable provenance.

### 3. Intended Users
- **Resident Engineers (RE):** Inspect structural elements, verify crack widths against IRC:112 limit states, and issue technical review dispositions.
- **Safety Officers (HSE):** Audit site photos for PPE compliance (helmets, high-vis vests) and fall hazards under the Building and Other Construction Workers (BOCW) Act 1996 and OSHA regulations.
- **Project Planning & Commercial Managers:** Evaluate critical path drift, Bar Bending Schedule (BBS) material reconciliation, and delay claims under FIDIC/EPC contracts.
- **Real Estate Appraisers & Developers:** Estimate property values, rental yields, and 5-year capital appreciation outlooks across 12 tier-1 and tier-2 Indian micro-markets.

### 4. Technical Approach
- **Deterministic-First Core:** Critical calculations (crack metrology, CPWD material takeoffs, weather limit-state evaluations, sensitivity curves) are executed via deterministic algorithms with visible mathematical formulas.
- **Grounded Multimodal AI:** Generative and vision-language models (Groq LLaMA-3.3 / Google Gemini) are strictly constrained by structured Pydantic v2 schemas and domain-specific system prompts.
- **Transparent Provenance Tracking:** Every data point across the frontend carries an explicit provenance badge (`SOURCE_VERIFIED`, `CALIBRATED_RISK`, `CALCULATED`, `AI_INFERRED`, `HUMAN_REVIEWED`, or `ILLUSTRATIVE_BASELINE`).
- **Resilient Offline Fallback:** If external cloud AI keys or network connections are unavailable, the system automatically falls back to local lexical TF-IDF retrieval, local OpenCV metrology, and regional historical microclimates.

### 5. Implemented Technology Stack

| Layer | Technologies & Libraries | Verified Version in Workspace |
| :--- | :--- | :--- |
| **Frontend Framework** | React.js, TypeScript, Vite | React 19.0.0, Vite 8.3.4, TypeScript 5.7.3 |
| **Frontend Styling** | TailwindCSS, CSS Variables Design System | Tailwind 3.4.17, Lucide React Icons |
| **Frontend Testing** | Vitest, React Testing Library, jsdom | Vitest 4.0.18, @testing-library/react 16.3.2 |
| **Backend Framework** | FastAPI, Starlette, Uvicorn (ASGI) | FastAPI 0.115.8, Uvicorn 0.34.0, Starlette 0.45.3 |
| **Data Validation** | Pydantic v2, Pydantic-Settings | Pydantic 2.10.6, Pydantic-Core 2.27.2 |
| **Database & ORM** | SQLite, SQLAlchemy (AsyncIO), aiosqlite | SQLAlchemy 2.0.38, aiosqlite 0.21.0 |
| **Computer Vision** | OpenCV (headless), NumPy, Pillow | OpenCV-Python 4.11.0.86, NumPy 2.2.3 |
| **Document Retrieval** | Scikit-learn (TF-IDF vectorizer), PyPDF | Scikit-learn 1.6.1, PyPDF 5.3.0 |
| **External APIs** | Open-Meteo REST API, Groq REST API, Gemini REST API | Httpx 0.28.1 |
| **Backend Testing** | Pytest, Pytest-Asyncio, Httpx Test Client | Pytest 8.3.4, Pytest-Asyncio 0.25.3 |

---

## Section B: System Architecture

### 1. High-Level Architectural Flow

```
                      +-------------------------------------------------------------+
                      |                 SITEWISE V4.2 React Frontend                |
                      |   (Vite SPA - Port 5173 - React 19, TypeScript, Tailwind)    |
                      +------------------------------+------------------------------+
                                                     |
                                                     | HTTP / JSON REST APIs
                                                     v
                      +-------------------------------------------------------------+
                      |                   FastAPI Backend Application               |
                      |          (Uvicorn ASGI - Port 8000 - Python 3.11)           |
                      +------------------------------+------------------------------+
                                                     |
         +--------------------+----------------------+--------------------+--------------------+
         |                    |                      |                    |                    |
         v                    v                      v                    v                    v
+-----------------+  +-----------------+  +--------------------+  +---------------+  +-----------------+
| Findings & CV   |  | Grounded RAG    |  | Weather Advisory   |  | Planning &    |  | Valuation &     |
| Router & Metrol.|  | & Chat Router   |  | & Open-Meteo Serv. |  | CPWD Engine   |  | Market Comps    |
+--------+--------+  +--------+--------+  +---------+----------+  +-------+-------+  +--------+--------+
         |                    |                     |                     |                   |
         v                    v                     v                     v                   v
+-----------------+  +-----------------+  +--------------------+  +---------------+  +-----------------+
| OpenCV Metrol.  |  | TF-IDF Lexical  |  | Open-Meteo Live API|  | CPWD DSR 2021 |  | 12 Benchmark    |
| (GSD Transform) |  | Inverted Index  |  | (or Offline Cache) |  | Material Math |  | Micro-Markets   |
+--------+--------+  +--------+--------+  +---------+----------+  +-------+-------+  +--------+--------+
         |                    |                     |                     |                   |
         +--------------------+---------------------+---------------------+-------------------+
                                                     |
                                                     v
                                  +------------------------------------+
                                  |    SQLAlchemy Async SQLite DB      |
                                  |         (sitewise.db)              |
                                  +------------------------------------+
```

### 2. Frontend Structure and Routing
- **AppShell & Navigation:** Managed by `AppShell.tsx` and `NavigationRail.tsx`. Collapsible 64px/220px navigation rail routing between 11 primary views.
- **Sub-Header Context Bar:** Renders the active corridor package (`PKG-3 Elevated Viaduct`), chainage bounds (`Ch. 14+200 → Ch. 18+600`), governing code (`IRC:112-2020`), and telemetry pipeline heartbeat.
- **Route Definitions:**
  - `/overview`: High-level operational dashboard, active weather advisory card, and structural finding summary.
  - `/evidence`: Document Management ledger (PDF/TXT uploads) and Field Telemetry & Sensor Ledger.
  - `/evidence-graph`: Interactive SVG causal graph connecting evidence, AI findings, risk nodes, CPM drift, and mitigations.
  - `/inspections`: High-resolution crack metrology workbench, orthomosaic canvas, IRC:112 limit verification, and reviewer disposition workflow.
  - `/safety-inspection`: Vision-Language safety audit analyzer evaluating PPE, scaffolding, and fall risks under the BOCW Act 1996.
  - `/planning`: Critical path schedule milestones, material reconciliation (CPWD Cl. 42), and contractor claims register.
  - `/project-planning`: Civil project planning and material takeoff calculator (cement, sand, aggregate, steel) with plot presets and phase schedules.
  - `/valuation`: Real estate valuation engine, rental yield analysis, and 5-year capital appreciation projection.
  - `/simulator`: What-If parametric sensitivity simulator modeling grouting SLA, curing speed, and critical path slip.
  - `/assistant`: Dual-tab Grounded Document RAG Chatbot and Daily Site Briefing generator.
  - `/settings`: Project baseline configuration, Primavera P6 synchronization status, and IoT sensor gateway settings.

### 3. Backend Service Architecture
- **Routers (`backend/routers/`):** 13 modular routers handling project data, findings, evidence graphs, documents, weather, planning, valuation, architectural visualization, AI reasoning, and safety.
- **Database Engine (`backend/database.py`):** Asynchronous SQLite session factory using `aiosqlite`. Automatically initializes tables and runs `seed.py` on first startup if tables are unpopulated.
- **Multimodal AI Provider Layer (`backend/services/ai_provider.py`):** Unified provider abstraction interfacing with Groq (`llama-3.3-70b-versatile`) or Google Gemini (`gemini-1.5-flash`). Enforces Pydantic output schemas, performs automated JSON repair, and gracefully falls back to deterministic rules when no API keys are configured.
- **Grounded Document Intelligence (`backend/services/retrieval.py`):** Lexical TF-IDF vectorizer over SQLite passage chunks. Enforces explicit document citation constraints (`[DOC-57F675F71F]`) and outputs transparent confidence scores.

---

## Section C: Feature-to-Requirement Traceability Matrix

This matrix maps every original requirement from the Skill Wallet specification (`SITEWISE_Original_Project_Requirements_Consolidated.md`) to its implemented component, API route, test suite, and operational status.

| Epic / Activity | Stated Requirement Scope | Implemented Feature & Location | Test & Verification Evidence | Operational Status | Limitations / Configuration Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Activity 1.1** | Define functional requirements & system boundaries | Architecture specifications in `README.md`, `doc/implementation_spec.md`, `doc/design.md`. | Verified in Phase A audit. | **COMPLETE** | None (Static documentation). |
| **Activity 1.2** | `requirements.txt` & reproducible development setup | Pinned dependencies in `backend/requirements.txt` and `backend/main.py`. | Verified via successful pytest suite execution. | **COMPLETE** | Requires Python 3.10+ (Tested on 3.11.9). |
| **Activity 2.1** | Safety image analysis (PPE compliance: helmet, vest, boots; scaffolding; proximity hazards; OSHA / BOCW rules) | `ConstructionSafetyAnalyzerCard.tsx`<br>`POST /api/v4/safety-inspection/analyze`<br>`safety_analysis_service.py` | Vitest: `ConstructionSafetyAnalyzerCard.test.tsx` (5/5 passed)<br>Pytest: `test_safety_inspection.py` | **COMPLETE** | Live multimodal vision requires `GROQ_API_KEY` or `GEMINI_API_KEY`. Operates in deterministic HSV color/edge CV mode offline. |
| **Activity 2.2** | Crack detection logic (morphology, severity, causes, repair methods, schema validation, calibrated mm aperture) | `InspectionWorkbenchPage.tsx`<br>`POST /api/v4/findings/upload`<br>`GET /api/v4/findings/{id}/analysis`<br>`image_processor.py` | Vitest: `InspectionWorkbenchPage.test.tsx` (5/5 passed)<br>Pytest: `test_milestone1.py`, `test_crack_summary.py` | **COMPLETE** | Seeded finding `FND-104` calibrated at GSD 0.8 mm/px. User uploads require calibration scale or default to pixel metrology. |
| **Activity 3.1** | Material estimation (cement, sand, aggregate, steel) & CPWD construction planning from plot inputs | `ProjectPlanningCalculator.tsx`<br>`ProjectPlanningPage.tsx`<br>`POST /api/v4/planning/generate-plan`<br>`project_planning_service.py` | Vitest: `ProjectPlanningCalculator.test.tsx` (5/5 passed)<br>Pytest: `test_project_planning.py` | **COMPLETE** | Purely deterministic calculation based on CPWD DSR thumb rules. Requires no external credentials. |
| **Activity 3.2** | Cost estimation in INR (₹) & Real Estate Valuation Engine (value range, price/sq.ft, rental yield, 5-yr CAGR) | `RealEstateValuationCard.tsx`<br>`ValuationPage.tsx`<br>`POST /api/v4/valuation/estimate`<br>`valuation_service.py` | Vitest: `RealEstateValuationCard.test.tsx` (5/5 passed)<br>Pytest: `test_real_estate_valuation.py` | **COMPLETE** | Benchmark model covering 12 Indian micro-markets. Includes mandatory statutory valuation disclaimer. |
| **Activity 3.3** | Task scheduling (week/phase breakdown) & AI Architectural Visualisation | `ArchitecturalVisualizerCard.tsx`<br>`POST /api/v4/projects/{id}/architectural-preview`<br>`architectural_visualizer_service.py` | Vitest: `ArchitecturalVisualizerCard.test.tsx` (3/3 passed)<br>Pytest: `test_visualization.py` | **COMPLETE** | Visualizer queries public FLUX endpoint with 12s timeout; falls back to structured prompt massing when offline. |
| **Activity 4.1** | Centralized multimodal AI reasoning layer (text & image handling) | `ai_provider.py`<br>`POST /api/v4/ai/reason`<br>`reasoning_service.py` | Pytest: `test_llm_factory.py`, `test_groq_provider.py` | **COMPLETE** | Activates live Groq or Gemini when environment keys are provided; falls back to deterministic rule engine offline. |
| **Activity 4.2** | Structured JSON schema enforcement (strict Pydantic models, required keys, auto-repair) | `validate_and_repair_output()` in `ai_provider.py`<br>`GET /api/v4/ai/features` | Pytest: `test_milestone4.py` | **COMPLETE** | Enforced across all 13 backend routers via Pydantic v2 schemas. |
| **Activity 4.3** | Context-aware reasoning guidelines (distinct instructions for safety, cracks, planning, chatbot) | `FEATURE_REASONING_GUIDELINES` in `ai_provider.py` | Pytest: `test_llm_factory.py` | **COMPLETE** | Hardcoded typed guidance dictionaries prevent cross-domain prompt pollution. |
| **Activity 5.1** | Construction chatbot (domain grounding, technical Q&A, source document citation, fallback) | `SiteAssistantPage.tsx` (Chat tab)<br>`POST /api/v4/projects/{id}/assistant/query`<br>`retrieval.py` | Vitest: `SiteAssistantPage.test.tsx` (6/6 passed)<br>Pytest: `test_grounded_rag.py`, `test_milestone2.py` | **COMPLETE** | Grounded in SQLite passage chunks. Enforces direct `[DOC-N]` citations. Rejects ungrounded queries. |
| **Activity 5.2** | Daily site assistant (inputs: activity, labour, weather; outputs: tasks, materials, risk alerts) | `DailySiteBriefingCard.tsx`<br>`GET /api/v4/projects/{id}/assistant/daily-briefing`<br>`daily_briefing_service.py` | Vitest: `DailySiteBriefingCard.test.tsx` (5/5 passed)<br>Pytest: `test_daily_briefing.py` | **COMPLETE** | Synthesizes project findings, milestones, and live weather telemetry. |
| **Activity 5.3** | Weather-aware advisory (GO/NO-GO recommendation, wind/rain/temp limits, Open-Meteo API) | `WeatherAdvisoryCard.tsx`<br>`GET /api/v4/projects/{id}/weather/advisory`<br>`weather_service.py` | Vitest: `WeatherAdvisoryCard.test.tsx` (4/4 passed)<br>Pytest: `test_weather_advisory.py` | **COMPLETE** | Live Open-Meteo REST API queries for site coordinates. Graceful offline fallback to IRC:112 regional microclimate. |
| **Activity 6.1** | End-to-end interface integration (React + FastAPI, loading/error states, form validation) | All frontend pages in `frontend/src/pages/`<br>All backend routers in `backend/routers/` | Vitest: 8 test files, 38/38 passed<br>Interactive browser subagent audit verified all routes. | **COMPLETE** | Cross-stack contract verified with HTTP 200 responses across all endpoints. |
| **Activity 6.2** | System validation & edge-case testing (partial uploads, missing fields, numerical consistency) | Form validators across all input cards<br>Pydantic request models | Pytest: 140/140 passed across 15 suites<br>Vitest error boundary & rejection tests. | **COMPLETE** | Missing inputs yield descriptive 422/400 validation responses, not unhandled 500 exceptions. |
| **Activity 6.3** | Deployment readiness & documentation (turnkey startup scripts, build verification, evaluation guide) | `start.ps1`, `start.bat`<br>`report/FINAL_SUBMISSION_EVALUATION_GUIDE.md`<br>`report/FINAL_DEMO_SCREENSHOT_PLAN.md` | Successful Vite production build (`dist/`)<br>Verified startup scripts. | **COMPLETE** | Scripts verify prerequisites, check port conflicts, and launch servers concurrently. |

---

## Section D: Prerequisites and Installation (Windows 10/11)

### 1. Verified Software Prerequisites
- **Operating System:** Windows 10 (64-bit) or Windows 11.
- **Python:** Python 3.10 to 3.12 (Tested on Python 3.11.9). Must be added to the system `PATH`.
- **Node.js:** Node.js v18.0.0 or higher (Tested on Node.js v20+ / NPM v10+).
- **Git:** Git for Windows (Tested on Git 2.45+).

### 2. Step-by-Step Repository Setup

#### Step 1: Open PowerShell as Standard User
Open PowerShell in the workspace root directory `C:\sitewise`:
```powershell
cd C:\sitewise
```

#### Step 2: Backend Python Setup
Verify Python installation and install dependencies:
```powershell
cd C:\sitewise\backend
python --version
pip install -r requirements.txt
```
*Note: If using a virtual environment (optional but supported):*
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

#### Step 3: Frontend Node.js Setup
Install Node dependencies in the `frontend` directory:
```powershell
cd C:\sitewise\frontend
npm install
```

#### Step 4: Environment Variables Configuration
The application is pre-configured to run out of the box in deterministic offline mode. If live external AI reasoning is desired, configure `C:\sitewise\backend\.env`:
```env
# Optional External AI API Keys (Leave blank for deterministic offline fallback)
GROQ_API_KEY=YOUR_GROQ_API_KEY_HERE
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Server Ports
PORT=8000
HOST=127.0.0.1
```
> [!IMPORTANT]
> Never commit `.env` files containing real API keys to version control. The repository `.gitignore` excludes `.env` by default.

---

## Section E: Running the Application

### 1. Unified Turnkey Launch (Recommended)
From `C:\sitewise`, run the verified PowerShell launcher:
```powershell
.\start.ps1
```
*Alternatively, double-click or run `start.bat` from Windows Command Prompt.*

**What the startup script executes automatically:**
1. Verifies that Python, Node.js, and NPM are installed.
2. Checks that port 8000 (Backend) and port 5173 (Frontend) are available.
3. Automatically launches the FastAPI backend on `http://127.0.0.1:8000`.
4. Automatically launches the Vite development server on `http://127.0.0.1:5173`.
5. Opens the default browser to `http://localhost:5173`.

### 2. Manual Startup Procedure (Two Separate Terminals)

If running in separate terminals for debugging:

**Terminal 1 — Backend:**
```powershell
cd C:\sitewise\backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
*Expected output: `INFO: Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)`*

**Terminal 2 — Frontend:**
```powershell
cd C:\sitewise\frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
*Expected output: `VITE v8.3.4 ready in ~700 ms -> Local: http://127.0.0.1:5173/`*

### 3. Pre-Flight Health Check Commands
Verify that both services are healthy:

```powershell
# Check Backend Health API
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v4/health"

# Check Live Site Weather API
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v4/projects/PRJ-NH48-PKG3/weather/current"

# Check Project Document Store
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v4/projects/PRJ-NH48-PKG3/documents"
```

### 4. Stopping the Application Safely
- Press `Ctrl + C` in the PowerShell/terminal window.
- If launched via `start.ps1`, the script traps exit signals and terminates both background jobs cleanly.

---

## Section F: Evaluator Demonstration Script (8–12 Minutes)

This demonstration plan walks an evaluator through all core capabilities, demonstrating genuine features, deterministic calculations, and explicit data provenance without relying on external cloud credentials.

| Step | Time | View / Route | Action to Perform | Observable Behaviour | Engineering Competency Demonstrated | Evaluator Caveat / Provenance Note |
| :---: | :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | 0:00–1:30 | **Overview Dashboard**<br>`/overview` | 1. Observe context bar (PKG-3 Elevated Viaduct, Ch. 14+200 → 18+600).<br>2. Inspect live Weather Advisory card.<br>3. Toggle activity dropdown between *Structural Concrete Pouring* and *Crane Gantry Launching*. | Advisory updates instantly. Concreting shows GO/CAUTION based on live temperature/rain. Crane launching shows wind threshold rule (<30 km/h). | **Activity 5.3:** Dynamic meteorological safety evaluation against Indian standards. | Live weather is fetched via Open-Meteo REST API. If offline, uses regional historical microclimate. |
| **2** | 1:30–3:00 | **Inspection Workbench**<br>`/inspections` | 1. Open finding `FND-104` (Pier Cap 18 Crack).<br>2. Observe calibrated aperture: `0.35 mm` vs IRC:112 limit `0.20 mm` (75% exceedance).<br>3. Review NDT table (UPV: 3,850 m/s linked to `DOC-5442BA12E9`).<br>4. Enter reviewer disposition notes and click Submit. | Telemetry displays mm metrology calculated from GSD (0.8 mm/px). Mandatory notes validation blocks blank review submissions. | **Activity 2.2 & 1.2:** Calibrated crack metrology, limit-state verification, and disposition governance. | Seeded finding `FND-104` is a calibrated benchmark dataset. User uploads require millimeter scaling. |
| **3** | 3:00–4:30 | **Evidence Graph & Causal DAG**<br>`/evidence-graph` | 1. Observe 5-tier causal graph: Evidence (`N-SRC-001`) → Finding (`N-AI-001`) → Risk (`N-RSK-042`) → CPM Slip (`N-CPM-001`) → Mitigation (`N-MIT-001`).<br>2. Click node `N-AI-001`. | Inspector sidebar slides open showing governing code limits (IRC:112 Cl. 12.3) and linked QA document citations. | **Activity 5.1 & Graph:** Graph-structured traceability linking field evidence to financial exposure. | Graph links represent deterministic topological relations seeded for Package 3. |
| **4** | 4:30–6:00 | **Safety Inspection Analyzer**<br>`/safety-inspection` | 1. Review statutory compliance banner (BOCW Act 1996 / OSHA).<br>2. Upload site photo or click sample image.<br>3. Run safety evaluation. | Safety card outputs structured hazard checklist: helmet compliance %, vest detection, fall hazards, and risk priority. | **Activity 2.1:** Vision-Language safety audit with structured Pydantic compliance schemas. | Operates in deterministic HSV color/edge CV mode offline; invokes live vision LLM when configured. |
| **5** | 6:00–7:30 | **Civil Planning & Material Takeoff**<br>`/project-planning` | 1. Select preset *Standard G+3 Commercial/Residential*.<br>2. Change plot width to 40 ft and length to 60 ft (2,400 sq.ft).<br>3. Click *Generate Engineering Plan*. | Calculates exact quantities: Cement (bags), Sand (cu.ft), Aggregate (cu.ft), and Steel (MT) with itemized INR cost heads. | **Activity 3.1 & 3.3:** CPWD DSR thumb-rule takeoff calculation with phase-wise scheduling. | Purely deterministic calculation based on CPWD thumb rules with visible multipliers. |
| **6** | 7:30–9:00 | **Real Estate Valuation Engine**<br>`/valuation` | 1. Select location *Gurugram (Golf Course Extension)*.<br>2. Set Area to 1,850 sq.ft, Age to 3 years.<br>3. Check amenities (Gated Security, Power Backup, Clubhouse).<br>4. Observe calculated value, rate/sq.ft, rental yield %, and 5-yr CAGR. | Displays valuation range (₹1.72 Cr – ₹2.02 Cr), gross rental yield (3.8%), and capital gain with full statutory disclaimer. | **Activity 3.2:** Indian micro-market valuation model with age depreciation and transit multipliers. | Indicative algorithmic estimate based on market comps; does not constitute a certified RICS appraisal. |
| **7** | 9:00–10:30 | **What-If Parametric Simulator**<br>`/simulator` | 1. Move *Aperture Exceedance* slider to 120%.<br>2. Adjust *Grouting SLA* to 48 hours.<br>3. Observe real-time sensitivity curve updating critical path slip and exposure. | Non-linear parametric curve updates dynamically. Evaluates schedule compression feasibility. | **Activity 5.3 Simulator:** Non-linear mathematical modeling of remediation scenarios. | Sensitivity equations are parametric models with stated engineering assumptions. |
| **8** | 10:30–12:00 | **Grounded RAG Assistant**<br>`/assistant` | 1. Observe provider badge (`Lexical Retrieval Active • Grounded Corpus` or `Live RAG Active`).<br>2. Click suggested chip: *"What is the permissible crack width under IRC:112?"*<br>3. Inspect answer and direct citation `[DOC-57F675F71F]`.<br>4. Switch tab to *Daily Site Briefing*. | Assistant answers strictly using ingested passage chunks with source badges. Daily briefing synthesizes tasks and weather risks. | **Activity 5.1 & 5.2:** Grounded document intelligence avoiding hallucinations, plus daily action plan. | In offline mode, uses lexical TF-IDF retrieval. Does not invent ungrounded facts. |

---

## Section G: Data Authenticity, Provenance, and Limitations

To maintain absolute academic and professional integrity, every data entity in SITEWISE V4.2 is governed by the following provenance rules:

| Category | Real Implementation Mechanism | Displayed Provenance Badge | Evaluator Transparency Statement |
| :--- | :--- | :--- | :--- |
| **Site Weather Observations** | Live HTTP query to Open-Meteo REST API for latitude/longitude coordinates. | `SOURCE_VERIFIED` (`Open-Meteo Meteorological API`) | Real meteorological telemetry when online. Falls back to regional historical microclimate baseline if network is disconnected. |
| **Project Baseline Profile** | Seeded in SQLite database (`PRJ-NH48-PKG3`, NH-48 Elevated Corridor, Package 3). | `BASELINE PROJECT` / `PARAMETRIC CPM MODEL` | Calibrated engineering baseline representing an elevated viaduct corridor. Demonstrates system capability without fabricating live telemetry. |
| **Crack Metrology** | Deterministic GSD calculation (pixel-to-millimeter transform) using calibrated 0.8 mm/px ratio. | `CALIBRATION TARGET` (`BENCHMARK DATASET`) | Pre-loaded finding `FND-104` is a calibrated benchmark dataset. User-uploaded field photos require physical scale targets or operate in pixel metrology. |
| **Rebar Reconciliation & Claims** | Calibrated contractual ledger representing CPWD Clause 42 and FIDIC 8.4 dispute records. | `ILLUSTRATIVE BASELINE` (`Representative reconciliation values`) | Calibrated illustrative records for Package 3. Not verified physical mill test certificates. |
| **Material Takeoffs** | Deterministic CPWD DSR 2021 thumb-rule mathematical equations. | `CALCULATED` (`CPWD DSR FORMULAS`) | Derived directly from user plot inputs. Assumptions and consumption ratios are fully visible and auditable. |
| **Property Valuation** | Benchmark rate multipliers across 12 Indian micro-markets with age and amenity adjustments. | `AI_INFERRED` (`INDIAN MARKET COMPS`) | Algorithmic market comp estimate. Accompanied by mandatory statutory appraisal disclaimers. |
| **Document RAG Answers** | TF-IDF lexical retrieval over ingested SQLite text chunks with strict `[DOC-N]` passage matching. | `GROUNDED DOCUMENT RAG` (`SOURCE_VERIFIED`) | Strict citation grounding. If evidence is insufficient, the system explicitly reports lack of evidence rather than hallucinating. |
| **IoT Hardware Sensors** | Unconfigured database records representing physical inclinometers and strain gauges. | `NO_GATEWAY_LINKED` (Alert state) | Honestly indicates that physical IoT telemetry gateways are unlinked, with configuration actions provided in Settings. |

---

## Section H: Automated Testing and Verification

### 1. Test Execution Commands

```powershell
# Run Complete Frontend Vitest Suite (8 suites, 38 tests)
cd C:\sitewise\frontend
npm run test

# Run Complete Backend Pytest Suite (15 suites, 140 tests)
cd C:\sitewise\backend
python -m pytest -q

# Run Complete Frontend Production Bundle Build
cd C:\sitewise\frontend
npm run build
```

### 2. Actual Verified Test Results

#### Frontend Vitest Results:
```
 Test Files  8 passed (8)
      Tests  38 passed (38)
   Duration  4.54s
```
- `ArchitecturalVisualizerCard.test.tsx`: 3/3 passed (mount, controls, prompt compiler)
- `ConstructionSafetyAnalyzerCard.test.tsx`: 5/5 passed (idle state, upload, checklist, fallback, BOCW disclaimer)
- `DailySiteBriefingCard.test.tsx`: 5/5 passed (form controls, weather synthesis, action plan, inspection links)
- `InspectionWorkbenchPage.test.tsx`: 5/5 passed (telemetry, IRC:112 exceedance, NDT table, disposition validation)
- `ProjectPlanningCalculator.test.tsx`: 5/5 passed (inputs, plot presets, CPWD takeoff calculation, cost heads)
- `RealEstateValuationCard.test.tsx`: 5/5 passed (micro-markets, amenity toggles, ₹/sq.ft, 5-yr CAGR, disclaimer)
- `SiteAssistantPage.test.tsx`: 6/6 passed (grounded RAG, prompt chips, scope filtering, empty input rejection, briefing switch)
- `WeatherAdvisoryCard.test.tsx`: 4/4 passed (telemetry, activity evaluation, threshold rules, simulator trigger)

#### Backend Pytest Results:
```
140 passed, 1 warning in 45.91s
```
- Covers CV crack algorithms, daily briefing inputs/outputs, LLM factory, Groq provider mocking, milestone routes 1–6, evidence graphs, grounded RAG citations, multi-image metrology, project planning logic, valuation math, and offline diagnostic utilities.

#### Frontend Production Build Results:
```
vite v8.3.4 building client environment for production...
✓ 1950 modules transformed.
dist/index.html                   0.90 kB │ gzip:   0.48 kB
dist/assets/index-Ds5yW8c1.css   62.20 kB │ gzip:  10.62 kB
dist/assets/index-BOgxmdMP.js   601.48 kB │ gzip: 147.44 kB
✓ built in 917ms
```
Exit code: **0 (Clean Build)**.

---

## Section I: Troubleshooting and Edge Cases

| Symptom / Error | Root Cause | Exact Verified Resolution |
| :--- | :--- | :--- |
| **Port 8000 already in use** | A previous Python or Uvicorn process did not terminate. | Run in PowerShell:<br>`Get-Process python -ErrorAction SilentlyContinue \| Stop-Process -Force` |
| **Port 5173 already in use** | A previous Vite dev server is still listening. | Run in PowerShell:<br>`Get-Process node -ErrorAction SilentlyContinue \| Stop-Process -Force` |
| **`python: command not found`** | Python is installed but not added to the system `PATH`. | Ensure Python 3.10+ is added to the Windows environment `PATH`, or launch via `py -m uvicorn main:app`. |
| **Backend `HTTP 404` on `/api/health`** | The correct health endpoint prefix in SITEWISE V4.2 is `/api/v4/health`. | Query `http://127.0.0.1:8000/api/v4/health` as documented. |
| **Assistant shows `No Live AI Key` warning** | Neither `GROQ_API_KEY` nor `GEMINI_API_KEY` is configured in `backend/.env`. | **Normal behaviour:** The system automatically operates in grounded lexical retrieval mode. Enter a Groq or Gemini key in `backend/.env` only if live LLM generation is desired. |
| **Weather card shows `Historical Baseline`** | Machine is disconnected from the internet or Open-Meteo is unreachable. | **Normal behaviour:** The application automatically falls back to the regional IRC:112 microclimate baseline. Connect to high-speed internet to re-enable live Open-Meteo queries. |
| **`sitewise.db` locked or corrupted** | An ungraceful shutdown occurred during an active write transaction. | Stop both servers, delete `C:\sitewise\backend\sitewise.db`, and restart via `.\start.ps1`. The database will automatically recreate and re-seed clean baseline records. |

---

## Section J: Submission Verification Checklist

- [x] **Repository Integrity:** Clean Git working tree on branch `master` at commit `5be917b`.
- [x] **Turnkey Startup:** Tested and verified launcher scripts `start.ps1` and `start.bat`.
- [x] **Backend Health Check:** Verified `GET /api/v4/health` returns HTTP 200 OK (`version 4.2.0`).
- [x] **Frontend Accessibility:** Verified Vite dev server serves SPA on `http://127.0.0.1:5173`.
- [x] **Core Smoke Tests:** Visually and functionally inspected all 11 routes via automated browser subagent.
- [x] **Automated Frontend Tests:** 8 test files, 38/38 Vitest tests passed (4.54s).
- [x] **Automated Backend Tests:** 15 test suites, 140/140 pytest tests passed (45.91s).
- [x] **Production Bundle Build:** Verified `tsc && vite build` completes with exit code 0.
- [x] **Data Provenance Compliance:** Removed all prototype banners; calibrated all illustrative labels and disclaimers.
- [x] **Security & Secret Scrubbing:** Confirmed zero hardcoded API keys, tokens, or credentials in codebase or documentation.
- [x] **Demonstration Readiness:** Practical 8–12 minute demonstration script with offline fallbacks fully prepared.
