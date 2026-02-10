"""
Derived Subledger Rollup Service - per spec ledger_subledger.md

This service calculates derived subledger values from position-level and
transaction-level data, aggregating them into ledger conversion categories.

Rollup Formulas (Section 9.2):
- Cash: posBookValueBase WHERE secType IN ('CU')
- Investment Cost: posBookValueBase WHERE secType NOT IN ('CU', 'FT')
- Holdings Unrealized: posMarketValueBase - posBookValueBase
- Future Margin: ltdVariationMarginBase + dailyVariationMarginBase WHERE secType = 'FT'
- Dividend RecPay: SUM(transAmountBase) WHERE transCode = 'DIV'
- Reclaim RecPay: SUM(transAmountBase) WHERE transCode IN ('RECL', 'RECL-', 'RECL+')
- Interest RecPay: posIncomeBase + unsettled interest transactions
- Investment RecPay: SUM(transAmountBase) WHERE transCode IN ('BUY', 'SELL', 'COVER')
- Unrealized INCST: (posMarketValueBase - posBookValueBase) * -1
"""
from decimal import Decimal
from typing import Optional

from db.mongodb import get_sync_db, COLLECTIONS


# Categories with their subledger support status
SUBLEDGER_SUPPORTED_CATEGORIES = {
    "Cash": True,
    "Investment Cost": True,
    "Holdings Unrealized": True,
    "Future Margin": True,
    "Dividend RecPay": True,
    "Reclaim RecPay": True,
    "Interest RecPay": True,
    "Swap Income RecPay": True,
    "Investment RecPay": True,
    "Subscription Rec": True,
    "Expense RecPay": False,
    "Capital": False,
    "Realized GL": False,
    "Unrealized INCST": True,
    "Income": False,
    "Expenses": False,
    "Distribution Pay": False,
}

# Transaction code to category mapping (Section 8.3)
TRANS_CODE_TO_CATEGORY = {
    "DIV": "Dividend RecPay",
    "RECL": "Reclaim RecPay",
    "RECL-": "Reclaim RecPay",
    "RECL+": "Reclaim RecPay",
    "BUY": "Investment RecPay",
    "SELL": "Investment RecPay",
    "COVER": "Investment RecPay",
    "INT": "Interest RecPay",
}

# Security type classifications
CASH_SEC_TYPES = {"CU"}  # Cash/Currency
FUTURES_SEC_TYPES = {"FT"}  # Futures


class DerivedSubledgerService:
    """
    Service for calculating derived subledger values from position and transaction data.
    """

    def __init__(self):
        self.db = get_sync_db()

    def get_position_rollup(
        self,
        account: str,
        valuation_dt: str,
        user_bank: str = "CPU"
    ) -> dict[str, dict]:
        """
        Calculate position-level aggregations by category.

        Returns dict of:
        {
            category: {
                "bookValue": ...,
                "unrealized": ...,
                "netIncome": ...,
                "futureMargin": ...,
                "total": ...
            }
        }
        """
        positions = list(self.db[COLLECTIONS["dataSubLedgerPosition"]].find({
            "account": account,
            "valuationDt": valuation_dt,
            "userBank": user_bank,
        }))

        # Get security types from refSecurity
        security_types = self._get_security_types(valuation_dt, user_bank)

        # Initialize category totals
        category_totals: dict[str, dict] = {}
        for cat in SUBLEDGER_SUPPORTED_CATEGORIES:
            if SUBLEDGER_SUPPORTED_CATEGORIES[cat]:
                category_totals[cat] = {
                    "bookValue": Decimal("0"),
                    "unrealized": Decimal("0"),
                    "netIncome": Decimal("0"),
                    "futureMargin": Decimal("0"),
                    "total": Decimal("0"),
                }

        for pos in positions:
            asset_id = pos.get("assetId", "")
            sec_type = security_types.get(asset_id, "S")  # Default to Stock

            book_value = Decimal(str(pos.get("posBookValueBase", 0) or 0))
            market_value = Decimal(str(pos.get("posMarketValueBase", 0) or 0))
            unrealized = market_value - book_value
            income = Decimal(str(pos.get("posIncomeBase", 0) or 0))
            daily_var_margin = Decimal(str(pos.get("dailyVariationMarginBase", 0) or 0))
            ltd_var_margin = Decimal(str(pos.get("ltdVariationMarginBase", 0) or 0))

            # Cash category: CU secType only
            if sec_type in CASH_SEC_TYPES:
                category_totals["Cash"]["bookValue"] += book_value
                category_totals["Cash"]["total"] += book_value
                # Cash unrealized goes to Holdings Unrealized
                if unrealized != 0:
                    category_totals["Holdings Unrealized"]["unrealized"] += unrealized
                    category_totals["Holdings Unrealized"]["total"] += unrealized
                    # Inverse for Unrealized INCST
                    category_totals["Unrealized INCST"]["unrealized"] += -unrealized
                    category_totals["Unrealized INCST"]["total"] += -unrealized

            # Future Margin category: FT secType only
            elif sec_type in FUTURES_SEC_TYPES:
                total_margin = daily_var_margin + ltd_var_margin
                category_totals["Future Margin"]["futureMargin"] += total_margin
                category_totals["Future Margin"]["total"] += total_margin

            # Investment Cost: All other secTypes
            else:
                category_totals["Investment Cost"]["bookValue"] += book_value
                category_totals["Investment Cost"]["total"] += book_value
                # Unrealized for non-cash, non-futures positions
                if unrealized != 0:
                    category_totals["Holdings Unrealized"]["unrealized"] += unrealized
                    category_totals["Holdings Unrealized"]["total"] += unrealized
                    # Inverse for Unrealized INCST
                    category_totals["Unrealized INCST"]["unrealized"] += -unrealized
                    category_totals["Unrealized INCST"]["total"] += -unrealized

            # Interest/Dividend income
            if income != 0:
                # TODO: Differentiate between interest and dividend based on sec_type
                category_totals["Interest RecPay"]["netIncome"] += income
                category_totals["Interest RecPay"]["total"] += income

        # Convert Decimals to floats for JSON serialization
        for cat in category_totals:
            for field in category_totals[cat]:
                category_totals[cat][field] = float(category_totals[cat][field])

        return category_totals

    def get_transaction_rollup(
        self,
        account: str,
        valuation_dt: str,
        user_bank: str = "CPU"
    ) -> dict[str, dict]:
        """
        Calculate unsettled transaction aggregations by category.

        Returns dict of:
        {
            category: {
                "transactionValue": ...,
                "transCodes": {transCode: amount, ...}
            }
        }
        """
        # Query unsettled transactions (those with trans_code and trans_amount_base)
        transactions = list(self.db[COLLECTIONS["dataSubLedgerTrans"]].find({
            "account": account,
            "valuationDt": valuation_dt,
            "transCode": {"$exists": True, "$ne": None},
            "transAmountBase": {"$exists": True, "$ne": None},
        }))

        # Initialize category totals
        category_totals: dict[str, dict] = {}
        for cat in ["Dividend RecPay", "Reclaim RecPay", "Interest RecPay", "Investment RecPay"]:
            category_totals[cat] = {
                "transactionValue": Decimal("0"),
                "transCodes": {},
            }

        for txn in transactions:
            trans_code = txn.get("transCode", "")
            trans_amount = Decimal(str(txn.get("transAmountBase", 0) or 0))

            category = TRANS_CODE_TO_CATEGORY.get(trans_code)
            if category and category in category_totals:
                category_totals[category]["transactionValue"] += trans_amount
                if trans_code not in category_totals[category]["transCodes"]:
                    category_totals[category]["transCodes"][trans_code] = Decimal("0")
                category_totals[category]["transCodes"][trans_code] += trans_amount

        # Convert Decimals to floats
        for cat in category_totals:
            category_totals[cat]["transactionValue"] = float(category_totals[cat]["transactionValue"])
            for tc in category_totals[cat]["transCodes"]:
                category_totals[cat]["transCodes"][tc] = float(category_totals[cat]["transCodes"][tc])

        return category_totals

    def get_derived_subledger_rollup(
        self,
        account: str,
        valuation_dt: str,
        user_bank: str = "CPU"
    ) -> list[dict]:
        """
        Get the complete derived subledger rollup combining positions and transactions.

        Returns list of:
        [
            {
                "account": ...,
                "category": ...,
                "subledgerSupported": True/False,
                "positionValue": ...,
                "transactionValue": ...,
                "derivedValue": ...
            },
            ...
        ]
        """
        position_rollup = self.get_position_rollup(account, valuation_dt, user_bank)
        transaction_rollup = self.get_transaction_rollup(account, valuation_dt, user_bank)

        results = []
        for category, supported in SUBLEDGER_SUPPORTED_CATEGORIES.items():
            pos_data = position_rollup.get(category, {})
            txn_data = transaction_rollup.get(category, {})

            position_value = pos_data.get("total", 0) if supported else None
            transaction_value = txn_data.get("transactionValue", 0) if supported else None

            if supported:
                derived_value = (position_value or 0) + (transaction_value or 0)
            else:
                derived_value = None

            results.append({
                "account": account,
                "category": category,
                "subledgerSupported": supported,
                "positionValue": position_value,
                "transactionValue": transaction_value,
                "derivedValue": derived_value,
            })

        return results

    def get_ledger_subledger_summary(
        self,
        account: str,
        valuation_dt: str,
        user_bank: str = "CPU"
    ) -> dict:
        """
        Get the Ledger to Subledger summary comparison.

        Returns:
        {
            "rows": [
                {
                    "account": ...,
                    "category": ...,
                    "subledgerSupported": True/False,
                    "ledger": ...,
                    "subLedger": ...,
                    "variance": ...
                },
                ...
            ],
            "totals": {
                "ledger": ...,
                "subLedger": ...,
                "variance": ...
            }
        }
        """
        # Get derived subledger values
        derived_rollup = self.get_derived_subledger_rollup(account, valuation_dt, user_bank)
        derived_by_category = {r["category"]: r for r in derived_rollup}

        # Get ledger values by category
        ledger_by_category = self._get_ledger_by_category(account, valuation_dt, user_bank)

        # Build comparison rows
        rows = []
        total_ledger = Decimal("0")
        total_subledger = Decimal("0")
        total_variance = Decimal("0")

        for category, supported in SUBLEDGER_SUPPORTED_CATEGORIES.items():
            ledger_value = ledger_by_category.get(category, 0)
            derived = derived_by_category.get(category, {})
            subledger_value = derived.get("derivedValue") if supported else None

            if supported and subledger_value is not None:
                variance = ledger_value - subledger_value
            else:
                variance = 0  # No comparison for unsupported categories

            rows.append({
                "account": account,
                "category": category,
                "subledgerSupported": supported,
                "ledger": float(ledger_value),
                "subLedger": float(subledger_value) if subledger_value is not None else None,
                "variance": float(variance),
            })

            total_ledger += Decimal(str(ledger_value))
            if subledger_value is not None:
                total_subledger += Decimal(str(subledger_value))
            total_variance += Decimal(str(variance))

        return {
            "rows": rows,
            "totals": {
                "ledger": float(total_ledger),
                "subLedger": float(total_subledger),
                "variance": float(total_variance),
            }
        }

    def get_position_totals_by_category(
        self,
        account: str,
        valuation_dt: str,
        category: str,
        user_bank: str = "CPU"
    ) -> dict:
        """
        Get position totals for a specific category, grouped by security type.

        Returns:
        {
            "rows": [
                {
                    "account": ...,
                    "category": ...,
                    "secType": ...,
                    "issueDescription": ...,
                    "bookValue": ...,
                    "unrealized": ...,
                    "netIncome": ...,
                    "dailyVarMargin": ...,
                    "varMarginUrgl": ...,
                    "total": ...,
                    "isSubtotal": False
                },
                ...
            ],
            "grandTotal": ...
        }
        """
        positions = list(self.db[COLLECTIONS["dataSubLedgerPosition"]].find({
            "account": account,
            "valuationDt": valuation_dt,
            "userBank": user_bank,
        }))

        # Get security reference data
        securities = self._get_securities(valuation_dt, user_bank)

        rows = []
        grand_total = Decimal("0")

        # Group by security type
        by_sec_type: dict[str, list] = {}

        for pos in positions:
            asset_id = pos.get("assetId", "")
            sec_ref = securities.get(asset_id, {})
            sec_type = sec_ref.get("secType", "S")
            issue_desc = sec_ref.get("issueDescription", asset_id)

            book_value = Decimal(str(pos.get("posBookValueBase", 0) or 0))
            market_value = Decimal(str(pos.get("posMarketValueBase", 0) or 0))
            unrealized = market_value - book_value
            income = Decimal(str(pos.get("posIncomeBase", 0) or 0))
            daily_var_margin = Decimal(str(pos.get("dailyVariationMarginBase", 0) or 0))
            ltd_var_margin = Decimal(str(pos.get("ltdVariationMarginBase", 0) or 0))

            # Calculate total based on category
            if category == "Cash":
                if sec_type not in CASH_SEC_TYPES:
                    continue
                total = book_value
            elif category == "Investment Cost":
                if sec_type in CASH_SEC_TYPES or sec_type in FUTURES_SEC_TYPES:
                    continue
                total = book_value
            elif category == "Holdings Unrealized":
                if unrealized == 0:
                    continue
                total = unrealized
            elif category == "Future Margin":
                if sec_type not in FUTURES_SEC_TYPES:
                    continue
                total = daily_var_margin + ltd_var_margin
            elif category == "Interest RecPay":
                if income == 0:
                    continue
                total = income
            elif category == "Unrealized INCST":
                if unrealized == 0:
                    continue
                total = -unrealized
            else:
                continue

            if sec_type not in by_sec_type:
                by_sec_type[sec_type] = []

            by_sec_type[sec_type].append({
                "account": account,
                "category": category,
                "secType": sec_type,
                "assetId": asset_id,
                "issueDescription": issue_desc,
                "bookValue": float(book_value) if category in ["Cash", "Investment Cost"] else None,
                "unrealized": float(unrealized) if category in ["Holdings Unrealized", "Unrealized INCST"] else None,
                "netIncome": float(income) if category == "Interest RecPay" else None,
                "dailyVarMargin": float(daily_var_margin) if category == "Future Margin" else None,
                "varMarginUrgl": float(ltd_var_margin) if category == "Future Margin" else None,
                "total": float(total),
                "isSubtotal": False,
                "isGrandTotal": False,
            })

        # Build output with subtotals
        for sec_type in sorted(by_sec_type.keys()):
            sec_type_rows = by_sec_type[sec_type]
            subtotal = Decimal("0")

            for row in sec_type_rows:
                rows.append(row)
                subtotal += Decimal(str(row["total"]))

            # Add subtotal row
            rows.append({
                "account": account,
                "category": category,
                "secType": sec_type,
                "issueDescription": "Total",
                "bookValue": None,
                "unrealized": None,
                "netIncome": None,
                "dailyVarMargin": None,
                "varMarginUrgl": None,
                "total": float(subtotal),
                "isSubtotal": True,
                "isGrandTotal": False,
            })
            grand_total += subtotal

        return {
            "rows": rows,
            "grandTotal": float(grand_total),
        }

    def get_unsettled_totals_by_category(
        self,
        account: str,
        valuation_dt: str,
        category: str,
    ) -> dict:
        """
        Get unsettled transaction totals for a specific category.

        Returns:
        {
            "rows": [
                {
                    "account": ...,
                    "category": ...,
                    "transCode": ...,
                    "amount": ...,
                    "isSubtotal": False
                },
                ...
            ],
            "grandTotal": ...
        }
        """
        # Get trans codes for this category
        valid_trans_codes = [tc for tc, cat in TRANS_CODE_TO_CATEGORY.items() if cat == category]

        if not valid_trans_codes:
            return {"rows": [], "grandTotal": 0}

        transactions = list(self.db[COLLECTIONS["dataSubLedgerTrans"]].find({
            "account": account,
            "valuationDt": valuation_dt,
            "transCode": {"$in": valid_trans_codes},
            "transAmountBase": {"$exists": True, "$ne": None},
        }))

        # Group by trans code
        by_trans_code: dict[str, Decimal] = {}
        for txn in transactions:
            trans_code = txn.get("transCode", "")
            trans_amount = Decimal(str(txn.get("transAmountBase", 0) or 0))
            if trans_code not in by_trans_code:
                by_trans_code[trans_code] = Decimal("0")
            by_trans_code[trans_code] += trans_amount

        rows = []
        grand_total = Decimal("0")

        for trans_code in sorted(by_trans_code.keys()):
            amount = by_trans_code[trans_code]
            rows.append({
                "account": account,
                "category": category,
                "transCode": trans_code,
                "amount": float(amount),
                "isSubtotal": False,
                "isGrandTotal": False,
            })
            grand_total += amount

        return {
            "rows": rows,
            "grandTotal": float(grand_total),
        }

    def get_ledger_detail(
        self,
        account: str,
        valuation_dt: str,
        category: str,
        user_bank: str = "CPU"
    ) -> dict:
        """
        Get GL account detail for a specific category.

        Returns:
        {
            "rows": [
                {
                    "account": ...,
                    "bsIncst": ...,
                    "category": ...,
                    "glAccountNumber": ...,
                    "glAccountDescription": ...,
                    "endingBalance": ...
                },
                ...
            ],
            "total": ...
        }
        """
        # Get GL to category mappings
        mappings = list(self.db["refGLCategoryMapping"].find({
            "conversionCategory": category,
        }))
        gl_numbers = [m["glAccountNumber"] for m in mappings]
        mapping_by_gl = {m["glAccountNumber"]: m for m in mappings}

        if not gl_numbers:
            return {"rows": [], "total": 0}

        # Get ledger entries for these GL accounts
        ledger_entries = list(self.db[COLLECTIONS["ledger"]].find({
            "account": account,
            "valuationDt": valuation_dt,
            "userBank": user_bank,
            "glAccountNumber": {"$in": gl_numbers},
        }))

        rows = []
        total = Decimal("0")

        for entry in ledger_entries:
            gl_num = entry.get("glAccountNumber", "")
            mapping = mapping_by_gl.get(gl_num, {})
            balance = Decimal(str(entry.get("endingBalance", 0) or 0))

            rows.append({
                "account": account,
                "bsIncst": mapping.get("bsIncst", "BS"),
                "category": category,
                "glAccountNumber": gl_num,
                "glAccountDescription": mapping.get("glAccountDescription", ""),
                "endingBalance": float(balance),
            })
            total += balance

        return {
            "rows": rows,
            "total": float(total),
        }

    def _get_ledger_by_category(
        self,
        account: str,
        valuation_dt: str,
        user_bank: str = "CPU"
    ) -> dict[str, float]:
        """Get ledger values aggregated by conversion category."""
        # Get all GL to category mappings
        mappings = list(self.db["refGLCategoryMapping"].find({}))
        gl_to_category = {m["glAccountNumber"]: m["conversionCategory"] for m in mappings}

        # Get ledger entries
        ledger_entries = list(self.db[COLLECTIONS["ledger"]].find({
            "account": account,
            "valuationDt": valuation_dt,
            "userBank": user_bank,
        }))

        # Aggregate by category
        category_totals: dict[str, Decimal] = {}
        for entry in ledger_entries:
            gl_num = entry.get("glAccountNumber", "")
            category = gl_to_category.get(gl_num)
            if category:
                if category not in category_totals:
                    category_totals[category] = Decimal("0")
                category_totals[category] += Decimal(str(entry.get("endingBalance", 0) or 0))

        return {cat: float(val) for cat, val in category_totals.items()}

    def _get_security_types(self, valuation_dt: str, user_bank: str) -> dict[str, str]:
        """Get security type mapping from refSecurity."""
        securities = list(self.db[COLLECTIONS["refSecurity"]].find({
            "valuationDt": valuation_dt,
            "userBank": user_bank,
        }, {"assetId": 1, "secType": 1}))
        return {s["assetId"]: s.get("secType", "S") for s in securities}

    def _get_securities(self, valuation_dt: str, user_bank: str) -> dict[str, dict]:
        """Get full security reference data."""
        securities = list(self.db[COLLECTIONS["refSecurity"]].find({
            "valuationDt": valuation_dt,
            "userBank": user_bank,
        }))
        return {s["assetId"]: s for s in securities}
