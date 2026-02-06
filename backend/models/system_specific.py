"""
System-Specific Fields - §8 of Canonical Model
Tables: eagleEntity, eagleMaster
"""
from datetime import date
from typing import Optional

from sqlalchemy import Date, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, AuditMixin


class EagleEntity(Base, AuditMixin):
    """
    eagleEntity - Eagle-specific entity-level attributes.
    Source System: Eagle
    """
    __tablename__ = "eagle_entity"

    account: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Portfolio account identifier"
    )

    entity_base_currency: Mapped[Optional[str]] = mapped_column(
        String(3), nullable=True,
        comment="Base currency for the entity in Eagle (ISO 4217)"
    )
    entity_prod_source: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Production source system"
    )
    entity_nature: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Nature of the entity"
    )
    entity_periods_due_value: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Periods due value configuration"
    )
    entity_null_class: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Null class handling"
    )
    entity_composite: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Composite indicator (Y/N)"
    )
    entity_parent: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Parent entity identifier"
    )
    entity_cash_sleeve: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Cash sleeve configuration"
    )
    entity_ledger_processing_flag: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Ledger processing flag (Y/N)"
    )
    entity_partition: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Data partition identifier"
    )

    __table_args__ = (
        {"comment": "Eagle-specific entity-level attributes"},
    )


class EagleMaster(Base, AuditMixin):
    """
    eagleMaster - Eagle-specific master security attributes.
    Source System: Eagle
    """
    __tablename__ = "eagle_master"

    asset_id: Mapped[str] = mapped_column(
        String(50), primary_key=True,
        comment="Security identifier"
    )

    eagle_currency: Mapped[Optional[str]] = mapped_column(
        String(3), nullable=True,
        comment="Eagle currency code (ISO 4217)"
    )
    eagle_maturity_type: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle maturity type classification"
    )
    eagle_security_type: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle security type code"
    )
    eagle_primary_asset_type: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle primary asset type"
    )
    eagle_sec_master: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Eagle security master identifier"
    )
    eagle_non_class_type: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle non-classified type"
    )
    eagle_open: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Eagle open indicator (Y/N)"
    )
    eagle_pension: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True,
        comment="Eagle pension indicator (Y/N)"
    )
    eagle_non_coup_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Eagle non-coupon date"
    )
    eagle_nature: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Eagle security nature"
    )

    __table_args__ = (
        {"comment": "Eagle-specific master security attributes"},
    )
