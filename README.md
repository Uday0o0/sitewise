# SITEWISE — Construction Intelligence & Decision-Support Platform

SITEWISE is a full-stack construction intelligence platform designed to support project managers, structural inspection engineers, and quantity surveyors with evidence-backed decision support, automated visual defect analysis, standards-grounded safety monitoring, CPWD civil planning, property valuation, and meteorological advisory.

---

## Live Deployments

- **Live Application (Frontend)**: [https://sitewise-wheat.vercel.app/overview](https://sitewise-wheat.vercel.app/overview)
- **Production API (Backend)**: [https://sitewise-21jo.onrender.com](https://sitewise-21jo.onrender.com)
- **Interactive API Documentation (Swagger)**: [https://sitewise-21jo.onrender.com/docs](https://sitewise-21jo.onrender.com/docs)

---

## System Architecture

The platform follows a decoupled, resilient architecture:
- **Backend**: FastAPI (Python 3.11+), SQLAlchemy 2.0 (Async/SQLite), Pydantic v2 schemas, OpenCV/Pillow computer vision, Groq Cloud / Google Gemini LLM/VLM reasoning, and Open-Meteo meteorological API.
- **Frontend**: React 19 + TypeScript, Vite, TailwindCSS design tokens, Lucide icons, interactive canvas & graph views.
- **Data Persistence**: Local SQLite database (`sitewise.db`), supporting non-destructive restarts, file upload storage keys, and automatic graph synchronization.

---

## Key Modules & Feature Traceability

| Epic | Activity | Module Name | Description & Capabilities | Route / Endpoint |
|---|---|---|---|---|
| **Epic 1** | 1.1–1.3 | **Core Platform** | Project telemetry, health checks, evidence centre, and data provenance badges | `/overview`, `/evidence` |
| **Epic 2** | 2.1 | **Safety Inspection** | PPE compliance (IS 2925/15809), worker hazard proximity, elevated scaffolding, and OSHA 1926 standards | `/safety-inspection`<br>`POST /api/v4/safety-inspection/analyze` |
| **Epic 2** | 2.2 | **Defect Detection** | Concrete crack morphology, black-hat segmentation, pixel apertures, GSD calibration, and NCR dispositions | `/inspections`<br>`POST /api/v4/findings/{id}/analyze` |
| **Epic 3** | 3.1 | **Civil Planning** | CPWD DSR civil takeoff (cement, steel, sand, aggregate, bricks), INR cost breakdown, city index, and 5-phase schedule | `/project-planning`<br>`POST /api/v4/projects/{id}/planning-estimate` |
| **Epic 3** | 3.2 | **Property Valuation** | Micro-market comps (Gurugram, Mumbai, etc.), age depreciation, amenities adjustment, rental yield, and 5-year appreciation | `/valuation`<br>`POST /api/v4/projects/{id}/valuation-estimate` |
| **Epic 3** | 3.3 | **Architectural Visualiser**| 3D massing concept generation with building typologies, sustainability features, daylight conditions, and legal disclaimers | `/project-planning` (Visualisation Tab)<br>`POST /api/v4/projects/{id}/architectural-preview` |
| **Epic 4** | 4.1–4.3 | **Reasoning Engine** | Typed feature handlers (`SAFETY_MONITORING`, `CRACK_DETECTION`, `PLANNING_VALUATION`, `ADVISORY_CHATBOT`), domain reasoning rules, and schema enforcement | `/api/v4/ai/reason`<br>`/api/v4/ai/features` |
| **Epic 5** | 5.1 | **Technical Assistant** | Ingested document passage retrieval with lexical search and grounded citations (`[DOC-N]`) | `/assistant` |
| **Epic 5** | 5.2 | **Daily Site Briefing** | Daily shift briefing synthesizing open findings, milestone slips, claims, workforce count, and live weather into structured checklists | `/assistant` (Daily Briefing Tab)<br>`GET /api/v4/projects/{id}/daily-briefing` |
| **Epic 5** | 5.3 | **Weather Advisory** | Live meteorological telemetry (Open-Meteo), activity safety thresholds (IS 456, IRC 112, 38 km/h wind limits), and What-If simulator | `/overview` (Weather Card)<br>`GET /api/v4/projects/{id}/weather/advisory` |

---

## Reproducible Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ (with npm)
- Git

### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment (optional but recommended)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Copy .env.example to .env and configure API keys
cp ../.env.example .env

# Run FastAPI development server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at: `http://localhost:8000/docs`.

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
Web application will be accessible at: `http://localhost:5173`.

---

## Testing & Quality Assurance

### Run Full Backend Test Suite
From the repository root (`C:\sitewise`):
```bash
python -m pytest backend/ -v
```
All unit, API, and regression suites run deterministically in isolated test environments.

### Verify Frontend TypeScript & Production Build
```bash
cd frontend
npm run build
```

---

## Data Integrity & Provenance Disclosures

1. **Non-Fabrication Policy**: Missing visual detections or offline providers are never represented as proof that a worksite is safe.
2. **Provenance Labels**:
   - `SOURCE_VERIFIED`: Directly grounded in ingested project documents or official standards clauses.
   - `CALCULATED`: Deterministically computed using CPWD norms, OpenCV algorithms, or geometric formulas.
   - `AI_INFERRED`: Generated by language or vision-language models following strict reasoning guidelines.
   - `SYNTHETIC_DEMO`: Benchmarked demo data or offline fallback records.
   - `USER_PROVIDED_UNVERIFIED`: Calibration or scenario parameters entered by users without physical tactile verification.
3. **Legal Disclaimer**: Automated visual screening, planning calculations, and real-estate valuations are decision-support aids and do not replace certified civil engineering, tactile crack-gauge readings, or licensed structural inspections.
