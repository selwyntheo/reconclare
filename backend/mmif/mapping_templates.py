"""
MMIF Mapping Configuration Templates.

Pre-built GL → MMIF Section mapping templates for each fund type.
Used by the mapping editor to auto-populate configurations.
"""
from typing import Optional


# ── Instrument Type codes ────────────────────────────────────
# 1=Equity, 2=Debt, 3=Property, 4=Derivatives, 5=Cash/Deposits

# ── Code Type codes ──────────────────────────────────────────
# 1=ISIN, 2=SEDOL, 3=CUSIP, 4=Internal, 5=Other


def _row(
    gl_pattern: str,
    source_table: str,
    source_field: str,
    mmif_section: str,
    mmif_field: str,
    instrument_type: Optional[int],
    code_type: int,
    sign: int = 1,
    reported: bool = True,
    notes: str = "",
    transformation: Optional[str] = None,
) -> dict:
    return {
        "eagleGlPattern": gl_pattern,
        "eagleSourceTable": source_table,
        "eagleSourceField": source_field,
        "mmifSection": mmif_section,
        "mmifField": mmif_field,
        "instrumentType": instrument_type,
        "codeType": code_type,
        "transformation": transformation,
        "signConvention": sign,
        "isReported": reported,
        "notes": notes,
    }


# ── AIF Template ─────────────────────────────────────────────

AIF_TEMPLATE = {
    "description": "Alternative Investment Fund — PE, debt, derivatives, cash",
    "mappings": [
        _row("1000*", "dataSubLedgerPosition", "posMarketValueBase", "3.1", "closing_position", 1, 1, notes="PE / equity positions at market value"),
        _row("1200*", "dataSubLedgerPosition", "posMarketValueBase", "3.2", "closing_position", 2, 1, notes="Debt securities at market value"),
        _row("1500*", "dataSubLedgerPosition", "posMarketValueBase", "3.4", "closing_position", 4, 1, notes="Derivatives — hedging instruments"),
        _row("1100*", "dataLedger", "endingBalance", "3.5", "closing_balance", None, 4, notes="Cash and deposits"),
        _row("1700*", "dataLedger", "endingBalance", "3.6", "other_assets", None, 4, notes="Uncalled capital commitments"),
        _row("1300*", "dataLedger", "endingBalance", "3.6", "accrued_income", None, 4, notes="Accrued income — other assets"),
        _row("3000*", "dataLedger", "endingBalance", "5.1", "fund_shares", None, 4, sign=-1, notes="Fund shares / units issued"),
    ],
    "counterpartyEnrichment": {
        "ARIA_PE_GP": {"sector": "S124", "country": "IE"},
        "JPMORGAN_IE": {"sector": "S122", "country": "IE"},
    },
    "investorClassification": {
        "S124": "Non-MMF Investment Funds",
        "S128": "Insurance Corporations",
        "S2": "Rest of World",
    },
}


# ── HEDGE Template ───────────────────────────────────────────

HEDGE_TEMPLATE = {
    "description": "Hedge Fund — long/short equities, derivatives, securities lending",
    "mappings": [
        _row("1000*", "dataSubLedgerPosition", "posMarketValueBase", "3.1", "closing_position", 1, 1, notes="Long equity positions"),
        _row("1010*", "dataSubLedgerPosition", "posMarketValueBase", "3.1", "closing_position", 1, 1, sign=-1, notes="Short equity positions"),
        _row("1500*", "dataSubLedgerPosition", "posMarketValueBase", "3.4", "closing_position", 4, 1, notes="Derivatives — options"),
        _row("1510*", "dataSubLedgerPosition", "posMarketValueBase", "3.4", "closing_position", 4, 1, notes="Derivatives — futures"),
        _row("1100*", "dataLedger", "endingBalance", "3.5", "closing_balance", None, 4, notes="Cash and margin deposits"),
        _row("1600*", "dataSubLedgerPosition", "posMarketValueBase", "3.4", "closing_position", None, 4, notes="Reverse repo / securities borrowing"),
        _row("3100*", "dataLedger", "endingBalance", "5.2", "securities_lending", None, 4, sign=-1, notes="Securities lending obligations"),
        _row("1300*", "dataLedger", "endingBalance", "3.6", "accrued_income", None, 4, notes="Accrued income — other assets"),
        _row("3000*", "dataLedger", "endingBalance", "5.1", "fund_shares", None, 4, sign=-1, notes="Fund shares / units issued"),
    ],
    "counterpartyEnrichment": {
        "GOLDMAN_SACHS_US": {"sector": "S122", "country": "US"},
        "MORGAN_STANLEY_US": {"sector": "S122", "country": "US"},
    },
    "investorClassification": {
        "S122": "MFI",
        "S124": "Non-MMF Investment Funds",
        "S2": "Rest of World",
    },
}


# ── UCITS Template ───────────────────────────────────────────

UCITS_TEMPLATE = {
    "description": "UCITS Fund — equities, cash, accrued income",
    "mappings": [
        _row("1000*", "dataSubLedgerPosition", "posMarketValueBase", "3.1", "closing_position", 1, 1, notes="Equity positions at market value"),
        _row("1100*", "dataLedger", "endingBalance", "3.5", "closing_balance", None, 4, notes="Cash and deposits"),
        _row("1300*", "dataLedger", "endingBalance", "3.6", "accrued_income", None, 4, notes="Accrued income — other assets"),
    ],
    "counterpartyEnrichment": {
        "JPMORGAN_IE": {"sector": "S122", "country": "IE"},
        "EUROCLEAR": {"sector": "S125", "country": "BE"},
        "CITI_IE": {"sector": "S122", "country": "IE"},
    },
    "investorClassification": {
        "S122": "MFI",
        "S124": "Non-MMF Investment Funds",
        "S128": "Insurance Corporations",
        "S2": "Rest of World",
    },
}


# ── MMF Template ─────────────────────────────────────────────

MMF_TEMPLATE = {
    "description": "Money Market Fund — cash, overnight deposits, short-term derivatives",
    "mappings": [
        _row("1100*", "dataLedger", "endingBalance", "3.5", "closing_balance", None, 4, notes="Cash and bank balances"),
        _row("1110*", "dataLedger", "endingBalance", "3.5", "closing_balance", None, 4, notes="Overnight deposits"),
        _row("1500*", "dataSubLedgerPosition", "posMarketValueBase", "3.4", "closing_position", 4, 1, notes="Short-term derivatives"),
    ],
    "counterpartyEnrichment": {
        "ECB": {"sector": "S121", "country": "DE"},
        "JPMORGAN_IE": {"sector": "S122", "country": "IE"},
    },
    "investorClassification": {
        "S121": "Central Bank",
        "S122": "MFI",
        "S124": "Non-MMF Investment Funds",
        "S2": "Rest of World",
    },
}


# ── Registry ─────────────────────────────────────────────────

_TEMPLATES = {
    "AIF": AIF_TEMPLATE,
    "HEDGE": HEDGE_TEMPLATE,
    "UCITS": UCITS_TEMPLATE,
    "MMF": MMF_TEMPLATE,
}


def list_templates() -> list[dict]:
    """Return summary of all available mapping templates."""
    return [
        {
            "fundType": ft,
            "description": t["description"],
            "mappingCount": len(t["mappings"]),
        }
        for ft, t in _TEMPLATES.items()
    ]


def get_mapping_template(fund_type: str) -> Optional[dict]:
    """Return full template for a fund type, or None if not found."""
    t = _TEMPLATES.get(fund_type.upper())
    if t is None:
        return None
    return {
        "fundType": fund_type.upper(),
        **t,
    }
