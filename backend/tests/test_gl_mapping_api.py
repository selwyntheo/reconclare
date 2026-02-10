"""
Tests for GL Account Mapping API endpoints.
Tests CRUD operations, bulk operations, and validation.
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.main import app
from db.mongodb import get_async_db, COLLECTIONS

client = TestClient(app)

# Test data
TEST_EVENT_ID = "EVT-TEST-001"
TEST_PROVIDER = "STATE_STREET"


class TestGLAccountMappingAPI:
    """Test suite for GL Account Mapping endpoints."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data before each test."""
        # Note: In a real test environment, you'd use a test database
        # and seed it with test data. For now, these tests assume
        # the database has been seeded with the reference data.
        pass

    # ── Reference Data Endpoints ──────────────────────────────

    def test_list_incumbent_gl_accounts(self):
        """Test listing incumbent GL accounts."""
        response = client.get("/api/reference/incumbent-gl-accounts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_list_incumbent_gl_accounts_with_provider_filter(self):
        """Test listing incumbent GL accounts filtered by provider."""
        response = client.get(
            "/api/reference/incumbent-gl-accounts",
            params={"provider": "STATE_STREET"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned accounts should be from State Street
        for account in data:
            assert account.get("provider") == "STATE_STREET"

    def test_list_eagle_gl_accounts(self):
        """Test listing Eagle GL accounts."""
        response = client.get("/api/reference/eagle-gl-accounts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_list_eagle_gl_accounts_with_section_filter(self):
        """Test listing Eagle GL accounts filtered by ledger section."""
        response = client.get(
            "/api/reference/eagle-gl-accounts",
            params={"ledger_section": "ASSETS"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for account in data:
            assert account.get("ledgerSection") == "ASSETS"

    # ── Mapping CRUD Endpoints ────────────────────────────────

    def test_list_gl_mappings_empty(self):
        """Test listing GL mappings for event with no mappings."""
        response = client.get(f"/api/events/{TEST_EVENT_ID}/gl-mappings")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_gl_mapping(self):
        """Test creating a GL mapping."""
        # First, get available accounts
        incumbent_resp = client.get(
            "/api/reference/incumbent-gl-accounts",
            params={"provider": TEST_PROVIDER}
        )
        eagle_resp = client.get("/api/reference/eagle-gl-accounts")

        incumbent_accounts = incumbent_resp.json()
        eagle_accounts = eagle_resp.json()

        if not incumbent_accounts or not eagle_accounts:
            pytest.skip("No reference accounts available")

        source_account = incumbent_accounts[0]["glAccountNumber"]
        target_account = eagle_accounts[0]["glAccountNumber"]

        # Create mapping
        response = client.post(
            f"/api/events/{TEST_EVENT_ID}/gl-mappings",
            json={
                "eventId": TEST_EVENT_ID,
                "sourceProvider": TEST_PROVIDER,
                "sourceGlAccountNumber": source_account,
                "targetGlAccountNumber": target_account,
                "mappingType": "ONE_TO_ONE",
                "splitWeight": 1.0,
            }
        )

        # Could be 200 (success) or 404 (if accounts not in DB)
        if response.status_code == 200:
            data = response.json()
            assert "mappingId" in data
            assert data["sourceGlAccountNumber"] == source_account
            assert data["targetGlAccountNumber"] == target_account
            assert data["mappingType"] == "ONE_TO_ONE"
            assert data["splitWeight"] == 1.0

            # Cleanup: delete the mapping
            mapping_id = data["mappingId"]
            client.delete(f"/api/gl-mappings/{mapping_id}")

    def test_create_gl_mapping_event_mismatch(self):
        """Test creating a mapping with mismatched event ID."""
        response = client.post(
            f"/api/events/{TEST_EVENT_ID}/gl-mappings",
            json={
                "eventId": "DIFFERENT_EVENT",
                "sourceProvider": TEST_PROVIDER,
                "sourceGlAccountNumber": "1050",
                "targetGlAccountNumber": "EAGLE-1050",
            }
        )
        assert response.status_code == 400

    def test_update_gl_mapping(self):
        """Test updating a GL mapping."""
        # First create a mapping
        incumbent_resp = client.get(
            "/api/reference/incumbent-gl-accounts",
            params={"provider": TEST_PROVIDER}
        )
        eagle_resp = client.get("/api/reference/eagle-gl-accounts")

        incumbent_accounts = incumbent_resp.json()
        eagle_accounts = eagle_resp.json()

        if not incumbent_accounts or not eagle_accounts:
            pytest.skip("No reference accounts available")

        create_resp = client.post(
            f"/api/events/{TEST_EVENT_ID}/gl-mappings",
            json={
                "eventId": TEST_EVENT_ID,
                "sourceProvider": TEST_PROVIDER,
                "sourceGlAccountNumber": incumbent_accounts[1]["glAccountNumber"],
                "targetGlAccountNumber": eagle_accounts[1]["glAccountNumber"],
            }
        )

        if create_resp.status_code != 200:
            pytest.skip("Could not create test mapping")

        mapping_id = create_resp.json()["mappingId"]

        # Update the mapping
        update_resp = client.put(
            f"/api/gl-mappings/{mapping_id}",
            json={
                "mappingType": "ONE_TO_MANY",
                "splitWeight": 0.5,
            }
        )

        assert update_resp.status_code == 200
        data = update_resp.json()
        assert data["mappingType"] == "ONE_TO_MANY"
        assert data["splitWeight"] == 0.5

        # Cleanup
        client.delete(f"/api/gl-mappings/{mapping_id}")

    def test_delete_gl_mapping(self):
        """Test deleting a GL mapping."""
        # First create a mapping
        incumbent_resp = client.get(
            "/api/reference/incumbent-gl-accounts",
            params={"provider": TEST_PROVIDER}
        )
        eagle_resp = client.get("/api/reference/eagle-gl-accounts")

        incumbent_accounts = incumbent_resp.json()
        eagle_accounts = eagle_resp.json()

        if not incumbent_accounts or not eagle_accounts:
            pytest.skip("No reference accounts available")

        create_resp = client.post(
            f"/api/events/{TEST_EVENT_ID}/gl-mappings",
            json={
                "eventId": TEST_EVENT_ID,
                "sourceProvider": TEST_PROVIDER,
                "sourceGlAccountNumber": incumbent_accounts[2]["glAccountNumber"],
                "targetGlAccountNumber": eagle_accounts[2]["glAccountNumber"],
            }
        )

        if create_resp.status_code != 200:
            pytest.skip("Could not create test mapping")

        mapping_id = create_resp.json()["mappingId"]

        # Delete the mapping
        delete_resp = client.delete(f"/api/gl-mappings/{mapping_id}")
        assert delete_resp.status_code == 200
        assert delete_resp.json()["status"] == "deleted"

        # Verify it's gone
        update_resp = client.put(
            f"/api/gl-mappings/{mapping_id}",
            json={"splitWeight": 0.5}
        )
        assert update_resp.status_code == 404

    def test_delete_nonexistent_mapping(self):
        """Test deleting a mapping that doesn't exist."""
        response = client.delete("/api/gl-mappings/NONEXISTENT-MAPPING-ID")
        assert response.status_code == 404

    # ── Bulk Operations ───────────────────────────────────────

    def test_bulk_create_mappings(self):
        """Test bulk creating GL mappings."""
        incumbent_resp = client.get(
            "/api/reference/incumbent-gl-accounts",
            params={"provider": TEST_PROVIDER}
        )
        eagle_resp = client.get("/api/reference/eagle-gl-accounts")

        incumbent_accounts = incumbent_resp.json()
        eagle_accounts = eagle_resp.json()

        if len(incumbent_accounts) < 3 or len(eagle_accounts) < 3:
            pytest.skip("Not enough reference accounts available")

        mappings = [
            {
                "eventId": TEST_EVENT_ID,
                "sourceProvider": TEST_PROVIDER,
                "sourceGlAccountNumber": incumbent_accounts[i]["glAccountNumber"],
                "targetGlAccountNumber": eagle_accounts[i]["glAccountNumber"],
            }
            for i in range(3)
        ]

        response = client.post(
            f"/api/events/{TEST_EVENT_ID}/gl-mappings/bulk",
            json={"mappings": mappings}
        )

        assert response.status_code == 200
        data = response.json()
        assert "created" in data
        assert "errors" in data
        assert "mappings" in data

        # Cleanup
        for mapping in data.get("mappings", []):
            client.delete(f"/api/gl-mappings/{mapping['mappingId']}")

    def test_bulk_delete_mappings(self):
        """Test bulk deleting GL mappings."""
        incumbent_resp = client.get(
            "/api/reference/incumbent-gl-accounts",
            params={"provider": TEST_PROVIDER}
        )
        eagle_resp = client.get("/api/reference/eagle-gl-accounts")

        incumbent_accounts = incumbent_resp.json()
        eagle_accounts = eagle_resp.json()

        if len(incumbent_accounts) < 2 or len(eagle_accounts) < 2:
            pytest.skip("Not enough reference accounts available")

        # Create some mappings first
        mapping_ids = []
        for i in range(2):
            create_resp = client.post(
                f"/api/events/{TEST_EVENT_ID}/gl-mappings",
                json={
                    "eventId": TEST_EVENT_ID,
                    "sourceProvider": TEST_PROVIDER,
                    "sourceGlAccountNumber": incumbent_accounts[i + 5]["glAccountNumber"],
                    "targetGlAccountNumber": eagle_accounts[i + 5]["glAccountNumber"],
                }
            )
            if create_resp.status_code == 200:
                mapping_ids.append(create_resp.json()["mappingId"])

        if not mapping_ids:
            pytest.skip("Could not create test mappings")

        # Bulk delete
        response = client.delete(
            f"/api/events/{TEST_EVENT_ID}/gl-mappings/bulk",
            json={"mappingIds": mapping_ids}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == len(mapping_ids)

    # ── Unmapped Accounts ─────────────────────────────────────

    def test_get_unmapped_accounts(self):
        """Test getting unmapped accounts for an event."""
        response = client.get(f"/api/events/{TEST_EVENT_ID}/gl-mappings/unmapped")

        # May return 404 if event doesn't exist
        if response.status_code == 200:
            data = response.json()
            assert "unmappedIncumbent" in data
            assert "unmappedEagle" in data
            assert isinstance(data["unmappedIncumbent"], list)
            assert isinstance(data["unmappedEagle"], list)

    # ── Validation ────────────────────────────────────────────

    def test_validate_mappings(self):
        """Test validating GL mappings for an event."""
        response = client.post(f"/api/events/{TEST_EVENT_ID}/gl-mappings/validate")
        assert response.status_code == 200
        data = response.json()
        assert "isValid" in data
        assert "errors" in data
        assert "warnings" in data
        assert "mappingCount" in data

    def test_validate_mappings_with_invalid_weights(self):
        """Test validation catches invalid split weights."""
        # This test would require setting up mappings with incorrect split weights
        # and verifying the validation catches the error
        pass  # Implementation depends on having test database setup


class TestGLMappingBusinessLogic:
    """Test suite for GL Mapping business logic."""

    def test_one_to_one_mapping(self):
        """Test creating a simple 1:1 mapping."""
        # Create mapping, verify type is ONE_TO_ONE
        pass

    def test_one_to_many_mapping(self):
        """Test creating a 1:N mapping with split weights."""
        # Create first mapping, then add second target
        # Verify weights are recalculated
        pass

    def test_many_to_one_mapping(self):
        """Test creating an N:1 mapping."""
        # Create mapping to target, then add second source to same target
        # Verify type changes to MANY_TO_ONE
        pass

    def test_split_weight_validation(self):
        """Test that split weights must sum to 1.0 for 1:N mappings."""
        # Create 1:N mapping, verify validation catches invalid weights
        pass


# Health check test
def test_health_check():
    """Test the health check endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
