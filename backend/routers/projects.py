"""Project and Overview API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Project, Finding, CpmMilestone, EvidenceAsset, UnconfiguredSensor
from schemas import (
    OverviewResponse, ProjectMetadata, KpiSummaries, FindingsBreakdown,
    PriorityDecision, CpmMilestoneItem, EvidenceIngestItem,
    UnconfiguredSensorItem, ProjectListItem,
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
