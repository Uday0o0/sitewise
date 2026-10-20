"""Tests for Weather-Aware Construction Advisory module.

Verifies:
1. Activity listing endpoint.
2. Grounded construction safety rules (IS:456, IRC:112, crane wind cutoffs).
3. Status transitions: GO, PROCEED_WITH_CAUTION, NO_GO, INSUFFICIENT_DATA.
4. Strict guardrail: missing/stale weather NEVER silently yields an unqualified GO.
5. Provenance tracking: SOURCE_VERIFIED vs USER_PROVIDED_UNVERIFIED vs SYNTHETIC_DEMO.
6. Authoritative code vs unverified configurable threshold tagging.
7. Project isolation and 404 on unknown projects.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from services.weather_service import (
    WeatherMetrics,
    evaluate_activity_advisory,
    SUPPORTED_ACTIVITIES,
)


@pytest.mark.asyncio
async def test_01_list_supported_activities():
    """Verify registry of weather-sensitive construction activities."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v4/weather/activities")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        codes = [item["code"] for item in data]
        assert "CONCRETE_POURING" in codes
        assert "CRANE_GANTRY_LAUNCHING" in codes
        assert "WORKING_AT_HEIGHTS" in codes
        assert "EARTHWORK_EXCAVATION" in codes
        assert "STRUCTURAL_STEEL_WELDING" in codes


@pytest.mark.asyncio
async def test_02_concrete_pouring_favorable_returns_go():
    """Verify favorable environmental conditions yield a GO advisory with IS:456 citation."""
    metrics = WeatherMetrics(
        temperature_c=27.0,
        relative_humidity_pct=55.0,
        wind_speed_kmh=12.0,
        wind_gusts_kmh=16.0,
        precipitation_mm=0.0,
        precipitation_probability_pct=5.0,
        weather_condition="Clear Sky",
    )
    res = evaluate_activity_advisory(
        project_id="PRJ-NH48-PKG3",
        activity_code="CONCRETE_POURING",
        metrics=metrics,
        provider_name="Test Meteorological Source",
        freshness="LIVE_FRESH",
        provenance="SOURCE_VERIFIED",
    )
    assert res.status == "GO"
    assert "Favorable weather conditions" in res.summary
    assert len(res.factors_considered) > 0
    # Check that temperature factor references IS:456
    temp_factor = next(f for f in res.factors_considered if "Temperature" in f.factor_name)
    assert temp_factor.source_status == "AUTHORITATIVE_CODE"
    assert "IS:456:2000" in temp_factor.source_reference
    assert res.provenance == "SOURCE_VERIFIED"
    assert "DECISION SUPPORT NOTICE" in res.disclaimer


@pytest.mark.asyncio
async def test_03_concrete_pouring_extreme_heat_returns_no_go():
    """Verify ambient temperature > 40°C triggers NO_GO per IS:456 / IRC:112 hot weather limits."""
    metrics = WeatherMetrics(
        temperature_c=42.5,
        relative_humidity_pct=30.0,
        wind_speed_kmh=15.0,
        precipitation_mm=0.0,
        precipitation_probability_pct=0.0,
        weather_condition="Sunny / Heat Wave",
    )
    res = evaluate_activity_advisory(
        project_id="PRJ-NH48-PKG3",
        activity_code="CONCRETE_POURING",
        metrics=metrics,
        provider_name="Test Weather Source",
        freshness="LIVE_FRESH",
        provenance="SOURCE_VERIFIED",
    )
    assert res.status == "NO_GO"
    assert "exceeds maximum allowable limit of 40°C" in res.rationale
    assert any("slump loss" in f.impact.lower() for f in res.factors_considered)
    assert any("night shift" in p.lower() for p in res.precautions_and_mitigations)


@pytest.mark.asyncio
async def test_04_concrete_pouring_heavy_rain_returns_no_go():
    """Verify rainfall triggers NO_GO due to cement paste dilution risk."""
    metrics = WeatherMetrics(
        temperature_c=24.0,
        relative_humidity_pct=90.0,
        wind_speed_kmh=18.0,
        precipitation_mm=5.5,
        precipitation_probability_pct=85.0,
        weather_condition="Heavy Rain",
    )
    res = evaluate_activity_advisory(
        project_id="PRJ-NH48-PKG3",
        activity_code="CONCRETE_POURING",
        metrics=metrics,
        provider_name="Test Source",
        freshness="LIVE_FRESH",
        provenance="SOURCE_VERIFIED",
    )
    assert res.status == "NO_GO"
    assert any("rain" in r.lower() for r in res.identified_risks)
    assert any("tarpaulin" in p.lower() for p in res.precautions_and_mitigations)


@pytest.mark.asyncio
async def test_05_launching_gantry_high_wind_no_go():
    """Verify wind velocity > 38 km/h triggers NO_GO crane cutoff limit."""
    metrics = WeatherMetrics(
        temperature_c=28.0,
        relative_humidity_pct=60.0,
        wind_speed_kmh=42.0,
        wind_gusts_kmh=52.0,
        precipitation_mm=0.0,
        weather_condition="High Wind",
    )
    res = evaluate_activity_advisory(
        project_id="PRJ-NH48-PKG3",
        activity_code="CRANE_GANTRY_LAUNCHING",
        metrics=metrics,
        provider_name="Test Anemometer",
        freshness="LIVE_FRESH",
        provenance="SOURCE_VERIFIED",
    )
    assert res.status == "NO_GO"
    assert "exceed 38 km/h crane cutoff limit" in res.rationale
    wind_factor = next(f for f in res.factors_considered if "Wind" in f.factor_name)
    # The crane cutoff is a contractor/equipment specification, not a national statutory code
    assert wind_factor.source_status == "UNVERIFIED_CONFIGURABLE"
    assert any("rail clamps" in p.lower() for p in res.precautions_and_mitigations)


@pytest.mark.asyncio
async def test_06_launching_gantry_moderate_wind_proceed_with_caution():
    """Verify wind in 25-38 km/h range yields PROCEED_WITH_CAUTION with taglines required."""
    metrics = WeatherMetrics(
        temperature_c=28.0,
        relative_humidity_pct=60.0,
        wind_speed_kmh=29.0,
        wind_gusts_kmh=34.0,
        precipitation_mm=0.0,
        weather_condition="Breezy",
    )
    res = evaluate_activity_advisory(
        project_id="PRJ-NH48-PKG3",
        activity_code="CRANE_GANTRY_LAUNCHING",
        metrics=metrics,
        provider_name="Test Anemometer",
        freshness="LIVE_FRESH",
        provenance="SOURCE_VERIFIED",
    )
    assert res.status == "PROCEED_WITH_CAUTION"
    assert any("taglines" in p.lower() for p in res.precautions_and_mitigations)


@pytest.mark.asyncio
async def test_07_missing_weather_data_yields_insufficient_data():
    """Guardrail test: completely missing weather data MUST NEVER yield an unqualified GO."""
    res = evaluate_activity_advisory(
        project_id="PRJ-NH48-PKG3",
        activity_code="CONCRETE_POURING",
        metrics=None,
        provider_name="Unavailable Provider",
        freshness="STALE_CACHE",
        provenance="SYNTHETIC_DEMO",
        error_msg="Network timeout",
    )
    assert res.status == "INSUFFICIENT_DATA"
    assert len(res.missing_inputs) > 0
    assert "cannot be confirmed without current atmospheric data" in res.rationale


@pytest.mark.asyncio
async def test_08_partial_metrics_prevents_unqualified_go():
    """Guardrail test: partial metrics (missing wind) downgrade potential GO to PROCEED_WITH_CAUTION."""
    metrics = WeatherMetrics(
        temperature_c=25.0,
        relative_humidity_pct=50.0,
        wind_speed_kmh=None,  # Missing parameter
        precipitation_mm=0.0,
        weather_condition="Clear",
    )
    res = evaluate_activity_advisory(
        project_id="PRJ-NH48-PKG3",
        activity_code="CONCRETE_POURING",
        metrics=metrics,
        provider_name="Partial Feed",
        freshness="LIVE_FRESH",
        provenance="SOURCE_VERIFIED",
    )
    assert res.status != "GO"
    assert "wind_speed_kmh" in res.missing_inputs
    assert res.status == "PROCEED_WITH_CAUTION"


@pytest.mark.asyncio
async def test_09_post_custom_scenario_provenance():
    """Verify POST endpoint accepts what-if scenario and sets USER_PROVIDED_UNVERIFIED provenance."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "activity": "WORKING_AT_HEIGHTS",
            "is_scenario": True,
            "custom_weather": {
                "temperature_c": 30.0,
                "wind_speed_kmh": 36.0,  # Exceeds 32 km/h scaffold limit
                "precipitation_mm": 0.0,
                "weather_condition": "Windy Scenario",
            }
        }
        resp = await ac.post("/api/v4/projects/PRJ-NH48-PKG3/weather/advisory", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "NO_GO"
        assert data["provenance"] == "USER_PROVIDED_UNVERIFIED"
        assert data["freshness"] == "USER_SCENARIO"
        assert data["source_provider"] == "User-Supplied What-If Scenario"


@pytest.mark.asyncio
async def test_10_weather_advisory_invalid_project_returns_404():
    """Verify non-existent project returns 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v4/projects/NONEXISTENT-PRJ/weather/advisory")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_11_get_project_advisory_endpoint():
    """Verify GET advisory endpoint works and accepts activity parameter."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v4/projects/PRJ-NH48-PKG3/weather/advisory?activity=CONCRETE_POURING&scenario=true")
        assert resp.status_code == 200
        data = resp.json()
        assert data["project_id"] == "PRJ-NH48-PKG3"
        assert data["activity"] == "CONCRETE_POURING"
        assert data["status"] in ["GO", "PROCEED_WITH_CAUTION", "NO_GO", "INSUFFICIENT_DATA"]
        assert "disclaimer" in data
