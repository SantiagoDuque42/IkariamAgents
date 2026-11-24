"""Validate operational contracts and budgets locally. Never talks to the game."""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timedelta
import json
import math
from pathlib import Path
import sys

BASE = Path(__file__).resolve().parents[1]


def read_json(path):
    def invalid(value):
        raise ValueError("non_finite_json: " + value)
    return json.loads(Path(path).read_text(encoding="utf-8"), parse_constant=invalid)


def date(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError("timezone_required")
    return result


def validate_document(document):
    try:
        from jsonschema import Draft202012Validator, FormatChecker
    except ImportError as exc:
        raise ValueError("missing_dependency: jsonschema is required for schema validation") from exc
    schema = read_json(BASE / "references/contratos.schema.json")
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(document), key=lambda error: str(list(error.path)))
    if errors:
        raise ValueError("invalid_contract: " + "; ".join(error.message for error in errors))
    # JSON Schema implementations may accept NaN/Infinity in Python objects.
    def finite(value):
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("non_finite_number")
        if isinstance(value, dict):
            for child in value.values():
                finite(child)
        if isinstance(value, list):
            for child in value:
                finite(child)
    finite(document)
    if document["kind"] in {"debugger_state", "learning_case"}:
        if document["producer"] != document["data"]["module_id"]:
            raise ValueError("upgrader_owner_mismatch")
    if document["kind"] == "observation_batch":
        sources = document["data"]["sources"]
        ids = [source["id"] for source in sources]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate_source_id")
        if any(field["source_id"] not in ids for field in document["data"]["fields"]):
            raise ValueError("unknown_source_id")
    return document


def validate_registry(registry):
    modules = registry["modules"] + registry.get("domain_modules", [])
    by_id = {module["id"]: module for module in modules}
    if len(by_id) != len(modules):
        raise ValueError("duplicate_module_id")
    ordered, visiting, visited = [], set(), set()
    plugin_root = BASE.parents[1]

    def visit(module_id):
        if module_id not in by_id:
            raise ValueError("unknown_dependency: " + module_id)
        if module_id in visiting:
            raise ValueError("cyclic_dependency: " + module_id)
        if module_id in visited:
            return
        visiting.add(module_id)
        module = by_id[module_id]
        required = {"id", "version", "contract_version", "status", "implementation",
                    "skill_path", "stage", "depends_on", "inputs", "outputs", "effects", "tools"}
        if required - module.keys():
            raise ValueError("incomplete_module: " + module_id)
        if module["contract_version"] != registry["schema_version"]:
            raise ValueError("contract_version_mismatch: " + module_id)
        path = (plugin_root / module["skill_path"]).resolve()
        if not path.is_relative_to(plugin_root.resolve()) or not path.is_file():
            raise ValueError("missing_module_source: " + module_id)
        if not module["inputs"] or not module["outputs"]:
            raise ValueError("empty_module_contract: " + module_id)
        upgraders = module.get("upgraders", {})
        for name in ("debugger", "learner"):
            config = upgraders.get(name)
            if not config or not config.get("enabled"):
                raise ValueError("missing_upgrader: " + module_id + ":" + name)
            if config.get("scope") != ["account_id", "world", "module_id"]:
                raise ValueError("invalid_upgrader_scope: " + module_id)
            expected = "ops-" + name + "-" + module_id + "-v1"
            if config.get("state_entry_id") != expected:
                raise ValueError("shared_upgrader_state: " + module_id)
        for dependency in module["depends_on"]:
            visit(dependency)
        visiting.remove(module_id)
        visited.add(module_id)
        ordered.append(module_id)

    for module_id in by_id:
        visit(module_id)
    adapter_ids = [adapter["id"] for adapter in registry["adapters"]]
    if len(adapter_ids) != len(set(adapter_ids)):
        raise ValueError("duplicate_adapter_id")
    for domain, module_id in registry.get("domain_routing", {}).items():
        if module_id not in by_id:
            raise ValueError("unknown_domain_owner: " + domain)
    return ordered


def check_plan(snapshot, decision, now, max_age_minutes=None):
    """Check a selected decision against one immutable observation snapshot.

    This is feasibility validation, not a growth optimizer, reservation transaction
    or executor. Re-read revisions and persist reservations with compare-and-swap
    before emitting any action.
    """
    validate_document(snapshot)
    validate_document(decision)
    if snapshot["kind"] != "snapshot" or decision["kind"] != "decision":
        raise ValueError("wrong_contract_kind")
    now = date(now) if isinstance(now, str) else now
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("timezone_required")
    errors = []
    s, d = snapshot["data"], decision["data"]
    for key in ("account_id", "world", "schema_version"):
        if snapshot[key] != decision[key]:
            errors.append("identity_mismatch: " + key)
    if d["snapshot_id"] != snapshot["id"]:
        errors.append("snapshot_mismatch")
    if d["basis_revisions"] != s["revisions"]:
        errors.append("revision_conflict")
    if d["status"] != "selected":
        errors.append("decision_not_selected")
    if date(d["expires_at"]) <= now:
        errors.append("decision_expired")
    if date(d["expires_at"]) <= date(decision["created_at"]):
        errors.append("invalid_expiry")
    for doc in (snapshot, decision):
        if date(doc["created_at"]) > now + timedelta(minutes=5):
            errors.append("future_document: " + doc["id"])
    if date(decision["created_at"]) < date(snapshot["created_at"]):
        errors.append("decision_predates_snapshot")
    limit = s["max_age_minutes"]
    if max_age_minutes is not None:
        if not math.isfinite(max_age_minutes) or max_age_minutes <= 0:
            raise ValueError("invalid_freshness_limit")
        limit = min(limit, max_age_minutes)
    claims = defaultdict(float)
    action_ids, keys = set(), set()
    confirmed = set(s["confirmed_action_ids"])
    issued = set(s["issued_idempotency_keys"])
    routing = read_json(BASE / "references/modulos.json").get("domain_routing", {})
    for action in d["actions"]:
        aid, key = action["id"], action["idempotency_key"]
        owner = action.get("module_id")
        if owner and routing.get(action["domain"]) != owner:
            errors.append("wrong_domain_owner: " + aid)
        if owner in {"operativo-mayor", "operativo-worldlord"} and any(action["claims"].values()):
            errors.append("collector_cannot_commit: " + aid)
        if aid in action_ids:
            errors.append("duplicate_action_id: " + aid)
        if key in keys:
            errors.append("duplicate_idempotency_key: " + key)
        if aid in confirmed or key in issued:
            errors.append("reconciliation_required: " + aid)
        if not action["costs_known"]:
            errors.append("unknown_cost: " + aid)
        for dependency in action["depends_on"]:
            if dependency not in action_ids and dependency not in confirmed:
                errors.append("dependency_not_ready: " + aid + ":" + dependency)
        action_ids.add(aid)
        keys.add(key)
        for resource, amount in action["claims"].items():
            if amount > 0:
                claims[resource] += amount
    # Arrival, boat return and construction completion cannot increase this
    # snapshot's budgets. Those require a later confirmed observation.
    for resource, total in claims.items():
        budget = s["budgets"].get(resource)
        if budget is None:
            errors.append("unknown_budget: " + resource)
            continue
        observed = date(budget["observed_at"])
        age = (now - observed).total_seconds() / 60
        if age < -5:
            errors.append("future_observation: " + resource)
        if age > limit:
            errors.append("stale_budget: " + resource)
        available = budget["observed_quantity"] - budget["reserved_quantity"] - budget["floor_quantity"]
        if total > available + 1e-9:
            errors.append("budget_conflict: " + resource)
    return {"valid": not errors, "errors": errors,
            "claims": dict(claims), "game_action_executed": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("registry")
    sub.add_parser("example")
    validate = sub.add_parser("validate")
    validate.add_argument("document")
    plan = sub.add_parser("plan")
    plan.add_argument("snapshot")
    plan.add_argument("decision")
    plan.add_argument("--now", required=True, help="ISO datetime including timezone")
    plan.add_argument("--max-age-minutes", type=float)
    args = parser.parse_args()
    try:
        if args.command == "registry":
            result = {"valid": True, "module_order": validate_registry(read_json(BASE / "references/modulos.json"))}
        elif args.command == "validate":
            doc = validate_document(read_json(args.document))
            result = {"valid": True, "kind": doc["kind"], "id": doc["id"]}
        elif args.command == "example":
            example = read_json(BASE / "references/ejemplo-ciclo.json")
            docs = [validate_document(doc) for doc in example["documents"]]
            snapshot = next(doc for doc in docs if doc["kind"] == "snapshot")
            decision = next(doc for doc in docs if doc["kind"] == "decision")
            result = check_plan(snapshot, decision, example["now"])
            result["documents_validated"] = len(docs)
        else:
            result = check_plan(read_json(args.snapshot), read_json(args.decision),
                                args.now, args.max_age_minutes)
    except (ValueError, KeyError, OSError) as exc:
        result = {"valid": False, "errors": [str(exc)], "game_action_executed": False}
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
