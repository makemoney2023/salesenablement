#!/usr/bin/env python3
"""Additive transform: make booking a demo the primary goal across all pathways
and offer $200 in free samples for booking (auto-fulfilled by the booking node).

NON-DESTRUCTIVE by design:
- Only mutates existing node `data.prompt` strings and the Schedule Appointment
  node `data.staticVars`. Never adds, removes, or reorders nodes/edges.
- Writes a timestamped backup of every file before editing.
- Idempotent: re-running makes no further changes (guards on unique sentinels).

Usage:
    cd b2b_sales_enablement/bland_ai_pathways
    python3 add_booking_incentive.py            # apply
    python3 add_booking_incentive.py --check     # report only, no writes
"""
import json
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).parent
BACKUP_DIR = HERE / "backups"
CANON = json.loads((HERE / "canonical_ids.json").read_text())

ROUTING_MARKER = "## ROUTING PRIORITY - READ THIS FIRST"
SENTINEL = "## PRIMARY GOAL \u2014 BOOK A DEMO"

PRIMARY_GOAL_BLOCK = (
    SENTINEL + "\n"
    "Your #1 objective on every call is to book a short 20-30 minute product "
    "demo with the practitioner. Booking the demo comes first; samples, orders, "
    "affiliate sign-up, and callbacks are fallbacks.\n\n"
    "**THE INCENTIVE - USE IT OFTEN:** When they book a demo, we ship them $200 "
    "worth of free SuperPatch samples to try before the visit - no cost, no "
    "obligation. Lead with this to create urgency and to melt hesitation "
    "(\"I'm not sure\" / \"I'm busy\" / \"just email me\"): offer to lock in a "
    "quick demo so you can send their $200 sample kit. Never remove or downplay "
    "the existing free single-sample option for anyone who declines a demo.\n\n"
)

OFFER_SAMPLE_UPSELL = (
    "\n\n## EVEN BETTER - OFFER THE $200 DEMO KIT FIRST\n"
    "Before sending a single free sample, offer the upgrade: \"Actually - if we "
    "set up a quick 20-minute demo, I'll send you a full $200 sample kit to try "
    "before we meet, instead of just one patch. Want me to grab a time?\" If they "
    "agree, route to \"Check Availability\". If they only want the single free "
    "sample, continue here as normal - this fallback stays fully intact."
)
OFFER_SAMPLE_MARK = "## EVEN BETTER - OFFER THE $200 DEMO KIT FIRST"

CHECK_AVAIL_REWARD = (
    "\n\n## REWARD REMINDER - $200 IN FREE SAMPLES\n"
    "As you lock in the visit, reinforce the incentive: \"And because you're "
    "booking the demo, I'll send you $200 worth of free samples to try before we "
    "meet.\" Use it to keep them committed through all four required fields."
)
CHECK_AVAIL_MARK = "## REWARD REMINDER - $200 IN FREE SAMPLES"

SCHEDULE_CONFIRM = (
    "\n\n## CONFIRM THE $200 SAMPLE REWARD\n"
    "After confirming the appointment details, tell them: \"And because you "
    "booked the demo, I'm sending you $200 worth of free SuperPatch samples to "
    "try before we meet - they'll arrive in a few days.\" This $200 sample kit is "
    "fulfilled automatically when the booking is saved."
)
SCHEDULE_CONFIRM_MARK = "## CONFIRM THE $200 SAMPLE REWARD"

SAMPLE_NOTES_VALUE = "$200 demo-booking incentive - ship $200 sample kit"


def get_prompt(node):
    return (node.get("data") or {}).get("prompt", "") or ""


def set_prompt(node, value):
    node.setdefault("data", {})["prompt"] = value


def node_named(nodes, name):
    for n in nodes:
        if (n.get("data") or {}).get("name") == name:
            return n
    return None


def transform_file(path, check_only):
    data = json.loads(path.read_text())
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    before_nodes, before_edges = len(nodes), len(edges)
    changes = []

    # 1. Inject PRIMARY GOAL block before the routing marker (all routing nodes).
    goal_count = 0
    for n in nodes:
        p = get_prompt(n)
        if ROUTING_MARKER in p and SENTINEL not in p:
            set_prompt(n, p.replace(ROUTING_MARKER, PRIMARY_GOAL_BLOCK + ROUTING_MARKER, 1))
            goal_count += 1
    if goal_count:
        changes.append(f"primary-goal injected into {goal_count} nodes")

    # 2. Offer Sample upsell bridge.
    offer = node_named(nodes, "Offer Sample")
    if offer is not None and OFFER_SAMPLE_MARK not in get_prompt(offer):
        set_prompt(offer, get_prompt(offer) + OFFER_SAMPLE_UPSELL)
        changes.append("Offer Sample upsell added")

    # 3. Check Availability reward lead.
    avail = node_named(nodes, "Check Availability")
    if avail is not None and CHECK_AVAIL_MARK not in get_prompt(avail):
        set_prompt(avail, get_prompt(avail) + CHECK_AVAIL_REWARD)
        changes.append("Check Availability reward lead added")

    # 4. Schedule Appointment: staticVars auto-fulfil + confirmation line.
    appt = node_named(nodes, "Schedule Appointment")
    if appt is not None:
        sv = (appt.setdefault("data", {}).setdefault("staticVars", {}))
        if str(sv.get("wants_sample")).lower() != "true":
            sv["wants_sample"] = "true"
            changes.append("Schedule Appointment wants_sample=true")
        if "$200" not in (sv.get("sample_notes") or ""):
            sv["sample_notes"] = SAMPLE_NOTES_VALUE
            changes.append("Schedule Appointment sample_notes tagged")
        if SCHEDULE_CONFIRM_MARK not in get_prompt(appt):
            set_prompt(appt, get_prompt(appt) + SCHEDULE_CONFIRM)
            changes.append("Schedule Appointment $200 confirmation added")

    # Safety: never change node/edge counts.
    assert len(nodes) == before_nodes, "node count changed - aborting"
    assert len(edges) == before_edges, "edge count changed - aborting"

    if not changes:
        print(f"  {path.name}: already up to date (no changes)")
        return False

    if check_only:
        print(f"  {path.name}: WOULD apply -> {'; '.join(changes)}")
        return True

    BACKUP_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = BACKUP_DIR / f"{path.stem}_booking_incentive_backup_{ts}.json"
    backup.write_text(path.read_text())
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"  {path.name}: {'; '.join(changes)}  (backup: {backup.name})")
    return True


def main():
    check_only = "--check" in sys.argv
    print("Booking-incentive transform" + (" (check only)" if check_only else ""))
    any_changed = False
    for entry in CANON["pathways"].values():
        path = HERE / entry["contextual_file"]
        any_changed |= transform_file(path, check_only)
    print("Done." if any_changed else "No changes needed.")


if __name__ == "__main__":
    main()
