from datetime import datetime
from sqlalchemy import Column, DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models in the RECON-AI canonical data model."""
    pass


class AuditMixin:
    """Mixin providing standard audit columns for all tables."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        onupdate=func.now(), nullable=False
    )
    created_by: Mapped[str] = mapped_column(
        String(100), nullable=True
    )
    updated_by: Mapped[str] = mapped_column(
        String(100), nullable=True
    )
