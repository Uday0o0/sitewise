"""Unit and integration tests for Milestone 4: What-if Risk Simulator."""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from seed import seed


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    await seed()



@pytest.mark.asyncio
async def test_deterministic_standard_evaluation():
    """Verify standard default calculations match contract arithmetic."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 150000,
                "cfrpCuringWindowHours": 48,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
            },
        })
        assert res.status_code == 200
        data = res.json()

        # Math checks
        assert data["baselineFinancialExposureInr"] == (150000 * 10) + 530000  # 20,30,000
        assert data["scenarioProposedCostInr"] == 350000 + (2 * 100000)  # 5,50,000
        assert data["netCalculatedAvoidanceInr"] == 1480000  # 20,30,000 - 5,50,000
        assert data["baselineScheduleSlipDays"] == 18
        assert data["scenarioScheduleSlipDays"] == 3  # ceil(48/24 + 24/24) = 3
        assert data["daysRecovered"] == 15  # 18 - 3
        assert data["windowCompressionPercent"] == 83.3  # round(15/18 * 100, 1)
        assert data["costReductionPercent"] == 72.9  # round(1480000/2030000 * 100, 1)

        # Transparent breakdown verification
        assert "formulaBreakdown" in data
        assert "baselineFinancialExposure" in data["formulaBreakdown"]
        assert "scenarioProposedCost" in data["formulaBreakdown"]
        assert "netCalculatedAvoidance" in data["formulaBreakdown"]
        assert data["formulaBreakdown"]["baselineFinancialExposure"]["units"] == "INR"

        # Input classification verification
        assert "inputClassification" in data
        assert "userEntered" in data["inputClassification"]
        assert "sourceBacked" in data["inputClassification"]
        assert "syntheticDemo" in data["inputClassification"]
        assert "calculated" in data["inputClassification"]

        # Comparison summary & driving factors
        assert len(data["drivingFactors"]) >= 4
        assert "CFRP pressure injection" in data["comparisonSummary"]


@pytest.mark.asyncio
async def test_custom_baseline_and_mitigation_parameters():
    """Verify custom baseline and mitigation assumptions calculate correctly."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 200000,
                "cfrpCuringWindowHours": 72,
                "independentEngineerSlaHours": 48,
                "upvTargetThresholdMps": 4000,
                "baselineScheduleSlipDays": 25,
                "baselineDemolitionDirectCostInr": 600000,
                "baselineGantryIdlingDays": 12,
                "cfrpBaseMaterialCostInr": 400000,
                "cfrpDailyLaborRateInr": 120000,
            },
        })
        assert res.status_code == 200
        data = res.json()

        # Baseline: (200,000 * 12) + 600,000 = 2,400,000 + 600,000 = 3,000,000
        assert data["baselineFinancialExposureInr"] == 3000000
        # Scenario slip: ceil(72/24 + 48/24) = ceil(3 + 2) = 5 days
        assert data["scenarioScheduleSlipDays"] == 5
        # Scenario cost: 400,000 + (3 * 120,000) = 400,000 + 360,000 = 760,000
        assert data["scenarioProposedCostInr"] == 760000
        # Net avoidance: 3,000,000 - 760,000 = 2,240,000
        assert data["netCalculatedAvoidanceInr"] == 2240000
        # Days recovered: 25 - 5 = 20
        assert data["daysRecovered"] == 20
        # Window compression: round(20/25 * 100, 1) = 80.0%
        assert data["windowCompressionPercent"] == 80.0
        # Cost reduction: round(2240000/3000000 * 100, 1) = 74.7%
        assert data["costReductionPercent"] == 74.7


@pytest.mark.asyncio
async def test_boundary_and_invalid_inputs():
    """Verify validation catches negative inputs and protects against division-by-zero."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Negative rate must be rejected with 422
        bad_res = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": -50000,
                "cfrpCuringWindowHours": 48,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
            },
        })
        assert bad_res.status_code == 422

        # Invalid curing window (must be 36, 48, or 72)
        bad_curing = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 150000,
                "cfrpCuringWindowHours": 50,  # not in (36, 48, 72)
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
            },
        })
        assert bad_curing.status_code == 422

        # Zero baseline delay — must not trigger division-by-zero
        zero_res = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 0,
                "cfrpCuringWindowHours": 48,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
                "baselineScheduleSlipDays": 0,
                "baselineDemolitionDirectCostInr": 0,
            },
        })
        assert zero_res.status_code == 200
        z_data = zero_res.json()
        assert z_data["windowCompressionPercent"] == 0.0
        assert z_data["costReductionPercent"] == 0.0


@pytest.mark.asyncio
async def test_scenario_persistence_lifecycle_and_project_isolation():
    """Verify saving, listing, retrieving, deleting scenarios and project boundary enforcement."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Project isolation: reject invalid project
        bad_proj_res = await ac.post("/api/v4/simulator/scenarios", json={
            "name": "Invalid Project Scenario",
            "projectId": "PRJ-NON-EXISTENT",
            "findingId": "FND-104",
            "parameters": {
                "gantryIdlingDailyRateInr": 150000,
                "cfrpCuringWindowHours": 48,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
            },
        })
        assert bad_proj_res.status_code == 404

        # 2. Save valid scenario
        save_res = await ac.post("/api/v4/simulator/scenarios", json={
            "name": "Fast-Track Pier 18 Intervention Rev A",
            "description": "Standard 48h curing with 24h IE SLA",
            "projectId": "PRJ-NH48-PKG3",
            "findingId": "FND-104",
            "parameters": {
                "gantryIdlingDailyRateInr": 150000,
                "cfrpCuringWindowHours": 48,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
            },
        })
        assert save_res.status_code == 200
        saved = save_res.json()
        scenario_id = saved["id"]
        assert scenario_id.startswith("SCN-")
        assert saved["name"] == "Fast-Track Pier 18 Intervention Rev A"
        assert saved["result"]["daysRecovered"] == 15
        assert saved["result"]["netCalculatedAvoidanceInr"] == 1480000

        # 3. List scenarios
        list_res = await ac.get("/api/v4/simulator/scenarios?projectId=PRJ-NH48-PKG3")
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert list_data["total"] >= 1
        found = any(s["id"] == scenario_id for s in list_data["scenarios"])
        assert found is True

        # 4. Get scenario by ID
        get_res = await ac.get(f"/api/v4/simulator/scenarios/{scenario_id}")
        assert get_res.status_code == 200
        get_data = get_res.json()
        assert get_data["id"] == scenario_id
        assert get_data["parameters"]["cfrpCuringWindowHours"] == 48

        # 5. Delete scenario
        del_res = await ac.delete(f"/api/v4/simulator/scenarios/{scenario_id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "DELETED"

        # 6. Verify 404 after deletion
        get_again = await ac.get(f"/api/v4/simulator/scenarios/{scenario_id}")
        assert get_again.status_code == 404


@pytest.mark.asyncio
async def test_unverified_source_claims_and_contextual_disclaimer():
    """Verify that claims lacking project backing documents are marked UNVERIFIED with notes and disclaimers."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 150000,
                "cfrpCuringWindowHours": 48,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
            },
        })
        assert res.status_code == 200
        data = res.json()

        # Contextual disclaimer checks
        assert "disclaimer" in data
        assert "Outputs are estimates based on stated assumptions" in data["disclaimer"]
        assert "not certified engineering" in data["disclaimer"]

        # Check sourceBacked items
        source_backed = data["inputClassification"]["sourceBacked"]
        assert len(source_backed) >= 2

        # 1. upvTargetThresholdMps must be UNVERIFIED
        upv_claim = next((item for item in source_backed if item["param"] == "upvTargetThresholdMps"), None)
        assert upv_claim is not None
        assert upv_claim["verificationStatus"] == "UNVERIFIED"
        assert upv_claim["isVerified"] is False
        assert "IRC:SP:40 is not present in the project corpus" in upv_claim["verificationNote"]

        # 2. p6BaselineMilestones must be UNVERIFIED
        milestones_claim = next((item for item in source_backed if item["param"] == "p6BaselineMilestones"), None)
        assert milestones_claim is not None
        assert milestones_claim["verificationStatus"] == "UNVERIFIED"
        assert milestones_claim["isVerified"] is False
        assert "Master Schedule Rev 4.1 document is not present in the project corpus" in milestones_claim["verificationNote"]

        # 3. Model boundaries must contain engineering disclaimer
        assert any("not certified engineering" in b for b in data["modelBoundaries"])


@pytest.mark.asyncio
async def test_sensitivity_parameter_variation_updates_all_dependent_metrics():
    """Verify modifying sensitivity parameters recalculates every dependent output, percentage, and formula."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Base run
        res1 = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 150000,
                "cfrpCuringWindowHours": 48,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
            },
        })
        d1 = res1.json()

        # Sensitivity variation 1: Increase gantry idling daily rate to ₹2,50,000
        res2 = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 250000,
                "cfrpCuringWindowHours": 48,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
            },
        })
        d2 = res2.json()

        # Baseline exposure and net avoidance must increase
        assert d2["baselineFinancialExposureInr"] > d1["baselineFinancialExposureInr"]
        assert d2["baselineFinancialExposureInr"] == (250000 * 10) + 530000
        assert d2["netCalculatedAvoidanceInr"] > d1["netCalculatedAvoidanceInr"]
        assert d2["costReductionPercent"] > d1["costReductionPercent"]
        assert "₹250,000" in d2["formulaBreakdown"]["baselineFinancialExposure"]["arithmetic"]

        # Sensitivity variation 2: Conservative 72h curing + 48h SLA
        res3 = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 150000,
                "cfrpCuringWindowHours": 72,
                "independentEngineerSlaHours": 48,
                "upvTargetThresholdMps": 3850,
            },
        })
        d3 = res3.json()

        # Scenario schedule slip must increase from 3 to 5 days: ceil(72/24 + 48/24) = 5
        assert d3["scenarioScheduleSlipDays"] == 5
        assert d3["daysRecovered"] == 18 - 5  # 13 days vs 15 days in d1
        assert d3["windowCompressionPercent"] < d1["windowCompressionPercent"]
        # Labor cost is higher for 3 days curing: 350000 + (3 * 100000) = 650000
        assert d3["scenarioProposedCostInr"] == 650000
        assert d3["netCalculatedAvoidanceInr"] == d1["baselineFinancialExposureInr"] - 650000
        # Milestone scenario dates must shift accordingly
        assert d3["milestonesDelta"][0]["scenarioDate"] == "2024-11-25"


@pytest.mark.asyncio
async def test_formula_breakdown_arithmetic_consistency():
    """Verify that formula breakdown substitution strings exactly reflect calculated fields."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 180000,
                "cfrpCuringWindowHours": 36,
                "independentEngineerSlaHours": 12,
                "upvTargetThresholdMps": 3950,
                "baselineScheduleSlipDays": 20,
                "baselineDemolitionDirectCostInr": 500000,
                "baselineGantryIdlingDays": 8,
                "cfrpBaseMaterialCostInr": 300000,
                "cfrpDailyLaborRateInr": 90000,
            },
        })
        assert res.status_code == 200
        data = res.json()
        fb = data["formulaBreakdown"]

        # 1. Baseline Financial Exposure
        expected_base_fin = (180000 * 8) + 500000  # 1440000 + 500000 = 1940000
        assert data["baselineFinancialExposureInr"] == expected_base_fin
        assert f"₹{expected_base_fin:,}" == fb["baselineFinancialExposure"]["result"]

        # 2. Scenario Proposed Cost: 300000 + (1.5 * 90000) = 300000 + 135000 = 435000
        expected_scen_cost = 300000 + int((36 / 24.0) * 90000)
        assert data["scenarioProposedCostInr"] == expected_scen_cost
        assert f"₹{expected_scen_cost:,}" == fb["scenarioProposedCost"]["result"]

        # 3. Net Avoidance: 1940000 - 435000 = 1505000
        expected_avoidance = expected_base_fin - expected_scen_cost
        assert data["netCalculatedAvoidanceInr"] == expected_avoidance
        assert f"₹{expected_avoidance:,}" == fb["netCalculatedAvoidance"]["result"]

        # 4. Schedule slip: ceil(36/24 + 12/24) = ceil(1.5 + 0.5) = 2
        assert data["scenarioScheduleSlipDays"] == 2
        assert fb["scenarioScheduleSlip"]["result"] == "2 days"

        # 5. Days recovered: 20 - 2 = 18
        assert data["daysRecovered"] == 18
        assert fb["daysRecovered"]["result"] == "18 days"

        # 6. Window compression: 18 / 20 * 100 = 90.0%
        assert data["windowCompressionPercent"] == 90.0
        assert fb["windowCompressionPercent"]["result"] == "90.0%"


@pytest.mark.asyncio
async def test_boundary_values_and_scenario_cost_overrun():
    """Verify handling when scenario costs more than baseline (negative avoidance) and 0 days slip."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Case where baseline is cheap and scenario is expensive
        res = await ac.post("/api/v4/simulator/evaluate", json={
            "findingId": "FND-104",
            "baselineType": "FULL_RECAST_DEMOLITION",
            "scenarioType": "CFRP_PRESSURE_INJECTION",
            "parameters": {
                "gantryIdlingDailyRateInr": 10000,
                "cfrpCuringWindowHours": 72,
                "independentEngineerSlaHours": 24,
                "upvTargetThresholdMps": 3850,
                "baselineScheduleSlipDays": 4,
                "baselineDemolitionDirectCostInr": 50000,
                "baselineGantryIdlingDays": 2,
                "cfrpBaseMaterialCostInr": 500000,
                "cfrpDailyLaborRateInr": 100000,
            },
        })
        assert res.status_code == 200
        data = res.json()

        # Baseline: (10,000 * 2) + 50,000 = 70,000
        assert data["baselineFinancialExposureInr"] == 70000
        # Scenario slip: ceil(72/24 + 24/24) = 4
        assert data["scenarioScheduleSlipDays"] == 4
        # Days recovered: 4 - 4 = 0
        assert data["daysRecovered"] == 0
        assert data["windowCompressionPercent"] == 0.0

        # Scenario cost: 500000 + (3 * 100000) = 800000
        assert data["scenarioProposedCostInr"] == 800000
        # Net avoidance is negative: 70000 - 800000 = -730000
        assert data["netCalculatedAvoidanceInr"] == -730000
        assert data["costReductionPercent"] < 0

