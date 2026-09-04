"""
OCEANTRACE AI — Phase 8: Vessel Behaviour Analysis Configuration

Centralized, auditable thresholds for maritime vessel kinematics,
maneuver detection, and spill interaction.
No magic numbers scattered throughout the engine.
"""

class BehaviourConfig:
    # Speed thresholds
    LOW_SPEED_THRESHOLD_KNOTS: float = 3.0
    STATIONARY_THRESHOLD_KNOTS: float = 0.5
    LOW_SPEED_MIN_DURATION_MINUTES: float = 30.0
    SUDDEN_SPEED_CHANGE_PERCENT: float = 20.0  # 20% change threshold
    MIN_SPEED_CHANGE_KNOTS: float = 1.5         # Absolute delta minimum to avoid noise

    # Course / heading thresholds
    SHARP_TURN_THRESHOLD_DEGREES: float = 45.0
    COURSE_CHANGE_THRESHOLD_DEGREES: float = 20.0
    REPEATED_TURNS_WINDOW_POINTS: int = 6
    REPEATED_TURNS_MIN_COUNT: int = 3

    # Loitering & spatial thresholds
    LOITERING_RADIUS_KM: float = 3.0
    LOITERING_MIN_DURATION_MINUTES: float = 45.0
    LOITERING_MAX_DISPLACEMENT_RATIO: float = 0.35  # net displacement / total path < 0.35 indicates loitering
    MIN_LOITERING_POINTS: int = 6

    # Route deviation thresholds
    ROUTE_DEVIATION_CORRIDOR_KM: float = 8.0
    ROUTE_DEVIATION_HEADING_DEGREES: float = 30.0
    ROUTE_DEVIATION_MIN_POINTS: int = 3

    # Spill proximity threshold
    CLOSE_APPROACH_THRESHOLD_KM: float = 15.0
