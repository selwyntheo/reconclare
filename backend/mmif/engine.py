"""
MMIF Validation Engine.

Orchestrates execution of VR-001 through VR-015 validation rules
against Eagle trial balance and MMIF return data.
"""
import uuid
from datetime import datetime

from db.mongodb import get_async_db, COLLECTIONS
from db.schemas import (
    RunStatus, ValidationResultStatus, MmifSeverity,
    MmifValidationRunDoc, MmifBreakRecordDoc, BreakState,
)
from mmif.validation_rules import MMIF_VALIDATION_RULES, evaluate_rule


class MmifValidationEngine:
    """Runs MMIF validation checks for a filing event."""

    def __init__(self):
        self.db = get_async_db()

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
            rule_def = None
            for r in MMIF_VALIDATION_RULES:
                if r["ruleId"] == rule_id:
                    rule_def = r
                    break
            if not rule_def:
                continue

            # Generate sample LHS/RHS values for demonstration
            lhs_val, rhs_val = await self._get_rule_values(
                rule_id, account, filing_period
            )

            result = evaluate_rule(
                rule_id=rule_id,
                fund_account=account,
                fund_name=fund_name,
                lhs_label=f"Eagle TB ({rule_def.get('mmifSection', 'N/A')})",
                lhs_value=lhs_val,
                rhs_label=f"MMIF Return ({rule_def.get('mmifSection', 'N/A')})",
                rhs_value=rhs_val,
            )
            results.append(result)

        return results

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
