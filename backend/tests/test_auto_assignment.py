"""
Tests for the Auto-Assignment Engine (backend/services/auto_assignment.py).

Covers:
- _match_rule(): break-type to team routing
- _get_next_owner(): round-robin distribution across team members
- auto_assign_break(): end-to-end assignment with DB writes
- auto_assign_breaks_batch(): batch processing
"""
import pytest
from unittest.mock import patch, MagicMock, call

import sys
sys.path.insert(0, "/Volumes/D/Projects/ReconClareAI/backend")

from services.auto_assignment import (
    _match_rule,
    _get_next_owner,
    auto_assign_break,
    auto_assign_breaks_batch,
    ASSIGNMENT_RULES,
    TEAM_ROSTERS,
    _round_robin_counters,
)


# =============================================================================
# _match_rule() Tests
# =============================================================================

class TestMatchRule:
    """Verify break-type to default-team routing."""

    def test_share_maps_to_trade_capture(self):
        rule = _match_rule("SHARE")
        assert rule["defaultTeam"] == "TRADE_CAPTURE"
        assert rule["priority"] == 1

    def test_price_maps_to_pricing(self):
        rule = _match_rule("PRICE")
        assert rule["defaultTeam"] == "PRICING"
        assert rule["priority"] == 2

    def test_income_maps_to_income(self):
        rule = _match_rule("INCOME")
        assert rule["defaultTeam"] == "INCOME"
        assert rule["priority"] == 3

    def test_reclaim_maps_to_income(self):
        rule = _match_rule("RECLAIM")
        assert rule["defaultTeam"] == "INCOME"
        assert rule["priority"] == 4

    def test_derivative_maps_to_derivatives(self):
        rule = _match_rule("DERIVATIVE")
        assert rule["defaultTeam"] == "DERIVATIVES"
        assert rule["priority"] == 5

    def test_other_maps_to_nav_oversight(self):
        rule = _match_rule("OTHER")
        assert rule["defaultTeam"] == "NAV_OVERSIGHT"
        assert rule["priority"] == 99

    def test_unknown_type_falls_back_to_other(self):
        rule = _match_rule("NONEXISTENT_TYPE")
        assert rule["defaultTeam"] == "NAV_OVERSIGHT"
        assert rule["priority"] == 99

    def test_empty_string_falls_back_to_other(self):
        rule = _match_rule("")
        assert rule["defaultTeam"] == "NAV_OVERSIGHT"

    def test_all_rules_have_required_keys(self):
        for rule in ASSIGNMENT_RULES:
            assert "breakType" in rule
            assert "defaultTeam" in rule
            assert "priority" in rule


# =============================================================================
# _get_next_owner() Tests
# =============================================================================

class TestGetNextOwner:
    """Verify round-robin distribution alternates between team members."""

    def setup_method(self):
        """Clear round-robin counters before each test."""
        _round_robin_counters.clear()

    def test_first_call_returns_first_member(self):
        owner = _get_next_owner("PRICING", "evt-001")
        assert owner == "Mark Chen"

    def test_second_call_returns_second_member(self):
        _get_next_owner("PRICING", "evt-001")
        owner = _get_next_owner("PRICING", "evt-001")
        assert owner == "Amy Liu"

    def test_third_call_wraps_around_to_first_member(self):
        _get_next_owner("PRICING", "evt-001")
        _get_next_owner("PRICING", "evt-001")
        owner = _get_next_owner("PRICING", "evt-001")
        assert owner == "Mark Chen"

    def test_different_events_have_independent_counters(self):
        owner_a = _get_next_owner("PRICING", "evt-001")
        owner_b = _get_next_owner("PRICING", "evt-002")
        # Both should return the first member since they are separate events
        assert owner_a == "Mark Chen"
        assert owner_b == "Mark Chen"

    def test_different_teams_have_independent_counters(self):
        owner_pricing = _get_next_owner("PRICING", "evt-001")
        owner_income = _get_next_owner("INCOME", "evt-001")
        assert owner_pricing == "Mark Chen"
        assert owner_income == "Karen Wu"

    def test_unknown_team_returns_empty_string(self):
        owner = _get_next_owner("NONEXISTENT_TEAM", "evt-001")
        assert owner == ""

    def test_round_robin_counter_key_format(self):
        _get_next_owner("TRADE_CAPTURE", "evt-abc")
        assert "evt-abc:TRADE_CAPTURE" in _round_robin_counters

    def test_round_robin_counter_increments(self):
        _get_next_owner("DERIVATIVES", "evt-001")
        assert _round_robin_counters["evt-001:DERIVATIVES"] == 1
        _get_next_owner("DERIVATIVES", "evt-001")
        assert _round_robin_counters["evt-001:DERIVATIVES"] == 2

    def test_all_teams_in_roster_return_valid_owners(self):
        for team, members in TEAM_ROSTERS.items():
            owner = _get_next_owner(team, "evt-roster-test")
            assert owner in members, f"Expected owner from {team}, got '{owner}'"


# =============================================================================
# auto_assign_break() Tests
# =============================================================================

class TestAutoAssignBreak:
    """Verify end-to-end assignment creates assignment, notification, and audit records."""

    def setup_method(self):
        _round_robin_counters.clear()

    @patch("services.auto_assignment.get_sync_db")
    def test_creates_assignment_record(self, mock_get_db):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.__getitem__ = MagicMock(return_value=MagicMock())
        # No existing assignment
        mock_db.__getitem__.return_value.find_one.return_value = None

        result = auto_assign_break(
            event_id="evt-001",
            valuation_date="2025-01-15",
            entity_reference="FUND-A/SHARE/AAPL",
            break_type="SHARE",
            break_amount=1500.0,
            fund_account="FUND-A",
            fund_name="Alpha Fund",
        )

        assert result["eventId"] == "evt-001"
        assert result["valuationDate"] == "2025-01-15"
        assert result["entityReference"] == "FUND-A/SHARE/AAPL"
        assert result["breakType"] == "SHARE"
        assert result["assignedTeam"] == "TRADE_CAPTURE"
        assert result["assignedOwner"] in TEAM_ROSTERS["TRADE_CAPTURE"]
        assert result["reviewStatus"] == "NOT_STARTED"
        assert result["autoAssigned"] is True
        assert result["breakCategory"] == "UNDER_INVESTIGATION"
        assert result["breakAmount"] == 1500.0

    @patch("services.auto_assignment.get_sync_db")
    def test_inserts_into_break_assignments_collection(self, mock_get_db):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        collections = {}
        def getitem(name):
            if name not in collections:
                collections[name] = MagicMock()
                collections[name].find_one.return_value = None
            return collections[name]
        mock_db.__getitem__ = MagicMock(side_effect=getitem)

        auto_assign_break(
            event_id="evt-001",
            valuation_date="2025-01-15",
            entity_reference="FUND-A/PRICE/AAPL",
            break_type="PRICE",
        )

        # Verify insert_one was called on breakAssignments collection
        ba_collection = collections["breakAssignments"]
        ba_collection.insert_one.assert_called_once()
        inserted_doc = ba_collection.insert_one.call_args[0][0]
        assert inserted_doc["assignedTeam"] == "PRICING"

    @patch("services.auto_assignment.get_sync_db")
    def test_creates_notification_for_assigned_owner(self, mock_get_db):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        collections = {}
        def getitem(name):
            if name not in collections:
                collections[name] = MagicMock()
                collections[name].find_one.return_value = None
            return collections[name]
        mock_db.__getitem__ = MagicMock(side_effect=getitem)

        auto_assign_break(
            event_id="evt-001",
            valuation_date="2025-01-15",
            entity_reference="FUND-A/INCOME/BOND1",
            break_type="INCOME",
            fund_account="FUND-A",
            fund_name="Alpha Fund",
        )

        notif_collection = collections["notifications"]
        notif_collection.insert_one.assert_called_once()
        notification = notif_collection.insert_one.call_args[0][0]
        assert notification["eventId"] == "evt-001"
        assert notification["breakType"] == "INCOME"
        assert notification["channel"] == "IN_APP"
        assert notification["isRead"] is False
        assert "income break" in notification["message"].lower()

    @patch("services.auto_assignment.get_sync_db")
    def test_creates_audit_log(self, mock_get_db):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        collections = {}
        def getitem(name):
            if name not in collections:
                collections[name] = MagicMock()
                collections[name].find_one.return_value = None
            return collections[name]
        mock_db.__getitem__ = MagicMock(side_effect=getitem)

        auto_assign_break(
            event_id="evt-001",
            valuation_date="2025-01-15",
            entity_reference="FUND-A/DERIV/FUT1",
            break_type="DERIVATIVE",
        )

        audit_collection = collections["auditLogs"]
        audit_collection.insert_one.assert_called_once()
        audit = audit_collection.insert_one.call_args[0][0]
        assert audit["action"] == "AUTO_ASSIGNMENT"
        assert audit["entityReference"] == "FUND-A/DERIV/FUT1"
        assert audit["changedBy"] == "auto-assignment-engine"
        assert audit["previousValue"] is None
        assert "DERIVATIVES/" in audit["newValue"]

    @patch("services.auto_assignment.get_sync_db")
    def test_skips_if_assignment_already_exists(self, mock_get_db):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        existing_doc = {
            "_id": "mongo-id",
            "eventId": "evt-001",
            "entityReference": "FUND-A/SHARE/AAPL",
            "valuationDate": "2025-01-15",
            "assignedTeam": "TRADE_CAPTURE",
            "assignedOwner": "Sarah Kim",
        }
        collections = {}
        def getitem(name):
            if name not in collections:
                collections[name] = MagicMock()
                # breakAssignments find_one returns existing doc
                collections[name].find_one.return_value = existing_doc
            return collections[name]
        mock_db.__getitem__ = MagicMock(side_effect=getitem)

        result = auto_assign_break(
            event_id="evt-001",
            valuation_date="2025-01-15",
            entity_reference="FUND-A/SHARE/AAPL",
            break_type="SHARE",
        )

        # Should return existing (without _id) and NOT call insert_one
        assert "_id" not in result
        assert result["assignedTeam"] == "TRADE_CAPTURE"
        ba_collection = collections["breakAssignments"]
        ba_collection.insert_one.assert_not_called()

    @patch("services.auto_assignment.get_sync_db")
    def test_no_notification_when_owner_empty(self, mock_get_db):
        """If the team roster is empty, no notification should be created."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        collections = {}
        def getitem(name):
            if name not in collections:
                collections[name] = MagicMock()
                collections[name].find_one.return_value = None
            return collections[name]
        mock_db.__getitem__ = MagicMock(side_effect=getitem)

        # Temporarily patch TEAM_ROSTERS to simulate unknown team
        with patch("services.auto_assignment.TEAM_ROSTERS", {"NAV_OVERSIGHT": []}):
            auto_assign_break(
                event_id="evt-001",
                valuation_date="2025-01-15",
                entity_reference="FUND-A/OTHER/X",
                break_type="OTHER",
            )

        # The notifications collection should either not be accessed at all,
        # or if accessed, insert_one should not have been called
        if "notifications" in collections:
            collections["notifications"].insert_one.assert_not_called()
        # If not in collections, it was never accessed — which is the expected path

    @patch("services.auto_assignment.get_sync_db")
    def test_assignment_has_correct_timestamp_fields(self, mock_get_db):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        collections = {}
        def getitem(name):
            if name not in collections:
                collections[name] = MagicMock()
                collections[name].find_one.return_value = None
            return collections[name]
        mock_db.__getitem__ = MagicMock(side_effect=getitem)

        result = auto_assign_break(
            event_id="evt-001",
            valuation_date="2025-01-15",
            entity_reference="FUND-A/SHARE/X",
            break_type="SHARE",
        )

        assert "assignedAt" in result
        # ISO format should contain 'T'
        assert "T" in result["assignedAt"]


# =============================================================================
# auto_assign_breaks_batch() Tests
# =============================================================================

class TestAutoAssignBreaksBatch:
    """Verify batch processing delegates to auto_assign_break for each break."""

    def setup_method(self):
        _round_robin_counters.clear()

    @patch("services.auto_assignment.auto_assign_break")
    def test_calls_auto_assign_for_each_break(self, mock_assign):
        mock_assign.return_value = {"eventId": "evt-001", "assignedTeam": "PRICING"}

        breaks = [
            {"entityReference": "FUND/PRICE/A", "breakType": "PRICE"},
            {"entityReference": "FUND/SHARE/B", "breakType": "SHARE"},
            {"entityReference": "FUND/INCOME/C", "breakType": "INCOME"},
        ]

        results = auto_assign_breaks_batch("evt-001", "2025-01-15", breaks)

        assert mock_assign.call_count == 3
        assert len(results) == 3

    @patch("services.auto_assignment.auto_assign_break")
    def test_passes_correct_arguments_to_each_call(self, mock_assign):
        mock_assign.return_value = {"eventId": "evt-001"}

        breaks = [
            {
                "entityReference": "FUND/PRICE/A",
                "breakType": "PRICE",
                "reconciliationLevel": "L1_GL",
                "breakAmount": 500.0,
                "fundAccount": "FUND-A",
                "fundName": "Alpha Fund",
            },
        ]

        auto_assign_breaks_batch("evt-001", "2025-01-15", breaks)

        mock_assign.assert_called_once_with(
            event_id="evt-001",
            valuation_date="2025-01-15",
            entity_reference="FUND/PRICE/A",
            break_type="PRICE",
            reconciliation_level="L1_GL",
            break_amount=500.0,
            fund_account="FUND-A",
            fund_name="Alpha Fund",
        )

    @patch("services.auto_assignment.auto_assign_break")
    def test_uses_defaults_for_optional_fields(self, mock_assign):
        mock_assign.return_value = {}

        breaks = [{"entityReference": "FUND/X/A"}]
        auto_assign_breaks_batch("evt-001", "2025-01-15", breaks)

        mock_assign.assert_called_once_with(
            event_id="evt-001",
            valuation_date="2025-01-15",
            entity_reference="FUND/X/A",
            break_type="OTHER",
            reconciliation_level="L2_POSITION",
            break_amount=0.0,
            fund_account="",
            fund_name="",
        )

    @patch("services.auto_assignment.auto_assign_break")
    def test_empty_batch_returns_empty_list(self, mock_assign):
        results = auto_assign_breaks_batch("evt-001", "2025-01-15", [])
        assert results == []
        mock_assign.assert_not_called()

    @patch("services.auto_assignment.auto_assign_break")
    def test_batch_preserves_order(self, mock_assign):
        mock_assign.side_effect = [
            {"index": 0, "breakType": "SHARE"},
            {"index": 1, "breakType": "PRICE"},
            {"index": 2, "breakType": "INCOME"},
        ]

        breaks = [
            {"entityReference": "A", "breakType": "SHARE"},
            {"entityReference": "B", "breakType": "PRICE"},
            {"entityReference": "C", "breakType": "INCOME"},
        ]

        results = auto_assign_breaks_batch("evt-001", "2025-01-15", breaks)
        assert results[0]["breakType"] == "SHARE"
        assert results[1]["breakType"] == "PRICE"
        assert results[2]["breakType"] == "INCOME"
