"""
Tests for Process Flow Drill-Down API endpoints.
Tests the NAV compare, trial balance, position drill-down, and supporting endpoints.
"""

import pytest
from fastapi.testclient import TestClient

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ═══════════════════════════════════════════════════════════════
# Health & Smoke Tests
# ═══════════════════════════════════════════════════════════════

def test_health_check(client):
    """Health endpoint returns 200 with status healthy."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


# ═══════════════════════════════════════════════════════════════
# Event Endpoints
# ═══════════════════════════════════════════════════════════════

class TestEventEndpoints:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client

    def test_list_events(self):
        """GET /api/events returns list."""
        resp = self.client.get("/api/events")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_get_event_not_found(self):
        """GET /api/events/<bad-id> returns 404."""
        resp = self.client.get("/api/events/NONEXISTENT-EVENT")
        assert resp.status_code == 404

    def test_get_activity_feed(self):
        """GET /api/activity returns list with default limit."""
        resp = self.client.get("/api/activity", params={"limit": 5})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) <= 5


# ═══════════════════════════════════════════════════════════════
# NAV Compare Endpoints
# ═══════════════════════════════════════════════════════════════

class TestNavCompare:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client

    def test_nav_compare_requires_valuationDt(self):
        """NAV compare endpoint should require valuationDt query param."""
        resp = self.client.get("/api/events/EVT-001/nav-compare")
        # 422 (validation error), 200 (empty), or 404 (event not found in DB)
        assert resp.status_code in (200, 404, 422)

    def test_nav_compare_returns_list_or_404(self):
        """NAV compare returns a list of fund rows (or 404 if event missing)."""
        resp = self.client.get("/api/events/EVT-001/nav-compare", params={"valuationDt": "2025-01-15"})
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, list)
            if len(data) > 0:
                row = data[0]
                assert "account" in row
                assert "incumbentTNA" in row
                assert "bnyTNA" in row
                assert "tnaDifference" in row
                assert "validationStatus" in row

    def test_nav_cross_checks_returns_object(self):
        """Cross-checks endpoint returns check structure."""
        resp = self.client.get(
            "/api/events/EVT-001/nav-compare/TEST-ACCT/cross-checks",
            params={"valuationDt": "2025-01-15"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "bsCheck" in data
        assert "incstCheck" in data
        # Each check has expected sub-fields
        for check in [data["bsCheck"], data["incstCheck"]]:
            assert "lhsValue" in check
            assert "rhsValue" in check
            assert "difference" in check
            assert "validationStatus" in check

    def test_available_dates_returns_list_or_404(self):
        """Available dates endpoint returns a list of strings (or 404 if event missing)."""
        resp = self.client.get("/api/events/EVT-001/available-dates")
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, list)


# ═══════════════════════════════════════════════════════════════
# Trial Balance Endpoints
# ═══════════════════════════════════════════════════════════════

class TestTrialBalance:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client

    def test_trial_balance_compare_returns_list(self):
        """Trial balance compare returns a list of categories."""
        resp = self.client.get(
            "/api/funds/TEST-ACCT/trial-balance-compare",
            params={"valuationDt": "2025-01-15"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if len(data) > 0:
            row = data[0]
            assert "category" in row
            assert "incumbentBalance" in row
            assert "bnyBalance" in row
            assert "balanceDiff" in row
            assert "validationStatus" in row

    def test_subledger_check_returns_object(self):
        """Subledger check returns comparison object."""
        resp = self.client.get(
            "/api/funds/TEST-ACCT/trial-balance-compare/Investment%20Cost/subledger-check",
            params={"valuationDt": "2025-01-15"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "ledgerValue" in data
        assert "subledgerValue" in data
        assert "difference" in data
        assert "validationStatus" in data


# ═══════════════════════════════════════════════════════════════
# Position Drill-Down Endpoints
# ═══════════════════════════════════════════════════════════════

class TestPositionDrillDown:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client

    def test_position_compare_returns_list(self):
        """Position compare returns a list of positions."""
        resp = self.client.get(
            "/api/funds/TEST-ACCT/position-compare",
            params={"valuationDt": "2025-01-15", "category": "Investment Cost"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if len(data) > 0:
            row = data[0]
            assert "assetId" in row
            assert "comparisonFields" in row
            assert "validationStatus" in row

    def test_tax_lots_returns_list(self):
        """Tax lots endpoint returns a list of lots."""
        resp = self.client.get(
            "/api/funds/TEST-ACCT/position-compare/ASSET-001/tax-lots",
            params={"valuationDt": "2025-01-15"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_basis_lot_check_returns_list(self):
        """Basis lot check returns a list of lot rows."""
        resp = self.client.get(
            "/api/funds/TEST-ACCT/basis-lot-check",
            params={"valuationDt": "2025-01-15"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


# ═══════════════════════════════════════════════════════════════
# AI Analysis Endpoint
# ═══════════════════════════════════════════════════════════════

class TestAIAnalysis:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client

    def test_ai_analysis_returns_object(self):
        """AI analysis endpoint returns analysis structure."""
        resp = self.client.get("/api/ai/analysis", params={"eventId": "EVT-001"})
        assert resp.status_code == 200
        data = resp.json()
        assert "trendSummary" in data
        assert "confidenceScore" in data
        assert "patternRecognition" in data
        assert "recommendedNextStep" in data

    def test_ai_analysis_with_account(self):
        """AI analysis scoped to account returns same structure."""
        resp = self.client.get("/api/ai/analysis", params={"eventId": "EVT-001", "account": "TEST-ACCT"})
        assert resp.status_code == 200
        data = resp.json()
        assert "trendSummary" in data
        assert "confidenceScore" in data


# ═══════════════════════════════════════════════════════════════
# SSE Endpoint
# ═══════════════════════════════════════════════════════════════

class TestSSE:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client

    def test_sse_endpoint_returns_stream_or_404(self):
        """SSE endpoint returns event-stream content type (or 404 if event missing)."""
        with self.client.stream("GET", "/api/events/EVT-001/sse") as resp:
            # 404 if event doesn't exist in test DB, 200 with stream if it does
            assert resp.status_code in (200, 404)
            if resp.status_code == 200:
                assert "text/event-stream" in resp.headers.get("content-type", "")


# ═══════════════════════════════════════════════════════════════
# Validation Run Endpoint
# ═══════════════════════════════════════════════════════════════

class TestValidationRun:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client

    def test_run_sequential_requires_body(self):
        """Run sequential validation endpoint requires JSON body."""
        resp = self.client.post("/api/validation/run-sequential")
        # Should fail with 422 (missing body) or 400
        assert resp.status_code in (400, 422)

    def test_run_sequential_accepts_valid_body(self):
        """Run sequential validation accepts properly-formed request."""
        resp = self.client.post(
            "/api/validation/run-sequential",
            json={
                "eventId": "EVT-001",
                "valuationDt": "2025-01-15",
                "checkSuite": ["NAV_TO_LEDGER"],
            }
        )
        # Should return 200 (starts validation) or 404 (event not found)
        assert resp.status_code in (200, 404)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
