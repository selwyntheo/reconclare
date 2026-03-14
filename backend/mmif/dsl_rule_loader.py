"""
DSL Rule Loader for MMIF Validation Rules.

Merges database-backed DSL rules with legacy hardcoded rules.
DSL rules with matching ruleId override legacy definitions.
"""
from typing import Any, Optional

from db.mongodb import get_async_db, COLLECTIONS
from mmif.validation_rules import MMIF_VALIDATION_RULES, get_rule_definition
from services.mapping.cel_evaluator import CelEvaluator


_evaluator = CelEvaluator()


class DslRuleLoader:
    """Loads and merges DSL rules from MongoDB with legacy rules."""

    def __init__(self, db=None):
        self.db = db or get_async_db()

    async def load_all_rules(self) -> list[dict]:
        """Load all rules: DB DSL rules override legacy rules by ruleId."""
        # Fetch active DSL rules from DB
        cursor = self.db[COLLECTIONS["mmifValidationRuleDefs"]].find(
            {"isActive": True, "deletedAt": None},
            {"_id": 0},
        )
        dsl_rules = await cursor.to_list(200)

        # Build lookup of DSL rules by ruleId
        dsl_by_id = {r["ruleId"]: r for r in dsl_rules}

        # Merge: DSL overrides legacy
        merged = []
        seen_ids = set()
        for legacy in MMIF_VALIDATION_RULES:
            rule_id = legacy["ruleId"]
            if rule_id in dsl_by_id:
                merged.append(dsl_by_id[rule_id])
            else:
                merged.append(legacy)
            seen_ids.add(rule_id)

        # Add any DSL rules with new ruleIds not in legacy
        for rule_id, dsl_rule in dsl_by_id.items():
            if rule_id not in seen_ids:
                merged.append(dsl_rule)

        # Sort by ruleId
        merged.sort(key=lambda r: r["ruleId"])
        return merged

    async def load_rule(self, rule_id: str) -> dict:
        """Load a single rule: DB first, then legacy fallback."""
        dsl_rule = await self.db[COLLECTIONS["mmifValidationRuleDefs"]].find_one(
            {"ruleId": rule_id, "isActive": True, "deletedAt": None},
            {"_id": 0},
        )
        if dsl_rule:
            return dsl_rule

        return get_rule_definition(rule_id)

    @staticmethod
    def is_dsl_rule(rule: dict) -> bool:
        """Check if a rule is a DSL rule with CEL expressions."""
        return rule.get("isDsl", False) and "lhs" in rule and "rhs" in rule

    @staticmethod
    def compile_expression(expr: str) -> Any:
        """Compile a CEL expression. Cached internally by CelEvaluator."""
        _, prog = _evaluator.compile(expr)
        return prog

    @staticmethod
    def validate_expression(expr: str) -> tuple[bool, Optional[str]]:
        """Validate a CEL expression without executing it."""
        return _evaluator.validate_expression(expr)
