"""
Core Transaction Tables - §1 of Canonical Model
Primary table: dataDailyTransactions
Grain: One row per transaction per valuation date
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, Index, Numeric, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, AuditMixin


class DailyTransaction(Base, AuditMixin):
    """
    dataDailyTransactions - Primary table for daily transaction data across all portfolios.
    Contains trade and corporate action activity.
    """
    __tablename__ = "data_daily_transactions"

    # --- Key Fields (Composite PK) ---
    event_id: Mapped[str] = mapped_column(
        String(100), primary_key=True,
        comment="Id of the event being processed, contextual"
    )
    valuation_dt: Mapped[date] = mapped_column(
        Date, primary_key=True,
        comment="Valuation or reporting date of the incumbent data file"
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
    asset_id: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Primary security identifier"
    )
    long_short_ind: Mapped[str] = mapped_column(
        String(1), primary_key=True,
        comment="Indicator of whether the transaction is long or short (L/S)"
    )
    transaction_id: Mapped[str] = mapped_column(
        String(100), primary_key=True,
        comment="Unique transaction or lot identifier"
    )

    # --- Transaction Detail Fields ---
    trans_code: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="Code designating the type of transaction"
    )
    units: Mapped[Decimal] = mapped_column(
        Numeric(18, 6), nullable=False,
        comment="Units of the transaction"
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False,
        comment="Currency of the transaction (ISO 4217)"
    )
    amount_local: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Net local amount of the transaction"
    )
    amount_base: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False,
        comment="Net traded base amount of the transaction"
    )
    trade_date: Mapped[date] = mapped_column(
        Date, nullable=False,
        comment="Trade date of the transaction"
    )
    settle_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Settle date of the transaction"
    )
    traded_int_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Traded interest of the transaction (local)"
    )
    traded_int_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Traded interest of the transaction (base)"
    )

    # --- Additional Fields from Mapping ---
    shares: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="Number of shares in transaction"
    )
    original_face: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True,
        comment="For factor based securities, original face"
    )
    orig_cost_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Original cost in local currency"
    )
    orig_cost_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Original cost in base currency"
    )
    book_value_local: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Book value in local currency"
    )
    book_value_base: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True,
        comment="Book value in base currency"
    )
    lot_trade_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Original acquisition trade date"
    )
    lot_settle_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Original settle date"
    )

    __table_args__ = (
        Index("ix_daily_trans_valuation", "valuation_dt"),
        Index("ix_daily_trans_account", "account"),
        Index("ix_daily_trans_asset", "asset_id"),
        Index("ix_daily_trans_trade_date", "trade_date"),
        Index("ix_daily_trans_trans_code", "trans_code"),
        Index("ix_daily_trans_acct_date", "account", "valuation_dt"),
        {"comment": "Primary table for daily transaction data across all portfolios"},
    )
