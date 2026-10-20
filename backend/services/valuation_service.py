"""Real Estate Valuation Engine for SITEWISE (Activity 3.2).

Provides an AI-driven valuation system tailored to Indian market conditions.
Estimates:
1. Indicative market value range (Min, Max, Estimated Central Value in INR).
2. Price per square foot (₹/sq.ft).
3. Rental income potential (Monthly & Annual rental yield).
4. Return on investment (ROI) and 5-year capital appreciation outlook.
5. Fallback behavior for partial inputs and explicit provenance disclosure.
"""

from __future__ import annotations
import math
import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field

PropertyType = Literal[
    "APARTMENT_HIGH_RISE",
    "INDEPENDENT_VILLA",
    "BUILDER_FLOOR",
    "COMMERCIAL_OFFICE",
    "COMMERCIAL_RETAIL",
    "INDUSTRIAL_PLOT",
]


class ValuationRequest(BaseModel):
    property_location: str = Field(default="Gurugram (Golf Course Extension)", description="City or micro-market")
    area_sqft: float = Field(..., gt=0, le=500000, description="Super built-up or carpet area in sq.ft")
    building_age_years: Optional[float] = Field(default=3.0, ge=0, le=100, description="Age of structure in years")
    property_type: PropertyType = Field(default="APARTMENT_HIGH_RISE", description="Property category")
    bedrooms_count: Optional[int] = Field(default=3, ge=0, le=20, description="BHK count if residential")
    amenities: list[str] = Field(
        default_factory=lambda: ["Gated Security", "Power Backup", "Covered Parking", "Clubhouse", "Lift"],
        description="Available property amenities",
    )
    is_metro_adjacent: bool = Field(default=True, description="Proximity (<1km) to Metro/Rapid Transit or Highway")
    project_id: Optional[str] = Field(default="PRJ-NH48-PKG3", description="Associated corridor project")


class ValueRangeINR(BaseModel):
    minimum_value_inr: float
    estimated_value_inr: float
    maximum_value_inr: float
    minimum_value_inr_lakhs: float
    estimated_value_inr_lakhs: float
    maximum_value_inr_lakhs: float
    estimated_value_inr_crores: float


class RentalYieldAnalysis(BaseModel):
    estimated_monthly_rent_inr: float
    estimated_annual_rent_inr: float
    gross_rental_yield_percent: float
    market_rental_band: str


class AppreciationProjection(BaseModel):
    forecast_horizon_years: int
    projected_cagr_percent: float
    projected_value_inr: float
    projected_value_inr_lakhs: float
    projected_value_inr_crores: float
    net_capital_gain_inr_lakhs: float
    drivers: list[str]


class ValuationResponse(BaseModel):
    project_id: str
    valuation_id: str
    timestamp_iso: str
    property_summary: dict
    market_value_range: ValueRangeINR
    rate_per_sqft_inr: float
    rate_per_sqft_range: dict
    rental_analysis: RentalYieldAnalysis
    appreciation_outlook: AppreciationProjection
    evaluated_amenities_premium_percent: float
    age_depreciation_factor: float
    assumptions_and_sources: list[str]
    provenance: Literal["AI_INFERRED", "CALCULATED_RISK"]
    disclaimer: str


# ---------------------------------------------------------------------------
# Indian Real Estate Micro-Market Base Rates (2024 Indicative Benchmarks)
# ---------------------------------------------------------------------------

MICRO_MARKET_BENCHMARKS = {
    # Gurugram (NH-48 Corridor)
    "Gurugram (Golf Course Extension)": {"base_sqft": 14500.0, "cagr": 8.5, "rent_yield": 3.4},
    "Gurugram (Cyber City / Phase 2)": {"base_sqft": 18500.0, "cagr": 7.8, "rent_yield": 3.8},
    "Gurugram (Sohna Road)": {"base_sqft": 9200.0, "cagr": 9.2, "rent_yield": 3.2},
    "Gurugram (New Gurgaon / Sector 82-95)": {"base_sqft": 8400.0, "cagr": 9.5, "rent_yield": 3.1},
    "Delhi NCR (South Delhi)": {"base_sqft": 24000.0, "cagr": 6.5, "rent_yield": 2.8},
    "Delhi NCR (Noida Expressway)": {"base_sqft": 8900.0, "cagr": 8.8, "rent_yield": 3.5},
    "Mumbai (BKC / Bandra)": {"base_sqft": 38000.0, "cagr": 6.8, "rent_yield": 3.2},
    "Mumbai (Andheri West)": {"base_sqft": 22000.0, "cagr": 7.0, "rent_yield": 3.4},
    "Bengaluru (Whitefield)": {"base_sqft": 9800.0, "cagr": 9.0, "rent_yield": 3.9},
    "Bengaluru (Indiranagar)": {"base_sqft": 17500.0, "cagr": 7.5, "rent_yield": 3.6},
    "Pune (Hinjawadi IT Corridor)": {"base_sqft": 7600.0, "cagr": 8.5, "rent_yield": 4.1},
    "Hyderabad (HITEC City / Gachibowli)": {"base_sqft": 10500.0, "cagr": 9.8, "rent_yield": 3.7},
}

PROPERTY_TYPE_MULTIPLIERS = {
    "APARTMENT_HIGH_RISE": 1.00,
    "INDEPENDENT_VILLA": 1.30,
    "BUILDER_FLOOR": 1.10,
    "COMMERCIAL_OFFICE": 1.35,
    "COMMERCIAL_RETAIL": 1.65,
    "INDUSTRIAL_PLOT": 0.70,
}

AMENITY_WEIGHTS = {
    "Gated Security": 1.5,
    "Power Backup": 2.0,
    "Covered Parking": 2.5,
    "Clubhouse": 1.5,
    "Lift": 2.0,
    "Swimming Pool": 1.0,
    "Gymnasium": 1.0,
    "EV Charging": 1.0,
    "Rooftop Solar": 1.5,
}


def calculate_property_valuation(req: ValuationRequest) -> ValuationResponse:
    """Calculate indicative real estate valuation per Indian market micro-benchmarks."""
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    val_id = f"VAL-{datetime.datetime.utcnow().strftime('%Y%m%d')}-{abs(hash(req.property_location + str(req.area_sqft))) % 10000:04d}"

    # 1. Match Location Benchmark or compute fallback
    loc_key = req.property_location
    if loc_key in MICRO_MARKET_BENCHMARKS:
        benchmark = MICRO_MARKET_BENCHMARKS[loc_key]
    else:
        # Fuzzy match or fallback
        matched = next((k for k in MICRO_MARKET_BENCHMARKS if any(part.lower() in k.lower() for part in loc_key.split())), None)
        if matched:
            benchmark = MICRO_MARKET_BENCHMARKS[matched]
            loc_key = matched
        else:
            # Default Indian Tier-1/2 benchmark
            benchmark = {"base_sqft": 8500.0, "cagr": 7.5, "rent_yield": 3.3}

    base_sqft = benchmark["base_sqft"]
    base_cagr = benchmark["cagr"]
    base_yield = benchmark["rent_yield"]

    # 2. Property Type Multiplier
    type_mult = PROPERTY_TYPE_MULTIPLIERS.get(req.property_type, 1.0)

    # 3. Age Depreciation / Appreciation Curve
    age = req.building_age_years if req.building_age_years is not None else 3.0
    if age <= 2.0:
        age_factor = 1.05  # New construction premium
    elif age <= 5.0:
        age_factor = 1.00  # Prime condition
    elif age <= 10.0:
        age_factor = 0.92  # Minor depreciation
    elif age <= 20.0:
        age_factor = 0.82  # Noticeable aging
    else:
        age_factor = max(0.60, 0.82 - ((age - 20) * 0.015))

    # 4. Amenities Premium
    amenities_premium_pct = 0.0
    for amen in req.amenities:
        for k, weight in AMENITY_WEIGHTS.items():
            if k.lower() in amen.lower():
                amenities_premium_pct += weight
                break
    amenities_mult = 1.0 + (min(amenities_premium_pct, 15.0) / 100.0)

    # 5. Infrastructure / Transit proximity adjustment
    transit_mult = 1.08 if req.is_metro_adjacent else 1.00

    # 6. Commercial Yield adjustment
    if "COMMERCIAL" in req.property_type:
        base_yield = 7.5  # Commercial yields in India are higher (7-9%)
        base_cagr = max(base_cagr, 8.5)

    # 7. Final Computed Unit Rate
    calculated_sqft_rate = round(base_sqft * type_mult * age_factor * amenities_mult * transit_mult, 1)

    min_sqft_rate = round(calculated_sqft_rate * 0.92, 1)
    max_sqft_rate = round(calculated_sqft_rate * 1.08, 1)

    estimated_total = round(calculated_sqft_rate * req.area_sqft, 2)
    min_total = round(min_sqft_rate * req.area_sqft, 2)
    max_total = round(max_sqft_rate * req.area_sqft, 2)

    # 8. Rental Income Potential
    effective_annual_yield = base_yield + (0.3 if amenities_premium_pct > 6 else 0.0)
    annual_rent = round(estimated_total * (effective_annual_yield / 100.0), 2)
    monthly_rent = round(annual_rent / 12.0, 2)

    # 9. 5-Year Capital Appreciation Outlook
    forecast_years = 5
    projected_cagr = base_cagr + (0.5 if req.is_metro_adjacent else 0.0)
    future_value = round(estimated_total * math.pow(1.0 + (projected_cagr / 100.0), forecast_years), 2)
    net_gain_lakhs = round((future_value - estimated_total) / 100000.0, 2)

    drivers = [
        f"Micro-market location in {loc_key} with baseline capital growth history.",
        f"Transit connectivity premium ({'+8%' if req.is_metro_adjacent else 'Standard'}) along corridor.",
        f"Amenity score contributing +{amenities_premium_pct:.1f}% value premium.",
        f"Structural age depreciation factor: {age_factor:.2f}x ({age:.0f} years old).",
    ]

    assumptions = [
        f"Baseline micro-market benchmark rate: ₹{base_sqft:,.0f}/sq.ft for {loc_key}.",
        f"Property type multiplier ({req.property_type}): {type_mult:.2f}x.",
        f"Age adjustment ({age:.0f} years): {age_factor:.2f}x.",
        f"Amenity uplift ({len(req.amenities)} detected): +{amenities_premium_pct:.1f}%.",
        f"Gross rental yield estimated at {effective_annual_yield:.2f}% p.a. based on prevailing local rental comps.",
        f"5-Year capital appreciation model assumes constant {projected_cagr:.1f}% CAGR.",
    ]

    disclaimer = (
        "VALUATION DECISION SUPPORT NOTICE: This property valuation is an AI-inferred indicative market estimate "
        "based on micro-market pricing benchmarks and parametric engineering adjustments. It does not constitute a "
        "statutory or RICS-certified appraisal. An on-site title verification, carpet area RERA audit, and chartered "
        "valuer inspection are required for formal financing and taxation."
    )

    return ValuationResponse(
        project_id=req.project_id or "PRJ-NH48-PKG3",
        valuation_id=val_id,
        timestamp_iso=now_iso,
        property_summary={
            "location": loc_key,
            "area_sqft": req.area_sqft,
            "property_type": req.property_type,
            "age_years": age,
            "bedrooms": req.bedrooms_count,
            "amenities_count": len(req.amenities),
        },
        market_value_range=ValueRangeINR(
            minimum_value_inr=min_total,
            estimated_value_inr=estimated_total,
            maximum_value_inr=max_total,
            minimum_value_inr_lakhs=round(min_total / 100000, 2),
            estimated_value_inr_lakhs=round(estimated_total / 100000, 2),
            maximum_value_inr_lakhs=round(max_total / 100000, 2),
            estimated_value_inr_crores=round(estimated_total / 10000000, 2),
        ),
        rate_per_sqft_inr=calculated_sqft_rate,
        rate_per_sqft_range={
            "min_rate_sqft": min_sqft_rate,
            "estimated_rate_sqft": calculated_sqft_rate,
            "max_rate_sqft": max_sqft_rate,
        },
        rental_analysis=RentalYieldAnalysis(
            estimated_monthly_rent_inr=monthly_rent,
            estimated_annual_rent_inr=annual_rent,
            gross_rental_yield_percent=round(effective_annual_yield, 2),
            market_rental_band=f"₹{round(monthly_rent*0.9, 0):,.0f} - ₹{round(monthly_rent*1.1, 0):,.0f} / month",
        ),
        appreciation_outlook=AppreciationProjection(
            forecast_horizon_years=forecast_years,
            projected_cagr_percent=round(projected_cagr, 1),
            projected_value_inr=future_value,
            projected_value_inr_lakhs=round(future_value / 100000, 2),
            projected_value_inr_crores=round(future_value / 10000000, 2),
            net_capital_gain_inr_lakhs=net_gain_lakhs,
            drivers=drivers,
        ),
        evaluated_amenities_premium_percent=amenities_premium_pct,
        age_depreciation_factor=age_factor,
        assumptions_and_sources=assumptions,
        provenance="AI_INFERRED",
        disclaimer=disclaimer,
    )
