"""
Integration tests for RECON-AI API endpoints.

Tests each router's main endpoints using httpx.AsyncClient with mocked MongoDB.
Covers: Allocations, Known Differences, Break Resolution, Commentary,
        Notifications, Export, and Audit endpoints.
"""

import pytest
import sys
import os
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from httpx import AsyncClient, ASGITransport
from api.main import app


# ═══════════════════════════════════════════════════════════════
# Mock MongoDB helpers
# ═══════════════════════════════════════════════════════════════

class MockCursor:
    """Simulates a Motor async cursor with chaining support."""

    def __init__(self, data: List[dict]):
        self._data = data

    def sort(self, *args, **kwargs):
        return self

    def skip(self, n: int):
        self._data = self._data[n:]
        return self

    def limit(self, n: int):
        self._data = self._data[:n]
        return self

    async def to_list(self, length: int = 100):
        return self._data[:length]


class MockAggCursor:
    """Simulates aggregate cursor."""

    def __init__(self, data: List[dict]):
        self._data = data

    async def to_list(self, length: int = 100):
        return self._data[:length]


class MockCollection:
    """Simulates a Motor async collection."""

    def __init__(self, name: str, data: Optional[List[dict]] = None):
        self.name = name
        self._data = data or []

    def find(self, query: dict = None, projection: dict = None) -> MockCursor:
        return MockCursor(self._data)

    async def find_one(self, query: dict = None, projection: dict = None):
        if self._data:
            return self._data[0]
        return None

    async def insert_one(self, doc: dict):
        result = MagicMock()
        result.inserted_id = "mock_id"
        return result

    async def insert_many(self, docs: List[dict]):
        result = MagicMock()
        result.inserted_ids = [f"mock_id_{i}" for i in range(len(docs))]
        return result

    async def update_one(self, query: dict, update: dict, upsert: bool = False):
        result = MagicMock()
        result.modified_count = 1
        result.matched_count = 1
        return result

    async def delete_one(self, query: dict):
        result = MagicMock()
        result.deleted_count = 1
        return result

    async def count_documents(self, query: dict = None):
        return len(self._data)

    def aggregate(self, pipeline: List[dict]) -> MockAggCursor:
        return MockAggCursor(self._data)

    async def create_index(self, *args, **kwargs):
        pass


class MockDatabase:
    """Simulates a Motor async database with pre-seeded collections."""

    def __init__(self, collections_data: Optional[Dict[str, List[dict]]] = None):
        self._collections_data = collections_data or {}
        self._collections: Dict[str, MockCollection] = {}

    def __getitem__(self, name: str) -> MockCollection:
        if name not in self._collections:
            data = self._collections_data.get(name, [])
            self._collections[name] = MockCollection(name, data)
        return self._collections[name]

    def seed(self, collection_name: str, data: List[dict]):
        """Seed a collection with test data."""
        self._collections_data[collection_name] = data
        self._collections[collection_name] = MockCollection(collection_name, data)


# ═══════════════════════════════════════════════════════════════
# Test Data Fixtures
# ═══════════════════════════════════════════════════════════════

SAMPLE_ALLOCATIONS = [
    {
        "allocationId": "ALLOC-001",
        "eventId": "EVT-001",
        "bnyAccount": "FUND001",
        "valuationDate": "2026-02-07",
        "assignedReviewerId": "u-fa",
        "assignedReviewerName": "Jane Doe",
        "reviewStatus": "In Progress",
        "createdBy": "system",
        "updatedAt": "2026-02-07T10:00:00",
    },
    {
        "allocationId": "ALLOC-002",
        "eventId": "EVT-001",
        "bnyAccount": "FUND002",
        "valuationDate": "2026-02-07",
        "assignedReviewerId": "u-fa2",
        "assignedReviewerName": "John Smith",
        "reviewStatus": "Not Started",
        "createdBy": "system",
        "updatedAt": "2026-02-07T10:00:00",
    },
]

SAMPLE_KNOWN_DIFFERENCES = [
    {
        "reference": "KD-PRICE-001",
        "type": "Pricing",
        "summary": "Bloomberg vs Reuters pricing source difference",
        "issueDescription": "Different pricing sources for AAPL options",
        "comment": "Expected 2bp variance",
        "isActive": True,
        "eventId": "EVT-001",
        "createdAt": "2026-01-15T10:00:00",
        "updatedBy": "analyst1",
    },
]

SAMPLE_BREAK_ASSIGNMENTS = [
    {
        "entityReference": "FUND001-AAPL",
        "eventId": "EVT-001",
        "valuationDate": "2026-02-07",
        "breakCategory": "Pricing",
        "assignedTeam": "BNY Pricing",
        "assignedOwner": "u-pr1",
        "breakAmount": 15000.50,
        "updatedBy": "system",
    },
    {
        "entityReference": "FUND001-MSFT",
        "eventId": "EVT-001",
        "valuationDate": "2026-02-07",
        "breakCategory": "Trade Capture",
        "assignedTeam": "BNY Trade Capture",
        "assignedOwner": "u-tc1",
        "breakAmount": 5000.25,
        "updatedBy": "system",
    },
]

SAMPLE_BREAK_SUMMARY_AGG = [
    {"_id": "Pricing", "count": 3, "totalAmount": 45000.50},
    {"_id": "Trade Capture", "count": 2, "totalAmount": 12000.25},
]

SAMPLE_COMMENTARY = [
    {
        "commentId": "c-001",
        "eventId": "EVT-001",
        "parentCommentId": None,
        "reconciliationLevel": "L2_POSITION",
        "entityReference": "FUND001/positions/AAPL",
        "breakCategory": "Pricing",
        "amount": 15000.50,
        "text": "Price difference due to Bloomberg vs Reuters source",
        "knownDifferenceRef": "KD-PRICE-001",
        "authorId": "analyst1",
        "createdAt": "2026-02-07T12:00:00",
        "isRolledUp": False,
    },
]

SAMPLE_COMMENTARY_ROLLUP_AGG = [
    {
        "_id": "Pricing",
        "totalAmount": 45000.50,
        "count": 3,
        "entries": [
            {
                "commentId": "c-001",
                "text": "Price difference due to Bloomberg vs Reuters source",
                "amount": 15000.50,
                "entityReference": "FUND001/positions/AAPL",
                "knownDifferenceRef": "KD-PRICE-001",
                "reconciliationLevel": "L2_POSITION",
            },
        ],
    },
]

SAMPLE_NOTIFICATIONS = [
    {
        "notificationId": "NOTIF-001",
        "eventId": "EVT-001",
        "assignedOwner": "u-fa",
        "type": "BREAK_ASSIGNED",
        "title": "New break assigned to you",
        "message": "Break FUND001-AAPL assigned to BNY Pricing",
        "isRead": False,
        "createdAt": "2026-02-07T14:00:00",
    },
    {
        "notificationId": "NOTIF-002",
        "eventId": "EVT-001",
        "assignedOwner": "u-fa",
        "type": "COMMENTARY_ADDED",
        "title": "New commentary on FUND001",
        "message": "analyst1 added commentary on FUND001/positions/AAPL",
        "isRead": True,
        "createdAt": "2026-02-07T13:00:00",
    },
]

SAMPLE_AUDIT_LOGS = [
    {
        "eventId": "EVT-001",
        "action": "BREAK_CATEGORY_CHANGED",
        "entityReference": "FUND001-AAPL",
        "previousValue": "Unclassified",
        "newValue": "Pricing",
        "changedBy": "analyst1",
        "timestamp": "2026-02-07T11:00:00",
    },
    {
        "eventId": "EVT-001",
        "action": "ALLOCATION_CHANGED",
        "entityReference": "FUND001/2026-02-07",
        "previousValue": "John Smith",
        "newValue": "Jane Doe",
        "changedBy": "lead1",
        "timestamp": "2026-02-07T10:30:00",
    },
]


# ═══════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def mock_db():
    """Create a MockDatabase pre-seeded with all test data."""
    db = MockDatabase()
    db.seed("reviewerAllocations", SAMPLE_ALLOCATIONS)
    db.seed("knownDifferences", SAMPLE_KNOWN_DIFFERENCES)
    db.seed("breakAssignments", SAMPLE_BREAK_ASSIGNMENTS)
    db.seed("commentary", SAMPLE_COMMENTARY)
    db.seed("notifications", SAMPLE_NOTIFICATIONS)
    db.seed("auditLogs", SAMPLE_AUDIT_LOGS)
    db.seed("events", [{"eventId": "EVT-001", "status": "ACTIVE", "funds": []}])
    return db


@pytest.fixture
async def client(mock_db):
    """Async httpx client with mocked MongoDB."""
    with patch("db.mongodb.get_async_db", return_value=mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


# ═══════════════════════════════════════════════════════════════
# 1. Allocations Router Tests
# ═══════════════════════════════════════════════════════════════

class TestAllocationsEndpoints:
    """Tests for /api/events/{event_id}/allocations endpoints."""

    @pytest.mark.anyio
    async def test_list_allocations_returns_200(self, client):
        """GET /api/events/EVT-001/allocations returns 200 with list."""
        response = await client.get("/api/events/EVT-001/allocations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        assert data[0]["allocationId"] == "ALLOC-001"

    @pytest.mark.anyio
    async def test_list_allocations_with_date_filter(self, client):
        """GET /api/events/EVT-001/allocations?from=2026-02-07 returns filtered results."""
        response = await client.get(
            "/api/events/EVT-001/allocations",
            params={"from": "2026-02-07"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_get_allocations_for_date(self, client):
        """GET /api/events/EVT-001/allocations/2026-02-07 returns date-specific allocations."""
        response = await client.get("/api/events/EVT-001/allocations/2026-02-07")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_bulk_update_allocations(self, client):
        """PUT /api/events/EVT-001/allocations bulk updates and returns results."""
        updates = [
            {
                "allocationId": "ALLOC-001",
                "reviewerId": "u-fa2",
                "reviewerName": "John Smith",
                "changedBy": "lead1",
            },
        ]
        response = await client.put(
            "/api/events/EVT-001/allocations",
            json=updates,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["allocationId"] == "ALLOC-001"
        assert data[0]["updated"] is True

    @pytest.mark.anyio
    async def test_list_reviewers(self, client):
        """GET /api/users/reviewers returns static reviewer list."""
        response = await client.get("/api/users/reviewers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 10
        # Verify reviewer structure
        first = data[0]
        assert "userId" in first
        assert "userName" in first
        assert "team" in first
        assert "available" in first

    @pytest.mark.anyio
    async def test_copy_allocations(self, client):
        """POST /api/events/EVT-001/allocations/copy copies from one date to another."""
        response = await client.post(
            "/api/events/EVT-001/allocations/copy",
            json={"sourceDate": "2026-02-07", "targetDate": "2026-02-10"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sourceDate"] == "2026-02-07"
        assert data["targetDate"] == "2026-02-10"
        assert "copied" in data

    @pytest.mark.anyio
    async def test_copy_allocations_missing_dates(self, client):
        """POST /api/events/EVT-001/allocations/copy without dates returns 400."""
        response = await client.post(
            "/api/events/EVT-001/allocations/copy",
            json={},
        )
        assert response.status_code == 400

    @pytest.mark.anyio
    async def test_get_allocation_audit(self, client):
        """GET /api/events/EVT-001/allocations/audit returns audit trail."""
        response = await client.get("/api/events/EVT-001/allocations/audit")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


# ═══════════════════════════════════════════════════════════════
# 2. Known Differences Router Tests
# ═══════════════════════════════════════════════════════════════

class TestKnownDifferencesEndpoints:
    """Tests for /api/events/{event_id}/known-differences endpoints."""

    @pytest.mark.anyio
    async def test_list_known_differences_returns_200(self, client):
        """GET /api/events/EVT-001/known-differences returns list of KDs."""
        response = await client.get("/api/events/EVT-001/known-differences")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["reference"] == "KD-PRICE-001"
        assert data[0]["type"] == "Pricing"

    @pytest.mark.anyio
    async def test_list_known_differences_active_filter(self, client):
        """GET /api/events/EVT-001/known-differences?active=true filters by isActive."""
        response = await client.get(
            "/api/events/EVT-001/known-differences",
            params={"active": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_create_known_difference_returns_201(self, client):
        """POST /api/events/EVT-001/known-differences creates a new KD."""
        new_kd = {
            "reference": "KD-TRADE-002",
            "type": "Trade Capture",
            "summary": "Pending settlement for MSFT trades",
            "issueDescription": "T+2 settlement lag causing position difference",
            "comment": "Will resolve after settlement",
            "updatedBy": "analyst1",
        }
        # Patch find_one to return None (no existing KD)
        with patch("db.mongodb.get_async_db") as mock_get_db:
            mock_db_inst = MockDatabase()
            mock_db_inst.seed("knownDifferences", [])
            # Override find_one to return None for duplicate check
            original_collection = mock_db_inst["knownDifferences"]
            original_collection.find_one = AsyncMock(return_value=None)
            mock_get_db.return_value = mock_db_inst

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post(
                    "/api/events/EVT-001/known-differences",
                    json=new_kd,
                )
        assert response.status_code == 201
        data = response.json()
        assert data["reference"] == "KD-TRADE-002"
        assert data["type"] == "Trade Capture"
        assert data["isActive"] is True
        assert "createdAt" in data

    @pytest.mark.anyio
    async def test_create_known_difference_missing_reference(self, client):
        """POST /api/events/EVT-001/known-differences without reference returns 400."""
        response = await client.post(
            "/api/events/EVT-001/known-differences",
            json={"type": "Pricing", "summary": "Missing ref"},
        )
        assert response.status_code == 400

    @pytest.mark.anyio
    async def test_create_known_difference_duplicate_returns_409(self, client):
        """POST duplicate KD reference returns 409."""
        response = await client.post(
            "/api/events/EVT-001/known-differences",
            json={"reference": "KD-PRICE-001", "type": "Pricing"},
        )
        # The mock returns existing data from find_one, so 409
        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_update_known_difference(self, client):
        """PUT /api/events/EVT-001/known-differences/KD-PRICE-001 updates a KD."""
        response = await client.put(
            "/api/events/EVT-001/known-differences/KD-PRICE-001",
            json={"comment": "Updated comment", "updatedBy": "analyst2"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updated"] is True
        assert data["reference"] == "KD-PRICE-001"

    @pytest.mark.anyio
    async def test_update_known_difference_not_found(self, client):
        """PUT nonexistent KD returns 404."""
        with patch("db.mongodb.get_async_db") as mock_get_db:
            mock_db_inst = MockDatabase()
            mock_db_inst.seed("knownDifferences", [])
            # Override update_one to return matched_count=0
            coll = mock_db_inst["knownDifferences"]
            result = MagicMock()
            result.matched_count = 0
            coll.update_one = AsyncMock(return_value=result)
            mock_get_db.return_value = mock_db_inst

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.put(
                    "/api/events/EVT-001/known-differences/NONEXISTENT",
                    json={"comment": "test"},
                )
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_delete_known_difference(self, client):
        """DELETE /api/events/EVT-001/known-differences/KD-PRICE-001 soft-deletes."""
        response = await client.delete(
            "/api/events/EVT-001/known-differences/KD-PRICE-001",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] is True
        assert data["reference"] == "KD-PRICE-001"


# ═══════════════════════════════════════════════════════════════
# 3. Break Resolution Router Tests
# ═══════════════════════════════════════════════════════════════

class TestBreakResolutionEndpoints:
    """Tests for /api/breaks/ and /api/events/{event_id}/break-summary endpoints."""

    @pytest.mark.anyio
    async def test_update_break_category(self, client):
        """PUT /api/breaks/FUND001-AAPL/category updates category."""
        response = await client.put(
            "/api/breaks/FUND001-AAPL/category",
            json={
                "breakCategory": "Pricing",
                "eventId": "EVT-001",
                "changedBy": "analyst1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updated"] is True
        assert data["entityReference"] == "FUND001-AAPL"
        assert data["breakCategory"] == "Pricing"

    @pytest.mark.anyio
    async def test_update_break_team(self, client):
        """PUT /api/breaks/FUND001-AAPL/team updates team assignment."""
        response = await client.put(
            "/api/breaks/FUND001-AAPL/team",
            json={
                "assignedTeam": "BNY Pricing",
                "assignedOwner": "u-pr1",
                "eventId": "EVT-001",
                "changedBy": "lead1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updated"] is True
        assert data["entityReference"] == "FUND001-AAPL"
        assert data["assignedTeam"] == "BNY Pricing"

    @pytest.mark.anyio
    async def test_get_break_summary(self, client):
        """GET /api/events/EVT-001/break-summary returns aggregated summary."""
        with patch("db.mongodb.get_async_db") as mock_get_db:
            mock_db_inst = MockDatabase()
            # Set up the breakAssignments collection to return aggregation data
            coll = mock_db_inst["breakAssignments"]
            coll.aggregate = lambda pipeline: MockAggCursor(SAMPLE_BREAK_SUMMARY_AGG)
            mock_get_db.return_value = mock_db_inst

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/events/EVT-001/break-summary")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "Pricing" in data
        assert data["Pricing"]["count"] == 3
        assert data["Pricing"]["totalAmount"] == 45000.50
        assert "Trade Capture" in data

    @pytest.mark.anyio
    async def test_get_break_summary_with_date_filter(self, client):
        """GET /api/events/EVT-001/break-summary?valuationDt=2026-02-07 works."""
        response = await client.get(
            "/api/events/EVT-001/break-summary",
            params={"valuationDt": "2026-02-07"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    @pytest.mark.anyio
    async def test_update_review_status(self, client):
        """PUT /api/events/EVT-001/funds/FUND001/review-status updates status."""
        response = await client.put(
            "/api/events/EVT-001/funds/FUND001/review-status",
            json={
                "reviewStatus": "Completed",
                "valuationDt": "2026-02-07",
                "changedBy": "lead1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updated"] is True
        assert data["account"] == "FUND001"
        assert data["reviewStatus"] == "Completed"


# ═══════════════════════════════════════════════════════════════
# 4. Commentary Router Tests
# ═══════════════════════════════════════════════════════════════

class TestCommentaryEndpoints:
    """Tests for /api/events/{event_id}/funds/{account}/commentary endpoints."""

    @pytest.mark.anyio
    async def test_list_commentary_returns_200(self, client):
        """GET /api/events/EVT-001/funds/FUND001/commentary returns list."""
        response = await client.get("/api/events/EVT-001/funds/FUND001/commentary")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["commentId"] == "c-001"
        assert data[0]["text"] == "Price difference due to Bloomberg vs Reuters source"

    @pytest.mark.anyio
    async def test_list_commentary_with_level_filter(self, client):
        """GET with level=L2_POSITION filters by reconciliation level."""
        response = await client.get(
            "/api/events/EVT-001/funds/FUND001/commentary",
            params={"level": "L2_POSITION"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_create_commentary_returns_201(self, client):
        """POST /api/events/EVT-001/funds/FUND001/commentary creates commentary."""
        new_comment = {
            "reconciliationLevel": "L2_POSITION",
            "entityReference": "FUND001/positions/MSFT",
            "breakCategory": "Trade Capture",
            "amount": 5000.25,
            "text": "Pending settlement for MSFT",
            "authorId": "analyst1",
        }
        with patch("db.mongodb.get_async_db") as mock_get_db:
            mock_db_inst = MockDatabase()
            mock_db_inst.seed("commentary", [])
            mock_db_inst.seed("auditLogs", [])
            mock_get_db.return_value = mock_db_inst

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post(
                    "/api/events/EVT-001/funds/FUND001/commentary",
                    json=new_comment,
                )
        assert response.status_code == 201
        data = response.json()
        assert "commentId" in data
        assert data["eventId"] == "EVT-001"
        assert data["text"] == "Pending settlement for MSFT"
        assert data["breakCategory"] == "Trade Capture"
        assert data["isRolledUp"] is False
        assert "createdAt" in data

    @pytest.mark.anyio
    async def test_update_commentary(self, client):
        """PUT /api/commentary/c-001 updates commentary text."""
        response = await client.put(
            "/api/commentary/c-001",
            json={"text": "Updated comment text", "amount": 16000.00},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updated"] is True
        assert data["commentId"] == "c-001"

    @pytest.mark.anyio
    async def test_update_commentary_not_found(self, client):
        """PUT /api/commentary/NONEXISTENT returns 404."""
        with patch("db.mongodb.get_async_db") as mock_get_db:
            mock_db_inst = MockDatabase()
            coll = mock_db_inst["commentary"]
            coll.find_one = AsyncMock(return_value=None)
            mock_get_db.return_value = mock_db_inst

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.put(
                    "/api/commentary/NONEXISTENT",
                    json={"text": "test"},
                )
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_delete_commentary(self, client):
        """DELETE /api/commentary/c-001 deletes commentary."""
        response = await client.delete("/api/commentary/c-001")
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] is True
        assert data["commentId"] == "c-001"

    @pytest.mark.anyio
    async def test_delete_commentary_not_found(self, client):
        """DELETE /api/commentary/NONEXISTENT returns 404."""
        with patch("db.mongodb.get_async_db") as mock_get_db:
            mock_db_inst = MockDatabase()
            coll = mock_db_inst["commentary"]
            coll.find_one = AsyncMock(return_value=None)
            mock_get_db.return_value = mock_db_inst

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.delete("/api/commentary/NONEXISTENT")
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_get_commentary_rollup(self, client):
        """GET /api/events/EVT-001/funds/FUND001/commentary/rollup returns rollup."""
        with patch("db.mongodb.get_async_db") as mock_get_db:
            mock_db_inst = MockDatabase()
            coll = mock_db_inst["commentary"]
            coll.aggregate = lambda pipeline: MockAggCursor(SAMPLE_COMMENTARY_ROLLUP_AGG)
            mock_get_db.return_value = mock_db_inst

            # Clear the in-memory cache to avoid stale data
            from api.routers.commentary import _rollup_cache
            _rollup_cache.clear()

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get(
                    "/api/events/EVT-001/funds/FUND001/commentary/rollup",
                )
        assert response.status_code == 200
        data = response.json()
        assert "fundAccount" in data
        assert data["fundAccount"] == "FUND001"
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert len(data["categories"]) == 1
        assert data["categories"][0]["breakCategory"] == "Pricing"
        assert data["categories"][0]["totalAmount"] == 45000.50
        assert data["categories"][0]["count"] == 3


# ═══════════════════════════════════════════════════════════════
# 5. Notifications Router Tests
# ═══════════════════════════════════════════════════════════════

class TestNotificationsEndpoints:
    """Tests for /api/notifications endpoints."""

    @pytest.mark.anyio
    async def test_list_notifications_returns_200(self, client):
        """GET /api/notifications returns notification list."""
        response = await client.get(
            "/api/notifications",
            params={"userId": "u-fa"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_list_notifications_unread_filter(self, client):
        """GET /api/notifications?isRead=false filters unread."""
        response = await client.get(
            "/api/notifications",
            params={"userId": "u-fa", "isRead": False},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_mark_notification_read(self, client):
        """PUT /api/notifications/NOTIF-001/read marks as read."""
        response = await client.put("/api/notifications/NOTIF-001/read")
        assert response.status_code == 200
        data = response.json()
        assert data["updated"] is True

    @pytest.mark.anyio
    async def test_mark_notification_read_not_found(self, client):
        """PUT /api/notifications/NONEXISTENT/read returns 404."""
        with patch("db.mongodb.get_async_db") as mock_get_db:
            mock_db_inst = MockDatabase()
            coll = mock_db_inst["notifications"]
            result = MagicMock()
            result.matched_count = 0
            coll.update_one = AsyncMock(return_value=result)
            mock_get_db.return_value = mock_db_inst

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.put("/api/notifications/NONEXISTENT/read")
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_get_notification_count(self, client):
        """GET /api/notifications/count returns unread count."""
        response = await client.get(
            "/api/notifications/count",
            params={"userId": "u-fa"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "unreadCount" in data
        assert isinstance(data["unreadCount"], int)

    @pytest.mark.anyio
    async def test_get_notification_count_default_user(self, client):
        """GET /api/notifications/count without userId uses default."""
        response = await client.get("/api/notifications/count")
        assert response.status_code == 200
        data = response.json()
        assert "unreadCount" in data


# ═══════════════════════════════════════════════════════════════
# 6. Export Router Tests
# ═══════════════════════════════════════════════════════════════

class TestExportEndpoints:
    """Tests for /api/export/excel endpoint."""

    @pytest.mark.anyio
    async def test_export_excel_returns_streaming_response(self, client):
        """POST /api/export/excel returns a streaming Excel file."""
        response = await client.post(
            "/api/export/excel",
            json={
                "viewType": "nav-fund-level",
                "eventId": "EVT-001",
                "filters": {},
                "exportedBy": "TestUser",
            },
        )
        assert response.status_code == 200
        content_type = response.headers.get("content-type", "")
        assert "spreadsheetml" in content_type or "octet-stream" in content_type
        # Verify Content-Disposition header contains filename
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp
        assert "EVT-001" in content_disp
        assert ".xlsx" in content_disp
        # Verify response body is non-empty binary (XLSX magic bytes start with PK)
        assert len(response.content) > 0

    @pytest.mark.anyio
    async def test_export_excel_generic_view(self, client):
        """POST /api/export/excel with generic viewType returns valid response."""
        response = await client.post(
            "/api/export/excel",
            json={
                "viewType": "generic",
                "eventId": "EVT-001",
            },
        )
        assert response.status_code == 200
        assert len(response.content) > 0

    @pytest.mark.anyio
    async def test_export_excel_client_scorecard(self, client):
        """POST /api/export/excel with client-scorecard viewType."""
        response = await client.post(
            "/api/export/excel",
            json={
                "viewType": "client-scorecard",
                "eventId": "EVT-001",
                "exportedBy": "ReconLead",
            },
        )
        assert response.status_code == 200
        content_disp = response.headers.get("content-disposition", "")
        assert "client-scorecard" in content_disp


# ═══════════════════════════════════════════════════════════════
# 7. Audit Router Tests
# ═══════════════════════════════════════════════════════════════

class TestAuditEndpoints:
    """Tests for /api/events/{event_id}/audit endpoints."""

    @pytest.mark.anyio
    async def test_list_audit_logs_returns_200(self, client):
        """GET /api/events/EVT-001/audit returns audit log list with pagination."""
        response = await client.get("/api/events/EVT-001/audit")
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        assert isinstance(data["logs"], list)

    @pytest.mark.anyio
    async def test_list_audit_logs_with_action_filter(self, client):
        """GET /api/events/EVT-001/audit?action=BREAK_CATEGORY_CHANGED filters by action."""
        response = await client.get(
            "/api/events/EVT-001/audit",
            params={"action": "BREAK_CATEGORY_CHANGED"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert isinstance(data["logs"], list)

    @pytest.mark.anyio
    async def test_list_audit_logs_with_entity_filter(self, client):
        """GET /api/events/EVT-001/audit?entity=FUND001 filters by entity reference."""
        response = await client.get(
            "/api/events/EVT-001/audit",
            params={"entity": "FUND001"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data

    @pytest.mark.anyio
    async def test_list_audit_logs_with_user_filter(self, client):
        """GET /api/events/EVT-001/audit?user=analyst1 filters by changedBy."""
        response = await client.get(
            "/api/events/EVT-001/audit",
            params={"user": "analyst1"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data

    @pytest.mark.anyio
    async def test_list_audit_logs_with_date_range(self, client):
        """GET /api/events/EVT-001/audit with date range filters."""
        response = await client.get(
            "/api/events/EVT-001/audit",
            params={
                "from": "2026-02-07T00:00:00",
                "to": "2026-02-07T23:59:59",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data

    @pytest.mark.anyio
    async def test_list_audit_logs_pagination(self, client):
        """GET /api/events/EVT-001/audit with limit and offset."""
        response = await client.get(
            "/api/events/EVT-001/audit",
            params={"limit": 10, "offset": 0},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 10
        assert data["offset"] == 0

    @pytest.mark.anyio
    async def test_list_audit_logs_all_filters_combined(self, client):
        """GET /api/events/EVT-001/audit with all filters combined."""
        response = await client.get(
            "/api/events/EVT-001/audit",
            params={
                "action": "ALLOCATION_CHANGED",
                "entity": "FUND001",
                "user": "lead1",
                "from": "2026-02-01",
                "to": "2026-02-28",
                "limit": 50,
                "offset": 0,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert data["limit"] == 50


# ═══════════════════════════════════════════════════════════════
# 8. Main App Endpoint Tests (non-router)
# ═══════════════════════════════════════════════════════════════

class TestMainAppEndpoints:
    """Tests for endpoints defined directly on the app (events, breaks, etc.)."""

    @pytest.mark.anyio
    async def test_list_events(self, client):
        """GET /api/events returns list of events."""
        response = await client.get("/api/events")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_get_event(self, client):
        """GET /api/events/EVT-001 returns a single event."""
        response = await client.get("/api/events/EVT-001")
        assert response.status_code == 200
        data = response.json()
        assert data["eventId"] == "EVT-001"

    @pytest.mark.anyio
    async def test_get_event_not_found(self, client):
        """GET /api/events/NONEXISTENT returns 404."""
        with patch("db.mongodb.get_async_db") as mock_get_db:
            mock_db_inst = MockDatabase()
            coll = mock_db_inst["events"]
            coll.find_one = AsyncMock(return_value=None)
            mock_get_db.return_value = mock_db_inst

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/api/events/NONEXISTENT")
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_list_breaks(self, client):
        """GET /api/breaks returns break records."""
        response = await client.get("/api/breaks")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_list_breaks_with_filters(self, client):
        """GET /api/breaks with filters."""
        response = await client.get(
            "/api/breaks",
            params={"fund_account": "FUND001", "state": "DETECTED"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_list_reviewable_breaks(self, client):
        """GET /api/breaks/reviewable returns reviewable breaks."""
        response = await client.get("/api/breaks/reviewable")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_list_activity_feed(self, client):
        """GET /api/activity returns activity feed."""
        response = await client.get("/api/activity")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_list_validation_checks(self, client):
        """GET /api/validation-checks returns check definitions."""
        response = await client.get("/api/validation-checks")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
