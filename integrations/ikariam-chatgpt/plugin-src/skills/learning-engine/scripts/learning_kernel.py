"""Scoped, evidence-gated learning. Pure functions; CLI only reads explicit files."""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path
import sys

BASE = Path(__file__).resolve().parents[1]
SCOPE_KEYS = ("account_id", "world", "game_version", "environment")


def read_json(path):
    def invalid(value):
        raise ValueError("non_finite_json: " + value)
    return json.loads(Path(path).read_text(encoding="utf-8"), parse_constant=invalid)


def date(value):
    value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timezone_required")
    return value


def digest(value):
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"),
                     ensure_ascii=False, allow_nan=False)
    return hashlib.sha256(raw.encode()).hexdigest()


def validate_claim(claim):
    from jsonschema import Draft202012Validator, FormatChecker
    schema = read_json(BASE / "references/learning.schema.json")
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(claim), key=lambda e: str(list(e.path)))
    if errors:
        raise ValueError("invalid_learning_claim: " + "; ".join(e.message for e in errors))
    # Strict JSON encoding rejects NaN/Infinity even if a validator accepts them.
    raw = json.dumps(claim, allow_nan=False, ensure_ascii=False)
    if len(raw) > 16000:
        raise ValueError("entry_content_too_large")
    profiles = read_json(BASE / "references/profiles.json")["modules"]
    if claim["module_id"] not in profiles:
        raise ValueError("unknown_learning_module")
    expected_id = "learn-" + digest({"module": claim["module_id"], "scope": claim["scope"],
                                   "topic": claim["topic"], "value": claim["value"],
                                   "unit": claim["unit"], "kind": claim["kind"]})[:40]
    if claim["id"] != expected_id:
        raise ValueError("claim_identity_mismatch")
    scope = claim["scope"]
    if not scope["game_version"].strip() or scope["game_version"] == "*":
        raise ValueError("exact_game_version_required")
    if claim["kind"] in {"parameter", "preference", "hypothesis"} and any(
            scope[k] == "*" for k in ("account_id", "world")):
        raise ValueError("private_scope_required")
    ids = [e["id"] for e in claim["evidence"]]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate_evidence_id")
    if any(i not in ids for t in claim["tests"] for i in t["evidence_ids"]):
        raise ValueError("unknown_test_evidence")
    cases = [t["case_id"] for t in claim["tests"]]
    if len(cases) != len(set(cases)):
        raise ValueError("duplicate_test_case")
    if claim["id"] in claim["dependencies"]:
        raise ValueError("self_dependency")
    if date(claim["valid_until"]) <= date(claim["created_at"]):
        raise ValueError("invalid_validity_window")
    return claim


def new_claim(*, module_id, scope, topic, value, unit, kind, now, valid_until,
              evidence=None, tests=None, dependencies=None, requires_tests=False,
              max_evidence_age_hours=720):
    ident = "learn-" + digest({"module": module_id, "scope": scope, "topic": topic,
                                "value": value, "unit": unit, "kind": kind})[:40]
    return validate_claim({
        "schema_version": "1.0.0", "id": ident, "module_id": module_id,
        "scope": deepcopy(scope), "topic": topic, "kind": kind,
        "value": deepcopy(value), "unit": unit, "status": "candidate",
        "created_at": now, "valid_until": valid_until,
        "max_evidence_age_hours": max_evidence_age_hours,
        "evidence": deepcopy(evidence or []), "tests": deepcopy(tests or []),
        "dependencies": list(dependencies or []), "requires_tests": requires_tests,
        "history": [],
    })


def scope_matches(scope, context):
    return all(scope[k] == context[k] or (k in ("account_id", "world")
               and scope[k] == "*") for k in SCOPE_KEYS)


def evaluate_claim(claim, context, now, active_dependencies=()):
    validate_claim(claim)
    if set(context) != set(SCOPE_KEYS) or any(not isinstance(context[k], str) or
            not context[k].strip() or context[k] == "*" for k in SCOPE_KEYS):
        raise ValueError("concrete_context_required")
    if context["environment"] not in {"live", "pts"}:
        raise ValueError("invalid_environment")
    instant = date(now)
    reasons = []
    if not scope_matches(claim["scope"], context):
        reasons.append("scope_mismatch")
    if date(claim["created_at"]) > instant:
        reasons.append("future_claim")
    if date(claim["valid_until"]) <= instant:
        reasons.append("expired")
    if claim["status"] in {"superseded", "rejected"}:
        reasons.append("retired")
    missing = sorted(set(claim["dependencies"]) - set(active_dependencies))
    if missing:
        reasons.append("inactive_dependencies")
    usable = []
    for item in claim["evidence"]:
        if item["access"] != "read" or not scope_matches(item["scope"], context):
            continue
        if date(item["observed_at"]) > instant:
            reasons.append("future_evidence:" + item["id"])
            continue
        if item.get("effective_at") and date(item["effective_at"]) > instant:
            reasons.append("not_effective:" + item["id"])
            continue
        # Old observations cannot be relabelled current by extending the claim TTL.
        if (instant - date(item["observed_at"])).total_seconds() > claim["max_evidence_age_hours"] * 3600:
            continue
        usable.append(item)
    if any(e["stance"] == "contradicts" for e in usable):
        reasons.append("conflicting_evidence")
    support = [e for e in usable if e["stance"] == "supports"]
    support_ids = {e["id"] for e in support}
    tests = [t for t in claim["tests"] if set(t["evidence_ids"]) <= support_ids]
    holdout = any(t["partition"] == "holdout" and t["passed"] and
                  (claim["kind"] != "mechanic" or t["dataset_type"] == "real_game")
                  for t in tests)
    if any(not t["passed"] for t in claim["tests"]):
        reasons.append("failed_validation")
    if claim["requires_tests"] and not holdout:
        reasons.append("holdout_required")
    kind = claim["kind"]
    if kind == "hypothesis":
        reasons.append("hypothesis_only")
    elif kind == "preference":
        if not any(e["source_type"] == "user_confirmation" and e["scope"] == context for e in support):
            reasons.append("user_confirmation_required")
    elif kind == "parameter":
        if not any(e["source_type"] in {"game_observation", "battle_report"}
                   and e["scope"] == context for e in support):
            reasons.append("account_observation_required")
    elif kind == "procedure":
        if not holdout:
            reasons.append("holdout_required")
    elif kind == "mechanic":
        primary = any(e["source_type"] in {"official_release", "game_observation"}
                      for e in support)
        independent = {e["origin"] for e in support if e["source_type"] in
                       {"wiki", "battle_report", "official_help"}}
        if not primary and not (len(independent) >= 2 and holdout):
            reasons.append("insufficient_mechanics_evidence")
    return {"eligible": not reasons, "reasons": sorted(set(reasons)),
            "usable_evidence_ids": sorted(support_ids), "missing_dependencies": missing,
            "usable": claim["status"] == "active" and not reasons}


def activate_claim(claim, context, now, active_dependencies=()):
    result = evaluate_claim(claim, context, now, active_dependencies)
    if not result["eligible"]:
        raise ValueError("learning_gate: " + ",".join(result["reasons"]))
    updated = deepcopy(claim)
    if updated["status"] == "active":
        return updated
    updated["history"].append({"at": now, "from": updated["status"], "to": "active",
                                "reason": "evidence_gate_passed"})
    updated["status"] = "active"
    return validate_claim(updated)


def retire_claim(claim, *, now, reason, replacement_id=None):
    validate_claim(claim)
    if not reason.strip():
        raise ValueError("retirement_reason_required")
    if date(now) < date(claim["created_at"]):
        raise ValueError("invalid_retirement_date")
    result = deepcopy(claim)
    status = "superseded" if replacement_id else "rejected"
    result["history"].append({"at": now, "from": claim["status"], "to": status,
                              "reason": reason})
    result["status"] = status
    if replacement_id:
        result["replacement_id"] = replacement_id
    return validate_claim(result)


def research_queue(items, limit=3):
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 20:
        raise ValueError("invalid_queue_limit")
    seen, ranked = set(), []
    for item in items:
        key = (item["module_id"], item["topic"])
        if key in seen:
            raise ValueError("duplicate_research_topic")
        seen.add(key)
        vals = [item[k] for k in ("impact", "uncertainty", "frequency", "cost")]
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or
               not math.isfinite(v) or v < 0 for v in vals) or vals[3] <= 0:
            raise ValueError("invalid_research_priority")
        score = vals[0] * vals[1] * vals[2] / vals[3]
        if not math.isfinite(score):
            raise ValueError("invalid_research_priority")
        ranked.append({**deepcopy(item), "score": score})
    ranked.sort(key=lambda x: (-x["score"], x["module_id"], x["topic"]))
    return {"selected": ranked[:limit], "deferred": ranked[limit:]}


def compare_observation(prediction, observation):
    """Residual for any module, requiring the same target instant and units."""
    for field in ("module_id", "scope", "target_id", "metric", "unit", "for_time"):
        if prediction[field] != observation[field]:
            raise ValueError("measurement_mismatch:" + field)
    if prediction["kind"] != "prediction" or observation["kind"] != "observation":
        raise ValueError("real_observation_required")
    date(prediction["for_time"])
    values = (prediction["value"], observation["value"])
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or
           not math.isfinite(v) for v in values):
        raise ValueError("invalid_measurement")
    error = values[0] - values[1]
    if not math.isfinite(error):
        raise ValueError("invalid_measurement")
    return {"module_id": prediction["module_id"], "scope": deepcopy(prediction["scope"]),
            "target_id": prediction["target_id"],
            "metric": prediction["metric"], "unit": prediction["unit"],
            "for_time": prediction["for_time"], "error": error,
            "absolute_error": abs(error),
            "relative_error": error / abs(values[1]) if values[1] else None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for command in ("validate", "evaluate", "queue"):
        child = sub.add_parser(command)
        child.add_argument("path")
        if command == "evaluate":
            child.add_argument("--context", required=True)
            child.add_argument("--now", required=True)
            child.add_argument("--active-dependency", action="append", default=[])
        if command == "queue":
            child.add_argument("--limit", type=int, default=3)
    args = parser.parse_args()
    data = read_json(args.path)
    if args.command == "validate":
        validate_claim(data)
        result = {"valid": True, "id": data["id"]}
    elif args.command == "evaluate":
        result = evaluate_claim(data, read_json(args.context), args.now, args.active_dependency)
    else:
        result = research_queue(data, args.limit)
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)
