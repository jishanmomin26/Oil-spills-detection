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
    AisReconstructionStatsOut
)
from app.services.ais_reconstruction import AisReconstructionService

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

@router.get("/attribution", response_model=list[AttributionScoreOut])
def list_attribution_scores(incident_id: str, db: Session = Depends(get_db)):
    scores = db.query(AttributionScore).filter(AttributionScore.incident_id == incident_id).order_by(AttributionScore.rank).all()
    
    # Populate vessel name and type for convenience in the response
    for score in scores:
        if score.vessel:
            score.vessel_name = score.vessel.name
            score.vessel_type = score.vessel.vessel_type
            
    return scores

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
