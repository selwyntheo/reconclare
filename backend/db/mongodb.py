"""
MongoDB client for RECON-AI.
Provides connection management and collection access for the canonical data model.
"""
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import MongoClient
from pymongo.database import Database

from config.settings import settings

# Async client (for FastAPI endpoints)
_async_client: Optional[AsyncIOMotorClient] = None
_async_db: Optional[AsyncIOMotorDatabase] = None

# Sync client (for agent operations)
_sync_client: Optional[MongoClient] = None
_sync_db: Optional[Database] = None


def get_async_db() -> AsyncIOMotorDatabase:
    """Get async MongoDB database instance for FastAPI."""
    global _async_client, _async_db
    if _async_db is None:
        _async_client = AsyncIOMotorClient(settings.MONGODB_URI)
        _async_db = _async_client[settings.MONGODB_DB]
    return _async_db


def get_sync_db() -> Database:
    """Get sync MongoDB database instance for agent operations."""
    global _sync_client, _sync_db
    if _sync_db is None:
        _sync_client = MongoClient(settings.MONGODB_URI)
        _sync_db = _sync_client[settings.MONGODB_DB]
    return _sync_db


async def close_async_db():
    """Close async MongoDB connection."""
    global _async_client, _async_db
    if _async_client:
        _async_client.close()
        _async_client = None
        _async_db = None


def close_sync_db():
    """Close sync MongoDB connection."""
    global _sync_client, _sync_db
    if _sync_client:
        _sync_client.close()
        _sync_client = None
        _sync_db = None


# ── Collection Names (matching canonical_model.md) ──────────────
COLLECTIONS = {
    # Core Transaction Tables
    "dataDailyTransactions": "dataDailyTransactions",
    # Reference Data Tables
    "refSecurity": "refSecurity",
    "refSecType": "refSecType",
    "refTransCode": "refTransCode",
    "refLedger": "refLedger",
    "refFund": "refFund",
    # Position and Holdings Tables
    "dataSubLedgerPosition": "dataSubLedgerPosition",
    # Subledger Tables
    "dataSubLedgerTrans": "dataSubLedgerTrans",
    # NAV and Fund Level Tables
    "navSummary": "navSummary",
    "capitalStock": "capitalStock",
    "distribution": "distribution",
    "capstockRecPay": "capstockRecPay",
    "distributionRecPay": "distributionRecPay",
    "merger": "merger",
    "ledger": "ledger",
    # Cross-Reference Tables
    "xrefAccount": "xrefAccount",
    "xrefSleeve": "xrefSleeve",
    "xrefClass": "xrefClass",
    "xrefBrokerCode": "xrefBrokerCode",
    "xrefTransaction": "xrefTransaction",
    # Enrichment Tables
    "convTransClassification": "convTransClassification",
    "convGleanClassification": "convGleanClassification",
    "convSecClassification": "convSecClassification",
    "eagleSecClassification": "eagleSecClassification",
    # System-Specific Tables
    "eagleEntity": "eagleEntity",
    "eagleMaster": "eagleMaster",
    # RECON-AI Application Tables
    "events": "events",
    "validationRuns": "validationRuns",
    "validationResults": "validationResults",
    "breakRecords": "breakRecords",
    "activityFeed": "activityFeed",
}
