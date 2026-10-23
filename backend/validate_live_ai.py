#!/usr/bin/env python3
"""SITEWISE V4.2 — Live Multimodal AI Integration Diagnostic Tool.

Safely checks AI provider configuration, multimodal reasoning capabilities,
and structured Pydantic schema validation using the project's existing
provider implementations in services.ai_provider.

SECURITY GUARANTEES:
1. Never logs, prints, or exposes API key values.
2. Never makes live external calls unless --live is explicitly passed.
3. Uses safe local image fixtures without committing sensitive data.
4. Validates output strictly against existing Pydantic schemas.
"""

from __future__ import annotations
import os
import sys
import argparse
import asyncio
import io
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from PIL import Image, ImageDraw

# Add backend directory to sys.path so services.* can be imported cleanly
_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from services.ai_provider import (
    FeatureIdentifier,
    ReasoningRequest,
    ReasoningResponse,
    execute_reasoning,
    get_active_provider_name,
    get_active_model_name,
    is_provider_available,
    get_provider_info,
    SafetyMonitoringOutput,
    CrackDetectionOutput,
    PlanningValuationOutput,
    AdvisoryChatbotOutput,
)


def get_safe_image_fixture(custom_path: Optional[str] = None) -> Tuple[bytes, str, str]:
    """Retrieve or synthesize a safe, non-sensitive image fixture for multimodal testing.
    
    Returns:
        (image_bytes, mime_type, source_description)
    """
    if custom_path:
        p = Path(custom_path)
        if p.is_file():
            raw = p.read_bytes()
            suffix = p.suffix.lower()
            mime = "image/png" if suffix == ".png" else "image/jpeg"
            return raw, mime, f"User-specified local file: {p.name} ({len(raw)} bytes)"
        else:
            raise FileNotFoundError(f"Custom image fixture not found at: {custom_path}")

    # Check for repository sample_crack.jpg
    repo_root = _backend_dir.parent
    sample_crack = repo_root / "sample_crack.jpg"
    if sample_crack.is_file():
        raw = sample_crack.read_bytes()
        return raw, "image/jpeg", f"Repository safe fixture: sample_crack.jpg ({len(raw)} bytes)"

    # Fallback to generating a deterministic in-memory synthetic worksite test image
    img = Image.new("RGB", (320, 240), color=(180, 180, 180))
    draw = ImageDraw.Draw(img)
    # Draw simulated safety vest and concrete seam
    draw.rectangle([60, 60, 140, 180], fill=(255, 140, 0))  # High-vis orange
    draw.line([160, 40, 260, 200], fill=(50, 50, 50), width=3)  # Transverse surface crack
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    raw = buf.getvalue()
    return raw, "image/jpeg", f"In-memory synthetic fixture: 320x240 JPEG ({len(raw)} bytes)"


def check_provider_configuration(forced_provider: Optional[str] = None) -> Dict[str, Any]:
    """Inspect provider configuration without exposing secret key values."""
    if forced_provider:
        os.environ["SITEWISE_AI_PROVIDER"] = forced_provider

    provider = get_active_provider_name()
    model = get_active_model_name()
    configured = is_provider_available()

    # Determine credential presence safely (boolean only)
    groq_present = bool(os.getenv("GROQ_API_KEY", "").strip())
    gemini_present = bool(os.getenv("GEMINI_API_KEY", "").strip())

    multimodal_support = {
        "gemini": "Native (Image tensors passed directly to generate_content_async)",
        "groq": "Contextual (Image metadata and dimensions contextualized in system prompt)",
    }.get(provider, "None")

    return {
        "active_provider": provider,
        "active_model": model,
        "is_configured": configured,
        "groq_key_detected": groq_present,
        "gemini_key_detected": gemini_present,
        "multimodal_support": multimodal_support,
    }


async def run_ai_diagnostics(
    live: bool = False,
    forced_provider: Optional[str] = None,
    feature: str = "safety_monitoring",
    image_path: Optional[str] = None,
    timeout_seconds: int = 30,
) -> Dict[str, Any]:
    """Execute complete diagnostic evaluation for AI reasoning engine."""
    report: Dict[str, Any] = {
        "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "live_mode": live,
        "provider_config": check_provider_configuration(forced_provider),
        "checks": [],
        "overall_status": "PENDING",
        "error": None,
    }

    cfg = report["provider_config"]

    # Check 1: Provider Configuration
    if not cfg["is_configured"]:
        msg = (
            f"Provider '{cfg['active_provider']}' is NOT configured with API credentials. "
            f"To configure: set GROQ_API_KEY or GEMINI_API_KEY in backend/.env or system environment."
        )
        report["checks"].append({
            "name": "Provider Credential Check",
            "passed": False,
            "message": msg
        })
        report["overall_status"] = "CONFIGURATION_MISSING"
        report["error"] = msg
        return report

    report["checks"].append({
        "name": "Provider Credential Check",
        "passed": True,
        "message": f"Provider '{cfg['active_provider']}' configured with model '{cfg['active_model']}'."
    })

    # Check 2: Image Fixture Resolution
    try:
        img_bytes, img_mime, img_desc = get_safe_image_fixture(image_path)
        report["checks"].append({
            "name": "Image Fixture Resolution",
            "passed": True,
            "message": f"Loaded {img_desc}"
        })
    except Exception as e:
        report["checks"].append({
            "name": "Image Fixture Resolution",
            "passed": False,
            "message": f"Failed to resolve image fixture: {e}"
        })
        report["overall_status"] = "FIXTURE_ERROR"
        report["error"] = str(e)
        return report

    # Check 3: Live vs Offline Enforcement
    if not live:
        report["checks"].append({
            "name": "Live Execution Gate",
            "passed": True,
            "message": "Live request skipped (--live flag not supplied). Offline diagnostic verification complete."
        })
        report["overall_status"] = "OFFLINE_SUCCESS"
        return report

    # Check 4: Live Multimodal AI Reasoning Execution
    try:
        feat_enum = FeatureIdentifier(feature)
    except ValueError:
        feat_enum = FeatureIdentifier.SAFETY_MONITORING

    prompt = (
        "Perform worksite safety inspection on this construction area. "
        "Check worker PPE compliance (helmets, high-vis vests), fall hazards, and scaffolding. "
        "Respond strictly with the required JSON schema."
    )

    req = ReasoningRequest(
        feature=feat_enum,
        prompt=prompt,
        image_bytes=img_bytes,
        image_mime=img_mime,
        context_data={
            "site_location": "Chainage 18+200 Pier 18 Cap",
            "operation": "Elevated Staging & Prestressing Duct Inspection",
            "image_size_bytes": len(img_bytes),
        }
    )

    start_t = time.time()
    try:
        response: ReasoningResponse = await asyncio.wait_for(
            execute_reasoning(req),
            timeout=float(timeout_seconds)
        )
    except asyncio.TimeoutError:
        err = f"Live request to {cfg['active_provider']} timed out after {timeout_seconds} seconds."
        report["checks"].append({
            "name": "Live Request Execution",
            "passed": False,
            "message": err
        })
        report["overall_status"] = "TIMEOUT"
        report["error"] = err
        return report
    except Exception as exc:
        err = f"Live request to {cfg['active_provider']} failed: {exc}"
        report["checks"].append({
            "name": "Live Request Execution",
            "passed": False,
            "message": err
        })
        report["overall_status"] = "EXECUTION_ERROR"
        report["error"] = err
        return report

    elapsed_ms = int((time.time() - start_t) * 1000)

    # Check 5: Response Status & Error Handling
    if response.status in ("PROVIDER_ERROR", "PROVIDER_UNAVAILABLE") or response.error:
        err_msg = response.error or f"Status: {response.status}"
        # Classify known API issues for clear actionable diagnosis
        lower_err = err_msg.lower()
        if "401" in lower_err or "invalid_api_key" in lower_err or "unauthorized" in lower_err:
            category = "AUTHENTICATION_FAILED (Invalid or expired API key)"
        elif "429" in lower_err or "rate_limit" in lower_err or "tokens per minute" in lower_err:
            category = "RATE_LIMIT_EXCEEDED (Provider quota/rate limits reached)"
        elif "timeout" in lower_err:
            category = "NETWORK_TIMEOUT"
        else:
            category = "PROVIDER_API_ERROR"

        diag_msg = f"{category}: {err_msg}"
        report["checks"].append({
            "name": "Live Request Execution",
            "passed": False,
            "message": diag_msg,
        })
        report["overall_status"] = "PROVIDER_ERROR"
        report["error"] = diag_msg
        return report

    report["checks"].append({
        "name": "Live Request Execution",
        "passed": True,
        "message": f"Successfully received response from {response.provider} ({response.model}) in {elapsed_ms}ms (Provenance: {response.provenance})."
    })

    # Validate against target schema using existing Pydantic models
    schema_cls_map = {
        FeatureIdentifier.SAFETY_MONITORING: SafetyMonitoringOutput,
        FeatureIdentifier.CRACK_DETECTION: CrackDetectionOutput,
        FeatureIdentifier.PLANNING_VALUATION: PlanningValuationOutput,
        FeatureIdentifier.ADVISORY_CHATBOT: AdvisoryChatbotOutput,
    }
    schema_cls = schema_cls_map.get(feat_enum, SafetyMonitoringOutput)
    validated = response.validated_data or {}
    schema_valid = False
    schema_details = ""
    try:
        schema_instance = schema_cls.model_validate(validated)
        schema_valid = True
        schema_details = f"Validated as {schema_cls.__name__} ({len(schema_instance.model_dump())} fields)"
    except Exception as val_err:
        schema_valid = False
        schema_details = f"Pydantic validation failed for {schema_cls.__name__}: {val_err}"

    report["checks"].append({
        "name": "Structured Schema Validation",
        "passed": schema_valid,
        "message": f"Schema compliance: {schema_details} (Status: {response.status})"
    })

    report["overall_status"] = "SUCCESS" if schema_valid else "SCHEMA_INVALID"
    report["live_response"] = {
        "provider": response.provider,
        "model": response.model,
        "provenance": response.provenance,
        "status": response.status,
        "latency_ms": elapsed_ms,
        "validated_keys": list(validated.keys()),
    }
    return report


def main():
    parser = argparse.ArgumentParser(description="SITEWISE AI Provider & Multimodal Diagnostic Utility")
    parser.add_argument("--live", action="store_true", help="Explicitly enable live external API call (costs tokens / requires key)")
    parser.add_argument("--provider", choices=["groq", "gemini", "auto"], default=None, help="Force specific provider")
    parser.add_argument("--feature", choices=["safety_monitoring", "crack_detection", "planning_valuation", "advisory_chatbot"], default="safety_monitoring", help="Reasoning feature schema to test")
    parser.add_argument("--image", type=str, default=None, help="Path to image fixture (default: sample_crack.jpg or synthetic)")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds")

    args = parser.parse_args()

    print("=" * 65)
    print(" SITEWISE V4.2 -- AI Provider & Multimodal Diagnostic")
    print("=" * 65)

    report = asyncio.run(run_ai_diagnostics(
        live=args.live,
        forced_provider=args.provider,
        feature=args.feature,
        image_path=args.image,
        timeout_seconds=args.timeout,
    ))

    cfg = report["provider_config"]
    print(f"Active Provider  : {cfg['active_provider']}")
    print(f"Active Model     : {cfg['active_model']}")
    print(f"Credentials State: {'Configured' if cfg['is_configured'] else 'NOT Configured'}")
    print(f"Groq Key Present : {'Yes' if cfg['groq_key_detected'] else 'No'}")
    print(f"Gemini Key Present: {'Yes' if cfg['gemini_key_detected'] else 'No'}")
    print(f"Multimodal Mode  : {cfg['multimodal_support']}")
    print(f"Execution Mode   : {'LIVE API Request' if report['live_mode'] else 'OFFLINE Diagnostic (dry-run)'}")
    print("-" * 65)

    print("Diagnostic Checks:")
    for c in report["checks"]:
        icon = "[PASS]" if c["passed"] else "[FAIL]"
        print(f"  {icon} {c['name']}: {c['message']}")

    print("-" * 65)
    print(f"Overall Result   : {report['overall_status']}")

    if "live_response" in report:
        lr = report["live_response"]
        print(f"  Latency        : {lr['latency_ms']} ms")
        print(f"  Provenance     : {lr['provenance']}")
        print(f"  Validated Keys : {', '.join(lr['validated_keys'])}")

    if report["overall_status"] in ("SUCCESS", "OFFLINE_SUCCESS"):
        sys.exit(0)
    elif report["overall_status"] == "CONFIGURATION_MISSING":
        sys.exit(2)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
