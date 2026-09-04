"""
OCEANTRACE AI — Phase 12: AI-Assisted Investigation & Explainability API Router

Provides explainability endpoints that expose natural-language descriptions of
deterministic investigation evidence. AI is strictly an explainability layer.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.incident import Incident
from app.db.models.vessel import Vessel
from app.schemas.schemas import AIStatusOut, AIResponseOut, AIQuestionRequest
from app.services.ai_investigation import AiInvestigationService

router = APIRouter(prefix="/api/incidents/{incident_id}/ai", tags=["ai-investigation"])


def _verify_incident_exists(db: Session, incident_id: str) -> Incident:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found"
        )
    return incident


@router.get("/status", response_model=AIStatusOut)
def get_ai_status(
    incident_id: str,
    db: Session = Depends(get_db)
):
    """
    Check AI explainability assistant availability and active model configuration.
    Operates independently of LLM availability.
    """
    _verify_incident_exists(db, incident_id)
    return AiInvestigationService.get_status()


@router.post("/summary", response_model=AIResponseOut)
def get_investigation_summary(
    incident_id: str,
    db: Session = Depends(get_db)
):
    """
    Generate an evidence-based executive investigation summary.
    Combines spill detection, origin backtrack, satellite evolution, and candidate attribution.
    """
    _verify_incident_exists(db, incident_id)
    return AiInvestigationService.generate_investigation_summary(db, incident_id)


@router.post("/vessel/{vessel_id}", response_model=AIResponseOut)
def get_vessel_explanation(
    incident_id: str,
    vessel_id: str,
    db: Session = Depends(get_db)
):
    """
    Explain candidate relevance for a specific vessel using exact deterministic evidence.
    Does not state causation or prove liability.
    """
    _verify_incident_exists(db, incident_id)
    vessel = db.query(Vessel).filter(Vessel.id == vessel_id).first()
    if not vessel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vessel '{vessel_id}' not found"
        )
    return AiInvestigationService.generate_vessel_explanation(db, incident_id, vessel_id)


@router.post("/timeline", response_model=AIResponseOut)
def get_timeline_explanation(
    incident_id: str,
    db: Session = Depends(get_db)
):
    """
    Explain the chronological flow and event correlation across sensory milestones.
    Clarifies that sequential ordering does not establish causation.
    """
    _verify_incident_exists(db, incident_id)
    return AiInvestigationService.generate_timeline_explanation(db, incident_id)


@router.post("/evidence", response_model=AIResponseOut)
def get_evidence_explanation(
    incident_id: str,
    db: Session = Depends(get_db)
):
    """
    Explain the multi-category evidence framework and candidate score contributions.
    """
    _verify_incident_exists(db, incident_id)
    return AiInvestigationService.generate_evidence_explanation(db, incident_id)


@router.post("/question", response_model=AIResponseOut)
def ask_investigator_question(
    incident_id: str,
    req: AIQuestionRequest,
    db: Session = Depends(get_db)
):
    """
    Answer an investigator query using ONLY supplied evidence context.
    If the requested parameter is missing from the record, returns 'Insufficient data available.'
    """
    _verify_incident_exists(db, incident_id)
    if req.vessel_id:
        vessel = db.query(Vessel).filter(Vessel.id == req.vessel_id).first()
        if not vessel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vessel '{req.vessel_id}' not found"
            )
    return AiInvestigationService.answer_investigator_question(
        db=db,
        incident_id=incident_id,
        question=req.question,
        vessel_id=req.vessel_id
    )
