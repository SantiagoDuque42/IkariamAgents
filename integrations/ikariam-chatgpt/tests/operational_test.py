"""Behavior checks for local operational contracts; no network or account writes."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "plugin-src/skills/operativo-orquestador"
spec = importlib.util.spec_from_file_location("operational_kernel", BASE / "scripts/operational_kernel.py")
kernel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kernel)


class OperationalTests(unittest.TestCase):
    def setUp(self):
        self.example = json.loads((BASE / "references/ejemplo-ciclo.json").read_text())
        self.docs = self.example["documents"]
        self.snapshot = next(d for d in self.docs if d["kind"] == "snapshot")
        self.decision = next(d for d in self.docs if d["kind"] == "decision")

    def check(self):
        return kernel.check_plan(self.snapshot, self.decision, self.example["now"])

    def assertError(self, prefix):
        self.assertTrue(any(error.startswith(prefix) for error in self.check()["errors"]))

    def test_schema_and_example(self):
        for document in self.docs:
            kernel.validate_document(document)
        self.assertTrue(self.check()["valid"])

    def test_module_registry_is_acyclic_and_sources_exist(self):
        registry = kernel.read_json(BASE / "references/modulos.json")
        order = kernel.validate_registry(registry)
        self.assertEqual(len(order), 14)
        self.assertLess(order.index("operativo-estado"), order.index("operativo-arbitraje"))
        registry["modules"][0]["depends_on"] = ["operativo-seguimiento"]
        with self.assertRaisesRegex(ValueError, "cyclic_dependency"):
            kernel.validate_registry(registry)

    def test_aggregate_spend_respects_reservations_and_floor(self):
        proposal = next(d for d in self.docs if d["kind"] == "proposal")
        self.decision["data"]["actions"].append(proposal["data"]["alternatives"][1])
        self.assertError("budget_conflict: city:demo-city:wood")

    def test_cross_account_and_world_are_rejected(self):
        self.decision["account_id"] = "another-account"
        self.decision["world"] = "another-world"
        self.assertError("identity_mismatch: account_id")
        self.assertError("identity_mismatch: world")

    def test_revision_change_invalidates_decision(self):
        self.snapshot["data"]["revisions"]["city:demo-city"] += 1
        self.assertError("revision_conflict")

    def test_missing_budget_cannot_be_filled_with_arrival(self):
        del self.snapshot["data"]["budgets"]["city:demo-city:wood"]
        self.snapshot["data"]["entities"]["in_transit"] = {"wood": 10000}
        self.assertError("unknown_budget: city:demo-city:wood")

    def test_stale_data_blocks_claims(self):
        self.snapshot["data"]["budgets"]["city:demo-city:wood"]["observed_at"] = "2026-11-24T08:00:00+01:00"
        self.assertError("stale_budget")

    def test_expired_decision_and_stricter_execution_freshness(self):
        self.decision["data"]["expires_at"] = "2026-11-24T17:59:00+01:00"
        self.assertError("decision_expired")
        self.decision["data"]["expires_at"] = "2026-11-24T18:30:00+01:00"
        self.snapshot["data"]["budgets"]["city:demo-city:wood"]["observed_at"] = "2026-11-24T17:00:00+01:00"
        self.assertTrue(self.check()["valid"])
        result = kernel.check_plan(self.snapshot, self.decision, self.example["now"], 30)
        self.assertFalse(result["valid"])

    def test_duplicate_and_already_issued_actions(self):
        action = self.decision["data"]["actions"][0]
        self.decision["data"]["actions"].append(copy.deepcopy(action))
        self.assertError("duplicate_action_id")
        self.snapshot["data"]["issued_idempotency_keys"] = [action["idempotency_key"]]
        self.assertError("reconciliation_required")

    def test_dependency_must_be_earlier_or_confirmed(self):
        self.decision["data"]["actions"][0]["depends_on"] = ["arrival-unconfirmed"]
        self.assertError("dependency_not_ready")
        self.snapshot["data"]["confirmed_action_ids"] = ["arrival-unconfirmed"]
        self.assertTrue(self.check()["valid"])

    def test_unknown_cost_is_never_executable(self):
        self.decision["data"]["actions"][0]["costs_known"] = False
        self.assertError("unknown_cost")

    def test_confirmation_needs_evidence(self):
        receipt = next(d for d in self.docs if d["kind"] == "receipt")
        receipt["data"]["status"] = "confirmed"
        with self.assertRaisesRegex(ValueError, "invalid_contract"):
            kernel.validate_document(receipt)
        receipt["data"]["evidence_refs"] = ["user-confirmation-001"]
        kernel.validate_document(receipt)

    def test_finite_numbers_and_timezones(self):
        self.snapshot["data"]["budgets"]["city:demo-city:wood"]["observed_quantity"] = float("nan")
        with self.assertRaisesRegex(ValueError, "non_finite"):
            self.check()
        with self.assertRaisesRegex(ValueError, "timezone_required"):
            kernel.date("2026-11-24T18:00:00")

    def test_observation_source_must_exist(self):
        batch = next(d for d in self.docs if d["kind"] == "observation_batch")
        batch["data"]["fields"][0]["source_id"] = "unknown-source"
        with self.assertRaisesRegex(ValueError, "unknown_source_id"):
            kernel.validate_document(batch)


if __name__ == "__main__":
    unittest.main()
