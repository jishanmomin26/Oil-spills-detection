from app.db.database import Base  # noqa: F401 — ensures Base knows all models
from app.db.models.incident import (  # noqa: F401
    DataProvenance,
    Incident,
    SatelliteObservation,
    OilSpill,
    WeatherObservation,
    OceanCurrent,
    DriftSimulation,
    DriftParticle,
    OriginEstimate,
    Evidence,
    InvestigationTimelineEvent,
    InvestigationReport,
)
from app.db.models.vessel import (  # noqa: F401
    Vessel,
    VesselTrack,
    AISPoint,
    BehaviourAnomaly,
    AttributionScore,
    TrajectoryAnalysis,
    FilteringResult,
)
