"""
Tests for MMIF AI Rule Suggestion.

Tests the MmifRuleSuggester with mocked Claude responses.
Verifies prompt construction, JSON parsing, CEL validation, and retry flow.
"""
import sys
sys.path.insert(0, "/Volumes/D/Projects/ReconClareAI/backend")

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from mmif.ai_rule_suggest import (
    MmifRuleSuggester,
    _format_functions_for_prompt,
    EXAMPLE_RULES,
    SUGGEST_PROMPT,
)
from services.mapping.cel_evaluator import FUNCTION_DOCS


# ── Sample Claude responses ──────────────────────────────────────

VALID_RESPONSE = {
    "ruleId": "VR_021",
    "ruleName": "Total Assets Check",
    "description": "Total assets from Eagle must match MMIF total assets",
    "severity": "HARD",
    "tolerance": 0.00,
    "mmifSection": "4.3",
    "category": "MMIF_TIEOUT",
    "dataSource": "mmifSampleData",
    "lhs": {"label": "Eagle Assets", "expr": "fieldValue(sample, 'eagleValue')"},
    "rhs": {"label": "MMIF Assets", "expr": "fieldValue(sample, 'mmifValue')"},
}

VALID_LEDGER_RESPONSE = {
    "ruleId": "VR_022",
    "ruleName": "Net Income Check",
    "description": "Income minus expenses equals net income",
    "severity": "DERIVED",
    "tolerance": 0.01,
    "mmifSection": None,
    "category": "LEDGER_CROSS_CHECK",
    "dataSource": "mmifLedgerData",
    "lhs": {
        "label": "Net Income",
        "expr": "sumByPrefix(ledger, '4', 'endingBalance') - sumByPrefix(ledger, '5', 'endingBalance')",
    },
    "rhs": {
        "label": "Net Income (Control)",
        "expr": "sumByPrefix(ledger, '4', 'endingBalance') - sumByPrefix(ledger, '5', 'endingBalance')",
    },
}

INVALID_RESPONSE = {
    "ruleId": "VR_023",
    "ruleName": "Bad Rule",
    "description": "Has invalid expressions",
    "severity": "HARD",
    "tolerance": 0.0,
    "mmifSection": None,
    "category": "CUSTOM",
    "dataSource": "mmifLedgerData",
    "lhs": {"label": "Bad LHS", "expr": "sumByPrefix(ledger, '1', 'endingBalance') +++"},
    "rhs": {"label": "Good RHS", "expr": "sumByPrefix(ledger, '1', 'endingBalance')"},
}


# ── Helper to create mock client ─────────────────────────────────

def _make_mock_client(response_data):
    """Create a mock Anthropic client that returns the given response."""
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=json.dumps(response_data))]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message
    return mock_client


def _make_mock_client_sequence(responses):
    """Create a mock Anthropic client that returns responses in sequence."""
    mock_client = MagicMock()
    side_effects = []
    for resp in responses:
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text=json.dumps(resp))]
        side_effects.append(mock_message)
    mock_client.messages.create.side_effect = side_effects
    return mock_client


# ── Tests ─────────────────────────────────────────────────────────


class TestFormatFunctions:
    """Test prompt formatting utilities."""

    def test_format_includes_all_functions(self):
        formatted = _format_functions_for_prompt()
        for fn in FUNCTION_DOCS:
            assert fn["name"] in formatted

    def test_format_includes_signatures(self):
        formatted = _format_functions_for_prompt()
        assert "(list<map>, string, string) -> double" in formatted

    def test_format_includes_examples(self):
        formatted = _format_functions_for_prompt()
        assert "sumByPrefix(ledger, '1', 'endingBalance')" in formatted


class TestPromptConstruction:
    """Test that prompts are constructed correctly."""

    def test_prompt_includes_function_docs(self):
        suggester = MmifRuleSuggester()
        prompt = suggester._build_prompt("check total assets")
        assert "sumByPrefix" in prompt
        assert "fieldValue" in prompt

    def test_prompt_includes_example_rules(self):
        suggester = MmifRuleSuggester()
        prompt = suggester._build_prompt("check total assets")
        assert "VR_001" in prompt
        assert "VR_016" in prompt
        assert "VR_020" in prompt

    def test_prompt_includes_user_request(self):
        suggester = MmifRuleSuggester()
        prompt = suggester._build_prompt("total assets should match between Eagle and MMIF")
        assert "total assets should match between Eagle and MMIF" in prompt

    def test_prompt_includes_data_source_constraint(self):
        suggester = MmifRuleSuggester()
        prompt = suggester._build_prompt(
            "check assets", data_source="mmifLedgerData"
        )
        assert "Use ONLY 'mmifLedgerData'" in prompt

    def test_prompt_includes_existing_expressions(self):
        suggester = MmifRuleSuggester()
        prompt = suggester._build_prompt(
            "refine this rule",
            existing_lhs_expr="sumByPrefix(ledger, '1', 'endingBalance')",
            existing_rhs_expr="sumByPrefix(ledger, '2', 'endingBalance')",
        )
        assert "sumByPrefix(ledger, '1', 'endingBalance')" in prompt
        assert "sumByPrefix(ledger, '2', 'endingBalance')" in prompt
        assert "refine" in prompt.lower()

    def test_prompt_no_refinement_when_none(self):
        suggester = MmifRuleSuggester()
        prompt = suggester._build_prompt("check assets")
        assert "Current LHS expression" not in prompt

    def test_prompt_includes_severity_levels(self):
        suggester = MmifRuleSuggester()
        prompt = suggester._build_prompt("any rule")
        assert "HARD" in prompt
        assert "SOFT" in prompt
        assert "DERIVED" in prompt
        assert "ADVISORY" in prompt


class TestSuggestRule:
    """Test the full suggest_rule flow with mocked Claude client."""

    @pytest.mark.asyncio
    async def test_valid_response_parsed(self):
        suggester = MmifRuleSuggester()
        suggester._client = _make_mock_client(VALID_RESPONSE)

        result = await suggester.suggest_rule("check total assets")

        assert result["ruleId"] == "VR_021"
        assert result["ruleName"] == "Total Assets Check"
        assert result["lhs"]["expr"] == "fieldValue(sample, 'eagleValue')"
        assert result["rhs"]["expr"] == "fieldValue(sample, 'mmifValue')"

    @pytest.mark.asyncio
    async def test_valid_expressions_flagged(self):
        suggester = MmifRuleSuggester()
        suggester._client = _make_mock_client(VALID_RESPONSE)

        result = await suggester.suggest_rule("check total assets")

        assert result["lhsValidated"] is True
        assert result["rhsValidated"] is True

    @pytest.mark.asyncio
    async def test_ledger_expressions_validated(self):
        suggester = MmifRuleSuggester()
        suggester._client = _make_mock_client(VALID_LEDGER_RESPONSE)

        result = await suggester.suggest_rule("net income check")

        assert result["lhsValidated"] is True
        assert result["rhsValidated"] is True
        assert result["dataSource"] == "mmifLedgerData"

    @pytest.mark.asyncio
    async def test_invalid_expression_triggers_retry(self):
        # First call returns invalid expression, second call returns valid
        suggester = MmifRuleSuggester()
        suggester._client = _make_mock_client_sequence([
            INVALID_RESPONSE,
            VALID_LEDGER_RESPONSE,
        ])

        result = await suggester.suggest_rule("some rule")

        # Should have called Claude twice (original + retry)
        assert suggester._client.messages.create.call_count == 2
        # After retry, should have valid expressions
        assert result["lhsValidated"] is True

    @pytest.mark.asyncio
    async def test_retry_failure_returns_original(self):
        # Both calls return invalid expressions
        suggester = MmifRuleSuggester()
        suggester._client = _make_mock_client_sequence([
            INVALID_RESPONSE,
            INVALID_RESPONSE,
        ])

        result = await suggester.suggest_rule("bad rule")

        assert result["lhsValidated"] is False
        assert result["rhsValidated"] is True  # RHS was valid in INVALID_RESPONSE

    @pytest.mark.asyncio
    async def test_json_in_code_block_extracted(self):
        """Verify JSON wrapped in markdown code blocks is extracted."""
        suggester = MmifRuleSuggester()
        mock_message = MagicMock()
        mock_message.content = [
            MagicMock(text=f"```json\n{json.dumps(VALID_RESPONSE)}\n```")
        ]
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_message
        suggester._client = mock_client

        result = await suggester.suggest_rule("check assets")

        assert result["ruleId"] == "VR_021"
        assert result["lhsValidated"] is True

    @pytest.mark.asyncio
    async def test_list_response_uses_first_element(self):
        """If Claude returns a list instead of object, use first element."""
        suggester = MmifRuleSuggester()
        suggester._client = _make_mock_client([VALID_RESPONSE])

        result = await suggester.suggest_rule("check assets")

        assert result["ruleId"] == "VR_021"

    @pytest.mark.asyncio
    async def test_data_source_passed_to_prompt(self):
        suggester = MmifRuleSuggester()
        suggester._client = _make_mock_client(VALID_RESPONSE)

        await suggester.suggest_rule(
            "check assets", data_source="mmifSampleData"
        )

        # Verify the prompt sent to Claude contained the constraint
        call_args = suggester._client.messages.create.call_args
        messages = call_args[1]["messages"] if "messages" in call_args[1] else call_args[0][0]
        prompt_text = messages[0]["content"]
        assert "mmifSampleData" in prompt_text


class TestExampleRules:
    """Verify example rules are well-formed."""

    def test_example_rules_count(self):
        assert len(EXAMPLE_RULES) == 4

    def test_example_rules_have_required_fields(self):
        for rule in EXAMPLE_RULES:
            assert "ruleId" in rule
            assert "lhs" in rule
            assert "rhs" in rule
            assert "expr" in rule["lhs"]
            assert "expr" in rule["rhs"]
            assert "dataSource" in rule

    def test_example_rules_cover_both_data_sources(self):
        sources = {r["dataSource"] for r in EXAMPLE_RULES}
        assert "mmifSampleData" in sources
        assert "mmifLedgerData" in sources
