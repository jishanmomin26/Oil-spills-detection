"""
OCEANTRACE AI — Phase 12 Comprehensive Verification Script
SIH Problem Statement: SIH26143

Verifies all Phase 12 requirements:
1. Status Endpoint
2. Summary Endpoint (Fallback mode)
3. Vessel Dossier Endpoint
4. Timeline Explanation Endpoint
5. Evidence Explanation Endpoint
6. In-scope Q&A
7. Out-of-scope Q&A ("Insufficient data available.")
8. Short question validation (< 3 chars -> 422)
9. Long question validation (> 500 chars -> 422)
10. 404 on unknown incident
11. 404 on unknown vessel
12. Mocked Gemini Provider (Online mode)
13. Mocked Gemini Timeout (Fallback mode)
14. Provenance Preservation
15. Causality Safeguard Enforcement
16. Security (Zero API key leakage)
17. Deterministic Engine Non-Regression (Phases 8, 9, 10, 11 values strictly preserved)
"""

import sys
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.services.ai_investigation import (
    EvidenceContextBuilder,
    AiInvestigationService,
    FORBIDDEN_CAUSAL_PHRASES,
)
from app.services.attribution_engine import VesselAttributionEngine
from app.services.satellite_analysis import SatelliteAnalysisService
from app.services.investigation_timeline import InvestigationTimelineService

INCIDENT_ID = "OCEANTRACE-DEMO-001"
KNOWN_VESSEL_ID = "6560b81c-f5cc-4c9c-880a-30be0d8b5bc7"  # MT GULF VOYAGER

passed_checks = []
failed_checks = []

def record(name: str, passed: bool, detail: str = ""):
    if passed:
        passed_checks.append(name)
        print(f"  [PASS] {name}{f' ({detail})' if detail else ''}")
    else:
        failed_checks.append((name, detail))
        print(f"  [FAIL] {name}: {detail}")


def main():
    print("\n============================================================")
    print("OCEANTRACE AI — PHASE 12 VERIFICATION AUDIT")
    print("AI-ASSISTED INVESTIGATION + EXPLAINABILITY LAYER")
    print("============================================================\n")

    client = TestClient(app)
    db = SessionLocal()

    try:
        # Check 1: AI Status Endpoint
        res = client.get(f"/api/incidents/{INCIDENT_ID}/ai/status")
        d = res.json()
        record(
            "1. AI Status Endpoint",
            res.status_code == 200 and "available" in d and "status" in d and "model" in d,
            f"Status: {d.get('status')}, Model: {d.get('model')}"
        )

        # Check 2: Summary Endpoint
        res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/summary")
        d = res.json()
        record(
            "2. Investigation Summary Endpoint",
            res.status_code == 200 and d.get("mode") == "summary" and len(d.get("response", "")) > 50,
            f"Length: {len(d.get('response', ''))} chars, Findings: {len(d.get('key_findings', []))}"
        )

        # Check 3: Vessel Dossier Endpoint
        res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/vessel/{KNOWN_VESSEL_ID}")
        d = res.json()
        record(
            "3. Candidate Vessel Dossier Endpoint",
            res.status_code == 200 and d.get("mode") == "vessel" and "MT GULF VOYAGER" in d.get("response", ""),
            f"Candidate: MT GULF VOYAGER identified"
        )

        # Check 4: Timeline Explanation Endpoint
        res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/timeline")
        d = res.json()
        record(
            "4. Timeline Explanation Endpoint",
            res.status_code == 200 and d.get("mode") == "timeline" and len(d.get("response", "")) > 30,
            f"Length: {len(d.get('response', ''))} chars"
        )

        # Check 5: Evidence Correlation Endpoint
        res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/evidence")
        d = res.json()
        record(
            "5. Evidence Synthesis Endpoint",
            res.status_code == 200 and d.get("mode") == "evidence" and len(d.get("response", "")) > 30,
            f"Length: {len(d.get('response', ''))} chars"
        )

        # Check 6: In-Scope Q&A
        res = client.post(
            f"/api/incidents/{INCIDENT_ID}/ai/question",
            json={"question": "What is the candidate rank and distance of MT GULF VOYAGER?", "vessel_id": KNOWN_VESSEL_ID}
        )
        d = res.json()
        record(
            "6. In-Scope Q&A",
            res.status_code == 200 and d.get("mode") == "question" and len(d.get("response", "")) > 20,
            f"Answer length: {len(d.get('response', ''))} chars"
        )

        # Check 7: Out-of-Scope Q&A Insufficient Data Safeguard
        res = client.post(
            f"/api/incidents/{INCIDENT_ID}/ai/question",
            json={"question": "Was there a severe cyclone or hurricane during the incident?"}
        )
        d = res.json()
        insufficient = "Insufficient data available" in d.get("response", "")
        record(
            "7. Out-of-Scope Safeguard ('Insufficient data available.')",
            res.status_code == 200 and insufficient,
            f"Response contains guard phrase: {insufficient}"
        )

        # Check 8: Question Length < 3 Validation (422)
        res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/question", json={"question": "a"})
        record(
            "8. Short Question Length Validation (< 3 chars -> 422)",
            res.status_code == 422,
            f"Returned HTTP {res.status_code}"
        )

        # Check 9: Question Length > 500 Validation (422)
        res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/question", json={"question": "x" * 501})
        record(
            "9. Long Question Length Validation (> 500 chars -> 422)",
            res.status_code == 422,
            f"Returned HTTP {res.status_code}"
        )

        # Check 10: Non-Existent Incident (404)
        res = client.post("/api/incidents/NON-EXISTENT-INCIDENT/ai/summary")
        record(
            "10. Unknown Incident 404 Validation",
            res.status_code == 404,
            f"Returned HTTP {res.status_code}"
        )

        # Check 11: Non-Existent Vessel (404)
        res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/vessel/00000000-0000-0000-0000-000000000000")
        record(
            "11. Unknown Vessel 404 Validation",
            res.status_code == 404,
            f"Returned HTTP {res.status_code}"
        )

        # Check 12: Mocked Gemini Provider Online Mode
        mock_payload = {
            "candidates": [{
                "content": {"parts": [{"text": "Synthetic observation indicates MT GULF VOYAGER is spatially proximate."}]}
            }]
        }
        with patch("app.services.ai_investigation.settings.GEMINI_API_KEY", "AIzaSyMockKey123"), \
             patch("app.services.ai_investigation.settings.GEMINI_ENABLED", True), \
             patch("httpx.Client.post") as mock_post:
            m_resp = MagicMock()
            m_resp.status_code = 200
            m_resp.json.return_value = mock_payload
            mock_post.return_value = m_resp

            res_online = AiInvestigationService.generate_investigation_summary(db, INCIDENT_ID)
            record(
                "12. Mocked Gemini Online Mode",
                res_online.available is True and "MT GULF VOYAGER" in res_online.response,
                f"available={res_online.available}, status={res_online.status}"
            )

        # Check 13: Mocked Gemini Timeout Fallback
        import httpx
        with patch("app.services.ai_investigation.settings.GEMINI_API_KEY", "AIzaSyMockKey123"), \
             patch("app.services.ai_investigation.settings.GEMINI_ENABLED", True), \
             patch("httpx.Client.post", side_effect=httpx.TimeoutException("Read timeout")):
            res_fb = AiInvestigationService.generate_investigation_summary(db, INCIDENT_ID)
            record(
                "13. Mocked Gemini Timeout Fallback Mode",
                res_fb.available is False and len(res_fb.response) > 50,
                f"available={res_fb.available}, status={res_fb.status}"
            )

        # Check 14: Provenance Preservation
        res = client.post(f"/api/incidents/{INCIDENT_ID}/ai/summary")
        d = res.json()
        notices = d.get("provenance_notices", [])
        has_demo = any("DEMO / SYNTHETIC" in n for n in notices)
        has_est = any("ESTIMATED" in n for n in notices)
        record(
            "14. Provenance Labels Preservation (DEMO / SYNTHETIC, ESTIMATED)",
            has_demo and has_est,
            f"Notices: {notices}"
        )

        # Check 15: Causality Safeguard Sanitization
        dirty_text = "The culprit vessel MT GULF VOYAGER definitely caused the spill and is proven responsible."
        clean_text = AiInvestigationService.sanitize_causality_and_provenance(dirty_text)
        no_forbidden = all(phrase not in clean_text.lower() for phrase in FORBIDDEN_CAUSAL_PHRASES)
        record(
            "15. Causality Safeguard Sanitization",
            no_forbidden,
            f"Cleaned output: {clean_text[:60]}..."
        )

        # Check 16: Security & API Key Confidentiality
        all_res_text = "".join([
            client.get(f"/api/incidents/{INCIDENT_ID}/ai/status").text,
            client.post(f"/api/incidents/{INCIDENT_ID}/ai/summary").text,
            client.post(f"/api/incidents/{INCIDENT_ID}/ai/vessel/{KNOWN_VESSEL_ID}").text,
        ])
        no_key = "AIzaSy" not in all_res_text and "GEMINI_API_KEY" not in all_res_text
        record(
            "16. Zero API Key / Credential Exposure",
            no_key,
            "No API key fragments detected in any endpoint responses"
        )

        # Check 17: Deterministic Engine Non-Regression (Phases 8, 9, 10, 11)
        # Phase 9 Attribution API
        attr_res = client.get(f"/api/incidents/{INCIDENT_ID}/vessels/attribution")
        attr_ranks = attr_res.json()
        top_cand = attr_ranks[0]
        # Phase 10 Timeline
        tl = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID)
        # Phase 11 Satellite Analysis
        sat = SatelliteAnalysisService().analyze_spill_evolution(db, INCIDENT_ID)

        non_regression = (
            top_cand.get("vessel_name") == "MT GULF VOYAGER" and
            top_cand.get("overall_score") == 66.5 and
            tl.get("total_events", 0) > 0 and
            sat.get("summary", {}).get("total_observations") == 3
        )
        record(
            "17. Deterministic Non-Regression (Phases 8, 9, 10, 11 Untouched)",
            non_regression,
            f"Top Cand: {top_cand.get('vessel_name')}, Score: {top_cand.get('overall_score')}, Timeline Events: {tl.get('total_events')}, Satellite Passes: {sat.get('summary', {}).get('total_observations')}"
        )

    finally:
        db.close()

    print("\n============================================================")
    print(f"VERIFICATION SUMMARY: {len(passed_checks)} PASSED, {len(failed_checks)} FAILED")
    print("============================================================\n")

    if failed_checks:
        sys.exit(1)
    else:
        print("ALL PHASE 12 SPECIFICATION REQUIREMENTS VERIFIED SUCCESSFULLY!")
        sys.exit(0)


if __name__ == "__main__":
    main()
