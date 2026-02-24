"""
Tests for Client Scorecard with Adjusted RAG Calculations
(backend/api/routers/nav_views.py — get_client_scorecard endpoint).

Covers:
- RAG status determination: |BP| <= 5 -> Green, |BP| <= 50 -> Amber, |BP| > 50 -> Red
- Adjusted difference calculation: difference - KD_total - incumbent_to_resolve
- Adjusted BP calculation: adjusted_diff / |incumbent_total| * 10000
- Edge cases: zero incumbent total, negative BP values, boundary values
"""
import pytest
from typing import Optional, List
from unittest.mock import AsyncMock, MagicMock, patch

import sys
sys.path.insert(0, "/Volumes/D/Projects/ReconClareAI/backend")

from api.routers.nav_views import get_client_scorecard


# =============================================================================
# Helpers
# =============================================================================

def _make_async_cursor(results: list):
    """Create a mock async cursor that supports .to_list()."""
    cursor = AsyncMock()
    cursor.to_list = AsyncMock(return_value=results)
    return cursor


def _make_mock_db(
    event: Optional[dict],
    bny_nav_records: list,
    inc_nav_records: list,
    kd_records: Optional[List[dict]] = None,
    override_records: Optional[List[dict]] = None,
    reviewer_alloc: Optional[dict] = None,
):
    """
    Build a fully-mocked async DB object that returns the specified data.

    The mock must handle multiple collection accesses with different return
    values keyed by the collection name.
    """
    if kd_records is None:
        kd_records = []
    if override_records is None:
        override_records = []

    mock_db = MagicMock()

    collection_mocks = {}

    # events collection
    events_col = MagicMock()
    events_col.find_one = AsyncMock(return_value=event)
    collection_mocks["events"] = events_col

    # knownDifferences collection
    kd_col = MagicMock()
    kd_cursor = _make_async_cursor(kd_records)
    kd_find_mock = MagicMock(return_value=kd_cursor)
    kd_col.find = kd_find_mock
    collection_mocks["knownDifferences"] = kd_col

    # navSummary collection — needs to differentiate BNY vs incumbent
    nav_col = MagicMock()
    nav_call_count = {"n": 0}

    def nav_find(query, projection=None):
        # Alternate between BNY and incumbent results per fund
        user_bank = query.get("userBank")
        if user_bank == "BNY":
            return _make_async_cursor(bny_nav_records)
        else:
            return _make_async_cursor(inc_nav_records)

    nav_col.find = MagicMock(side_effect=nav_find)
    collection_mocks["navSummary"] = nav_col

    # breakAssignments collection (for KD overrides)
    ba_col = MagicMock()
    ba_col.find = MagicMock(return_value=_make_async_cursor(override_records))
    collection_mocks["breakAssignments"] = ba_col

    # reviewerAllocations collection
    ra_col = MagicMock()
    ra_col.find_one = AsyncMock(return_value=reviewer_alloc)
    collection_mocks["reviewerAllocations"] = ra_col

    def getitem(name):
        return collection_mocks.get(name, MagicMock())

    mock_db.__getitem__ = MagicMock(side_effect=getitem)
    return mock_db


# =============================================================================
# RAG Status Determination Tests
# =============================================================================

class TestRAGStatusDetermination:
    """Verify RAG logic: |BP| <= 5 -> Green, |BP| <= 50 -> Amber, |BP| > 50 -> Red."""

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_green_rag_when_bp_within_5(self, mock_get_db):
        """When |BP| <= 5, RAG should be Green."""
        # BNY=1000000, INC=999500 -> diff=500 -> BP = 500/999500*10000 = 5.0025 -> ~5.0
        # Use values that give exactly 5.0 BP: diff=500, inc=1000000 -> BP=5.0
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1000500}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        # diff=500, inc=1000000, BP=500/1000000*10000=5.0
        assert row["basisPointsDifference"] == 5.0
        assert row["rag"] == "Green"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_green_rag_when_bp_below_5(self, mock_get_db):
        """When |BP| < 5, RAG should be Green."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1000000}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["basisPointsDifference"] == 0.0
        assert row["rag"] == "Green"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_amber_rag_when_bp_between_5_and_50(self, mock_get_db):
        """When 5 < |BP| <= 50, RAG should be Amber."""
        # diff=25000, inc=1000000 -> BP=250 -- too high, need BP=25
        # diff=2500, inc=1000000 -> BP=25.0
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1002500}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["basisPointsDifference"] == 25.0
        assert row["rag"] == "Amber"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_amber_rag_at_boundary_50(self, mock_get_db):
        """When |BP| == 50, RAG should be Amber."""
        # diff=5000, inc=1000000 -> BP=50.0
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1005000}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["basisPointsDifference"] == 50.0
        assert row["rag"] == "Amber"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_red_rag_when_bp_above_50(self, mock_get_db):
        """When |BP| > 50, RAG should be Red."""
        # diff=10000, inc=1000000 -> BP=100.0
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1010000}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["basisPointsDifference"] == 100.0
        assert row["rag"] == "Red"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_negative_bp_uses_absolute_value_for_rag(self, mock_get_db):
        """Negative BP should use |BP| for RAG determination."""
        # diff=-10000, inc=1000000 -> BP=-100.0 -> |BP|=100 -> Red
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 990000}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["basisPointsDifference"] == -100.0
        assert row["rag"] == "Red"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_negative_bp_amber_range(self, mock_get_db):
        """Negative BP in amber range should show Amber."""
        # diff=-2500, inc=1000000 -> BP=-25.0 -> |BP|=25 -> Amber
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 997500}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["basisPointsDifference"] == -25.0
        assert row["rag"] == "Amber"


# =============================================================================
# Adjusted Difference Calculation Tests
# =============================================================================

class TestAdjustedDifferenceCalculation:
    """Verify adjusted_difference = difference - KD_total - incumbent_to_resolve."""

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_adjusted_difference_with_no_kd(self, mock_get_db):
        """With no KD amounts, adjusted difference should equal raw difference."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1010000}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records, kd_records=[])
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["netAssetsDifference"] == 10000
        assert row["adjustedNetAssetsDifference"] == 10000

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_adjusted_difference_subtracts_kd_total(self, mock_get_db):
        """Adjusted difference should subtract the sum of all KD override amounts."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1010000}]
        inc_records = [{"netAssets": 1000000}]
        kd_records = [
            {"reference": "KD-001", "summary": "Stale pricing", "isActive": True},
            {"reference": "KD-002", "summary": "FX lag", "isActive": True},
        ]
        # Overrides that match the KD references
        override_records = [
            {"entityReference": "FUND-A/scorecard/KD-001", "breakAmount": 3000},
            {"entityReference": "FUND-A/scorecard/KD-002", "breakAmount": 2000},
        ]

        mock_db = _make_mock_db(event, bny_records, inc_records, kd_records, override_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        # difference=10000, total_kd=5000, incumbent_to_resolve=0
        # adjusted_difference = 10000 - 5000 - 0 = 5000
        assert row["netAssetsDifference"] == 10000
        assert row["adjustedNetAssetsDifference"] == 5000

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_adjusted_difference_kd_no_overrides(self, mock_get_db):
        """When KDs exist but no overrides, KD amounts default to 0."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1010000}]
        inc_records = [{"netAssets": 1000000}]
        kd_records = [
            {"reference": "KD-001", "summary": "Stale pricing", "isActive": True},
        ]

        mock_db = _make_mock_db(event, bny_records, inc_records, kd_records, override_records=[])
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        # No overrides -> kd_amounts all 0 -> adjusted_diff = diff = 10000
        assert row["adjustedNetAssetsDifference"] == 10000


# =============================================================================
# Adjusted BP Calculation Tests
# =============================================================================

class TestAdjustedBPCalculation:
    """Verify adjusted_bp = adjusted_diff / |incumbent_total| * 10000."""

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_adjusted_bp_basic(self, mock_get_db):
        """Basic adjusted BP calculation."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1010000}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        # adjusted_diff = 10000, inc_total = 1000000
        # adjusted_bp = 10000 / 1000000 * 10000 = 100.0
        assert row["adjustedBasisPointsDifference"] == 100.0

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_adjusted_bp_after_kd_subtraction(self, mock_get_db):
        """Adjusted BP should use adjusted difference, not raw difference."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1010000}]
        inc_records = [{"netAssets": 1000000}]
        kd_records = [
            {"reference": "KD-001", "summary": "Stale pricing", "isActive": True},
        ]
        override_records = [
            {"entityReference": "FUND-A/scorecard/KD-001", "breakAmount": 9500},
        ]

        mock_db = _make_mock_db(event, bny_records, inc_records, kd_records, override_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        # diff=10000, total_kd=9500, adjusted_diff=500
        # adjusted_bp = 500 / 1000000 * 10000 = 5.0
        assert row["adjustedBasisPointsDifference"] == 5.0
        assert row["adjustedRag"] == "Green"
        # Raw rag should still be Red (100 BP)
        assert row["rag"] == "Red"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_adjusted_rag_differs_from_raw_rag(self, mock_get_db):
        """Adjusted RAG can differ from raw RAG when KDs bring BP down."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        # diff=5000 -> raw BP=50 -> Amber
        bny_records = [{"netAssets": 1005000}]
        inc_records = [{"netAssets": 1000000}]
        kd_records = [
            {"reference": "KD-001", "summary": "Known diff", "isActive": True},
        ]
        override_records = [
            {"entityReference": "FUND-A/scorecard/KD-001", "breakAmount": 4600},
        ]

        mock_db = _make_mock_db(event, bny_records, inc_records, kd_records, override_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["rag"] == "Amber"
        # adjusted_diff = 5000 - 4600 = 400, adjusted_bp = 400/1000000*10000 = 4.0
        assert row["adjustedBasisPointsDifference"] == 4.0
        assert row["adjustedRag"] == "Green"


# =============================================================================
# Edge Cases
# =============================================================================

class TestEdgeCases:
    """Test edge cases: zero incumbent, no event, multiple funds."""

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_zero_incumbent_total_returns_zero_bp(self, mock_get_db):
        """When incumbent total is 0, BP should be 0 (division guard)."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 5000}]
        inc_records = [{"netAssets": 0}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["basisPointsDifference"] == 0
        assert row["adjustedBasisPointsDifference"] == 0
        assert row["rag"] == "Green"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_zero_incumbent_with_no_bny_returns_zero(self, mock_get_db):
        """When both BNY and incumbent are 0, all values should be 0."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 0}]
        inc_records = [{"netAssets": 0}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["netAssetsDifference"] == 0
        assert row["basisPointsDifference"] == 0
        assert row["rag"] == "Green"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_no_event_returns_empty_list(self, mock_get_db):
        """When event is not found, should return empty list."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        # events collection returns None
        events_col = MagicMock()
        events_col.find_one = AsyncMock(return_value=None)

        # knownDifferences collection
        kd_col = MagicMock()
        kd_col.find = MagicMock(return_value=_make_async_cursor([]))

        def getitem(name):
            if name == "events":
                return events_col
            if name == "knownDifferences":
                return kd_col
            return MagicMock()
        mock_db.__getitem__ = MagicMock(side_effect=getitem)

        result = await get_client_scorecard("nonexistent-evt", valuationDt=None)
        assert result == []

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_multiple_nav_records_summed(self, mock_get_db):
        """Multiple NAV summary records per fund should be summed."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 500000}, {"netAssets": 500000}]
        inc_records = [{"netAssets": 400000}, {"netAssets": 600000}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["bnyNetAssets"] == 1000000
        assert row["incumbentNetAssets"] == 1000000
        assert row["netAssetsDifference"] == 0
        assert row["basisPointsDifference"] == 0.0
        assert row["rag"] == "Green"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_scorecard_includes_kd_metadata(self, mock_get_db):
        """The response should include known difference metadata."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1000000}]
        inc_records = [{"netAssets": 1000000}]
        kd_records = [
            {"reference": "KD-001", "summary": "Stale pricing", "isActive": True},
            {"reference": "KD-002", "summary": "FX lag", "isActive": True},
        ]

        mock_db = _make_mock_db(event, bny_records, inc_records, kd_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        assert "knownDifferences" in result
        kd_list = result["knownDifferences"]
        assert len(kd_list) == 2
        refs = [kd["reference"] for kd in kd_list]
        assert "KD-001" in refs
        assert "KD-002" in refs

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_reviewer_info_included_when_available(self, mock_get_db):
        """When a reviewer allocation exists, it should appear in the scorecard row."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1000000}]
        inc_records = [{"netAssets": 1000000}]
        reviewer_alloc = {
            "assignedReviewerName": "Jane Doe",
            "reviewStatus": "IN_PROGRESS",
        }

        mock_db = _make_mock_db(event, bny_records, inc_records, reviewer_alloc=reviewer_alloc)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["reviewer"] == "Jane Doe"
        assert row["reviewStatus"] == "IN_PROGRESS"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_no_reviewer_defaults_to_not_started(self, mock_get_db):
        """When no reviewer allocation exists, defaults should be used."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1000000}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records, reviewer_alloc=None)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["reviewer"] == ""
        assert row["reviewStatus"] == "Not Started"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_bp_boundary_just_above_5(self, mock_get_db):
        """BP of 5.01 should produce Amber RAG."""
        # diff=501, inc=1000000 -> BP=5.01
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1000501}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["basisPointsDifference"] == 5.01
        assert row["rag"] == "Amber"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_bp_boundary_just_above_50(self, mock_get_db):
        """BP of 50.01 should produce Red RAG."""
        # diff=5001, inc=1000000 -> BP=50.01
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}
        bny_records = [{"netAssets": 1005001}]
        inc_records = [{"netAssets": 1000000}]

        mock_db = _make_mock_db(event, bny_records, inc_records)
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["basisPointsDifference"] == 50.01
        assert row["rag"] == "Red"

    @pytest.mark.asyncio
    @patch("api.routers.nav_views.get_async_db")
    async def test_no_nav_records_all_zeros(self, mock_get_db):
        """When no NAV records exist, totals should be 0."""
        event = {"eventId": "evt-001", "funds": [{"account": "FUND-A", "fundName": "Alpha"}]}

        mock_db = _make_mock_db(event, bny_nav_records=[], inc_nav_records=[])
        mock_get_db.return_value = mock_db

        result = await get_client_scorecard("evt-001", valuationDt="2025-01-15")

        row = result["rows"][0]
        assert row["bnyNetAssets"] == 0
        assert row["incumbentNetAssets"] == 0
        assert row["netAssetsDifference"] == 0
        assert row["basisPointsDifference"] == 0
        assert row["rag"] == "Green"
