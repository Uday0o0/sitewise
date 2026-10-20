"""Tests for Construction Project Planning Logic module (Activity 3.1).

Verifies:
1. Preset listing endpoint.
2. Arithmetic consistency of built-up area and carpet area.
3. Material takeoff thumb rules (cement, steel, sand, aggregate, bricks).
4. Itemized INR cost breakdown and city cost index scaling.
5. Multi-phase schedule generation and week sequencing.
6. Input validation (positive dimensions, allowable coverage).
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from services.project_planning_service import (
    ProjectPlanningRequest,
    calculate_project_plan,
)


@pytest.mark.asyncio
async def test_01_presets_endpoint():
    """Verify endpoint provides building typologies and benchmark cities."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v4/planning/presets")
        assert resp.status_code == 200
        data = resp.json()
        assert "cities" in data
        assert "typologies" in data
        assert "standard_plot_presets" in data
        city_names = [c["city"] for c in data["cities"]]
        assert "Delhi NCR" in city_names
        assert "Mumbai" in city_names


@pytest.mark.asyncio
async def test_02_standard_residential_plan_calculation():
    """Verify standard residential plan arithmetic for 1500 sq.ft plot, 2 floors."""
    req = ProjectPlanningRequest(
        plot_length_ft=50.0,
        plot_width_ft=30.0,
        floors=2,
        ground_coverage_percent=70.0,
        construction_type="RESIDENTIAL_STANDARD",
        location_city="Gurugram",
    )
    plan = calculate_project_plan(req)

    # 1500 sq.ft * 0.70 coverage * 2 floors = 2100 sq.ft built-up area
    assert plan.built_up_area_sqft == 2100.0
    assert plan.carpet_area_approx_sqft == round(2100.0 * 0.78, 2)

    # Verify material items
    mat_dict = {m.material_code: m for m in plan.materials_takeoff}
    assert "MAT-CEM" in mat_dict
    assert "MAT-STL" in mat_dict
    assert "MAT-SND" in mat_dict
    assert "MAT-AGG" in mat_dict

    # Cement: 2100 * 0.42 = 882 bags
    assert mat_dict["MAT-CEM"].quantity == 882.0
    # Steel: 2100 * 3.8 = 7980 kg
    assert mat_dict["MAT-STL"].quantity == 7980.0

    # Verify cost breakdown sums to total cost
    total_from_heads = sum(head.cost_inr for head in plan.cost_breakdown)
    assert abs(total_from_heads - plan.total_estimated_cost_inr) < 5.0
    assert plan.total_estimated_cost_inr_lakhs > 0

    # Verify 5 phases generated sequentially
    assert len(plan.phase_schedule) == 5
    for i, phase in enumerate(plan.phase_schedule, 1):
        assert phase.phase_number == i
        assert phase.duration_weeks > 0


@pytest.mark.asyncio
async def test_03_city_cost_index_scaling():
    """Verify Mumbai (1.25 index) costs 25% more than Tier-2 City (1.00 index)."""
    req_tier2 = ProjectPlanningRequest(
        plot_area_sqft=2000.0,
        floors=1,
        ground_coverage_percent=100.0,
        construction_type="RESIDENTIAL_STANDARD",
        location_city="Tier-2 City",
    )
    req_mumbai = ProjectPlanningRequest(
        plot_area_sqft=2000.0,
        floors=1,
        ground_coverage_percent=100.0,
        construction_type="RESIDENTIAL_STANDARD",
        location_city="Mumbai",
    )

    plan_tier2 = calculate_project_plan(req_tier2)
    plan_mumbai = calculate_project_plan(req_mumbai)

    # Base rate ₹1950 * 1.00 = 1950; * 1.25 = 2437.5
    assert plan_tier2.average_rate_per_sqft_inr == 1950.0
    assert plan_mumbai.average_rate_per_sqft_inr == 2437.5
    ratio = plan_mumbai.total_estimated_cost_inr / plan_tier2.total_estimated_cost_inr
    assert round(ratio, 2) == 1.25


@pytest.mark.asyncio
async def test_04_infrastructure_typology_steel_consumption():
    """Verify infrastructure typology requires significantly higher steel ratio."""
    req_infra = ProjectPlanningRequest(
        plot_area_sqft=1000.0,
        floors=1,
        ground_coverage_percent=100.0,
        construction_type="INFRASTRUCTURE_BRIDGE",
        location_city="Delhi NCR",
    )
    plan_infra = calculate_project_plan(req_infra)
    mat_dict = {m.material_code: m for m in plan_infra.materials_takeoff}
    # 1000 sq.ft * 8.5 kg/sq.ft = 8500 kg
    assert mat_dict["MAT-STL"].quantity == 8500.0


@pytest.mark.asyncio
async def test_05_input_validation_zero_negative():
    """Verify zero/negative plot dimension values are rejected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v4/planning/generate-plan", json={
            "plot_length_ft": -20.0,
            "plot_width_ft": 30.0,
            "floors": 2,
        })
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_06_quick_plan_get_endpoint():
    """Verify quick plan GET endpoint returns full planning structure."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v4/planning/projects/PRJ-NH48-PKG3/quick-plan?area_sqft=3000&floors=3")
        assert resp.status_code == 200
        data = resp.json()
        assert data["built_up_area_sqft"] > 0
        assert len(data["materials_takeoff"]) >= 4
        assert len(data["cost_breakdown"]) == 5
        assert len(data["phase_schedule"]) == 5
        assert "disclaimer" in data
