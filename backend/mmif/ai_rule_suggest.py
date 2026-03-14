"""
AI-powered MMIF validation rule suggestion using Claude.

Generates CEL expressions and rule metadata from natural language descriptions.
Follows the same pattern as services/mapping/ai_generator.py.
"""
import json
import logging
from typing import Any, Optional

from config.settings import settings
from services.mapping.cel_evaluator import CelEvaluator, FUNCTION_DOCS

logger = logging.getLogger(__name__)


def _format_functions_for_prompt() -> str:
    """Format CEL function docs for inclusion in the AI prompt."""
    lines = []
    for fn in FUNCTION_DOCS:
        lines.append(
            f"- {fn['name']}{fn['signature']}: {fn['description']}  "
            f"Example: {fn.get('example', '')}"
        )
    return "\n".join(lines)


# ── Example rules for few-shot learning ──────────────────────────

EXAMPLE_RULES = [
    {
        "ruleId": "VR_001",
        "ruleName": "Total Assets Tie-Out",
        "description": "MMIF Section 4.3 total assets must equal Eagle TB total assets",
        "severity": "HARD",
        "tolerance": 0.00,
        "mmifSection": "4.3",
        "category": "MMIF_TIEOUT",
        "dataSource": "mmifSampleData",
        "lhs": {"label": "Eagle Total Assets", "expr": "fieldValue(sample, 'eagleValue')"},
        "rhs": {"label": "MMIF Total Assets", "expr": "fieldValue(sample, 'mmifValue')"},
    },
    {
        "ruleId": "VR_016",
        "ruleName": "BS Equation Check",
        "description": "Assets(1xxx) - Liabilities(2xxx) - Capital(3xxx) must reconcile with Total PnL",
        "severity": "HARD",
        "tolerance": 0.01,
        "mmifSection": None,
        "category": "LEDGER_CROSS_CHECK",
        "dataSource": "mmifLedgerData",
        "lhs": {
            "label": "BS Diff (A-L-C)",
            "expr": "sumByPrefix(ledger, '1', 'endingBalance') - sumByPrefix(ledger, '2', 'endingBalance') - sumByPrefix(ledger, '3', 'endingBalance')",
        },
        "rhs": {
            "label": "Total PnL",
            "expr": "(sumByPrefix(ledger, '4', 'endingBalance') - sumByPrefix(ledger, '5', 'endingBalance')) + sumByPrefix(ledger, '6', 'endingBalance')",
        },
    },
    {
        "ruleId": "VR_018",
        "ruleName": "Net Gains/Losses",
        "description": "RGL(61xx) + URGL(6xxx excl 61xx) = Net GL",
        "severity": "DERIVED",
        "tolerance": 0.01,
        "mmifSection": None,
        "category": "LEDGER_CROSS_CHECK",
        "dataSource": "mmifLedgerData",
        "lhs": {
            "label": "RGL",
            "expr": "sumByPrefix(ledger, '61', 'endingBalance')",
        },
        "rhs": {
            "label": "URGL",
            "expr": "sumByPrefixExcl(ledger, '6', '61', 'endingBalance')",
        },
    },
    {
        "ruleId": "VR_020",
        "ruleName": "TB Overall Balance",
        "description": "BS Diff - Total PnL = 0. Master trial balance check",
        "severity": "HARD",
        "tolerance": 0.00,
        "mmifSection": None,
        "category": "LEDGER_CROSS_CHECK",
        "dataSource": "mmifLedgerData",
        "lhs": {
            "label": "BS Diff",
            "expr": "sumByPrefix(ledger, '1', 'endingBalance') - sumByPrefix(ledger, '2', 'endingBalance') - sumByPrefix(ledger, '3', 'endingBalance')",
        },
        "rhs": {
            "label": "Total PnL",
            "expr": "(sumByPrefix(ledger, '4', 'endingBalance') - sumByPrefix(ledger, '5', 'endingBalance')) + sumByPrefix(ledger, '6', 'endingBalance')",
        },
    },
]


# ── Prompt template ──────────────────────────────────────────────

SUGGEST_PROMPT = """You are an MMIF regulatory filing validation rule specialist for fund administration.
Given a natural language description, generate a validation rule with CEL expressions.

## Available CEL Functions
{custom_functions}

## Data Sources

**mmifLedgerData** — General ledger rows. Each row has:
- glAccountNumber (string, e.g. "1100", "2300", "4100")
- glDescription (string)
- startingBalance (double)
- endingBalance (double)
- GL account prefix conventions: 1xxx=Assets, 2xxx=Liabilities, 3xxx=Capital, 4xxx=Income, 5xxx=Expense, 6xxx=Gains/Losses (61xx=Realized, other 6xxx=Unrealized)
- Variable name in expressions: `ledger`

**mmifSampleData** — Pre-computed values for cross-system comparisons. Each row has:
- eagleValue (double) — value from Eagle accounting system
- mmifValue (double) — value from MMIF regulatory return
- Variable name in expressions: `sample`

## Severity Levels
- HARD: Must pass for filing approval (zero tolerance expected)
- SOFT: Warning if breached but does not block filing
- DERIVED: Calculated check (cross-validation between computed values)
- ADVISORY: Informational only

## Categories
- MMIF_TIEOUT: Cross-system comparison (Eagle vs MMIF)
- LEDGER_CROSS_CHECK: Internal GL consistency checks
- POSITION_CHECK: Security/position-level validations
- DATA_QUALITY: Coverage and consistency checks
- CUSTOM: User-defined rules

## Example Rules
{example_rules}

{refinement_context}

## User Request
{user_prompt}

## Instructions
Generate a JSON object with these fields:
- "ruleId": suggested rule ID (format VR_NNN, use VR_021+ for new rules)
- "ruleName": concise name (2-5 words)
- "description": one-sentence description
- "severity": one of HARD, SOFT, DERIVED, ADVISORY
- "tolerance": numeric tolerance (0.00 for exact match, 0.01 for penny tolerance, etc.)
- "mmifSection": MMIF section reference if applicable, otherwise null
- "category": one of the categories above
- "dataSource": "mmifLedgerData" or "mmifSampleData"
- "lhs": {{"label": "short label", "expr": "CEL expression"}}
- "rhs": {{"label": "short label", "expr": "CEL expression"}}

Rules:
- Use ONLY the declared custom functions and standard CEL operators (+, -, *, /, ==, !=)
- For ledger rules, use `ledger` variable with sumByPrefix, sumByPrefixExcl, etc.
- For cross-system comparisons, use `sample` variable with fieldValue
- Keep expressions simple and readable

Respond with ONLY a JSON object. No additional text."""


# ── Suggester class ──────────────────────────────────────────────

class MmifRuleSuggester:
    """Generates MMIF validation rule suggestions from natural language."""

    def __init__(self):
        self._evaluator = CelEvaluator()
        self._client = None

    def _get_client(self):
        """Lazy-init Anthropic client."""
        if self._client is None:
            try:
                import anthropic
                api_key = settings.ANTHROPIC_API_KEY
                if not api_key:
                    raise ValueError("ANTHROPIC_API_KEY not configured")
                self._client = anthropic.Anthropic(api_key=api_key)
            except ImportError:
                raise RuntimeError(
                    "anthropic package not installed. Run: pip install anthropic"
                )
        return self._client

    async def _call_claude(self, prompt: str) -> Any:
        """Call Claude API and parse JSON response."""
        client = self._get_client()

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text.strip()

        # Extract JSON from markdown code blocks if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            json_lines = []
            in_block = False
            for line in lines:
                if line.startswith("```") and not in_block:
                    in_block = True
                    continue
                elif line.startswith("```") and in_block:
                    break
                elif in_block:
                    json_lines.append(line)
            response_text = "\n".join(json_lines)

        return json.loads(response_text)

    def _build_prompt(
        self,
        user_prompt: str,
        data_source: Optional[str] = None,
        existing_lhs_expr: Optional[str] = None,
        existing_rhs_expr: Optional[str] = None,
    ) -> str:
        """Build the full prompt with function docs, examples, and context."""
        refinement_parts = []
        if data_source:
            refinement_parts.append(
                f"Data source constraint: Use ONLY '{data_source}' as the dataSource."
            )
        if existing_lhs_expr or existing_rhs_expr:
            refinement_parts.append("## Current Rule State (refine these)")
            if existing_lhs_expr:
                refinement_parts.append(f"Current LHS expression: {existing_lhs_expr}")
            if existing_rhs_expr:
                refinement_parts.append(f"Current RHS expression: {existing_rhs_expr}")

        refinement_context = "\n".join(refinement_parts) if refinement_parts else ""

        return SUGGEST_PROMPT.format(
            custom_functions=_format_functions_for_prompt(),
            example_rules=json.dumps(EXAMPLE_RULES, indent=2),
            refinement_context=refinement_context,
            user_prompt=user_prompt,
        )

    async def suggest_rule(
        self,
        prompt: str,
        data_source: Optional[str] = None,
        existing_lhs_expr: Optional[str] = None,
        existing_rhs_expr: Optional[str] = None,
    ) -> dict:
        """Generate a validation rule suggestion from natural language."""
        full_prompt = self._build_prompt(
            prompt, data_source, existing_lhs_expr, existing_rhs_expr
        )

        result = await self._call_claude(full_prompt)
        if isinstance(result, list):
            result = result[0] if result else {}

        # Validate LHS expression
        lhs_expr = result.get("lhs", {}).get("expr", "0.0")
        lhs_valid, lhs_error = self._evaluator.validate_expression(lhs_expr)

        # Validate RHS expression
        rhs_expr = result.get("rhs", {}).get("expr", "0.0")
        rhs_valid, rhs_error = self._evaluator.validate_expression(rhs_expr)

        # Retry once if either expression is invalid
        if not lhs_valid or not rhs_valid:
            errors = []
            if not lhs_valid:
                errors.append(f"LHS expression error: {lhs_error}")
            if not rhs_valid:
                errors.append(f"RHS expression error: {rhs_error}")

            result = await self._retry_with_errors(
                prompt, result, errors, data_source
            )

            # Re-validate after retry
            lhs_expr = result.get("lhs", {}).get("expr", "0.0")
            lhs_valid, _ = self._evaluator.validate_expression(lhs_expr)
            rhs_expr = result.get("rhs", {}).get("expr", "0.0")
            rhs_valid, _ = self._evaluator.validate_expression(rhs_expr)

        result["lhsValidated"] = lhs_valid
        result["rhsValidated"] = rhs_valid

        return result

    async def _retry_with_errors(
        self,
        original_prompt: str,
        previous_result: dict,
        errors: list[str],
        data_source: Optional[str],
    ) -> dict:
        """Retry generation with error feedback."""
        retry_prompt = f"""Your previous response for an MMIF validation rule had CEL expression errors.

Previous response:
{json.dumps(previous_result, indent=2)}

Errors:
{chr(10).join('- ' + e for e in errors)}

Available Custom CEL Functions:
{_format_functions_for_prompt()}

Original user request: {original_prompt}
{f"Data source constraint: Use ONLY '{data_source}'." if data_source else ""}

Please provide a corrected JSON object with valid CEL expressions.
Respond with ONLY a JSON object."""

        try:
            return await self._call_claude(retry_prompt)
        except Exception as e:
            logger.warning(f"Retry failed: {e}")
            return previous_result
