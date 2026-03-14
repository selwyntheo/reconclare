"""
Tests for MMIF Mapping Configuration Templates.

Tests the mapping_templates module: template data structure,
fund type coverage, and field correctness.
"""
import sys
sys.path.insert(0, "/Volumes/D/Projects/ReconClareAI/backend")

import pytest
from mmif.mapping_templates import list_templates, get_mapping_template


class TestListTemplates:
    """Test the template listing function."""

    def test_returns_all_four_fund_types(self):
        templates = list_templates()
        fund_types = {t["fundType"] for t in templates}
        assert fund_types == {"AIF", "HEDGE", "UCITS", "MMF"}

    def test_each_template_has_required_fields(self):
        for t in list_templates():
            assert "fundType" in t
            assert "description" in t
            assert "mappingCount" in t
            assert isinstance(t["mappingCount"], int)
            assert t["mappingCount"] > 0

    def test_descriptions_are_non_empty(self):
        for t in list_templates():
            assert len(t["description"]) > 10


class TestGetMappingTemplate:
    """Test individual template retrieval."""

    def test_aif_template_exists(self):
        t = get_mapping_template("AIF")
        assert t is not None
        assert t["fundType"] == "AIF"

    def test_hedge_template_exists(self):
        t = get_mapping_template("HEDGE")
        assert t is not None
        assert t["fundType"] == "HEDGE"

    def test_ucits_template_exists(self):
        t = get_mapping_template("UCITS")
        assert t is not None

    def test_mmf_template_exists(self):
        t = get_mapping_template("MMF")
        assert t is not None

    def test_invalid_fund_type_returns_none(self):
        assert get_mapping_template("INVALID") is None

    def test_case_insensitive_lookup(self):
        assert get_mapping_template("aif") is not None
        assert get_mapping_template("Hedge") is not None

    def test_aif_has_expected_mapping_count(self):
        t = get_mapping_template("AIF")
        assert len(t["mappings"]) == 7

    def test_hedge_has_expected_mapping_count(self):
        t = get_mapping_template("HEDGE")
        assert len(t["mappings"]) == 9

    def test_ucits_has_expected_mapping_count(self):
        t = get_mapping_template("UCITS")
        assert len(t["mappings"]) == 3

    def test_mmf_has_expected_mapping_count(self):
        t = get_mapping_template("MMF")
        assert len(t["mappings"]) == 3


class TestMappingRowStructure:
    """Test that mapping rows have all required fields."""

    REQUIRED_FIELDS = [
        "eagleGlPattern", "eagleSourceTable", "eagleSourceField",
        "mmifSection", "mmifField", "codeType", "signConvention",
        "isReported", "notes",
    ]

    @pytest.mark.parametrize("fund_type", ["AIF", "HEDGE", "UCITS", "MMF"])
    def test_all_rows_have_required_fields(self, fund_type):
        t = get_mapping_template(fund_type)
        for row in t["mappings"]:
            for field in self.REQUIRED_FIELDS:
                assert field in row, f"{fund_type} mapping missing {field}"

    @pytest.mark.parametrize("fund_type", ["AIF", "HEDGE", "UCITS", "MMF"])
    def test_sign_convention_is_valid(self, fund_type):
        t = get_mapping_template(fund_type)
        for row in t["mappings"]:
            assert row["signConvention"] in (1, -1)

    @pytest.mark.parametrize("fund_type", ["AIF", "HEDGE", "UCITS", "MMF"])
    def test_mmif_sections_are_valid(self, fund_type):
        valid_sections = {"2", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "4.1", "4.2", "4.3", "5.1", "5.2", "5.3", "5.4"}
        t = get_mapping_template(fund_type)
        for row in t["mappings"]:
            assert row["mmifSection"] in valid_sections


class TestHedgeSpecificMappings:
    """Test HEDGE-specific mapping features."""

    def test_has_short_equity_with_negative_sign(self):
        t = get_mapping_template("HEDGE")
        short_rows = [m for m in t["mappings"] if m["signConvention"] == -1 and m["mmifSection"] == "3.1"]
        assert len(short_rows) >= 1
        assert "Short" in short_rows[0]["notes"] or "short" in short_rows[0]["notes"]

    def test_has_securities_lending(self):
        t = get_mapping_template("HEDGE")
        lending = [m for m in t["mappings"] if m["mmifSection"] == "5.2"]
        assert len(lending) >= 1

    def test_has_derivatives(self):
        t = get_mapping_template("HEDGE")
        deriv = [m for m in t["mappings"] if m["mmifSection"] == "3.4"]
        assert len(deriv) >= 3  # options, futures, securities borrowing


class TestAifSpecificMappings:
    """Test AIF-specific mapping features."""

    def test_has_uncalled_commitments(self):
        t = get_mapping_template("AIF")
        uncalled = [m for m in t["mappings"] if "uncalled" in m["notes"].lower() or "commitment" in m["notes"].lower()]
        assert len(uncalled) >= 1

    def test_has_fund_shares(self):
        t = get_mapping_template("AIF")
        shares = [m for m in t["mappings"] if m["mmifSection"] == "5.1"]
        assert len(shares) >= 1
        assert shares[0]["signConvention"] == -1


class TestEnrichmentData:
    """Test counterparty and investor classification data."""

    @pytest.mark.parametrize("fund_type", ["AIF", "HEDGE", "UCITS", "MMF"])
    def test_has_counterparty_enrichment(self, fund_type):
        t = get_mapping_template(fund_type)
        assert "counterpartyEnrichment" in t
        assert len(t["counterpartyEnrichment"]) > 0

    @pytest.mark.parametrize("fund_type", ["AIF", "HEDGE", "UCITS", "MMF"])
    def test_has_investor_classification(self, fund_type):
        t = get_mapping_template(fund_type)
        assert "investorClassification" in t
        assert len(t["investorClassification"]) > 0

    @pytest.mark.parametrize("fund_type", ["AIF", "HEDGE", "UCITS", "MMF"])
    def test_counterparty_entries_have_sector_and_country(self, fund_type):
        t = get_mapping_template(fund_type)
        for key, val in t["counterpartyEnrichment"].items():
            assert "sector" in val
            assert "country" in val
