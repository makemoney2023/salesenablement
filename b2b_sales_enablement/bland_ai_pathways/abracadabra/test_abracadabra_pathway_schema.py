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
