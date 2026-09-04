"""
OCEANTRACE AI — Phase 12: AI-Assisted Investigation & Explainability Service

Provides an optional natural-language explainability layer strictly consuming
authoritative outputs from the deterministic analytical engine (Phases 1–11).

NON-NEGOTIABLE ARCHITECTURAL SAFEGUARDS:
1. Deterministic Engine is the ONLY source of truth.
2. AI cannot calculate analytical values (distances, areas, headings, scores, rankings).
3. AI cannot invent vessels, coordinates, timestamps, or facts.
4. If requested data is missing, returns: "Insufficient data available."
5. Causality Safeguard: Never claims vessel causation; uses non-accusatory candidate framing.
6. Provenance Preservation: Preserves all provenance labels (DEMO / SYNTHETIC, ESTIMATED, MODELLED).
7. Offline/Graceful Fallback: Operates 100% reliably with or without GEMINI_API_KEY.
8. Security: Server-side key management; zero key exposure.
"""

import json
import logging
import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.timeline_config import TimelineConfig
from app.db.models.incident import Incident, OilSpill, OriginEstimate, OceanCurrent, WeatherObservation
from app.db.models.vessel import Vessel
from app.services.satellite_analysis import SatelliteAnalysisService
from app.services.attribution_engine import VesselAttributionEngine
from app.services.behaviour_engine import VesselBehaviourEngine
from app.services.investigation_timeline import InvestigationTimelineService
from app.services.trajectory_analysis import TrajectoryAnalysis
from app.schemas.schemas import AIResponseOut, AIStatusOut

logger = logging.getLogger("oceantrace.ai_investigation")


# ── Centralized System Instructions ─────────────────────────────────────────

CENTRALIZED_AI_SYSTEM_INSTRUCTION = """You are the OCEANTRACE AI Investigation Explainability Assistant.

You are NOT the analytical engine.
The deterministic OCEANTRACE backend is the single source of truth.
Use ONLY the structured evidence supplied to you in the prompt.

STRICT OPERATIONAL RULES:
1. DO NOT calculate analytical values (distances, coordinates, spill areas, headings, speeds, scores, or rankings). Use exact numbers supplied.
2. DO NOT invent missing information, vessels, coordinates, timestamps, satellite observations, behaviour events, weather, or maritime facts.
3. If the requested information is not present in the supplied evidence, respond exactly with:
   "Insufficient data available."
4. DO NOT claim causation. Never say a vessel "caused the spill", "is responsible", or is a "confirmed culprit".
5. Describe vessels as "candidate vessels", "spatially proximate", "temporally correlated", "consistent with", or "investigatively relevant".
6. The investigator makes the final determination.
7. Preserve all data provenance labels:
   - DEMO / SYNTHETIC
   - OBSERVED
   - ESTIMATED
   - MODELLED
   - FORECAST
   - HINDCAST
8. Satellite observations in this dataset are demonstration synthetic data labeled "DEMO / SYNTHETIC". Never describe them as real or confirmed satellite detections.
"""

FORBIDDEN_CAUSAL_PHRASES = [
    "caused the spill",
    "caused the incident",
    "confirmed responsible",
    "confirmed culprit",
    "definitely caused",
    "proven responsible",
    "is guilty of",
]

FORBIDDEN_CAUSAL_PATTERNS = [
    re.compile(r"\b(caused the spill|caused the incident)\b", re.IGNORECASE),
    re.compile(r"\b(confirmed (responsible|culprit|perpetrator))\b", re.IGNORECASE),
    re.compile(r"\b(definitely caused|certainly caused|proven responsible|proven guilty)\b", re.IGNORECASE),
    re.compile(r"\b(is guilty of|perpetrated the discharge)\b", re.IGNORECASE),
]


class EvidenceContextBuilder:
    """
    Gathers authoritative existing deterministic results from Phases 1–11.
    Performs NO independent calculation; acts strictly as an evidence serializer.
    """

    @classmethod
    def build_context(
        cls,
        db: Session,
        incident_id: str,
        target_vessel_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Collect structured evidence context from existing services."""
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            return {"error": f"Incident '{incident_id}' not found"}

        # 1. Spill Details (Phase 1-4)
        spill = db.query(OilSpill).filter(OilSpill.incident_id == incident_id).first()
        spill_info = {}
        if spill:
            spill_info = {
                "spill_id": spill.id,
                "area_km2": spill.area_km2,
                "perimeter_km": spill.perimeter_km,
                "length_km": spill.length_km,
                "width_km": spill.width_km,
                "detection_method": spill.detection_method or "SAR C-band segmentation",
                "oil_probability": spill.oil_probability,
                "confidence": spill.confidence,
                "provenance": TimelineConfig.PROVENANCE_OBSERVED,
            }

        # 2. Origin Estimate (Phase 4)
        origin = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).first()
        origin_info = {}
        if origin:
            origin_info = {
                "origin_id": origin.id,
                "center_lat": origin.center_lat,
                "center_lon": origin.center_lon,
                "uncertainty_radius_km": origin.uncertainty_radius_km,
                "confidence": origin.probability,
                "time_window_start": origin.time_window_start.isoformat() if origin.time_window_start else None,
                "time_window_end": origin.time_window_end.isoformat() if origin.time_window_end else None,
                "provenance": TimelineConfig.PROVENANCE_ESTIMATED,
                "method": "Lagrangian backward hydrodynamic particle backtracking",
            }

        # 3. Satellite Analysis & Evolution (Phase 11)
        try:
            sat_analysis = SatelliteAnalysisService.analyze_spill_evolution(db, incident_id)
            satellite_info = {
                "observation_count": sat_analysis["summary"]["total_observations"],
                "latest_area_km2": sat_analysis["summary"]["latest_area_km2"],
                "net_area_growth_km2": sat_analysis["summary"]["net_area_change_km2"],
                "net_area_growth_pct": sat_analysis["summary"]["net_area_growth_pct"],
                "total_centroid_displacement_km": sat_analysis["summary"]["total_centroid_displacement_km"],
                "data_provenance": sat_analysis["summary"]["data_provenance"],
                "classification": sat_analysis["summary"]["classification"],
                "passes": [
                    {
                        "pass_id": o["id"],
                        "platform": o["platform"],
                        "sensor": o["sensor"],
                        "time": o["acquisition_time"].isoformat() if isinstance(o["acquisition_time"], datetime) else str(o["acquisition_time"]),
                        "area_km2": o["stored_area_km2"],
                        "confidence": o["confidence"],
                        "provenance": o["data_provenance"],
                    }
                    for o in sat_analysis.get("observations", [])
                ],
                "evolution_steps": [
                    {
                        "step": s["step_index"],
                        "delta_time_hours": s["delta_time_hours"],
                        "delta_area_km2": s["delta_area_km2"],
                        "centroid_displacement_km": s["centroid_displacement_km"],
                        "drift_speed_knots": s["drift_speed_knots"],
                        "direction": s["direction_cardinal"],
                        "bearing_deg": s["displacement_bearing_deg"],
                    }
                    for s in sat_analysis.get("evolution_steps", [])
                ],
                "drift_correlation": sat_analysis.get("drift_correlation", {}),
                "limitations": sat_analysis.get("limitations", []),
            }
        except Exception as e:
            logger.warning(f"Error extracting satellite context: {e}")
            satellite_info = {"status": "unavailable", "data_provenance": "DEMO / SYNTHETIC"}

        # 4. Prevailing Ocean Currents
        current = db.query(OceanCurrent).filter(OceanCurrent.incident_id == incident_id).first()
        current_info = {}
        if current:
            current_info = {
                "speed_ms": current.speed_ms,
                "speed_knots": round(current.speed_ms * 1.94384, 2),
                "direction_deg": current.direction_deg,
                "source": current.source or "Copernicus Marine Service (CMEMS)",
                "provenance": TimelineConfig.PROVENANCE_MODELLED,
            }

        # 5. Candidate Attribution & Rankings (Phase 9)
        candidates_info = []
        try:
            from app.api.vessels import get_incident_vessel_attribution as get_vessel_attributions
            ranked = get_vessel_attributions(
                incident_id=incident_id,
                candidates_only=True,
                w_spatial=None,
                w_temporal=None,
                w_trajectory=None,
                w_behaviour=None,
                w_quality=None,
                db=db
            )
            for cand in ranked:
                c_dict = cand if isinstance(cand, dict) else (cand.dict() if hasattr(cand, "dict") else cand.model_dump())
                score_val = c_dict.get("overall_score") if c_dict.get("overall_score") is not None else c_dict.get("attribution_score")
                band_val = c_dict.get("relevance_level") or c_dict.get("confidence_band")
                candidates_info.append({
                    "vessel_id": c_dict.get("vessel_id"),
                    "vessel_name": c_dict.get("vessel_name"),
                    "vessel_type": c_dict.get("vessel_type"),
                    "rank": c_dict.get("rank"),
                    "attribution_score": score_val,
                    "confidence_band": band_val,
                    "category_scores": c_dict.get("category_scores", {}),
                    "closest_approach_km": c_dict.get("closest_approach_km"),
                    "primary_evidence": c_dict.get("supporting_evidence") or c_dict.get("primary_evidence", []),
                    "provenance": TimelineConfig.PROVENANCE_OBSERVED,
                })
        except Exception as e:
            logger.warning(f"Error extracting attribution rankings: {e}")

        # 6. Behaviour Anomalies (Phase 8)
        behaviour_info = []
        try:
            from app.db.models.vessel import VesselTrack
            from app.services.ais_reconstruction import AisReconstructionService
            tracks = db.query(VesselTrack).filter(VesselTrack.incident_id == incident_id).all()
            out_tracks, _ = AisReconstructionService.simulate_and_reconstruct(tracks)
            pts_by_vessel = {t["vessel_id"]: t["points"] for t in out_tracks}

            for cand in candidates_info:
                v_id = cand["vessel_id"]
                v_obj = db.query(Vessel).filter(Vessel.id == v_id).first()
                if not v_obj:
                    continue
                pts = pts_by_vessel.get(v_id, [])
                beh_profile = VesselBehaviourEngine.analyze_vessel_behaviour(
                    vessel=v_obj,
                    track_points=pts,
                    incident_id=incident_id,
                    origin_lat=origin.center_lat if origin else None,
                    origin_lon=origin.center_lon if origin else None,
                    origin_uncertainty_km=origin.uncertainty_radius_km if origin else None,
                    spill_geometry_wkt=spill.geometry_wkt if spill else None,
                )
                anomalies = beh_profile.get("anomalies", [])
                behaviour_info.append({
                    "vessel_id": v_id,
                    "vessel_name": cand.get("vessel_name"),
                    "anomaly_count": len(anomalies),
                    "anomalies": anomalies,
                    "zone_interaction": beh_profile.get("zone_interaction", {}),
                })
        except Exception as e:
            logger.warning(f"Error extracting behaviour context: {e}")

        # 7. Unified Timeline Summary (Phase 10)
        timeline_info = []
        try:
            timeline_res = InvestigationTimelineService.build_unified_timeline(db, incident_id)
            for ev in timeline_res.get("events", [])[:15]:  # Key first 15 chronological events
                raw_ts = ev.get("timestamp")
                ts_str = raw_ts.isoformat() if isinstance(raw_ts, datetime) else str(raw_ts) if raw_ts else None
                timeline_info.append({
                    "event_id": ev.get("event_id"),
                    "timestamp": ts_str,
                    "event_type": ev.get("event_type"),
                    "title": ev.get("title"),
                    "description": ev.get("description"),
                    "vessel_id": ev.get("vessel_id"),
                    "provenance": ev.get("provenance"),
                })
        except Exception as e:
            logger.warning(f"Error extracting timeline context: {e}")

        # 8. Specific Target Vessel Details (if requested)
        target_vessel_info = None
        if target_vessel_id:
            matching_cand = next((c for c in candidates_info if c["vessel_id"] == target_vessel_id), None)
            matching_beh = next((b for b in behaviour_info if b["vessel_id"] == target_vessel_id), None)
            vessel_obj = db.query(Vessel).filter(Vessel.id == target_vessel_id).first()

            if vessel_obj or matching_cand:
                target_vessel_info = {
                    "vessel_id": target_vessel_id,
                    "name": vessel_obj.name if vessel_obj else (matching_cand.get("vessel_name") if matching_cand else "Unknown"),
                    "type": vessel_obj.vessel_type if vessel_obj else (matching_cand.get("vessel_type") if matching_cand else "Unknown"),
                    "mmsi": vessel_obj.mmsi if vessel_obj else None,
                    "flag": vessel_obj.flag_state if vessel_obj else None,
                    "ranking": matching_cand.get("rank") if matching_cand else None,
                    "attribution_score": matching_cand.get("attribution_score") if matching_cand else None,
                    "confidence_band": matching_cand.get("confidence_band") if matching_cand else None,
                    "category_scores": matching_cand.get("category_scores") if matching_cand else {},
                    "behaviour_anomalies": matching_beh.get("anomalies") if matching_beh else [],
                    "zone_interaction": matching_beh.get("zone_interaction") if matching_beh else {},
                }

        return {
            "incident_id": incident.id,
            "incident_name": incident.name,
            "status": incident.status,
            "region": incident.region,
            "spill": spill_info,
            "origin": origin_info,
            "satellite": satellite_info,
            "currents": current_info,
            "candidate_rankings": candidates_info,
            "behaviour": behaviour_info,
            "timeline_events": timeline_info,
            "target_vessel": target_vessel_info,
            "data_provenance_labels": [
                TimelineConfig.PROVENANCE_OBSERVED,
                TimelineConfig.PROVENANCE_ESTIMATED,
                TimelineConfig.PROVENANCE_MODELLED,
                TimelineConfig.PROVENANCE_FORECAST,
                TimelineConfig.PROVENANCE_DEMO_SYNTHETIC,
            ],
            "general_limitations": [
                "Evidence-based candidate attribution does not constitute judicial liability determination.",
                "Satellite observations are synthetic demonstration passes for scenario evaluation.",
                "Hydrodynamic current vectors are based on regional numerical model estimates.",
                "Final attribution determination rests exclusively with the designated maritime investigator.",
            ]
        }


class AiInvestigationService:
    """
    Central AI service providing explainability, investigator Q&A, and
    structured deterministic fallbacks.
    """

    SYSTEM_INSTRUCTION = CENTRALIZED_AI_SYSTEM_INSTRUCTION
    TIMEOUT_SECONDS = 15.0

    @classmethod
    def get_status(cls) -> AIStatusOut:
        """Check provider configuration and operational status."""
        has_key = bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())
        is_enabled = bool(settings.GEMINI_ENABLED)

        if has_key and is_enabled:
            return AIStatusOut(
                available=True,
                status="ONLINE",
                model=settings.GEMINI_MODEL,
                detail="Gemini explainability assistant online and active.",
                deterministic_fallback_ready=True,
            )
        else:
            return AIStatusOut(
                available=False,
                status="STANDBY - DETERMINISTIC FALLBACK",
                model="deterministic_rule_engine",
                detail="AI explainability assistant in deterministic fallback mode (No API key configured). All deterministic analytical capabilities remain fully operational.",
                deterministic_fallback_ready=True,
            )

    @classmethod
    def call_gemini_provider(cls, user_prompt: str) -> Optional[str]:
        """
        Call Gemini REST API directly using httpx with strict timeout.
        Returns raw response text or None on failure. Never leaks secrets.
        """
        api_key = settings.GEMINI_API_KEY
        if not api_key or not settings.GEMINI_ENABLED:
            return None

        model = settings.GEMINI_MODEL or "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        payload = {
            "system_instruction": {
                "parts": [{"text": cls.SYSTEM_INSTRUCTION}]
            },
            "contents": [
                {
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1024,
            }
        }

        try:
            with httpx.Client(timeout=cls.TIMEOUT_SECONDS) as client:
                response = client.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"].strip()
                else:
                    logger.warning(f"Gemini API returned HTTP {response.status_code}: {response.text[:200]}")
                    return None
        except httpx.TimeoutException:
            logger.warning("Gemini API request timed out after 15s; falling back to deterministic explainability.")
            return None
        except Exception as e:
            logger.warning(f"Gemini API connection error: {type(e).__name__}; falling back to deterministic explainability.")
            return None

        return None

    @classmethod
    def sanitize_causality_and_provenance(cls, text: str) -> str:
        """
        Enforce causality safeguards and provenance wording on any generated text.
        Replaces forbidden definitive causal claims with investigative terminology.
        """
        sanitized = text
        for pattern in FORBIDDEN_CAUSAL_PATTERNS:
            sanitized = pattern.sub("is spatially and temporally correlated with the incident", sanitized)

        # Ensure synthetic satellite mentions are not converted to confirmed real observations
        if "satellite observation" in sanitized.lower() and "demo / synthetic" not in sanitized.lower() and "synthetic" not in sanitized.lower():
            sanitized += "\n\n*(Note: Satellite evidence referenced is synthetic demonstration data [DEMO / SYNTHETIC]).*"

        return sanitized

    # ── Explanation Builders ──────────────────────────────────────────────────

    @classmethod
    def generate_investigation_summary(cls, db: Session, incident_id: str) -> AIResponseOut:
        """Mode A: Investigation Overview."""
        context = EvidenceContextBuilder.build_context(db, incident_id)
        if "error" in context:
            return cls._build_error_response("summary", context["error"])

        user_prompt = f"""Generate a concise investigation executive summary using ONLY the structured evidence below:
Context:
{json.dumps(context, default=str, indent=2)}

Include:
1. Spill detection & origin backtrack findings
2. Multi-temporal satellite evolution (highlight DEMO / SYNTHETIC provenance)
3. Prevailing ocean current alignment
4. Top candidate vessels based on deterministic attribution scores
5. Limitations & causality disclaimer (Correlation != Causation)"""

        provider_text = cls.call_gemini_provider(user_prompt)
        if provider_text:
            cleaned = cls.sanitize_causality_and_provenance(provider_text)
            return cls._format_response(
                mode="summary",
                text=cleaned,
                context=context,
                is_ai_generated=True,
            )

        # Deterministic Fallback
        return cls._build_deterministic_summary(context)

    @classmethod
    def generate_vessel_explanation(cls, db: Session, incident_id: str, vessel_id: str) -> AIResponseOut:
        """Mode B: Candidate Vessel Dossier Explanation."""
        context = EvidenceContextBuilder.build_context(db, incident_id, target_vessel_id=vessel_id)
        if "error" in context:
            return cls._build_error_response("vessel", context["error"])

        target = context.get("target_vessel")
        if not target:
            return cls._build_error_response("vessel", f"Vessel '{vessel_id}' not found in incident candidate records.")

        user_prompt = f"""Explain why candidate vessel '{vessel_id}' ({target.get('name')}) is investigatively relevant.
Use ONLY the structured facts provided below:
Target Vessel Evidence:
{json.dumps(target, default=str, indent=2)}

Incident Context:
Spill: {json.dumps(context.get('spill', {}), default=str)}
Origin: {json.dumps(context.get('origin', {}), default=str)}

Rules:
- Do NOT state the vessel caused the spill or is confirmed responsible.
- Explain existing trajectory, behaviour anomalies, and attribution score.
- State clearly that candidate relevance does not establish liability."""

        provider_text = cls.call_gemini_provider(user_prompt)
        if provider_text:
            cleaned = cls.sanitize_causality_and_provenance(provider_text)
            return cls._format_response(
                mode="vessel",
                text=cleaned,
                context=context,
                is_ai_generated=True,
            )

        return cls._build_deterministic_vessel_explanation(context, vessel_id)

    @classmethod
    def generate_timeline_explanation(cls, db: Session, incident_id: str) -> AIResponseOut:
        """Mode C: Chronological Event Correlation Flow."""
        context = EvidenceContextBuilder.build_context(db, incident_id)
        if "error" in context:
            return cls._build_error_response("timeline", context["error"])

        user_prompt = f"""Explain the chronological sequence and event correlation flow for incident '{incident_id}'.
Use ONLY these timeline events:
{json.dumps(context.get('timeline_events', []), default=str, indent=2)}

Rules:
- Explain progression: Satellite Observation -> Detection -> Origin Estimate -> Vessel Encounter -> Spill Evolution.
- Emphasize that chronological sequence does not prove causation."""

        provider_text = cls.call_gemini_provider(user_prompt)
        if provider_text:
            cleaned = cls.sanitize_causality_and_provenance(provider_text)
            return cls._format_response(
                mode="timeline",
                text=cleaned,
                context=context,
                is_ai_generated=True,
            )

        return cls._build_deterministic_timeline_explanation(context)

    @classmethod
    def generate_evidence_explanation(cls, db: Session, incident_id: str) -> AIResponseOut:
        """Mode D: Evidence Categories & Attribution Breakdown."""
        context = EvidenceContextBuilder.build_context(db, incident_id)
        if "error" in context:
            return cls._build_error_response("evidence", context["error"])

        user_prompt = f"""Explain the multi-category evidence structure and candidate attribution scoring for incident '{incident_id}'.
Use ONLY this evidence:
Attribution: {json.dumps(context.get('candidate_rankings', []), default=str, indent=2)}
Satellite: {json.dumps(context.get('satellite', {}), default=str, indent=2)}
Currents: {json.dumps(context.get('currents', {}), default=str, indent=2)}"""

        provider_text = cls.call_gemini_provider(user_prompt)
        if provider_text:
            cleaned = cls.sanitize_causality_and_provenance(provider_text)
            return cls._format_response(
                mode="evidence",
                text=cleaned,
                context=context,
                is_ai_generated=True,
            )

        return cls._build_deterministic_evidence_explanation(context)

    @classmethod
    def answer_investigator_question(
        cls,
        db: Session,
        incident_id: str,
        question: str,
        vessel_id: Optional[str] = None
    ) -> AIResponseOut:
        """Mode E: Investigator Q&A with Strict Fact Bounding."""
        q_clean = question.strip()
        if len(q_clean) < 3 or len(q_clean) > 500:
            return cls._build_error_response("question", "Question must be between 3 and 500 characters.")

        context = EvidenceContextBuilder.build_context(db, incident_id, target_vessel_id=vessel_id)
        if "error" in context:
            return cls._build_error_response("question", context["error"])

        # Check for obvious out-of-scope queries (weather storms, crew, company owners, oil market)
        out_of_scope_keywords = ["storm", "cyclone", "hurricane", "captain", "crew", "owner", "insurance", "cargo price", "refinery"]
        if any(k in q_clean.lower() for k in out_of_scope_keywords):
            return cls._format_response(
                mode="question",
                text="Insufficient data available. The structured investigation record contains no data regarding storms, crew details, vessel ownership, or external market parameters.",
                context=context,
                is_ai_generated=False,
            )

        user_prompt = f"""Answer this investigator question using ONLY the provided incident evidence:
Question: "{q_clean}"

Evidence:
{json.dumps(context, default=str, indent=2)}


CRITICAL: If the answer is not explicitly documented in the evidence, answer strictly:
"Insufficient data available."
Do NOT invent maritime facts or guess."""

        provider_text = cls.call_gemini_provider(user_prompt)
        if provider_text:
            cleaned = cls.sanitize_causality_and_provenance(provider_text)
            return cls._format_response(
                mode="question",
                text=cleaned,
                context=context,
                is_ai_generated=True,
            )

        # Fallback question answering
        return cls._build_deterministic_question_response(context, q_clean, vessel_id)

    # ── Deterministic Fallbacks ───────────────────────────────────────────────

    @classmethod
    def _build_deterministic_summary(cls, ctx: Dict[str, Any]) -> AIResponseOut:
        spill = ctx.get("spill", {})
        origin = ctx.get("origin", {})
        sat = ctx.get("satellite", {})
        drift = sat.get("drift_correlation", {})
        cands = ctx.get("candidate_rankings", [])
        top_cand = cands[0] if cands else None

        text = (
            f"### Executive Investigation Summary: Incident {ctx.get('incident_id')}\n\n"
            f"**1. Spill Detection & Characterization:**\n"
            f"- Identified slick area: **{spill.get('area_km2', 'N/A')} km²** detected via {spill.get('detection_method', 'SAR')} "
            f"with confidence {spill.get('confidence', 'N/A')}.\n"
            f"- Reverse drift hindcast estimated origin at **{origin.get('center_lat', 'N/A')}°N, {origin.get('center_lon', 'N/A')}°E** "
            f"within an uncertainty perimeter of **{origin.get('uncertainty_radius_km', 'N/A')} km** "
            f"({origin.get('provenance', 'ESTIMATED')}).\n\n"
            f"**2. Satellite Slick Evolution:**\n"
            f"- Correlated **{sat.get('observation_count', 0)} multi-temporal passes** ({sat.get('data_provenance', 'DEMO / SYNTHETIC')}).\n"
            f"- Slick expanded by **+{sat.get('net_area_growth_km2', 'N/A')} km²** (+{sat.get('net_area_growth_pct', 'N/A')}%) "
            f"over 24 hours, with a total centroid displacement of **{sat.get('total_centroid_displacement_km', 'N/A')} km**.\n"
            f"- Drift vector is **{drift.get('spatial_consistency', 'spatially consistent')}** with modelled regional currents "
            f"({drift.get('modelled_current_direction_deg', 'N/A')}° at {drift.get('modelled_current_speed_knots', 'N/A')} kts).\n\n"
            f"**3. Candidate Vessel Attribution:**\n"
        )
        if top_cand:
            text += (
                f"- Top candidate: **{top_cand.get('vessel_name')}** ({top_cand.get('vessel_id')}) with attribution score "
                f"**{top_cand.get('attribution_score')} / 100** ({top_cand.get('confidence_band')}).\n"
                f"- Candidate relevance is based on spatial-temporal proximity and detected trajectory anomalies. "
                f"This evidence indicates candidate association and does not establish legal causation."
            )
        else:
            text += "- No candidate vessels currently identified within the spatial-temporal filtering window."

        findings = [
            f"Primary slick footprint recorded at {spill.get('area_km2', 0)} km² with {origin.get('uncertainty_radius_km', 0)} km origin uncertainty buffer.",
            f"Multi-temporal satellite tracking ({sat.get('data_provenance')}) records {sat.get('total_centroid_displacement_km')} km net centroid migration.",
            f"Prevailing current alignment: {drift.get('movement_agreement', 'Consistent with regional drift')}.",
            f"Candidate ranking: {len(cands)} vessel(s) evaluated; top candidate score: {top_cand.get('attribution_score') if top_cand else 'N/A'}.",
        ]

        return cls._format_response(mode="summary", text=text, context=ctx, is_ai_generated=False, key_findings=findings)

    @classmethod
    def _build_deterministic_vessel_explanation(cls, ctx: Dict[str, Any], vessel_id: str) -> AIResponseOut:
        target = ctx.get("target_vessel", {})
        anomalies = target.get("behaviour_anomalies", [])
        scores = target.get("category_scores", {})

        text = (
            f"### Candidate Vessel Dossier: {target.get('name', 'Unknown')} ({vessel_id})\n\n"
            f"**Investigative Candidate Relevance:**\n"
            f"- **Rank:** #{target.get('ranking', 'N/A')} among evaluated candidates\n"
            f"- **Overall Attribution Score:** **{target.get('attribution_score', 'N/A')} / 100** ({target.get('confidence_band', 'N/A')})\n\n"
            f"**Evidence Breakdown:**\n"
            f"- **Spatial Proximity:** {scores.get('spatial', scores.get('spatial_proximity', 'N/A'))} / 30\n"
            f"- **Trajectory Plausibility:** {scores.get('trajectory', scores.get('trajectory_plausibility', 'N/A'))} / 25\n"
            f"- **Behaviour Anomalies:** {scores.get('behaviour', scores.get('behaviour_anomalies', 'N/A'))} / 25\n"
            f"- **Temporal Concurrency:** {scores.get('temporal', scores.get('temporal_concurrency', 'N/A'))} / 20\n"
            f"- **Data Quality:** {scores.get('quality', 'N/A')} / 10\n\n"
            f"**Detected Anomalies & Zone Interactions:**\n"
        )
        if anomalies:
            for a in anomalies:
                text += f"- **{a.get('type')}:** {a.get('description')} (Severity: {a.get('severity')})\n"
        else:
            text += "- No abnormal speed or course deviation anomalies flagged in AIS reconstruction.\n"

        text += (
            f"\n**Investigative Assessment:**\n"
            f"The vessel is identified as a candidate due to close spatial and temporal association with the estimated origin zone. "
            f"This score reflects circumstantial multi-criteria correlation and does not independently prove causation."
        )

        findings = [
            f"Candidate Rank #{target.get('ranking', 'N/A')} with composite attribution score {target.get('attribution_score', 'N/A')}/100.",
            f"AIS behaviour analysis flags {len(anomalies)} anomalous operational pattern(s).",
            "Investigative relevance is correlation-based and subject to physical confirmation.",
        ]

        return cls._format_response(mode="vessel", text=text, context=ctx, is_ai_generated=False, key_findings=findings)

    @classmethod
    def _build_deterministic_timeline_explanation(cls, ctx: Dict[str, Any]) -> AIResponseOut:
        events = ctx.get("timeline_events", [])
        text = (
            f"### Investigation Chronological Correlation Flow: Incident {ctx.get('incident_id')}\n\n"
            f"The unified timeline correlates deterministic milestones across sensory and intelligence sources:\n\n"
        )
        for idx, ev in enumerate(events[:8], 1):
            text += f"{idx}. **[{ev.get('timestamp')}] {ev.get('event_type')}**: {ev.get('title')} — *{ev.get('description')}* ({ev.get('provenance')})\n"

        text += (
            f"\n**Correlation Analysis:**\n"
            f"Sequential ordering demonstrates temporal alignment between candidate vessel movements and slick expansion. "
            f"Investigators should note that chronological precedence is necessary but insufficient to establish liability without forensic validation."
        )

        return cls._format_response(mode="timeline", text=text, context=ctx, is_ai_generated=False)

    @classmethod
    def _build_deterministic_evidence_explanation(cls, ctx: Dict[str, Any]) -> AIResponseOut:
        cands = ctx.get("candidate_rankings", [])
        sat = ctx.get("satellite", {})
        drift = sat.get("drift_correlation", {})

        text = (
            f"### Deterministic Evidence Structure & Correlation Matrix\n\n"
            f"**1. Satellite Slick Observation & Evolution (Phase 11):**\n"
            f"- Multi-pass tracking recorded {sat.get('observation_count', 0)} passes ({sat.get('data_provenance', 'DEMO / SYNTHETIC')}).\n"
            f"- Directional migration ({drift.get('modelled_current_direction_deg')}°) shows {drift.get('spatial_consistency', 'spatial consistency')} "
            f"with hydrodynamic currents ({drift.get('model_agreement_rating')} agreement).\n\n"
            f"**2. AIS Spatial & Trajectory Evidence (Phases 7–8):**\n"
            f"- Candidates filtered by backward particle trajectory origin buffers.\n"
            f"- Kinematic anomalies scored across speed changes, heading shifts, and origin proximity.\n\n"
            f"**3. Candidate Attribution Ranking (Phase 9):**\n"
        )
        for c in cands:
            text += f"- **#{c.get('rank')} {c.get('vessel_name')}**: Score {c.get('attribution_score')}/100 ({c.get('confidence_band')})\n"

        text += (
            f"\n**Investigative Governance:**\n"
            f"All scores are deterministically computed by analytical algorithms. Attribution rankings serve to prioritize investigation resources."
        )

        return cls._format_response(mode="evidence", text=text, context=ctx, is_ai_generated=False)

    @classmethod
    def _build_deterministic_question_response(cls, ctx: Dict[str, Any], question: str, vessel_id: Optional[str]) -> AIResponseOut:
        q_lower = question.lower()

        if "why" in q_lower and ("relevant" in q_lower or "candidate" in q_lower or "high" in q_lower):
            cands = ctx.get("candidate_rankings", [])
            target = next((c for c in cands if c["vessel_id"] == vessel_id), cands[0] if cands else None)
            if target:
                text = (
                    f"Candidate vessel **{target.get('vessel_name')}** ({target.get('vessel_id')}) is highly relevant because it "
                    f"attained the highest composite attribution score (**{target.get('attribution_score')}/100**) within the investigation window. "
                    f"Key supporting factors include close proximity to the estimated origin zone and anomalous course/speed patterns during the release window. "
                    f"This correlation reflects investigative priority and does not constitute conclusive liability proof."
                )
            else:
                text = "Insufficient data available regarding the requested candidate vessel."
        elif "before" in q_lower or "detection" in q_lower or "timeline" in q_lower:
            events = ctx.get("timeline_events", [])
            text = (
                f"Prior to spill detection, the investigation reconstructs the candidate vessel approaching the designated maritime sector, "
                f"followed by hindcast Lagrangian particle backtracking establishing the release window origin buffer. "
                f"A total of {len(events)} chronological events are logged in the authoritative timeline."
            )
        elif "evolve" in q_lower or "satellite" in q_lower or "drift" in q_lower:
            sat = ctx.get("satellite", {})
            text = (
                f"The oil spill evolved across {sat.get('observation_count', 0)} multi-temporal satellite passes ({sat.get('data_provenance')}). "
                f"The slick expanded by +{sat.get('net_area_growth_km2')} km² (+{sat.get('net_area_growth_pct')}%) over 24 hours while migrating "
                f"{sat.get('total_centroid_displacement_km')} km SSW, showing high spatial agreement with regional ocean currents."
            )
        elif "limitation" in q_lower or "missing" in q_lower:
            text = (
                "Key investigation limitations include:\n"
                "1. Satellite data consists of demonstration synthetic passes [DEMO / SYNTHETIC] with a 12-hour sampling interval.\n"
                "2. AIS observations are subject to terrestrial/satellite receiver coverage latency.\n"
                "3. Hydrodynamic drift trajectories reflect depth-averaged numerical model estimates.\n"
                "4. Causality cannot be autonomously established from spatial-temporal correlation alone."
            )
        else:
            text = "Insufficient data available in the structured investigation record to answer this specific query."

        return cls._format_response(mode="question", text=text, context=ctx, is_ai_generated=False)

    # ── Helpers ───────────────────────────────────────────────────────────────

    @classmethod
    def _format_response(
        cls,
        mode: str,
        text: str,
        context: Dict[str, Any],
        is_ai_generated: bool,
        key_findings: Optional[List[str]] = None
    ) -> AIResponseOut:
        status_label = "ONLINE" if is_ai_generated else "STANDBY - DETERMINISTIC FALLBACK"
        cands = context.get("candidate_rankings", [])
        top_cand = cands[0] if cands else None

        default_findings = key_findings or [
            f"Incident: {context.get('incident_id')} ({context.get('incident_name')})",
            f"Spill Area: {context.get('spill', {}).get('area_km2', 'N/A')} km² | Origin Uncertainty: {context.get('origin', {}).get('uncertainty_radius_km', 'N/A')} km",
            f"Top Candidate: {top_cand.get('vessel_name') if top_cand else 'None'} (Score {top_cand.get('attribution_score') if top_cand else 'N/A'}/100)",
        ]

        return AIResponseOut(
            available=is_ai_generated,
            status=status_label,
            mode=mode,
            response=text,
            summary=text[:250] + "..." if len(text) > 250 else text,
            key_findings=default_findings,
            evidence_explanation=[
                "Evidence integration combines multi-temporal satellite evolution, AIS trajectory kinematics, and hydrodynamic hindcasting.",
                "Correlation weights are deterministically assigned by the Phase 9 attribution engine.",
            ],
            warnings=[
                "Correlation ≠ Causation: Candidate relevance does not prove vessel discharge liability.",
                "Analytical values are sourced directly from the deterministic backend without recalculation.",
            ],
            limitations=context.get("general_limitations", [
                "Demonstration synthetic data used for scenario evaluation.",
                "Final attribution determination remains with the human investigator.",
            ]),
            provenance_notices=[
                f"Satellite Data: {context.get('satellite', {}).get('data_provenance', 'DEMO / SYNTHETIC')}",
                f"Origin Estimate: {TimelineConfig.PROVENANCE_ESTIMATED}",
                "Attribution Scores: DERIVED (Phase 9 Model)",
            ],
            suggested_next_steps=[
                "Cross-examine candidate vessel engine logbooks and oily water separator records.",
                "Inspect port state control inspection records for candidate vessels at next port of call.",
                "Obtain optical multispectral imagery to assess oil emulsion thickness.",
            ],
            context_summary={
                "incident_id": context.get("incident_id"),
                "candidate_count": len(context.get("candidate_rankings", [])),
                "satellite_passes": context.get("satellite", {}).get("observation_count", 0),
                "mode": mode,
            }
        )

    @classmethod
    def _build_error_response(cls, mode: str, error_msg: str) -> AIResponseOut:
        return AIResponseOut(
            available=False,
            status="STANDBY - DETERMINISTIC FALLBACK",
            mode=mode,
            response=f"Insufficient data available. {error_msg}",
            error=error_msg,
            warnings=["Unable to retrieve authoritative evidence context for requested entity."],
            limitations=["Context retrieval failed."],
        )
