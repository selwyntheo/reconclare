"""
Graph Population Service - Syncs data from PostgreSQL canonical model to Neo4j.
Populates all four graph layers per Architecture Specification §4.2.
"""
from datetime import date
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session as SQLSession

from src.graph.neo4j_client import Neo4jClient
from src.graph.schema import NodeLabel, RelationshipType
from src.models.reference_data import RefFund, RefSecurity, RefLedger, RefSecType, RefTransCode
from src.models.positions import SubLedgerPosition
from src.models.core_transactions import DailyTransaction
from src.models.nav_fund import NAVSummary, Ledger
from src.models.cross_reference import XrefAccount, XrefClass
from src.models.reconciliation import ReconciliationBreak, BreakResolution, BreakPattern


class GraphPopulationService:
    """
    Populates the Neo4j knowledge graph from PostgreSQL canonical data.
    Handles all four graph layers:
    1. Domain Entity Graph (Static)
    2. Accounting Rule Graph (Semi-Static)
    3. Transaction Lineage Graph (Dynamic)
    4. Break Pattern Graph (Accumulated)
    """

    def __init__(self, neo4j_client: Neo4jClient):
        self.neo4j = neo4j_client

    # =========================================================================
    # Layer 1: Domain Entity Graph (Static)
    # =========================================================================

    def populate_domain_entities(self, sql_session: SQLSession):
        """Populate the static domain entity graph from reference data."""
        self._populate_funds(sql_session)
        self._populate_securities(sql_session)
        self._populate_gl_accounts(sql_session)
        self._populate_share_classes(sql_session)
        self._populate_nav_components()

    def _populate_funds(self, sql_session: SQLSession):
        """Sync Fund nodes from refFund."""
        funds = sql_session.execute(select(RefFund)).scalars().all()
        nodes = [
            {"account": f.account, "account_name": f.account_name}
            for f in funds
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.FUND, nodes)

        # Enrich with xref data
        xrefs = sql_session.execute(select(XrefAccount)).scalars().all()
        for xref in xrefs:
            self.neo4j.update_node(
                NodeLabel.FUND, "account", xref.account,
                {
                    "base_currency": xref.account_base_currency or "",
                    "source_system": xref.eagle_source or "",
                }
            )

    def _populate_securities(self, sql_session: SQLSession):
        """Sync Security nodes from refSecurity (latest valuation date)."""
        # Get latest valuation date per security
        stmt = (
            select(RefSecurity)
            .order_by(RefSecurity.valuation_dt.desc())
            .distinct(RefSecurity.asset_id)
        )
        securities = sql_session.execute(stmt).scalars().all()
        nodes = [
            {
                "asset_id": s.asset_id,
                "cusip": s.cusip or "",
                "sedol": s.sedol or "",
                "isin": s.isin or "",
                "ticker": s.ticker or "",
                "sec_type": s.sec_type,
                "issue_description": s.issue_description,
                "asset_currency": s.asset_currency,
                "country_code": s.country_code,
                "coupon_rate": float(s.coupon_rate) if s.coupon_rate else 0.0,
                "day_count": s.day_count or "",
                "amort_method": s.amort_method or "",
                "factor": float(s.factor) if s.factor else 1.0,
                "payment_frequency": s.payment_frequency or "",
            }
            for s in securities
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.SECURITY, nodes)

        # Create SecurityType nodes and relationships
        sec_types = sql_session.execute(select(RefSecType)).scalars().all()
        type_nodes = [
            {"sec_type": st.sec_type, "description": st.sec_type_description}
            for st in sec_types
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.SECURITY_TYPE, type_nodes)

    def _populate_gl_accounts(self, sql_session: SQLSession):
        """Sync GLAccount nodes from refLedger."""
        accounts = sql_session.execute(select(RefLedger)).scalars().all()
        nodes = [
            {
                "gl_account_number": a.gl_account_number,
                "gl_description": a.gl_description,
                "gl_category": a.gl_category,
                "system": "CPU",
            }
            for a in accounts
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.GL_ACCOUNT, nodes)

    def _populate_share_classes(self, sql_session: SQLSession):
        """Sync ShareClass nodes from xrefClass."""
        classes = sql_session.execute(select(XrefClass)).scalars().all()
        nodes = [
            {
                "share_class": c.share_class,
                "parent_account": c.parent_account or "",
                "is_sleeve": c.is_sleeve == "Y",
                "is_composite": c.is_composite == "Y",
            }
            for c in classes
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.SHARE_CLASS, nodes)

        # Create Fund → ShareClass relationships
        pairs = [
            {"from_value": c.parent_account, "to_value": c.share_class}
            for c in classes if c.parent_account
        ]
        self.neo4j.bulk_create_relationships(
            NodeLabel.FUND, "account",
            NodeLabel.SHARE_CLASS, "share_class",
            RelationshipType.HAS_CLASS, pairs
        )

    def _populate_nav_components(self):
        """Create standard NAV component nodes (static structure)."""
        components = [
            {"component_id": "INV_AT_MARKET", "component_name": "Investment at Market Value",
             "component_type": "INVESTMENT_AT_MARKET", "sign": 1},
            {"component_id": "ACCRUED_INCOME", "component_name": "Accrued Income",
             "component_type": "ACCRUED_INCOME", "sign": 1},
            {"component_id": "RECEIVABLES", "component_name": "Receivables",
             "component_type": "RECEIVABLES", "sign": 1},
            {"component_id": "PAYABLES", "component_name": "Payables",
             "component_type": "PAYABLES", "sign": -1},
            {"component_id": "CASH", "component_name": "Cash & Equivalents",
             "component_type": "CASH", "sign": 1},
            {"component_id": "CAPITAL", "component_name": "Capital Activity",
             "component_type": "CAPITAL", "sign": -1},
            {"component_id": "DISTRIBUTIONS", "component_name": "Distributions",
             "component_type": "DISTRIBUTIONS", "sign": -1},
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.NAV_COMPONENT, components)

    # =========================================================================
    # Layer 2: Accounting Rule Graph (Semi-Static)
    # =========================================================================

    def populate_accounting_rules(self):
        """Populate accounting rule graph with standard fund accounting rules."""
        self._populate_day_count_conventions()
        self._populate_accrual_methods()
        self._populate_gl_mapping_rules()
        self._populate_nav_calculation_rules()

    def _populate_day_count_conventions(self):
        """Create standard day count convention nodes."""
        conventions = [
            {"convention_id": "30_360", "convention_name": "30/360",
             "numerator_rule": "30-day months", "denominator_rule": "360-day year"},
            {"convention_id": "ACT_ACT", "convention_name": "ACT/ACT",
             "numerator_rule": "Actual days", "denominator_rule": "Actual days in year"},
            {"convention_id": "ACT_360", "convention_name": "ACT/360",
             "numerator_rule": "Actual days", "denominator_rule": "360-day year"},
            {"convention_id": "ACT_365", "convention_name": "ACT/365",
             "numerator_rule": "Actual days", "denominator_rule": "365-day year"},
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.DAY_COUNT_CONVENTION, conventions)

    def _populate_accrual_methods(self):
        """Create accrual method nodes."""
        methods = [
            {"method_id": "SIMPLE_INTEREST", "method_name": "Simple Interest",
             "description": "Daily Accrual = (Principal × Annual Rate × Days) / Day Count Basis",
             "applicable_sec_types": ["BOND", "GOVT", "MBS"]},
            {"method_id": "STRAIGHT_LINE", "method_name": "Straight Line Amortization",
             "description": "Daily Amortization = (Par Value - Cost) / Days to Maturity",
             "applicable_sec_types": ["BOND", "GOVT"]},
            {"method_id": "EFFECTIVE_INTEREST", "method_name": "Effective Interest Method",
             "description": "Amortization based on effective yield to maturity",
             "applicable_sec_types": ["BOND", "GOVT", "MBS"]},
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.ACCRUAL_METHOD, methods)

        # Link accrual methods to day count conventions
        for method in methods:
            for conv_id in ["30_360", "ACT_ACT", "ACT_360", "ACT_365"]:
                self.neo4j.create_relationship(
                    NodeLabel.ACCRUAL_METHOD, "method_id", method["method_id"],
                    NodeLabel.DAY_COUNT_CONVENTION, "convention_id", conv_id,
                    RelationshipType.USES_METHOD,
                )

    def _populate_gl_mapping_rules(self):
        """Create standard GL mapping rules for common transaction types."""
        rules = [
            {"rule_id": "BUY_EQUITY", "rule_name": "Equity Purchase",
             "source_system": "CPU", "debit_account": "INVESTMENT",
             "credit_account": "CASH", "conditions": "trans_code=BUY AND sec_type=EQUITY"},
            {"rule_id": "SELL_EQUITY", "rule_name": "Equity Sale",
             "source_system": "CPU", "debit_account": "CASH",
             "credit_account": "INVESTMENT", "conditions": "trans_code=SELL AND sec_type=EQUITY"},
            {"rule_id": "DIV_INCOME", "rule_name": "Dividend Income",
             "source_system": "CPU", "debit_account": "RECEIVABLE",
             "credit_account": "INCOME", "conditions": "trans_code=DIV"},
            {"rule_id": "INT_INCOME", "rule_name": "Interest Income",
             "source_system": "CPU", "debit_account": "ACCRUED_INCOME",
             "credit_account": "INCOME", "conditions": "trans_code=INT"},
            {"rule_id": "BUY_BOND", "rule_name": "Bond Purchase",
             "source_system": "CPU", "debit_account": "INVESTMENT",
             "credit_account": "CASH", "conditions": "trans_code=BUY AND sec_type IN (BOND,GOVT,MBS)"},
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.GL_MAPPING_RULE, rules)

    def _populate_nav_calculation_rules(self):
        """Create NAV calculation rule nodes."""
        rules = [
            {"rule_id": "STANDARD_NAV", "rule_name": "Standard NAV Calculation",
             "formula": "NAV = Net Assets / Shares Outstanding",
             "timing_cutoff": "4:00 PM ET", "rounding_rule": "4 decimal places"},
            {"rule_id": "MONEY_MARKET_NAV", "rule_name": "Money Market NAV",
             "formula": "NAV = $1.0000 (stable value)",
             "timing_cutoff": "5:00 PM ET", "rounding_rule": "4 decimal places"},
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.NAV_CALCULATION_RULE, rules)

    # =========================================================================
    # Layer 3: Transaction Lineage Graph (Dynamic)
    # =========================================================================

    def populate_transaction_lineage(
        self, sql_session: SQLSession, valuation_dt: date, account: str
    ):
        """
        Populate transaction lineage graph for a specific NAV cycle.
        Creates the chain: NAVPublication → GLSnapshot → Positions → Transactions
        """
        cycle_id = f"{account}_{valuation_dt.isoformat()}"

        # Create NAV cycle node
        self.neo4j.create_node(NodeLabel.NAV_CYCLE, {
            "cycle_id": cycle_id,
            "account": account,
            "valuation_dt": valuation_dt.isoformat(),
        })

        # Populate GL snapshot
        self._populate_gl_snapshot(sql_session, valuation_dt, account, cycle_id)

        # Populate positions
        self._populate_positions(sql_session, valuation_dt, account)

        # Populate transactions
        self._populate_transactions(sql_session, valuation_dt, account)

        # Create lineage relationships
        self._create_lineage_relationships(sql_session, valuation_dt, account, cycle_id)

    def _populate_gl_snapshot(
        self, sql_session: SQLSession, valuation_dt: date,
        account: str, cycle_id: str
    ):
        """Create GL snapshot nodes for the NAV cycle."""
        stmt = (
            select(Ledger)
            .where(Ledger.account == account)
            .where(Ledger.valuation_dt == valuation_dt)
        )
        ledger_entries = sql_session.execute(stmt).scalars().all()

        snapshot_id = f"GL_{cycle_id}"
        self.neo4j.create_node(NodeLabel.GL_SNAPSHOT, {
            "snapshot_id": snapshot_id,
            "account": account,
            "valuation_dt": valuation_dt.isoformat(),
            "entry_count": len(ledger_entries),
        })

        # Link snapshot to cycle
        self.neo4j.create_relationship(
            NodeLabel.GL_SNAPSHOT, "snapshot_id", snapshot_id,
            NodeLabel.NAV_CYCLE, "cycle_id", cycle_id,
            RelationshipType.SNAPSHOT_OF,
        )

    def _populate_positions(
        self, sql_session: SQLSession, valuation_dt: date, account: str
    ):
        """Create position nodes for the NAV cycle."""
        stmt = (
            select(SubLedgerPosition)
            .where(SubLedgerPosition.account == account)
            .where(SubLedgerPosition.valuation_dt == valuation_dt)
        )
        positions = sql_session.execute(stmt).scalars().all()

        nodes = [
            {
                "position_id": f"{p.account}_{p.asset_id}_{p.long_short_ind}_{valuation_dt.isoformat()}",
                "account": p.account,
                "asset_id": p.asset_id,
                "shares": float(p.pos_shares),
                "market_value_base": float(p.pos_market_value_base),
                "book_value_base": float(p.pos_book_value_base),
                "unrealized_base": float(p.pos_unrealized_base) if p.pos_unrealized_base else 0.0,
                "income_base": float(p.pos_income_base) if p.pos_income_base else 0.0,
                "valuation_dt": valuation_dt.isoformat(),
            }
            for p in positions
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.SUB_LEDGER_POSITION, nodes)

    def _populate_transactions(
        self, sql_session: SQLSession, valuation_dt: date, account: str
    ):
        """Create transaction nodes for the NAV cycle."""
        stmt = (
            select(DailyTransaction)
            .where(DailyTransaction.account == account)
            .where(DailyTransaction.valuation_dt == valuation_dt)
        )
        transactions = sql_session.execute(stmt).scalars().all()

        nodes = [
            {
                "transaction_id": t.transaction_id,
                "trans_code": t.trans_code,
                "trade_date": t.trade_date.isoformat(),
                "settle_date": t.settle_date.isoformat() if t.settle_date else "",
                "units": float(t.units),
                "amount_local": float(t.amount_local),
                "amount_base": float(t.amount_base),
                "currency": t.currency,
                "asset_id": t.asset_id,
                "account": t.account,
                "system": "CPU",
            }
            for t in transactions
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.TRANSACTION, nodes)

    def _create_lineage_relationships(
        self, sql_session: SQLSession, valuation_dt: date,
        account: str, cycle_id: str
    ):
        """Create the lineage chain relationships."""
        # Position → Security relationships
        stmt = (
            select(SubLedgerPosition.asset_id)
            .where(SubLedgerPosition.account == account)
            .where(SubLedgerPosition.valuation_dt == valuation_dt)
            .distinct()
        )
        asset_ids = [
            row[0] for row in sql_session.execute(stmt).all()
        ]

        for asset_id in asset_ids:
            pos_id = f"{account}_{asset_id}_L_{valuation_dt.isoformat()}"
            self.neo4j.create_relationship(
                NodeLabel.SUB_LEDGER_POSITION, "position_id", pos_id,
                NodeLabel.SECURITY, "asset_id", asset_id,
                RelationshipType.INVOLVES_SECURITY,
            )

    # =========================================================================
    # Layer 4: Break Pattern Graph (Accumulated)
    # =========================================================================

    def populate_break_patterns(self, sql_session: SQLSession):
        """Populate break pattern graph from resolved breaks."""
        self._populate_break_instances(sql_session)
        self._populate_patterns(sql_session)
        self._create_pattern_relationships(sql_session)

    def _populate_break_instances(self, sql_session: SQLSession):
        """Sync break instances to graph."""
        breaks = sql_session.execute(
            select(ReconciliationBreak)
        ).scalars().all()

        nodes = [
            {
                "break_id": b.break_id,
                "valuation_dt": b.valuation_dt.isoformat(),
                "account": b.account,
                "share_class": b.share_class,
                "break_level": b.break_level.value if b.break_level else "",
                "break_category": b.break_category.value if b.break_category else "",
                "variance_absolute": float(b.variance_absolute) if b.variance_absolute else 0.0,
                "variance_relative": float(b.variance_relative) if b.variance_relative else 0.0,
                "confidence_score": float(b.confidence_score) if b.confidence_score else 0.0,
                "root_cause_summary": b.root_cause_summary or "",
                "status": b.status.value if b.status else "",
            }
            for b in breaks
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.BREAK_INSTANCE, nodes)

    def _populate_patterns(self, sql_session: SQLSession):
        """Sync break patterns to graph."""
        patterns = sql_session.execute(
            select(BreakPattern)
        ).scalars().all()

        nodes = [
            {
                "pattern_id": p.pattern_id,
                "pattern_name": p.pattern_name,
                "description": p.pattern_description,
                "break_category": p.break_category.value if p.break_category else "",
                "occurrence_count": p.occurrence_count,
                "avg_confidence": float(p.avg_confidence) if p.avg_confidence else 0.0,
                "is_systematic": p.is_systematic,
                "matching_criteria": str(p.matching_criteria),
                "resolution_template": str(p.resolution_template),
            }
            for p in patterns
        ]
        self.neo4j.bulk_create_nodes(NodeLabel.BREAK_PATTERN, nodes)

    def _create_pattern_relationships(self, sql_session: SQLSession):
        """Create relationships between break instances and patterns."""
        breaks = sql_session.execute(
            select(ReconciliationBreak)
            .where(ReconciliationBreak.break_category.isnot(None))
        ).scalars().all()

        patterns = sql_session.execute(select(BreakPattern)).scalars().all()
        pattern_map = {p.break_category.value: p.pattern_id for p in patterns if p.break_category}

        for b in breaks:
            if b.break_category and b.break_category.value in pattern_map:
                self.neo4j.create_relationship(
                    NodeLabel.BREAK_INSTANCE, "break_id", b.break_id,
                    NodeLabel.BREAK_PATTERN, "pattern_id",
                    pattern_map[b.break_category.value],
                    RelationshipType.MATCHES_PATTERN,
                )

            # Link to fund
            self.neo4j.create_relationship(
                NodeLabel.BREAK_INSTANCE, "break_id", b.break_id,
                NodeLabel.FUND, "account", b.account,
                RelationshipType.ASSOCIATED_WITH_FUND,
            )

    # =========================================================================
    # Full Population Orchestrator
    # =========================================================================

    def full_population(
        self, sql_session: SQLSession,
        valuation_dt: Optional[date] = None,
        accounts: Optional[list[str]] = None,
    ):
        """
        Run full graph population across all four layers.
        """
        # Layer 1: Domain entities
        self.populate_domain_entities(sql_session)

        # Layer 2: Accounting rules (static seed data)
        self.populate_accounting_rules()

        # Layer 3: Transaction lineage (per account/date)
        if valuation_dt and accounts:
            for account in accounts:
                self.populate_transaction_lineage(
                    sql_session, valuation_dt, account
                )

        # Layer 4: Break patterns
        self.populate_break_patterns(sql_session)
