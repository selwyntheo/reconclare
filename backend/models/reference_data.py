"""
Reference Data Tables - §2 of Canonical Model
Tables: refSecurity, refSecType, refTransCode, refLedger, refFund
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, AuditMixin


class RefSecurity(Base, AuditMixin):
    """
    refSecurity - Master security reference data containing all security
    identifiers and characteristics.
    Grain: One row per security per valuation date per source
    """
    __tablename__ = "ref_security"

    # --- Key Fields ---
    asset_id: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Primary security identifier"
    )
    valuation_dt: Mapped[date] = mapped_column(
        Date, primary_key=True,
        comment="Valuation or reporting date"
    )
    user_bank: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Source of reporting data"
    )

    # --- Security Identifier Fields ---
    cusip: Mapped[Optional[str]] = mapped_column(
        String(9), nullable=True,
        comment="CUSIP market identifier (9 chars, North American)"
    )
    sedol: Mapped[Optional[str]] = mapped_column(
        String(7), nullable=True,
        comment="SEDOL market identifier (7 chars, primarily UK)"
    )
    isin: Mapped[Optional[str]] = mapped_column(
        String(12), nullable=True,
        comment="ISIN market identifier (12 chars, international)"
    )
    ticker: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Ticker market identifier"
    )
    sec_type: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="Security type indicator/code"
    )

    # --- Security Descriptive Fields ---
    issue_description: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Security issue description/name"
    )
    asset_currency: Mapped[str] = mapped_column(
        String(3), nullable=False,
        comment="Currency of security issue (ISO 4217)"
    )
    country_code: Mapped[str] = mapped_column(
        String(2), nullable=False,
        comment="Country code of security issue (ISO 3166-1 alpha-2)"
    )

    # --- Fixed Income Specific Fields ---
    issue_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="Issue date of security"
    )
    maturity_dt: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="Maturity date of security"
    )
    coupon_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 6), nullable=True,
        comment="Coupon rate (decimal: 0.05 = 5%)"
    )
    day_count: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Day count code (30/360, ACT/ACT, ACT/360, etc.)"
    )
    next_call_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="Next call date"
    )
    call_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 6), nullable=True, comment="Next call price"
    )
    amort_method: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True,
        comment="Amortization method code (SL=Straight Line, EFF=Effective)"
    )
    factor: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 10), nullable=True,
        comment="Current factor of security (for MBS/ABS)"
    )
    first_coupon_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="First coupon date"
    )
    last_coupon_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="Last coupon date"
    )
    payment_frequency: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Coupon payment frequency (M/Q/S/A)"
    )

    # --- Equity Specific Fields ---
    div_frequency: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Dividend frequency (M/Q/S/A)"
    )

    __table_args__ = (
        Index("ix_ref_security_cusip", "cusip"),
        Index("ix_ref_security_sedol", "sedol"),
        Index("ix_ref_security_isin", "isin"),
        Index("ix_ref_security_ticker", "ticker"),
        Index("ix_ref_security_sec_type", "sec_type"),
        Index("ix_ref_security_valuation", "valuation_dt"),
        {"comment": "Master security reference data"},
    )


class RefSecType(Base, AuditMixin):
    """
    refSecType - Security type classification reference table.
    Grain: One row per security type
    """
    __tablename__ = "ref_sec_type"

    sec_type: Mapped[str] = mapped_column(
        String(20), primary_key=True,
        comment="Security type indicator/code"
    )
    sec_type_description: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Description of security type"
    )

    __table_args__ = (
        {"comment": "Security type classification reference"},
    )


class RefTransCode(Base, AuditMixin):
    """
    refTransCode - Transaction code reference for all transaction types.
    Grain: One row per transaction code
    """
    __tablename__ = "ref_trans_code"

    trans_code: Mapped[str] = mapped_column(
        String(20), primary_key=True,
        comment="Code designating the type of transaction"
    )
    trans_code_description: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Description of the trans code"
    )

    __table_args__ = (
        {"comment": "Transaction code reference"},
    )


class RefLedger(Base, AuditMixin):
    """
    refLedger - General ledger account chart of accounts.
    Grain: One row per GL account
    """
    __tablename__ = "ref_ledger"

    gl_account_number: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Ledger account identifier"
    )
    gl_description: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Ledger account description"
    )
    gl_category: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="Ledger account category (ASSET/LIABILITY/EQUITY/INCOME/EXPENSE)"
    )

    __table_args__ = (
        Index("ix_ref_ledger_category", "gl_category"),
        {"comment": "General ledger account chart of accounts"},
    )


class RefFund(Base, AuditMixin):
    """
    refFund - Fund/Portfolio master reference data.
    Grain: One row per fund/portfolio
    """
    __tablename__ = "ref_fund"

    account: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Portfolio account identifier"
    )
    account_name: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Portfolio name/description"
    )

    __table_args__ = (
        {"comment": "Fund/Portfolio master reference data"},
    )


class RefLedgerCategory(Base, AuditMixin):
    """
    refLedgerCategory - Ledger conversion category definitions with subledger support flags.
    Defines the 17 categories used for Ledger to Subledger validation.
    Grain: One row per category
    """
    __tablename__ = "ref_ledger_category"

    category_name: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Category name (e.g., Cash, Investment Cost, Holdings Unrealized)"
    )
    subledger_supported: Mapped[bool] = mapped_column(
        nullable=False, default=False,
        comment="Whether this category has a derived subledger rollup (Y/N)"
    )
    primary_data_source: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Primary data source for subledger (Position, Unsettled Trans, etc.)"
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True,
        comment="Description of what this category represents"
    )
    display_order: Mapped[int] = mapped_column(
        nullable=False, default=0,
        comment="Display order in the summary grid"
    )

    __table_args__ = (
        Index("ix_ref_ledger_category_supported", "subledger_supported"),
        {"comment": "Ledger conversion category definitions"},
    )


class RefGLCategoryMapping(Base, AuditMixin):
    """
    refGLCategoryMapping - Maps GL account numbers to ledger conversion categories.
    Enables grouping of GL accounts into meaningful reconciliation buckets.
    Grain: One row per GL account per chart of accounts
    """
    __tablename__ = "ref_gl_category_mapping"

    chart_of_accounts: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Chart of accounts identifier (e.g., 'investone mufg')"
    )
    gl_account_number: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="GL account number/code"
    )
    gl_account_description: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="GL account description"
    )
    ledger_section: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Ledger section (ASSETS, LIABILITIES, EQUITY, INCOME, EXPENSE)"
    )
    bs_incst: Mapped[str] = mapped_column(
        String(10), nullable=False,
        comment="Balance Sheet or Income Statement indicator (BS/INCST)"
    )
    conversion_category: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Ledger conversion category for reconciliation"
    )

    __table_args__ = (
        Index("ix_ref_gl_category_mapping_category", "conversion_category"),
        Index("ix_ref_gl_category_mapping_bs_incst", "bs_incst"),
        Index("ix_ref_gl_category_mapping_section", "ledger_section"),
        {"comment": "GL account to conversion category mapping"},
    )


class RefTransCodeCategoryMapping(Base, AuditMixin):
    """
    refTransCodeCategoryMapping - Maps transaction codes to ledger conversion categories.
    Defines how unsettled transactions contribute to derived subledger rollup.
    Grain: One row per transaction code
    """
    __tablename__ = "ref_trans_code_category_mapping"

    trans_code: Mapped[str] = mapped_column(
        String(20), primary_key=True,
        comment="Transaction code (DIV, RECL, BUY, SELL, etc.)"
    )
    conversion_category: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Ledger conversion category for this trans code"
    )
    field_used: Mapped[str] = mapped_column(
        String(50), nullable=False, default="transAmountBase",
        comment="Field used for rollup calculation"
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True,
        comment="Description of transaction code"
    )

    __table_args__ = (
        Index("ix_ref_trans_code_category_mapping_category", "conversion_category"),
        {"comment": "Transaction code to conversion category mapping"},
    )
