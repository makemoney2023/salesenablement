"""Smoke tests for the booking-goal + $200 sample-incentive pathway change.

Guards two things:
1. Non-destructive: every pathway keeps its exact node/edge count (no node or
   edge may be dropped by the transform). Counts are pinned to the values that
   were confirmed in sync with live production.
2. Additive incentive wiring is present: the PRIMARY GOAL sentinel is injected
   into the routing nodes, the Schedule Appointment node force-sets
   wants_sample + a $200 sample_notes tag, and the Offer Sample / Check
   Availability nodes mention the $200 offer.

Run: python -m pytest test_booking_incentive.py  (from this folder)
"""
import json
from pathlib import Path

import pytest

HERE = Path(__file__).parent
CANON = json.loads((HERE / "canonical_ids.json").read_text())

# Sentinel header injected by add_booking_incentive.py. Must match exactly.
SENTINEL = "## PRIMARY GOAL \u2014 BOOK A DEMO"

# Node/edge counts confirmed equal to live production during pre-flight sync.
# The transform must NOT change these (pure prompt + staticVars edits only).
EXPECTED_COUNTS = {
    "Chiropractors_contextual.json": (41, 410),
    "Massage_Therapists_contextual.json": (40, 383),
    "Naturopaths_contextual.json": (41, 440),
    "Integrative_Medicine_contextual.json": (40, 382),
    "Functional_Medicine_contextual.json": (41, 411),
    "Acupuncturists_contextual.json": (41, 415),
}

PATHWAY_FILES = [e["contextual_file"] for e in CANON["pathways"].values()]


def load(fname):
    return json.loads((HERE / fname).read_text())


def node_by_name(nodes, name):
    for n in nodes:
        if (n.get("data") or {}).get("name") == name:
            return n
    return None


def prompt_of(node):
    return ((node or {}).get("data") or {}).get("prompt", "") or ""


@pytest.mark.parametrize("fname", PATHWAY_FILES)
def test_contextual_file_loads(fname):
    d = load(fname)
    assert d.get("nodes"), f"{fname} has no nodes"
    assert d.get("edges"), f"{fname} has no edges"


@pytest.mark.parametrize("fname", PATHWAY_FILES)
def test_node_edge_count_unchanged(fname):
    d = load(fname)
    exp_nodes, exp_edges = EXPECTED_COUNTS[fname]
    assert len(d["nodes"]) == exp_nodes, f"{fname} node count drifted (destructive change?)"
    assert len(d["edges"]) == exp_edges, f"{fname} edge count drifted (destructive change?)"


@pytest.mark.parametrize("fname", PATHWAY_FILES)
def test_primary_goal_injected(fname):
    d = load(fname)
    hits = [n for n in d["nodes"] if SENTINEL in prompt_of(n)]
    # Each pathway has 27-29 routing nodes; require broad coverage.
    assert len(hits) >= 20, f"{fname} PRIMARY GOAL sentinel only in {len(hits)} nodes"


@pytest.mark.parametrize("fname", PATHWAY_FILES)
def test_schedule_appointment_autofulfills_samples(fname):
    d = load(fname)
    appt = node_by_name(d["nodes"], "Schedule Appointment")
    assert appt is not None, f"{fname} missing Schedule Appointment node"
    sv = (appt.get("data") or {}).get("staticVars") or {}
    assert str(sv.get("wants_sample")).lower() == "true", f"{fname} booking does not set wants_sample"
    assert "$200" in (sv.get("sample_notes") or ""), f"{fname} booking missing $200 sample_notes tag"
    # Existing demo flags preserved (non-destructive).
    assert str(sv.get("wants_demo")).lower() == "true"


@pytest.mark.parametrize("fname", PATHWAY_FILES)
def test_offer_sample_and_check_availability_mention_200(fname):
    d = load(fname)
    offer = node_by_name(d["nodes"], "Offer Sample")
    avail = node_by_name(d["nodes"], "Check Availability")
    assert "$200" in prompt_of(offer), f"{fname} Offer Sample missing $200 upsell"
    assert "$200" in prompt_of(avail), f"{fname} Check Availability missing $200 reward lead"
