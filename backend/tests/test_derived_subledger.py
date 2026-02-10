"""
Tests for Derived Subledger Service
Per spec ledger_subledger.md Section 9 - Derived Subledger Rollup Logic
"""
import pytest
from unittest.mock import MagicMock, patch
from decimal import Decimal

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.derived_subledger import (
    DerivedSubledgerService,
    SUBLEDGER_SUPPORTED_CATEGORIES,
    TRANS_CODE_TO_CATEGORY,
    CASH_SEC_TYPES,
    FUTURES_SEC_TYPES,
)


class TestCategoryDefinitions:
    """Test category and mapping definitions match spec."""

    def test_subledger_supported_categories(self):
        """Verify all 17 categories are defined (Appendix A)."""
        assert len(SUBLEDGER_SUPPORTED_CATEGORIES) == 17

        # Supported categories
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Cash"] is True
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Investment Cost"] is True
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Holdings Unrealized"] is True
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Future Margin"] is True
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Dividend RecPay"] is True
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Reclaim RecPay"] is True
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Interest RecPay"] is True
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Swap Income RecPay"] is True
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Investment RecPay"] is True
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Subscription Rec"] is True
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Unrealized INCST"] is True

        # Unsupported categories
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Expense RecPay"] is False
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Capital"] is False
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Realized GL"] is False
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Income"] is False
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Expenses"] is False
        assert SUBLEDGER_SUPPORTED_CATEGORIES["Distribution Pay"] is False

    def test_trans_code_to_category_mapping(self):
        """Verify transaction code mappings (Section 8.3)."""
        assert TRANS_CODE_TO_CATEGORY["DIV"] == "Dividend RecPay"
        assert TRANS_CODE_TO_CATEGORY["RECL"] == "Reclaim RecPay"
        assert TRANS_CODE_TO_CATEGORY["RECL-"] == "Reclaim RecPay"
        assert TRANS_CODE_TO_CATEGORY["RECL+"] == "Reclaim RecPay"
        assert TRANS_CODE_TO_CATEGORY["BUY"] == "Investment RecPay"
        assert TRANS_CODE_TO_CATEGORY["SELL"] == "Investment RecPay"
        assert TRANS_CODE_TO_CATEGORY["COVER"] == "Investment RecPay"
        assert TRANS_CODE_TO_CATEGORY["INT"] == "Interest RecPay"

    def test_security_type_classifications(self):
        """Verify security type classifications (Appendix B)."""
        assert "CU" in CASH_SEC_TYPES
        assert "FT" in FUTURES_SEC_TYPES


class TestPositionAggregation:
    """Test position-level aggregation logic (Section 5)."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database with sample data."""
        db = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        """Create service with mocked database."""
        with patch('services.derived_subledger.get_sync_db', return_value=mock_db):
            svc = DerivedSubledgerService()
            svc.db = mock_db
            return svc

    def test_cash_category_aggregation(self, service, mock_db):
        """Cash category should include only CU secType positions (Section 9.2)."""
        # Mock position data
        positions = [
            {"assetId": "USD-CASH", "posBookValueBase": 7892.64, "posMarketValueBase": 7928.01, "posIncomeBase": 0, "dailyVariationMarginBase": 0, "ltdVariationMarginBase": 0},
            {"assetId": "AAPL", "posBookValueBase": 100000, "posMarketValueBase": 120000, "posIncomeBase": 0, "dailyVariationMarginBase": 0, "ltdVariationMarginBase": 0},
        ]
        mock_db.__getitem__.return_value.find.return_value = positions

        # Mock security types
        service._get_security_types = MagicMock(return_value={"USD-CASH": "CU", "AAPL": "S"})

        result = service.get_position_rollup("1", "2026-02-07")

        # Cash should only have the CU position book value
        assert result["Cash"]["bookValue"] == 7892.64
        assert result["Cash"]["total"] == 7892.64

        # Investment Cost should have the stock position
        assert result["Investment Cost"]["bookValue"] == 100000

    def test_investment_cost_excludes_cash_and_futures(self, service, mock_db):
        """Investment Cost excludes CU and FT secTypes (Section 9.2)."""
        positions = [
            {"assetId": "USD-CASH", "posBookValueBase": 5000, "posMarketValueBase": 5000, "posIncomeBase": 0, "dailyVariationMarginBase": 0, "ltdVariationMarginBase": 0},
            {"assetId": "FUT-SP500", "posBookValueBase": 0, "posMarketValueBase": 0, "posIncomeBase": 0, "dailyVariationMarginBase": 10000, "ltdVariationMarginBase": -500},
            {"assetId": "MSFT", "posBookValueBase": 200000, "posMarketValueBase": 250000, "posIncomeBase": 0, "dailyVariationMarginBase": 0, "ltdVariationMarginBase": 0},
        ]
        mock_db.__getitem__.return_value.find.return_value = positions

        service._get_security_types = MagicMock(return_value={
            "USD-CASH": "CU",
            "FUT-SP500": "FT",
            "MSFT": "S",
        })

        result = service.get_position_rollup("1", "2026-02-07")

        # Investment Cost should only have stock
        assert result["Investment Cost"]["bookValue"] == 200000

    def test_future_margin_calculation(self, service, mock_db):
        """Future Margin = ltdVariationMargin + dailyVariationMargin (Section 9.2)."""
        positions = [
            {"assetId": "FUT-SP500", "posBookValueBase": 0, "posMarketValueBase": 0, "posIncomeBase": 0, "dailyVariationMarginBase": 11894.60, "ltdVariationMarginBase": -19.13},
        ]
        mock_db.__getitem__.return_value.find.return_value = positions

        service._get_security_types = MagicMock(return_value={"FUT-SP500": "FT"})

        result = service.get_position_rollup("1", "2026-02-07")

        # Future Margin = 11894.60 + (-19.13) = 11875.47
        assert abs(result["Future Margin"]["futureMargin"] - 11875.47) < 0.01
        assert abs(result["Future Margin"]["total"] - 11875.47) < 0.01

    def test_holdings_unrealized_calculation(self, service, mock_db):
        """Holdings Unrealized = marketValue - bookValue (Section 9.2)."""
        positions = [
            {"assetId": "AAPL", "posBookValueBase": 300000, "posMarketValueBase": 450000, "posIncomeBase": 0, "dailyVariationMarginBase": 0, "ltdVariationMarginBase": 0},
        ]
        mock_db.__getitem__.return_value.find.return_value = positions

        service._get_security_types = MagicMock(return_value={"AAPL": "S"})

        result = service.get_position_rollup("1", "2026-02-07")

        # Unrealized = 450000 - 300000 = 150000
        assert result["Holdings Unrealized"]["unrealized"] == 150000
        # Unrealized INCST should be inverse
        assert result["Unrealized INCST"]["unrealized"] == -150000

    def test_interest_recpay_aggregation(self, service, mock_db):
        """Interest RecPay includes position income (Section 9.2)."""
        positions = [
            {"assetId": "BOND-A", "posBookValueBase": 100000, "posMarketValueBase": 102000, "posIncomeBase": 90.88, "dailyVariationMarginBase": 0, "ltdVariationMarginBase": 0},
        ]
        mock_db.__getitem__.return_value.find.return_value = positions

        service._get_security_types = MagicMock(return_value={"BOND-A": "TI"})

        result = service.get_position_rollup("1", "2026-02-07")

        assert result["Interest RecPay"]["netIncome"] == 90.88
        assert result["Interest RecPay"]["total"] == 90.88


class TestTransactionAggregation:
    """Test unsettled transaction aggregation logic (Section 7)."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        with patch('services.derived_subledger.get_sync_db', return_value=mock_db):
            svc = DerivedSubledgerService()
            svc.db = mock_db
            return svc

    def test_dividend_recpay_aggregation(self, service, mock_db):
        """Dividend RecPay = SUM(transAmountBase) WHERE transCode = 'DIV'."""
        transactions = [
            {"transCode": "DIV", "transAmountBase": 682.98},
        ]
        mock_db.__getitem__.return_value.find.return_value = transactions

        result = service.get_transaction_rollup("1", "2026-02-07")

        assert result["Dividend RecPay"]["transactionValue"] == 682.98
        assert result["Dividend RecPay"]["transCodes"]["DIV"] == 682.98

    def test_reclaim_recpay_aggregation(self, service, mock_db):
        """Reclaim RecPay includes RECL, RECL-, RECL+ (Section 7.2)."""
        transactions = [
            {"transCode": "RECL", "transAmountBase": 13982.74},
            {"transCode": "RECL-", "transAmountBase": -21.69},
            {"transCode": "RECL+", "transAmountBase": 3105.62},
        ]
        mock_db.__getitem__.return_value.find.return_value = transactions

        result = service.get_transaction_rollup("1", "2026-02-07")

        # Total = 13982.74 - 21.69 + 3105.62 = 17066.67
        assert abs(result["Reclaim RecPay"]["transactionValue"] - 17066.67) < 0.01

    def test_investment_recpay_aggregation(self, service, mock_db):
        """Investment RecPay includes BUY, SELL, COVER (Section 8.3)."""
        transactions = [
            {"transCode": "BUY", "transAmountBase": -4400277.40},
            {"transCode": "SELL", "transAmountBase": 1810000.00},
            {"transCode": "COVER", "transAmountBase": 0.00},
        ]
        mock_db.__getitem__.return_value.find.return_value = transactions

        result = service.get_transaction_rollup("1", "2026-02-07")

        # Total = -4400277.40 + 1810000.00 + 0 = -2590277.40
        assert abs(result["Investment RecPay"]["transactionValue"] - (-2590277.40)) < 0.01


class TestDerivedSubledgerRollup:
    """Test combined rollup logic (Section 9)."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        with patch('services.derived_subledger.get_sync_db', return_value=mock_db):
            svc = DerivedSubledgerService()
            svc.db = mock_db
            return svc

    def test_combined_rollup_structure(self, service):
        """Rollup returns all 17 categories with correct structure."""
        # Mock the sub-methods
        service.get_position_rollup = MagicMock(return_value={
            "Cash": {"bookValue": 7892.64, "unrealized": 0, "netIncome": 0, "futureMargin": 0, "total": 7892.64},
            "Investment Cost": {"bookValue": 1816202.20, "unrealized": 0, "netIncome": 0, "futureMargin": 0, "total": 1816202.20},
        })
        service.get_transaction_rollup = MagicMock(return_value={
            "Dividend RecPay": {"transactionValue": 682.98, "transCodes": {"DIV": 682.98}},
        })

        result = service.get_derived_subledger_rollup("1", "2026-02-07")

        assert len(result) == 17  # All categories returned

        # Check structure
        for row in result:
            assert "account" in row
            assert "category" in row
            assert "subledgerSupported" in row
            assert "positionValue" in row
            assert "transactionValue" in row
            assert "derivedValue" in row

    def test_unsupported_categories_return_null(self, service):
        """Unsupported categories should have null derived values."""
        service.get_position_rollup = MagicMock(return_value={})
        service.get_transaction_rollup = MagicMock(return_value={})

        result = service.get_derived_subledger_rollup("1", "2026-02-07")

        unsupported_categories = [r for r in result if not r["subledgerSupported"]]
        assert len(unsupported_categories) == 6  # 6 unsupported categories

        for row in unsupported_categories:
            assert row["derivedValue"] is None


class TestLedgerSubledgerSummary:
    """Test the complete ledger vs subledger comparison (Section 2)."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        with patch('services.derived_subledger.get_sync_db', return_value=mock_db):
            svc = DerivedSubledgerService()
            svc.db = mock_db
            return svc

    def test_variance_calculation(self, service):
        """Variance = Ledger - SubLedger (Section 9.3)."""
        # Mock derived rollup
        service.get_derived_subledger_rollup = MagicMock(return_value=[
            {"category": "Cash", "subledgerSupported": True, "derivedValue": 7892.64},
            {"category": "Future Margin", "subledgerSupported": True, "derivedValue": 11875.47},
        ])

        # Mock ledger values
        service._get_ledger_by_category = MagicMock(return_value={
            "Cash": 7892.64,
            "Future Margin": 11777.97,  # Has variance!
        })

        result = service.get_ledger_subledger_summary("1", "2026-02-07")

        cash_row = next(r for r in result["rows"] if r["category"] == "Cash")
        assert cash_row["variance"] == 0.0

        future_margin_row = next(r for r in result["rows"] if r["category"] == "Future Margin")
        # Variance = 11777.97 - 11875.47 = -97.50
        assert abs(future_margin_row["variance"] - (-97.50)) < 0.01

    def test_totals_calculation(self, service):
        """Totals should sum all ledger and subledger values."""
        service.get_derived_subledger_rollup = MagicMock(return_value=[
            {"category": "Cash", "subledgerSupported": True, "derivedValue": 1000},
            {"category": "Investment Cost", "subledgerSupported": True, "derivedValue": 2000},
            {"category": "Expense RecPay", "subledgerSupported": False, "derivedValue": None},
        ])

        service._get_ledger_by_category = MagicMock(return_value={
            "Cash": 1000,
            "Investment Cost": 2000,
            "Expense RecPay": 500,
        })

        result = service.get_ledger_subledger_summary("1", "2026-02-07")

        assert result["totals"]["ledger"] == 3500  # 1000 + 2000 + 500
        assert result["totals"]["subLedger"] == 3000  # 1000 + 2000 (unsupported excluded)


class TestSampleDataValidation:
    """Validate against sample data from spec Section 2.2."""

    def test_account_1_sample_data(self):
        """Verify spec sample data for Account 1."""
        # Sample data from Section 2.2
        expected_data = {
            "Cash": {"ledger": 7892.64, "subLedger": 7892.64, "variance": 0.00},
            "Investment Cost": {"ledger": 1816202.20, "subLedger": 1816202.20, "variance": 0.00},
            "Holdings Unrealized": {"ledger": 375114.99, "subLedger": 375114.99, "variance": 0.00},
            "Future Margin": {"ledger": 11777.97, "subLedger": 11875.47, "variance": -97.50},
            "Dividend RecPay": {"ledger": 682.98, "subLedger": 682.98, "variance": 0.00},
            "Reclaim RecPay": {"ledger": 17066.67, "subLedger": 17066.67, "variance": 0.00},
            "Interest RecPay": {"ledger": 90.88, "subLedger": 90.88, "variance": 0.00},
        }

        # Verify the expected variances
        for category, values in expected_data.items():
            expected_variance = values["ledger"] - values["subLedger"]
            assert abs(values["variance"] - expected_variance) < 0.01, \
                f"Variance mismatch for {category}: expected {expected_variance}, got {values['variance']}"
