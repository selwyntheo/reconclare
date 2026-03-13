"""
MMIF Validation Rules VR-001 through VR-015.

Each rule validates a specific aspect of the MMIF regulatory return
against Eagle's trial balance data.
"""
from db.schemas import MmifSeverity, MmifValidationResultDoc, ValidationResultStatus


# ── Rule Definitions ──────────────────────────────────────────

MMIF_VALIDATION_RULES = [
    {
        "ruleId": "VR_001",
        "ruleName": "Total Assets Tie-Out",
        "description": "MMIF Section 4.3 total assets must equal Eagle TB total assets",
        "severity": MmifSeverity.HARD,
        "tolerance": 0.00,
        "mmifSection": "4.3",
    },
    {
        "ruleId": "VR_002",
        "ruleName": "Equity Subtotal",
        "description": "Sum of Section 3.1 must equal TB equity accounts",
        "severity": MmifSeverity.HARD,
        "tolerance": 0.01,
        "mmifSection": "3.1",
    },
    {
        "ruleId": "VR_003",
        "ruleName": "Debt Subtotal",
        "description": "Sum of Section 3.2 must equal TB fixed income (clean price)",
        "severity": MmifSeverity.HARD,
        "tolerance": 0.01,
        "mmifSection": "3.2",
    },
    {
        "ruleId": "VR_004",
        "ruleName": "Cash Subtotal",
        "description": "Sum of Section 3.5 must equal TB cash/deposit accounts",
        "severity": MmifSeverity.HARD,
        "tolerance": 0.00,
        "mmifSection": "3.5",
    },
    {
        "ruleId": "VR_005",
        "ruleName": "Derivative Net",
        "description": "Sum of Section 4.2 must equal TB derivative asset minus liability",
        "severity": MmifSeverity.SOFT,
        "tolerance": 0.05,
        "mmifSection": "4.2",
    },
    {
        "ruleId": "VR_006",
        "ruleName": "Opening = Prior Closing",
        "description": "Per-security MMIF opening position must match prior quarter closing",
        "severity": MmifSeverity.HARD,
        "tolerance": 0.00,
        "mmifSection": None,
    },
    {
        "ruleId": "VR_007",
        "ruleName": "Balance Identity",
        "description": "Opening + Purchases - Sales + Valuation = Closing per security",
        "severity": MmifSeverity.DERIVED,
        "tolerance": 0.00,
        "mmifSection": None,
    },
    {
        "ruleId": "VR_008",
        "ruleName": "Accrued Income",
        "description": "Section 3.6 or line-level accrued income must equal TB accrued income",
        "severity": MmifSeverity.SOFT,
        "tolerance": 0.02,
        "mmifSection": "3.6",
    },
    {
        "ruleId": "VR_009",
        "ruleName": "Fund Shares/Units",
        "description": "Section 5.1 closing shares times NAV per unit must equal TB",
        "severity": MmifSeverity.HARD,
        "tolerance": 0.01,
        "mmifSection": "5.1",
    },
    {
        "ruleId": "VR_010",
        "ruleName": "P&L Quarter-Only",
        "description": "Section 2 P&L must be quarter-only, not YTD cumulative",
        "severity": MmifSeverity.HARD,
        "tolerance": 0.01,
        "mmifSection": "2",
    },
    {
        "ruleId": "VR_011",
        "ruleName": "FX Consistency",
        "description": "Quarter-end FX rates applied consistently across all sections",
        "severity": MmifSeverity.SOFT,
        "tolerance": 0.10,
        "mmifSection": None,
    },
    {
        "ruleId": "VR_012",
        "ruleName": "ISIN Coverage",
        "description": "More than 95% of positions must have valid ISIN codes",
        "severity": MmifSeverity.ADVISORY,
        "tolerance": 0.0,
        "mmifSection": None,
    },
    {
        "ruleId": "VR_013",
        "ruleName": "Securities Lending Off-BS",
        "description": "Section 3.4/5.2 securities must NOT be included in total assets",
        "severity": MmifSeverity.HARD,
        "tolerance": 0.00,
        "mmifSection": "3.4",
    },
    {
        "ruleId": "VR_014",
        "ruleName": "Short Position Sign",
        "description": "Short positions must be reported as negative asset values",
        "severity": MmifSeverity.HARD,
        "tolerance": 0.0,
        "mmifSection": None,
    },
    {
        "ruleId": "VR_015",
        "ruleName": "Investor Decomposition",
        "description": "ΔNAV = valuation change + FX change + net investor flows + net income",
        "severity": MmifSeverity.DERIVED,
        "tolerance": 0.05,
        "mmifSection": None,
    },
]


MMIF_CHECK_SUITE_OPTIONS = [
    {"value": rule["ruleId"], "label": f'{rule["ruleId"].replace("_", "-")}: {rule["ruleName"]}'}
    for rule in MMIF_VALIDATION_RULES
]


def get_rule_definition(rule_id: str) -> dict:
    """Get a specific rule definition by ID."""
    for rule in MMIF_VALIDATION_RULES:
        if rule["ruleId"] == rule_id:
            return rule
    raise ValueError(f"Unknown MMIF validation rule: {rule_id}")


def evaluate_rule(
    rule_id: str,
    fund_account: str,
    fund_name: str,
    lhs_label: str,
    lhs_value: float,
    rhs_label: str,
    rhs_value: float,
) -> MmifValidationResultDoc:
    """
    Evaluate a single MMIF validation rule.
    Returns a result doc with pass/fail status based on tolerance.
    """
    rule = get_rule_definition(rule_id)
    variance = abs(lhs_value - rhs_value)
    tolerance = rule["tolerance"]

    if rule["severity"] == MmifSeverity.ADVISORY:
        # Advisory rules check coverage percentages, not monetary values
        status = ValidationResultStatus.PASSED if lhs_value >= 0.95 else ValidationResultStatus.WARNING
    elif variance <= tolerance:
        status = ValidationResultStatus.PASSED
    elif rule["severity"] == MmifSeverity.SOFT:
        status = ValidationResultStatus.WARNING
    else:
        status = ValidationResultStatus.FAILED

    return MmifValidationResultDoc(
        ruleId=rule["ruleId"],
        ruleName=rule["ruleName"],
        severity=rule["severity"],
        mmifSection=rule.get("mmifSection"),
        fundAccount=fund_account,
        fundName=fund_name,
        status=status,
        lhsLabel=lhs_label,
        lhsValue=lhs_value,
        rhsLabel=rhs_label,
        rhsValue=rhs_value,
        variance=variance,
        tolerance=tolerance,
        breakCount=1 if status == ValidationResultStatus.FAILED else 0,
    )
