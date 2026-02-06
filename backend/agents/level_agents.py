"""
Level Agents (L0-L3) for RECON-AI Multi-Level Reconciliation.

Per Architecture Specification §3.2.2:
- L0 NAV Agent: Initial NAV comparison and triage
- L1 GL Agent: GL account decomposition
- L2 Sub-Ledger Agent: Position-level drill-down
- L3 Transaction Agent: Transaction-level forensics
"""
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func, and_

from src.agents.base import BaseAgent
from src.agents.state import (
    AgentState, AnalysisPhase, BreakDriver,
    VarianceDetail, AgentFinding,
)
from src.models.nav_fund import NAVSummary, Ledger
from src.models.positions import SubLedgerPosition
from src.models.core_transactions import DailyTransaction
from src.models.subledger import SubLedgerTransaction
from src.models.reference_data import RefLedger, RefSecurity
from src.config.settings import settings


# =============================================================================
# L0 NAV Agent
# =============================================================================

class L0NAVAgent(BaseAgent):
    """
    L0 NAV Agent - Performs initial NAV-level comparison and triage.

    Responsibilities:
    - Calculate absolute and relative variances across all share classes
    - Classify break into primary driver categories
    - Determine materiality and priority for further drill-down
    """

    def __init__(self):
        super().__init__(
            name="L0_NAV_Agent",
            description="NAV-level comparison and break triage"
        )

    def analyze(self, state: AgentState) -> AgentState:
        state.phase = AnalysisPhase.L0_NAV_ANALYSIS
        alert = state.break_alert
        if not alert:
            return state

        # Calculate NAV variance detail
        nav_variance = VarianceDetail(
            component="NAV",
            cpu_value=alert.cpu_nav,
            incumbent_value=alert.incumbent_nav,
            variance_absolute=alert.variance_absolute,
            variance_relative=alert.variance_relative,
            is_material=abs(alert.nav_per_share_variance) > settings.MATERIALITY_THRESHOLD_ABSOLUTE,
        )
        state.nav_variance = nav_variance

        # Fetch NAV component breakdown from database
        nav_components = self._fetch_nav_components(
            alert.account, alert.share_class, alert.valuation_dt
        )

        # Classify the primary break driver using LLM
        driver = self._classify_break_driver(alert, nav_components)
        state.primary_driver = driver

        # Create L0 findings
        finding = self.create_finding(
            description=(
                f"NAV break detected for {alert.account}/{alert.share_class} "
                f"on {alert.valuation_dt}: CPU NAV={alert.cpu_nav:,.2f}, "
                f"Incumbent NAV={alert.incumbent_nav:,.2f}, "
                f"Variance={alert.variance_absolute:,.2f} ({alert.variance_relative:.4%}). "
                f"Primary driver: {driver.value}. "
                f"Material: {nav_variance.is_material}."
            ),
            evidence={
                "cpu_nav": alert.cpu_nav,
                "incumbent_nav": alert.incumbent_nav,
                "variance_absolute": alert.variance_absolute,
                "variance_relative": alert.variance_relative,
                "nav_per_share_variance": alert.nav_per_share_variance,
                "shares_outstanding": alert.shares_outstanding,
                "primary_driver": driver.value,
            },
            confidence=0.95,  # L0 is deterministic comparison
            recommended_action=f"Dispatch to L1 GL Agent with focus on {driver.value} GL accounts",
            level="L0_NAV",
        )
        state.l0_findings.append(finding)
        state.add_finding(finding)

        return state

    def _fetch_nav_components(
        self, account: str, share_class: str, valuation_dt
    ) -> list[dict]:
        """Fetch NAV component breakdown from the ledger."""
        sql = """
            SELECT l.gl_account_number, rl.gl_category, rl.gl_description,
                   l.ending_balance
            FROM ledger l
            JOIN ref_ledger rl ON l.gl_account_number = rl.gl_account_number
            WHERE l.account = :account
              AND l.share_class = :share_class
              AND l.valuation_dt = :val_dt
            ORDER BY rl.gl_category, abs(l.ending_balance) DESC
        """
        try:
            return self.query_sql_raw(sql, {
                "account": account,
                "share_class": share_class,
                "val_dt": valuation_dt,
            })
        except Exception:
            return []

    def _classify_break_driver(
        self, alert, nav_components: list[dict]
    ) -> BreakDriver:
        """Classify the NAV break into a primary driver category."""
        if not nav_components:
            # Fallback: use LLM classification based on variance characteristics
            description = (
                f"NAV variance of {alert.variance_absolute:,.2f} "
                f"({alert.variance_relative:.4%}) for fund type {alert.fund_type or 'unknown'}"
            )
            category = self.llm_classify(
                description,
                [d.value for d in BreakDriver],
            )
            try:
                return BreakDriver(category)
            except ValueError:
                return BreakDriver.MULTI_FACTOR

        # Analyze GL category contributions
        category_totals = {}
        for comp in nav_components:
            cat = comp.get("gl_category", "UNKNOWN")
            bal = float(comp.get("ending_balance", 0))
            category_totals[cat] = category_totals.get(cat, 0) + bal

        # Determine dominant category
        if abs(category_totals.get("INCOME", 0)) > abs(alert.variance_absolute * 0.5):
            return BreakDriver.INCOME_DRIVEN
        elif abs(category_totals.get("EXPENSE", 0)) > abs(alert.variance_absolute * 0.5):
            return BreakDriver.EXPENSE_DRIVEN
        elif abs(category_totals.get("ASSET", 0)) > abs(alert.variance_absolute * 0.5):
            return BreakDriver.POSITION_DRIVEN
        elif abs(category_totals.get("EQUITY", 0)) > abs(alert.variance_absolute * 0.5):
            return BreakDriver.CAPITAL_ACTIVITY_DRIVEN
        else:
            return BreakDriver.MULTI_FACTOR


# =============================================================================
# L1 GL Agent
# =============================================================================

class L1GLAgent(BaseAgent):
    """
    L1 GL Agent - Decomposes NAV break into contributing GL account variances.

    Responsibilities:
    - Map chart of accounts between CPU and Incumbent using GraphRAG
    - Identify which GL buckets drive the break
    - Quantify each bucket's contribution to total variance
    """

    def __init__(self):
        super().__init__(
            name="L1_GL_Agent",
            description="GL-level decomposition and chart-of-accounts reconciliation"
        )

    def analyze(self, state: AgentState) -> AgentState:
        state.phase = AnalysisPhase.L1_GL_ANALYSIS
        alert = state.break_alert
        if not alert:
            return state

        # Fetch GL balances for both systems
        cpu_gl = self._fetch_gl_balances(alert, system="CPU")
        incumbent_gl = self._fetch_gl_balances(alert, system="INCUMBENT")

        # Use GraphRAG to map GL accounts across systems
        gl_mappings = self._get_gl_mappings(alert.account)

        # Calculate GL-level variances
        gl_variances = self._calculate_gl_variances(cpu_gl, incumbent_gl, gl_mappings)
        state.gl_variances = gl_variances

        # Identify breaking GL buckets (material variances)
        breaking_buckets = [
            v.component for v in gl_variances if v.is_material
        ]
        state.breaking_gl_buckets = breaking_buckets

        # Create L1 findings
        for variance in gl_variances:
            if variance.is_material:
                finding = self.create_finding(
                    description=(
                        f"GL bucket '{variance.component}' shows material variance: "
                        f"CPU={variance.cpu_value:,.2f}, "
                        f"Incumbent={variance.incumbent_value:,.2f}, "
                        f"Variance={variance.variance_absolute:,.2f} "
                        f"({variance.variance_relative:.4%})"
                    ),
                    evidence={
                        "gl_bucket": variance.component,
                        "cpu_value": variance.cpu_value,
                        "incumbent_value": variance.incumbent_value,
                        "variance_absolute": variance.variance_absolute,
                        "contribution_pct": (
                            variance.variance_absolute / alert.variance_absolute * 100
                            if alert.variance_absolute != 0 else 0
                        ),
                    },
                    confidence=0.90,
                    recommended_action=f"Drill into sub-ledger positions for GL bucket '{variance.component}'",
                    level="L1_GL",
                )
                state.l1_findings.append(finding)
                state.add_finding(finding)

        # Summary finding
        summary = self.create_finding(
            description=(
                f"GL decomposition complete: {len(breaking_buckets)} breaking buckets "
                f"identified out of {len(gl_variances)} total GL categories. "
                f"Breaking buckets: {', '.join(breaking_buckets)}"
            ),
            evidence={"breaking_buckets": breaking_buckets},
            confidence=0.90,
            recommended_action="Dispatch to L2 Sub-Ledger Agent for position-level drill-down",
            level="L1_GL",
        )
        state.l1_findings.append(summary)
        state.add_finding(summary)

        return state

    def _fetch_gl_balances(self, alert, system: str = "CPU") -> list[dict]:
        """Fetch GL balances grouped by category."""
        sql = """
            SELECT rl.gl_category,
                   SUM(l.ending_balance) as total_balance,
                   COUNT(*) as account_count
            FROM ledger l
            JOIN ref_ledger rl ON l.gl_account_number = rl.gl_account_number
            WHERE l.account = :account
              AND l.share_class = :share_class
              AND l.valuation_dt = :val_dt
            GROUP BY rl.gl_category
            ORDER BY rl.gl_category
        """
        try:
            return self.query_sql_raw(sql, {
                "account": alert.account,
                "share_class": alert.share_class,
                "val_dt": alert.valuation_dt,
            })
        except Exception:
            return []

    def _get_gl_mappings(self, account: str) -> dict:
        """Use GraphRAG to get cross-system GL account mappings."""
        try:
            results = self.query_graph("""
                MATCH (cpu:GLAccount {system: 'CPU'})
                    -[:CPU_MAPS_TO]->(inc:GLAccount {system: 'INCUMBENT'})
                RETURN cpu.gl_account_number as cpu_gl,
                       cpu.gl_category as cpu_category,
                       inc.gl_account_number as inc_gl,
                       inc.gl_category as inc_category
            """)
            return {r["cpu_gl"]: r["inc_gl"] for r in results}
        except Exception:
            return {}

    def _calculate_gl_variances(
        self, cpu_gl: list[dict], incumbent_gl: list[dict],
        mappings: dict
    ) -> list[VarianceDetail]:
        """Calculate variances at the GL category level."""
        cpu_by_cat = {
            r["gl_category"]: float(r["total_balance"])
            for r in cpu_gl
        }
        inc_by_cat = {
            r["gl_category"]: float(r["total_balance"])
            for r in incumbent_gl
        }

        all_categories = set(cpu_by_cat.keys()) | set(inc_by_cat.keys())
        variances = []

        for cat in sorted(all_categories):
            cpu_val = cpu_by_cat.get(cat, 0.0)
            inc_val = inc_by_cat.get(cat, 0.0)
            var_abs = cpu_val - inc_val
            var_rel = var_abs / inc_val if inc_val != 0 else 0.0

            variances.append(VarianceDetail(
                component=cat,
                cpu_value=cpu_val,
                incumbent_value=inc_val,
                variance_absolute=var_abs,
                variance_relative=var_rel,
                is_material=abs(var_abs) > 1000,  # $1K threshold for GL level
            ))

        return variances


# =============================================================================
# L2 Sub-Ledger Agent
# =============================================================================

class L2SubLedgerAgent(BaseAgent):
    """
    L2 Sub-Ledger Agent - Position-level drill-down within breaking GL buckets.

    Responsibilities:
    - Compare security-by-security holdings and market values
    - Reconcile lot-level cost bases and unrealized gains
    - Validate accrual calculations
    - Check counterparty-level payable/receivable balances
    """

    def __init__(self):
        super().__init__(
            name="L2_SubLedger_Agent",
            description="Position-level drill-down and accrual validation"
        )

    def analyze(self, state: AgentState) -> AgentState:
        state.phase = AnalysisPhase.L2_SUBLEDGER_ANALYSIS
        alert = state.break_alert
        if not alert:
            return state

        # Fetch positions for the account
        positions = self._fetch_positions(alert)

        # Compare positions between CPU and incumbent
        position_variances = self._compare_positions(positions)
        state.position_variances = position_variances

        # Identify breaking positions (material variance)
        breaking = [
            {
                "asset_id": v.component,
                "variance_absolute": v.variance_absolute,
                "variance_relative": v.variance_relative,
                "cpu_value": v.cpu_value,
                "incumbent_value": v.incumbent_value,
            }
            for v in position_variances if v.is_material
        ]
        state.breaking_positions = breaking

        # Analyze each breaking position
        for pos in breaking:
            analysis = self._analyze_position(alert, pos)
            finding = self.create_finding(
                description=(
                    f"Position break: {pos['asset_id']} - "
                    f"Variance={pos['variance_absolute']:,.2f}. "
                    f"{analysis.get('summary', 'Further investigation needed.')}"
                ),
                evidence={
                    **pos,
                    "analysis": analysis,
                },
                confidence=analysis.get("confidence", 0.75),
                recommended_action=analysis.get(
                    "action", "Dispatch to L3 Transaction Agent"
                ),
                level="L2_SUBLEDGER",
            )
            state.l2_findings.append(finding)
            state.add_finding(finding)

            # Determine if specialist agents are needed
            specialist = analysis.get("specialist_needed")
            if specialist and specialist not in state.specialists_invoked:
                state.specialists_invoked.append(specialist)

        # Summary
        summary = self.create_finding(
            description=(
                f"Sub-ledger analysis: {len(positions)} positions compared, "
                f"{len(breaking)} show material variance. "
                f"Specialists needed: {', '.join(state.specialists_invoked) or 'None'}"
            ),
            evidence={
                "total_positions": len(positions),
                "breaking_positions": len(breaking),
                "specialists_invoked": state.specialists_invoked,
            },
            confidence=0.85,
            recommended_action="Dispatch to L3 and/or Specialist Agents",
            level="L2_SUBLEDGER",
        )
        state.l2_findings.append(summary)
        state.add_finding(summary)

        return state

    def _fetch_positions(self, alert) -> list[dict]:
        """Fetch position data for the account."""
        sql = """
            SELECT p.asset_id, p.long_short_ind,
                   p.pos_shares, p.pos_market_value_base,
                   p.pos_book_value_base, p.pos_unrealized_base,
                   p.pos_income_base, p.pos_market_price,
                   rs.sec_type, rs.issue_description, rs.day_count,
                   rs.coupon_rate, rs.asset_currency
            FROM data_sub_ledger_position p
            LEFT JOIN ref_security rs ON p.asset_id = rs.asset_id
                AND rs.valuation_dt = p.valuation_dt
            WHERE p.account = :account
              AND p.valuation_dt = :val_dt
            ORDER BY abs(p.pos_market_value_base) DESC
        """
        try:
            return self.query_sql_raw(sql, {
                "account": alert.account,
                "val_dt": alert.valuation_dt,
            })
        except Exception:
            return []

    def _compare_positions(self, positions: list[dict]) -> list[VarianceDetail]:
        """Compare positions between CPU and incumbent systems."""
        variances = []
        for pos in positions:
            mv = float(pos.get("pos_market_value_base", 0))
            # In production, incumbent data would come from a separate table/source
            # For now, create variance structure for the drill-down
            variances.append(VarianceDetail(
                component=pos.get("asset_id", ""),
                cpu_value=mv,
                incumbent_value=mv,  # Placeholder for incumbent comparison
                variance_absolute=0.0,
                variance_relative=0.0,
                is_material=False,
            ))
        return variances

    def _analyze_position(self, alert, pos: dict) -> dict:
        """Deep analysis of a single breaking position using LLM + graph."""
        asset_id = pos["asset_id"]

        # Query graph for security details and accounting rules
        try:
            sec_info = self.query_graph("""
                MATCH (s:Security {asset_id: $asset_id})
                OPTIONAL MATCH (s)-[:DENOMINATED_IN]->(c:Currency)
                OPTIONAL MATCH (st:SecurityType {sec_type: s.sec_type})
                RETURN s, c, st
            """, {"asset_id": asset_id})
        except Exception:
            sec_info = []

        # Determine if specialist is needed based on variance type
        specialist_needed = None
        if pos.get("variance_absolute", 0) != 0:
            # Check if it's a pricing issue (market value variance)
            specialist_needed = "PricingAgent"

        # Use LLM to analyze the position break
        try:
            analysis = self.llm_reason(
                system_prompt=(
                    "You are a fund accounting expert analyzing a position-level "
                    "reconciliation break. Provide a concise analysis."
                ),
                user_prompt=(
                    f"Position: {asset_id}\n"
                    f"Variance: {pos['variance_absolute']:,.2f}\n"
                    f"CPU Market Value: {pos['cpu_value']:,.2f}\n"
                    f"Incumbent Market Value: {pos['incumbent_value']:,.2f}\n"
                    f"Security Info: {sec_info}\n"
                    f"Provide: summary, likely cause, confidence (0-1), recommended action."
                ),
            )
            return {
                "summary": analysis,
                "confidence": 0.75,
                "action": "Dispatch to L3 Transaction Agent",
                "specialist_needed": specialist_needed,
            }
        except Exception:
            return {
                "summary": "LLM analysis unavailable, proceeding with rule-based analysis",
                "confidence": 0.60,
                "action": "Dispatch to L3 Transaction Agent",
                "specialist_needed": specialist_needed,
            }


# =============================================================================
# L3 Transaction Agent
# =============================================================================

class L3TransactionAgent(BaseAgent):
    """
    L3 Transaction Agent - Transaction-level forensic analysis.

    Responsibilities:
    - Transaction matching using fuzzy logic
    - Identify orphan transactions (present in one system only)
    - Detect amount differences on matched transactions
    - Analyze corporate action processing differences
    - Validate income calculation inputs
    """

    def __init__(self):
        super().__init__(
            name="L3_Transaction_Agent",
            description="Transaction-level forensics and matching"
        )

    def analyze(self, state: AgentState) -> AgentState:
        state.phase = AnalysisPhase.L3_TRANSACTION_ANALYSIS
        alert = state.break_alert
        if not alert:
            return state

        # Fetch transactions for breaking positions
        for pos in state.breaking_positions:
            asset_id = pos.get("asset_id")
            if not asset_id:
                continue

            transactions = self._fetch_transactions(alert, asset_id)
            matches, orphans, diffs = self._match_transactions(transactions)

            state.transaction_matches.extend(matches)
            state.orphan_transactions.extend(orphans)
            state.amount_differences.extend(diffs)

            # Create findings for orphan transactions
            for orphan in orphans:
                finding = self.create_finding(
                    description=(
                        f"Orphan transaction: {orphan['transaction_id']} "
                        f"({orphan['trans_code']}) for {asset_id} - "
                        f"present in {orphan['system']} only. "
                        f"Amount: {orphan['amount_base']:,.2f}, "
                        f"Trade date: {orphan['trade_date']}"
                    ),
                    evidence=orphan,
                    confidence=0.90,
                    recommended_action=self._recommend_orphan_action(orphan),
                    level="L3_TRANSACTION",
                )
                state.l3_findings.append(finding)
                state.add_finding(finding)

            # Create findings for amount differences
            for diff in diffs:
                finding = self.create_finding(
                    description=(
                        f"Amount difference on matched transaction: "
                        f"{diff['transaction_id']} ({diff['trans_code']}) - "
                        f"CPU={diff['cpu_amount']:,.2f}, "
                        f"Incumbent={diff['incumbent_amount']:,.2f}, "
                        f"Diff={diff['difference']:,.2f}"
                    ),
                    evidence=diff,
                    confidence=0.85,
                    recommended_action=self._recommend_diff_action(diff),
                    level="L3_TRANSACTION",
                )
                state.l3_findings.append(finding)
                state.add_finding(finding)

            # Check for corporate action impacts
            ca_findings = self._check_corporate_actions(alert, asset_id, transactions)
            if ca_findings:
                state.specialists_invoked.append("CorporateActionAgent")
                for ca in ca_findings:
                    state.l3_findings.append(ca)
                    state.add_finding(ca)

        # Summary
        summary = self.create_finding(
            description=(
                f"Transaction forensics complete: "
                f"{len(state.transaction_matches)} matched, "
                f"{len(state.orphan_transactions)} orphans, "
                f"{len(state.amount_differences)} amount differences."
            ),
            evidence={
                "matched_count": len(state.transaction_matches),
                "orphan_count": len(state.orphan_transactions),
                "diff_count": len(state.amount_differences),
            },
            confidence=0.85,
            recommended_action="Dispatch to Pattern Agent for historical matching",
            level="L3_TRANSACTION",
        )
        state.l3_findings.append(summary)
        state.add_finding(summary)

        return state

    def _fetch_transactions(self, alert, asset_id: str) -> list[dict]:
        """Fetch transactions for a specific security."""
        sql = """
            SELECT t.transaction_id, t.trans_code, t.trade_date, t.settle_date,
                   t.units, t.amount_local, t.amount_base, t.currency,
                   t.shares, t.traded_int_local, t.traded_int_base
            FROM data_daily_transactions t
            WHERE t.account = :account
              AND t.asset_id = :asset_id
              AND t.valuation_dt = :val_dt
            ORDER BY t.trade_date, t.trans_code
        """
        try:
            return self.query_sql_raw(sql, {
                "account": alert.account,
                "asset_id": asset_id,
                "val_dt": alert.valuation_dt,
            })
        except Exception:
            return []

    def _match_transactions(
        self, transactions: list[dict]
    ) -> tuple[list[dict], list[dict], list[dict]]:
        """
        Match transactions between CPU and incumbent using fuzzy logic.
        Match criteria: trade date, settlement date, amount, security, counterparty.
        """
        matches = []
        orphans = []
        diffs = []

        # In production, this would compare CPU vs Incumbent transaction sets
        # using fuzzy matching on (trade_date, amount, trans_code, asset_id)
        cpu_txns = [t for t in transactions]  # Placeholder split
        incumbent_txns = []  # Would come from incumbent data source

        # Mark unmatched CPU transactions as orphans
        for txn in cpu_txns:
            matched = False
            for inc_txn in incumbent_txns:
                if self._fuzzy_match(txn, inc_txn):
                    matched = True
                    match_record = {
                        "transaction_id": txn["transaction_id"],
                        "trans_code": txn["trans_code"],
                        "trade_date": str(txn.get("trade_date", "")),
                        "cpu_amount": float(txn.get("amount_base", 0)),
                        "incumbent_amount": float(inc_txn.get("amount_base", 0)),
                    }
                    diff = match_record["cpu_amount"] - match_record["incumbent_amount"]
                    if abs(diff) > 0.01:
                        match_record["difference"] = diff
                        diffs.append(match_record)
                    else:
                        matches.append(match_record)
                    break

            if not matched:
                orphans.append({
                    "transaction_id": txn["transaction_id"],
                    "trans_code": txn.get("trans_code", ""),
                    "trade_date": str(txn.get("trade_date", "")),
                    "amount_base": float(txn.get("amount_base", 0)),
                    "system": "CPU",
                })

        return matches, orphans, diffs

    def _fuzzy_match(self, txn1: dict, txn2: dict) -> bool:
        """Fuzzy match two transactions."""
        if txn1.get("trans_code") != txn2.get("trans_code"):
            return False
        if txn1.get("trade_date") != txn2.get("trade_date"):
            return False
        amt1 = float(txn1.get("amount_base", 0))
        amt2 = float(txn2.get("amount_base", 0))
        if abs(amt1 - amt2) > max(abs(amt1) * 0.001, 1.0):
            return False
        return True

    def _recommend_orphan_action(self, orphan: dict) -> str:
        """Recommend action for an orphan transaction."""
        trans_code = orphan.get("trans_code", "")
        if trans_code in ("DIV", "INT"):
            return "Check income event timing - likely booking date difference"
        elif trans_code in ("BUY", "SELL"):
            return "Verify trade feed completeness - may be missing from incumbent"
        elif trans_code in ("SPLIT", "SPINOFF", "CALL", "MAT"):
            return "Invoke Corporate Action Agent - CA processing difference likely"
        return "Manual investigation required"

    def _recommend_diff_action(self, diff: dict) -> str:
        """Recommend action for a transaction amount difference."""
        trans_code = diff.get("trans_code", "")
        if trans_code in ("DIV", "INT"):
            return "Invoke Accrual Agent - check rate/day count inputs"
        elif trans_code in ("BUY", "SELL"):
            return "Check pricing and FX rates at time of trade"
        return "Compare transaction details field by field"

    def _check_corporate_actions(
        self, alert, asset_id: str, transactions: list[dict]
    ) -> list[AgentFinding]:
        """Check for corporate action-related issues."""
        ca_codes = {"SPLIT", "SPINOFF", "CALL", "MAT", "MERGER"}
        ca_txns = [t for t in transactions if t.get("trans_code") in ca_codes]

        findings = []
        for txn in ca_txns:
            findings.append(self.create_finding(
                description=(
                    f"Corporate action detected: {txn['trans_code']} "
                    f"for {asset_id} on {txn.get('trade_date')}. "
                    f"Amount: {float(txn.get('amount_base', 0)):,.2f}. "
                    f"Requires Corporate Action Agent validation."
                ),
                evidence=txn,
                confidence=0.70,
                recommended_action="Invoke Corporate Action Specialist Agent",
                level="L3_TRANSACTION",
            ))
        return findings
