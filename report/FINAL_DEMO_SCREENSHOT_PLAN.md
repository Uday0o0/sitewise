# SITEWISE V4.2 — Final Demonstration Screenshot Capture Plan

**Target Repository:** `C:\sitewise`  
**Document Location:** `report/FINAL_DEMO_SCREENSHOT_PLAN.md`  
**Current Date:** October 24, 2026  
**Evaluation Baseline:** Commit `5be917b` | Branch: `master`  
**Purpose:** Provide evaluators with an itemized, reproducible screenshot verification plan proving real execution and visual fidelity across all required modules.

---

## 1. Summary of Screenshot Portfolio

This portfolio specifies 12 high-impact screenshots covering desktop (1280×800) and mobile (390×844) viewports. Each screenshot validates an explicit requirement from the Skill Wallet assignment specification.

| # | Filename Target | Route / View | Target Viewport | Key Feature / Requirement Proven | Capture Status |
| :-: | :--- | :--- | :--- | :--- | :-: |
| **01** | `01_overview_dashboard_desktop.png` | `/overview` | Desktop (1280×800) | Activity 5.3: Live Weather Advisory & Sub-header Context Bar | **VERIFIED VIA BROWSER SUBAGENT** |
| **02** | `02_overview_mobile.png` | `/overview` | Mobile (390×844) | Activity 6.1: Responsive UI Stacking without Horizontal Clipping | **VERIFIED VIA BROWSER SUBAGENT** |
| **03** | `03_inspection_workbench_crack_metrology.png` | `/inspections` | Desktop (1280×800) | Activity 2.2: Optical Crack Metrology, Aperture (0.35mm), IRC:112 Limit | **VERIFIED VIA BROWSER SUBAGENT** |
| **04** | `04_evidence_graph_causal_dag.png` | `/evidence-graph` | Desktop (1280×800) | Activity 5.1 & Graph: 5-Tier Evidence-to-Exposure Causal DAG | **VERIFIED VIA BROWSER SUBAGENT** |
| **05** | `05_construction_safety_analyzer.png` | `/safety-inspection` | Desktop (1280×800) | Activity 2.1: Vision-Language Safety Audit & BOCW Act 1996 Disclaimer | **VERIFIED VIA BROWSER SUBAGENT** |
| **06** | `06_civil_project_planning_takeoff.png` | `/project-planning` | Desktop (1280×800) | Activity 3.1: CPWD Material Takeoff (Cement, Sand, Aggregate, Steel) | **VERIFIED VIA BROWSER SUBAGENT** |
| **07** | `07_real_estate_valuation_engine.png` | `/valuation` | Desktop (1280×800) | Activity 3.2: Real Estate Valuation, Rental Yield, 5-Yr Capital CAGR | **VERIFIED VIA BROWSER SUBAGENT** |
| **08** | `08_what_if_parametric_simulator.png` | `/simulator` | Desktop (1280×800) | Activity 5.3: Parametric Sensitivity Curves & Grouting SLA Drift | **VERIFIED VIA BROWSER SUBAGENT** |
| **09** | `09_grounded_rag_assistant_desktop.png` | `/assistant` | Desktop (1280×800) | Activity 5.1: Grounded Document RAG Chatbot with `[DOC-N]` Citations | **VERIFIED VIA BROWSER SUBAGENT** |
| **10** | `10_grounded_assistant_mobile.png` | `/assistant` | Mobile (390×844) | Activity 6.1: Mobile Chat Input & Scope Selectors Accessibility | **VERIFIED VIA BROWSER SUBAGENT** |
| **11** | `11_daily_site_briefing.png` | `/assistant` (Briefing Tab) | Desktop (1280×800) | Activity 5.2: Daily Site Briefing Synthesis of Risks & Weather | **VERIFIED VIA BROWSER SUBAGENT** |
| **12** | `12_settings_and_calibration.png` | `/settings` | Desktop (1280×800) | Activity 1.2: Project Baseline Calibration & Hardware Gateway Status | **VERIFIED VIA BROWSER SUBAGENT** |

---

## 2. Detailed Screenshot Specifications

### Screenshot 01: Overview Dashboard with Live Weather Advisory
- **Route:** `http://localhost:5173/overview`
- **Viewport:** Desktop `1280 × 800`
- **Required Visible Elements:**
  1. Sub-header bar displaying `Package: PKG-3 Elevated Viaduct`, `Chainage: Ch. 14+200 → Ch. 18+600`, `Governing Code: IRC:112-2020`, and `Telemetry Pipeline: Active`.
  2. Weather Advisory card displaying live meteorological data (Temperature °C, Wind Speed km/h, Humidity %) and activity advisory badge (`GO` or `CAUTION`).
  3. Provenance badge `SOURCE_VERIFIED (Open-Meteo Meteorological API)`.
  4. KPI summary cards (Structural Risk Exposure, Active Critical Path Slip, Open Findings Count).
- **Requirement Proven:** Activity 5.3 (Weather-Aware Construction Advisory) and Activity 6.1 (Shared Context Integration).
- **Prerequisites:** Seeded SQLite database (`sitewise.db`), network access to Open-Meteo REST API (or offline historical fallback).

### Screenshot 02: Overview Dashboard Mobile Viewport
- **Route:** `http://localhost:5173/overview`
- **Viewport:** Mobile `390 × 844` (iPhone 14 / standard modern mobile viewport)
- **Required Visible Elements:**
  1. Responsive single-column vertical card stacking.
  2. Absence of horizontal scrollbar or clipped text.
  3. Visible KPI metrics and stacked Weather Advisory card.
- **Requirement Proven:** Activity 6.1 (Responsive Layout & Mobile Usability).
- **Prerequisites:** Running frontend server.

### Screenshot 03: Inspection Workbench Crack Metrology
- **Route:** `http://localhost:5173/inspections`
- **Viewport:** Desktop `1280 × 800`
- **Required Visible Elements:**
  1. Finding selector with `FND-104: Pier Cap 18 Crack — Transverse Propagation`.
  2. Calibrated aperture readout: `0.35 mm ± 0.05 mm` vs IRC:112 permissible limit `0.20 mm` (`75% Exceedance`).
  3. High-resolution orthomosaic canvas with crack polygon annotation.
  4. NDT table showing UPV velocity reading `3,850 m/s` linked to QA Report `DOC-5442BA12E9`.
  5. Mandatory reviewer disposition input box.
- **Requirement Proven:** Activity 2.2 (Crack Detection & Metrology Logic) and Activity 1.2 (IRC:112 Limit-State Verification).
- **Prerequisites:** Seeded database (`FND-104`, `DOC-5442BA12E9`).

### Screenshot 04: Evidence Graph & Causal DAG
- **Route:** `http://localhost:5173/evidence-graph`
- **Viewport:** Desktop `1280 × 800`
- **Required Visible Elements:**
  1. Interactive 5-tier SVG DAG: Evidence (`N-SRC-001`) → AI Finding (`N-AI-001`) → Contract Risk (`N-RSK-042`) → Critical Path Slip (`N-CPM-001`) → Mitigation Action (`N-MIT-001`).
  2. Inspector sidebar showing governing code limit comparison (IRC:112 Cl. 12.3 vs IS:456).
  3. Direct download/view link to source document `DOC-57F675F71F`.
- **Requirement Proven:** Activity 5.1 (Graph Grounding & Evidence Traceability).
- **Prerequisites:** Seeded SQLite database (`graphs.py`).

### Screenshot 05: Construction Safety Vision Analyzer
- **Route:** `http://localhost:5173/safety-inspection`
- **Viewport:** Desktop `1280 × 800`
- **Required Visible Elements:**
  1. Prominent statutory safety disclaimer referencing Building and Other Construction Workers (BOCW) Act 1996 and OSHA regulations.
  2. Image upload area with sample safety photos.
  3. Evaluated hazard checklist: Hardhat compliance %, high-visibility vest detection, and scaffolding fall arrest compliance.
- **Requirement Proven:** Activity 2.1 (Safety Image Analysis & PPE Monitoring).
- **Prerequisites:** Running backend `safety_inspection.py`.

### Screenshot 06: Civil Project Planning & Material Takeoff
- **Route:** `http://localhost:5173/project-planning`
- **Viewport:** Desktop `1280 × 800`
- **Required Visible Elements:**
  1. Plot dimension form (Plot Width, Length, Floor Count, Construction Typology, City).
  2. Calculated material estimates table: Cement (bags), Sand (cu.ft), Aggregate (cu.ft), Structural Steel (MT).
  3. Itemized cost breakdown (Substructure, Superstructure, Finishing, MEP).
  4. Provenance badge `CALCULATED (CPWD DSR FORMULAS)`.
- **Requirement Proven:** Activity 3.1 (Material Takeoff Estimation) and Activity 3.3 (Task Scheduling Breakdown).
- **Prerequisites:** Deterministic CPWD engine (`project_planning_service.py`).

### Screenshot 07: Real Estate Valuation Engine
- **Route:** `http://localhost:5173/valuation`
- **Viewport:** Desktop `1280 × 800`
- **Required Visible Elements:**
  1. Micro-market selector (e.g. *Gurugram - Golf Course Extension*).
  2. Evaluated market rate range (₹/sq.ft) and estimated total capital value (₹ Cr).
  3. Rental yield potential (Monthly rent ₹, Annual gross yield %).
  4. 5-Year capital appreciation projection (CAGR %).
  5. Mandatory valuation disclaimer (Non-statutory indicative estimate).
- **Requirement Proven:** Activity 3.2 (Cost Estimation in INR & Real Estate Valuation).
- **Prerequisites:** Benchmark valuation engine (`valuation_service.py`).

### Screenshot 08: What-If Parametric Simulator
- **Route:** `http://localhost:5173/simulator`
- **Viewport:** Desktop `1280 × 800`
- **Required Visible Elements:**
  1. Parameter sliders: Crack Aperture Exceedance %, Grouting Remediation SLA (hours), Fast-Track CFRP Cure Speed.
  2. Dynamic non-linear sensitivity curve plotting recovery days vs financial exposure.
  3. Provenance badge `CALCULATED (PARAMETRIC WHAT-IF ENGINE)`.
- **Requirement Proven:** Activity 5.3 (Simulation & What-If Scenario Analysis).
- **Prerequisites:** Parametric simulation engine (`simulator_service.py`).

### Screenshot 09: Grounded RAG Assistant (Chatbot)
- **Route:** `http://localhost:5173/assistant`
- **Viewport:** Desktop `1280 × 800`
- **Required Visible Elements:**
  1. Document scope selector (`All Project Documents`).
  2. Provider badge indicating active status (`Lexical Retrieval Active` or `Live RAG Active`).
  3. Answer bubble displaying direct passage citation `[DOC-57F675F71F]` referencing IRC:112-2020 Clause 12.3.
  4. Sample technical inquiry prompt chips.
- **Requirement Proven:** Activity 5.1 (Construction Knowledge Assistance Chatbot & Grounded RAG).
- **Prerequisites:** Seeded document passages in SQLite (`retrieval.py`).

### Screenshot 10: Grounded Assistant Mobile Viewport
- **Route:** `http://localhost:5173/assistant`
- **Viewport:** Mobile `390 × 844`
- **Required Visible Elements:**
  1. Compact header with tab switch (*Grounded RAG Assistant* vs *Daily Site Briefing*).
  2. Clean chat thread formatting without horizontal clipping.
  3. Pinned bottom query input box and send button.
- **Requirement Proven:** Activity 6.1 (Mobile Cross-Device Responsiveness).
- **Prerequisites:** Running frontend server.

### Screenshot 11: Daily Site Briefing
- **Route:** `http://localhost:5173/assistant` (Tab: *Daily Site Briefing*)
- **Viewport:** Desktop `1280 × 800`
- **Required Visible Elements:**
  1. Project Activity selector (e.g. *Pier Cap Concreting & Segment Launch*).
  2. Synthesized daily action plan combining active weather risks, open critical findings (`FND-104`), and safety checklists.
  3. Quick-action links navigating directly to the Inspection Workbench.
- **Requirement Proven:** Activity 5.2 (Daily Site Assistant).
- **Prerequisites:** Daily briefing synthesizer (`daily_briefing_service.py`).

### Screenshot 12: Project Settings & Hardware Gateway Status
- **Route:** `http://localhost:5173/settings`
- **Viewport:** Desktop `1280 × 800`
- **Required Visible Elements:**
  1. Primavera P6 Schedule Baseline Lock status (`LOCKED • Certified P6 Schedule Baseline`).
  2. IRC:112-2020 Limit State Threshold settings (`0.20 mm severe exposure`).
  3. Hardware IoT Gateway alerts (`NO_GATEWAY_LINKED`) for Biaxial Inclinometer and Strain Gauge Cluster with direct configuration actions.
- **Requirement Proven:** Activity 1.2 (System Calibration & Operational Boundaries).
- **Prerequisites:** Seeded sensors table in SQLite.

---

## 3. Manual Screenshot Capture Instructions

If taking manual screenshots on Windows:

1. Launch the application:
   ```powershell
   cd C:\sitewise
   .\start.ps1
   ```
2. Open Microsoft Edge or Google Chrome to `http://localhost:5173`.
3. Press `F12` to open Developer Tools.
4. Press `Ctrl + Shift + M` to toggle the Device Toolbar.
5. Set the dimensions to `1280 × 800` for desktop views or `390 × 844` for mobile views.
6. Press `Ctrl + Shift + P`, type `Capture full size screenshot` (or `Capture screenshot`), and press `Enter`.
7. Save the resulting image to `report/screenshots/<filename>.png` corresponding to the item number in the table above.
