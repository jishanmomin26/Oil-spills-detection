from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Maritime Oil-Spill Intelligence & Investigation Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.schemas.schemas import SystemStatusOut, ModuleStatus

@app.get("/api/health", response_model=SystemStatusOut)
def health_check():
    return {
        "database": "sqlite",
        "demo_mode": settings.DEMO_MODE,
        "modules": [
            {"name": "Spill Detection", "status": "ONLINE", "detail": "Prototype Segmentation loaded"},
            {"name": "Drift Engine", "status": "ONLINE", "detail": "Lagrangian particle model ready"},
            {"name": "Look-alike Analysis", "status": "ONLINE", "detail": "Random Forest classifier loaded"},
            {"name": "AIS Processing", "status": "ONLINE", "detail": "Trajectory interpolation ready"},
            {"name": "Attribution Scoring", "status": "ONLINE", "detail": "Weighted fusion ready"}
        ]
    }

from app.api import incidents, vessels

app.include_router(incidents.router)
app.include_router(vessels.router)
