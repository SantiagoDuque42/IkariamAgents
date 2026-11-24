from copy import deepcopy
import importlib.util
from pathlib import Path
import sys
import unittest

SCRIPTS = Path(__file__).resolve().parents[1] / "plugin-src/skills/operativo-orquestador/scripts"
sys.path.insert(0, str(SCRIPTS))
import module_upgraders as u
from operational_kernel import check_plan, read_json, validate_document, validate_registry

NOW = "2026-11-24T18:00:00+01:00"
SCOPE = ("demo-account", "demo-world", "operativo-spy")


class ModuleUpgraderTests(unittest.TestCase):
    def state(self):
        return u.new_debugger(SCOPE[2], SCOPE[0], SCOPE[1], NOW)

    def step(self, state, operation="read_spies", parameters=None, revisions=None, **extra):
        return u.debugger_step(
            state, scope=SCOPE, operation=operation, parameters=parameters or {"city_id": "demo"},
            material_revisions=revisions or {"city:demo": 1}, **extra)

    def case(self, module="operativo-spy", kind="preference", incident=None):
        return u.new_learning_case(
            module, SCOPE[0], SCOPE[1], incident=incident or {"operation": "spy", "city_id": "demo"},
            error_code="target_ambiguous", question="¿Qué ciudad quieres priorizar?",
            proposed_rule="Usar la ciudad indicada por el usuario.", rule_kind=kind, now=NOW)

    def test_named_areas_and_independent_upgraders(self):
        registry = read_json(SCRIPTS.parent / "references/modulos.json")
        names = {m["display_name"] for m in registry["domain_modules"]}
        self.assertEqual(names, {"SPY", "DIPLOMAT", "GENERAL", "INVESTIGATOR", "SHIPPER", "WORLDLORD", "MAYOR"})
        self.assertEqual(registry["controller"]["name"], "ORQUESTRADOR")
        self.assertEqual(len(validate_registry(registry)), 14)
        all_modules = registry["modules"] + registry["domain_modules"]
        state_ids = [m["upgraders"]["debugger"]["state_entry_id"] for m in all_modules]
        self.assertEqual(len(state_ids), len(set(state_ids)))
        registry["domain_modules"][0]["upgraders"]["debugger"]["state_entry_id"] = state_ids[0]
        with self.assertRaisesRegex(ValueError, "shared_upgrader_state"):
            validate_registry(registry)

    def test_same_operation_stops_without_progress(self):
        state = self.state()
        for _ in range(3):
            state = self.step(state)
        self.assertEqual(state["data"]["status"], "paused")
        self.assertEqual(state["data"]["reason"], "no_progress")

    def test_ids_and_journal_revisions_do_not_hide_a_loop(self):
        state = self.state()
        for i in range(3):
            state = self.step(state, parameters={"city_id": "demo", "request_id": str(i),
                                                "action_id": str(i), "created_at": str(i)},
                              revisions={"city:demo": 1, "note:debugger": i, "report:run": i})
        self.assertEqual(state["data"]["reason"], "no_progress")

    def test_target_identity_is_semantic(self):
        self.assertNotEqual(u.fingerprint({"target": {"id": "city-a"}}),
                            u.fingerprint({"target": {"id": "city-b"}}))

    def test_repeated_error_and_oscillation(self):
        state = self.step(self.state(), error_code="source_unavailable")
        state = self.step(state, error_code="source_unavailable")
        self.assertEqual(state["data"]["reason"], "repeated_error")
        state = self.step(self.state(), operation="send_a")
        state = self.step(state, operation="send_b")
        state = self.step(state, operation="send_a")
        self.assertEqual(state["data"]["reason"], "oscillation")

    def test_new_observation_restores_progress(self):
        state = self.state()
        for _ in range(3):
            state = self.step(state)
        state = self.step(state, revisions={"city:demo": 2})
        self.assertEqual(state["data"]["status"], "ready")
        self.assertEqual(state["data"]["steps_without_progress"], 1)

    def test_unknown_outcome_requires_reconciliation(self):
        state = self.step(self.state(), outcome_unknown=True)
        self.assertEqual(state["data"]["status"], "reconciliation_required")
        unchanged = self.step(state, revisions={"city:demo": 2})
        self.assertEqual(unchanged, state)
        resumed = self.step(state, revisions={"city:demo": 2},
                            resolution_evidence=["confirmed-not-dispatched"])
        self.assertEqual(resumed["data"]["status"], "ready")

    def test_scopes_are_isolated_and_input_is_not_mutated(self):
        state = self.state()
        before = deepcopy(state)
        self.step(state)
        self.assertEqual(state, before)
        for scope in [("other-account", SCOPE[1], SCOPE[2]),
                      (SCOPE[0], "other-world", SCOPE[2]),
                      (SCOPE[0], SCOPE[1], "operativo-general")]:
            with self.assertRaisesRegex(ValueError, "scope_mismatch"):
                u.debugger_step(state, scope=scope, operation="read", parameters={},
                                material_revisions={})
        state["producer"] = "operativo-general"
        with self.assertRaisesRegex(ValueError, "owner_mismatch"):
            validate_document(state)

    def test_learning_questions_are_deduplicated(self):
        case = self.case()
        same = self.case(incident={"operation": "spy", "city_id": "demo",
                                  "cycle_id": "new", "request_id": "new"})
        self.assertEqual(case["id"], same["id"])
        self.assertTrue(u.should_ask(case, scope=SCOPE, existing_cases=[deepcopy(case)]))
        asked = u.mark_asked(case, scope=SCOPE)
        self.assertFalse(u.should_ask(same, scope=SCOPE, existing_cases=[asked]))
        other = self.case(module="operativo-general")
        self.assertTrue(u.should_ask(other, scope=(*SCOPE[:2], "operativo-general"),
                                     existing_cases=[asked]))

    def test_learning_needs_real_answer(self):
        case = self.case()
        with self.assertRaisesRegex(ValueError, "user_answer_required"):
            u.apply_learning(case, scope=SCOPE)
        with self.assertRaisesRegex(ValueError, "user_answer_required"):
            u.answer_learning(case, scope=SCOPE, answer="", accepted=True)
        answered = u.answer_learning(case, scope=SCOPE, answer="Prioriza la ciudad A.", accepted=True)
        self.assertEqual(answered["data"]["status"], "answered")
        applied = u.apply_learning(answered, scope=SCOPE)
        self.assertEqual(applied["data"]["status"], "applied")
        rejected = u.answer_learning(case, scope=SCOPE, answer="No uses esa regla.", accepted=False)
        self.assertEqual(rejected["data"]["status"], "rejected")

    def test_game_mechanic_needs_verification_after_answer(self):
        case = self.case(kind="mechanic")
        answered = u.answer_learning(case, scope=SCOPE, answer="Comprueba esa regla.", accepted=True)
        with self.assertRaisesRegex(ValueError, "mechanic_verification_required"):
            u.apply_learning(answered, scope=SCOPE)
        applied = u.apply_learning(answered, scope=SCOPE, verification_refs=["verified-rule-source"])
        self.assertEqual(applied["data"]["status"], "applied")

    def test_user_correction_replaces_proposal_without_losing_literal_answer(self):
        case = self.case()
        answered = u.answer_learning(case, scope=SCOPE, answer="Mejor prioriza la ciudad B.",
                                     accepted=True, corrected_rule="Priorizar ciudad B.")
        self.assertEqual(answered["data"]["proposed_rule"], "Priorizar ciudad B.")
        self.assertEqual(answered["data"]["user_answer"], "Mejor prioriza la ciudad B.")
        self.assertNotEqual(case["data"]["proposed_rule"], answered["data"]["proposed_rule"])

    def test_applied_learning_resumes_once_and_cannot_bypass_reconciliation(self):
        state = self.state()
        for _ in range(3):
            state = self.step(state)
        self.assertEqual(state["data"]["status"], "paused")
        case = self.case()
        with self.assertRaisesRegex(ValueError, "applied_correction_required"):
            u.resume_after_learning(state, case, scope=SCOPE)
        answered = u.answer_learning(case, scope=SCOPE, answer="Usa la ciudad A.", accepted=True)
        applied = u.apply_learning(answered, scope=SCOPE)
        resumed = u.resume_after_learning(state, applied, scope=SCOPE)
        self.assertEqual(resumed["data"]["status"], "ready")
        for _ in range(3):
            resumed = self.step(resumed)
        with self.assertRaisesRegex(ValueError, "already_used"):
            u.resume_after_learning(resumed, applied, scope=SCOPE)
        uncertain = self.step(self.state(), outcome_unknown=True)
        changed = self.step(uncertain, revisions={"city:demo": 2})
        self.assertEqual(changed["data"]["status"], "reconciliation_required")
        with self.assertRaisesRegex(ValueError, "reconciliation_required"):
            u.resume_after_learning(uncertain, applied, scope=SCOPE)

    def test_journal_and_plan_revisions_are_not_progress(self):
        state = self.state()
        for revision in range(3):
            state = self.step(state, revisions={"city:demo": 1, "note:debugger": revision,
                                               "plan:proposal": revision})
        self.assertEqual(state["data"]["status"], "paused")
        resumed = self.step(state, revisions={"city:demo": 2})
        self.assertEqual(resumed["data"]["status"], "ready")

    def test_oscillation_detected(self):
        state = self.step(self.state(), operation="read_a")
        state = self.step(state, operation="read_b")
        state = self.step(state, operation="read_a")
        self.assertEqual(state["data"]["reason"], "oscillation")

    def test_step_limit_and_bounded_history(self):
        state = self.state()
        for i in range(8):
            state = self.step(state, operation="read_" + str(i), policy={"max_steps_without_progress": 8})
        self.assertEqual(state["data"]["reason"], "step_limit")
        self.assertLessEqual(len(state["data"]["history"]), 6)

    def test_action_owner_and_collector_role(self):
        example = read_json(SCRIPTS.parent / "references/ejemplo-ciclo.json")
        snapshot = next(d for d in example["documents"] if d["kind"] == "snapshot")
        decision = next(d for d in example["documents"] if d["kind"] == "decision")
        decision["data"]["actions"][0]["module_id"] = "operativo-general"
        result = check_plan(snapshot, decision, example["now"])
        self.assertTrue(any(e.startswith("wrong_domain_owner") for e in result["errors"]))
        action = decision["data"]["actions"][0]
        action.update(module_id="operativo-mayor", domain="city")
        result = check_plan(snapshot, decision, example["now"])
        self.assertTrue(any(e.startswith("collector_cannot_commit") for e in result["errors"]))


if __name__ == "__main__":
    unittest.main()
