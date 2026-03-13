"""
Tests for MMIF Validation Rules VR-001 through VR-015.
Validates rule definitions, evaluate_rule logic, severities, tolerances, and section mappings.
"""
import sys
sys.path.insert(0, "/Volumes/D/Projects/ReconClareAI/backend")

import pytest
from db.schemas import MmifSeverity, ValidationResultStatus
from mmif.validation_rules import (
    MMIF_VALIDATION_RULES,
    MMIF_CHECK_SUITE_OPTIONS,
    get_rule_definition,
    evaluate_rule,
)


# =============================================================================
# Rule Definitions
# =============================================================================

class TestRuleDefinitions:
    """Verify all 15 MMIF validation rules are correctly defined."""

    def test_fifteen_rules_defined(self):
        assert len(MMIF_VALIDATION_RULES) == 15

    def test_all_rule_ids_present(self):
        rule_ids = {r["ruleId"] for r in MMIF_VALIDATION_RULES}
        expected = {f"VR_{str(i).zfill(3)}" for i in range(1, 16)}
        assert rule_ids == expected

    def test_each_rule_has_required_fields(self):
        required = {"ruleId", "ruleName", "description", "severity", "tolerance"}
        for rule in MMIF_VALIDATION_RULES:
            for field in required:
                assert field in rule, f"{rule['ruleId']} missing field: {field}"

    @pytest.mark.parametrize("rule_id,expected_severity", [
        ("VR_001", MmifSeverity.HARD),
        ("VR_002", MmifSeverity.HARD),
        ("VR_003", MmifSeverity.HARD),
        ("VR_004", MmifSeverity.HARD),
        ("VR_005", MmifSeverity.SOFT),
        ("VR_006", MmifSeverity.HARD),
        ("VR_007", MmifSeverity.DERIVED),
        ("VR_008", MmifSeverity.SOFT),
        ("VR_009", MmifSeverity.HARD),
        ("VR_010", MmifSeverity.HARD),
        ("VR_011", MmifSeverity.SOFT),
        ("VR_012", MmifSeverity.ADVISORY),
        ("VR_013", MmifSeverity.HARD),
        ("VR_014", MmifSeverity.HARD),
        ("VR_015", MmifSeverity.DERIVED),
    ])
    def test_rule_severity(self, rule_id, expected_severity):
        rule = get_rule_definition(rule_id)
        assert rule["severity"] == expected_severity

    @pytest.mark.parametrize("rule_id,expected_tolerance", [
        ("VR_001", 0.00),
        ("VR_002", 0.01),
        ("VR_003", 0.01),
        ("VR_004", 0.00),
        ("VR_005", 0.05),
        ("VR_006", 0.00),
        ("VR_007", 0.00),
        ("VR_008", 0.02),
        ("VR_009", 0.01),
        ("VR_010", 0.01),
        ("VR_011", 0.10),
        ("VR_012", 0.0),
        ("VR_013", 0.00),
        ("VR_014", 0.0),
        ("VR_015", 0.05),
    ])
    def test_rule_tolerance(self, rule_id, expected_tolerance):
        rule = get_rule_definition(rule_id)
        assert rule["tolerance"] == expected_tolerance

    @pytest.mark.parametrize("rule_id,expected_section", [
        ("VR_001", "4.3"),
        ("VR_002", "3.1"),
        ("VR_003", "3.2"),
        ("VR_004", "3.5"),
        ("VR_005", "4.2"),
        ("VR_006", None),
        ("VR_007", None),
        ("VR_008", "3.6"),
        ("VR_009", "5.1"),
        ("VR_010", "2"),
        ("VR_011", None),
        ("VR_012", None),
        ("VR_013", "3.4"),
        ("VR_014", None),
        ("VR_015", None),
    ])
    def test_rule_mmif_section(self, rule_id, expected_section):
        rule = get_rule_definition(rule_id)
        assert rule.get("mmifSection") == expected_section


# =============================================================================
# get_rule_definition
# =============================================================================

class TestGetRuleDefinition:

    def test_returns_correct_rule(self):
        rule = get_rule_definition("VR_001")
        assert rule["ruleId"] == "VR_001"
        assert rule["ruleName"] == "Total Assets Tie-Out"

    def test_raises_for_unknown_rule(self):
        with pytest.raises(ValueError, match="Unknown MMIF validation rule"):
            get_rule_definition("VR_999")

    def test_returns_all_fields(self):
        rule = get_rule_definition("VR_005")
        assert "ruleId" in rule
        assert "ruleName" in rule
        assert "description" in rule
        assert "severity" in rule
        assert "tolerance" in rule


# =============================================================================
# MMIF_CHECK_SUITE_OPTIONS
# =============================================================================

class TestCheckSuiteOptions:

    def test_has_fifteen_options(self):
        assert len(MMIF_CHECK_SUITE_OPTIONS) == 15

    def test_each_option_has_value_and_label(self):
        for opt in MMIF_CHECK_SUITE_OPTIONS:
            assert "value" in opt
            assert "label" in opt

    def test_values_are_rule_ids(self):
        values = {o["value"] for o in MMIF_CHECK_SUITE_OPTIONS}
        expected = {f"VR_{str(i).zfill(3)}" for i in range(1, 16)}
        assert values == expected

    def test_labels_have_readable_format(self):
        first = MMIF_CHECK_SUITE_OPTIONS[0]
        assert "VR-001" in first["label"]
        assert "Total Assets Tie-Out" in first["label"]


# =============================================================================
# evaluate_rule
# =============================================================================

class TestEvaluateRule:

    def _eval(self, rule_id, lhs, rhs):
        return evaluate_rule(
            rule_id=rule_id,
            fund_account="IE000001",
            fund_name="Test Fund",
            lhs_label="Eagle TB",
            lhs_value=lhs,
            rhs_label="MMIF Return",
            rhs_value=rhs,
        )

    # --- HARD rules ---

    def test_hard_rule_pass_at_zero_tolerance(self):
        result = self._eval("VR_001", 1000000.0, 1000000.0)
        assert result.status == ValidationResultStatus.PASSED
        assert result.breakCount == 0

    def test_hard_rule_fail_at_zero_tolerance(self):
        result = self._eval("VR_001", 1000000.0, 999999.0)
        assert result.status == ValidationResultStatus.FAILED
        assert result.breakCount == 1

    def test_hard_rule_pass_within_tolerance(self):
        # VR_002 has tolerance 0.01
        result = self._eval("VR_002", 100.0, 100.005)
        assert result.status == ValidationResultStatus.PASSED

    def test_hard_rule_fail_exceeding_tolerance(self):
        result = self._eval("VR_002", 100.0, 100.02)
        assert result.status == ValidationResultStatus.FAILED

    def test_hard_rule_at_tolerance_boundary(self):
        # VR_002 tolerance=0.01 — variance of 0.009 should pass
        result = self._eval("VR_002", 100.0, 100.009)
        assert result.status == ValidationResultStatus.PASSED

    # --- SOFT rules ---

    def test_soft_rule_pass(self):
        result = self._eval("VR_005", 100.0, 100.0)
        assert result.status == ValidationResultStatus.PASSED

    def test_soft_rule_warning_exceeds_tolerance(self):
        # VR_005: SOFT, tolerance=0.05
        result = self._eval("VR_005", 100.0, 100.1)
        assert result.status == ValidationResultStatus.WARNING
        assert result.breakCount == 0

    def test_soft_rule_pass_within_tolerance(self):
        result = self._eval("VR_005", 100.0, 100.04)
        assert result.status == ValidationResultStatus.PASSED

    # --- DERIVED rules ---

    def test_derived_rule_pass(self):
        result = self._eval("VR_007", 100.0, 100.0)
        assert result.status == ValidationResultStatus.PASSED

    def test_derived_rule_fail(self):
        # VR_007: DERIVED, tolerance=0.00
        result = self._eval("VR_007", 100.0, 100.01)
        assert result.status == ValidationResultStatus.FAILED

    # --- ADVISORY rules ---

    def test_advisory_pass_above_threshold(self):
        # VR_012: ADVISORY — lhs >= 0.95 → PASSED
        result = self._eval("VR_012", 0.96, 0.0)
        assert result.status == ValidationResultStatus.PASSED
        assert result.breakCount == 0

    def test_advisory_pass_at_threshold(self):
        result = self._eval("VR_012", 0.95, 0.0)
        assert result.status == ValidationResultStatus.PASSED

    def test_advisory_warning_below_threshold(self):
        result = self._eval("VR_012", 0.90, 0.0)
        assert result.status == ValidationResultStatus.WARNING
        assert result.breakCount == 0

    # --- Variance calculation ---

    def test_variance_calculated_correctly(self):
        result = self._eval("VR_001", 100.0, 90.0)
        assert result.variance == 10.0

    def test_variance_absolute_value(self):
        result = self._eval("VR_001", 90.0, 100.0)
        assert result.variance == 10.0

    # --- Result fields ---

    def test_result_has_correct_fields(self):
        result = self._eval("VR_001", 100.0, 100.0)
        assert result.ruleId == "VR_001"
        assert result.ruleName == "Total Assets Tie-Out"
        assert result.severity == MmifSeverity.HARD
        assert result.fundAccount == "IE000001"
        assert result.fundName == "Test Fund"
        assert result.lhsLabel == "Eagle TB"
        assert result.rhsLabel == "MMIF Return"
        assert result.lhsValue == 100.0
        assert result.rhsValue == 100.0
        assert result.tolerance == 0.0

    def test_result_mmif_section(self):
        result = self._eval("VR_001", 100.0, 100.0)
        assert result.mmifSection == "4.3"

    def test_result_no_mmif_section(self):
        result = self._eval("VR_006", 100.0, 100.0)
        assert result.mmifSection is None
