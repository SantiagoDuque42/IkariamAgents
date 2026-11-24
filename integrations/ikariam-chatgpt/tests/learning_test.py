"""Evidence gates and account isolation; no network, writes or invented game facts."""
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "plugin-src/skills/learning-engine"
spec = importlib.util.spec_from_file_location("learning_kernel", BASE / "scripts/learning_kernel.py")
kernel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kernel)
NOW = "2026-11-24T19:00:00Z"
SCOPE = {"account_id":"demo-account", "world":"demo-world", "game_version":"14.0.0", "environment":"live"}


def evidence(ident="source-a", kind="official_release", **extra):
    return {"id":ident, "origin":"origin-" + ident, "locator":"synthetic fixture; no real source",
            "source_type":kind, "scope":deepcopy(SCOPE), "observed_at":NOW,
            **({"effective_at":NOW} if kind == "official_release" else {}),
            "access":"read", "stance":"supports", "summary":"Fictitious validation evidence.",
            "content_sha256":hashlib.sha256(b"fictitious").hexdigest(), **extra}


def claim(**extra):
    args = dict(module_id="operativo-general", scope=deepcopy(SCOPE), topic="fictitious-rule",
                value=42, unit="test-only", kind="mechanic", now=NOW,
                valid_until="2026-11-25T19:00:00Z", evidence=[evidence()])
    args.update(extra)
    return kernel.new_claim(**args)


def holdout(ids=None, **extra):
    return {"case_id":"case-a", "partition":"holdout", "dataset_type":"real_game",
            "passed":True, "evidence_ids":ids or ["source-a"], **extra}


class LearningTests(unittest.TestCase):
    def evaluate(self, value, context=None, now=NOW, deps=()):
        return kernel.evaluate_claim(value, context or SCOPE, now, deps)

    def test_fact_can_activate_without_question_and_is_idempotent(self):
        value = claim()
        self.assertTrue(self.evaluate(value)["eligible"])
        self.assertFalse(self.evaluate(value)["usable"])
        active = kernel.activate_claim(value, SCOPE, NOW)
        self.assertTrue(self.evaluate(active)["usable"])
        self.assertEqual(active, kernel.activate_claim(active, SCOPE, NOW))
        self.assertEqual(value["status"], "candidate")

    def test_scopes_do_not_leak_between_accounts_worlds_versions_or_pts(self):
        for field,value in [("account_id","other"),("world","other"),
                            ("game_version","15.0.0"),("environment","pts")]:
            context = {**SCOPE, field:value}
            result = self.evaluate(claim(), context)
            self.assertFalse(result["eligible"])
            self.assertIn("scope_mismatch", result["reasons"])

    def test_wildcards_require_mechanic_or_procedure_and_exact_version(self):
        shared = {**SCOPE,"account_id":"*","world":"*"}
        value = claim(scope=shared, evidence=[evidence(scope=shared)])
        self.assertTrue(self.evaluate(value)["eligible"])
        for kind in ["parameter","preference","hypothesis"]:
            with self.assertRaisesRegex(ValueError,"private_scope"):
                claim(scope=shared,kind=kind)
        with self.assertRaises(ValueError):
            claim(scope={**SCOPE,"game_version":"*"})

    def test_expired_and_future_evidence_cannot_be_relabelled_current(self):
        value = claim(evidence=[evidence(observed_at="2026-10-01T19:00:00Z")])
        self.assertFalse(self.evaluate(value)["eligible"])
        self.assertIn("expired",self.evaluate(claim(),now="2026-11-26T19:00:00Z")["reasons"])
        value = claim(evidence=[evidence(observed_at="2026-11-25T19:00:00Z")])
        self.assertIn("future_evidence:source-a",self.evaluate(value)["reasons"])
        future=claim(evidence=[evidence(effective_at="2026-11-25T19:00:00Z")])
        self.assertIn("not_effective:source-a",self.evaluate(future)["reasons"])

    def test_inaccessible_and_indexed_sources_never_validate_mechanics(self):
        for access in ["unavailable","indexed_only"]:
            item=evidence(access=access);item.pop("content_sha256")
            self.assertFalse(self.evaluate(claim(evidence=[item]))["eligible"])

    def test_official_help_alone_and_mirrored_sources_are_insufficient(self):
        self.assertFalse(self.evaluate(claim(evidence=[evidence(kind="official_help")]))["eligible"])
        items=[evidence(kind="wiki"),evidence("source-b",kind="battle_report",origin="origin-source-a")]
        value=claim(evidence=items,tests=[holdout(["source-a","source-b"])])
        self.assertFalse(self.evaluate(value)["eligible"])
        items[1]["origin"]="independent"
        self.assertTrue(self.evaluate(claim(evidence=items,tests=[holdout(["source-a","source-b"])]))["eligible"])

    def test_synthetic_holdout_cannot_certify_a_game_mechanic(self):
        value=claim(requires_tests=True,tests=[holdout(dataset_type="synthetic")])
        self.assertIn("holdout_required",self.evaluate(value)["reasons"])
        self.assertTrue(self.evaluate(claim(kind="procedure",evidence=[evidence(kind="synthetic_test")],
                    tests=[holdout(dataset_type="synthetic")]))["eligible"])

    def test_contradiction_and_any_failed_test_block_activation(self):
        items=[evidence(),evidence("source-b",stance="contradicts")]
        self.assertIn("conflicting_evidence",self.evaluate(claim(evidence=items))["reasons"])
        self.assertIn("failed_validation",self.evaluate(claim(tests=[holdout(passed=False)]))["reasons"])
        with self.assertRaisesRegex(ValueError,"learning_gate"):
            kernel.activate_claim(claim(evidence=items),SCOPE,NOW)

    def test_preference_parameter_and_hypothesis_have_different_requirements(self):
        self.assertFalse(self.evaluate(claim(kind="preference"))["eligible"])
        self.assertTrue(self.evaluate(claim(kind="preference",evidence=[evidence(kind="user_confirmation")]))["eligible"])
        self.assertFalse(self.evaluate(claim(kind="parameter"))["eligible"])
        self.assertTrue(self.evaluate(claim(kind="parameter",evidence=[evidence(kind="game_observation")]))["eligible"])
        self.assertFalse(self.evaluate(claim(kind="hypothesis"))["eligible"])

    def test_dependency_invalidation_and_retirement_keep_history(self):
        dep="learn-"+"1"*40
        value=claim(dependencies=[dep])
        self.assertFalse(self.evaluate(value)["eligible"])
        active=kernel.activate_claim(value,SCOPE,NOW,[dep])
        self.assertTrue(self.evaluate(active,deps=[dep])["usable"])
        self.assertFalse(self.evaluate(active)["usable"])
        retired=kernel.retire_claim(active,now=NOW,reason="New patch",replacement_id="learn-"+"2"*40)
        self.assertEqual(len(retired["history"]),2)
        self.assertFalse(self.evaluate(retired,deps=[dep])["eligible"])

    def test_identity_limits_and_non_finite_numbers(self):
        value=claim();value["value"]=43
        with self.assertRaisesRegex(ValueError,"identity_mismatch"):kernel.validate_claim(value)
        with self.assertRaises(ValueError):claim(value=float('nan'))
        with self.assertRaisesRegex(ValueError,"too_large"):claim(value="x"*17000)
        value=claim();value["evidence"].append(deepcopy(value["evidence"][0]))
        with self.assertRaisesRegex(ValueError,"duplicate_evidence"):kernel.validate_claim(value)

    def test_research_budget_is_deterministic_and_keeps_deferred_work(self):
        items=[dict(module_id="operativo-general",topic="a",impact=10,uncertainty=1,frequency=2,cost=2),
               dict(module_id="operativo-shipper",topic="b",impact=3,uncertainty=1,frequency=1,cost=1)]
        result=kernel.research_queue(items,1)
        self.assertEqual(result["selected"][0]["topic"],"a")
        self.assertEqual(len(result["deferred"]),1)
        self.assertNotIn("score",items[0])
        with self.assertRaises(ValueError):kernel.research_queue([{**items[0],"cost":0}])

    def test_every_existing_module_has_a_learning_profile(self):
        profiles=kernel.read_json(BASE/'references/profiles.json')["modules"]
        skills={p.parent.name for p in BASE.parent.glob('*/SKILL.md')}-{'learning-engine'}
        self.assertEqual(skills,set(profiles))
        for skill in skills:
            self.assertIn('../learning-engine/SKILL.md',(BASE.parent/skill/'SKILL.md').read_text())

    def test_observed_residual_requires_the_same_time_unit_and_scope(self):
        prediction=dict(kind="prediction",module_id="operativo-shipper",scope=SCOPE,target_id="demo-trip",metric="arrival",unit="minutes",for_time=NOW,value=20)
        observation={**prediction,"kind":"observation","value":25}
        result=kernel.compare_observation(prediction,observation)
        self.assertEqual(result["error"],-5)
        self.assertEqual(result["absolute_error"],5)
        for field in ["scope","target_id","unit","for_time"]:
            with self.assertRaisesRegex(ValueError,"measurement_mismatch"):
                kernel.compare_observation(prediction,{**observation,field:"other"})
        with self.assertRaisesRegex(ValueError,"real_observation"):
            kernel.compare_observation(prediction,prediction)


if __name__ == '__main__':unittest.main()
