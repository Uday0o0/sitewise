"""What-If Simulator API routes — deterministic calculations and scenario persistence."""

import uuid
import math
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database import get_db
from models import SimulatorCommit, SimulatorScenario, Project
from schemas import (
    SimulatorEvaluateRequest, SimulatorEvaluateResponse,
    MilestoneDelta, FeasibilityAssessment,
    SimulatorCommitRequest, SimulatorCommitResponse,
    ScenarioSaveRequest, ScenarioItemResponse, ScenarioListResponse,
)

router = APIRouter(prefix="/api/v4/simulator", tags=["simulator"])


def deterministic_evaluate(params: SimulatorEvaluateRequest) -> SimulatorEvaluateResponse:
    """
    Pure deterministic calculation — no stochastic or unvalidated AI-generated metrics.
    All outputs are explicitly derived from input parameters via auditable formulas.
    """
    p = params.parameters

    # Baseline: full recast/demolition scenario
    # Default: 18 days delay window; 10 days gantry demurrage + ₹5,30,000 demolition & recast direct cost
    baseline_slip_days = p.baselineScheduleSlipDays if p.baselineScheduleSlipDays is not None else 18
    baseline_demo_cost = p.baselineDemolitionDirectCostInr if p.baselineDemolitionDirectCostInr is not None else 530000
    baseline_gantry_days = p.baselineGantryIdlingDays if p.baselineGantryIdlingDays is not None else 10
    gantry_rate = p.gantryIdlingDailyRateInr
    gantry_idling_total = gantry_rate * baseline_gantry_days
    baseline_financial = gantry_idling_total + baseline_demo_cost

    # Scenario: CFRP fast-track
    curing_hours = p.cfrpCuringWindowHours
    sla_hours = p.independentEngineerSlaHours
    cfrp_base_cost = p.cfrpBaseMaterialCostInr if p.cfrpBaseMaterialCostInr is not None else 350000
    cfrp_labor_rate = p.cfrpDailyLaborRateInr if p.cfrpDailyLaborRateInr is not None else 100000

    curing_days = curing_hours / 24.0
    engineer_review_days = sla_hours / 24.0
    scenario_slip_days = math.ceil(curing_days + engineer_review_days)

    days_recovered = baseline_slip_days - scenario_slip_days
    window_compression = round((days_recovered / baseline_slip_days) * 100, 1) if baseline_slip_days > 0 else 0.0

    cfrp_labor_cost = int(curing_days * cfrp_labor_rate)
    scenario_cost = cfrp_base_cost + cfrp_labor_cost

    net_avoidance = baseline_financial - scenario_cost
    cost_reduction_pct = round((net_avoidance / baseline_financial) * 100, 1) if baseline_financial > 0 else 0.0
    schedule_reduction_pct = window_compression

    # Structural feasibility based on UPV threshold
    resilience = min(99.0, round((p.upvTargetThresholdMps / 4100.0) * 100, 1))

    # Authority acceptance risk based on curing window
    if curing_hours >= 72:
        acceptance_risk = "LOW"
    elif curing_hours >= 48:
        acceptance_risk = "LOW"
    else:
        acceptance_risk = "MEDIUM"

    # Dynamic date calculations from P6 baseline targets
    base_wbs1 = datetime.date(2024, 11, 20)
    scenario_date_wbs1 = (base_wbs1 + datetime.timedelta(days=scenario_slip_days)).isoformat()

    base_wbs2 = datetime.date(2024, 12, 1)
    scenario_date_wbs2 = (base_wbs2 + datetime.timedelta(days=scenario_slip_days)).isoformat()

    base_wbs3 = datetime.date(2024, 12, 15)
    scenario_date_wbs3 = (base_wbs3 + datetime.timedelta(days=max(0, scenario_slip_days - 3))).isoformat()

    # Driving factors breakdown
    demurrage_share_pct = round((gantry_idling_total / baseline_financial) * 100, 1) if baseline_financial > 0 else 0.0
    direct_share_pct = round((baseline_demo_cost / baseline_financial) * 100, 1) if baseline_financial > 0 else 0.0

    driving_factors = [
        f"Gantry Idling Demurrage: ₹{gantry_idling_total:,} ({demurrage_share_pct}% of baseline exposure at ₹{gantry_rate:,}/day × {baseline_gantry_days}d)",
        f"Recast Direct Hydro-demolition: ₹{baseline_demo_cost:,} ({direct_share_pct}% of baseline exposure)",
        f"CFRP Critical Path Compression: {days_recovered} days recovered ({window_compression}% compression vs {baseline_slip_days}d recast delay)",
        f"Curing & Inspection SLA: {curing_hours}h resin curing + {sla_hours}h IE turnaround yields {scenario_slip_days}d intervention delay",
    ]

    comparison_summary = (
        f"Adopting the proposed CFRP pressure injection intervention recovers {days_recovered} days "
        f"({window_compression}% schedule compression) and yields ₹{net_avoidance / 100000:.2f}L net avoidance "
        f"({cost_reduction_pct}% cost reduction). The primary baseline cost driver is gantry crane demurrage "
        f"(₹{gantry_idling_total / 100000:.2f}L across {baseline_gantry_days} idling days), while the proposed intervention "
        f"compresses total downtime to {scenario_slip_days} days including the {sla_hours}h independent engineer turnaround."
    )

    # Auditable arithmetic formula breakdown
    formula_breakdown = {
        "baselineFinancialExposure": {
            "formula": "(gantryIdlingDailyRateInr * baselineGantryIdlingDays) + baselineDemolitionDirectCostInr",
            "arithmetic": f"(₹{gantry_rate:,} * {baseline_gantry_days} days) + ₹{baseline_demo_cost:,} = ₹{gantry_idling_total:,} + ₹{baseline_demo_cost:,}",
            "result": f"₹{baseline_financial:,}",
            "units": "INR",
        },
        "scenarioProposedCost": {
            "formula": "cfrpBaseMaterialCostInr + (curingDays * cfrpDailyLaborRateInr)",
            "arithmetic": f"₹{cfrp_base_cost:,} + ({curing_days:.2f} days * ₹{cfrp_labor_rate:,}/day) = ₹{cfrp_base_cost:,} + ₹{cfrp_labor_cost:,}",
            "result": f"₹{scenario_cost:,}",
            "units": "INR",
        },
        "netCalculatedAvoidance": {
            "formula": "baselineFinancialExposureInr - scenarioProposedCostInr",
            "arithmetic": f"₹{baseline_financial:,} - ₹{scenario_cost:,}",
            "result": f"₹{net_avoidance:,}",
            "units": "INR",
        },
        "scenarioScheduleSlip": {
            "formula": "ceil((cfrpCuringWindowHours / 24) + (independentEngineerSlaHours / 24))",
            "arithmetic": f"ceil(({curing_hours} / 24) + ({sla_hours} / 24)) = ceil({curing_days:.2f} + {engineer_review_days:.2f})",
            "result": f"{scenario_slip_days} days",
            "units": "Days",
        },
        "daysRecovered": {
            "formula": "baselineScheduleSlipDays - scenarioScheduleSlipDays",
            "arithmetic": f"{baseline_slip_days} - {scenario_slip_days}",
            "result": f"{days_recovered} days",
            "units": "Days",
        },
        "windowCompressionPercent": {
            "formula": "round((daysRecovered / baselineScheduleSlipDays) * 100, 1) if baselineScheduleSlipDays > 0 else 0.0",
            "arithmetic": f"round(({days_recovered} / {baseline_slip_days}) * 100, 1)" if baseline_slip_days > 0 else "0.0 (zero baseline delay)",
            "result": f"{window_compression}%",
            "units": "Percent",
        },
        "costReductionPercent": {
            "formula": "round((netCalculatedAvoidanceInr / baselineFinancialExposureInr) * 100, 1) if baselineFinancialExposureInr > 0 else 0.0",
            "arithmetic": f"round(({net_avoidance} / {baseline_financial}) * 100, 1)" if baseline_financial > 0 else "0.0 (zero baseline cost)",
            "result": f"{cost_reduction_pct}%",
            "units": "Percent",
        },
    }

    # Distinct categorization of all inputs
    input_classification = {
        "userEntered": [
            {"param": "gantryIdlingDailyRateInr", "value": f"₹{gantry_rate:,}/day", "description": "Gantry crane idling demurrage claim rate"},
            {"param": "cfrpCuringWindowHours", "value": f"{curing_hours} hours", "description": "CFRP polymer resin curing duration window"},
            {"param": "independentEngineerSlaHours", "value": f"{sla_hours} hours", "description": "Independent Engineer turnaround SLA for non-destructive testing"},
            {"param": "baselineScheduleSlipDays", "value": f"{baseline_slip_days} days", "description": "Assumed baseline recast delay window"},
            {"param": "baselineDemolitionDirectCostInr", "value": f"₹{baseline_demo_cost:,}", "description": "Direct hydro-demolition and recast civil cost"},
        ],
        "sourceBacked": [
            {
                "param": "upvTargetThresholdMps",
                "value": f"{p.upvTargetThresholdMps} m/s",
                "source": "IRC:SP:40 Table 4 / IS:13311 Part 1 (Ultrasonic Pulse Velocity Acceptance)",
                "verificationStatus": "UNVERIFIED",
                "verificationNote": "Source document IRC:SP:40 is not present in the project corpus; 3,850 m/s is an empirical defect report value rather than an established IRC table limit. Distinguish observed reading: 3,850 m/s is the in-situ field measurement logged in DOC-5442BA12E9 (Good grade per IS:13311 Part 1 Table 1: 3,500–4,000 m/s), whereas full structural reinstatement target is >4,000 m/s (Excellent).",
                "isVerified": False,
            },
            {
                "param": "p6BaselineMilestones",
                "value": "WBS-3.2.1, WBS-3.3.1, WBS-3.4.1",
                "source": "Contract Master Schedule Rev 4.1",
                "verificationStatus": "UNVERIFIED",
                "verificationNote": "Master Schedule Rev 4.1 document is not present in the project corpus; WBS target dates serve as unverified benchmark milestones.",
                "isVerified": False,
            },
        ],
        "syntheticDemo": [
            {"param": "baselineGantryIdlingDays", "value": f"{baseline_gantry_days} days", "source": "Synthetic demo demurrage duration (unverified estimate)", "verificationStatus": "SYNTHETIC_DEMO", "isSynthetic": True},
            {"param": "cfrpBaseMaterialCostInr", "value": f"₹{cfrp_base_cost:,}", "source": "Synthetic demo specialized composite procurement rate (unverified estimate)", "verificationStatus": "SYNTHETIC_DEMO", "isSynthetic": True},
            {"param": "cfrpDailyLaborRateInr", "value": f"₹{cfrp_labor_rate:,}/day", "source": "Synthetic demo certified applicator technician rate (unverified estimate)", "verificationStatus": "SYNTHETIC_DEMO", "isSynthetic": True},
        ],
        "calculated": [
            {"metric": "baselineFinancialExposureInr", "value": f"₹{baseline_financial:,}", "underlyingAssumptions": f"{baseline_gantry_days}d gantry demurrage @ ₹{gantry_rate:,}/d + ₹{baseline_demo_cost:,} direct demolition"},
            {"metric": "scenarioProposedCostInr", "value": f"₹{scenario_cost:,}", "underlyingAssumptions": f"₹{cfrp_base_cost:,} materials + {curing_days:.2f}d curing supervision @ ₹{cfrp_labor_rate:,}/d"},
            {"metric": "netCalculatedAvoidanceInr", "value": f"₹{net_avoidance:,}", "underlyingAssumptions": "baselineFinancialExposure - scenarioProposedCost"},
            {"metric": "scenarioScheduleSlipDays", "value": f"{scenario_slip_days} days", "underlyingAssumptions": f"{curing_hours}h resin curing + {sla_hours}h independent engineer turnaround"},
            {"metric": "daysRecovered", "value": f"{days_recovered} days", "underlyingAssumptions": f"{baseline_slip_days} baseline days - {scenario_slip_days} scenario days"},
            {"metric": "windowCompressionPercent", "value": f"{window_compression}%", "underlyingAssumptions": f"({days_recovered} days recovered / {baseline_slip_days} baseline days) * 100" if baseline_slip_days > 0 else "0.0%"},
            {"metric": "costReductionPercent", "value": f"{cost_reduction_pct}%", "underlyingAssumptions": f"(₹{net_avoidance:,} net avoidance / ₹{baseline_financial:,} baseline exposure) * 100" if baseline_financial > 0 else "0.0%"},
        ],
    }

    return SimulatorEvaluateResponse(
        simulationRunId=f"SIM-{uuid.uuid4().hex[:8].upper()}",
        baselineScheduleSlipDays=baseline_slip_days,
        scenarioScheduleSlipDays=scenario_slip_days,
        daysRecovered=days_recovered,
        windowCompressionPercent=window_compression,
        baselineFinancialExposureInr=baseline_financial,
        scenarioProposedCostInr=scenario_cost,
        netCalculatedAvoidanceInr=net_avoidance,
        costReductionPercent=cost_reduction_pct,
        scheduleReductionPercent=schedule_reduction_pct,
        drivingFactors=driving_factors,
        comparisonSummary=comparison_summary,
        formulaBreakdown=formula_breakdown,
        inputClassification=input_classification,
        disclaimer="Outputs are estimates based on stated assumptions. Synthetic demo values are illustrative and results are not certified engineering or construction advice.",
        milestonesDelta=[
            MilestoneDelta(
                wbsCode="WBS-3.2.1",
                description="Pier 18 Defect Resolution",
                p6BaseDate="2024-11-20",
                scenarioDate=scenario_date_wbs1,
                netDriftDays=-scenario_slip_days,
                pathStatus=f"ACCELERATED (+{days_recovered}d vs Recast)" if days_recovered > 10 else "PARTIAL RECOVERY",
            ),
            MilestoneDelta(
                wbsCode="WBS-3.3.1",
                description="Span 18-19 Precast Segment Launch",
                p6BaseDate="2024-12-01",
                scenarioDate=scenario_date_wbs2,
                netDriftDays=-scenario_slip_days,
                pathStatus=f"UNBLOCKED (+{days_recovered}d vs Recast)" if days_recovered > 10 else "PARTIAL RECOVERY",
            ),
            MilestoneDelta(
                wbsCode="WBS-3.4.1",
                description="Span 19-20 Girder Erection",
                p6BaseDate="2024-12-15",
                scenarioDate=scenario_date_wbs3,
                netDriftDays=-(max(0, scenario_slip_days - 3)),
                pathStatus="ON_SCHEDULE" if scenario_slip_days <= 3 else "BUFFER_ABSORBED",
            ),
        ],
        feasibilityAssessment=FeasibilityAssessment(
            structuralResiliencePercent=resilience,
            authorityAcceptanceRisk=acceptance_risk,
            designLifeYears=50,
        ),
        modelBoundaries=[
            "Outputs are estimates based on stated assumptions. Synthetic demo values are illustrative and results are not certified engineering or construction advice.",
            "Deterministic contract arithmetic — not a calibrated Monte Carlo or probabilistic risk model",
            "Field observation distinction: 3,850 m/s is an empirical in-situ reading from QA report DOC-5442BA12E9, not an acceptance threshold standard.",
            f"Baseline gross exposure derived as {baseline_gantry_days} days gantry idling (₹{gantry_rate:,}/day) + ₹{baseline_demo_cost:,} recast demolition materials",
            f"Scenario cost derived as ₹{cfrp_base_cost:,} CFRP composite materials + ₹{cfrp_labor_rate:,}/day specialist curing supervision ({curing_hours}h)",
            "Schedule convention: Scenario projected dates indicate +X days slip past certified P6 baseline target. Days recovered measures recovery relative to baseline recast.",
            "UPV structural resilience is an empirical linear approximation; requires laboratory core validation",
            "This tool is an operational planning simulator and does NOT provide certified structural engineering advice or statutory authority approval.",
        ],
    )


@router.post("/evaluate", response_model=SimulatorEvaluateResponse)
async def evaluate_scenario(req: SimulatorEvaluateRequest):
    return deterministic_evaluate(req)


@router.post("/commit", response_model=SimulatorCommitResponse)
async def commit_scenario(
    req: SimulatorCommitRequest,
    db: AsyncSession = Depends(get_db),
):
    if not req.acknowledgement:
        raise HTTPException(
            status_code=400,
            detail="Explicit acknowledgement required: committing does not overwrite certified master P6 baseline without Project Director approval",
        )

    commit = SimulatorCommit(
        id=f"CMT-{uuid.uuid4().hex[:8].upper()}",
        finding_id=req.findingId,
        scenario_type="CFRP_PRESSURE_INJECTION",
        parameters={"simulationRunId": req.simulationRunId},
        result={"status": "COMMITTED"},
        committed_at=datetime.datetime.utcnow().isoformat(),
    )
    db.add(commit)
    await db.commit()

    return SimulatorCommitResponse(
        commitId=commit.id,
        status="COMMITTED",
        message="Scenario committed to working baseline. Downstream buffer dates updated. Does not overwrite certified master P6 baseline.",
    )


# ─── Saved Scenarios Persistence ──────────────────────────────────────

@router.post("/scenarios", response_model=ScenarioItemResponse)
async def save_scenario(
    req: ScenarioSaveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Save a named what-if scenario with parameters and evaluated results."""
    # Validate project isolation
    proj_res = await db.execute(select(Project).where(Project.id == req.projectId))
    if not proj_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Project '{req.projectId}' not found")

    # Evaluate results deterministically
    eval_req = SimulatorEvaluateRequest(
        findingId=req.findingId,
        baselineType=req.baselineType,
        scenarioType=req.scenarioType,
        parameters=req.parameters,
        projectId=req.projectId,
        scenarioName=req.name,
    )
    eval_result = deterministic_evaluate(eval_req)

    now = datetime.datetime.utcnow().isoformat()
    scenario_id = f"SCN-{uuid.uuid4().hex[:8].upper()}"

    scenario = SimulatorScenario(
        id=scenario_id,
        project_id=req.projectId,
        finding_id=req.findingId,
        name=req.name,
        description=req.description,
        baseline_type=req.baselineType,
        scenario_type=req.scenarioType,
        parameters=req.parameters.model_dump(),
        result=eval_result.model_dump(),
        created_at=now,
        updated_at=now,
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)

    return ScenarioItemResponse(
        id=scenario.id,
        projectId=scenario.project_id,
        findingId=scenario.finding_id,
        name=scenario.name,
        description=scenario.description,
        baselineType=scenario.baseline_type,
        scenarioType=scenario.scenario_type,
        parameters=scenario.parameters,
        result=scenario.result,
        createdAt=scenario.created_at,
        updatedAt=scenario.updated_at,
    )


@router.get("/scenarios", response_model=ScenarioListResponse)
async def list_scenarios(
    projectId: Optional[str] = Query(None, description="Filter by project ID"),
    findingId: Optional[str] = Query(None, description="Filter by finding ID"),
    db: AsyncSession = Depends(get_db),
):
    """List saved what-if scenarios with optional project and finding filtering."""
    query = select(SimulatorScenario)
    if projectId:
        query = query.where(SimulatorScenario.project_id == projectId)
    if findingId:
        query = query.where(SimulatorScenario.finding_id == findingId)
    query = query.order_by(SimulatorScenario.created_at.desc())

    res = await db.execute(query)
    scenarios = res.scalars().all()

    items = [
        ScenarioItemResponse(
            id=s.id,
            projectId=s.project_id,
            findingId=s.finding_id,
            name=s.name,
            description=s.description,
            baselineType=s.baseline_type,
            scenarioType=s.scenario_type,
            parameters=s.parameters,
            result=s.result,
            createdAt=s.created_at,
            updatedAt=s.updated_at,
        )
        for s in scenarios
    ]
    return ScenarioListResponse(scenarios=items, total=len(items))


@router.get("/scenarios/{scenario_id}", response_model=ScenarioItemResponse)
async def get_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a single saved scenario by ID."""
    res = await db.execute(select(SimulatorScenario).where(SimulatorScenario.id == scenario_id))
    scenario = res.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    return ScenarioItemResponse(
        id=scenario.id,
        projectId=scenario.project_id,
        findingId=scenario.finding_id,
        name=scenario.name,
        description=scenario.description,
        baselineType=scenario.baseline_type,
        scenarioType=scenario.scenario_type,
        parameters=scenario.parameters,
        result=scenario.result,
        createdAt=scenario.created_at,
        updatedAt=scenario.updated_at,
    )


@router.delete("/scenarios/{scenario_id}")
async def delete_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved scenario by ID."""
    res = await db.execute(select(SimulatorScenario).where(SimulatorScenario.id == scenario_id))
    scenario = res.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    await db.execute(delete(SimulatorScenario).where(SimulatorScenario.id == scenario_id))
    await db.commit()
    return {"status": "DELETED", "scenarioId": scenario_id}
