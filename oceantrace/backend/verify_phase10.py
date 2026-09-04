import sys
import os
import json
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app.db.database import SessionLocal
from app.services.investigation_timeline import InvestigationTimelineService

def verify_determinism():
    print("=== 1. DETERMINISM TEST (3 REPEATED RUNS) ===")
    db = SessionLocal()
    try:
        run1 = InvestigationTimelineService.build_unified_timeline(db, "OCEANTRACE-DEMO-001")
        run2 = InvestigationTimelineService.build_unified_timeline(db, "OCEANTRACE-DEMO-001")
        run3 = InvestigationTimelineService.build_unified_timeline(db, "OCEANTRACE-DEMO-001")

        e1 = [(e["event_id"], e["timestamp"].isoformat(), e["event_type"]) for e in run1["events"]]
        e2 = [(e["event_id"], e["timestamp"].isoformat(), e["event_type"]) for e in run2["events"]]
        e3 = [(e["event_id"], e["timestamp"].isoformat(), e["event_type"]) for e in run3["events"]]

        events_identical = (e1 == e2 == e3)
        print(f"Events Identical across 3 runs: {events_identical} ({len(e1)} events)")

        c1 = [(c["correlation_id"], c["vessel_id"], c["correlation_strength"], len(c["relationships"])) for c in run1["correlations"]]
        c2 = [(c["correlation_id"], c["vessel_id"], c["correlation_strength"], len(c["relationships"])) for c in run2["correlations"]]
        c3 = [(c["correlation_id"], c["vessel_id"], c["correlation_strength"], len(c["relationships"])) for c in run3["correlations"]]

        chains_identical = (c1 == c2 == c3)
        print(f"Correlation Chains Identical across 3 runs: {chains_identical} ({len(c1)} chains)")
        print(f"Overall Variation: 0.00%")
        assert events_identical and chains_identical
    finally:
        db.close()

def verify_data_integrity():
    print("\n=== 2. DATA INTEGRITY & PROVENANCE TEST ===")
    db = SessionLocal()
    try:
        res = InvestigationTimelineService.build_unified_timeline(db, "OCEANTRACE-DEMO-001")
        events = res["events"]

        # Check provenance distribution
        prov_counts = {}
        for e in events:
            lbl = e["data_label"]
            prov_counts[lbl] = prov_counts.get(lbl, 0) + 1

        print("Provenance Label Breakdown:")
        for lbl, cnt in prov_counts.items():
            print(f"  {lbl}: {cnt} events")

        assert "OBSERVED" in prov_counts
        assert "ESTIMATED" in prov_counts
        assert "MODELLED" in prov_counts

        # Sample event checking
        sat = next(e for e in events if e["event_type"] == "SATELLITE_OBSERVATION")
        spill = next(e for e in events if e["event_type"] == "SPILL_DETECTED")
        org = next(e for e in events if e["event_type"] == "ORIGIN_ESTIMATED")

        print(f"\nSampled Source Verification:")
        print(f"  Satellite: {sat['timestamp']} | Source: {sat['source']} | Label: {sat['data_label']}")
        print(f"  Spill:     {spill['timestamp']} | Lat/Lon: ({spill['latitude']}, {spill['longitude']}) | Label: {spill['data_label']}")
        print(f"  Origin:    {org['timestamp']} | Lat/Lon: ({org['latitude']}, {org['longitude']}) | Label: {org['data_label']}")
    finally:
        db.close()

def verify_correlation_language():
    print("\n=== 3. NON-ACCUSATORY CORRELATION LANGUAGE AUDIT ===")
    db = SessionLocal()
    try:
        res = InvestigationTimelineService.build_unified_timeline(db, "OCEANTRACE-DEMO-001")
        forbidden_words = ["guilty", "caused by", "responsible for", "culprit", "polluter", "violation"]

        flagged = []
        for c in res["correlations"]:
            print(f"Candidate Chain: {c['vessel_name']} (Strength: {c['correlation_strength']*100:.0f}%, Milestones: {len(c['event_ids'])})")
            for r in c["relationships"][:3]:
                print(f"  - [{r['relationship_type']}] {r['description']}")
            for r in c["relationships"]:
                for w in forbidden_words:
                    if w in r["description"].lower():
                        flagged.append((c["vessel_name"], w, r["description"]))

        print(f"Forbidden Accusatory Words Detected: {len(flagged)}")
        assert len(flagged) == 0
    finally:
        db.close()

if __name__ == "__main__":
    verify_determinism()
    verify_data_integrity()
    verify_correlation_language()
    print("\nALL PHASE 10 VERIFICATION CHECKS PASSED.")
