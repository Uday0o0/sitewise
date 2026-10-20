"""Construction Project Planning Logic service for SITEWISE (Activity 3.1).

Accepts plot dimensions, construction type, and location, and generates:
1. Transparent material estimates (cement, sand, aggregate, structural steel).
2. Itemized INR cost breakdown per standard Indian construction engineering thumb rules (CPWD DSR).
3. Week-wise and phase-wise construction task schedule.
4. Explicit disclosure of assumptions, multipliers, and provenance.
"""

from __future__ import annotations
import math
import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field

ConstructionType = Literal[
    "RESIDENTIAL_STANDARD",
    "RESIDENTIAL_PREMIUM",
    "COMMERCIAL_OFFICE",
    "INFRASTRUCTURE_BRIDGE",
    "INDUSTRIAL_WAREHOUSE",
]

LocationCity = Literal[
    "Delhi NCR",
    "Gurugram",
    "Mumbai",
    "Bengaluru",
    "Pune",
    "Hyderabad",
    "Chennai",
    "Tier-2 City",
]


class MaterialItem(BaseModel):
    material_code: str
    material_name: str
    quantity: float
    unit: str
    consumption_ratio_description: str
    estimated_rate_inr: float
    estimated_cost_inr: float
    standard_reference: str
    provenance: Literal["CALCULATED", "AI_INFERRED"]


class CostHeadItem(BaseModel):
    category: str
    description: str
    cost_inr: float
    cost_inr_lakhs: float
    percentage_of_total: float
    cost_per_sqft_inr: float


class SchedulePhase(BaseModel):
    phase_number: int
    phase_name: str
    start_week: int
    end_week: int
    duration_weeks: int
    key_milestones: list[str]
    critical_trade: str
    deliverables: str


class ProjectPlanningRequest(BaseModel):
    plot_length_ft: Optional[float] = Field(None, gt=0, le=10000, description="Plot length in feet")
    plot_width_ft: Optional[float] = Field(None, gt=0, le=10000, description="Plot width in feet")
    plot_area_sqft: Optional[float] = Field(None, gt=0, le=500000, description="Explicit plot area in sq.ft")
    floors: int = Field(default=2, ge=1, le=100, description="Number of stories / floors")
    ground_coverage_percent: float = Field(default=70.0, ge=20.0, le=100.0, description="Ground coverage percentage")
    construction_type: ConstructionType = Field(default="RESIDENTIAL_STANDARD", description="Building typology")
    location_city: str = Field(default="Gurugram", description="Target city for rate benchmarks")
    project_id: Optional[str] = Field(default="PRJ-NH48-PKG3", description="Associated project identifier")


class ProjectPlanningResponse(BaseModel):
    project_id: str
    generated_at_iso: str
    input_parameters: dict
    built_up_area_sqft: float
    carpet_area_approx_sqft: float
    materials_takeoff: list[MaterialItem]
    cost_breakdown: list[CostHeadItem]
    total_estimated_cost_inr: float
    total_estimated_cost_inr_lakhs: float
    total_estimated_cost_inr_crores: float
    average_rate_per_sqft_inr: float
    phase_schedule: list[SchedulePhase]
    total_project_duration_weeks: int
    total_project_duration_months: float
    assumptions_and_sources: list[str]
    provenance: Literal["CALCULATED", "AI_INFERRED"]
    disclaimer: str


# ---------------------------------------------------------------------------
# Rate & Consumption Multipliers (CPWD / IS:456 Benchmarks)
# ---------------------------------------------------------------------------

CITY_COST_INDEX = {
    "Mumbai": 1.25,
    "Delhi NCR": 1.15,
    "Gurugram": 1.15,
    "Bengaluru": 1.12,
    "Pune": 1.10,
    "Hyderabad": 1.08,
    "Chennai": 1.08,
    "Tier-2 City": 1.00,
}

TYPOLOGY_BASE_RATE_PER_SQFT = {
    "RESIDENTIAL_STANDARD": 1950.0,
    "RESIDENTIAL_PREMIUM": 2850.0,
    "COMMERCIAL_OFFICE": 2400.0,
    "INFRASTRUCTURE_BRIDGE": 4200.0,
    "INDUSTRIAL_WAREHOUSE": 1650.0,
}

# Material consumption thumb rules per sq.ft of built-up area:
# Cement: ~0.42 bags/sq.ft (Residential), 0.50 bags/sq.ft (Commercial), 0.65 (Infrastructure)
# Steel: ~3.8 kg/sq.ft (Residential), 5.5 kg/sq.ft (Commercial), 8.5 kg/sq.ft (Infrastructure)
# Sand: ~1.85 cu.ft/sq.ft
# Aggregate: ~1.40 cu.ft/sq.ft
# Bricks: ~18 bricks/sq.ft (for standard red clay/flyash)

MATERIAL_COEFFICIENTS = {
    "RESIDENTIAL_STANDARD": {
        "cement_bags_per_sqft": 0.42,
        "steel_kg_per_sqft": 3.8,
        "sand_cuft_per_sqft": 1.85,
        "aggregate_cuft_per_sqft": 1.40,
        "bricks_units_per_sqft": 18.0,
    },
    "RESIDENTIAL_PREMIUM": {
        "cement_bags_per_sqft": 0.46,
        "steel_kg_per_sqft": 4.5,
        "sand_cuft_per_sqft": 1.95,
        "aggregate_cuft_per_sqft": 1.45,
        "bricks_units_per_sqft": 18.0,
    },
    "COMMERCIAL_OFFICE": {
        "cement_bags_per_sqft": 0.50,
        "steel_kg_per_sqft": 5.5,
        "sand_cuft_per_sqft": 2.10,
        "aggregate_cuft_per_sqft": 1.60,
        "bricks_units_per_sqft": 12.0,
    },
    "INFRASTRUCTURE_BRIDGE": {
        "cement_bags_per_sqft": 0.65,
        "steel_kg_per_sqft": 8.5,
        "sand_cuft_per_sqft": 2.40,
        "aggregate_cuft_per_sqft": 2.10,
        "bricks_units_per_sqft": 0.0,
    },
    "INDUSTRIAL_WAREHOUSE": {
        "cement_bags_per_sqft": 0.35,
        "steel_kg_per_sqft": 4.2,
        "sand_cuft_per_sqft": 1.60,
        "aggregate_cuft_per_sqft": 1.30,
        "bricks_units_per_sqft": 10.0,
    },
}

# Unit Rates in INR (Standard 2024 Market Benchmarks before city indexing)
BASE_MATERIAL_RATES = {
    "CEMENT": 390.0,        # ₹390 per 50kg bag (PPC/OPC 53)
    "STEEL": 68.0,          # ₹68 per kg (Fe550D TMT Rebars)
    "SAND": 55.0,           # ₹55 per cu.ft (Zone II washed river/M-sand)
    "AGGREGATE": 42.0,      # ₹42 per cu.ft (20mm & 10mm crushed stone)
    "BRICKS": 9.5,          # ₹9.5 per brick (Red clay / fly ash block)
}


def calculate_project_plan(req: ProjectPlanningRequest) -> ProjectPlanningResponse:
    """Execute deterministic construction planning calculations with transparent formulas."""
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"

    # 1. Determine plot area & total built-up area
    if req.plot_area_sqft is not None:
        plot_area = float(req.plot_area_sqft)
    elif req.plot_length_ft is not None and req.plot_width_ft is not None:
        plot_area = float(req.plot_length_ft * req.plot_width_ft)
    else:
        # Default fallback standard plot: 30 ft x 50 ft = 1500 sq.ft
        plot_area = 1500.0

    coverage_factor = req.ground_coverage_percent / 100.0
    ground_floor_footprint = plot_area * coverage_factor
    built_up_area = ground_floor_footprint * req.floors
    carpet_area = built_up_area * 0.78  # Standard 78% efficiency ratio

    # 2. City and typology rate adjustments
    city = req.location_city if req.location_city in CITY_COST_INDEX else "Delhi NCR"
    cost_index = CITY_COST_INDEX[city]
    base_sqft_rate = TYPOLOGY_BASE_RATE_PER_SQFT.get(req.construction_type, 1950.0)
    adjusted_sqft_rate = round(base_sqft_rate * cost_index, 2)
    total_cost_inr = round(built_up_area * adjusted_sqft_rate, 2)

    # 3. Calculate Material Takeoff
    coeffs = MATERIAL_COEFFICIENTS.get(req.construction_type, MATERIAL_COEFFICIENTS["RESIDENTIAL_STANDARD"])
    cement_qty = round(built_up_area * coeffs["cement_bags_per_sqft"], 1)
    steel_qty = round(built_up_area * coeffs["steel_kg_per_sqft"], 1)
    sand_qty = round(built_up_area * coeffs["sand_cuft_per_sqft"], 1)
    aggregate_qty = round(built_up_area * coeffs["aggregate_cuft_per_sqft"], 1)
    bricks_qty = round(built_up_area * coeffs["bricks_units_per_sqft"], 0)

    # Adjusted material unit rates
    mat_rate_cement = round(BASE_MATERIAL_RATES["CEMENT"] * cost_index, 1)
    mat_rate_steel = round(BASE_MATERIAL_RATES["STEEL"] * cost_index, 1)
    mat_rate_sand = round(BASE_MATERIAL_RATES["SAND"] * cost_index, 1)
    mat_rate_aggregate = round(BASE_MATERIAL_RATES["AGGREGATE"] * cost_index, 1)
    mat_rate_bricks = round(BASE_MATERIAL_RATES["BRICKS"] * cost_index, 1)

    materials: list[MaterialItem] = [
        MaterialItem(
            material_code="MAT-CEM",
            material_name="Ordinary Portland Cement / PPC (50kg bags)",
            quantity=cement_qty,
            unit="Bags",
            consumption_ratio_description=f"{coeffs['cement_bags_per_sqft']} bags/sq.ft of built-up area",
            estimated_rate_inr=mat_rate_cement,
            estimated_cost_inr=round(cement_qty * mat_rate_cement, 2),
            standard_reference="IS:1489 / IS:269 / CPWD DSR Item 4.1",
            provenance="CALCULATED",
        ),
        MaterialItem(
            material_code="MAT-STL",
            material_name="Fe550D Thermo-Mechanically Treated (TMT) Steel Rebars",
            quantity=steel_qty,
            unit="Kilograms (kg)",
            consumption_ratio_description=f"{coeffs['steel_kg_per_sqft']} kg/sq.ft of built-up area ({round(steel_qty/1000, 2)} MT)",
            estimated_rate_inr=mat_rate_steel,
            estimated_cost_inr=round(steel_qty * mat_rate_steel, 2),
            standard_reference="IS:1786:2008 & IRC:112:2020",
            provenance="CALCULATED",
        ),
        MaterialItem(
            material_code="MAT-SND",
            material_name="Manufactured / River Sand (Fine Aggregate, Zone II)",
            quantity=sand_qty,
            unit="Cubic Feet (cu.ft)",
            consumption_ratio_description=f"{coeffs['sand_cuft_per_sqft']} cu.ft/sq.ft of built-up area",
            estimated_rate_inr=mat_rate_sand,
            estimated_cost_inr=round(sand_qty * mat_rate_sand, 2),
            standard_reference="IS:383:2016 (Specification for Aggregates)",
            provenance="CALCULATED",
        ),
        MaterialItem(
            material_code="MAT-AGG",
            material_name="Crushed Blue Metal Aggregate (20mm & 10mm Graded)",
            quantity=aggregate_qty,
            unit="Cubic Feet (cu.ft)",
            consumption_ratio_description=f"{coeffs['aggregate_cuft_per_sqft']} cu.ft/sq.ft of built-up area",
            estimated_rate_inr=mat_rate_aggregate,
            estimated_cost_inr=round(aggregate_qty * mat_rate_aggregate, 2),
            standard_reference="IS:383:2016 & IS:456:2000 Cl. 5.3",
            provenance="CALCULATED",
        ),
    ]

    if bricks_qty > 0:
        materials.append(
            MaterialItem(
                material_code="MAT-BRK",
                material_name="Autoclaved Aerated Concrete (AAC) / Clay Bricks",
                quantity=bricks_qty,
                unit="Numbers (units)",
                consumption_ratio_description=f"{coeffs['bricks_units_per_sqft']} bricks/sq.ft of built-up area",
                estimated_rate_inr=mat_rate_bricks,
                estimated_cost_inr=round(bricks_qty * mat_rate_bricks, 2),
                standard_reference="IS:2185 / IS:1077",
                provenance="CALCULATED",
            )
        )

    # 4. Itemized Cost Breakdown (Standard CPWD / Real Estate Splits)
    cost_heads: list[CostHeadItem] = [
        CostHeadItem(
            category="Structural RCC & Substructure",
            description="Foundation, columns, beams, slabs, concrete placement, and formwork.",
            cost_inr=round(total_cost_inr * 0.48, 2),
            cost_inr_lakhs=round((total_cost_inr * 0.48) / 100000, 2),
            percentage_of_total=48.0,
            cost_per_sqft_inr=round(adjusted_sqft_rate * 0.48, 2),
        ),
        CostHeadItem(
            category="Masonry & External Envelope",
            description="Perimeter walls, partition walls, lintels, parapets, and external plastering.",
            cost_inr=round(total_cost_inr * 0.14, 2),
            cost_inr_lakhs=round((total_cost_inr * 0.14) / 100000, 2),
            percentage_of_total=14.0,
            cost_per_sqft_inr=round(adjusted_sqft_rate * 0.14, 2),
        ),
        CostHeadItem(
            category="Finishing & Flooring",
            description="Vitrified tile flooring, internal POP putty, premium emulsion painting, waterproofing.",
            cost_inr=round(total_cost_inr * 0.18, 2),
            cost_inr_lakhs=round((total_cost_inr * 0.18) / 100000, 2),
            percentage_of_total=18.0,
            cost_per_sqft_inr=round(adjusted_sqft_rate * 0.18, 2),
        ),
        CostHeadItem(
            category="MEP & Building Services",
            description="Concealed electrical conduits, distribution panels, plumbing lines, sanitary fixtures.",
            cost_inr=round(total_cost_inr * 0.12, 2),
            cost_inr_lakhs=round((total_cost_inr * 0.12) / 100000, 2),
            percentage_of_total=12.0,
            cost_per_sqft_inr=round(adjusted_sqft_rate * 0.12, 2),
        ),
        CostHeadItem(
            category="Preliminaries, Approvals & Contingency",
            description="Municipal drawing sanctions, temporary site utilities, safety marshals, testing.",
            cost_inr=round(total_cost_inr * 0.08, 2),
            cost_inr_lakhs=round((total_cost_inr * 0.08) / 100000, 2),
            percentage_of_total=8.0,
            cost_per_sqft_inr=round(adjusted_sqft_rate * 0.08, 2),
        ),
    ]

    # 5. Calculate Phase-Wise Task Schedule
    # Duration scales with built-up area and number of floors
    base_weeks = 20 + (req.floors * 6) + int(math.log10(max(built_up_area, 100)) * 4)
    total_duration_weeks = max(16, min(base_weeks, 120))
    total_months = round(total_duration_weeks / 4.33, 1)

    w1 = int(total_duration_weeks * 0.15)
    w2 = int(total_duration_weeks * 0.35)
    w3 = int(total_duration_weeks * 0.20)
    w4 = int(total_duration_weeks * 0.18)
    w5 = total_duration_weeks - (w1 + w2 + w3 + w4)

    phases: list[SchedulePhase] = [
        SchedulePhase(
            phase_number=1,
            phase_name="Substructure & Foundation",
            start_week=1,
            end_week=w1,
            duration_weeks=w1,
            key_milestones=[
                "Site survey and boundary demarcations",
                "Soil excavation and anti-termite treatment",
                "PCC bed and isolated/raft foundation casting",
                "Plinth beam completion and backfilling",
            ],
            critical_trade="Earthwork Equipment & Bar Benders",
            deliverables="Certified plinth level inspection report and concrete cube test results.",
        ),
        SchedulePhase(
            phase_number=2,
            phase_name="RCC Superstructure & Slab Framing",
            start_week=w1 + 1,
            end_week=w1 + w2,
            duration_weeks=w2,
            key_milestones=[
                f"Floor 1 to Floor {req.floors} column staging and rebar cage tying",
                "Floor beam shuttering and prestressing duct placement",
                "Monolithic floor slab casting with needle vibration",
                "14-day wet hessian curing and deshutting protocol",
            ],
            critical_trade="Formwork Carpenters & Concreting Gang",
            deliverables="Structural framework complete; 28-day characteristic strength clearance.",
        ),
        SchedulePhase(
            phase_number=3,
            phase_name="Masonry & External Plastering",
            start_week=w1 + w2 + 1,
            end_week=w1 + w2 + w3,
            duration_weeks=w3,
            key_milestones=[
                "Autoclaved Aerated Concrete (AAC) external wall blockwork",
                "Internal partition masonry and door/window frame fixing",
                "External 2-coat waterproof sand-face plastering",
                "Roof waterproofing and terrace slope drainage casting",
            ],
            critical_trade="Masons & Waterproofing Applicators",
            deliverables="Weatherproof building envelope and sealed external joints.",
        ),
        SchedulePhase(
            phase_number=4,
            phase_name="MEP Rough-in & Internal Finishes",
            start_week=w1 + w2 + w3 + 1,
            end_week=w1 + w2 + w3 + w4,
            duration_weeks=w4,
            key_milestones=[
                "Concealed electrical conduit chasing and wiring pull",
                "UPVC sanitary drainage and CPVC water line pressure testing",
                "Internal gypsum / cement plastering and wall putty application",
                "Vitrified floor tile laying and bathroom dado tiling",
            ],
            critical_trade="Electricians, Plumbers & Tile Masons",
            deliverables="MEP pressure test certificates and floor level inspection sign-off.",
        ),
        SchedulePhase(
            phase_number=5,
            phase_name="Fittings, Testing & Final Handover",
            start_week=w1 + w2 + w3 + w4 + 1,
            end_week=total_duration_weeks,
            duration_weeks=w5,
            key_milestones=[
                "Switchgear installation and luminaire mounting",
                "Sanitaryware, CP fittings, and bathroom hardware fitment",
                "Premium acrylic emulsion painting (2 coats over primer)",
                "Full architectural snagging, deep cleaning, and client key handover",
            ],
            critical_trade="Finishers & QA Handover Team",
            deliverables="Occupancy compliance report, snag-free handover dossier, and as-built drawings.",
        ),
    ]

    assumptions = [
        f"Plot Area: {plot_area:,.0f} sq.ft; Ground Coverage: {req.ground_coverage_percent:.0f}%; Floors: {req.floors}; Total Built-up Area: {built_up_area:,.0f} sq.ft.",
        f"Location Cost Index for {city}: {cost_index:.2f}x applied over standard 2024 CPWD Delhi Schedule of Rates (DSR) base rates.",
        f"Typology base rate for {req.construction_type.replace('_', ' ').title()}: ₹{base_sqft_rate:,.0f}/sq.ft (Adjusted rate: ₹{adjusted_sqft_rate:,.0f}/sq.ft).",
        "Material quantities derived via standard Indian civil engineering thumb rules (IS:456:2000, IS:383:2016, CPWD Specifications 2019).",
        "Schedule assumes 6-day work weeks without force majeure delays, monsoon shutdowns, or material supply chain blockages.",
        "Cost estimates represent indicative construction execution estimates excluding land acquisition cost and statutory municipal approval fees.",
    ]

    disclaimer = (
        "PLANNING DECISION SUPPORT NOTICE: All material quantities and cost figures generated by this engine are "
        "indicative engineering estimates based on validated civil thumb rules (CPWD DSR). They are intended for early-stage "
        "budgeting and feasibility planning. Detailed architectural construction drawings and contractor tender bids "
        "are required before executing contractual procurement."
    )

    return ProjectPlanningResponse(
        project_id=req.project_id or "PRJ-NH48-PKG3",
        generated_at_iso=now_iso,
        input_parameters={
            "plot_area_sqft": plot_area,
            "floors": req.floors,
            "ground_coverage_percent": req.ground_coverage_percent,
            "construction_type": req.construction_type,
            "location_city": city,
        },
        built_up_area_sqft=built_up_area,
        carpet_area_approx_sqft=carpet_area,
        materials_takeoff=materials,
        cost_breakdown=cost_heads,
        total_estimated_cost_inr=total_cost_inr,
        total_estimated_cost_inr_lakhs=round(total_cost_inr / 100000, 2),
        total_estimated_cost_inr_crores=round(total_cost_inr / 10000000, 2),
        average_rate_per_sqft_inr=adjusted_sqft_rate,
        phase_schedule=phases,
        total_project_duration_weeks=total_duration_weeks,
        total_project_duration_months=total_months,
        assumptions_and_sources=assumptions,
        provenance="CALCULATED",
        disclaimer=disclaimer,
    )
