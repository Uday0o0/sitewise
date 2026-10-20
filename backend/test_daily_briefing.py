"""Tests for Daily Site Assistant Briefing module.

Verifies:
1. Grounded synthesis linking real project findings, CPM milestones, and claims.
2. Activity-specific task sequencing and workforce allocation.
3. Integration with meteorological weather advisory.
4. Input validation (workforce bounds, shift selection).
5. Honest empty project state (no hallucinated tasks).
6. Cross-project boundary isolation.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from database import async_session
from models import Project
from sqlalchemy import select


@pytest.mark.asyncio
async def test_01_get_daily_briefing_grounded_in_project():
    """Verify default morning briefing pulls real database records for NH-48."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v4/projects/PRJ-NH48-PKG3/assistant/daily-briefing")
        assert resp.status_code == 200
        data = resp.json()
        assert data["project_id"] == "PRJ-NH48-PKG3"
        assert "NH-48" in data["project_name"]
        assert len(data["daily_task_breakdown"]) > 0
        assert len(data["required_materials_and_equipment"]) > 0
        assert len(data["safety_precautions_and_checklist"]) > 0

        # Check that risk alerts include real project records
        alert_titles = [a["title"] for a in data["risk_alerts"]]
        assert any("Finding" in t or "FND-104" in t for t in alert_titles)
        assert any("Critical Path" in t or "Drift" in t for t in alert_titles)
        assert len(data["source_citations"]) > 0
        assert data["weather_advisory"] is not None


@pytest.mark.asyncio
async def test_02_post_daily_briefing_concreting_workflow():
    """Verify POST request with concreting activity generates structured placement sequence."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "daily_activity": "Pier 18 Pier Cap M50 Concrete Pouring",
            "workforce_count": 30,
            "site_conditions": "Elevated staging on Pier 18, dry surface, clear skies",
            "shift": "DAY_SHIFT",
        }
        resp = await ac.post("/api/v4/projects/PRJ-NH48-PKG3/assistant/daily-briefing", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["workforce_count"] == 30
        assert data["shift"] == "DAY_SHIFT"

        tasks = data["daily_task_breakdown"]
        assert len(tasks) >= 4
        # Verify sequences are ordered
        for i, t in enumerate(tasks, 1):
            assert t["sequence"] == i

        task_names = [t["task_name"] for t in tasks]
        assert any("Shuttering" in name or "Rebar" in name for name in task_names)
        assert any("Concrete Placement" in name or "Vibration" in name for name in task_names)

        # Verify materials mention M50 concrete and needle vibrators
        material_names = [m["item_name"] for m in data["required_materials_and_equipment"]]
        assert any("M50" in name for name in material_names)
        assert any("Vibrator" in name for name in material_names)

        # Verify safety checklist contains PPE and shuttering checks
        checks = data["safety_precautions_and_checklist"]
        assert any("PPE" in c["category"] for c in checks)
        assert any("IS:456" in c["standard_reference"] or "IS:2925" in c["standard_reference"] for c in checks)


@pytest.mark.asyncio
async def test_03_gantry_launching_workflow():
    """Verify segment launching gantry activity includes crane safety checks and rigging tasks."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "daily_activity": "Launching Gantry Segment Erection Span 18-19",
            "workforce_count": 18,
            "site_conditions": "Active traffic beneath on NH-48",
            "shift": "NIGHT_SHIFT",
        }
        resp = await ac.post("/api/v4/projects/PRJ-NH48-PKG3/assistant/daily-briefing", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["shift"] == "NIGHT_SHIFT"

        task_names = [t["task_name"] for t in data["daily_task_breakdown"]]
        assert any("Gantry" in name or "Pre-Check" in name for name in task_names)
        assert any("Traffic" in name or "Marshalling" in name for name in task_names)

        # Check wind cutoff in safety checklist
        check_descs = [c["checkpoint_description"] for c in data["safety_precautions_and_checklist"]]
        assert any("wind" in desc.lower() for desc in check_descs)


@pytest.mark.asyncio
async def test_04_input_validation_workforce():
    """Verify invalid workforce values (<1 or >500) fail validation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Zero workforce
        resp = await ac.post("/api/v4/projects/PRJ-NH48-PKG3/assistant/daily-briefing", json={
            "daily_activity": "Routine Maintenance",
            "workforce_count": 0,
        })
        assert resp.status_code == 422

        # Excessive workforce
        resp2 = await ac.post("/api/v4/projects/PRJ-NH48-PKG3/assistant/daily-briefing", json={
            "daily_activity": "Routine Maintenance",
            "workforce_count": 1000,
        })
        assert resp2.status_code == 422


@pytest.mark.asyncio
async def test_05_empty_project_isolation():
    """Verify an empty project produces honest empty-state response without hallucinated records."""
    # Create temporary empty project
    empty_pid = "PRJ-TEMP-EMPTY-TEST"
    async with async_session() as db:
        existing = await db.execute(select(Project).where(Project.id == empty_pid))
        if not existing.scalar_one_or_none():
            p = Project(
                id=empty_pid,
                name="Empty Test Corridor",
                package_id="PKG-TEST-00",
                chainage_start_meters=0,
                chainage_end_meters=5000,
                is_demo_dataset=False,
                data_sync_timestamp="2026-10-21T00:00:00Z",
            )
            db.add(p)
            await db.commit()

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get(f"/api/v4/projects/{empty_pid}/assistant/daily-briefing")
            assert resp.status_code == 200
            data = resp.json()
            assert data["is_empty_project"] is True
            # No findings or claims cited
            assert len(data["source_citations"]) == 0
    finally:
        # Clean up temporary test project
        async with async_session() as db:
            p_to_del = await db.execute(select(Project).where(Project.id == empty_pid))
            obj = p_to_del.scalar_one_or_none()
            if obj:
                await db.delete(obj)
                await db.commit()


@pytest.mark.asyncio
async def test_06_nonexistent_project_returns_404():
    """Verify 404 for unknown project."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v4/projects/PRJ-DOES-NOT-EXIST/assistant/daily-briefing")
        assert resp.status_code == 404
