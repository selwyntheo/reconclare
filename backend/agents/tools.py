"""
Agent Tools for RECON-AI.

Structured tool definitions that agents use for deterministic operations:
- Database query tools (SQL)
- Graph query tools (Cypher)
- Calculation tools (NAV, accrual, amortization, variation margin)
- Report generation tools
"""
from datetime import date
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from src.config.settings import settings
from src.graph.neo4j_client import Neo4jClient


# =============================================================================
# Database Query Tools
# =============================================================================

class DatabaseTools:
    """SQL query tools for accessing the canonical data model."""

    def __init__(self):
        self._engine = create_engine(settings.postgres_url)
        self._session_factory = sessionmaker(bind=self._engine)

    def _query(self, sql: str, params: dict = None) -> list[dict]:
        with self._session_factory() as session:
            result = session.execute(text(sql), params or {})
            columns = result.keys()
            return [dict(zip(columns, row)) for row in result.fetchall()]

    def get_nav_comparison(
        self, account: str, share_class: str, valuation_dt: date
    ) -> dict:
        """Get NAV data for comparison between CPU and incumbent."""
        rows = self._query("""
            SELECT nav, net_assets, shares_outstanding, settled_shares,
                   daily_distribution, daily_yield
            FROM nav_summary
            WHERE account = :account
              AND share_class = :share_class
              AND valuation_dt = :val_dt
        """, {"account": account, "share_class": share_class, "val_dt": valuation_dt})
        return rows[0] if rows else {}

    def get_gl_trial_balance(
        self, account: str, valuation_dt: date
    ) -> list[dict]:
        """Get GL trial balance with category breakdown."""
        return self._query("""
            SELECT l.gl_account_number, rl.gl_description, rl.gl_category,
                   l.ending_balance, l.share_class
            FROM ledger l
            JOIN ref_ledger rl ON l.gl_account_number = rl.gl_account_number
            WHERE l.account = :account AND l.valuation_dt = :val_dt
            ORDER BY rl.gl_category, abs(l.ending_balance) DESC
        """, {"account": account, "val_dt": valuation_dt})

    def get_positions(
        self, account: str, valuation_dt: date,
        asset_id: Optional[str] = None,
    ) -> list[dict]:
        """Get position data with security details."""
        sql = """
            SELECT p.asset_id, p.long_short_ind, p.pos_shares,
                   p.pos_market_value_base, p.pos_book_value_base,
                   p.pos_unrealized_base, p.pos_income_base,
                   p.pos_market_price, p.pos_income_currency,
                   rs.sec_type, rs.issue_description, rs.day_count,
                   rs.coupon_rate, rs.asset_currency, rs.maturity_dt
            FROM data_sub_ledger_position p
            LEFT JOIN ref_security rs ON p.asset_id = rs.asset_id
                AND rs.valuation_dt = p.valuation_dt
                AND rs.user_bank = p.user_bank
            WHERE p.account = :account AND p.valuation_dt = :val_dt
        """
        params: dict[str, Any] = {"account": account, "val_dt": valuation_dt}
        if asset_id:
            sql += " AND p.asset_id = :asset_id"
            params["asset_id"] = asset_id
        sql += " ORDER BY abs(p.pos_market_value_base) DESC"
        return self._query(sql, params)

    def get_transactions(
        self, account: str, valuation_dt: date,
        asset_id: Optional[str] = None,
        trans_code: Optional[str] = None,
    ) -> list[dict]:
        """Get transactions with optional filters."""
        sql = """
            SELECT t.transaction_id, t.trans_code, t.trade_date, t.settle_date,
                   t.units, t.amount_local, t.amount_base, t.currency,
                   t.asset_id, t.shares, t.traded_int_local, t.traded_int_base,
                   t.orig_cost_local, t.orig_cost_base,
                   t.book_value_local, t.book_value_base
            FROM data_daily_transactions t
            WHERE t.account = :account AND t.valuation_dt = :val_dt
        """
        params: dict[str, Any] = {"account": account, "val_dt": valuation_dt}
        if asset_id:
            sql += " AND t.asset_id = :asset_id"
            params["asset_id"] = asset_id
        if trans_code:
            sql += " AND t.trans_code = :trans_code"
            params["trans_code"] = trans_code
        sql += " ORDER BY t.trade_date, t.trans_code"
        return self._query(sql, params)

    def get_lot_details(
        self, account: str, valuation_dt: date, asset_id: str
    ) -> list[dict]:
        """Get lot-level details for a security."""
        return self._query("""
            SELECT transaction_id, shares, orig_cost_local, orig_cost_base,
                   book_value_local, book_value_base, market_value_local,
                   market_value_base, lot_trade_date, lot_settle_date,
                   orig_trade_price, income_local, income_base,
                   trans_code, trans_amount_local, trans_amount_base
            FROM data_sub_ledger_trans
            WHERE account = :account AND valuation_dt = :val_dt
              AND asset_id = :asset_id
            ORDER BY lot_trade_date
        """, {"account": account, "val_dt": valuation_dt, "asset_id": asset_id})

    def get_capital_stock(
        self, account: str, share_class: str, valuation_dt: date
    ) -> dict:
        """Get capital stock activity."""
        rows = self._query("""
            SELECT subscription_balance, redemption_balance, reinvested_distribution
            FROM capital_stock
            WHERE account = :account AND share_class = :share_class
              AND valuation_dt = :val_dt
        """, {"account": account, "share_class": share_class, "val_dt": valuation_dt})
        return rows[0] if rows else {}


# =============================================================================
# Graph Query Tools
# =============================================================================

class GraphTools:
    """Cypher query tools for accessing the Neo4j knowledge graph."""

    def __init__(self):
        self._neo4j = Neo4jClient()

    def _query(self, cypher: str, params: dict = None) -> list[dict]:
        with self._neo4j.session() as session:
            result = session.run(cypher, **(params or {}))
            return [dict(r) for r in result]

    def get_fund_graph_context(self, account: str) -> dict:
        """Get full fund context from the knowledge graph."""
        results = self._query("""
            MATCH (f:Fund {account: $account})
            OPTIONAL MATCH (f)-[:HAS_CLASS]->(sc:ShareClass)
            OPTIONAL MATCH (f)-[:DENOMINATED_IN]->(c:Currency)
            RETURN f, collect(DISTINCT sc) as share_classes
        """, {"account": account})
        return results[0] if results else {}

    def get_gl_mapping(
        self, cpu_gl_account: str
    ) -> Optional[str]:
        """Get incumbent GL account mapping for a CPU GL account."""
        results = self._query("""
            MATCH (cpu:GLAccount {gl_account_number: $gl, system: 'CPU'})
                -[:CPU_MAPS_TO]->(inc:GLAccount)
            RETURN inc.gl_account_number as incumbent_gl
        """, {"gl": cpu_gl_account})
        return results[0]["incumbent_gl"] if results else None

    def get_security_rules(self, asset_id: str) -> dict:
        """Get accounting rules applicable to a security."""
        results = self._query("""
            MATCH (s:Security {asset_id: $asset_id})
            OPTIONAL MATCH (dc:DayCountConvention {convention_name: s.day_count})
            OPTIONAL MATCH (am:AccrualMethod)-[:USES_METHOD]->(dc)
            RETURN s.sec_type as sec_type,
                   s.day_count as day_count,
                   s.coupon_rate as coupon_rate,
                   s.amort_method as amort_method,
                   am.method_name as accrual_method,
                   am.description as accrual_formula,
                   dc.numerator_rule as numerator_rule,
                   dc.denominator_rule as denominator_rule
        """, {"asset_id": asset_id})
        return results[0] if results else {}

    def find_similar_breaks(
        self, account: str, category: str, limit: int = 10
    ) -> list[dict]:
        """Find similar historical breaks for pattern matching."""
        return self._query("""
            MATCH (bi:BreakInstance)
            WHERE bi.account = $account AND bi.break_category = $category
              AND bi.status IN ['RESOLVED', 'ACCEPTED']
            OPTIONAL MATCH (bi)-[:RESOLVED_WITH]->(res:Resolution)
            RETURN bi.break_id as break_id,
                   bi.valuation_dt as valuation_dt,
                   bi.variance_absolute as variance,
                   bi.root_cause_summary as root_cause,
                   res.resolution_type as resolution_type,
                   res.description as resolution
            ORDER BY bi.valuation_dt DESC
            LIMIT $limit
        """, {"account": account, "category": category, "limit": limit})


# =============================================================================
# Calculation Tools (Deterministic - No LLM)
# =============================================================================

class CalculationTools:
    """
    Deterministic calculation tools for fund accounting computations.
    Per Architecture Specification: all numerical comparisons are deterministic.
    """

    @staticmethod
    def nav_per_share(net_assets: float, shares_outstanding: float) -> float:
        """NAV Per Share = Net Assets / Shares Outstanding"""
        if shares_outstanding == 0:
            return 0.0
        return net_assets / shares_outstanding

    @staticmethod
    def unrealized_gain_loss(
        market_value: float, book_value: float
    ) -> float:
        """Unrealized Gain/Loss = Market Value - Book Value"""
        return market_value - book_value

    @staticmethod
    def daily_accrual_simple(
        principal: float, annual_rate: float,
        days: int, day_count_basis: int = 360,
    ) -> float:
        """Daily Accrual = (Principal × Annual Rate × Days) / Day Count Basis"""
        return (principal * annual_rate * days) / day_count_basis

    @staticmethod
    def daily_amortization_straight_line(
        par_value: float, cost: float, days_to_maturity: int
    ) -> float:
        """Daily Amortization = (Par Value - Cost) / Days to Maturity"""
        if days_to_maturity == 0:
            return 0.0
        return (par_value - cost) / days_to_maturity

    @staticmethod
    def daily_variation_margin(
        today_settlement: float, yesterday_settlement: float,
        contract_size: float, num_contracts: float,
    ) -> float:
        """
        Daily Variation Margin =
        (Today's Settlement - Yesterday's Settlement) × Contract Size × Contracts
        """
        return (today_settlement - yesterday_settlement) * contract_size * num_contracts

    @staticmethod
    def day_count_30_360(
        start_date: date, end_date: date
    ) -> int:
        """Calculate days using 30/360 convention."""
        d1 = min(start_date.day, 30)
        d2 = min(end_date.day, 30) if d1 == 30 else end_date.day
        return (
            360 * (end_date.year - start_date.year)
            + 30 * (end_date.month - start_date.month)
            + (d2 - d1)
        )

    @staticmethod
    def day_count_actual(
        start_date: date, end_date: date
    ) -> int:
        """Calculate actual days between two dates."""
        return (end_date - start_date).days

    @staticmethod
    def accrual_variance_estimate(
        principal: float, annual_rate: float,
        cpu_day_count: str, incumbent_day_count: str,
        start_date: date, end_date: date,
    ) -> dict:
        """
        Estimate the accrual variance caused by different day count conventions.
        This is the key calculation for the Accrual Specialist Agent.
        """
        calc = CalculationTools

        # Calculate days under each convention
        if cpu_day_count in ("30/360", "30_360"):
            cpu_days = calc.day_count_30_360(start_date, end_date)
            cpu_basis = 360
        else:
            cpu_days = calc.day_count_actual(start_date, end_date)
            cpu_basis = 365

        if incumbent_day_count in ("30/360", "30_360"):
            inc_days = calc.day_count_30_360(start_date, end_date)
            inc_basis = 360
        else:
            inc_days = calc.day_count_actual(start_date, end_date)
            inc_basis = 365

        cpu_accrual = calc.daily_accrual_simple(
            principal, annual_rate, cpu_days, cpu_basis
        )
        inc_accrual = calc.daily_accrual_simple(
            principal, annual_rate, inc_days, inc_basis
        )

        return {
            "cpu_days": cpu_days,
            "cpu_basis": cpu_basis,
            "cpu_accrual": cpu_accrual,
            "incumbent_days": inc_days,
            "incumbent_basis": inc_basis,
            "incumbent_accrual": inc_accrual,
            "variance": cpu_accrual - inc_accrual,
            "day_difference": cpu_days - inc_days,
        }


# =============================================================================
# Report Generation Tools
# =============================================================================

class ReportTools:
    """Tools for generating analysis reports and evidence packs."""

    @staticmethod
    def generate_analysis_report(state_dict: dict) -> dict:
        """
        Generate a structured analysis report from the final agent state.
        Produces the report structure per Architecture Specification §6.3.3.
        """
        alert = state_dict.get("break_alert")
        root_causes = state_dict.get("root_causes", [])
        confidence = state_dict.get("overall_confidence", 0)
        narrative = state_dict.get("root_cause_narrative", "")
        patterns = state_dict.get("matched_patterns", [])
        escalation = state_dict.get("should_escalate", False)
        escalation_reasons = state_dict.get("escalation_reasons", [])

        report = {
            "report_type": "RECONCILIATION_ANALYSIS",
            "generated_at": "",
            "status": "ESCALATED" if escalation else "COMPLETED",

            "break_summary": {
                "break_id": alert.break_id if alert else "",
                "account": alert.account if alert else "",
                "share_class": alert.share_class if alert else "",
                "valuation_dt": str(alert.valuation_dt) if alert else "",
                "cpu_nav": alert.cpu_nav if alert else 0,
                "incumbent_nav": alert.incumbent_nav if alert else 0,
                "variance_absolute": alert.variance_absolute if alert else 0,
                "variance_relative": alert.variance_relative if alert else 0,
            },

            "root_cause_summary": narrative,
            "confidence_score": confidence,

            "evidence_chain": [
                {
                    "step": i + 1,
                    "agent": rc.get("agent", ""),
                    "level": rc.get("level", ""),
                    "finding": rc.get("description", ""),
                    "confidence": rc.get("confidence", 0),
                    "action": rc.get("recommended_action", ""),
                }
                for i, rc in enumerate(root_causes)
            ],

            "similar_historical_breaks": [
                {
                    "pattern_name": p.get("pattern_name", ""),
                    "occurrence_count": p.get("occurrence_count", 0),
                    "resolution": p.get("resolution_template", ""),
                }
                for p in patterns
            ],

            "recommended_actions": [
                rc.get("recommended_action", "")
                for rc in root_causes if rc.get("recommended_action")
            ],

            "escalation": {
                "required": escalation,
                "reasons": [
                    {"type": r.reason_type, "description": r.description}
                    for r in escalation_reasons
                ] if escalation_reasons else [],
            },

            "audit_trail": {
                "agent_trace": state_dict.get("agent_trace", []),
                "total_steps": state_dict.get("step_count", 0),
                "queries_executed": len(state_dict.get("queries_executed", [])),
            },
        }

        return report

    @staticmethod
    def generate_correction_je(
        account: str, valuation_dt: date,
        debit_gl: str, credit_gl: str,
        amount: float, description: str,
    ) -> dict:
        """Generate a correction journal entry proposal."""
        return {
            "je_type": "CORRECTION",
            "account": account,
            "valuation_dt": str(valuation_dt),
            "entries": [
                {
                    "gl_account": debit_gl,
                    "debit": amount,
                    "credit": 0,
                    "description": description,
                },
                {
                    "gl_account": credit_gl,
                    "debit": 0,
                    "credit": amount,
                    "description": description,
                },
            ],
            "total_debit": amount,
            "total_credit": amount,
            "balanced": True,
        }
