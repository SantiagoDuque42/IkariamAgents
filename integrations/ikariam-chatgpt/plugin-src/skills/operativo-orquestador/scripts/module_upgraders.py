"""Per-module Debugger and Learner primitives. No network or external writes."""
from __future__ import annotations
from copy import deepcopy
import hashlib
import json
from operational_kernel import validate_document

DEFAULT_POLICY = {
    "max_steps_without_progress": 20, "same_failure_limit": 2,
    "same_operation_limit": 3, "history_window": 6,
}
TRANSIENT = {
    "timestamp", "created_at", "updated_at", "cycle_id", "request_id",
    "trace_id", "attempt", "retry_count", "idempotency_key", "action_id",
    "receipt_id", "observed_at", "run_id",
}
MATERIAL_KINDS = {"account", "city", "army", "fleet", "research", "trade", "message"}


def fingerprint(value):
    def stable(item):
        if isinstance(item, dict):
            return {key: stable(val) for key, val in sorted(item.items())
                    if key not in TRANSIENT}
        if isinstance(item, list):
            return [stable(val) for val in item]
        return item
    raw = json.dumps(stable(value), sort_keys=True, separators=(",", ":"),
                     ensure_ascii=False, allow_nan=False)
    return hashlib.sha256(raw.encode()).hexdigest()


def progress_key(material_revisions):
    revisions = {key: value for key, value in material_revisions.items()
                 if key.split(":")[0] in MATERIAL_KINDS}
    if any(isinstance(value, bool) or not isinstance(value, int) or value < 0
           for value in revisions.values()):
        raise ValueError("invalid_material_revision")
    return fingerprint(revisions)


def scope_of(doc):
    return (doc["account_id"], doc["world"], doc["data"]["module_id"])


def require_scope(doc, scope):
    if scope_of(doc) != tuple(scope):
        raise ValueError("upgrader_scope_mismatch")


def envelope(kind, ident, module_id, account_id, world, now, data):
    result = {
        "schema_version": "1.0.0", "kind": kind, "id": ident,
        "account_id": account_id, "world": world, "created_at": now,
        "producer": module_id, "data": data,
    }
    return validate_document(result)


def new_debugger(module_id, account_id, world, now):
    return envelope("debugger_state", "debugger-" + module_id, module_id,
                    account_id, world, now, {
        "module_id": module_id, "status": "ready", "progress_key": "none",
        "steps_without_progress": 0, "history": [], "reason": "", "used_learning_case_ids": [],
    })


def debugger_step(state, *, scope, operation, parameters, material_revisions,
                  error_code="none", outcome_unknown=False, resolution_evidence=None,
                  policy=None):
    """Return a new state; callers must persist with the current revision.

    Material revision changes must already have been verified by the state
    normalizer. A new request ID or an updater journal revision is not progress.
    """
    validate_document(state)
    if state["kind"] != "debugger_state":
        raise ValueError("wrong_upgrader_kind")
    require_scope(state, scope)
    limits = dict(DEFAULT_POLICY)
    if policy:
        limits.update({key: val for key, val in policy.items() if key in limits})
    if any(isinstance(value, bool) or not isinstance(value, int) or value < 1
           for value in limits.values()) or not 3 <= limits["history_window"] <= 64:
        raise ValueError("invalid_debugger_policy")
    result = deepcopy(state)
    data = result["data"]
    if data["status"] == "reconciliation_required" and not resolution_evidence:
        return result
    progress = progress_key(material_revisions)
    if data["status"] == "paused" and progress == data["progress_key"]:
        return result
    if resolution_evidence and data["status"] == "reconciliation_required":
        data["status"], data["reason"] = "ready", ""
    if progress != data["progress_key"]:
        data.update(progress_key=progress, steps_without_progress=0,
                    history=[], status="ready", reason="")
    op = fingerprint({"operation": operation, "parameters": parameters})
    history = data["history"]
    prior = list(history)
    history.append({"operation_key": op, "progress_key": progress, "error_code": error_code})
    data["steps_without_progress"] += 1
    repeats = sum(event["operation_key"] == op for event in history)
    failures = sum(event["operation_key"] == op and event["error_code"] == error_code
                   for event in history) if error_code != "none" else 0
    reason = ""
    if outcome_unknown:
        reason = "outcome_unknown"
        data["status"] = "reconciliation_required"
    elif len(prior) >= 2 and prior[-2]["operation_key"] == op and prior[-1]["operation_key"] != op:
        reason = "oscillation"
    elif failures >= limits["same_failure_limit"]:
        reason = "repeated_error"
    elif repeats >= limits["same_operation_limit"]:
        reason = "no_progress"
    elif data["steps_without_progress"] >= limits["max_steps_without_progress"]:
        reason = "step_limit"
    if reason:
        data["reason"] = reason
        if data["status"] != "reconciliation_required":
            data["status"] = "paused"
    data["history"] = history[-limits["history_window"]:]
    return validate_document(result)


def new_learning_case(module_id, account_id, world, *, incident, error_code,
                      question, proposed_rule, rule_kind, now):
    key = fingerprint({"module_id": module_id, "account_id": account_id,
                       "world": world, "incident": incident, "error_code": error_code})
    return envelope("learning_case", "learning-" + key[:24], module_id,
                    account_id, world, now, {
        "module_id": module_id, "incident_key": key, "error_code": error_code,
        "question": question, "proposed_rule": proposed_rule, "rule_kind": rule_kind,
        "status": "pending_user", "asked": False, "user_answer": "", "evidence_refs": [],
    })


def resume_after_learning(state, case, *, scope):
    """Allow one resumption for a user-answered and applied corrective rule."""
    validate_document(state)
    validate_document(case)
    require_scope(state, scope)
    require_scope(case, scope)
    if state["kind"] != "debugger_state" or case["kind"] != "learning_case":
        raise ValueError("wrong_upgrader_kind")
    if state["data"]["status"] == "reconciliation_required":
        raise ValueError("reconciliation_required")
    if state["data"]["status"] != "paused" or case["data"]["status"] != "applied":
        raise ValueError("applied_correction_required")
    used = state["data"].get("used_learning_case_ids", [])
    if case["id"] in used:
        raise ValueError("learning_case_already_used")
    result = deepcopy(state)
    result["data"].update(status="ready", reason="", history=[], steps_without_progress=0,
                          used_learning_case_ids=used + [case["id"]])
    return validate_document(result)


def should_ask(case, *, scope, existing_cases):
    validate_document(case)
    if case["kind"] != "learning_case":
        raise ValueError("wrong_upgrader_kind")
    require_scope(case, scope)
    if case["data"]["status"] != "pending_user" or case["data"]["asked"]:
        return False
    for existing in existing_cases:
        validate_document(existing)
        if existing["kind"] != "learning_case":
            raise ValueError("wrong_upgrader_kind")
        if (scope_of(existing) == tuple(scope)
                and existing["data"]["incident_key"] == case["data"]["incident_key"]
                and (existing["data"]["asked"] or existing["data"]["status"] != "pending_user")):
            return False
    return True


def mark_asked(case, *, scope):
    """Call only after the agent has actually presented the question."""
    require_scope(case, scope)
    result = deepcopy(case)
    if result["data"]["status"] != "pending_user":
        raise ValueError("learning_case_not_pending")
    result["data"]["asked"] = True
    return validate_document(result)


def answer_learning(case, *, scope, answer, accepted, corrected_rule=None):
    validate_document(case)
    require_scope(case, scope)
    if case["kind"] != "learning_case" or case["data"]["status"] != "pending_user":
        raise ValueError("learning_case_not_pending")
    if not isinstance(answer, str) or not answer.strip():
        raise ValueError("user_answer_required")
    if not isinstance(accepted, bool):
        raise ValueError("explicit_learning_decision_required")
    if corrected_rule is not None and (not isinstance(corrected_rule, str) or not corrected_rule.strip()):
        raise ValueError("invalid_corrected_rule")
    result = deepcopy(case)
    result["data"]["user_answer"] = answer
    if accepted and corrected_rule is not None:
        result["data"]["proposed_rule"] = corrected_rule.strip()
    result["data"]["status"] = "answered" if accepted else "rejected"
    return validate_document(result)


def apply_learning(case, *, scope, verification_refs=None):
    validate_document(case)
    require_scope(case, scope)
    if case["kind"] != "learning_case" or case["data"]["status"] != "answered":
        raise ValueError("user_answer_required")
    refs = list(dict.fromkeys(verification_refs or []))
    if case["data"]["rule_kind"] == "mechanic" and not refs:
        raise ValueError("mechanic_verification_required")
    result = deepcopy(case)
    result["data"]["status"] = "applied"
    result["data"]["evidence_refs"] = refs
    return validate_document(result)
