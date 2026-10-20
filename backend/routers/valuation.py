"""Real Estate Valuation Engine API routes (Activity 3.2)."""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from services.valuation_service import (
    ValuationRequest,
    ValuationResponse,
    calculate_property_valuation,
    MICRO_MARKET_BENCHMARKS,
    PROPERTY_TYPE_MULTIPLIERS,
    AMENITY_WEIGHTS,
)

router = APIRouter(prefix="/api/v4/valuation", tags=["valuation"])


@router.get("/markets")
async def get_valuation_markets_and_types():
    """Return benchmark Indian micro-markets, property types, and amenity weights."""
    return {
        "markets": [
            {
                "location": k,
                "base_sqft_inr": v["base_sqft"],
                "annual_cagr_percent": v["cagr"],
                "gross_rental_yield_percent": v["rent_yield"],
            }
            for k, v in MICRO_MARKET_BENCHMARKS.items()
        ],
        "property_types": [
            {"type": k, "name": k.replace("_", " ").title(), "multiplier": v}
            for k, v in PROPERTY_TYPE_MULTIPLIERS.items()
        ],
        "available_amenities": list(AMENITY_WEIGHTS.keys()),
    }


@router.post("/estimate", response_model=ValuationResponse)
async def estimate_property_value(req: ValuationRequest):
    """Generate an AI-inferred real estate valuation, rental yield analysis, and ROI outlook."""
    try:
        return calculate_property_valuation(req)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Valuation calculation failed: {str(exc)}")


@router.get("/quick-estimate", response_model=ValuationResponse)
async def quick_property_valuation(
    location: str = Query("Gurugram (Golf Course Extension)", description="Micro-market or city"),
    area_sqft: float = Query(1850.0, gt=0, le=500000, description="Area in sq.ft"),
    age_years: float = Query(3.0, ge=0, le=100, description="Structure age in years"),
    property_type: str = Query("APARTMENT_HIGH_RISE", description="Property category"),
    project_id: Optional[str] = Query("PRJ-NH48-PKG3", description="Associated project"),
):
    """Quick GET endpoint for property valuation estimation."""
    valid_type = property_type.upper()
    if valid_type not in PROPERTY_TYPE_MULTIPLIERS:
        valid_type = "APARTMENT_HIGH_RISE"

    req = ValuationRequest(
        property_location=location,
        area_sqft=area_sqft,
        building_age_years=age_years,
        property_type=valid_type,  # type: ignore
        project_id=project_id,
    )
    return calculate_property_valuation(req)
