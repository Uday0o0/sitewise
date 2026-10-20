"""Tests for Real Estate Valuation Engine (Activity 3.2).

Verifies:
1. Micro-market benchmark and property type listings.
2. Indicative market value range, ₹/sq.ft, and currency conversions (Lakhs, Crores).
3. Commercial vs residential rental yields.
4. Age depreciation modeling.
5. Amenities premium scoring.
6. Input validation (zero/negative area rejected).
7. Partial input fallback handling.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from services.valuation_service import (
    ValuationRequest,
    calculate_property_valuation,
)


@pytest.mark.asyncio
async def test_01_markets_endpoint():
    """Verify endpoint provides benchmark micro-markets and property types."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v4/valuation/markets")
        assert resp.status_code == 200
        data = resp.json()
        assert "markets" in data
        assert "property_types" in data
        assert "available_amenities" in data
        locations = [m["location"] for m in data["markets"]]
        assert any("Gurugram" in loc for loc in locations)
        assert any("Mumbai" in loc for loc in locations)


@pytest.mark.asyncio
async def test_02_standard_apartment_valuation():
    """Verify residential apartment valuation in Gurugram NH-48 corridor."""
    req = ValuationRequest(
        property_location="Gurugram (Golf Course Extension)",
        area_sqft=1850.0,
        building_age_years=3.0,
        property_type="APARTMENT_HIGH_RISE",
        bedrooms_count=3,
        amenities=["Gated Security", "Power Backup", "Covered Parking", "Lift", "Clubhouse"],
        is_metro_adjacent=True,
    )
    res = calculate_property_valuation(req)

    assert res.rate_per_sqft_inr > 10000.0
    val_range = res.market_value_range
    assert val_range.minimum_value_inr < val_range.estimated_value_inr < val_range.maximum_value_inr
    assert val_range.estimated_value_inr_crores > 1.0  # ~2-3 Crores

    # Rental analysis
    assert res.rental_analysis.estimated_monthly_rent_inr > 30000.0
    assert 2.5 <= res.rental_analysis.gross_rental_yield_percent <= 5.0

    # 5-Year Appreciation
    assert res.appreciation_outlook.projected_value_inr > val_range.estimated_value_inr
    assert res.appreciation_outlook.projected_cagr_percent > 6.0
    assert "VALUATION DECISION SUPPORT NOTICE" in res.disclaimer


@pytest.mark.asyncio
async def test_03_commercial_office_yield_higher():
    """Verify commercial office property commands significantly higher gross rental yield."""
    req_res = ValuationRequest(
        property_location="Bengaluru (Whitefield)",
        area_sqft=5000.0,
        property_type="APARTMENT_HIGH_RISE",
    )
    req_comm = ValuationRequest(
        property_location="Bengaluru (Whitefield)",
        area_sqft=5000.0,
        property_type="COMMERCIAL_OFFICE",
    )

    val_res = calculate_property_valuation(req_res)
    val_comm = calculate_property_valuation(req_comm)

    # Commercial yield in India is ~7-9%, residential is ~3-4%
    assert val_comm.rental_analysis.gross_rental_yield_percent >= 7.0
    assert val_res.rental_analysis.gross_rental_yield_percent < 5.0


@pytest.mark.asyncio
async def test_04_age_depreciation_impact():
    """Verify structure age decreases valuation rate per sq.ft."""
    req_new = ValuationRequest(
        property_location="Delhi NCR (South Delhi)",
        area_sqft=2000.0,
        building_age_years=1.0,
    )
    req_old = ValuationRequest(
        property_location="Delhi NCR (South Delhi)",
        area_sqft=2000.0,
        building_age_years=25.0,
    )

    val_new = calculate_property_valuation(req_new)
    val_old = calculate_property_valuation(req_old)

    assert val_new.rate_per_sqft_inr > val_old.rate_per_sqft_inr
    assert val_old.age_depreciation_factor < 0.8


@pytest.mark.asyncio
async def test_05_amenities_premium_adjustment():
    """Verify adding premium amenities increases calculated valuation."""
    req_basic = ValuationRequest(
        property_location="Pune (Hinjawadi IT Corridor)",
        area_sqft=1200.0,
        amenities=[],
    )
    req_luxury = ValuationRequest(
        property_location="Pune (Hinjawadi IT Corridor)",
        area_sqft=1200.0,
        amenities=["Gated Security", "Power Backup", "Covered Parking", "Clubhouse", "Lift", "Swimming Pool", "Gymnasium"],
    )

    val_basic = calculate_property_valuation(req_basic)
    val_luxury = calculate_property_valuation(req_luxury)

    assert val_luxury.rate_per_sqft_inr > val_basic.rate_per_sqft_inr
    assert val_luxury.evaluated_amenities_premium_percent > 5.0


@pytest.mark.asyncio
async def test_06_input_validation_zero_negative_area():
    """Verify zero or negative area is rejected with 422."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v4/valuation/estimate", json={
            "property_location": "Gurugram",
            "area_sqft": -500.0,
        })
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_07_partial_inputs_fallback():
    """Verify request with only required fields functions without crashing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/v4/valuation/estimate", json={
            "area_sqft": 1500.0,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["rate_per_sqft_inr"] > 0
        assert data["market_value_range"]["estimated_value_inr"] > 0
        assert data["provenance"] in ["AI_INFERRED", "CALCULATED_RISK"]
