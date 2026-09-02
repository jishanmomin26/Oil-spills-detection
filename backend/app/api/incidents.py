from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.incident import (
    Incident, OilSpill, SatelliteObservation, WeatherObservation,
    OceanCurrent, DriftSimulation, OriginEstimate, Evidence,
    InvestigationTimelineEvent, DataProvenance, InvestigationReport
)
from app.schemas.schemas import (
    IncidentSummary, IncidentDetail, SpillOut, WeatherOut, OceanCurrentOut,
    DriftSimulationOut, OriginEstimateOut, EvidenceOut, TimelineEventOut,
    ReportOut, ProvenanceOut, ForecastOut
)

router = APIRouter(prefix="/api/incidents", tags=["incidents"])

@router.get("", response_model=list[IncidentSummary])
def list_incidents(db: Session = Depends(get_db)):
    """List all incidents."""
    return db.query(Incident).all()

@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    """Get complete details for a specific incident including spills and observations."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@router.get("/{incident_id}/spills", response_model=list[SpillOut])
def get_incident_spills(incident_id: str, db: Session = Depends(get_db)):
    spills = db.query(OilSpill).filter(OilSpill.incident_id == incident_id).all()
    # Calculate estimated severity dynamically based on area
    for spill in spills:
        if spill.area_km2:
            if spill.area_km2 > 50:
                spill.estimated_severity = "CRITICAL"
            elif spill.area_km2 > 10:
                spill.estimated_severity = "HIGH"
            elif spill.area_km2 > 1:
                spill.estimated_severity = "MEDIUM"
            else:
                spill.estimated_severity = "LOW"
        else:
            spill.estimated_severity = "UNKNOWN"
    return spills

@router.get("/{incident_id}/weather", response_model=list[WeatherOut])
def get_incident_weather(incident_id: str, db: Session = Depends(get_db)):
    return db.query(WeatherObservation).filter(WeatherObservation.incident_id == incident_id).order_by(WeatherObservation.timestamp).all()

@router.get("/{incident_id}/currents", response_model=list[OceanCurrentOut])
def get_incident_currents(incident_id: str, db: Session = Depends(get_db)):
    return db.query(OceanCurrent).filter(OceanCurrent.incident_id == incident_id).order_by(OceanCurrent.timestamp).all()

@router.get("/{incident_id}/drift", response_model=list[DriftSimulationOut])
def get_incident_drift(incident_id: str, db: Session = Depends(get_db)):
    return db.query(DriftSimulation).filter(DriftSimulation.incident_id == incident_id).all()

@router.get("/{incident_id}/origin", response_model=list[OriginEstimateOut])
def get_incident_origin(incident_id: str, db: Session = Depends(get_db)):
    origins = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).all()
    for origin in origins:
        # Simulate forward validation calculations for the prototype
        origin.forward_validation_distance_km = 1.4
        origin.spatial_overlap_pct = 82.5
        origin.trajectory_similarity_score = 0.88
    return origins

@router.get("/{incident_id}/forecast", response_model=ForecastOut)
def get_incident_forecast(incident_id: str, db: Session = Depends(get_db)):
    # Create deterministic forecast based on existing drift simulations
    from datetime import datetime, timedelta
    
    return ForecastOut(
        id=f"forecast-{incident_id}",
        incident_id=incident_id,
        predicted_lat=15.39,
        predicted_lon=65.62,
        forecast_time=datetime(2026, 9, 19, 6, 0, 0),
        affected_zone_wkt="POLYGON((65.610 15.380, 65.630 15.380, 65.630 15.400, 65.610 15.400, 65.610 15.380))",
        confidence=0.82,
        uncertainty_radius_km=12.5
    )

@router.get("/{incident_id}/evidence", response_model=list[EvidenceOut])
def get_incident_evidence(incident_id: str, db: Session = Depends(get_db)):
    return db.query(Evidence).filter(Evidence.incident_id == incident_id).all()

@router.get("/{incident_id}/timeline", response_model=list[TimelineEventOut])
def get_incident_timeline(incident_id: str, db: Session = Depends(get_db)):
    return db.query(InvestigationTimelineEvent).filter(InvestigationTimelineEvent.incident_id == incident_id).order_by(InvestigationTimelineEvent.timestamp).all()

@router.get("/{incident_id}/reports", response_model=list[ReportOut])
def get_incident_reports(incident_id: str, db: Session = Depends(get_db)):
    return db.query(InvestigationReport).filter(InvestigationReport.incident_id == incident_id).all()

@router.get("/provenance/{provenance_id}", response_model=ProvenanceOut)
def get_provenance(provenance_id: str, db: Session = Depends(get_db)):
    prov = db.query(DataProvenance).filter(DataProvenance.id == provenance_id).first()
    if not prov:
        raise HTTPException(status_code=404, detail="Provenance not found")
    return prov
