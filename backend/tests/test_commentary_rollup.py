"""
Tests for Commentary CRUD + Rollup Endpoints (backend/api/routers/commentary.py).

Covers:
- Rollup aggregation pipeline produces correct grouping by breakCategory
- Cache hit / miss behaviour (in-memory TTL cache)
- Cache invalidation on create / update / delete operations
- Mock of async DB calls via motor-style collections
"""
import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import sys
sys.path.insert(0, "/Volumes/D/Projects/ReconClareAI/backend")

from api.routers.commentary import (
    _cache_key,
    _invalidate_fund_cache,
    _rollup_cache,
    CACHE_TTL,
    get_commentary_rollup,
    create_commentary,
    update_commentary,
    delete_commentary,
)


# =============================================================================
# Helpers
# =============================================================================

def _make_async_cursor(results: list):
    """Create a mock async cursor that supports .to_list() and .sort()."""
    cursor = AsyncMock()
    cursor.to_list = AsyncMock(return_value=results)
    cursor.sort = MagicMock(return_value=cursor)
    return cursor


def _make_async_aggregate_cursor(results: list):
    """Create a mock async aggregate cursor that supports .to_list()."""
    cursor = AsyncMock()
    cursor.to_list = AsyncMock(return_value=results)
    return cursor


# =============================================================================
# _cache_key() Tests
# =============================================================================

class TestCacheKey:
    def test_with_level(self):
        key = _cache_key("evt-001", "FUND-A", "L2_POSITION")
        assert key == "evt-001:FUND-A:L2_POSITION"

    def test_without_level(self):
        key = _cache_key("evt-001", "FUND-A", None)
        assert key == "evt-001:FUND-A:"


# =============================================================================
# _invalidate_fund_cache() Tests
# =============================================================================

class TestInvalidateFundCache:
    def setup_method(self):
        _rollup_cache.clear()

    def test_removes_matching_entries(self):
        _rollup_cache["evt-001:FUND-A:"] = (time.time(), {"data": 1})
        _rollup_cache["evt-001:FUND-A:L2_POSITION"] = (time.time(), {"data": 2})
        _rollup_cache["evt-001:FUND-B:"] = (time.time(), {"data": 3})

        _invalidate_fund_cache("evt-001", "FUND-A")

        assert "evt-001:FUND-A:" not in _rollup_cache
        assert "evt-001:FUND-A:L2_POSITION" not in _rollup_cache
        # FUND-B should not be affected
        assert "evt-001:FUND-B:" in _rollup_cache

    def test_no_op_when_no_matching_keys(self):
        _rollup_cache["evt-001:FUND-B:"] = (time.time(), {"data": 1})
        _invalidate_fund_cache("evt-001", "FUND-A")
        assert len(_rollup_cache) == 1


# =============================================================================
# get_commentary_rollup() — Cache Behaviour Tests
# =============================================================================

class TestRollupCacheBehaviour:
    def setup_method(self):
        _rollup_cache.clear()

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_cache_miss_queries_db(self, mock_get_db):
        """On cache miss, the endpoint should run the aggregation pipeline."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        agg_results = [
            {
                "_id": "PRICING",
                "totalAmount": 5000.0,
                "count": 3,
                "entries": [
                    {"commentId": "c1", "text": "Stale price", "amount": 2000, "entityReference": "FUND-A/SEC1", "knownDifferenceRef": None, "reconciliationLevel": "L2_POSITION"},
                    {"commentId": "c2", "text": "FX rate diff", "amount": 3000, "entityReference": "FUND-A/SEC2", "knownDifferenceRef": None, "reconciliationLevel": "L2_POSITION"},
                ],
            },
            {
                "_id": "TIMING",
                "totalAmount": 1000.0,
                "count": 1,
                "entries": [
                    {"commentId": "c3", "text": "Settlement lag", "amount": 1000, "entityReference": "FUND-A/SEC3", "knownDifferenceRef": None, "reconciliationLevel": "L2_POSITION"},
                ],
            },
        ]
        mock_collection = MagicMock()
        mock_collection.aggregate = MagicMock(return_value=_make_async_aggregate_cursor(agg_results))
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)

        result = await get_commentary_rollup("evt-001", "FUND-A", level=None)

        assert result["fundAccount"] == "FUND-A"
        assert len(result["categories"]) == 2
        assert result["categories"][0]["breakCategory"] == "PRICING"
        assert result["categories"][0]["totalAmount"] == 5000.0
        assert result["categories"][0]["count"] == 3
        assert result["categories"][1]["breakCategory"] == "TIMING"

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_cache_hit_skips_db(self, mock_get_db):
        """On cache hit within TTL, the DB should NOT be queried."""
        cached_response = {
            "fundAccount": "FUND-A",
            "categories": [{"breakCategory": "CACHED", "totalAmount": 999, "count": 1, "entries": []}],
        }
        ck = _cache_key("evt-001", "FUND-A", None)
        _rollup_cache[ck] = (time.time(), cached_response)

        result = await get_commentary_rollup("evt-001", "FUND-A", level=None)

        # Should return cached data without calling get_async_db
        assert result["categories"][0]["breakCategory"] == "CACHED"
        mock_get_db.assert_not_called()

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_expired_cache_queries_db(self, mock_get_db):
        """If cache entry is older than CACHE_TTL, it should re-query the DB."""
        ck = _cache_key("evt-001", "FUND-A", None)
        _rollup_cache[ck] = (time.time() - CACHE_TTL - 10, {"stale": True})

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_collection = MagicMock()
        mock_collection.aggregate = MagicMock(return_value=_make_async_aggregate_cursor([]))
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)

        result = await get_commentary_rollup("evt-001", "FUND-A", level=None)

        # DB should have been queried since the cache was stale
        mock_get_db.assert_called_once()
        assert result["fundAccount"] == "FUND-A"

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_rollup_stores_result_in_cache(self, mock_get_db):
        """After querying DB, the result should be stored in the cache."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_collection = MagicMock()
        mock_collection.aggregate = MagicMock(return_value=_make_async_aggregate_cursor([]))
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)

        await get_commentary_rollup("evt-002", "FUND-B", level="L1_GL")

        ck = _cache_key("evt-002", "FUND-B", "L1_GL")
        assert ck in _rollup_cache
        cached_time, cached_result = _rollup_cache[ck]
        assert cached_result["fundAccount"] == "FUND-B"

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_rollup_filters_null_categories(self, mock_get_db):
        """Categories with _id=None should be excluded from the response."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        agg_results = [
            {"_id": "PRICING", "totalAmount": 100, "count": 1, "entries": []},
            {"_id": None, "totalAmount": 50, "count": 2, "entries": []},
        ]
        mock_collection = MagicMock()
        mock_collection.aggregate = MagicMock(return_value=_make_async_aggregate_cursor(agg_results))
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)

        result = await get_commentary_rollup("evt-001", "FUND-A", level=None)

        assert len(result["categories"]) == 1
        assert result["categories"][0]["breakCategory"] == "PRICING"

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_rollup_limits_entries_per_category(self, mock_get_db):
        """Each category should have at most 10 entries."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        many_entries = [{"commentId": f"c{i}", "text": f"entry {i}", "amount": i, "entityReference": f"F/S{i}", "knownDifferenceRef": None, "reconciliationLevel": "L2"} for i in range(15)]
        agg_results = [
            {"_id": "PRICING", "totalAmount": 100, "count": 15, "entries": many_entries},
        ]
        mock_collection = MagicMock()
        mock_collection.aggregate = MagicMock(return_value=_make_async_aggregate_cursor(agg_results))
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)

        result = await get_commentary_rollup("evt-001", "FUND-A", level=None)

        assert len(result["categories"][0]["entries"]) <= 10


# =============================================================================
# Cache Invalidation on Create / Update / Delete
# =============================================================================

class TestCacheInvalidationOnCreate:
    def setup_method(self):
        _rollup_cache.clear()

    @pytest.mark.asyncio
    @patch("api.routers.commentary.manager")
    @patch("api.routers.commentary.get_async_db")
    async def test_create_invalidates_cache(self, mock_get_db, mock_manager):
        """Creating a comment should invalidate the rollup cache for that fund."""
        # Seed the cache
        _rollup_cache["evt-001:FUND-A:"] = (time.time(), {"data": 1})
        _rollup_cache["evt-001:FUND-A:L2_POSITION"] = (time.time(), {"data": 2})

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_collection = MagicMock()
        mock_collection.insert_one = AsyncMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)
        mock_manager.broadcast = AsyncMock()

        await create_commentary("evt-001", "FUND-A", {
            "text": "Test comment",
            "breakCategory": "PRICING",
            "amount": 100,
        })

        assert "evt-001:FUND-A:" not in _rollup_cache
        assert "evt-001:FUND-A:L2_POSITION" not in _rollup_cache


class TestCacheInvalidationOnUpdate:
    def setup_method(self):
        _rollup_cache.clear()

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_update_invalidates_cache(self, mock_get_db):
        """Updating a comment should invalidate the rollup cache for the owning fund."""
        _rollup_cache["evt-001:FUND-A:"] = (time.time(), {"data": 1})

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_collection = MagicMock()
        mock_collection.find_one = AsyncMock(return_value={
            "commentId": "c1",
            "eventId": "evt-001",
            "entityReference": "FUND-A/SEC/ABC",
        })
        mock_collection.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)

        await update_commentary("c1", {"text": "Updated text"})

        assert "evt-001:FUND-A:" not in _rollup_cache

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_update_invalidates_correct_fund_when_entity_has_slash(self, mock_get_db):
        """Cache invalidation should parse fund account from entityReference split on '/'."""
        _rollup_cache["evt-001:ACC123:"] = (time.time(), {"data": 1})
        _rollup_cache["evt-001:OTHER:"] = (time.time(), {"data": 2})

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_collection = MagicMock()
        mock_collection.find_one = AsyncMock(return_value={
            "commentId": "c1",
            "eventId": "evt-001",
            "entityReference": "ACC123/L2/SEC",
        })
        mock_collection.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)

        await update_commentary("c1", {"text": "Updated"})

        assert "evt-001:ACC123:" not in _rollup_cache
        # Other fund cache should be unaffected
        assert "evt-001:OTHER:" in _rollup_cache


class TestCacheInvalidationOnDelete:
    def setup_method(self):
        _rollup_cache.clear()

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_delete_invalidates_cache(self, mock_get_db):
        """Deleting a comment should invalidate the rollup cache for that fund."""
        _rollup_cache["evt-001:FUND-A:"] = (time.time(), {"data": 1})

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_collection = MagicMock()
        mock_collection.find_one = AsyncMock(return_value={
            "commentId": "c1",
            "eventId": "evt-001",
            "entityReference": "FUND-A/SEC/XYZ",
        })
        mock_collection.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)

        await delete_commentary("c1")

        assert "evt-001:FUND-A:" not in _rollup_cache

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_delete_nonexistent_raises_404(self, mock_get_db):
        """Deleting a non-existent comment should raise 404."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_collection = MagicMock()
        mock_collection.find_one = AsyncMock(return_value=None)
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await delete_commentary("nonexistent-id")
        assert exc_info.value.status_code == 404


# =============================================================================
# Rollup Aggregation Pipeline Structure Tests
# =============================================================================

class TestRollupAggregationPipeline:
    def setup_method(self):
        _rollup_cache.clear()

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_pipeline_groups_by_break_category(self, mock_get_db):
        """The aggregation pipeline should group by breakCategory (_id)."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        agg_results = [
            {"_id": "PRICING", "totalAmount": 3000, "count": 2, "entries": [
                {"commentId": "c1", "text": "Price diff", "amount": 1000, "entityReference": "F/S1", "knownDifferenceRef": None, "reconciliationLevel": "L2"},
                {"commentId": "c2", "text": "FX diff", "amount": 2000, "entityReference": "F/S2", "knownDifferenceRef": None, "reconciliationLevel": "L2"},
            ]},
            {"_id": "TIMING", "totalAmount": 500, "count": 1, "entries": [
                {"commentId": "c3", "text": "Settle lag", "amount": 500, "entityReference": "F/S3", "knownDifferenceRef": None, "reconciliationLevel": "L2"},
            ]},
            {"_id": "DATA", "totalAmount": 200, "count": 1, "entries": [
                {"commentId": "c4", "text": "Missing data", "amount": 200, "entityReference": "F/S4", "knownDifferenceRef": None, "reconciliationLevel": "L2"},
            ]},
        ]
        mock_collection = MagicMock()
        mock_collection.aggregate = MagicMock(return_value=_make_async_aggregate_cursor(agg_results))
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)

        result = await get_commentary_rollup("evt-001", "F", level=None)

        categories = result["categories"]
        category_names = [c["breakCategory"] for c in categories]
        assert "PRICING" in category_names
        assert "TIMING" in category_names
        assert "DATA" in category_names

        # Verify counts and totals
        pricing = next(c for c in categories if c["breakCategory"] == "PRICING")
        assert pricing["totalAmount"] == 3000
        assert pricing["count"] == 2
        assert len(pricing["entries"]) == 2

    @pytest.mark.asyncio
    @patch("api.routers.commentary.get_async_db")
    async def test_pipeline_passes_match_stage_with_account_regex(self, mock_get_db):
        """The match stage should filter by eventId and entityReference regex."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        mock_collection = MagicMock()
        captured_pipelines = []

        def capture_aggregate(pipeline):
            captured_pipelines.append(pipeline)
            return _make_async_aggregate_cursor([])

        mock_collection.aggregate = MagicMock(side_effect=capture_aggregate)
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)

        await get_commentary_rollup("evt-001", "FUND-ABC", level=None)

        assert len(captured_pipelines) == 1
        pipeline = captured_pipelines[0]
        match_stage = pipeline[0]["$match"]
        assert match_stage["eventId"] == "evt-001"
        assert match_stage["entityReference"]["$regex"] == "^FUND-ABC"
