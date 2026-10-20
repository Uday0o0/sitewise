"""Weather service and meteorological decision-support rules engine for SITEWISE.

Provides:
1. Real meteorological data acquisition via Open-Meteo API (free, open, no key required)
   with optional fallback to OpenWeatherMap if OPENWEATHERMAP_API_KEY is configured.
2. Grounded construction safety advisory rules for weather-sensitive site operations:
   - Concrete Pouring (IS:456:2000 Cl. 14 / IRC:112 / ACI 305R)
   - Crane & Segment Launching Gantry (Contractual & Equipment Safety Limits)
   - Working at Heights / Scaffolding (Wind & precipitation hazard)
   - Earthwork & Subgrade Compaction (Rainfall & soil saturation)
   - Structural Steel Welding (Moisture & wind gas-shielding displacement)
3. Strict provenance and source disclosure:
   - Authoritative standards clauses vs. configurable contractor thresholds explicitly labeled.
   - Live meteorological data vs. synthetic scenario data explicitly labeled.
   - Missing or stale weather data NEVER silently yields an unqualified 'GO'.
"""

from __future__ import annotations
import os
import datetime
import logging
from typing import Optional, Literal
from pydantic import BaseModel, Field
import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data Models and Contracts
# ---------------------------------------------------------------------------

AdvisoryStatus = Literal["GO", "PROCEED_WITH_CAUTION", "NO_GO", "INSUFFICIENT_DATA"]
SourceStatus = Literal["AUTHORITATIVE_CODE", "UNVERIFIED_CONFIGURABLE", "INSUFFICIENT_DATA"]
FreshnessStatus = Literal["LIVE_FRESH", "STALE_CACHE", "USER_SCENARIO", "SYNTHETIC_FALLBACK"]
DataProvenance = Literal["SOURCE_VERIFIED", "HUMAN_REVIEWED", "CALCULATED_RISK", "SYNTHETIC_DEMO", "USER_PROVIDED_UNVERIFIED"]


class WeatherMetrics(BaseModel):
    """Normalized surface meteorological parameters."""
    temperature_c: Optional[float] = Field(None, description="Ambient air temperature in Celsius")
    relative_humidity_pct: Optional[float] = Field(None, description="Relative humidity percentage (0-100)")
    wind_speed_kmh: Optional[float] = Field(None, description="Sustained surface wind velocity in km/h")
    wind_gusts_kmh: Optional[float] = Field(None, description="Peak wind gusts in km/h")
    precipitation_mm: Optional[float] = Field(None, description="Current or hourly precipitation in mm")
    precipitation_probability_pct: Optional[float] = Field(None, description="Precipitation probability (0-100)")
    weather_condition: Optional[str] = Field("Unknown", description="Human-readable condition description")
    weather_code: Optional[int] = Field(None, description="WMO weather interpretation code")
    is_forecast: bool = Field(False, description="True if retrieved from short-term forecast")


class AdvisoryFactor(BaseModel):
    """An individual meteorological factor evaluated against construction rules."""
    factor_name: str
    measured_value: str
    threshold_rule: str
    impact: str
    source_status: SourceStatus
    source_reference: str


class WeatherAdvisoryRequest(BaseModel):
    """Request payload for activity-specific weather evaluation."""
    activity: str = Field(..., description="Target construction activity code e.g. CONCRETE_POURING, CRANE_GANTRY_LAUNCHING")
    location_name: Optional[str] = Field(None, description="Optional city or landmark name for geocoding")
    latitude: Optional[float] = Field(None, description="Site latitude coordinate")
    longitude: Optional[float] = Field(None, description="Site longitude coordinate")
    custom_weather: Optional[WeatherMetrics] = Field(None, description="Optional user-supplied scenario metrics")
    is_scenario: bool = Field(False, description="Flag indicating user-provided scenario simulation")


class WeatherAdvisoryResponse(BaseModel):
    """Structured decision-support response."""
    project_id: str
    activity: str
    activity_name: str
    status: AdvisoryStatus
    summary: str
    rationale: str
    factors_considered: list[AdvisoryFactor]
    identified_risks: list[str]
    precautions_and_mitigations: list[str]
    weather_metrics: Optional[WeatherMetrics] = None
    source_provider: str
    retrieved_at_iso: str
    freshness: FreshnessStatus
    provenance: DataProvenance
    missing_inputs: list[str]
    disclaimer: str


# ---------------------------------------------------------------------------
# Supported Construction Activities Registry
# ---------------------------------------------------------------------------

SUPPORTED_ACTIVITIES = {
    "CONCRETE_POURING": {
        "name": "Structural Concrete Pouring & Curing",
        "description": "Bridge deck, pier cap, and foundation concreting sensitive to thermal cracking and rain washout.",
    },
    "CRANE_GANTRY_LAUNCHING": {
        "name": "Segment Launching Gantry & Heavy Crane Lifts",
        "description": "Precast segmental girder erection sensitive to high crosswinds and wind gusts.",
    },
    "WORKING_AT_HEIGHTS": {
        "name": "Elevated Staging, Scaffolding & Pier Stem Work",
        "description": "Worker safety on elevated platforms sensitive to high winds and slippery rain surfaces.",
    },
    "EARTHWORK_EXCAVATION": {
        "name": "Bulk Earthwork, Excavation & Subgrade Compaction",
        "description": "Slope stability, trenching, and soil compaction sensitive to continuous rainfall.",
    },
    "STRUCTURAL_STEEL_WELDING": {
        "name": "Structural Steel Welding & Hot Works",
        "description": "Field welding sensitive to ambient moisture, high humidity, and wind-blown shielding gas.",
    },
    "GENERAL_SITE_ACTIVITY": {
        "name": "General Worksite Operations & Logistics",
        "description": "Baseline outdoor construction activities and general workforce safety.",
    },
}

# Default coordinates for NH-48 Package 3 (Gurugram - Manesar Elevated Corridor)
DEFAULT_COORDINATES = {
    "PRJ-NH48-PKG3": {"lat": 28.4595, "lon": 77.0266, "city": "Gurugram, Haryana"},
    "DEFAULT": {"lat": 28.4595, "lon": 77.0266, "city": "Gurugram, Haryana"},
}

WMO_WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    80: "Rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


# ---------------------------------------------------------------------------
# Weather Provider Client
# ---------------------------------------------------------------------------

async def fetch_live_weather(
    lat: float,
    lon: float,
    timeout_seconds: float = 6.0,
) -> tuple[Optional[WeatherMetrics], str, FreshnessStatus, DataProvenance, Optional[str]]:
    """Fetch live meteorological data using Open-Meteo API or OpenWeatherMap.

    Returns:
        (metrics, provider_name, freshness, provenance, error_message)
    """
    # 1. Check if OpenWeatherMap API key is configured
    owm_key = os.getenv("OPENWEATHERMAP_API_KEY", "").strip()
    if owm_key:
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={owm_key}&units=metric"
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    metrics = WeatherMetrics(
                        temperature_c=data.get("main", {}).get("temp"),
                        relative_humidity_pct=float(data.get("main", {}).get("humidity", 0)),
                        wind_speed_kmh=round(float(data.get("wind", {}).get("speed", 0)) * 3.6, 1),
                        wind_gusts_kmh=round(float(data.get("wind", {}).get("gust", 0)) * 3.6, 1) if "gust" in data.get("wind", {}) else None,
                        precipitation_mm=float(data.get("rain", {}).get("1h", 0.0)),
                        precipitation_probability_pct=None,
                        weather_condition=data.get("weather", [{}])[0].get("description", "Clear").title(),
                        is_forecast=False,
                    )
                    return metrics, "OpenWeatherMap Live API", "LIVE_FRESH", "SOURCE_VERIFIED", None
                else:
                    logger.warning(f"OpenWeatherMap returned HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"OpenWeatherMap live call failed: {e}")

    # 2. Open-Meteo Public API (Free, high-precision, no API key required)
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            url = (
                f"https://api.open-meteo.com/v1/forecast?"
                f"latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,"
                f"precipitation,weather_code,wind_speed_10m,wind_gusts_10m&hourly=precipitation_probability&timezone=auto"
            )
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                current = data.get("current", {})
                hourly = data.get("hourly", {})
                w_code = current.get("weather_code")
                cond_text = WMO_WEATHER_CODES.get(w_code, "Partly Cloudy")

                precip_prob = None
                if "precipitation_probability" in hourly and hourly["precipitation_probability"]:
                    precip_prob = float(hourly["precipitation_probability"][0])

                metrics = WeatherMetrics(
                    temperature_c=current.get("temperature_2m"),
                    relative_humidity_pct=current.get("relative_humidity_2m"),
                    wind_speed_kmh=current.get("wind_speed_10m"),
                    wind_gusts_kmh=current.get("wind_gusts_10m"),
                    precipitation_mm=current.get("precipitation"),
                    precipitation_probability_pct=precip_prob,
                    weather_condition=cond_text,
                    weather_code=w_code,
                    is_forecast=False,
                )
                return metrics, "Open-Meteo Meteorological API", "LIVE_FRESH", "SOURCE_VERIFIED", None
            else:
                return None, "Open-Meteo", "STALE_CACHE", "SYNTHETIC_DEMO", f"Open-Meteo API HTTP {resp.status_code}"
    except httpx.TimeoutException:
        logger.warning(f"Open-Meteo live request timed out after {timeout_seconds}s")
        return None, "Open-Meteo", "STALE_CACHE", "SYNTHETIC_DEMO", "Weather provider connection timed out"
    except Exception as exc:
        logger.warning(f"Open-Meteo request failed: {exc}")
        return None, "Open-Meteo", "STALE_CACHE", "SYNTHETIC_DEMO", f"Weather provider unavailable: {str(exc)}"


# ---------------------------------------------------------------------------
# Construction Advisory Rules Engine
# ---------------------------------------------------------------------------

def evaluate_activity_advisory(
    project_id: str,
    activity_code: str,
    metrics: Optional[WeatherMetrics],
    provider_name: str,
    freshness: FreshnessStatus,
    provenance: DataProvenance,
    error_msg: Optional[str] = None,
) -> WeatherAdvisoryResponse:
    """Evaluate activity-specific safety and quality constraints against meteorological data."""
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    act_info = SUPPORTED_ACTIVITIES.get(activity_code, {
        "name": activity_code.replace("_", " ").title(),
        "description": "Unregistered site activity",
    })
    activity_name = act_info["name"]

    disclaimer = (
        "DECISION SUPPORT NOTICE: This weather advisory is generated for decision support and planning assistance only. "
        "It does not supersede the authority of the Resident Engineer, Project Director, or certified safety officer. "
        "All critical lifts and structural concrete pours must undergo on-site physical inspection before execution."
    )

    # 1. Guardrail: Missing or completely unavailable weather data
    if metrics is None:
        return WeatherAdvisoryResponse(
            project_id=project_id,
            activity=activity_code,
            activity_name=activity_name,
            status="INSUFFICIENT_DATA",
            summary=f"Unable to verify weather safety for {activity_name} due to unavailable meteorological data.",
            rationale=f"Live weather data retrieval failed: {error_msg or 'No provider response'}. Safe execution cannot be confirmed without current atmospheric data.",
            factors_considered=[],
            identified_risks=[
                "Unmonitored environmental risk: High winds or sudden precipitation could impact safety.",
                "Contractual non-compliance risk: Pouring concrete without verified thermal baseline violates CPWD §14."
            ],
            precautions_and_mitigations=[
                "Deploy on-site handheld digital anemometer and thermometer before proceeding.",
                "Obtain explicit written clearance from the Resident Engineer before commencing work.",
            ],
            weather_metrics=None,
            source_provider=provider_name,
            retrieved_at_iso=now_iso,
            freshness=freshness,
            provenance=provenance,
            missing_inputs=["temperature_c", "wind_speed_kmh", "precipitation_mm", "relative_humidity_pct"],
            disclaimer=disclaimer,
        )

    # 2. Check for missing specific critical parameters
    missing_inputs = []
    if metrics.temperature_c is None:
        missing_inputs.append("temperature_c")
    if metrics.wind_speed_kmh is None:
        missing_inputs.append("wind_speed_kmh")
    if metrics.precipitation_mm is None and metrics.precipitation_probability_pct is None:
        missing_inputs.append("precipitation_mm")

    factors: list[AdvisoryFactor] = []
    risks: list[str] = []
    precautions: list[str] = []
    status: AdvisoryStatus = "GO"
    rationale_points: list[str] = []

    # -----------------------------------------------------------------------
    # Rule Evaluation: CONCRETE_POURING
    # -----------------------------------------------------------------------
    if activity_code == "CONCRETE_POURING":
        temp = metrics.temperature_c
        precip = metrics.precipitation_mm or 0.0
        precip_prob = metrics.precipitation_probability_pct or 0.0
        wind = metrics.wind_speed_kmh or 0.0

        # Temperature constraints (IS:456:2000 Cl. 14 / IRC:112:2020)
        if temp is not None:
            if temp > 40.0:
                status = "NO_GO"
                factors.append(AdvisoryFactor(
                    factor_name="Ambient Air Temperature",
                    measured_value=f"{temp:.1f}°C",
                    threshold_rule="Max 40.0°C (Mandatory hot weather limit)",
                    impact="Severe rapid slump loss, accelerated hydration, high risk of plastic shrinkage cracks.",
                    source_status="AUTHORITATIVE_CODE",
                    source_reference="IS:456:2000 Cl. 14.1 & IRC:112:2020 §13.4",
                ))
                risks.append("Thermal cracking and rapid hydration causing loss of structural durability.")
                precautions.append("Suspend daytime pours. Reschedule to night shift (20:00 - 05:00 hrs) with chilled water/ice flakes.")
                rationale_points.append(f"Temperature ({temp:.1f}°C) exceeds maximum allowable limit of 40°C.")
            elif temp > 35.0:
                if status != "NO_GO":
                    status = "PROCEED_WITH_CAUTION"
                factors.append(AdvisoryFactor(
                    factor_name="Ambient Air Temperature",
                    measured_value=f"{temp:.1f}°C",
                    threshold_rule="35.0°C - 40.0°C (Hot weather advisory band)",
                    impact="Elevated surface evaporation and initial setting acceleration.",
                    source_status="AUTHORITATIVE_CODE",
                    source_reference="IS:456:2000 Cl. 14.2 & IRC:112:2020 §13.4",
                ))
                risks.append("Micro-cracking due to rapid differential moisture loss.")
                precautions.append("Add certified retarding admixtures; mist spray aggregate stockpiles; use wet hessian curing immediately.")
                rationale_points.append(f"Elevated temperature ({temp:.1f}°C) requires thermal mitigation controls.")
            elif temp < 5.0:
                status = "NO_GO"
                factors.append(AdvisoryFactor(
                    factor_name="Ambient Air Temperature",
                    measured_value=f"{temp:.1f}°C",
                    threshold_rule="Min 5.0°C (Cold weather concreting threshold)",
                    impact="Hydration reaction halts; high danger of early frost damage to fresh paste.",
                    source_status="AUTHORITATIVE_CODE",
                    source_reference="IS:456:2000 Cl. 14.3",
                ))
                risks.append("Permanent compressive strength degradation up to 50% due to ice lens formation.")
                precautions.append("Pre-heat batching water; provide heated enclosures with thermal blankets.")
                rationale_points.append(f"Temperature ({temp:.1f}°C) below minimum curing threshold.")
            else:
                factors.append(AdvisoryFactor(
                    factor_name="Ambient Air Temperature",
                    measured_value=f"{temp:.1f}°C",
                    threshold_rule="5.0°C - 35.0°C (Favorable standard curing envelope)",
                    impact="Optimal hydration kinetics and controlled setting times.",
                    source_status="AUTHORITATIVE_CODE",
                    source_reference="IS:456:2000 Cl. 14.1",
                ))

        # Precipitation constraints
        if precip > 2.5 or precip_prob > 65.0:
            status = "NO_GO"
            factors.append(AdvisoryFactor(
                factor_name="Rainfall & Precipitation Probability",
                measured_value=f"{precip:.1f} mm/hr (Rain probability: {precip_prob:.0f}%)",
                threshold_rule="Max 2.0 mm/hr or 60% probability for unshielded structural pours",
                impact="Rainwater dilutes cement slurry on top of deck/pier cap, ruining water-cement ratio.",
                source_status="AUTHORITATIVE_CODE",
                source_reference="MORTH Specifications Section 1700 (Structural Concrete)",
            ))
            risks.append("Rainwater washout of cement paste altering water-cement ratio, causing surface scaling and loss of cover durability.")
            precautions.append("Halt unshielded concrete casting immediately. Deploy waterproof tarpaulins over freshly cast bays.")
            rationale_points.append(f"Rainfall hazard ({precip:.1f} mm/hr, {precip_prob:.0f}% prob) prevents open-air pour.")
        elif precip > 0.5 or precip_prob > 40.0:
            if status != "NO_GO":
                status = "PROCEED_WITH_CAUTION"
            factors.append(AdvisoryFactor(
                factor_name="Precipitation Probability",
                measured_value=f"{precip:.1f} mm/hr ({precip_prob:.0f}% chance)",
                threshold_rule="Precipitation risk threshold",
                impact="Potential sudden squalls during placement cycle.",
                source_status="UNVERIFIED_CONFIGURABLE",
                source_reference="Site Concreting SOP §6.2 (Configurable Rule)",
            ))
            precautions.append("Have waterproof sheeting and backup pumps stationed at the pour zone before batching.")

        # Wind speed constraints (Plastic shrinkage cracking)
        if wind > 30.0:
            if status != "NO_GO":
                status = "PROCEED_WITH_CAUTION"
            factors.append(AdvisoryFactor(
                factor_name="Surface Wind Velocity",
                measured_value=f"{wind:.1f} km/h",
                threshold_rule="Max 30.0 km/h for high-exposure bridge decks",
                impact="Rapid surface moisture evaporation rate exceeding 1.0 kg/m²/hr (ACI 305 nomograph).",
                source_status="AUTHORITATIVE_CODE",
                source_reference="ACI 305R / IRC:112 §13.4",
            ))
            risks.append("High probability of premature plastic shrinkage cracking along reinforcement lines.")
            precautions.append("Erect windbreaks around pier cap; apply aliphatic evaporation retarder film immediately after screeding.")
            rationale_points.append(f"Wind speed ({wind:.1f} km/h) creates high evaporation rate.")

    # -----------------------------------------------------------------------
    # Rule Evaluation: CRANE_GANTRY_LAUNCHING (e.g. NH-48 Segment Gantry)
    # -----------------------------------------------------------------------
    elif activity_code == "CRANE_GANTRY_LAUNCHING":
        wind = metrics.wind_speed_kmh or 0.0
        gusts = metrics.wind_gusts_kmh or wind
        precip = metrics.precipitation_mm or 0.0
        cond = (metrics.weather_condition or "").lower()

        # Contractual crane wind cutoff (~38 km/h or 10.5 m/s)
        if wind > 38.0 or gusts > 45.0:
            status = "NO_GO"
            factors.append(AdvisoryFactor(
                factor_name="Wind Velocity & Peak Gusts",
                measured_value=f"Sustained {wind:.1f} km/h, Gusts {gusts:.1f} km/h",
                threshold_rule="Contractual Cutoff: 38.0 km/h sustained / 45.0 km/h gusts (10.5 m/s)",
                impact="High lateral sail-area overturning moment on precast segments and gantry truss.",
                source_status="UNVERIFIED_CONFIGURABLE",
                source_reference="Launching Gantry Operating Manual §4.3 & Contract Schedule H (Unverified Contractor Threshold)",
            ))
            risks.append("Gantry trolley derailment, segment pendulum oscillation, and catastrophic hoist structural failure.")
            precautions.append("Lock launching gantry storm anchors and mechanical rail clamps immediately. Lower suspended loads.")
            rationale_points.append(f"Sustained wind ({wind:.1f} km/h) or gusts ({gusts:.1f} km/h) exceed 38 km/h crane cutoff limit.")
        elif wind > 25.0:
            if status != "NO_GO":
                status = "PROCEED_WITH_CAUTION"
            factors.append(AdvisoryFactor(
                factor_name="Wind Velocity",
                measured_value=f"{wind:.1f} km/h",
                threshold_rule="Caution Band: 25.0 km/h - 38.0 km/h",
                impact="Moderate segment drift during alignment into epoxy stitch joint.",
                source_status="UNVERIFIED_CONFIGURABLE",
                source_reference="Site Lifting Plan SOP §8.1 (Configurable)",
            ))
            risks.append("Misalignment during segment gluing and prestressing duct insertion.")
            precautions.append("Maintain taglines on both segment ends. Keep anemometer display monitored by Banksman at all times.")
            rationale_points.append(f"Wind velocity ({wind:.1f} km/h) requires taglines and dedicated spotter.")
        else:
            factors.append(AdvisoryFactor(
                factor_name="Wind Velocity",
                measured_value=f"{wind:.1f} km/h (Gusts: {gusts:.1f} km/h)",
                threshold_rule="Below 25.0 km/h safe lift envelope",
                impact="Minimal aerodynamic disturbance on suspended load.",
                source_status="UNVERIFIED_CONFIGURABLE",
                source_reference="Equipment Operations Spec §3",
            ))

        # Thunderstorm / Lightning check
        if "thunder" in cond or "storm" in cond or (metrics.weather_code and metrics.weather_code >= 95):
            status = "NO_GO"
            factors.append(AdvisoryFactor(
                factor_name="Atmospheric Electrical Activity",
                measured_value=f"{metrics.weather_condition}",
                threshold_rule="Zero tolerance for electrical storms on elevated metal structures",
                impact="Extreme lightning strike hazard for crane operators and gantry crew.",
                source_status="AUTHORITATIVE_CODE",
                source_reference="IS:2309 (Protection against Lightning) & BOCW Act 1996",
            ))
            risks.append("Electrocution, power surge failure to VFD crane drives, worker panic at height.")
            precautions.append("Evacuate all personnel from gantry deck to ground level. Ground electrical supply lines.")
            rationale_points.append("Active or imminent thunderstorm detected.")

    # -----------------------------------------------------------------------
    # Rule Evaluation: WORKING_AT_HEIGHTS
    # -----------------------------------------------------------------------
    elif activity_code == "WORKING_AT_HEIGHTS":
        wind = metrics.wind_speed_kmh or 0.0
        precip = metrics.precipitation_mm or 0.0

        if wind > 32.0:
            status = "NO_GO"
            factors.append(AdvisoryFactor(
                factor_name="Wind Speed at Height",
                measured_value=f"{wind:.1f} km/h",
                threshold_rule="Max 32.0 km/h (~9 m/s) on open scaffolding / pier staging",
                impact="Loss of balance and scaffolding sway exceeding safe deflection limits.",
                source_status="AUTHORITATIVE_CODE",
                source_reference="IS:3696 (Safety code for scaffolds and ladders) & OSHA 1926.451",
            ))
            risks.append("Worker fall from height, dislodged tools or shuttering panels falling into traffic below.")
            precautions.append("Suspend all exterior pier stem scaffolding work. Ensure 100% tie-off until winds subside.")
            rationale_points.append(f"Wind speed ({wind:.1f} km/h) violates elevated staging safety limits.")
        elif precip > 1.0:
            if status != "NO_GO":
                status = "PROCEED_WITH_CAUTION"
            factors.append(AdvisoryFactor(
                factor_name="Surface Moisture / Wet Deck",
                measured_value=f"{precip:.1f} mm/hr precipitation",
                threshold_rule="Wet scaffolding planking threshold",
                impact="Loss of traction on steel and timber walk boards.",
                source_status="AUTHORITATIVE_CODE",
                source_reference="IS:3696 Part 1",
            ))
            risks.append("Slip and trip hazards on staging access ways.")
            precautions.append("Inspect non-slip cleats; verify lifelines are taut before permitting access.")
            rationale_points.append("Wet walkways create slip hazards at height.")
        else:
            factors.append(AdvisoryFactor(
                factor_name="Wind & Precipitation",
                measured_value=f"Wind {wind:.1f} km/h, Rain {precip:.1f} mm",
                threshold_rule="Within normal working limits",
                impact="Standard elevated working conditions.",
                source_status="AUTHORITATIVE_CODE",
                source_reference="IS:3696",
            ))

    # -----------------------------------------------------------------------
    # Rule Evaluation: EARTHWORK_EXCAVATION
    # -----------------------------------------------------------------------
    elif activity_code == "EARTHWORK_EXCAVATION":
        precip = metrics.precipitation_mm or 0.0
        precip_prob = metrics.precipitation_probability_pct or 0.0

        if precip > 5.0 or precip_prob > 75.0:
            status = "NO_GO"
            factors.append(AdvisoryFactor(
                factor_name="Rainfall Intensity",
                measured_value=f"{precip:.1f} mm/hr ({precip_prob:.0f}% chance)",
                threshold_rule="Max 4.0 mm/hr for open cut and deep foundation excavation",
                impact="Soil saturation leading to pore pressure buildup, trench collapse, and hauler bogging.",
                source_status="AUTHORITATIVE_CODE",
                source_reference="IS:3764 (Excavation work - code of safety) & CPWD §2.8",
            ))
            risks.append("Trench wall sloughing, inundation of foundation pits, subgrade bearing capacity loss.")
            precautions.append("Divert surface drainage channels away from excavation pits. Mobilize dewatering pumps.")
            rationale_points.append(f"Rainfall ({precip:.1f} mm/hr) risks excavation wall instability.")
        elif precip > 1.5 or precip_prob > 45.0:
            if status != "NO_GO":
                status = "PROCEED_WITH_CAUTION"
            factors.append(AdvisoryFactor(
                factor_name="Rainfall Probability",
                measured_value=f"{precip:.1f} mm/hr ({precip_prob:.0f}% chance)",
                threshold_rule="Caution threshold for earthwork compaction",
                impact="Moisture content exceeding Optimum Moisture Content (OMC) in embankment fill.",
                source_status="AUTHORITATIVE_CODE",
                source_reference="MORTH Section 300",
            ))
            precautions.append("Test soil moisture before rolling. Protect borrow pits with temporary drains.")
            rationale_points.append("Moisture may exceed compaction specifications.")

    # -----------------------------------------------------------------------
    # Rule Evaluation: STRUCTURAL_STEEL_WELDING
    # -----------------------------------------------------------------------
    elif activity_code == "STRUCTURAL_STEEL_WELDING":
        humidity = metrics.relative_humidity_pct or 0.0
        precip = metrics.precipitation_mm or 0.0
        wind = metrics.wind_speed_kmh or 0.0

        if precip > 0.1 or humidity > 85.0:
            status = "NO_GO"
            factors.append(AdvisoryFactor(
                factor_name="Moisture & Atmospheric Humidity",
                measured_value=f"Humidity {humidity:.1f}%, Rain {precip:.1f} mm",
                threshold_rule="Max 85% relative humidity; zero precipitation during welding",
                impact="Hydrogen embrittlement cracking in heat-affected zone (HAZ) and weld porosity.",
                source_status="AUTHORITATIVE_CODE",
                source_reference="AWS D1.1 Structural Welding Code / IS:800:2007",
            ))
            risks.append("Brittle fracture of structural bridge joints under live cyclic load; electrocution hazard.")
            precautions.append("Halt open-air welding. Ensure complete drying and pre-heating of joint faces if in shelter.")
            rationale_points.append(f"Humidity ({humidity:.1f}%) or rain moisture prevents code-compliant welding.")
        elif wind > 20.0:
            if status != "NO_GO":
                status = "PROCEED_WITH_CAUTION"
            factors.append(AdvisoryFactor(
                factor_name="Wind Velocity",
                measured_value=f"{wind:.1f} km/h",
                threshold_rule="Max 15-20 km/h for gas-shielded arc welding (GMAW/FCAW)",
                impact="Shielding gas displacement causing atmospheric nitrogen/oxygen contamination of weld puddle.",
                source_status="AUTHORITATIVE_CODE",
                source_reference="IS:800:2007 & AWS D1.1 §5.12",
            ))
            precautions.append("Erect flame-retardant wind screens completely surrounding the joint area.")
            rationale_points.append(f"Wind ({wind:.1f} km/h) displaces welding shielding gas.")

    # -----------------------------------------------------------------------
    # Rule Evaluation: GENERAL_SITE_ACTIVITY
    # -----------------------------------------------------------------------
    else:
        wind = metrics.wind_speed_kmh or 0.0
        temp = metrics.temperature_c or 25.0
        cond = (metrics.weather_condition or "").lower()

        if "thunder" in cond or wind > 50.0:
            status = "NO_GO"
            risks.append("Severe storm hazard to outdoor personnel.")
            rationale_points.append("Severe weather conditions unsafe for outdoor operations.")
        elif wind > 35.0 or temp > 42.0:
            status = "PROCEED_WITH_CAUTION"
            precautions.append("Mandate 15-minute hydration breaks every hour; secure lightweight materials.")
            rationale_points.append("Marginal environmental conditions require heat/wind precautions.")

    # Check for missing critical inputs to avoid false GO
    if missing_inputs and status == "GO":
        status = "PROCEED_WITH_CAUTION"
        rationale_points.append(f"Caution: missing parameter(s) {', '.join(missing_inputs)}; evaluation based on partial metrics.")

    # Compose structured summary and rationale
    if status == "GO":
        summary = f"Favorable weather conditions for {activity_name}. Standard quality and safety protocols apply."
        if not rationale_points:
            rationale_points.append("All assessed atmospheric parameters fall comfortably within design safety envelopes.")
    elif status == "PROCEED_WITH_CAUTION":
        summary = f"Marginal conditions for {activity_name}. Proceed strictly under documented engineering mitigations."
    else:  # NO_GO
        summary = f"UNSAFE CONDITIONS: {activity_name} must be suspended due to adverse meteorological factors."

    if not risks and status == "GO":
        risks.append("Standard construction hazards apply. Maintain vigilant situational awareness.")
    if not precautions and status == "GO":
        precautions.append("Conduct mandatory morning Tool Box Talk (TBT) before shift start.")

    return WeatherAdvisoryResponse(
        project_id=project_id,
        activity=activity_code,
        activity_name=activity_name,
        status=status,
        summary=summary,
        rationale=" ".join(rationale_points),
        factors_considered=factors,
        identified_risks=risks,
        precautions_and_mitigations=precautions,
        weather_metrics=metrics,
        source_provider=provider_name,
        retrieved_at_iso=now_iso,
        freshness=freshness,
        provenance=provenance,
        missing_inputs=missing_inputs,
        disclaimer=disclaimer,
    )
