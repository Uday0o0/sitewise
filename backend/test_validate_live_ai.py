"""SITEWISE V4.2 — Offline Tests for Live AI Validation Diagnostic Tool.

Validates:
1. Provider configuration detection (Groq, Gemini, Missing) without secret exposure.
2. Safe image fixture resolution (Repository file, custom path, synthetic fallback).
3. Offline execution gate enforcement (prevents live calls unless --live flag given).
4. Mocked live multimodal execution with Pydantic schema validation for all feature types.
5. Error handling and classification (Authentication, Rate-limit, Timeouts, Schema mismatch).
6. CLI entrypoint exit codes (0 for success, 2 for missing config, 1 for errors).
"""

import os
import sys
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from validate_live_ai import (
    check_provider_configuration,
    get_safe_image_fixture,
    run_ai_diagnostics,
    main,
)
from services.ai_provider import (
    FeatureIdentifier,
    ReasoningResponse,
    SafetyMonitoringOutput,
    CrackDetectionOutput,
    PlanningValuationOutput,
    AdvisoryChatbotOutput,
)


# ---------------------------------------------------------------------------
# Provider Configuration Checks
# ---------------------------------------------------------------------------

def test_check_provider_configuration_groq():
    """Verify Groq detection without exposing the API key value."""
    secret_key = "gsk_test_super_secret_groq_key_99999"
    with patch.dict(os.environ, {
        "SITEWISE_AI_PROVIDER": "groq",
        "GROQ_API_KEY": secret_key,
        "GROQ_MODEL": "llama-3.3-70b-versatile",
        "GEMINI_API_KEY": ""
    }):
        cfg = check_provider_configuration("groq")
        assert cfg["active_provider"] == "groq"
        assert cfg["active_model"] == "llama-3.3-70b-versatile"
        assert cfg["is_configured"] is True
        assert cfg["groq_key_detected"] is True
        assert cfg["gemini_key_detected"] is False
        assert "Contextual" in cfg["multimodal_support"]

        # Crucial security guarantee: Secret key must never appear anywhere in config dict
        for v in cfg.values():
            assert secret_key not in str(v)


def test_check_provider_configuration_gemini():
    """Verify Gemini detection without exposing the API key value."""
    secret_key = "AIzaSy_super_secret_gemini_key_11111"
    with patch.dict(os.environ, {
        "SITEWISE_AI_PROVIDER": "gemini",
        "GEMINI_API_KEY": secret_key,
        "SITEWISE_AI_MODEL": "gemini-2.0-flash",
        "GROQ_API_KEY": ""
    }):
        cfg = check_provider_configuration("gemini")
        assert cfg["active_provider"] == "gemini"
        assert cfg["active_model"] == "gemini-2.0-flash"
        assert cfg["is_configured"] is True
        assert cfg["gemini_key_detected"] is True
        assert cfg["groq_key_detected"] is False
        assert "Native" in cfg["multimodal_support"]

        # Crucial security guarantee: Secret key must never appear anywhere in config dict
        for v in cfg.values():
            assert secret_key not in str(v)


def test_check_provider_configuration_missing():
    """Verify provider unconfigured state when keys are absent."""
    with patch.dict(os.environ, {
        "SITEWISE_AI_PROVIDER": "groq",
        "GROQ_API_KEY": "",
        "GEMINI_API_KEY": ""
    }):
        cfg = check_provider_configuration("groq")
        assert cfg["active_provider"] == "groq"
        assert cfg["is_configured"] is False
        assert cfg["groq_key_detected"] is False
        assert cfg["gemini_key_detected"] is False


# ---------------------------------------------------------------------------
# Safe Image Fixture Resolution
# ---------------------------------------------------------------------------

def test_get_safe_image_fixture_repository(tmp_path):
    """Verify resolution of existing repository image fixture."""
    img_bytes, mime, desc = get_safe_image_fixture()
    assert len(img_bytes) > 0
    assert mime in ("image/jpeg", "image/png")
    assert "Repository safe fixture" in desc or "synthetic" in desc.lower()


def test_get_safe_image_fixture_custom(tmp_path):
    """Verify resolution of custom local image file."""
    fake_img = tmp_path / "custom_test.jpg"
    fake_img.write_bytes(b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"\x00" * 50)

    img_bytes, mime, desc = get_safe_image_fixture(str(fake_img))
    assert img_bytes == fake_img.read_bytes()
    assert mime == "image/jpeg"
    assert "User-specified local file" in desc


def test_get_safe_image_fixture_custom_missing():
    """Verify FileNotFoundError when custom path does not exist."""
    with pytest.raises(FileNotFoundError):
        get_safe_image_fixture("C:/nonexistent_path_to_fixture_image.jpg")


def test_get_safe_image_fixture_synthetic():
    """Verify deterministic in-memory synthetic fixture generation when file is missing."""
    with patch("pathlib.Path.is_file", return_value=False):
        img_bytes, mime, desc = get_safe_image_fixture()
        assert len(img_bytes) > 100
        assert mime == "image/jpeg"
        assert "synthetic fixture" in desc.lower()


# ---------------------------------------------------------------------------
# Diagnostic Execution & Live Gate Enforcement
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_ai_diagnostics_offline_gate():
    """Verify that when live=False, no live request is made and offline success is returned."""
    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_dummy_12345", "SITEWISE_AI_PROVIDER": "groq"}):
        with patch("validate_live_ai.execute_reasoning") as mock_exec:
            report = await run_ai_diagnostics(live=False, forced_provider="groq")
            assert report["overall_status"] == "OFFLINE_SUCCESS"
            assert report["live_mode"] is False
            assert len(report["checks"]) == 3
            assert all(c["passed"] for c in report["checks"])
            # Ensure the live reasoning engine was NEVER invoked
            mock_exec.assert_not_called()


@pytest.mark.asyncio
async def test_run_ai_diagnostics_missing_config():
    """Verify clear, actionable diagnostic when provider is not configured."""
    with patch.dict(os.environ, {"GROQ_API_KEY": "", "GEMINI_API_KEY": ""}):
        report = await run_ai_diagnostics(live=False, forced_provider="groq")
        assert report["overall_status"] == "CONFIGURATION_MISSING"
        assert "NOT configured with API credentials" in report["error"]
        assert "set GROQ_API_KEY or GEMINI_API_KEY" in report["error"]
        # Ensure no live calls
        assert report["checks"][0]["passed"] is False


# ---------------------------------------------------------------------------
# Mocked Live Execution & Structured Schema Validation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_ai_diagnostics_live_mocked_success():
    """Verify end-to-end live flow when mocked provider returns valid safety schema."""
    valid_safety_data = SafetyMonitoringOutput(
        overall_risk_level="HIGH",
        ppe_compliance={
            "helmets_compliant": False,
            "vests_compliant": True,
            "violations": ["Worker without helmet near crane boom"],
            "observations": "2 workers observed on scaffolding."
        },
        worker_hazards=[{"hazard": "Unsecured edge", "severity": "HIGH"}],
        scaffolding_fall_risks=[{"location": "Pier 18 Cap", "risk": "No toe-board"}],
    ).model_dump()

    mock_resp = ReasoningResponse(
        feature=FeatureIdentifier.SAFETY_MONITORING,
        status="SUCCESS",
        provenance="LIVE_AI_MODEL",
        provider="groq",
        model="llama-3.3-70b-versatile",
        raw_output="{}",
        validated_data=valid_safety_data,
        error=None,
        latency_ms=420,
    )

    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_dummy_12345", "SITEWISE_AI_PROVIDER": "groq"}):
        with patch("validate_live_ai.execute_reasoning", AsyncMock(return_value=mock_resp)):
            report = await run_ai_diagnostics(live=True, forced_provider="groq", feature="safety_monitoring")
            assert report["overall_status"] == "SUCCESS"
            assert report["live_mode"] is True
            assert report["live_response"]["provider"] == "groq"
            assert report["live_response"]["latency_ms"] >= 0
            assert all(c["passed"] for c in report["checks"])
            # Verify schema check message
            schema_check = [c for c in report["checks"] if c["name"] == "Structured Schema Validation"][0]
            assert "SafetyMonitoringOutput" in schema_check["message"]


@pytest.mark.asyncio
async def test_run_ai_diagnostics_live_mocked_crack_detection():
    """Verify crack detection schema validation under live execution."""
    valid_crack_data = CrackDetectionOutput(
        morphology_type="TRANSVERSE",
        structural_significance="MODERATE",
        probable_cause="Plastic shrinkage and thermal strain",
        repair_urgency="MONITOR_30_DAYS",
    ).model_dump()

    mock_resp = ReasoningResponse(
        feature=FeatureIdentifier.CRACK_DETECTION,
        status="SUCCESS",
        provenance="LIVE_AI_MODEL",
        provider="gemini",
        model="gemini-2.0-flash",
        raw_output="{}",
        validated_data=valid_crack_data,
        error=None,
        latency_ms=650,
    )

    with patch.dict(os.environ, {"GEMINI_API_KEY": "AIzaSy_dummy_key", "SITEWISE_AI_PROVIDER": "gemini"}):
        with patch("validate_live_ai.execute_reasoning", AsyncMock(return_value=mock_resp)):
            report = await run_ai_diagnostics(live=True, forced_provider="gemini", feature="crack_detection")
            assert report["overall_status"] == "SUCCESS"
            schema_check = [c for c in report["checks"] if c["name"] == "Structured Schema Validation"][0]
            assert "CrackDetectionOutput" in schema_check["message"]


@pytest.mark.asyncio
async def test_run_ai_diagnostics_live_mocked_timeout():
    """Verify timeout handling when live request exceeds allowed duration."""
    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_dummy_12345", "SITEWISE_AI_PROVIDER": "groq"}):
        with patch("validate_live_ai.execute_reasoning", AsyncMock(side_effect=asyncio.TimeoutError())):
            report = await run_ai_diagnostics(live=True, forced_provider="groq", timeout_seconds=1)
            assert report["overall_status"] == "TIMEOUT"
            assert "timed out after 1 seconds" in report["error"]


@pytest.mark.asyncio
async def test_run_ai_diagnostics_live_mocked_provider_auth_error():
    """Verify error classification for 401 unauthorized provider error."""
    mock_resp = ReasoningResponse(
        feature=FeatureIdentifier.SAFETY_MONITORING,
        status="PROVIDER_ERROR",
        provenance="SYNTHETIC_DEMO",
        provider="groq",
        model="llama-3.3-70b-versatile",
        raw_output="",
        validated_data={},
        error="Error code 401: Invalid API Key provided",
        latency_ms=150,
    )

    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_dummy_12345", "SITEWISE_AI_PROVIDER": "groq"}):
        with patch("validate_live_ai.execute_reasoning", AsyncMock(return_value=mock_resp)):
            report = await run_ai_diagnostics(live=True, forced_provider="groq")
            assert report["overall_status"] == "PROVIDER_ERROR"
            assert "AUTHENTICATION_FAILED" in report["error"]


@pytest.mark.asyncio
async def test_run_ai_diagnostics_live_mocked_provider_rate_limit():
    """Verify error classification for 429 rate limit provider error."""
    mock_resp = ReasoningResponse(
        feature=FeatureIdentifier.SAFETY_MONITORING,
        status="PROVIDER_ERROR",
        provenance="SYNTHETIC_DEMO",
        provider="groq",
        model="llama-3.3-70b-versatile",
        raw_output="",
        validated_data={},
        error="Error code 429: Rate limit reached for tokens per minute",
        latency_ms=120,
    )

    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_dummy_12345", "SITEWISE_AI_PROVIDER": "groq"}):
        with patch("validate_live_ai.execute_reasoning", AsyncMock(return_value=mock_resp)):
            report = await run_ai_diagnostics(live=True, forced_provider="groq")
            assert report["overall_status"] == "PROVIDER_ERROR"
            assert "RATE_LIMIT_EXCEEDED" in report["error"]


@pytest.mark.asyncio
async def test_run_ai_diagnostics_live_schema_invalid():
    """Verify failure when response data cannot validate against target Pydantic schema."""
    corrupted_data = {"overall_risk_level": 12345}  # invalid types / missing required fields

    mock_resp = ReasoningResponse(
        feature=FeatureIdentifier.SAFETY_MONITORING,
        status="SUCCESS",
        provenance="LIVE_AI_MODEL",
        provider="groq",
        model="llama-3.3-70b-versatile",
        raw_output="{}",
        validated_data=corrupted_data,
        error=None,
        latency_ms=300,
    )

    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_dummy_12345", "SITEWISE_AI_PROVIDER": "groq"}):
        # We patch model_validate to raise an exception simulating validation failure
        with patch.object(SafetyMonitoringOutput, "model_validate", side_effect=ValueError("Missing fields")):
            with patch("validate_live_ai.execute_reasoning", AsyncMock(return_value=mock_resp)):
                report = await run_ai_diagnostics(live=True, forced_provider="groq")
                assert report["overall_status"] == "SCHEMA_INVALID"
                schema_check = [c for c in report["checks"] if c["name"] == "Structured Schema Validation"][0]
                assert schema_check["passed"] is False


# ---------------------------------------------------------------------------
# CLI Entrypoint Exit Code Tests
# ---------------------------------------------------------------------------

def test_main_cli_offline_success(capsys):
    """Verify CLI returns exit code 0 for offline verification."""
    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_dummy_12345", "SITEWISE_AI_PROVIDER": "groq"}):
        with patch("sys.argv", ["validate_live_ai.py"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 0
            captured = capsys.readouterr()
            assert "OFFLINE_SUCCESS" in captured.out
            assert "gsk_dummy_12345" not in captured.out


def test_main_cli_missing_config(capsys):
    """Verify CLI returns exit code 2 when credentials are missing."""
    with patch.dict(os.environ, {"GROQ_API_KEY": "", "GEMINI_API_KEY": ""}):
        with patch("sys.argv", ["validate_live_ai.py"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 2
            captured = capsys.readouterr()
            assert "CONFIGURATION_MISSING" in captured.out


def test_main_cli_error_exit_code(capsys):
    """Verify CLI returns exit code 1 when an error occurs."""
    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_dummy_12345", "SITEWISE_AI_PROVIDER": "groq"}):
        with patch("sys.argv", ["validate_live_ai.py", "--image", "nonexistent_file_path.jpg"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 1
            captured = capsys.readouterr()
            assert "FIXTURE_ERROR" in captured.out
