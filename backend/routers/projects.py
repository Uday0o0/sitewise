"""Project and Overview API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import (
    Project, Finding, CpmMilestone, EvidenceAsset, UnconfiguredSensor,
    MaterialReconciliation, ContractorClaim,
)
from schemas import (
    OverviewResponse, ProjectMetadata, KpiSummaries, FindingsBreakdown,
    PriorityDecision, CpmMilestoneItem, EvidenceIngestItem,
    UnconfiguredSensorItem, ProjectListItem,
    MaterialReconciliationItem, MaterialReconciliationResponse,
    ContractorClaimItem, ContractorClaimsResponse,
)

router = APIRouter(prefix="/api/v4/projects", tags=["projects"])


@router.get("", response_model=list[ProjectListItem])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project))
    projects = result.scalars().all()
    return [
        ProjectListItem(
            id=p.id,
            name=p.name,
            packageId=p.package_id,
            chainageRange=f"Ch. {p.chainage_start_meters // 1000}+{p.chainage_start_meters % 1000:03d} to Ch. {p.chainage_end_meters // 1000}+{p.chainage_end_meters % 1000:03d}",
            isDemoMode=p.is_demo_dataset,
        )
        for p in projects
    ]


@router.get("/{project_id}/overview", response_model=OverviewResponse)
async def get_overview(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project).where((Project.id == project_id) | (Project.package_id == project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        result = await db.execute(select(Project).limit(1))
        project = result.scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

    # Findings
    findings_result = await db.execute(
        select(Finding).where(Finding.project_id == project.id)
    )
    findings = findings_result.scalars().all()

    structural = sum(1 for f in findings if f.category == "structural")
    safety = sum(1 for f in findings if f.category == "safety")
    qa_hold = sum(1 for f in findings if f.category == "qa_hold")

    priority_decisions = [
        PriorityDecision(
            findingId=f.id,
            title=f.title,
            locationDesc=f.location_desc or "",
            chainageFormatted=f.chainage_formatted or "",
            thumbnailUrl=f.thumbnail_url or "",
            provenance=f.provenance,
            directImpact=f.direct_impact or "",
            cascadeFinancialExposureInr=f.cascade_financial_exposure_inr or "",
            criticalPathSlipDays=f.critical_path_slip_days or 0,
            suggestedAction=f.suggested_action or "",
        )
        for f in findings
        if f.critical_path_slip_days and f.critical_path_slip_days > 0
    ]

    # Milestones
    ms_result = await db.execute(
        select(CpmMilestone).where(CpmMilestone.project_id == project.id)
    )
    milestones = ms_result.scalars().all()

    # Evidence Assets
    ea_result = await db.execute(
        select(EvidenceAsset).where(EvidenceAsset.project_id == project.id)
    )
    assets = ea_result.scalars().all()

    # Unconfigured Sensors
    us_result = await db.execute(
        select(UnconfiguredSensor).where(UnconfiguredSensor.project_id == project.id)
    )
    sensors = us_result.scalars().all()

    return OverviewResponse(
        projectMetadata=ProjectMetadata(
            projectId=project.id,
            projectName=project.name,
            packageId=project.package_id,
            chainageStartMeters=project.chainage_start_meters,
            chainageEndMeters=project.chainage_end_meters,
            isDemoDataset=project.is_demo_dataset,
            dataSyncTimestamp=project.data_sync_timestamp,
        ),
        kpiSummaries=KpiSummaries(
            criticalPathVarianceDays=-4,
            criticalPathStatus="CRITICAL_DRIFT",
            criticalPathBlockerDesc="Span 18-19 Precast Launch Blocked",
            materialReconciledPercent=94.2,
            materialReconciledBand="Within ±6% band",
            reconciledMassMt=3410,
            totalBbsMassMt=3620,
            tenderCostVarianceInrLakhs=-4.85,
            contractorClaimsUnderReviewInrLakhs=12.4,
            activePriorityFindingsCount=len(findings),
            findingsBreakdown=FindingsBreakdown(
                structural=structural,
                safety=safety,
                qaHold=qa_hold,
            ),
        ),
        priorityDecisions=priority_decisions,
        cpmMilestones=[
            CpmMilestoneItem(
                wbsCode=m.wbs_code,
                activityDesc=m.activity_desc,
                baselineDate=m.baseline_date,
                projectedDate=m.projected_date,
                slackDriftDays=m.slack_drift_days,
                status=m.status,
            )
            for m in milestones
        ],
        evidenceIngestStream=[
            EvidenceIngestItem(
                assetId=a.id,
                title=a.title,
                dataType=a.data_type,
                ingestTimeAgo=a.ingest_time_ago,
                provenanceStatus=a.provenance_status,
                linkedFindingId=a.linked_finding_id,
            )
            for a in assets
        ],
        unconfiguredSensors=[
            UnconfiguredSensorItem(
                sensorType=s.sensor_type,
                location=s.location,
                status=s.status,
                configActionUrl=s.config_action_url,
            )
            for s in sensors
        ],
    )


@router.get("/{project_id}/materials/reconciliation", response_model=MaterialReconciliationResponse)
async def get_materials_reconciliation(project_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve certified material reconciliation and variance records for a project."""
    result = await db.execute(
        select(Project).where((Project.id == project_id) | (Project.package_id == project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    items_res = await db.execute(
        select(MaterialReconciliation)
        .where(MaterialReconciliation.project_id == project.id)
        .order_by(MaterialReconciliation.id.asc())
    )
    items = items_res.scalars().all()

    compliant = sum(1 for item in items if item.status == "COMPLIANT")
    overconsumed = sum(1 for item in items if item.status == "OVERCONSUMED")
    saving = sum(1 for item in items if item.status == "SAVING")

    return MaterialReconciliationResponse(
        projectId=project.id,
        totalItems=len(items),
        compliantCount=compliant,
        overconsumedCount=overconsumed,
        savingCount=saving,
        items=[
            MaterialReconciliationItem(
                id=item.id,
                projectId=item.project_id,
                materialCode=item.material_code,
                materialName=item.material_name,
                specCode=item.spec_code,
                unit=item.unit,
                theoreticalQuantity=item.theoretical_quantity,
                actualIssuedQuantity=item.actual_issued_quantity,
                varianceQuantity=item.variance_quantity,
                variancePercent=item.variance_percent,
                contractualBand=item.contractual_band,
                status=item.status,
                provenance=item.provenance,
                sourceReference=item.source_reference,
            )
            for item in items
        ],
    )


@router.get("/{project_id}/claims", response_model=ContractorClaimsResponse)
async def get_contractor_claims(project_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve contractor commercial and extension-of-time claims for a project."""
    result = await db.execute(
        select(Project).where((Project.id == project_id) | (Project.package_id == project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    claims_res = await db.execute(
        select(ContractorClaim)
        .where(ContractorClaim.project_id == project.id)
        .order_by(ContractorClaim.id.asc())
    )
    claims = claims_res.scalars().all()

    total_claimed_lakhs = round(sum(c.claimed_amount_inr_lakhs for c in claims), 2)
    total_assessed_lakhs = round(sum(c.assessed_exposure_inr_lakhs for c in claims), 2)

    return ContractorClaimsResponse(
        projectId=project.id,
        totalClaims=len(claims),
        totalClaimedAmountInrLakhs=total_claimed_lakhs,
        totalAssessedExposureInrLakhs=total_assessed_lakhs,
        claims=[
            ContractorClaimItem(
                id=c.id,
                projectId=c.project_id,
                contractorName=c.contractor_name,
                clauseReference=c.clause_reference,
                claimedAmountInr=c.claimed_amount_inr,
                claimedAmountInrLakhs=c.claimed_amount_inr_lakhs,
                assessedExposureInr=c.assessed_exposure_inr,
                assessedExposureInrLakhs=c.assessed_exposure_inr_lakhs,
                status=c.status,
                linkedFindingId=c.linked_finding_id,
                description=c.description,
                provenance=c.provenance,
                sourceReference=c.source_reference,
            )
            for c in claims
        ],
    )

