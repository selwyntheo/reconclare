"""
Tests for RECON-AI Canonical Data Model (PostgreSQL).
Validates all SQLAlchemy models match the canonical model specification.
"""
import pytest
from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session

from src.models.base import Base
from src.models.core_transactions import DailyTransaction
from src.models.reference_data import RefSecurity, RefSecType, RefTransCode, RefLedger, RefFund
from src.models.positions import SubLedgerPosition
from src.models.subledger import SubLedgerTransaction
from src.models.nav_fund import (
    NAVSummary, CapitalStock, Distribution,
    CapstockRecPay, DistributionRecPay, Merger, Ledger,
)
from src.models.cross_reference import (
    XrefAccount, XrefSleeve, XrefClass, XrefBrokerCode, XrefTransaction,
)
from src.models.enrichment import (
    ConvTransClassification, ConvGleanClassification,
    ConvSecClassification, EagleSecClassification,
)
from src.models.system_specific import EagleEntity, EagleMaster
from src.models.reconciliation import (
    ReconciliationBreak, BreakAnalysis, BreakResolution, BreakPattern,
    BreakLevel, BreakCategory, BreakStatus, ResolutionType,
)


@pytest.fixture(scope="module")
def engine():
    """Create an in-memory SQLite engine for testing schema creation."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def session(engine):
    """Create a test session."""
    with Session(engine) as session:
        yield session
        session.rollback()


# =============================================================================
# Schema Creation Tests
# =============================================================================

class TestSchemaCreation:
    """Verify all tables are created correctly."""

    def test_all_tables_created(self, engine):
        """All canonical model tables should be created."""
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        expected_tables = [
            "data_daily_transactions",
            "ref_security", "ref_sec_type", "ref_trans_code", "ref_ledger", "ref_fund",
            "data_sub_ledger_position",
            "data_sub_ledger_trans",
            "nav_summary", "capital_stock", "distribution",
            "capstock_rec_pay", "distribution_rec_pay", "merger", "ledger",
            "xref_account", "xref_sleeve", "xref_class",
            "xref_broker_code", "xref_transaction",
            "conv_trans_classification", "conv_glean_classification",
            "conv_sec_classification", "eagle_sec_classification",
            "eagle_entity", "eagle_master",
            "reconciliation_break", "break_analysis",
            "break_resolution", "break_pattern",
        ]

        for table in expected_tables:
            assert table in tables, f"Table '{table}' not found in schema"

    def test_table_count(self, engine):
        """Verify total number of tables."""
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        assert len(tables) >= 28, f"Expected at least 28 tables, got {len(tables)}"


# =============================================================================
# Core Transaction Table Tests (§1)
# =============================================================================

class TestDailyTransaction:
    """Verify dataDailyTransactions model matches canonical spec §1.1."""

    def test_key_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("data_daily_transactions")}
        key_fields = {
            "event_id", "valuation_dt", "user_bank", "account",
            "acct_basis", "share_class", "asset_id", "long_short_ind",
            "transaction_id",
        }
        assert key_fields.issubset(columns), f"Missing key fields: {key_fields - columns}"

    def test_transaction_detail_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("data_daily_transactions")}
        detail_fields = {
            "trans_code", "units", "currency", "amount_local", "amount_base",
            "trade_date", "settle_date", "traded_int_local", "traded_int_base",
        }
        assert detail_fields.issubset(columns), f"Missing detail fields: {detail_fields - columns}"

    def test_additional_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("data_daily_transactions")}
        additional = {
            "shares", "original_face", "orig_cost_local", "orig_cost_base",
            "book_value_local", "book_value_base", "lot_trade_date", "lot_settle_date",
        }
        assert additional.issubset(columns), f"Missing additional fields: {additional - columns}"


# =============================================================================
# Reference Data Table Tests (§2)
# =============================================================================

class TestRefSecurity:
    """Verify refSecurity model matches canonical spec §2.1."""

    def test_identifier_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("ref_security")}
        id_fields = {"asset_id", "cusip", "sedol", "isin", "ticker", "sec_type"}
        assert id_fields.issubset(columns)

    def test_fixed_income_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("ref_security")}
        fi_fields = {
            "issue_date", "maturity_dt", "coupon_rate", "day_count",
            "next_call_date", "call_price", "amort_method", "factor",
            "first_coupon_date", "last_coupon_date", "payment_frequency",
        }
        assert fi_fields.issubset(columns)

    def test_equity_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("ref_security")}
        assert "div_frequency" in columns


class TestReferenceTablesExist:
    """Verify all reference tables exist with correct structure."""

    def test_ref_sec_type(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("ref_sec_type")}
        assert {"sec_type", "sec_type_description"}.issubset(columns)

    def test_ref_trans_code(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("ref_trans_code")}
        assert {"trans_code", "trans_code_description"}.issubset(columns)

    def test_ref_ledger(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("ref_ledger")}
        assert {"gl_account_number", "gl_description", "gl_category"}.issubset(columns)

    def test_ref_fund(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("ref_fund")}
        assert {"account", "account_name"}.issubset(columns)


# =============================================================================
# Position Table Tests (§3)
# =============================================================================

class TestSubLedgerPosition:
    """Verify dataSubLedgerPosition model matches canonical spec §3.1."""

    def test_position_quantity_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("data_sub_ledger_position")}
        assert {"pos_shares", "pos_original_face"}.issubset(columns)

    def test_position_cost_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("data_sub_ledger_position")}
        cost_fields = {
            "pos_orig_cost_local", "pos_orig_cost_base",
            "pos_book_value_local", "pos_book_value_base",
        }
        assert cost_fields.issubset(columns)

    def test_position_market_value_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("data_sub_ledger_position")}
        mv_fields = {
            "pos_market_value_local", "pos_market_value_base",
            "pos_market_price", "pos_unrealized_local", "pos_unrealized_base",
        }
        assert mv_fields.issubset(columns)

    def test_income_recognition_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("data_sub_ledger_position")}
        income_fields = {
            "pos_income_local", "pos_income_base", "pos_income_market",
            "pos_ins_tax_expense_local", "pos_ins_tax_expense_base",
            "pos_inc_reclaim_local", "pos_inc_reclaim_base",
            "pos_inc_deferred_local", "pos_inc_deferred_base",
            "pos_inc_unrealized", "pos_income_currency",
            "pos_prev_coupon_dt", "pos_next_coupon_dt",
        }
        assert income_fields.issubset(columns)

    def test_variation_margin_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("data_sub_ledger_position")}
        vm_fields = {
            "ltd_variation_margin_local", "ltd_variation_margin_base",
            "daily_variation_margin_local", "daily_variation_margin_base",
        }
        assert vm_fields.issubset(columns)


# =============================================================================
# NAV & Fund Level Tests (§5)
# =============================================================================

class TestNAVFundTables:
    """Verify NAV and fund-level tables match canonical spec §5."""

    def test_nav_summary_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("nav_summary")}
        assert {
            "shares_outstanding", "settled_shares", "net_assets",
            "nav", "daily_distribution", "daily_yield",
        }.issubset(columns)

    def test_capital_stock_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("capital_stock")}
        assert {
            "subscription_balance", "redemption_balance", "reinvested_distribution",
        }.issubset(columns)

    def test_distribution_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("distribution")}
        assert {
            "income_distribution", "stcg_distribution", "ltcg_distribution",
        }.issubset(columns)

    def test_ledger_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("ledger")}
        assert {
            "event_id", "valuation_dt", "account", "gl_account_number",
            "ending_balance",
        }.issubset(columns)


# =============================================================================
# Cross-Reference Table Tests (§6)
# =============================================================================

class TestCrossReferenceTables:
    """Verify cross-reference tables match canonical spec §6."""

    def test_xref_account(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("xref_account")}
        assert {
            "account", "eagle_act_basis", "eagle_source",
            "chart_of_accounts", "account_base_currency",
        }.issubset(columns)

    def test_xref_sleeve(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("xref_sleeve")}
        assert {"account", "is_sleeve", "is_composite"}.issubset(columns)

    def test_xref_class(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("xref_class")}
        assert {"share_class", "parent_account", "is_sleeve"}.issubset(columns)


# =============================================================================
# Reconciliation Model Tests
# =============================================================================

class TestReconciliationModels:
    """Verify RECON-AI specific reconciliation tracking models."""

    def test_break_levels(self):
        assert BreakLevel.L0_NAV.value == "L0_NAV"
        assert BreakLevel.L1_GL.value == "L1_GL"
        assert BreakLevel.L2_SUBLEDGER.value == "L2_SUBLEDGER"
        assert BreakLevel.L3_TRANSACTION.value == "L3_TRANSACTION"

    def test_break_categories(self):
        categories = [c.value for c in BreakCategory]
        assert "TIMING" in categories
        assert "METHODOLOGY" in categories
        assert "DATA" in categories
        assert "PRICING" in categories
        assert "CONFIGURATION" in categories
        assert "ROUNDING" in categories

    def test_reconciliation_break_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("reconciliation_break")}
        assert {
            "break_id", "valuation_dt", "account", "share_class",
            "break_level", "break_category", "status",
            "cpu_value", "incumbent_value",
            "variance_absolute", "variance_relative", "is_material",
            "confidence_score", "root_cause_summary",
        }.issubset(columns)

    def test_break_analysis_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("break_analysis")}
        assert {
            "analysis_id", "break_id", "agent_name", "agent_level",
            "step_sequence", "action_description", "conclusion",
        }.issubset(columns)

    def test_break_resolution_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("break_resolution")}
        assert {
            "resolution_id", "break_id", "resolution_type",
            "resolution_description", "resolved_by", "human_reviewed",
        }.issubset(columns)

    def test_break_pattern_fields(self, engine):
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("break_pattern")}
        assert {
            "pattern_id", "pattern_name", "break_category",
            "occurrence_count", "is_systematic", "graph_node_id",
        }.issubset(columns)
