"""
NAV and Fund Level Tables - §5 of Canonical Model
Tables: NAV Summary, Capital Stock, Distribution, Capstock RecPay,
        Distribution RecPay, Merger, Ledger
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, AuditMixin


class NAVSummary(Base, AuditMixin):
    """
    NAV Summary - Net Asset Value summary data at the share class level.
    Grain: One row per share class per valuation date
    """
    __tablename__ = "nav_summary"

    valuation_dt: Mapped[date] = mapped_column(
        Date, primary_key=True,
        comment="Valuation or reporting date"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Source of reporting data"
    )
    account: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Portfolio account identifier"
    )
    acct_basis: Mapped[str] = mapped_column(
        String(20), primary_key=True,
        comment="Code identifying the accounting basis"
    )
    share_class: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Class code/identifier"
    )

    shares_outstanding: Mapped[Decimal] = mapped_column(
        Numeric(18, 6), nullable=False,
        comment="Portfolio shares outstanding"
    )
    settled_shares: Mapped[Decimal] = mapped_column(
        Numeric(18, 6), nullable=False,
        comment="Portfolio settled/distribution shares outstanding"
    )
    net_assets: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Net assets in the base currency of the portfolio"
    )
    nav: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False,
        comment="Portfolio reported NAV rounded to NAV precision"
    )
    daily_distribution: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Daily portfolio distribution activity"
    )
    daily_yield: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 6), nullable=True,
        comment="Daily portfolio 1-day yield"
    )

    __table_args__ = (
        Index("ix_nav_summary_account", "account"),
        Index("ix_nav_summary_valuation", "valuation_dt"),
        Index("ix_nav_summary_class", "share_class"),
        {"comment": "Net Asset Value summary data at share class level"},
    )


class CapitalStock(Base, AuditMixin):
    """
    Capital Stock - Capital stock activity tracking subscriptions,
    redemptions, and reinvestments.
    Grain: One row per share class per valuation date
    """
    __tablename__ = "capital_stock"

    valuation_dt: Mapped[date] = mapped_column(
        Date, primary_key=True, comment="Valuation or reporting date"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Source of reporting data"
    )
    account: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Portfolio account identifier"
    )
    acct_basis: Mapped[str] = mapped_column(
        String(20), primary_key=True, comment="Accounting basis"
    )
    share_class: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Class code/identifier"
    )

    subscription_balance: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Ltd subscription capital balance"
    )
    redemption_balance: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Ltd redemption capital balance"
    )
    reinvested_distribution: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Ltd dividend reinvestment capital balance"
    )

    __table_args__ = (
        Index("ix_capstock_account", "account"),
        Index("ix_capstock_valuation", "valuation_dt"),
        {"comment": "Capital stock activity tracking"},
    )


class Distribution(Base, AuditMixin):
    """
    Distribution - Distribution activity by type.
    Grain: One row per share class per valuation date
    """
    __tablename__ = "distribution"

    valuation_dt: Mapped[date] = mapped_column(
        Date, primary_key=True, comment="Valuation or reporting date"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Source of reporting data"
    )
    account: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Portfolio account identifier"
    )
    acct_basis: Mapped[str] = mapped_column(
        String(20), primary_key=True, comment="Accounting basis"
    )
    share_class: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Class code/identifier"
    )

    income_distribution: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Total fund income distribution balance"
    )
    stcg_distribution: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Total fund short term capital gain distribution balance"
    )
    ltcg_distribution: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Total fund long term capital gain distribution balance"
    )

    __table_args__ = (
        Index("ix_distribution_account", "account"),
        Index("ix_distribution_valuation", "valuation_dt"),
        {"comment": "Distribution activity by type"},
    )


class CapstockRecPay(Base, AuditMixin):
    """
    Capstock RecPay - Unsettled capital stock receivables and payables.
    Grain: One row per share class per valuation date
    """
    __tablename__ = "capstock_rec_pay"

    valuation_dt: Mapped[date] = mapped_column(
        Date, primary_key=True, comment="Valuation or reporting date"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Source of reporting data"
    )
    account: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Portfolio account identifier"
    )
    acct_basis: Mapped[str] = mapped_column(
        String(20), primary_key=True, comment="Accounting basis"
    )
    share_class: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Class code/identifier"
    )

    subscription_rec_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Local value of unsettled subscription receivable"
    )
    redemption_pay_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Local value of unsettled redemption payable"
    )
    subscription_rec_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Base value of unsettled subscription receivable"
    )
    redemption_pay_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Base value of unsettled redemption payable"
    )

    __table_args__ = (
        Index("ix_capstock_rp_account", "account"),
        Index("ix_capstock_rp_valuation", "valuation_dt"),
        {"comment": "Unsettled capital stock receivables and payables"},
    )


class DistributionRecPay(Base, AuditMixin):
    """
    Distribution RecPay - Unsettled distribution payables.
    Grain: One row per share class per valuation date
    """
    __tablename__ = "distribution_rec_pay"

    valuation_dt: Mapped[date] = mapped_column(
        Date, primary_key=True, comment="Valuation or reporting date"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Source of reporting data"
    )
    account: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Portfolio account identifier"
    )
    acct_basis: Mapped[str] = mapped_column(
        String(20), primary_key=True, comment="Accounting basis"
    )
    share_class: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Class code/identifier"
    )

    distribution_payable: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Base value of unsettled distribution payable"
    )

    __table_args__ = (
        Index("ix_dist_rp_account", "account"),
        Index("ix_dist_rp_valuation", "valuation_dt"),
        {"comment": "Unsettled distribution payables"},
    )


class Merger(Base, AuditMixin):
    """
    Merger - Merger-related share activity.
    Grain: One row per merger event per valuation date
    """
    __tablename__ = "merger"

    valuation_dt: Mapped[date] = mapped_column(
        Date, primary_key=True, comment="Valuation or reporting date"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Source of reporting data"
    )
    account: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Portfolio account identifier"
    )
    acct_basis: Mapped[str] = mapped_column(
        String(20), primary_key=True, comment="Accounting basis"
    )
    share_class: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="Class code/identifier"
    )
    event_id: Mapped[str] = mapped_column(
        String(100), primary_key=True, comment="Merger event identifier"
    )

    merger_shares: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="Shares involved in merger activity"
    )

    __table_args__ = (
        Index("ix_merger_account", "account"),
        Index("ix_merger_valuation", "valuation_dt"),
        {"comment": "Merger-related share activity"},
    )


class Ledger(Base, AuditMixin):
    """
    Ledger - General ledger balances at the account level.
    Grain: One row per GL account per valuation date
    """
    __tablename__ = "ledger"

    event_id: Mapped[str] = mapped_column(
        String(100), primary_key=True,
        comment="Id of the event being processed"
    )
    valuation_dt: Mapped[date] = mapped_column(
        Date, primary_key=True,
        comment="Valuation or reporting date"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Source of reporting data"
    )
    account: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Portfolio account identifier"
    )
    acct_basis: Mapped[str] = mapped_column(
        String(20), primary_key=True,
        comment="Code identifying the accounting basis"
    )
    share_class: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Class code/identifier"
    )
    gl_account_number: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Ledger account identifier"
    )

    ending_balance: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Closing balance of the ledger account for the valuation date"
    )

    __table_args__ = (
        Index("ix_ledger_account", "account"),
        Index("ix_ledger_valuation", "valuation_dt"),
        Index("ix_ledger_gl", "gl_account_number"),
        Index("ix_ledger_acct_date", "account", "valuation_dt"),
        {"comment": "General ledger balances at the account level"},
    )
