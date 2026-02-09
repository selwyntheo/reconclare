"""
Validation Engine Service — CPU performs multi-level reconciliation checks.

Executes the validation check framework from UX Spec §2.2:
- L0: NAV to Ledger
- L1: Ledger BS to INCST, Ledger TF to Class
- L2: Position to Lot, Ledger to Subledger, Basis Lot Check

Reads canonical data from MongoDB, compares LHS vs RHS, detects breaks,
stores results and break records back to MongoDB.
"""
import uuid
import time
from datetime import datetime
from typing import Optional

from pymongo.database import Database

from db.mongodb import get_sync_db, COLLECTIONS
from db.schemas import (
    ValidationRunDoc, ValidationResultDoc, BreakRecordDoc,
    ValidationResultStatus, BreakState, RunStatus,
)


# ── Validation Check Definitions ─────────────────────────────

VALIDATION_CHECKS = [
    {
        "checkType": "NAV_TO_LEDGER",
        "name": "NAV to Ledger",
        "level": "L0",
        "description": "NAV ties to GL balance sheet net assets",
    },
    {
        "checkType": "LEDGER_BS_TO_INCST",
        "name": "Ledger BS to Income Statement",
        "level": "L1",
        "description": "Balance sheet ties to income statement",
    },
    {
        "checkType": "LEDGER_TF_TO_CLASS",
        "name": "Ledger Total Fund to Class",
        "level": "L1",
        "description": "Total fund ties to share class rollup",
    },
    {
        "checkType": "POSITION_TO_LOT",
        "name": "Position to Lot",
        "level": "L2",
        "description": "Position totals match lot-level sum",
    },
    {
        "checkType": "LEDGER_TO_SUBLEDGER",
        "name": "Ledger to Subledger",
        "level": "L2",
        "description": "GL balances match derived subledger rollup",
    },
    {
        "checkType": "BASIS_LOT_CHECK",
        "name": "Basis Lot Check",
        "level": "L2",
        "description": "Primary basis matches tax basis shares",
    },
]


def get_check_def(check_type: str) -> dict:
    for c in VALIDATION_CHECKS:
        if c["checkType"] == check_type:
            return c
    return {"checkType": check_type, "name": check_type, "level": "L0", "description": ""}


class ValidationEngine:
    """Executes validation checks against MongoDB canonical data."""

    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_sync_db()

    def run_validation(
        self,
        event_id: str,
        valuation_dt: str,
        check_suite: list[str],
        fund_accounts: Optional[list] = None,
        incumbent_event_id: Optional[str] = None,
    ) -> ValidationRunDoc:
        """
        Execute a full validation run.
        1. Create a ValidationRun document
        2. For each fund × check, execute the comparison
        3. Create BreakRecord documents for any variances
        4. Update the run with results
        """
        run_id = f"RUN-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"
        start_time = time.time()

        # Get event and its funds
        event = self.db[COLLECTIONS["events"]].find_one({"eventId": event_id})
        if not event:
            raise ValueError(f"Event {event_id} not found")

        funds = event.get("funds", [])
        if fund_accounts:
            funds = [f for f in funds if f["account"] in fund_accounts]

        # Determine incumbent event ID (use a convention: same event with different userBank)
        inc_event_id = incumbent_event_id or event_id

        # Create the run document
        run_doc = ValidationRunDoc(
            runId=run_id,
            eventId=event_id,
            valuationDt=valuation_dt,
            executionTime=datetime.utcnow().isoformat(),
            checkSuite=check_suite,
            status=RunStatus.RUNNING,
        )

        # Store the run
        self.db[COLLECTIONS["validationRuns"]].insert_one(run_doc.model_dump())

        # Log activity
        self._log_activity(
            event_id=event_id,
            msg=f"Validation run {run_id} started for {valuation_dt} with {len(check_suite)} checks across {len(funds)} funds",
            activity_type="VALIDATION_RUN",
        )

        all_results: list[ValidationResultDoc] = []
        all_breaks: list[dict] = []
        funds_passed = 0
        funds_warning = 0
        funds_failed = 0

        for fund in funds:
            fund_account = fund["account"]
            fund_name = fund.get("fundName", fund_account)
            fund_has_break = False

            for check_type in check_suite:
                check_start = time.time()
                check_def = get_check_def(check_type)

                # Execute the specific check
                result, breaks = self._execute_check(
                    check_type=check_type,
                    event_id=event_id,
                    inc_event_id=inc_event_id,
                    valuation_dt=valuation_dt,
                    fund_account=fund_account,
                    fund_name=fund_name,
                    run_id=run_id,
                )

                check_duration = int((time.time() - check_start) * 1000)
                result.durationMs = check_duration

                all_results.append(result)
                if breaks:
                    all_breaks.extend(breaks)
                    fund_has_break = True

            if fund_has_break:
                funds_failed += 1
            else:
                funds_passed += 1

        # Calculate run duration
        total_duration = int((time.time() - start_time) * 1000)

        # Update the run document
        run_doc.status = RunStatus.COMPLETE
        run_doc.durationMs = total_duration
        run_doc.fundsPassed = funds_passed
        run_doc.fundsWarning = funds_warning
        run_doc.fundsFailed = funds_failed
        run_doc.results = all_results

        self.db[COLLECTIONS["validationRuns"]].update_one(
            {"runId": run_id},
            {"$set": run_doc.model_dump()},
        )

        # Store break records
        if all_breaks:
            self.db[COLLECTIONS["breakRecords"]].insert_many(all_breaks)

        # Update fund statuses on the event
        for fund in funds:
            fund_breaks = [b for b in all_breaks if b["fundAccount"] == fund["account"]]
            new_status = "FAILED" if fund_breaks else "PASSED"
            self.db[COLLECTIONS["events"]].update_one(
                {"eventId": event_id, "funds.account": fund["account"]},
                {
                    "$set": {
                        "funds.$.status": new_status,
                        "funds.$.lastRunTimestamp": datetime.utcnow().isoformat(),
                        "funds.$.breakCount": len(fund_breaks),
                        "funds.$.aiStatus": "ANALYZING" if fund_breaks else None,
                    }
                },
            )

        # Log completion
        self._log_activity(
            event_id=event_id,
            msg=f"Validation run {run_id} complete: {funds_passed} passed, {funds_failed} failed, {len(all_breaks)} breaks detected",
            activity_type="VALIDATION_RUN",
        )

        return run_doc

    def _execute_check(
        self,
        check_type: str,
        event_id: str,
        inc_event_id: str,
        valuation_dt: str,
        fund_account: str,
        fund_name: str,
        run_id: str,
    ) -> tuple[ValidationResultDoc, list[dict]]:
        """Execute a single validation check for a fund. Returns (result, breaks)."""
        check_def = get_check_def(check_type)
        breaks: list[dict] = []

        if check_type == "NAV_TO_LEDGER":
            result, breaks = self._check_nav_to_ledger(
                event_id, inc_event_id, valuation_dt, fund_account, fund_name, run_id, check_def
            )
        elif check_type == "POSITION_TO_LOT":
            result, breaks = self._check_position_to_lot(
                event_id, valuation_dt, fund_account, fund_name, run_id, check_def
            )
        elif check_type == "LEDGER_TO_SUBLEDGER":
            result, breaks = self._check_ledger_to_subledger(
                event_id, valuation_dt, fund_account, fund_name, run_id, check_def
            )
        elif check_type == "LEDGER_BS_TO_INCST":
            result, breaks = self._check_ledger_bs_incst(
                event_id, valuation_dt, fund_account, fund_name, run_id, check_def
            )
        elif check_type == "LEDGER_TF_TO_CLASS":
            result, breaks = self._check_ledger_tf_class(
                event_id, valuation_dt, fund_account, fund_name, run_id, check_def
            )
        elif check_type == "BASIS_LOT_CHECK":
            result, breaks = self._check_basis_lot(
                event_id, valuation_dt, fund_account, fund_name, run_id, check_def
            )
        else:
            result = ValidationResultDoc(
                checkType=check_type,
                checkName=check_def["name"],
                level=check_def["level"],
                fundAccount=fund_account,
                fundName=fund_name,
                status=ValidationResultStatus.PASSED,
            )

        return result, breaks

    # ── L0: NAV to Ledger ────────────────────────────────────

    def _check_nav_to_ledger(
        self, event_id, inc_event_id, valuation_dt, fund_account, fund_name, run_id, check_def
    ) -> tuple[ValidationResultDoc, list[dict]]:
        """
        Compare NAV net assets (from navSummary) against sum of ledger ending balances.
        Also compare CPU vs Incumbent NAV if incumbent data exists.
        """
        breaks = []

        # Get CPU NAV summary
        cpu_navs = list(self.db[COLLECTIONS["navSummary"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
            "userBank": "CPU",
        }))

        # Get CPU ledger totals
        cpu_ledger = list(self.db[COLLECTIONS["ledger"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
            "userBank": "CPU",
        }))

        # Get Incumbent NAV summary
        inc_navs = list(self.db[COLLECTIONS["navSummary"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
            "userBank": "INCUMBENT",
        }))

        lhs_count = len(cpu_navs)
        rhs_count = len(cpu_ledger)
        total_variance = 0.0
        max_variance = 0.0
        matched = 0

        if cpu_navs:
            cpu_net_assets = sum(n.get("netAssets", 0) for n in cpu_navs)
            ledger_net = sum(l.get("endingBalance", 0) for l in cpu_ledger)

            nav_ledger_var = abs(cpu_net_assets - ledger_net)
            if nav_ledger_var > 0.01:
                brk = self._make_break(
                    run_id=run_id,
                    fund_account=fund_account,
                    fund_name=fund_name,
                    check_type="NAV_TO_LEDGER",
                    level="L0",
                    lhs_value=cpu_net_assets,
                    rhs_value=ledger_net,
                    variance=cpu_net_assets - ledger_net,
                    gl_category="Net Assets",
                )
                breaks.append(brk)
                total_variance += abs(cpu_net_assets - ledger_net)
                max_variance = max(max_variance, abs(cpu_net_assets - ledger_net))
            else:
                matched += 1

            # Cross-system comparison: CPU NAV vs Incumbent NAV
            if inc_navs:
                inc_net_assets = sum(n.get("netAssets", 0) for n in inc_navs)
                cross_var = cpu_net_assets - inc_net_assets
                if abs(cross_var) > 0.01:
                    brk = self._make_break(
                        run_id=run_id,
                        fund_account=fund_account,
                        fund_name=fund_name,
                        check_type="NAV_TO_LEDGER",
                        level="L0",
                        lhs_value=cpu_net_assets,
                        rhs_value=inc_net_assets,
                        variance=cross_var,
                        gl_category="NAV Cross-System",
                    )
                    breaks.append(brk)
                    total_variance += abs(cross_var)
                    max_variance = max(max_variance, abs(cross_var))
                else:
                    matched += 1
        else:
            matched = max(1, rhs_count)

        status = (
            ValidationResultStatus.FAILED if breaks
            else ValidationResultStatus.PASSED
        )

        result = ValidationResultDoc(
            checkType="NAV_TO_LEDGER",
            checkName=check_def["name"],
            level=check_def["level"],
            fundAccount=fund_account,
            fundName=fund_name,
            status=status,
            lhsRowCount=lhs_count,
            rhsRowCount=rhs_count,
            matchedCount=matched,
            breakCount=len(breaks),
            totalVariance=total_variance,
            maxVariance=max_variance,
        )
        return result, breaks

    # ── L1: Ledger BS to Income Statement ────────────────────

    def _check_ledger_bs_incst(
        self, event_id, valuation_dt, fund_account, fund_name, run_id, check_def
    ) -> tuple[ValidationResultDoc, list[dict]]:
        """Check that balance sheet categories tie to income statement."""
        breaks = []

        ledger_entries = list(self.db[COLLECTIONS["ledger"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
            "userBank": "CPU",
        }))

        # Get GL category info
        gl_refs = {r["glAccountNumber"]: r for r in self.db[COLLECTIONS["refLedger"]].find({})}

        bs_total = 0.0
        incst_total = 0.0
        for entry in ledger_entries:
            gl_num = entry.get("glAccountNumber", "")
            ref = gl_refs.get(gl_num, {})
            cat = ref.get("glCategory", "")
            bal = entry.get("endingBalance", 0)
            if cat in ("ASSET", "LIABILITY", "EQUITY"):
                bs_total += bal
            elif cat in ("INCOME", "EXPENSE"):
                incst_total += bal

        variance = bs_total - incst_total
        lhs_count = len(ledger_entries)

        if abs(variance) > 0.01 and lhs_count > 0:
            brk = self._make_break(
                run_id=run_id,
                fund_account=fund_account,
                fund_name=fund_name,
                check_type="LEDGER_BS_TO_INCST",
                level="L1",
                lhs_value=bs_total,
                rhs_value=incst_total,
                variance=variance,
                gl_category="BS vs INCST",
            )
            breaks.append(brk)

        status = ValidationResultStatus.FAILED if breaks else ValidationResultStatus.PASSED
        return ValidationResultDoc(
            checkType="LEDGER_BS_TO_INCST",
            checkName=check_def["name"],
            level=check_def["level"],
            fundAccount=fund_account,
            fundName=fund_name,
            status=status,
            lhsRowCount=lhs_count,
            rhsRowCount=lhs_count,
            matchedCount=lhs_count if not breaks else 0,
            breakCount=len(breaks),
            totalVariance=abs(variance) if breaks else 0,
        ), breaks

    # ── L1: Ledger Total Fund to Class ───────────────────────

    def _check_ledger_tf_class(
        self, event_id, valuation_dt, fund_account, fund_name, run_id, check_def
    ) -> tuple[ValidationResultDoc, list[dict]]:
        """Check total fund ledger ties to share class rollup."""
        breaks = []

        # Get all share classes for this fund
        nav_docs = list(self.db[COLLECTIONS["navSummary"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
            "userBank": "CPU",
        }))

        total_net_assets = sum(n.get("netAssets", 0) for n in nav_docs)
        class_count = len(nav_docs)

        # Get ledger total
        ledger_entries = list(self.db[COLLECTIONS["ledger"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
            "userBank": "CPU",
        }))
        ledger_total = sum(l.get("endingBalance", 0) for l in ledger_entries)

        variance = total_net_assets - ledger_total
        if abs(variance) > 0.01 and class_count > 0:
            brk = self._make_break(
                run_id=run_id,
                fund_account=fund_account,
                fund_name=fund_name,
                check_type="LEDGER_TF_TO_CLASS",
                level="L1",
                lhs_value=total_net_assets,
                rhs_value=ledger_total,
                variance=variance,
                gl_category="TF vs Class",
            )
            breaks.append(brk)

        status = ValidationResultStatus.FAILED if breaks else ValidationResultStatus.PASSED
        return ValidationResultDoc(
            checkType="LEDGER_TF_TO_CLASS",
            checkName=check_def["name"],
            level=check_def["level"],
            fundAccount=fund_account,
            fundName=fund_name,
            status=status,
            lhsRowCount=class_count,
            rhsRowCount=len(ledger_entries),
            matchedCount=class_count if not breaks else 0,
            breakCount=len(breaks),
            totalVariance=abs(variance) if breaks else 0,
        ), breaks

    # ── L2: Position to Lot ──────────────────────────────────

    def _check_position_to_lot(
        self, event_id, valuation_dt, fund_account, fund_name, run_id, check_def
    ) -> tuple[ValidationResultDoc, list[dict]]:
        """Compare position totals to lot-level sums."""
        breaks = []

        positions = list(self.db[COLLECTIONS["dataSubLedgerPosition"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
        }))

        lots = list(self.db[COLLECTIONS["dataSubLedgerTrans"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
        }))

        # Group lots by assetId
        lot_by_asset: dict[str, float] = {}
        for lot in lots:
            aid = lot.get("assetId", "")
            lot_by_asset[aid] = lot_by_asset.get(aid, 0) + lot.get("shares", 0)

        matched = 0
        for pos in positions:
            aid = pos.get("assetId", "")
            pos_shares = pos.get("posShares", 0)
            lot_shares = lot_by_asset.get(aid, 0)
            variance = pos_shares - lot_shares

            if abs(variance) > 0.000001:
                # Get security info for the break
                sec = self.db[COLLECTIONS["refSecurity"]].find_one({"assetId": aid})
                sec_name = sec.get("issueDescription", aid) if sec else aid

                brk = self._make_break(
                    run_id=run_id,
                    fund_account=fund_account,
                    fund_name=fund_name,
                    check_type="POSITION_TO_LOT",
                    level="L2",
                    lhs_value=pos_shares,
                    rhs_value=lot_shares,
                    variance=variance,
                    security_id=aid,
                    gl_category="Position vs Lot",
                )
                breaks.append(brk)
            else:
                matched += 1

        total_var = sum(abs(b["variance"]) for b in breaks)
        max_var = max((abs(b["variance"]) for b in breaks), default=0)

        status = ValidationResultStatus.FAILED if breaks else ValidationResultStatus.PASSED
        return ValidationResultDoc(
            checkType="POSITION_TO_LOT",
            checkName=check_def["name"],
            level=check_def["level"],
            fundAccount=fund_account,
            fundName=fund_name,
            status=status,
            lhsRowCount=len(positions),
            rhsRowCount=len(lots),
            matchedCount=matched,
            breakCount=len(breaks),
            totalVariance=total_var,
            maxVariance=max_var,
        ), breaks

    # ── L2: Ledger to Subledger ──────────────────────────────

    def _check_ledger_to_subledger(
        self, event_id, valuation_dt, fund_account, fund_name, run_id, check_def
    ) -> tuple[ValidationResultDoc, list[dict]]:
        """Compare GL balances to derived subledger rollup."""
        breaks = []

        ledger_entries = list(self.db[COLLECTIONS["ledger"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
            "userBank": "CPU",
        }))

        positions = list(self.db[COLLECTIONS["dataSubLedgerPosition"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
        }))

        # Derive subledger rollup: sum of position market values
        subledger_mv = sum(p.get("posMarketValueBase", 0) for p in positions)
        subledger_income = sum(p.get("posIncomeBase", 0) or 0 for p in positions)

        # Get GL refs
        gl_refs = {r["glAccountNumber"]: r for r in self.db[COLLECTIONS["refLedger"]].find({})}

        asset_gl_total = 0.0
        income_gl_total = 0.0
        for entry in ledger_entries:
            gl_num = entry.get("glAccountNumber", "")
            ref = gl_refs.get(gl_num, {})
            cat = ref.get("glCategory", "")
            bal = entry.get("endingBalance", 0)
            if cat == "ASSET":
                asset_gl_total += bal
            elif cat == "INCOME":
                income_gl_total += bal

        # Compare asset GL to position market values
        asset_var = asset_gl_total - subledger_mv
        if abs(asset_var) > 0.01 and (asset_gl_total != 0 or subledger_mv != 0):
            brk = self._make_break(
                run_id=run_id,
                fund_account=fund_account,
                fund_name=fund_name,
                check_type="LEDGER_TO_SUBLEDGER",
                level="L2",
                lhs_value=asset_gl_total,
                rhs_value=subledger_mv,
                variance=asset_var,
                gl_category="Investment at Market",
            )
            breaks.append(brk)

        # Compare income GL to position accrued income
        income_var = income_gl_total - subledger_income
        if abs(income_var) > 0.01 and (income_gl_total != 0 or subledger_income != 0):
            brk = self._make_break(
                run_id=run_id,
                fund_account=fund_account,
                fund_name=fund_name,
                check_type="LEDGER_TO_SUBLEDGER",
                level="L2",
                lhs_value=income_gl_total,
                rhs_value=subledger_income,
                variance=income_var,
                gl_category="Accrued Income",
            )
            breaks.append(brk)

        total_var = sum(abs(b["variance"]) for b in breaks)
        status = ValidationResultStatus.FAILED if breaks else ValidationResultStatus.PASSED
        return ValidationResultDoc(
            checkType="LEDGER_TO_SUBLEDGER",
            checkName=check_def["name"],
            level=check_def["level"],
            fundAccount=fund_account,
            fundName=fund_name,
            status=status,
            lhsRowCount=len(ledger_entries),
            rhsRowCount=len(positions),
            matchedCount=len(ledger_entries) if not breaks else 0,
            breakCount=len(breaks),
            totalVariance=total_var,
        ), breaks

    # ── L2: Basis Lot Check ──────────────────────────────────

    def _check_basis_lot(
        self, event_id, valuation_dt, fund_account, fund_name, run_id, check_def
    ) -> tuple[ValidationResultDoc, list[dict]]:
        """Check primary basis matches tax basis shares."""
        breaks = []

        lots = list(self.db[COLLECTIONS["dataSubLedgerTrans"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
        }))

        # Group by assetId and acctBasis
        basis_groups: dict[str, dict[str, float]] = {}
        for lot in lots:
            aid = lot.get("assetId", "")
            basis = lot.get("acctBasis", "PRIMARY")
            if aid not in basis_groups:
                basis_groups[aid] = {}
            basis_groups[aid][basis] = basis_groups[aid].get(basis, 0) + lot.get("shares", 0)

        matched = 0
        for aid, bases in basis_groups.items():
            if len(bases) > 1:
                primary = bases.get("PRIMARY", bases.get("GAAP", 0))
                tax = bases.get("TAX", 0)
                if tax != 0 and abs(primary - tax) > 0.000001:
                    brk = self._make_break(
                        run_id=run_id,
                        fund_account=fund_account,
                        fund_name=fund_name,
                        check_type="BASIS_LOT_CHECK",
                        level="L2",
                        lhs_value=primary,
                        rhs_value=tax,
                        variance=primary - tax,
                        security_id=aid,
                        gl_category="Basis Mismatch",
                    )
                    breaks.append(brk)
                else:
                    matched += 1
            else:
                matched += 1

        total_var = sum(abs(b["variance"]) for b in breaks)
        status = ValidationResultStatus.FAILED if breaks else ValidationResultStatus.PASSED
        return ValidationResultDoc(
            checkType="BASIS_LOT_CHECK",
            checkName=check_def["name"],
            level=check_def["level"],
            fundAccount=fund_account,
            fundName=fund_name,
            status=status,
            lhsRowCount=len(lots),
            rhsRowCount=len(lots),
            matchedCount=matched,
            breakCount=len(breaks),
            totalVariance=total_var,
        ), breaks

    # ── Helpers ───────────────────────────────────────────────

    def _make_break(
        self,
        run_id: str,
        fund_account: str,
        fund_name: str,
        check_type: str,
        level: str,
        lhs_value: float,
        rhs_value: float,
        variance: float,
        gl_category: str = "",
        security_id: str = "",
    ) -> dict:
        """Create a break record dict."""
        break_id = f"BRK-{uuid.uuid4().hex[:8].upper()}"
        return BreakRecordDoc(
            breakId=break_id,
            validationRunId=run_id,
            fundAccount=fund_account,
            fundName=fund_name,
            checkType=check_type,
            level=level,
            lhsValue=round(lhs_value, 2),
            rhsValue=round(rhs_value, 2),
            variance=round(variance, 2),
            state=BreakState.DETECTED,
            glCategory=gl_category,
            securityId=security_id,
        ).model_dump()

    def _log_activity(self, event_id: str, msg: str, activity_type: str):
        """Log an activity feed item."""
        self.db[COLLECTIONS["activityFeed"]].insert_one({
            "id": f"act-{uuid.uuid4().hex[:8]}",
            "type": activity_type,
            "message": msg,
            "eventId": event_id,
            "timestamp": datetime.utcnow().isoformat(),
            "userId": "system",
            "userName": "System",
        })
