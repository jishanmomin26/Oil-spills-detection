from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.db.models.vessel import (
    Vessel, VesselTrack, AISPoint, BehaviourAnomaly, AttributionScore,
    FilteringResult, TrajectoryAnalysis
)
from app.schemas.schemas import (
    VesselOut, VesselTrackOut, AnomalyOut, AttributionScoreOut,
    FilteringResultOut, FilteringFunnelOut, TrajectoryAnalysisOut,
    AisReconstructionStatsOut, VesselBehaviourProfileOut, VesselAttributionOut
)
from app.services.ais_reconstruction import AisReconstructionService
from app.services.ais_filtering import AisFiltering
from app.services.proximity_engine import ProximityEngine
from app.services.trajectory_analysis import TrajectoryAnalysis as TrajectoryAnalysisEngine
from app.services.behaviour_engine import VesselBehaviourEngine
from app.services.attribution_engine import VesselAttributionEngine
from app.db.models.incident import OriginEstimate, OilSpill
from datetime import datetime

router = APIRouter(prefix="/api/incidents/{incident_id}/vessels", tags=["vessels"])

@router.get("", response_model=list[VesselOut])
def list_vessels(
    incident_id: str,
    candidates_only: bool = Query(False, description="Return only high-priority candidates"),
    db: Session = Depends(get_db)
):
    query = db.query(Vessel)
    if candidates_only:
        query = query.filter(Vessel.is_candidate == True)
    return query.all()

@router.get("/tracks", response_model=list[VesselTrackOut])
def list_vessel_tracks(incident_id: str, db: Session = Depends(get_db)):
    tracks = db.query(VesselTrack).filter(VesselTrack.incident_id == incident_id).all()
    out_tracks, _ = AisReconstructionService.simulate_and_reconstruct(tracks)
    return out_tracks

@router.get("/reconstruction", response_model=AisReconstructionStatsOut)
def get_reconstruction_stats(incident_id: str, db: Session = Depends(get_db)):
    tracks = db.query(VesselTrack).filter(VesselTrack.incident_id == incident_id).all()
    _, stats = AisReconstructionService.simulate_and_reconstruct(tracks)
    return AisReconstructionStatsOut(**stats)

@router.get("/anomalies", response_model=list[AnomalyOut])
def list_anomalies(incident_id: str, db: Session = Depends(get_db)):
    return db.query(BehaviourAnomaly).filter(BehaviourAnomaly.incident_id == incident_id).all()

@router.get("/filtering", response_model=FilteringFunnelOut)
def get_filtering_funnel(incident_id: str, db: Session = Depends(get_db)):
    results = db.query(FilteringResult).filter(FilteringResult.incident_id == incident_id).all()
    
    total = db.query(Vessel).count()
    spatial = db.query(FilteringResult).filter(FilteringResult.incident_id == incident_id, FilteringResult.stage == "spatial", FilteringResult.passed == True).count()
    temporal = db.query(FilteringResult).filter(FilteringResult.incident_id == incident_id, FilteringResult.stage == "temporal", FilteringResult.passed == True).count()
    traj = db.query(FilteringResult).filter(FilteringResult.incident_id == incident_id, FilteringResult.stage == "trajectory", FilteringResult.passed == True).count()
    behav = db.query(FilteringResult).filter(FilteringResult.incident_id == incident_id, FilteringResult.stage == "behaviour", FilteringResult.passed == True).count()
    
    return {
        "total_vessels": total,
        "spatial_candidates": spatial,
        "temporal_candidates": temporal,
        "trajectory_candidates": traj,
        "behaviour_candidates": behav,
        "final_candidates": behav,
        "details": results
    }

@router.get("/trajectory_analysis", response_model=list[TrajectoryAnalysisOut])
def list_trajectory_analysis(incident_id: str, db: Session = Depends(get_db)):
    return db.query(TrajectoryAnalysis).filter(TrajectoryAnalysis.incident_id == incident_id).all()

@router.get("/filter")
def filter_vessels_dynamic(
    incident_id: str,
    max_distance_km: Optional[float] = Query(None),
    min_time: Optional[datetime] = Query(None),
    max_time: Optional[datetime] = Query(None),
    vessel_types: Optional[str] = Query(None, description="Comma-separated list of types"),
    min_speed: Optional[float] = Query(None),
    max_speed: Optional[float] = Query(None),
    must_encounter_spill: bool = Query(False),
    db: Session = Depends(get_db)
):
    vessels = db.query(Vessel).all()
    tracks = db.query(VesselTrack).filter(VesselTrack.incident_id == incident_id).all()
    origin = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).first()
    spill = db.query(OilSpill).filter(OilSpill.incident_id == incident_id).first()
    
    if not origin or not spill:
        raise HTTPException(status_code=404, detail="Incident origin or spill not found")
        
    filters = {
        "max_distance_km": max_distance_km,
        "min_time": min_time,
        "max_time": max_time,
        "vessel_types": vessel_types.split(",") if vessel_types else None,
        "min_speed": min_speed,
        "max_speed": max_speed,
        "must_encounter_spill": must_encounter_spill
    }
    
    # We use simulated/reconstructed tracks for completeness
    out_tracks, _ = AisReconstructionService.simulate_and_reconstruct(tracks)
    
    result = AisFiltering.filter_vessels(
        vessels=vessels,
        tracks=out_tracks,
        spill_lat=origin.center_lat,
        spill_lon=origin.center_lon,
        spill_zone_wkt=spill.geometry_wkt,
        filters=filters
    )
    
    # Return matched vessel objects but formatted nicely
    result["matched_vessels"] = [
        {
            "id": v.id,
            "name": v.name,
            "vessel_type": v.vessel_type,
            "mmsi": v.mmsi,
            "flag_state": v.flag_state
        }
        for v in result["matched_vessels"]
    ]
    return result

@router.get("/{vessel_id}/intelligence")
def get_vessel_intelligence(
    incident_id: str, 
    vessel_id: str,
    db: Session = Depends(get_db)
):
    track = db.query(VesselTrack).filter(VesselTrack.incident_id == incident_id, VesselTrack.vessel_id == vessel_id).first()
    origin = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).first()
    spill = db.query(OilSpill).filter(OilSpill.incident_id == incident_id).first()
    
    if not track or not origin or not spill:
        raise HTTPException(status_code=404, detail="Data missing")
        
    out_tracks, _ = AisReconstructionService.simulate_and_reconstruct([track])
    if not out_tracks:
        raise HTTPException(status_code=404, detail="Track reconstruction failed")
        
    track_dict = out_tracks[0]
    pts = track_dict["points"] if isinstance(track_dict, dict) else track_dict.points
    
    proximity = ProximityEngine.calculate_origin_proximity(pts, origin.center_lat, origin.center_lon)
    encounter = ProximityEngine.calculate_spill_zone_encounter(pts, spill.geometry_wkt)
    approach = TrajectoryAnalysisEngine.analyze_approach_departure(pts, origin.center_lat, origin.center_lon)
    events = TrajectoryAnalysisEngine.detect_trajectory_events(pts)
    route_devs = TrajectoryAnalysisEngine.detect_route_deviation(pts)
    
    return {
        "proximity": proximity,
        "encounter": encounter,
        "approach_departure": approach,
        "events": events,
        "route_deviations": route_devs
    }


@router.get("/{vessel_id}/behaviour", response_model=VesselBehaviourProfileOut)
def get_vessel_behaviour(
    incident_id: str,
    vessel_id: str,
    db: Session = Depends(get_db)
):
    """
    Phase 8: Complete deterministic vessel behaviour analysis profile and event stream.
    """
    vessel = db.query(Vessel).filter(Vessel.id == vessel_id).first()
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found")

    track = db.query(VesselTrack).filter(
        VesselTrack.incident_id == incident_id,
        VesselTrack.vessel_id == vessel_id
    ).first()

    origin = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).first()
    spill = db.query(OilSpill).filter(OilSpill.incident_id == incident_id).first()

    if not track:
        return VesselBehaviourEngine._empty_profile(vessel.id, vessel.name, vessel.mmsi, incident_id)

    out_tracks, _ = AisReconstructionService.simulate_and_reconstruct([track])
    pts = out_tracks[0]["points"] if out_tracks else []

    profile = VesselBehaviourEngine.analyze_vessel_behaviour(
        vessel=vessel,
        track_points=pts,
        incident_id=incident_id,
        origin_lat=origin.center_lat if origin else None,
        origin_lon=origin.center_lon if origin else None,
        origin_uncertainty_km=origin.uncertainty_radius_km if origin else None,
        spill_geometry_wkt=spill.geometry_wkt if spill else None,
    )
    return profile


@router.get("/attribution", response_model=list[VesselAttributionOut])
def get_incident_vessel_attribution(
    incident_id: str,
    candidates_only: bool = Query(True, description="Filter for priority candidates or all vessels"),
    w_spatial: Optional[float] = Query(None, description="Custom weight for spatial evidence"),
    w_temporal: Optional[float] = Query(None, description="Custom weight for temporal evidence"),
    w_trajectory: Optional[float] = Query(None, description="Custom weight for trajectory evidence"),
    w_behaviour: Optional[float] = Query(None, description="Custom weight for behaviour evidence"),
    w_quality: Optional[float] = Query(None, description="Custom weight for data quality"),
    db: Session = Depends(get_db)
):
    """
    Phase 9: Multi-criteria explainable evidence scoring and candidate vessel ranking.
    """
    custom_weights = {}
    if w_spatial is not None: custom_weights["spatial"] = w_spatial
    if w_temporal is not None: custom_weights["temporal"] = w_temporal
    if w_trajectory is not None: custom_weights["trajectory"] = w_trajectory
    if w_behaviour is not None: custom_weights["behaviour"] = w_behaviour
    if w_quality is not None: custom_weights["quality"] = w_quality

    try:
        norm_weights = VesselAttributionEngine.validate_and_normalize_weights(custom_weights if custom_weights else None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    origin = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).first()
    spill = db.query(OilSpill).filter(OilSpill.incident_id == incident_id).first()

    query = db.query(Vessel)
    if candidates_only:
        query = query.filter(Vessel.is_candidate == True)
    vessels = query.all()

    tracks = db.query(VesselTrack).filter(VesselTrack.incident_id == incident_id).all()
    tracks_by_vessel = {t.vessel_id: t for t in tracks}
    out_tracks, _ = AisReconstructionService.simulate_and_reconstruct(tracks)
    pts_by_vessel = {t["vessel_id"]: t["points"] for t in out_tracks}

    scored_vessels = []
    for v in vessels:
        pts = pts_by_vessel.get(v.id, [])
        beh_profile = VesselBehaviourEngine.analyze_vessel_behaviour(
            vessel=v,
            track_points=pts,
            incident_id=incident_id,
            origin_lat=origin.center_lat if origin else None,
            origin_lon=origin.center_lon if origin else None,
            origin_uncertainty_km=origin.uncertainty_radius_km if origin else None,
            spill_geometry_wkt=spill.geometry_wkt if spill else None,
        )
        scored = VesselAttributionEngine.score_vessel(
            vessel=v,
            behaviour_profile=beh_profile,
            origin_estimate=origin,
            custom_weights=norm_weights,
        )
        scored_vessels.append(scored)

    ranked = VesselAttributionEngine.rank_candidates(scored_vessels)
    return ranked


@router.get("/{vessel_id}/attribution", response_model=VesselAttributionOut)
def get_vessel_attribution(
    incident_id: str,
    vessel_id: str,
    w_spatial: Optional[float] = Query(None),
    w_temporal: Optional[float] = Query(None),
    w_trajectory: Optional[float] = Query(None),
    w_behaviour: Optional[float] = Query(None),
    w_quality: Optional[float] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Phase 9: Detailed evidence breakdown for a single vessel.
    """
    vessel = db.query(Vessel).filter(Vessel.id == vessel_id).first()
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found")

    custom_weights = {}
    if w_spatial is not None: custom_weights["spatial"] = w_spatial
    if w_temporal is not None: custom_weights["temporal"] = w_temporal
    if w_trajectory is not None: custom_weights["trajectory"] = w_trajectory
    if w_behaviour is not None: custom_weights["behaviour"] = w_behaviour
    if w_quality is not None: custom_weights["quality"] = w_quality

    try:
        norm_weights = VesselAttributionEngine.validate_and_normalize_weights(custom_weights if custom_weights else None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    origin = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).first()
    spill = db.query(OilSpill).filter(OilSpill.incident_id == incident_id).first()

    track = db.query(VesselTrack).filter(
        VesselTrack.incident_id == incident_id,
        VesselTrack.vessel_id == vessel_id
    ).first()

    pts = []
    if track:
        out_tracks, _ = AisReconstructionService.simulate_and_reconstruct([track])
        if out_tracks:
            pts = out_tracks[0]["points"]

    beh_profile = VesselBehaviourEngine.analyze_vessel_behaviour(
        vessel=vessel,
        track_points=pts,
        incident_id=incident_id,
        origin_lat=origin.center_lat if origin else None,
        origin_lon=origin.center_lon if origin else None,
        origin_uncertainty_km=origin.uncertainty_radius_km if origin else None,
        spill_geometry_wkt=spill.geometry_wkt if spill else None,
    )
    return VesselAttributionEngine.score_vessel(
        vessel=vessel,
        behaviour_profile=beh_profile,
        origin_estimate=origin,
        custom_weights=norm_weights,
    )


