"""Schema smoke test for the Abracadabra draft pathway.

The draft must keep the Chiropractors_contextual.json graph: same node ids,
types, and edge ids/source/target. Content may change. SuperPatch language
must not remain.
"""

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "Chiropractors_contextual.json"
DRAFT = HERE / "Abracadabra_SMB_Outbound.json"

BANNED = re.compile(
    r"super\s*patch|jennifer|salonpas|chiropract|vibrotactile|"
    r"freedom patch|rem patch|peace patch|liberty patch|"
    r"\$200|practitioner|wholesale|affiliate",
    re.IGNORECASE,
)


def _load(path: Path) -> dict:
    return json.loads(path.read_text())


def test_draft_parses_and_matches_source_graph():
    assert DRAFT.exists(), "draft pathway JSON is missing"
    source = _load(SOURCE)
    draft = _load(DRAFT)

    assert list(draft.keys()) == ["name", "description", "nodes", "edges"]
    assert len(draft["nodes"]) == len(source["nodes"]) == 41
    assert len(draft["edges"]) == len(source["edges"]) == 410

    for src_node, draft_node in zip(source["nodes"], draft["nodes"]):
        assert draft_node["id"] == src_node["id"]
        assert draft_node["type"] == src_node["type"]
        src_data = src_node["data"]
        draft_data = draft_node["data"]
        for key in ("name", "prompt"):
            assert key in draft_data and draft_data[key]
        if "isStart" in src_data:
            assert draft_data.get("isStart") is True
        if "extractVars" in src_data:
            assert len(draft_data["extractVars"]) == len(src_data["extractVars"])
            for slot in draft_data["extractVars"]:
                assert len(slot) == 3
                assert slot[1] == "string"
        if "tool" in src_data:
            assert isinstance(draft_data.get("tool"), str)
            assert draft_data["tool"].startswith("TODO_CHRISTOPHER_")
        if "staticVars" in src_data:
            assert isinstance(draft_data.get("staticVars"), dict)

    src_edges = {(e["id"], e["source"], e["target"]) for e in source["edges"]}
    draft_edges = {(e["id"], e["source"], e["target"]) for e in draft["edges"]}
    assert src_edges == draft_edges
    assert all(set(e.keys()) == {"id", "data", "source", "target"} for e in draft["edges"])
    assert all(set(e["data"].keys()) == {"label"} and e["data"]["label"] for e in draft["edges"])


def test_no_superpatch_language_and_placeholders_present():
    raw = DRAFT.read_text()
    assert BANNED.search(raw) is None, BANNED.search(raw).group(0)
    for token in (
        "TODO_CHRISTOPHER_BLAND_VOICE_ID",
        "TODO_CHRISTOPHER_ABRACADABRA_KB_ID",
        "TODO_CHRISTOPHER_CAL_EVENT_SLUG",
        "TODO_CHRISTOPHER_TRANSFER_PHONE",
        "TODO_CHRISTOPHER_PRICING",
        "houdini@abra-ca-dabra.app",
        "Christopher Buzny",
        "Ada",
    ):
        assert token in raw
    assert "https://check.abra-ca-dabra.app/" in raw
    assert "TODO_CHRISTOPHER_HOUDINI_CAL_EVENT_SLUG" not in raw
    assert "TODO_CHRISTOPHER_HOUDINI_TRANSFER_PHONE" not in raw
    assert "Renew Implants" not in raw
    assert "TODO_CHRISTOPHER_RENEW_IMPLANTS" not in raw
    assert "TODO_CHRISTOPHER_STRONGFOAM_CRM" not in raw
    locked = next(n for n in _load(DRAFT)["nodes"] if n["id"] == "30")
    assert locked["data"]["name"] == "End Call: Session Locked with Christopher"
    assert "Christopher Buzny" in locked["data"]["prompt"]
    assert "meet Houdini" not in locked["data"]["prompt"]


# Bland request_data names the pathway may reference. Internal scores and notes are excluded.
ALLOWED_VARIABLES = {
    "appointment_time",
    "best_phone",
    "business_address",
    "business_city",
    "business_languages",
    "business_name",
    "business_region",
    "company_summary",
    "contact_email",
    "contact_name",
    "contact_title",
    "decision_makers",
    "fit_reasons",
    "google_rating",
    "industry",
    "location_note",
    "owner_name",
    "pain_points",
    "readiness_summary",
    "review_count",
    "schema_public_finding",
    "schema_report_pdf_url",
    "schema_report_url",
    "schema_score",
    "schema_score_reasons",
    "signals",
    "survey_url",
    "talking_points",
    "team_count",
    "tech_stack",
    "to",
    "website",
}

# Spoken only as schema_score. These must never be template variables.
FORBIDDEN_VARIABLES = {
    "bdr_fit_score",
    "lead_score",
    "notes",
    "nurture",
    "routing_status",
    "sources",
}

# Minimum nodes that must reference each variable. Extra nodes are allowed
# when the shared prompt names the meeting owner.
REQUIRED_NODES = {
    "business_name": {"1", "2", "41"},
    "contact_name": {"1", "40"},
    "contact_title": {"1", "38", "40"},
    "contact_email": {"27", "28"},
    "best_phone": {"27", "28"},
    "website": {"1", "2"},
    "industry": {"2"},
    "business_city": {"1"},
    "location_note": {"1"},
    "company_summary": {"2"},
    "pain_points": {"5"},
    "tech_stack": {"6", "15"},
    "talking_points": {"8", "9", "10", "11", "12"},
    "decision_makers": {"38", "40"},
    "fit_reasons": {"1", "2"},
    "signals": {"5"},
    "schema_public_finding": {"8", "13"},
    "schema_score": {"2", "8", "13", "26"},
    "schema_score_reasons": {"2", "8", "13", "26", "37"},
    "schema_report_url": {"13", "26", "37"},
    "schema_report_pdf_url": {"2", "8", "13", "26", "37"},
    "survey_url": {"26"},
    "readiness_summary": {"26"},
    "owner_name": {"1", "24", "30", "32"},
}

VAR_RE = re.compile(
    r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}"
    r"|\{\%\s*(?:if|elif)\s+(?:not\s+)?([A-Za-z_][A-Za-z0-9_]*)"
)


def _variables_in(text: str) -> set[str]:
    found = set()
    for match in VAR_RE.finditer(text):
        found.add(match.group(1) or match.group(2))
    return found


def test_request_data_variables_are_documented():
    draft = _load(DRAFT)
    by_id = {node["id"]: node["data"]["prompt"] for node in draft["nodes"]}
    used = set()
    nodes_for: dict[str, set[str]] = {}
    for node_id, prompt in by_id.items():
        found = _variables_in(prompt)
        used |= found
        for name in found:
            nodes_for.setdefault(name, set()).add(node_id)

    assert used <= ALLOWED_VARIABLES, sorted(used - ALLOWED_VARIABLES)
    assert used.isdisjoint(FORBIDDEN_VARIABLES)
    for name, required in REQUIRED_NODES.items():
        assert required <= nodes_for.get(name, set()), (name, sorted(required - nodes_for.get(name, set())))

    sample_path = HERE / "sample_request_data.json"
    sample = json.loads(sample_path.read_text())
    assert set(sample) <= ALLOWED_VARIABLES
    assert FORBIDDEN_VARIABLES.isdisjoint(sample)
    assert sample["schema_score"]
    assert isinstance(sample["schema_score_reasons"], list)
    assert 1 <= len(sample["schema_score_reasons"]) <= 5
    assert "schema_report_pdf_url" in sample
    assert "Northwind" in sample["business_name"]
    assert "example" in sample["website"]
