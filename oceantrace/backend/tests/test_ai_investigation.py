import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.services.ai_investigation import (
    EvidenceContextBuilder,
    AiInvestigationService,
    FORBIDDEN_CAUSAL_PHRASES,
)

INCIDENT_ID = "OCEANTRACE-DEMO-001"
KNOWN_VESSEL_ID = "6560b81c-f5cc-4c9c-880a-30be0d8b5bc7"  # MT GULF VOYAGER


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


# --------------------------------------------------------------------------
# 1. Context Builder Tests
# --------------------------------------------------------------------------

def test_context_builder_harvests_authoritative_data(db):
    """Verify that EvidenceContextBuilder collects authoritative deterministic data without alteration."""
    ctx = EvidenceContextBuilder.build_context(db, INCIDENT_ID, KNOWN_VESSEL_ID)
    
    assert ctx is not None
    assert ctx["incident_id"] == INCIDENT_ID
    assert "spill" in ctx
    assert "origin" in ctx
    assert "satellite" in ctx
    assert "currents" in ctx
    assert "candidate_rankings" in ctx
    assert "behaviour" in ctx
    assert "timeline_events" in ctx
    assert "target_vessel" in ctx
    assert "general_limitations" in ctx

    # Verify target vessel is included with exact fields
    assert ctx["target_vessel"] is not None
    assert ctx["target_vessel"]["name"] == "MT GULF VOYAGER"
    assert "category_scores" in ctx["target_vessel"]
    assert "attribution_score" in ctx["target_vessel"]


def test_context_builder_nonexistent_incident(db):
    """Verify context builder returns error dict for invalid incident."""
    ctx = EvidenceContextBuilder.build_context(db, "NON-EXISTENT-INCIDENT")
    assert ctx is not None
    assert "error" in ctx


# --------------------------------------------------------------------------
# 2. Causality and Provenance Sanitization Tests
# --------------------------------------------------------------------------

def test_causality_sanitization_removes_forbidden_phrases():
    """Verify that forbidden accusatory or deterministic causal claims are sanitized."""
    text_with_violations = (
        "The culprit vessel MT GULF VOYAGER is the confirmed responsible vessel for the spill. "
        "The vessel dumped oil deliberately, proving this is an illegal dumping confirmed case. "
        "The vessel caused the spill without doubt."
    )
    sanitized = AiInvestigationService.sanitize_causality_and_provenance(text_with_violations)
    
    for phrase in FORBIDDEN_CAUSAL_PHRASES:
        assert phrase not in sanitized.lower(), f"Forbidden phrase '{phrase}' found in sanitized text"


# --------------------------------------------------------------------------
# 3. Status Endpoint
# --------------------------------------------------------------------------

def test_ai_status_endpoint(client):
    """Verify status endpoint returns AI availability and model/detail."""
    res = client.get(f"/api/incidents/{INCIDENT_ID}/ai/status")
    assert res.status_code == 200
    data = res.json()
    assert "available" in data
    assert "status" in data
    assert "model" in data
    assert "detail" in data
    assert "deterministic_fallback_ready" in data


# --------------------------------------------------------------------------
# 4. Deterministic Fallback Endpoints (Missing or Inactive Key)
# --------------------------------------------------------------------------

def test_ai_summary_endpoint(client):
    """Verify summary endpoint produces a complete structured explanation."""
    res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "summary"
    assert len(data["response"]) > 50
    assert len(data["key_findings"]) > 0
    assert len(data["warnings"]) > 0
    assert len(data["provenance_notices"]) > 0


def test_ai_vessel_dossier_endpoint(client):
    """Verify vessel dossier endpoint produces vessel-specific analysis."""
    res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/vessel/{KNOWN_VESSEL_ID}")
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "vessel"
    assert "MT GULF VOYAGER" in data["response"]
    assert len(data["key_findings"]) > 0


def test_ai_timeline_endpoint(client):
    """Verify timeline explanation endpoint."""
    res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/timeline")
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "timeline"
    assert len(data["response"]) > 30


def test_ai_evidence_endpoint(client):
    """Verify evidence synthesis endpoint."""
    res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/evidence")
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "evidence"
    assert len(data["response"]) > 30


# --------------------------------------------------------------------------
# 5. Q&A and Out-of-Scope Tests
# --------------------------------------------------------------------------

def test_ai_question_in_scope(client):
    """Verify in-scope question returns structured answer referencing facts."""
    req_body = {
        "question": "Which vessel had the highest attribution score and what was its distance?",
        "vessel_id": KNOWN_VESSEL_ID,
    }
    res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/question", json=req_body)
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "question"
    assert len(data["response"]) > 20


def test_ai_question_out_of_scope_insufficient_data(client):
    """Verify that unrecorded/out-of-scope query triggers 'Insufficient data available.' safeguard."""
    req_body = {
        "question": "Was there a severe thunderstorm during the spill?",
    }
    res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/question", json=req_body)
    assert res.status_code == 200
    data = res.json()
    assert "Insufficient data available" in data["response"]


# --------------------------------------------------------------------------
# 6. Validation and Error Handling
# --------------------------------------------------------------------------

def test_ai_question_length_validation_short(client):
    """Verify question < 3 chars returns 422 Unprocessable Entity."""
    res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/question", json={"question": "hi"})
    assert res.status_code == 422


def test_ai_question_length_validation_long(client):
    """Verify question > 500 chars returns 422 Unprocessable Entity."""
    res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/question", json={"question": "a" * 501})
    assert res.status_code == 422


def test_ai_nonexistent_incident_returns_404(client):
    """Verify 404 for unknown incident."""
    res = client.post("/api/incidents/UNKNOWN-INCIDENT-999/ai/summary")
    assert res.status_code == 404


def test_ai_nonexistent_vessel_returns_404(client):
    """Verify 404 for unknown vessel."""
    res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/vessel/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


# --------------------------------------------------------------------------
# 7. Security and Key Confidentiality
# --------------------------------------------------------------------------

def test_api_key_not_leaked_in_responses(client):
    """Ensure no API keys, secrets, or credential tokens leak in response payloads."""
    endpoints = [
        f"/api/incidents/{INCIDENT_ID}/ai/status",
        f"/api/incidents/{INCIDENT_ID}/ai/summary",
        f"/api/incidents/{INCIDENT_ID}/ai/vessel/{KNOWN_VESSEL_ID}",
        f"/api/incidents/{INCIDENT_ID}/ai/timeline",
        f"/api/incidents/{INCIDENT_ID}/ai/evidence",
    ]
    for ep in endpoints:
        res = client.get(ep) if "status" in ep else client.post(ep)
        body_text = res.text
        assert "AIzaSy" not in body_text
        assert "GEMINI_API_KEY" not in body_text


# --------------------------------------------------------------------------
# 8. Mocked Gemini Provider Tests (Success, Timeout, Failure)
# --------------------------------------------------------------------------

def test_mocked_gemini_provider_success(db):
    """Verify successful Gemini API response parsing and metadata generation."""
    mock_gemini_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": (
                                "### Summary\n"
                                "Deterministic analysis indicates MT GULF VOYAGER had spatial proximity (0.42 km) "
                                "and temporal correlation with the estimated spill origin.\n\n"
                                "### Key Evidence Points\n"
                                "- Ranked #1 candidate vessel with score 84.5/100\n"
                                "- Speed anomaly observed near origin window\n\n"
                                "### Investigative Limitations\n"
                                "- All attribution scores represent correlation and candidate relevance only.\n"
                                "- Satellite radar observations subject to standard speckle noise."
                            )
                        }
                    ]
                }
            }
        ]
    }

    with patch("app.services.ai_investigation.settings.GEMINI_API_KEY", "AIzaSyMockKeyForTesting12345"), \
         patch("app.services.ai_investigation.settings.GEMINI_ENABLED", True), \
         patch("httpx.Client.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_gemini_payload
        mock_post.return_value = mock_resp

        result = AiInvestigationService.generate_investigation_summary(
            db=db,
            incident_id=INCIDENT_ID,
        )

        assert result.available is True
        assert "MT GULF VOYAGER" in result.response
        assert len(result.key_findings) > 0


def test_mocked_gemini_provider_timeout_fallback(db):
    """Verify graceful fallback to deterministic engine when Gemini API times out."""
    import httpx

    with patch("app.services.ai_investigation.settings.GEMINI_API_KEY", "AIzaSyMockKeyForTesting12345"), \
         patch("app.services.ai_investigation.settings.GEMINI_ENABLED", True), \
         patch("httpx.Client.post", side_effect=httpx.TimeoutException("Read timed out")):
        result = AiInvestigationService.generate_investigation_summary(
            db=db,
            incident_id=INCIDENT_ID,
        )

        # Must fall back smoothly to deterministic engine
        assert result.available is False
        assert len(result.warnings) > 0
        assert len(result.response) > 50
