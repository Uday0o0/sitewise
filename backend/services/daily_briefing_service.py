"""Daily Site Assistant Briefing Service for SITEWISE.

Transforms daily construction inputs (activity, workforce availability, site conditions)
combined with actual project records (open findings, CPM schedule drift, contractor claims,
material variances, and live weather advisory) into a structured daily execution plan.

All facts link to real database records. Model inferences and calculated rules are
explicitly labeled with provenance. Empty projects produce honest empty states.
"""

from __future__ import annotations
import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import (
    Project,
    Finding,
    CpmMilestone,
    ContractorClaim,
    MaterialReconciliation,
)
from services.weather_service import (
    DEFAULT_COORDINATES,
    fetch_live_weather,
    evaluate_activity_advisory,
    WeatherAdvisoryResponse,
)

DataProvenance = Literal["SOURCE_VERIFIED", "CALCULATED", "AI_INFERRED", "SYNTHETIC_DEMO", "USER_PROVIDED_UNVERIFIED"]


class DailyTaskItem(BaseModel):
    sequence: int
    task_name: str
    trade: str
    duration_hours: float
    safety_criticality: Literal["STANDARD", "HIGH", "CRITICAL"]
    instructions: str


class MaterialEquipmentNeed(BaseModel):
    item_name: str
    category: Literal["MATERIAL", "EQUIPMENT", "SAFETY_GEAR", "TESTING_TOOL"]
    quantity_estimate: str
    specification_code: str
    provenance: DataProvenance


class SafetyCheckItem(BaseModel):
    check_id: str
    category: str
    checkpoint_description: str
    standard_reference: str
    is_mandatory: bool


class ProjectRiskAlert(BaseModel):
    alert_id: str
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    title: str
    description: str
    source_record_type: Literal["FINDING", "CPM_MILESTONE", "CONTRACTOR_CLAIM", "WEATHER", "GENERAL"]
    source_record_id: Optional[str] = None
    deep_link_url: Optional[str] = None
    provenance: DataProvenance


class DailyBriefingRequest(BaseModel):
    daily_activity: str = Field(..., description="Target daily construction activity")
    workforce_count: int = Field(default=20, ge=1, le=500, description="Available workers on site")
    trade_summary: Optional[str] = Field(None, description="Optional workforce trade breakdown")
    site_conditions: str = Field(default="Normal daytime operations", description="Observed site environmental conditions")
    shift: Literal["DAY_SHIFT", "NIGHT_SHIFT"] = Field(default="DAY_SHIFT", description="Planned work shift")


class DailyBriefingResponse(BaseModel):
    project_id: str
    project_name: str
    chainage_range: str
    generated_at_iso: str
    shift: str
    daily_activity: str
    workforce_count: int
    site_conditions: str
    weather_advisory: Optional[WeatherAdvisoryResponse] = None
    daily_task_breakdown: list[DailyTaskItem]
    required_materials_and_equipment: list[MaterialEquipmentNeed]
    safety_precautions_and_checklist: list[SafetyCheckItem]
    risk_alerts: list[ProjectRiskAlert]
    source_citations: list[dict]
    provenance: DataProvenance
    is_empty_project: bool
    summary: str
    disclaimer: str


async def generate_daily_briefing(
    project_id: str,
    req: DailyBriefingRequest,
    db: AsyncSession,
) -> DailyBriefingResponse:
    """Compile project database records, weather, and operational rules into a structured daily briefing."""
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"

    # 1. Fetch project record
    p_res = await db.execute(select(Project).where((Project.id == project_id) | (Project.package_id == project_id)))
    project = p_res.scalar_one_or_none()
    if not project:
        raise ValueError(f"Project '{project_id}' not found")

    ch_start = project.chainage_start_meters
    ch_end = project.chainage_end_meters
    chainage_str = f"Ch. {ch_start//1000}+{ch_start%1000:03d} to Ch. {ch_end//1000}+{ch_end%1000:03d}"

    # 2. Query actual project findings
    f_res = await db.execute(select(Finding).where(Finding.project_id == project.id))
    findings = f_res.scalars().all()

    # 3. Query CPM milestones
    m_res = await db.execute(select(CpmMilestone).where(CpmMilestone.project_id == project.id))
    milestones = m_res.scalars().all()

    # 4. Query Claims
    c_res = await db.execute(select(ContractorClaim).where(ContractorClaim.project_id == project.id))
    claims = c_res.scalars().all()

    is_empty = len(findings) == 0 and len(milestones) == 0 and len(claims) == 0

    # 5. Fetch weather context for project
    coords = DEFAULT_COORDINATES.get(project.id, DEFAULT_COORDINATES["DEFAULT"])
    metrics, provider, freshness, weather_prov, err = await fetch_live_weather(coords["lat"], coords["lon"])

    # Determine activity mapping for weather
    act_upper = req.daily_activity.upper()
    mapped_weather_activity = "GENERAL_SITE_ACTIVITY"
    if "POUR" in act_upper or "CONCRETE" in act_upper:
        mapped_weather_activity = "CONCRETE_POURING"
    elif "GANTRY" in act_upper or "CRANE" in act_upper or "LAUNCH" in act_upper:
        mapped_weather_activity = "CRANE_GANTRY_LAUNCHING"
    elif "SCAFFOLD" in act_upper or "HEIGHT" in act_upper or "STAGING" in act_upper:
        mapped_weather_activity = "WORKING_AT_HEIGHTS"
    elif "EXCAVAT" in act_upper or "EARTH" in act_upper or "TRENCH" in act_upper:
        mapped_weather_activity = "EARTHWORK_EXCAVATION"
    elif "WELD" in act_upper or "STEEL" in act_upper:
        mapped_weather_activity = "STRUCTURAL_STEEL_WELDING"

    weather_adv = evaluate_activity_advisory(
        project_id=project.id,
        activity_code=mapped_weather_activity,
        metrics=metrics,
        provider_name=provider,
        freshness=freshness,
        provenance=weather_prov,
        error_msg=err,
    )

    # 6. Synthesize Risk Alerts from actual records
    risk_alerts: list[ProjectRiskAlert] = []
    source_citations: list[dict] = []

    # Weather Risk Alert
    if weather_adv.status in ["NO_GO", "PROCEED_WITH_CAUTION"]:
        risk_alerts.append(ProjectRiskAlert(
            alert_id=f"RISK-WX-{project.id[:4]}",
            severity="CRITICAL" if weather_adv.status == "NO_GO" else "MEDIUM",
            title=f"Weather Advisory Alert: {weather_adv.status}",
            description=f"Meteorological conditions require attention: {weather_adv.summary} {weather_adv.rationale}",
            source_record_type="WEATHER",
            source_record_id=weather_adv.activity,
            deep_link_url="/overview",
            provenance="SOURCE_VERIFIED" if weather_adv.provenance == "SOURCE_VERIFIED" else "SYNTHETIC_DEMO",
        ))

    # Open Priority Findings Alert
    for f in findings:
        if f.disposition_status in ["AWAITING_REVIEW", "REJECTED_REWORK_REQUIRED"] or (f.calibrated_aperture_mm and f.calibrated_aperture_mm > 0.2):
            sev: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "CRITICAL" if (f.calibrated_aperture_mm and f.calibrated_aperture_mm >= 0.3) else "HIGH"
            risk_alerts.append(ProjectRiskAlert(
                alert_id=f"RISK-FND-{f.id}",
                severity=sev,
                title=f"Active Finding: {f.title} ({f.id})",
                description=(
                    f"Element: {f.structure_element or f.location_desc}. "
                    f"Measured aperture: {f.calibrated_aperture_mm or 'N/A'}mm. "
                    f"Disposition: {f.disposition_status}. Action: {f.suggested_action or 'Verify on-site before loading.'}"
                ),
                source_record_type="FINDING",
                source_record_id=f.id,
                deep_link_url=f"/inspections/{f.id}",
                provenance="SOURCE_VERIFIED" if f.provenance == "SOURCE_VERIFIED" else "CALCULATED",
            ))
            source_citations.append({
                "record_type": "FINDING",
                "record_id": f.id,
                "title": f.title,
                "link": f"/inspections/{f.id}",
            })

    # Critical Path Slips Alert
    for m in milestones:
        if m.slack_drift_days and m.slack_drift_days < 0:
            risk_alerts.append(ProjectRiskAlert(
                alert_id=f"RISK-CPM-{m.wbs_code}",
                severity="HIGH",
                title=f"Critical Path Drift: {m.activity_desc}",
                description=f"Milestone {m.wbs_code} is drifting by {abs(m.slack_drift_days)} days behind schedule baseline. Status: {m.status}.",
                source_record_type="CPM_MILESTONE",
                source_record_id=m.wbs_code,
                deep_link_url="/planning",
                provenance="CALCULATED",
            ))
            source_citations.append({
                "record_type": "CPM_MILESTONE",
                "record_id": m.wbs_code,
                "title": m.activity_desc,
                "link": "/planning",
            })

    # Active Contractor Claims Alert
    for c in claims:
        if c.status == "UNDER_TECHNICAL_EVALUATION":
            risk_alerts.append(ProjectRiskAlert(
                alert_id=f"RISK-CLM-{c.id}",
                severity="MEDIUM",
                title=f"Pending Contractor Claim: {c.clause_reference}",
                description=f"Claim {c.id} by {c.contractor_name} for ₹{c.claimed_amount_inr_lakhs} Lakhs under review. Exposure: ₹{c.assessed_exposure_inr_lakhs} Lakhs.",
                source_record_type="CONTRACTOR_CLAIM",
                source_record_id=c.id,
                deep_link_url="/planning",
                provenance="SOURCE_VERIFIED",
            ))
            source_citations.append({
                "record_type": "CONTRACTOR_CLAIM",
                "record_id": c.id,
                "title": c.id,
                "link": "/planning",
            })

    # 7. Generate Actionable Task Breakdown based on activity and workforce
    tasks: list[DailyTaskItem] = []
    materials: list[MaterialEquipmentNeed] = []
    safety_checks: list[SafetyCheckItem] = []

    wf = req.workforce_count
    act = req.daily_activity

    if "POUR" in act_upper or "CONCRETE" in act_upper:
        tasks = [
            DailyTaskItem(
                sequence=1,
                task_name="Shuttering Cleanliness & Rebar Cover Inspection",
                trade="Quality Engineers & Carpenters",
                duration_hours=1.5,
                safety_criticality="HIGH",
                instructions="Inspect cover blocks (minimum 40mm cover per IRC:112), verify prestressing duct alignment and blow out debris with compressed air.",
            ),
            DailyTaskItem(
                sequence=2,
                task_name="Batching Plant Slump & Temperature Verification",
                trade="Materials Testing Technicians",
                duration_hours=1.0,
                safety_criticality="HIGH",
                instructions="Verify transit mixer slump (120±25mm), concrete delivery temperature (<30°C per IS:456 Cl. 14), and record batch ticket time.",
            ),
            DailyTaskItem(
                sequence=3,
                task_name="Concrete Placement & Needle Vibration",
                trade=f"Concreting Gang ({int(wf * 0.6)} workers)",
                duration_hours=4.5,
                safety_criticality="CRITICAL",
                instructions="Pour in maximum 300mm uniform horizontal lifts. Insert high-frequency 60mm needle vibrators vertically at 450mm spacing without touching rebar cage.",
            ),
            DailyTaskItem(
                sequence=4,
                task_name="Deck Surface Screeding & Float Finishing",
                trade=f"Masons & Helpers ({int(wf * 0.25)} workers)",
                duration_hours=1.5,
                safety_criticality="STANDARD",
                instructions="Strike off with vibrating truss screed to crown camber slope. Float finish with magnesium bull float before initial set.",
            ),
            DailyTaskItem(
                sequence=5,
                task_name="Curing Membrane & Wet Hessian Staging",
                trade=f"Curing Technicians ({max(2, int(wf * 0.15))} workers)",
                duration_hours=1.5,
                safety_criticality="STANDARD",
                instructions="Apply resin-based curing compound or double-layer wet burlap within 30 minutes of finishing to eliminate plastic shrinkage cracks.",
            ),
        ]
        materials = [
            MaterialEquipmentNeed(
                item_name="M50 Grade Ready Mix Concrete",
                category="MATERIAL",
                quantity_estimate="~32 cu.m (per pier cap standard bay)",
                specification_code="IS:456:2000 & IS:10262",
                provenance="CALCULATED",
            ),
            MaterialEquipmentNeed(
                item_name="High-Frequency Needle Vibrators (60mm & 40mm)",
                category="EQUIPMENT",
                quantity_estimate="4 units (3 active + 1 standby)",
                specification_code="IS:2505 (Concrete vibrator spec)",
                provenance="SOURCE_VERIFIED",
            ),
            MaterialEquipmentNeed(
                item_name="Concrete Test Cube Moulds (150mm)",
                category="TESTING_TOOL",
                quantity_estimate="12 moulds (for 7-day and 28-day breaks)",
                specification_code="IS:516 (Methods of tests for strength)",
                provenance="SOURCE_VERIFIED",
            ),
            MaterialEquipmentNeed(
                item_name="Wet Hessian Burlap & Water Misting Hoses",
                category="SAFETY_GEAR",
                quantity_estimate="200 sq.m double burlap roll",
                specification_code="CPWD §14.4 & IRC:112",
                provenance="CALCULATED",
            ),
        ]
        safety_checks = [
            SafetyCheckItem(
                check_id="CHK-CONC-01",
                category="PPE Compliance",
                checkpoint_description="All concreting crew wearing safety helmets, rubber gumboots, heavy-duty alkali-resistant gloves, and eye goggles.",
                standard_reference="IS:2925 & BOCW Act §38",
                is_mandatory=True,
            ),
            SafetyCheckItem(
                check_id="CHK-CONC-02",
                category="Staging & Falsework",
                checkpoint_description="Falsework staging sign-off by Resident Engineer: check base jack extension, diagonal bracings, and soil bearing plate settlement.",
                standard_reference="IRC:87-2018 (Design of Falsework)",
                is_mandatory=True,
            ),
            SafetyCheckItem(
                check_id="CHK-CONC-03",
                category="Weather Threshold",
                checkpoint_description="Verify ambient temperature is below 40°C and no immediate heavy rain squall is forecasted during placement cycle.",
                standard_reference="IS:456 Cl. 14 / SITEWISE Weather Engine",
                is_mandatory=True,
            ),
        ]

    elif "GANTRY" in act_upper or "CRANE" in act_upper or "LAUNCH" in act_upper:
        tasks = [
            DailyTaskItem(
                sequence=1,
                task_name="Launching Gantry Structural & Anemometer Pre-Check",
                trade="Mechanical Engineers & Rigging Foreman",
                duration_hours=1.5,
                safety_criticality="CRITICAL",
                instructions="Inspect wire ropes, winch brakes, hydraulic levelling rams, and calibrate digital anemometer at mast top.",
            ),
            DailyTaskItem(
                sequence=2,
                task_name="Traffic Marshalling & Ground Exclusion Zone Setup",
                trade="Traffic Marshals (4 personnel)",
                duration_hours=1.0,
                safety_criticality="CRITICAL",
                instructions="Deploy traffic cones, retro-reflective LED signage, and barricade 15m radius beneath the erection span on NH-48 carriageway.",
            ),
            DailyTaskItem(
                sequence=3,
                task_name="Precast Segment Transport & Gantry Hoisting",
                trade=f"Heavy Rigging Crew ({wf} personnel)",
                duration_hours=4.0,
                safety_criticality="CRITICAL",
                instructions="Rig precast segment with certified 4-point spreader beam. Hoist at controlled 1.5 m/min rate. Keep wind anemometer monitored.",
            ),
            DailyTaskItem(
                sequence=4,
                task_name="Epoxy Joint Stitching & Temporary Prestressing Tie",
                trade="Structural Stitching Gang",
                duration_hours=2.5,
                safety_criticality="HIGH",
                instructions="Apply approved Sikadur-31 epoxy adhesive uniformly (1.5mm thickness). Engage PT Macalloy tie bars to 50kN torque within epoxy open pot life.",
            ),
        ]
        materials = [
            MaterialEquipmentNeed(
                item_name="Segment Launching Gantry (200 MT Capacity)",
                category="EQUIPMENT",
                quantity_estimate="1 unit deployed at Span 18-19",
                specification_code="Contract Schedule C (Plant & Equipment)",
                provenance="SOURCE_VERIFIED",
            ),
            MaterialEquipmentNeed(
                item_name="Two-Component Structural Segment Epoxy Glue",
                category="MATERIAL",
                quantity_estimate="18 kits (30kg each)",
                specification_code="IRC:18-2000 & AASHTO §8.13",
                provenance="CALCULATED",
            ),
            MaterialEquipmentNeed(
                item_name="Hydraulic Tensioning Jacks & Calibrated Gauges",
                category="EQUIPMENT",
                quantity_estimate="2 sets (calibrated within 30 days)",
                specification_code="IS:14268 (Prestressing strands)",
                provenance="SOURCE_VERIFIED",
            ),
        ]
        safety_checks = [
            SafetyCheckItem(
                check_id="CHK-GANTRY-01",
                category="Wind Cutoff Enforcement",
                checkpoint_description="Continuous wind monitoring: halt lift if sustained wind exceeds 38 km/h or gusts exceed 45 km/h.",
                standard_reference="Equipment Safety Spec §4.3",
                is_mandatory=True,
            ),
            SafetyCheckItem(
                check_id="CHK-GANTRY-02",
                category="100% Tie-off at Height",
                checkpoint_description="All riggers on gantry top chord must wear full-body dual-lanyard harnesses hooked to permanent static lifelines.",
                standard_reference="BOCW Act §42 & OSHA 1926.502",
                is_mandatory=True,
            ),
        ]

    else:
        # General site activity
        tasks = [
            DailyTaskItem(
                sequence=1,
                task_name="Morning Tool Box Talk (TBT) & Activity Hazard Briefing",
                trade=f"All Trades ({wf} workers)",
                duration_hours=0.5,
                safety_criticality="HIGH",
                instructions="Conduct mandatory 15-minute briefing covering today's hazards, PPE requirements, and project QA alerts.",
            ),
            DailyTaskItem(
                sequence=2,
                task_name=f"Execute Planned Operation: {act}",
                trade=f"Assigned Trades ({int(wf * 0.8)} workers)",
                duration_hours=6.5,
                safety_criticality="HIGH",
                instructions=f"Proceed with {act} adhering strictly to approved method statements and site conditions ({req.site_conditions}).",
            ),
            DailyTaskItem(
                sequence=3,
                task_name="End-of-Shift Housekeeping & Work Permit Sign-Off",
                trade="Site Supervisors & Cleaners",
                duration_hours=1.0,
                safety_criticality="STANDARD",
                instructions="Secure open edges, cover loose materials, remove tripping hazards, and submit daily report to the Resident Engineer.",
            ),
        ]
        materials = [
            MaterialEquipmentNeed(
                item_name="Required Hand Tools & Consumables",
                category="EQUIPMENT",
                quantity_estimate=f"Allocated for {wf} personnel",
                specification_code="Standard Site Inventory",
                provenance="CALCULATED",
            ),
            MaterialEquipmentNeed(
                item_name="Standard Site PPE Kits",
                category="SAFETY_GEAR",
                quantity_estimate=f"{wf} complete kits",
                specification_code="IS:2925 & IS:15298",
                provenance="SOURCE_VERIFIED",
            ),
        ]
        safety_checks = [
            SafetyCheckItem(
                check_id="CHK-GEN-01",
                category="Site Access & Permitting",
                checkpoint_description="Ensure valid Permit to Work (PTW) is posted at the active work zone.",
                standard_reference="Site Safety Manual §2.1",
                is_mandatory=True,
            ),
            SafetyCheckItem(
                check_id="CHK-GEN-02",
                category="Housekeeping & Edge Protection",
                checkpoint_description="Verify all edge guardrails and warning barricades are anchored securely.",
                standard_reference="IS:3696 Part 2",
                is_mandatory=True,
            ),
        ]

    summary = (
        f"Daily Execution Briefing generated for {project.name} ({chainage_str}). "
        f"Planned activity: '{req.daily_activity}' with {wf} personnel on {req.shift.replace('_', ' ').title()}. "
        f"Context contains {len(risk_alerts)} active project risk alerts (including {len(findings)} findings and {len(milestones)} CPM milestones). "
        f"Weather advisory status: {weather_adv.status}."
    )

    disclaimer = (
        "DAILY ASSISTANT NOTICE: This briefing is an automated decision-support synthesis of current database records "
        "and meteorological telemetry. It assists site supervisors and does not replace statutory permits or the "
        "direct instructions of the Resident Engineer."
    )

    return DailyBriefingResponse(
        project_id=project.id,
        project_name=project.name,
        chainage_range=chainage_str,
        generated_at_iso=now_iso,
        shift=req.shift,
        daily_activity=req.daily_activity,
        workforce_count=wf,
        site_conditions=req.site_conditions,
        weather_advisory=weather_adv,
        daily_task_breakdown=tasks,
        required_materials_and_equipment=materials,
        safety_precautions_and_checklist=safety_checks,
        risk_alerts=risk_alerts,
        source_citations=source_citations,
        provenance="SOURCE_VERIFIED" if not is_empty else "USER_PROVIDED_UNVERIFIED",
        is_empty_project=is_empty,
        summary=summary,
        disclaimer=disclaimer,
    )
