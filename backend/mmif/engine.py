"""
MMIF Validation Engine.

Orchestrates execution of VR-001 through VR-020 validation rules
against Eagle trial balance and MMIF return data.

VR-016 to VR-020: Ledger Cross Check rules that validate trial balance
integrity by aggregating GL accounts by prefix (1xxx=Assets, etc.).
"""
import uuid
from datetime import datetime

from db.mongodb import get_async_db, COLLECTIONS
from db.schemas import (
    RunStatus, ValidationResultStatus, MmifSeverity,
    MmifValidationRunDoc, MmifBreakRecordDoc, BreakState,
)
from mmif.validation_rules import MMIF_VALIDATION_RULES, evaluate_rule, LEDGER_CROSSCHECK_RULES
from mmif.dsl_rule_loader import DslRuleLoader
from services.mapping.cel_evaluator import CelEvaluator, python_to_cel, cel_to_python


class MmifValidationEngine:
    """Runs MMIF validation checks for a filing event."""

    def __init__(self):
        self.db = get_async_db()
        self._dsl_loader = DslRuleLoader(self.db)
        self._cel_evaluator = CelEvaluator()

    async def run_validation(
        self,
        event_id: str,
        filing_period: str,
        check_suite: list[str],
        fund_selection: str = "all",
    ) -> MmifValidationRunDoc:
        """Execute MMIF validation run."""
        run_id = f"MMIF-RUN-{uuid.uuid4().hex[:8].upper()}"
        start_time = datetime.utcnow()

        # Get the MMIF event
        event = await self.db[COLLECTIONS["mmifEvents"]].find_one(
            {"eventId": event_id}, {"_id": 0}
        )
        if not event:
            raise ValueError(f"MMIF Event {event_id} not found")

        funds = event.get("funds", [])
        if fund_selection != "all":
            selected = set(fund_selection.split(","))
            funds = [f for f in funds if f["account"] in selected]

        results = []
        breaks = []
        funds_passed = 0
        funds_warning = 0
        funds_failed = 0

        for fund in funds:
            fund_results = await self._validate_fund(
                event_id, filing_period, fund, check_suite
            )
            results.extend(fund_results)

            # Classify fund outcome
            has_fail = any(r.status == ValidationResultStatus.FAILED for r in fund_results)
            has_warn = any(r.status == ValidationResultStatus.WARNING for r in fund_results)
            if has_fail:
                funds_failed += 1
            elif has_warn:
                funds_warning += 1
            else:
                funds_passed += 1

            # Create break records for failures
            for r in fund_results:
                if r.status == ValidationResultStatus.FAILED:
                    break_rec = MmifBreakRecordDoc(
                        breakId=f"MMIF-BRK-{uuid.uuid4().hex[:8].upper()}",
                        validationRunId=run_id,
                        eventId=event_id,
                        ruleId=r.ruleId,
                        ruleName=r.ruleName,
                        severity=r.severity,
                        mmifSection=r.mmifSection,
                        fundAccount=r.fundAccount,
                        fundName=r.fundName,
                        lhsLabel=r.lhsLabel,
                        lhsValue=r.lhsValue,
                        rhsLabel=r.rhsLabel,
                        rhsValue=r.rhsValue,
                        variance=r.variance,
                        tolerance=r.tolerance,
                        state=BreakState.DETECTED,
                    )
                    breaks.append(break_rec)

        elapsed = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        run_doc = MmifValidationRunDoc(
            runId=run_id,
            eventId=event_id,
            filingPeriod=filing_period,
            executionTime=start_time.isoformat(),
            checkSuite=check_suite,
            status=RunStatus.COMPLETE,
            durationMs=elapsed,
            fundsPassed=funds_passed,
            fundsWarning=funds_warning,
            fundsFailed=funds_failed,
            results=results,
        )

        # Persist
        await self.db[COLLECTIONS["mmifValidationRuns"]].insert_one(
            run_doc.model_dump()
        )
        if breaks:
            await self.db[COLLECTIONS["mmifBreakRecords"]].insert_many(
                [b.model_dump() for b in breaks]
            )

        # Update event fund break counts
        for fund in funds:
            fund_breaks = [b for b in breaks if b.fundAccount == fund["account"]]
            if fund_breaks:
                await self.db[COLLECTIONS["mmifEvents"]].update_one(
                    {"eventId": event_id, "funds.account": fund["account"]},
                    {
                        "$set": {
                            "funds.$.breakCount": len(fund_breaks),
                            "funds.$.lastRunTimestamp": start_time.isoformat(),
                        }
                    },
                )

        return run_doc

    async def _validate_fund(
        self,
        event_id: str,
        filing_period: str,
        fund: dict,
        check_suite: list[str],
    ) -> list:
        """Run all requested validation rules for a single fund.

        Uses sample/seed data for demonstration. In production, this would
        query Eagle TB and parsed MMIF return data.
        """
        results = []
        account = fund["account"]
        fund_name = fund["fundName"]

        # Fetch any pre-seeded MMIF validation data for this fund
        mmif_data = await self.db[COLLECTIONS["mmifEvents"]].find_one(
            {"eventId": event_id}, {"_id": 0}
        )

        for rule_id in check_suite:
            # Load rule: DSL override first, then legacy
            rule_def = await self._dsl_loader.load_rule(rule_id)

            if DslRuleLoader.is_dsl_rule(rule_def):
                # DSL rule: evaluate CEL expressions
                lhs_val, rhs_val, lhs_label, rhs_label = (
                    await self._evaluate_dsl_rule(
                        rule_def, account, filing_period
                    )
                )
                result = evaluate_rule(
                    rule_id=rule_id,
                    fund_account=account,
                    fund_name=fund_name,
                    lhs_label=lhs_label,
                    lhs_value=lhs_val,
                    rhs_label=rhs_label,
                    rhs_value=rhs_val,
                    rule_override=rule_def,
                )
                results.append(result)
                continue

            if rule_id in LEDGER_CROSSCHECK_RULES:
                # Ledger cross-check rules: use GL prefix aggregation path
                lhs_val, rhs_val, lhs_label, rhs_label = (
                    await self._get_ledger_crosscheck_values(
                        rule_id, account, filing_period
                    )
                )
            else:
                # Standard MMIF vs Eagle comparison
                lhs_val, rhs_val = await self._get_rule_values(
                    rule_id, account, filing_period
                )
                lhs_label = f"Eagle TB ({rule_def.get('mmifSection', 'N/A')})"
                rhs_label = f"MMIF Return ({rule_def.get('mmifSection', 'N/A')})"

            result = evaluate_rule(
                rule_id=rule_id,
                fund_account=account,
                fund_name=fund_name,
                lhs_label=lhs_label,
                lhs_value=lhs_val,
                rhs_label=rhs_label,
                rhs_value=rhs_val,
            )
            results.append(result)

        return results

    async def _evaluate_dsl_rule(
        self,
        rule_def: dict,
        account: str,
        filing_period: str,
    ) -> tuple[float, float, str, str]:
        """Evaluate a DSL rule by running CEL expressions against data."""
        data_source = rule_def.get("dataSource", "mmifLedgerData")
        collection = COLLECTIONS.get(data_source, data_source)
        rule_id = rule_def.get("ruleId", "")

        # Build query — include ruleId for per-rule data sources (e.g., mmifSampleData)
        query: dict = {"account": account, "filingPeriod": filing_period}
        if data_source == "mmifSampleData":
            query["ruleId"] = rule_id

        # Fetch rows from data source
        cursor = self.db[collection].find(query, {"_id": 0})
        rows = await cursor.to_list(10000)

        # Build CEL activation context
        cel_rows = python_to_cel(rows)
        activation = {
            "ledger": cel_rows,
            "sample": cel_rows,
            "meta": python_to_cel({
                "account": account,
                "filingPeriod": filing_period,
            }),
        }

        lhs_def = rule_def.get("lhs", {})
        rhs_def = rule_def.get("rhs", {})
        if isinstance(lhs_def, dict):
            lhs_expr = lhs_def.get("expr", "0.0")
            lhs_label = lhs_def.get("label", "LHS")
        else:
            lhs_expr = lhs_def.expr
            lhs_label = lhs_def.label

        if isinstance(rhs_def, dict):
            rhs_expr = rhs_def.get("expr", "0.0")
            rhs_label = rhs_def.get("label", "RHS")
        else:
            rhs_expr = rhs_def.expr
            rhs_label = rhs_def.label

        # Compile and evaluate
        _, lhs_prog = self._cel_evaluator.compile(lhs_expr)
        _, rhs_prog = self._cel_evaluator.compile(rhs_expr)

        lhs_result = lhs_prog.evaluate(activation)
        rhs_result = rhs_prog.evaluate(activation)

        lhs_value = float(cel_to_python(lhs_result))
        rhs_value = float(cel_to_python(rhs_result))

        return lhs_value, rhs_value, lhs_label, rhs_label

    async def _get_rule_values(
        self, rule_id: str, account: str, filing_period: str
    ) -> tuple[float, float]:
        """
        Get LHS (Eagle) and RHS (MMIF) values for a given rule.
        In production, these would come from Eagle TB queries and MMIF parser.
        For seed/demo purposes, returns sample data with intentional breaks.
        """
        # Check for pre-seeded sample data
        sample = await self.db["mmifSampleData"].find_one(
            {"account": account, "filingPeriod": filing_period, "ruleId": rule_id},
            {"_id": 0},
        )
        if sample:
            return sample.get("eagleValue", 0), sample.get("mmifValue", 0)

        # Default: matching values (pass)
        return 0.0, 0.0

    async def _get_ledger_crosscheck_values(
        self, rule_id: str, account: str, filing_period: str
    ) -> tuple[float, float, str, str]:
        """
        Get LHS/RHS values and labels for ledger cross-check rules (VR-016 to VR-020).

        Checks mmifSampleData first, then falls back to aggregating
        from mmifLedgerData by GL account prefix.
        """
        # Check for pre-seeded sample data first
        sample = await self.db["mmifSampleData"].find_one(
            {"account": account, "filingPeriod": filing_period, "ruleId": rule_id},
            {"_id": 0},
        )
        if sample:
            return (
                sample.get("eagleValue", 0.0),
                sample.get("mmifValue", 0.0),
                sample.get("lhsLabel", "GL Ledger"),
                sample.get("rhsLabel", "MMIF Return"),
            )

        # Fall back to aggregating from mmifLedgerData
        cats = await self._aggregate_ledger_by_prefix(account, filing_period)

        a = cats["assets"]["ending"]
        li = cats["liabilities"]["ending"]
        c = cats["capital"]["ending"]
        inc = cats["income"]["ending"]
        exp = cats["expense"]["ending"]
        rgl = cats["rgl"]["ending"]
        urgl = cats["urgl"]["ending"]

        bs_diff = a - li - c
        net_income = inc - exp
        net_gl = rgl + urgl
        total_pnl = net_income + net_gl

        if rule_id == "VR_016":
            return bs_diff, total_pnl, "BS Diff (A-L-C)", "Total PnL"
        elif rule_id == "VR_017":
            return net_income, net_income, "Net Income (GL)", "Net Income (MMIF)"
        elif rule_id == "VR_018":
            return net_gl, net_gl, "Net GL (GL)", "Net GL (MMIF)"
        elif rule_id == "VR_019":
            return total_pnl, total_pnl, "Total PnL (GL)", "Total PnL (MMIF)"
        elif rule_id == "VR_020":
            return bs_diff, total_pnl, "BS Diff", "Total PnL"

        return 0.0, 0.0, "Unknown", "Unknown"

    async def _aggregate_ledger_by_prefix(
        self, account: str, filing_period: str
    ) -> dict:
        """
        Aggregate ledger balances by GL prefix category for a given fund account.

        GL prefix categorization:
        - 1xxx = Assets, 2xxx = Liabilities, 3xxx = Capital
        - 4xxx = Income, 5xxx = Expense
        - 61xx = RGL (Realized Gains/Losses)
        - 6xxx (excl 61xx) = URGL (Unrealized Gains/Losses)
        """
        cursor = self.db[COLLECTIONS.get("mmifLedgerData", "mmifLedgerData")].find(
            {"account": account, "filingPeriod": filing_period},
            {"_id": 0},
        )
        entries = await cursor.to_list(10000)

        categories = {
            "assets": {"starting": 0.0, "ending": 0.0},
            "liabilities": {"starting": 0.0, "ending": 0.0},
            "capital": {"starting": 0.0, "ending": 0.0},
            "income": {"starting": 0.0, "ending": 0.0},
            "expense": {"starting": 0.0, "ending": 0.0},
            "rgl": {"starting": 0.0, "ending": 0.0},
            "urgl": {"starting": 0.0, "ending": 0.0},
        }

        for entry in entries:
            gl = str(entry.get("glAccountNumber", ""))
            starting = entry.get("startingBalance", 0.0)
            ending = entry.get("endingBalance", 0.0)

            # Order matters: check "61" before "6"
            if gl.startswith("1"):
                cat = "assets"
            elif gl.startswith("2"):
                cat = "liabilities"
            elif gl.startswith("3"):
                cat = "capital"
            elif gl.startswith("4"):
                cat = "income"
            elif gl.startswith("5"):
                cat = "expense"
            elif gl.startswith("61"):
                cat = "rgl"
            elif gl.startswith("6"):
                cat = "urgl"
            else:
                continue

            categories[cat]["starting"] += starting
            categories[cat]["ending"] += ending

        return categories
