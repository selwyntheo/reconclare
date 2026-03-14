"""
Tests for MMIF DSL Rule System.

Covers:
- Accounting CEL functions (sumByPrefix, sumByPrefixExcl, etc.)
- DslRuleLoader (merge, fallback, override)
- DSL rule evaluation producing same results as legacy
- Expression validation
"""
import sys
sys.path.insert(0, "/Volumes/D/Projects/ReconClareAI/backend")

import pytest
from celpy import celtypes
from services.mapping.cel_evaluator import (
    CelEvaluator,
    python_to_cel,
    cel_to_python,
    cel_sumByPrefix,
    cel_sumByPrefixExcl,
    cel_countByPrefix,
    cel_filterByPrefix,
    cel_sumWhere,
    cel_fieldValue,
    cel_sumField,
    CUSTOM_FUNCTIONS,
    FUNCTION_DOCS,
)
from mmif.validation_rules import evaluate_rule, MMIF_VALIDATION_RULES
from mmif.dsl_rule_loader import DslRuleLoader
from db.schemas import MmifSeverity, ValidationResultStatus


# =============================================================================
# Sample Ledger Data for Testing
# =============================================================================

SAMPLE_LEDGER = [
    {"glAccountNumber": "1100", "glDescription": "Cash", "startingBalance": 500000.0, "endingBalance": 600000.0},
    {"glAccountNumber": "1200", "glDescription": "Equities", "startingBalance": 2000000.0, "endingBalance": 2500000.0},
    {"glAccountNumber": "1300", "glDescription": "Fixed Income", "startingBalance": 1500000.0, "endingBalance": 1800000.0},
    {"glAccountNumber": "1400", "glDescription": "Derivatives", "startingBalance": 100000.0, "endingBalance": 100000.0},
    {"glAccountNumber": "2100", "glDescription": "Payables", "startingBalance": 200000.0, "endingBalance": 250000.0},
    {"glAccountNumber": "2200", "glDescription": "Accrued Expenses", "startingBalance": 50000.0, "endingBalance": 50000.0},
    {"glAccountNumber": "3100", "glDescription": "Share Capital", "startingBalance": 3000000.0, "endingBalance": 3000000.0},
    {"glAccountNumber": "3200", "glDescription": "Retained Earnings", "startingBalance": 500000.0, "endingBalance": 500000.0},
    {"glAccountNumber": "4100", "glDescription": "Dividend Income", "startingBalance": 0.0, "endingBalance": 800000.0},
    {"glAccountNumber": "4200", "glDescription": "Interest Income", "startingBalance": 0.0, "endingBalance": 200000.0},
    {"glAccountNumber": "5100", "glDescription": "Management Fees", "startingBalance": 0.0, "endingBalance": 100000.0},
    {"glAccountNumber": "5200", "glDescription": "Admin Expenses", "startingBalance": 0.0, "endingBalance": 100000.0},
    {"glAccountNumber": "6100", "glDescription": "Realized Gains", "startingBalance": 0.0, "endingBalance": 200000.0},
    {"glAccountNumber": "6110", "glDescription": "Realized Losses", "startingBalance": 0.0, "endingBalance": -50000.0},
    {"glAccountNumber": "6200", "glDescription": "Unrealized Gains", "startingBalance": 0.0, "endingBalance": 350000.0},
    {"glAccountNumber": "6300", "glDescription": "Unrealized Losses", "startingBalance": 0.0, "endingBalance": -50000.0},
]

# Pre-computed values from SAMPLE_LEDGER
ASSETS = 600000.0 + 2500000.0 + 1800000.0 + 100000.0  # 5,000,000
LIABILITIES = 250000.0 + 50000.0  # 300,000
CAPITAL = 3000000.0 + 500000.0  # 3,500,000
INCOME = 800000.0 + 200000.0  # 1,000,000
EXPENSE = 100000.0 + 100000.0  # 200,000
RGL = 200000.0 + (-50000.0)  # 150,000 (6100 + 6110)
URGL = 350000.0 + (-50000.0)  # 300,000 (6200 + 6300)
NET_INCOME = INCOME - EXPENSE  # 800,000
NET_GL = RGL + URGL  # 450,000
TOTAL_PNL = NET_INCOME + NET_GL  # 1,250,000
BS_DIFF = ASSETS - LIABILITIES - CAPITAL  # 1,200,000


# =============================================================================
# Accounting CEL Functions — Direct Python Tests
# =============================================================================

class TestAccountingFunctionsDirect:
    """Test accounting functions using raw Python list[dict] input."""

    def test_sumByPrefix_assets(self):
        result = cel_sumByPrefix(SAMPLE_LEDGER, "1", "endingBalance")
        assert float(result) == ASSETS

    def test_sumByPrefix_liabilities(self):
        result = cel_sumByPrefix(SAMPLE_LEDGER, "2", "endingBalance")
        assert float(result) == LIABILITIES

    def test_sumByPrefix_capital(self):
        result = cel_sumByPrefix(SAMPLE_LEDGER, "3", "endingBalance")
        assert float(result) == CAPITAL

    def test_sumByPrefix_income(self):
        result = cel_sumByPrefix(SAMPLE_LEDGER, "4", "endingBalance")
        assert float(result) == INCOME

    def test_sumByPrefix_expense(self):
        result = cel_sumByPrefix(SAMPLE_LEDGER, "5", "endingBalance")
        assert float(result) == EXPENSE

    def test_sumByPrefix_all_6xxx(self):
        result = cel_sumByPrefix(SAMPLE_LEDGER, "6", "endingBalance")
        assert float(result) == RGL + URGL

    def test_sumByPrefix_rgl(self):
        result = cel_sumByPrefix(SAMPLE_LEDGER, "61", "endingBalance")
        assert float(result) == RGL

    def test_sumByPrefixExcl_urgl(self):
        """6xxx excluding 61xx = URGL accounts only."""
        result = cel_sumByPrefixExcl(SAMPLE_LEDGER, "6", "61", "endingBalance")
        assert float(result) == URGL

    def test_countByPrefix_assets(self):
        result = cel_countByPrefix(SAMPLE_LEDGER, "1")
        assert int(result) == 4

    def test_countByPrefix_income(self):
        result = cel_countByPrefix(SAMPLE_LEDGER, "4")
        assert int(result) == 2

    def test_countByPrefix_no_match(self):
        result = cel_countByPrefix(SAMPLE_LEDGER, "9")
        assert int(result) == 0

    def test_filterByPrefix_returns_correct_rows(self):
        result = cel_filterByPrefix(SAMPLE_LEDGER, "2")
        assert len(result) == 2

    def test_sumWhere(self):
        result = cel_sumWhere(
            SAMPLE_LEDGER, "endingBalance", "glDescription", "Cash"
        )
        assert float(result) == 600000.0

    def test_sumByPrefix_starting_balance(self):
        result = cel_sumByPrefix(SAMPLE_LEDGER, "1", "startingBalance")
        assert float(result) == 500000.0 + 2000000.0 + 1500000.0 + 100000.0

    def test_sumByPrefix_empty_rows(self):
        result = cel_sumByPrefix([], "1", "endingBalance")
        assert float(result) == 0.0


# =============================================================================
# Accounting CEL Functions — CEL Evaluation Tests
# =============================================================================

class TestAccountingFunctionsCel:
    """Test accounting functions via CEL expression compilation and evaluation."""

    def setup_method(self):
        self.evaluator = CelEvaluator()
        self.cel_ledger = python_to_cel(SAMPLE_LEDGER)

    def _eval_expr(self, expr: str) -> float:
        _, prog = self.evaluator.compile(expr)
        result = prog.evaluate({"ledger": self.cel_ledger})
        return float(cel_to_python(result))

    def test_sumByPrefix_via_cel(self):
        val = self._eval_expr("sumByPrefix(ledger, '1', 'endingBalance')")
        assert val == ASSETS

    def test_sumByPrefixExcl_via_cel(self):
        val = self._eval_expr("sumByPrefixExcl(ledger, '6', '61', 'endingBalance')")
        assert val == URGL

    def test_countByPrefix_via_cel(self):
        _, prog = self.evaluator.compile("countByPrefix(ledger, '1')")
        result = prog.evaluate({"ledger": self.cel_ledger})
        assert int(cel_to_python(result)) == 4

    def test_bs_diff_expression(self):
        """Test the full BS Diff expression from VR-016/020."""
        expr = (
            "sumByPrefix(ledger, '1', 'endingBalance') "
            "- sumByPrefix(ledger, '2', 'endingBalance') "
            "- sumByPrefix(ledger, '3', 'endingBalance')"
        )
        val = self._eval_expr(expr)
        assert val == BS_DIFF

    def test_total_pnl_expression(self):
        """Test the full Total PnL expression from VR-019/020."""
        expr = (
            "(sumByPrefix(ledger, '4', 'endingBalance') "
            "- sumByPrefix(ledger, '5', 'endingBalance')) "
            "+ sumByPrefix(ledger, '6', 'endingBalance')"
        )
        val = self._eval_expr(expr)
        assert val == TOTAL_PNL

    def test_net_gl_expression(self):
        """Test Net GL = RGL(61xx) + URGL(6xxx excl 61xx)."""
        expr = (
            "sumByPrefix(ledger, '61', 'endingBalance') "
            "+ sumByPrefixExcl(ledger, '6', '61', 'endingBalance')"
        )
        val = self._eval_expr(expr)
        assert val == NET_GL

    def test_sumWhere_via_cel(self):
        val = self._eval_expr("sumWhere(ledger, 'endingBalance', 'glDescription', 'Cash')")
        assert val == 600000.0


# =============================================================================
# Function Registry & Docs
# =============================================================================

class TestFunctionRegistryAccounting:
    """Verify accounting functions are in the registry and docs."""

    def test_accounting_functions_registered(self):
        for fn_name in ("sumByPrefix", "sumByPrefixExcl", "countByPrefix",
                        "filterByPrefix", "sumWhere"):
            assert fn_name in CUSTOM_FUNCTIONS, f"{fn_name} missing from CUSTOM_FUNCTIONS"

    def test_accounting_function_docs_present(self):
        doc_names = {d["name"] for d in FUNCTION_DOCS}
        for fn_name in ("sumByPrefix", "sumByPrefixExcl", "countByPrefix",
                        "filterByPrefix", "sumWhere"):
            assert fn_name in doc_names, f"{fn_name} missing from FUNCTION_DOCS"

    def test_accounting_docs_have_category(self):
        for doc in FUNCTION_DOCS:
            if doc["name"] in ("sumByPrefix", "sumByPrefixExcl", "countByPrefix",
                               "filterByPrefix", "sumWhere"):
                assert doc["category"] == "accounting"


# =============================================================================
# DslRuleLoader — Static Methods
# =============================================================================

class TestDslRuleLoaderStatic:
    """Test DslRuleLoader static methods (no DB required)."""

    def test_is_dsl_rule_true(self):
        rule = {"isDsl": True, "lhs": {"expr": "1.0", "label": "A"}, "rhs": {"expr": "1.0", "label": "B"}}
        assert DslRuleLoader.is_dsl_rule(rule) is True

    def test_is_dsl_rule_false_for_legacy(self):
        rule = {"ruleId": "VR_001", "ruleName": "Total Assets", "severity": "HARD"}
        assert DslRuleLoader.is_dsl_rule(rule) is False

    def test_is_dsl_rule_false_missing_lhs(self):
        rule = {"isDsl": True, "rhs": {"expr": "1.0", "label": "B"}}
        assert DslRuleLoader.is_dsl_rule(rule) is False

    def test_compile_expression_success(self):
        prog = DslRuleLoader.compile_expression("1.0 + 2.0")
        assert prog is not None

    def test_compile_expression_failure(self):
        with pytest.raises(Exception):
            DslRuleLoader.compile_expression("1.0 +++ 2.0")

    def test_validate_expression_valid(self):
        is_valid, error = DslRuleLoader.validate_expression("1.0 + 2.0")
        assert is_valid is True
        assert error is None

    def test_validate_expression_invalid(self):
        is_valid, error = DslRuleLoader.validate_expression("1.0 ++ 2.0")
        assert is_valid is False
        assert error is not None


# =============================================================================
# evaluate_rule with rule_override
# =============================================================================

class TestEvaluateRuleOverride:
    """Test evaluate_rule with rule_override parameter."""

    def test_override_uses_provided_rule(self):
        override = {
            "ruleId": "VR_099",
            "ruleName": "Custom Test Rule",
            "severity": MmifSeverity.HARD,
            "tolerance": 0.0,
            "mmifSection": None,
        }
        result = evaluate_rule(
            rule_id="VR_099",
            fund_account="TEST001",
            fund_name="Test Fund",
            lhs_label="LHS",
            lhs_value=100.0,
            rhs_label="RHS",
            rhs_value=100.0,
            rule_override=override,
        )
        assert result.ruleId == "VR_099"
        assert result.ruleName == "Custom Test Rule"
        assert result.status == ValidationResultStatus.PASSED

    def test_override_fail(self):
        override = {
            "ruleId": "VR_099",
            "ruleName": "Custom Test Rule",
            "severity": MmifSeverity.HARD,
            "tolerance": 0.0,
            "mmifSection": None,
        }
        result = evaluate_rule(
            rule_id="VR_099",
            fund_account="TEST001",
            fund_name="Test Fund",
            lhs_label="LHS",
            lhs_value=100.0,
            rhs_label="RHS",
            rhs_value=101.0,
            rule_override=override,
        )
        assert result.status == ValidationResultStatus.FAILED
        assert result.variance == 1.0

    def test_override_soft_warning(self):
        override = {
            "ruleId": "VR_099",
            "ruleName": "Soft Rule",
            "severity": MmifSeverity.SOFT,
            "tolerance": 0.01,
            "mmifSection": None,
        }
        result = evaluate_rule(
            rule_id="VR_099",
            fund_account="TEST001",
            fund_name="Test Fund",
            lhs_label="LHS",
            lhs_value=100.0,
            rhs_label="RHS",
            rhs_value=100.05,
            rule_override=override,
        )
        assert result.status == ValidationResultStatus.WARNING

    def test_no_override_uses_hardcoded(self):
        result = evaluate_rule(
            rule_id="VR_001",
            fund_account="TEST001",
            fund_name="Test Fund",
            lhs_label="LHS",
            lhs_value=100.0,
            rhs_label="RHS",
            rhs_value=100.0,
        )
        assert result.ruleId == "VR_001"
        assert result.ruleName == "Total Assets Tie-Out"


# =============================================================================
# DSL vs Legacy Equivalence
# =============================================================================

class TestFieldValueAndSumField:
    """Tests for fieldValue and sumField CEL functions."""

    SAMPLE_DATA = [
        {"account": "IE-001", "ruleId": "VR_001", "eagleValue": 245680000.0, "mmifValue": 245678500.0},
    ]

    MULTI_ROW_DATA = [
        {"account": "IE-001", "marketValue": 100000.0, "quantity": 500},
        {"account": "IE-001", "marketValue": 200000.0, "quantity": 1000},
        {"account": "IE-001", "marketValue": 50000.0, "quantity": 250},
    ]

    def test_fieldValue_eagle(self):
        result = cel_fieldValue(self.SAMPLE_DATA, "eagleValue")
        assert float(result) == 245680000.0

    def test_fieldValue_mmif(self):
        result = cel_fieldValue(self.SAMPLE_DATA, "mmifValue")
        assert float(result) == 245678500.0

    def test_fieldValue_missing_field(self):
        result = cel_fieldValue(self.SAMPLE_DATA, "nonexistent")
        assert float(result) == 0.0

    def test_fieldValue_empty_rows(self):
        result = cel_fieldValue([], "eagleValue")
        assert float(result) == 0.0

    def test_sumField_single_row(self):
        result = cel_sumField(self.SAMPLE_DATA, "eagleValue")
        assert float(result) == 245680000.0

    def test_sumField_multiple_rows(self):
        result = cel_sumField(self.MULTI_ROW_DATA, "marketValue")
        assert float(result) == 350000.0

    def test_sumField_empty_rows(self):
        result = cel_sumField([], "marketValue")
        assert float(result) == 0.0

    def test_fieldValue_via_cel(self):
        evaluator = CelEvaluator()
        cel_data = python_to_cel(self.SAMPLE_DATA)
        _, prog = evaluator.compile("fieldValue(sample, 'eagleValue')")
        result = prog.evaluate({"sample": cel_data})
        assert float(cel_to_python(result)) == 245680000.0

    def test_sumField_via_cel(self):
        evaluator = CelEvaluator()
        cel_data = python_to_cel(self.MULTI_ROW_DATA)
        _, prog = evaluator.compile("sumField(sample, 'marketValue')")
        result = prog.evaluate({"sample": cel_data})
        assert float(cel_to_python(result)) == 350000.0

    def test_vr001_dsl_expression(self):
        """Verify VR-001 DSL expressions produce expected values."""
        evaluator = CelEvaluator()
        cel_data = python_to_cel(self.SAMPLE_DATA)
        activation = {"sample": cel_data}

        _, lhs_prog = evaluator.compile("fieldValue(sample, 'eagleValue')")
        _, rhs_prog = evaluator.compile("fieldValue(sample, 'mmifValue')")

        lhs = float(cel_to_python(lhs_prog.evaluate(activation)))
        rhs = float(cel_to_python(rhs_prog.evaluate(activation)))

        assert lhs == 245680000.0
        assert rhs == 245678500.0
        assert abs(lhs - rhs) == 1500.0


class TestDslLegacyEquivalence:
    """Verify DSL CEL expressions produce same results as legacy Python code."""

    def setup_method(self):
        self.evaluator = CelEvaluator()
        self.cel_ledger = python_to_cel(SAMPLE_LEDGER)

    def _eval_expr(self, expr: str) -> float:
        _, prog = self.evaluator.compile(expr)
        result = prog.evaluate({"ledger": self.cel_ledger})
        return float(cel_to_python(result))

    def _legacy_aggregate(self):
        """Replicate the legacy _aggregate_ledger_by_prefix logic."""
        categories = {
            "assets": 0.0, "liabilities": 0.0, "capital": 0.0,
            "income": 0.0, "expense": 0.0, "rgl": 0.0, "urgl": 0.0,
        }
        for entry in SAMPLE_LEDGER:
            gl = str(entry.get("glAccountNumber", ""))
            ending = entry.get("endingBalance", 0.0)
            if gl.startswith("1"):
                categories["assets"] += ending
            elif gl.startswith("2"):
                categories["liabilities"] += ending
            elif gl.startswith("3"):
                categories["capital"] += ending
            elif gl.startswith("4"):
                categories["income"] += ending
            elif gl.startswith("5"):
                categories["expense"] += ending
            elif gl.startswith("61"):
                categories["rgl"] += ending
            elif gl.startswith("6"):
                categories["urgl"] += ending
        return categories

    def test_vr016_bs_diff_matches_legacy(self):
        cats = self._legacy_aggregate()
        legacy_bs_diff = cats["assets"] - cats["liabilities"] - cats["capital"]
        dsl_bs_diff = self._eval_expr(
            "sumByPrefix(ledger, '1', 'endingBalance') "
            "- sumByPrefix(ledger, '2', 'endingBalance') "
            "- sumByPrefix(ledger, '3', 'endingBalance')"
        )
        assert dsl_bs_diff == legacy_bs_diff

    def test_vr017_net_income_matches_legacy(self):
        cats = self._legacy_aggregate()
        legacy = cats["income"] - cats["expense"]
        dsl = self._eval_expr(
            "sumByPrefix(ledger, '4', 'endingBalance') "
            "- sumByPrefix(ledger, '5', 'endingBalance')"
        )
        assert dsl == legacy

    def test_vr018_net_gl_matches_legacy(self):
        cats = self._legacy_aggregate()
        legacy = cats["rgl"] + cats["urgl"]
        dsl = self._eval_expr(
            "sumByPrefix(ledger, '61', 'endingBalance') "
            "+ sumByPrefixExcl(ledger, '6', '61', 'endingBalance')"
        )
        assert dsl == legacy

    def test_vr019_total_pnl_matches_legacy(self):
        cats = self._legacy_aggregate()
        legacy = (cats["income"] - cats["expense"]) + cats["rgl"] + cats["urgl"]
        dsl = self._eval_expr(
            "(sumByPrefix(ledger, '4', 'endingBalance') "
            "- sumByPrefix(ledger, '5', 'endingBalance')) "
            "+ sumByPrefix(ledger, '6', 'endingBalance')"
        )
        assert dsl == legacy

    def test_vr020_balance_check_matches_legacy(self):
        cats = self._legacy_aggregate()
        legacy_bs = cats["assets"] - cats["liabilities"] - cats["capital"]
        legacy_pnl = (cats["income"] - cats["expense"]) + cats["rgl"] + cats["urgl"]

        dsl_bs = self._eval_expr(
            "sumByPrefix(ledger, '1', 'endingBalance') "
            "- sumByPrefix(ledger, '2', 'endingBalance') "
            "- sumByPrefix(ledger, '3', 'endingBalance')"
        )
        dsl_pnl = self._eval_expr(
            "(sumByPrefix(ledger, '4', 'endingBalance') "
            "- sumByPrefix(ledger, '5', 'endingBalance')) "
            "+ sumByPrefix(ledger, '6', 'endingBalance')"
        )

        assert dsl_bs == legacy_bs
        assert dsl_pnl == legacy_pnl
        # Both should be equal for a balanced TB
        # (In this sample data they may differ — that's fine, the test is about equivalence)
        assert abs(dsl_bs - dsl_pnl) == abs(legacy_bs - legacy_pnl)
